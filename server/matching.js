// Matching lost reports with found items.
//
// Used in two directions:
// - a student reports a lost item  -> findMatchesForReport() lists found items that look similar;
// - a student reports a found item -> notifyOwnersOfNewItem() tells everyone whose open lost report it matches.
//
// Only items and reports in the SAME SCHOOL are compared, and an item must have been found
// on or after the day it was lost (with DATE_SLACK_DAYS of slack, in case someone is off by a day or two).
//
// Scoring (simple on purpose, so the team can tune it):
//   same category ......................................... +3
//   each word shared between the two TITLES ............... +3
//   each other word shared anywhere (title, description,
//   location) ............................................. +1
// Common words ("the", "a", "my", "lost"...) are ignored, plurals are folded ("keys" = "key"), and a few
// synonyms are treated as the same word ("backpack" = "bag"). A pair needs at least one shared word and a
// score of MIN_SCORE to count as a match.

const MIN_SCORE = 4;
const DATE_SLACK_DAYS = 2;
const MAX_MATCHES = 10;

const STOPWORDS = new Set(
  `a an the and or of in on at to for with from by near my our his her its their this that these those
   is was were are be been it i we you he she they some one two three lost found item thing stuff left
   very really just about around inside outside small big large new old colour color`.split(/\s+/)
);

// Words that mean the same thing, mapped to one word.
const SYNONYMS = {
  backpack: "bag", rucksack: "bag", handbag: "bag", satchel: "bag",
  mobile: "phone", smartphone: "phone", cellphone: "phone", iphone: "phone",
  notebook: "laptop", macbook: "laptop", computer: "laptop",
  earbud: "earphone", airpod: "earphone", headphone: "earphone", headset: "earphone",
  purse: "wallet",
  flask: "bottle",
  sweater: "hoodie", jumper: "hoodie", sweatshirt: "hoodie",
  spectacle: "glass", spec: "glass", sunglass: "glass",
  grey: "gray",
};

function normalizeWord(word) {
  let w = word.toLowerCase();
  if (w.length > 3 && w.endsWith("es") && /(ss|sh|ch|x)es$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  return SYNONYMS[w] || w;
}

// Text -> a set of meaningful words.
function words(...texts) {
  const out = new Set();
  for (const text of texts) {
    for (const raw of String(text || "").split(/[^a-zA-Z0-9]+/)) {
      if (raw.length < 2) continue;
      const w = normalizeWord(raw);
      if (!STOPWORDS.has(w) && !STOPWORDS.has(raw.toLowerCase())) out.add(w);
    }
  }
  return out;
}

// How similar a lost report and a found item are. Returns { score, matchedWords }.
function scorePair(report, item) {
  let score = 0;
  if (String(report.category).toLowerCase() === String(item.category).toLowerCase()) score += 3;

  const reportTitle = words(report.title);
  const itemTitle = words(item.title);
  const reportAll = words(report.title, report.description, report.location);
  const itemAll = words(item.title, item.description, item.location);

  const matched = new Set();
  for (const w of reportTitle) {
    if (itemTitle.has(w)) {
      score += 3;
      matched.add(w);
    }
  }
  for (const w of reportAll) {
    if (!matched.has(w) && itemAll.has(w)) {
      score += 1;
      matched.add(w);
    }
  }

  if (matched.size === 0) return { score: 0, matchedWords: [] };
  return { score, matchedWords: [...matched] };
}

function confidence(score) {
  if (score >= 9) return "high";
  if (score >= 6) return "medium";
  return "low";
}

// The fields of a found item we show as a match.
function toMatch(item, { score, matchedWords }) {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    category: item.category,
    location: item.location,
    date_found: item.date_found,
    status: item.status,
    reward_amount: item.reward_amount,
    image_url: item.image_url,
    my_claim_status: item.my_claim_status || null,
    score,
    confidence: confidence(score),
    matchedWords,
  };
}

// Remember that this report matched these items, so the owner is never notified twice about one item.
async function recordMatches(conn, reportId, matches) {
  for (const m of matches) {
    await conn.query("INSERT IGNORE INTO lost_report_matches (lost_report_id, item_id, score) VALUES (?, ?, ?)", [
      reportId,
      m.id,
      m.score,
    ]);
  }
}

// Found items (same school, not posted by the owner) that look like this lost report. Best match first.
// Lists items that can still be claimed (FOUND), plus any the owner has already claimed, so a match
// doesn't vanish from their page once they claim it. my_claim_status is their claim's status, or null.
async function findMatchesForReport(conn, report) {
  const [items] = await conn.query(
    `SELECT items.*,
       (SELECT c.status FROM claims c WHERE c.item_id = items.id AND c.student_id = ?
        ORDER BY c.id DESC LIMIT 1) AS my_claim_status
     FROM items
     WHERE items.school = ? AND items.student_id <> ?
       AND items.date_found >= DATE_SUB(?, INTERVAL ${DATE_SLACK_DAYS} DAY)
       AND (items.status = 'FOUND' OR EXISTS (
         SELECT 1 FROM claims c WHERE c.item_id = items.id AND c.student_id = ? AND c.status IN ('PENDING', 'APPROVED')))`,
    [report.student_id, report.school, report.student_id, report.date_lost, report.student_id]
  );
  return items
    .map((item) => ({ item, s: scorePair(report, item) }))
    .filter(({ s }) => s.score >= MIN_SCORE)
    .sort((a, b) => b.s.score - a.s.score || new Date(b.item.created_at) - new Date(a.item.created_at))
    .slice(0, MAX_MATCHES)
    .map(({ item, s }) => toMatch(item, s));
}

// A found item was just reported: notify the owner of every OPEN lost report it matches
// (once per report and item). Returns how many owners were notified.
async function notifyOwnersOfNewItem(conn, item) {
  const [reports] = await conn.query(
    `SELECT * FROM lost_reports
     WHERE school = ? AND status = 'OPEN' AND student_id <> ?
       AND date_lost <= DATE_ADD(?, INTERVAL ${DATE_SLACK_DAYS} DAY)`,
    [item.school, item.student_id, item.date_found]
  );

  let notified = 0;
  for (const report of reports) {
    const s = scorePair(report, item);
    if (s.score < MIN_SCORE) continue;

    const [result] = await conn.query(
      "INSERT IGNORE INTO lost_report_matches (lost_report_id, item_id, score) VALUES (?, ?, ?)",
      [report.id, item.id, s.score]
    );
    if (result.affectedRows === 0) continue; // already told them about this item

    await conn.query("INSERT INTO notifications (user_id, message, item_id) VALUES (?, ?, ?)", [
      report.student_id,
      `A found item that may be your lost "${report.title}" was just reported: "${item.title}". Open it to check and claim it.`,
      item.id,
    ]);
    notified += 1;
  }
  return notified;
}

// A claim was approved: the claimant's open lost reports that matched this item are now RESOLVED.
async function resolveReportsForApprovedClaim(conn, claim) {
  await conn.query(
    `UPDATE lost_reports SET status = 'RESOLVED'
     WHERE student_id = ? AND status = 'OPEN'
       AND id IN (SELECT lost_report_id FROM lost_report_matches WHERE item_id = ?)`,
    [claim.student_id, claim.item_id]
  );
}

module.exports = {
  MIN_SCORE,
  words,
  scorePair,
  confidence,
  findMatchesForReport,
  notifyOwnersOfNewItem,
  recordMatches,
  resolveReportsForApprovedClaim,
};
