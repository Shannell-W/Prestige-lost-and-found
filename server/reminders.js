// "Still looking?" reminders: every REMINDER_DAYS (default 30) a lost report stays OPEN, its owner is asked
// whether they still need it, so stale reports get closed and finders aren't sent to people who already have their item.
//
// The server checks twice a day while it runs (index.js calls startReminders()).
const { pool } = require("./db");
const { addNotification } = require("./notify");

const REMINDER_DAYS = Number(process.env.REMINDER_DAYS || 30);
const CHECK_EVERY_MS = 12 * 60 * 60 * 1000;

// Sends the reminders that are due at `now`. Returns how many were sent.
async function runReminders(conn = pool, now = new Date()) {
  const cutoff = new Date(now.getTime() - REMINDER_DAYS * 24 * 60 * 60 * 1000);
  const [due] = await conn.query(
    `SELECT id, title, student_id FROM lost_reports
     WHERE status = 'OPEN' AND created_at <= ? AND (reminded_at IS NULL OR reminded_at <= ?)`,
    [cutoff, cutoff]
  );
  for (const report of due) {
    await addNotification(
      conn,
      report.student_id,
      `Still looking for your "${report.title}"? If you got it back, please close the report so finders aren't sent to you.`,
      { lostReportId: report.id }
    );
    await conn.query("UPDATE lost_reports SET reminded_at = ? WHERE id = ?", [now, report.id]);
  }
  return due.length;
}

function startReminders() {
  const run = () => runReminders().catch((err) => console.error("Reminders failed:", err.message));
  run();
  setInterval(run, CHECK_EVERY_MS).unref();
}

module.exports = { runReminders, startReminders, REMINDER_DAYS };
