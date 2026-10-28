// The partner API: exactly the paths in openapi.yaml (no /api prefix), for Team 6.
//
// The mapping step (Week 5): our database uses its own names and types; the contract promises
// different ones. Everything is translated here, in one place:
//   claims.status  PENDING / APPROVED / REJECTED  ->  "pending" / "claimed" / "rejected"
//   claims.id, items.id (numbers)                 ->  claimId, itemId as strings
//   users.student_id (e.g. "SU-1001")              ->  studentId
//   items.reward_amount (KSh, decimal)             ->  rewardAmountCents (whole cents)
//   schoolId                                       ->  the school's name (see CONTRACT_DEVIATIONS.md)
const express = require("express");
const { pool } = require("../db");
const { HttpError, submitClaim, setClaimStatus, deleteClaim } = require("../claimRules");

const router = express.Router();

const TO_DB = { pending: "PENDING", claimed: "APPROVED", rejected: "REJECTED" };
const FROM_DB = { PENDING: "pending", APPROVED: "claimed", REJECTED: "rejected" };
const STATUSES = Object.keys(TO_DB);

// ---------- helpers ----------

const isText = (v) => typeof v === "string" && v.trim().length > 0;

// "12" -> 12. Anything else (e.g. "abc", "1.5") -> null, which the routes treat as not found.
function toId(value) {
  return /^\d{1,10}$/.test(String(value)) ? Number(value) : null;
}

// MySQL date -> ISO 8601 UTC with no milliseconds: "2026-10-01T06:15:00Z"
function iso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value).replace(" ", "T"));
  return d.toISOString().slice(0, 19) + "Z";
}

const cents = (amount) => Math.round(Number(amount || 0) * 100);

const CLAIM_SELECT = `
  SELECT claims.id, claims.item_id, claims.status, claims.created_at,
         claimant.student_id AS claimant_student_id, items.reward_amount
  FROM claims
  JOIN items ON items.id = claims.item_id
  JOIN users claimant ON claimant.id = claims.student_id`;

// Exactly the fields in the contract's claim schema, no more.
function claimToApi(row) {
  return {
    claimId: String(row.id),
    studentId: row.claimant_student_id,
    itemId: String(row.item_id),
    status: FROM_DB[row.status],
    rewardAmountCents: cents(row.reward_amount),
  };
}

async function loadClaim(claimId) {
  const id = toId(claimId);
  if (id === null) return null;
  const [[row]] = await pool.query(`${CLAIM_SELECT} WHERE claims.id = ?`, [id]);
  return row || null;
}

function sendError(res, err) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  throw err; // anything unexpected goes to the error handler in index.js (500)
}

// ---------- GET /claims?status=claimed ----------
router.get("/claims", async (req, res) => {
  const { status } = req.query;
  if (!status) return res.status(400).json({ error: "status query parameter is required" });
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${STATUSES.join(", ")}` });
  }
  const [rows] = await pool.query(`${CLAIM_SELECT} WHERE claims.status = ? ORDER BY claims.id`, [TO_DB[status]]);
  res.json(rows.map(claimToApi));
});

// ---------- POST /claims ----------
router.post("/claims", async (req, res) => {
  const { studentId, itemId, evidence } = req.body || {};

  // Validate first: nothing is written unless every check passes.
  if (!isText(studentId)) return res.status(400).json({ error: "studentId is required and must be a string" });
  if (!isText(itemId)) return res.status(400).json({ error: "itemId is required and must be a string" });
  if (evidence !== undefined && !isText(evidence)) {
    return res.status(400).json({ error: "evidence must be a non-empty string when provided" });
  }

  const [[user]] = await pool.query("SELECT id FROM users WHERE student_id = ?", [studentId.trim()]);
  if (!user) return res.status(404).json({ error: "student not found" });
  const id = toId(itemId);
  if (id === null) return res.status(404).json({ error: "item not found" });

  try {
    const claimId = await submitClaim({
      itemId: id,
      userId: user.id,
      evidence: evidence ? evidence.trim() : "Submitted through the partner API.",
    });
    res.status(201).json(claimToApi(await loadClaim(claimId)));
  } catch (err) {
    sendError(res, err);
  }
});

// ---------- PATCH /claims/:claimId ----------
router.patch("/claims/:claimId", async (req, res) => {
  const { status } = req.body || {};
  if (!isText(status)) return res.status(400).json({ error: "status is required and must be a string" });
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${STATUSES.join(", ")}` });
  }
  const id = toId(req.params.claimId);
  if (id === null) return res.status(404).json({ error: "claim not found" });

  try {
    await setClaimStatus(id, TO_DB[status]);
    res.status(200).json(claimToApi(await loadClaim(id)));
  } catch (err) {
    sendError(res, err);
  }
});

// ---------- DELETE /claims/:claimId ----------
router.delete("/claims/:claimId", async (req, res) => {
  const id = toId(req.params.claimId);
  if (id === null) return res.status(404).json({ error: "claim not found" });
  try {
    await deleteClaim(id);
    res.status(204).send();
  } catch (err) {
    sendError(res, err);
  }
});

