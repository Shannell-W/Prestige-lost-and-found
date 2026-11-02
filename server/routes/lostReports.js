// Lost reports: a student announces an item they lost, sees found items that look similar,
// and is notified later if a similar item is reported. All routes need a login.
//
//   POST   /api/lost-reports              report a lost item -> 201 { lostReportId, matches: [...] }
//   GET    /api/lost-reports              my lost reports, newest first
//   GET    /api/lost-reports/:id          one of my lost reports
//   GET    /api/lost-reports/:id/matches  found items that look like it, best first
//   PATCH  /api/lost-reports/:id          { status: "CLOSED" | "OPEN" } close or reopen it
//
// Matching rules are in matching.js.
const express = require("express");
const { pool } = require("../db");
const { findMatchesForReport, recordMatches } = require("../matching");

const MAX_REWARD = 1000000; // KSh; a sanity limit, not a business rule

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// Body -> clean fields, or { error }.
function validateReport(body) {
  const { title, description, category, location, dateLost, rewardOffered } = body || {};

  if (typeof title !== "string" || !title.trim() || typeof category !== "string" || !category.trim() || !dateLost) {
    return { error: "Title, category and date lost are required" };
  }
  if (title.trim().length > 150) return { error: "Title must be 150 characters or fewer" };
  if (category.trim().length > 50) return { error: "Category must be 50 characters or fewer" };
  if (location != null && (typeof location !== "string" || location.length > 150)) {
    return { error: "Location must be text of 150 characters or fewer" };
  }
  if (description != null && typeof description !== "string") return { error: "Description must be text" };
  if (!isValidDate(dateLost)) return { error: "Date lost must be a date like 2026-10-05" };

  // Tomorrow is allowed, in case the student's clock is ahead of the server's.
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (dateLost > tomorrow) return { error: "Date lost cannot be in the future" };

  let reward = 0;
  if (rewardOffered !== undefined && rewardOffered !== null && rewardOffered !== "") {
    reward = Number(rewardOffered);
    if (!Number.isFinite(reward) || reward < 0 || reward > MAX_REWARD) {
      return { error: `Reward offered must be a number from 0 to ${MAX_REWARD}` };
    }
  }

  return {
    title: title.trim(),
    description: (description || "").trim(),
    category: category.trim(),
    location: location ? location.trim() : null,
    dateLost,
    reward: Math.round(reward * 100) / 100,
  };
}

// Loads a report and checks it belongs to the logged-in student. Sends the error response itself.
async function loadOwnReport(req, res) {
  const [[report]] = await pool.query("SELECT * FROM lost_reports WHERE id = ?", [req.params.id]);
  if (!report) {
    res.status(404).json({ error: "Lost report not found" });
    return null;
  }
  if (report.student_id !== req.user.id) {
    res.status(403).json({ error: "You can only view your own lost reports" });
    return null;
  }
  return report;
}

module.exports = function lostReportRoutes(authenticateToken) {
  const router = express.Router();

  router.post("/api/lost-reports", authenticateToken, async (req, res) => {
    try {
      const fields = validateReport(req.body);
      if (fields.error) return res.status(400).json({ error: fields.error });

      const [result] = await pool.query(
        `INSERT INTO lost_reports
         (title, description, category, location, date_lost, reward_offered, status, student_id, school)
         VALUES (?, ?, ?, ?, ?, ?, 'OPEN', ?, ?)`,
        [
          fields.title,
          fields.description,
          fields.category,
          fields.location,
          fields.dateLost,
          fields.reward,
          req.user.id,
          req.user.school,
        ]
      );

      const [[report]] = await pool.query("SELECT * FROM lost_reports WHERE id = ?", [result.insertId]);
      const matches = await findMatchesForReport(pool, report);
      await recordMatches(pool, report.id, matches);

      res.status(201).json({
        message: matches.length
          ? "Lost item reported. We found items that may be yours."
          : "Lost item reported. We'll notify you when a similar item is found.",
        lostReportId: report.id,
        matches,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to report lost item" });
    }
  });

  router.get("/api/lost-reports", authenticateToken, async (req, res) => {
    try {
      // match_count: matched items that can still be claimed.
      const [rows] = await pool.query(
        `SELECT lost_reports.*,
           (SELECT COUNT(*) FROM lost_report_matches m JOIN items i ON i.id = m.item_id
            WHERE m.lost_report_id = lost_reports.id AND i.status IN ('FOUND', 'CLAIMED')) AS match_count
         FROM lost_reports
         WHERE student_id = ?
         ORDER BY created_at DESC, id DESC`,
        [req.user.id]
      );
      res.json(rows.map((r) => ({ ...r, match_count: Number(r.match_count) })));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch lost reports" });
    }
  });

  router.get("/api/lost-reports/:id", authenticateToken, async (req, res) => {
    try {
      const report = await loadOwnReport(req, res);
      if (report) res.json(report);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch lost report" });
    }
  });

  router.get("/api/lost-reports/:id/matches", authenticateToken, async (req, res) => {
    try {
      const report = await loadOwnReport(req, res);
      if (!report) return;
      const matches = await findMatchesForReport(pool, report);
      await recordMatches(pool, report.id, matches);
      res.json(matches);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch matches" });
    }
  });

  router.patch("/api/lost-reports/:id", authenticateToken, async (req, res) => {
    try {
      const { status } = req.body || {};
      if (!["OPEN", "CLOSED"].includes(status)) {
        return res.status(400).json({ error: "Status must be OPEN or CLOSED" });
      }
      const report = await loadOwnReport(req, res);
      if (!report) return;

      await pool.query("UPDATE lost_reports SET status = ? WHERE id = ?", [status, report.id]);
      const [[updated]] = await pool.query("SELECT * FROM lost_reports WHERE id = ?", [report.id]);
      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update lost report" });
    }
  });

  return router;
};

module.exports.validateReport = validateReport;
