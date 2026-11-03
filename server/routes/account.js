// Profile settings, pickup details after a claim is approved, and statistics for the Home page.
//
//   PATCH /api/profile                 { phone, alertsEmail, alertsSms }  my alert settings
//   GET   /api/claims/:id/handover     how the owner collects the item, and the other person's contact
//                                      (only the claimant and the finder, only once the claim is APPROVED)
//   GET   /api/statistics/summary      real numbers for the Home page
const express = require("express");
const { pool } = require("../db");
const { normalizePhone } = require("../alerts");

// An item as anyone may see it: the pickup details are only for the approved owner.
function publicItem(item) {
  if (!item) return item;
  const { handover_note, ...rest } = item; // eslint-disable-line no-unused-vars
  return rest;
}

const HANDOVER_TEXT = {
  SECURITY: "The finder handed it to campus security. Take your student ID to collect it.",
  FINDER: "The finder still has it. Contact them to arrange where to meet, somewhere public on campus.",
};

function router(authenticateToken) {
  const r = express.Router();

  r.patch("/api/profile", authenticateToken, async (req, res) => {
    try {
      const { phone, alertsEmail, alertsSms } = req.body || {};
      const updates = [];
      const params = [];

      if (phone !== undefined) {
        const clean = phone === null || phone === "" ? null : normalizePhone(phone);
        if (phone && !clean) return res.status(400).json({ error: "Phone must be a Kenyan mobile number, e.g. 0712345678" });
        updates.push("phone = ?");
        params.push(clean);
      }
      for (const [field, column] of [
        [alertsEmail, "alerts_email"],
        [alertsSms, "alerts_sms"],
      ]) {
        if (field === undefined) continue;
        if (typeof field !== "boolean") return res.status(400).json({ error: "Alert settings must be true or false" });
        updates.push(`${column} = ?`);
        params.push(field ? 1 : 0);
      }
      if (updates.length === 0) return res.status(400).json({ error: "Nothing to update" });

      await pool.query(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, [...params, req.user.id]);
      const [[user]] = await pool.query(
        "SELECT id, full_name, student_id, school, email, phone, alerts_email, alerts_sms, created_at FROM users WHERE id = ?",
        [req.user.id]
      );
      res.json(user);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  r.get("/api/claims/:id/handover", authenticateToken, async (req, res) => {
    try {
      const [[claim]] = await pool.query(
        `SELECT claims.id, claims.status, claims.student_id AS claimant_id, claims.offered_amount,
                items.id AS item_id, items.title, items.handover, items.handover_note, items.student_id AS finder_id
         FROM claims JOIN items ON items.id = claims.item_id WHERE claims.id = ?`,
        [req.params.id]
      );
      if (!claim) return res.status(404).json({ error: "Claim not found" });

      const isClaimant = claim.claimant_id === req.user.id;
      const isFinder = claim.finder_id === req.user.id;
      if (!isClaimant && !isFinder) return res.status(403).json({ error: "Only the owner and the finder can see this" });
      if (claim.status !== "APPROVED") return res.status(409).json({ error: "Pickup details are shared once the claim is approved" });

      const otherId = isClaimant ? claim.finder_id : claim.claimant_id;
      const [[other]] = await pool.query("SELECT full_name, email, phone FROM users WHERE id = ?", [otherId]);

      res.json({
        claimId: claim.id,
        itemId: claim.item_id,
        title: claim.title,
        role: isClaimant ? "owner" : "finder",
        handover: claim.handover,
        instructions: HANDOVER_TEXT[claim.handover] || HANDOVER_TEXT.FINDER,
        handoverNote: claim.handover_note,
        agreedAmount: claim.offered_amount,
        contact: { name: other.full_name, email: other.email, phone: other.phone },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch pickup details" });
    }
  });

  r.get("/api/statistics/summary", async (req, res) => {
    try {
      const [[row]] = await pool.query(`
        SELECT
          (SELECT COUNT(*) FROM items) AS itemsPosted,
          (SELECT COUNT(*) FROM items WHERE status = 'RETURNED') AS itemsReturned,
          (SELECT COUNT(*) FROM claims) AS claimsSubmitted,
          (SELECT COUNT(*) FROM lost_reports WHERE status = 'OPEN') AS studentsLooking,
          (SELECT COUNT(DISTINCT school) FROM users) AS schools
      `);
      const out = {};
      for (const [k, v] of Object.entries(row)) out[k] = Number(v);
      res.json(out);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  return r;
}

module.exports = { router, publicItem };
