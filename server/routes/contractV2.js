// Week 13: v2 of the partner API. Same data as v1 (routes/contract.js), one change:
// list endpoints return { "data": [...], "count": N } instead of a bare list.
//
//   v1  GET /claims?status=claimed          ->  [ {claim}, {claim} ]
//   v2  GET /v2/claims?status=claimed       ->  { "data": [ {claim}, {claim} ], "count": 2 }
//
//   v1  GET /students/SU-1001/claims        ->  [ {...}, {...} ]
//   v2  GET /v2/students/SU-1001/claims     ->  { "data": [ {...}, {...} ], "count": 2 }
//
// Why: a bare list can't grow. Wrapping it lets us add paging (next/limit) later as new fields,
// without another breaking change. Everything inside each item, every error, and the API key stay the same.
// Only these two endpoints change; every other partner endpoint keeps its current URL and shape.
const express = require("express");
const { shared } = require("./contract");

const { pool, STATUSES, TO_DB, FROM_DB, CLAIM_SELECT, claimToApi, iso } = shared;
const router = express.Router();

// The one place that wraps a list in the v2 shape.
const wrap = (items) => ({ data: items, count: items.length });

// ---------- GET /v2/claims?status=claimed ----------
router.get("/claims", async (req, res) => {
  const { status } = req.query;
  if (!status) return res.status(400).json({ error: "status query parameter is required" });
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${STATUSES.join(", ")}` });
  }
  const [rows] = await pool.query(`${CLAIM_SELECT} WHERE claims.status = ? ORDER BY claims.id`, [TO_DB[status]]);
  res.json(wrap(rows.map(claimToApi)));
});

// ---------- GET /v2/students/:studentId/claims ----------
router.get("/students/:studentId/claims", async (req, res) => {
  const [[user]] = await pool.query("SELECT id FROM users WHERE student_id = ?", [req.params.studentId]);
  if (!user) return res.status(404).json({ error: "student not found" });

  const [rows] = await pool.query(
    "SELECT id, item_id, status, created_at FROM claims WHERE student_id = ? ORDER BY created_at, id",
    [user.id]
  );
  res.json(
    wrap(
      rows.map((r) => ({
        claimId: String(r.id),
        itemId: String(r.item_id),
        status: FROM_DB[r.status],
        submittedAt: iso(r.created_at),
      }))
    )
  );
});

module.exports = router;
