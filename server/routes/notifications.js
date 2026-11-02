// Read/unread for notifications. (The list itself is GET /api/notifications in index.js.)
//
//   GET   /api/notifications/unread-count  -> { count }
//   POST  /api/notifications/read-all      -> { updated }   mark all mine as read
//   PATCH /api/notifications/:id/read      -> the notification, marked read
const express = require("express");
const { pool } = require("../db");

module.exports = function notificationRoutes(authenticateToken) {
  const router = express.Router();

  router.get("/api/notifications/unread-count", authenticateToken, async (req, res) => {
    try {
      const [[{ count }]] = await pool.query(
        "SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0",
        [req.user.id]
      );
      res.json({ count: Number(count) });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to count notifications" });
    }
  });

  router.post("/api/notifications/read-all", authenticateToken, async (req, res) => {
    try {
      const [result] = await pool.query("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0", [
        req.user.id,
      ]);
      res.json({ updated: result.affectedRows });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update notifications" });
    }
  });

  router.patch("/api/notifications/:id/read", authenticateToken, async (req, res) => {
    try {
      const [[note]] = await pool.query("SELECT * FROM notifications WHERE id = ?", [req.params.id]);
      if (!note) return res.status(404).json({ error: "Notification not found" });
      if (note.user_id !== req.user.id) return res.status(403).json({ error: "Not your notification" });
      await pool.query("UPDATE notifications SET is_read = 1 WHERE id = ?", [note.id]);
      res.json({ ...note, is_read: 1 });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update notification" });
    }
  });

  return router;
};