// ---------- GET /students/:studentId/claims ----------
router.get("/students/:studentId/claims", async (req, res) => {
  const [[user]] = await pool.query("SELECT id FROM users WHERE student_id = ?", [req.params.studentId]);
  if (!user) return res.status(404).json({ error: "student not found" });

  const [rows] = await pool.query(
    "SELECT id, item_id, status, created_at FROM claims WHERE student_id = ? ORDER BY created_at, id",
    [user.id]
  );
  res.json(
    rows.map((r) => ({
      claimId: String(r.id),
      itemId: String(r.item_id),
      status: FROM_DB[r.status],
      submittedAt: iso(r.created_at),
    }))
  );
});

// ---------- GET /schools/:schoolId/item-statistics ----------
// schoolId is the school's name, e.g. /schools/Strathmore%20University/item-statistics
router.get("/schools/:schoolId/item-statistics", async (req, res) => {
  const school = req.params.schoolId;
  const [[known]] = await pool.query(
    "SELECT (SELECT COUNT(*) FROM users WHERE school = ?) + (SELECT COUNT(*) FROM items WHERE school = ?) AS n",
    [school, school]
  );
  if (Number(known.n) === 0) return res.status(404).json({ error: "school not found" });

  // "Claimed" here means returned to its owner, i.e. a claim on it was approved.
  const [[stats]] = await pool.query(
    `SELECT COUNT(*) AS reported,
            COALESCE(SUM(status = 'RETURNED'), 0) AS claimed,
            COALESCE(SUM(CASE WHEN status = 'RETURNED' THEN reward_amount ELSE 0 END), 0) AS reward_paid
     FROM items WHERE school = ?`,
    [school]
  );
  res.json({
    schoolId: school,
    schoolName: school,
    totalItemsReported: Number(stats.reported),
    totalItemsClaimed: Number(stats.claimed),
    totalRewardAmountPaidCents: cents(stats.reward_paid),
  });
});

// ---------- GET /claims/:claimId/fees ----------
router.get("/claims/:claimId/fees", async (req, res) => {
  const claim = await loadClaim(req.params.claimId);
  if (!claim) return res.status(404).json({ error: "claim not found" });

  const [[fee]] = await pool.query("SELECT amount_payable_cents FROM fees WHERE claim_id = ?", [claim.id]);
  if (!fee) return res.status(404).json({ error: "no fee has been charged on this claim yet" });

  res.json({
    claimId: String(claim.id),
    studentId: claim.claimant_student_id,
    itemId: String(claim.item_id),
    amountPayableCents: Number(fee.amount_payable_cents),
  });
});

// ---------- GET /claims/:claimId/refunds ----------
function refundToApi(row, claim) {
  return {
    refundId: String(row.id),
    claimId: String(row.claim_id),
    studentId: claim.claimant_student_id,
    amountCents: Number(row.amount_cents),
    reason: row.reason,
    refundedAt: iso(row.refunded_at),
  };
}

router.get("/claims/:claimId/refunds", async (req, res) => {
  const claim = await loadClaim(req.params.claimId);
  if (!claim) return res.status(404).json({ error: "claim not found" });

  const [rows] = await pool.query("SELECT * FROM refunds WHERE claim_id = ? ORDER BY refunded_at, id", [claim.id]);
  res.json(rows.map((r) => refundToApi(r, claim)));
});

// ---------- POST /claims/:claimId/refunds ----------
router.post("/claims/:claimId/refunds", async (req, res) => {
  const { studentId, amountCents, reason } = req.body || {};

  // 400: validation first
  if (!isText(studentId)) return res.status(400).json({ error: "studentId is required and must be a string" });
  if (typeof amountCents !== "number" || !Number.isInteger(amountCents)) {
    return res.status(400).json({ error: "amountCents is required and must be an integer" });
  }
  if (amountCents <= 0) return res.status(400).json({ error: "amountCents must be greater than 0" });
  if (!isText(reason)) return res.status(400).json({ error: "reason is required and must be a string" });

  // 404: does the claim exist?
  const claim = await loadClaim(req.params.claimId);
  if (!claim) return res.status(404).json({ error: "claim not found" });
  if (studentId.trim() !== claim.claimant_student_id) {
    return res.status(400).json({ error: "studentId does not match the student who made this claim" });
  }

  // 409: business rules
  const [[fee]] = await pool.query("SELECT amount_payable_cents FROM fees WHERE claim_id = ?", [claim.id]);
  if (!fee) return res.status(409).json({ error: "this claim has no fee to refund" });
  const [[{ refunded }]] = await pool.query(
    "SELECT COALESCE(SUM(amount_cents), 0) AS refunded FROM refunds WHERE claim_id = ?",
    [claim.id]
  );
  const remaining = Number(fee.amount_payable_cents) - Number(refunded);
  if (amountCents > remaining) {
    return res.status(409).json({ error: `refund exceeds the remaining refundable fee of ${remaining} cents` });
  }

  const [[claimRow]] = await pool.query("SELECT student_id FROM claims WHERE id = ?", [claim.id]);
  const [result] = await pool.query(
    "INSERT INTO refunds (claim_id, student_id, amount_cents, reason) VALUES (?, ?, ?, ?)",
    [claim.id, claimRow.student_id, amountCents, reason.trim()]
  );
  const [[row]] = await pool.query("SELECT * FROM refunds WHERE id = ?", [result.insertId]);
  res.status(201).json(refundToApi(row, claim));
});

module.exports = router;
module.exports.iso = iso;
