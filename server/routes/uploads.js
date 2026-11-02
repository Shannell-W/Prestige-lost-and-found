// Photo uploads for found items.
//
//   POST /api/uploads   { image: "data:image/jpeg;base64,..." }  (login needed)  -> 201 { url: "/uploads/<name>.jpg" }
//
// The website shrinks photos in the browser first (max 1280px, JPEG), so uploads are small.
// Only JPEG, PNG and WebP are accepted, checked by their first bytes (not just the name), up to 3 MB.
// Files are saved in server/uploads/ (or UPLOAD_DIR) with random names and served at /uploads/... (index.js).
// The returned url is relative: the website adds the server's address in front of it.
const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, "..", "uploads"));
const MAX_BYTES = 3 * 1024 * 1024;

const TYPES = {
  "image/jpeg": { ext: "jpg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { ext: "png", magic: (b) => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/webp": { ext: "webp", magic: (b) => b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP" },
};

function uploadRoutes(authenticateToken) {
  const router = express.Router();

  router.post(
    "/api/uploads",
    express.json({ limit: "5mb" }), // base64 makes files ~1/3 bigger than MAX_BYTES
    authenticateToken,
    async (req, res) => {
      try {
        const match = typeof req.body?.image === "string" && req.body.image.match(/^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/);
        if (!match || !TYPES[match[1]]) {
          return res.status(400).json({ error: "Send a JPEG, PNG or WebP photo" });
        }
        const bytes = Buffer.from(match[2], "base64");
        if (bytes.length === 0 || bytes.length > MAX_BYTES) {
          return res.status(400).json({ error: "Photo must be smaller than 3 MB" });
        }
        const type = TYPES[match[1]];
        if (!type.magic(bytes)) return res.status(400).json({ error: "That file is not a real image" });

        await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
        const name = `${crypto.randomBytes(16).toString("hex")}.${type.ext}`;
        await fs.promises.writeFile(path.join(UPLOAD_DIR, name), bytes);
        res.status(201).json({ url: `/uploads/${name}` });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to save photo" });
      }
    }
  );

  // A photo bigger than the limit never reaches the route above: answer it clearly.
  router.use("/api/uploads", (err, req, res, next) => {
    if (err && err.type === "entity.too.large") return res.status(413).json({ error: "Photo must be smaller than 3 MB" });
    next(err);
  });

  return router;
}

module.exports = uploadRoutes;
module.exports.UPLOAD_DIR = UPLOAD_DIR;
