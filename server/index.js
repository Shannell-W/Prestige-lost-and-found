const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { pool } = require("./db");
const { HttpError, submitClaim, setClaimStatus } = require("./claimRules");
const contractRoutes = require("./routes/contract");

const app = express();

// Expose the partner-data headers so the Venues page can say when it is showing a saved copy.
app.use(cors({ exposedHeaders: ["X-Partner-Data-Age", "X-Partner-Data-Stale"] }));
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "prestige-development-secret";
if (!process.env.JWT_SECRET && process.env.NODE_ENV !== "test") {
  console.warn("JWT_SECRET is not set in .env, so a default development secret is being used.");
}


// =========================
// AUTH MIDDLEWARE
// =========================

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    next();
  } catch {
    res.status(403).json({ error: "Invalid or expired token" });
  }
}

// =========================
// HEALTH
// =========================

app.get("/api/health", (req, res) => {
  res.json({
    message: "Prestige API is running",
  });
});

// =========================
// REGISTER
// =========================

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, studentId, school, email, password, confirmPassword } =
      req.body;

    if (
      !name ||
      !studentId ||
      !school ||
      !email ||
      !password ||
      !confirmPassword
    ) {
      return res.status(400).json({
        error: "All fields are required",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        error: "Passwords do not match",
      });
    }

    const [existing] = await pool.query(
      "SELECT id FROM users WHERE email = ? OR student_id = ?",
      [email, studentId]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        error: "Email or student ID already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO users
      (full_name, student_id, school, email, password)
      VALUES (?, ?, ?, ?, ?)`,
      [name, studentId, school, email, hashedPassword]
    );

    res.status(201).json({
      message: "Registration successful",
      userId: result.insertId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Registration failed",
    });
  }
});

// =========================
// LOGIN
// =========================

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password, school } = req.body;

    const [rows] = await pool.query(
      "SELECT * FROM users WHERE email = ? AND school = ?",
      [email, school]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        error: "Invalid email, school, or password",
      });
    }

    const user = rows[0];

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        error: "Invalid email, school, or password",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        studentId: user.student_id,
        name: user.full_name,
        school: user.school,
        email: user.email,
      },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.full_name,
        studentId: user.student_id,
        school: user.school,
        email: user.email,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Login failed",
    });
  }
});

// =========================
// ITEMS
// =========================

app.get("/api/items", async (req, res) => {
  try {
    const { studentId, status, school, search } = req.query;

    let sql = "SELECT * FROM items WHERE 1=1";
    const params = [];

    if (studentId) {
      sql += " AND student_id = ?";
      params.push(studentId);
    }

    if (status) {
      sql += " AND status = ?";
      params.push(status.toUpperCase());
    }

    if (school) {
      sql += " AND school = ?";
      params.push(school);
    }

    if (search) {
      sql += `
        AND (
          title LIKE ?
          OR description LIKE ?
          OR category LIKE ?
          OR location LIKE ?
        )
      `;

      const searchValue = `%${search}%`;

      params.push(searchValue, searchValue, searchValue, searchValue);
    }

    sql += " ORDER BY created_at DESC";

    const [rows] = await pool.query(sql, params);

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to fetch items",
    });
  }
});

// =========================
// CLAIMED ITEMS (Team 6)
// NOTE: must stay ABOVE /api/items/:id, otherwise Express
// treats the word "claimed" as an item ID.
// =========================

app.get("/api/items/claimed", async (req, res) => {
  try {
    const { studentId } = req.query;

    let sql = `
      SELECT
        items.id,
        items.title,
        items.reward_amount,
        items.status,
        items.student_id
      FROM items
      WHERE items.status = 'CLAIMED'
    `;

    const params = [];

    if (studentId) {
      sql += " AND items.student_id = ?";
      params.push(studentId);
    }

    const [rows] = await pool.query(sql, params);

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to fetch claimed items",
    });
  }
});

// =========================
// SINGLE ITEM
// =========================

app.get("/api/items/:id", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM items WHERE id = ?", [
      req.params.id,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({
        error: "Item not found",
      });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to fetch item",
    });
  }
});

// =========================
// REPORT FOUND ITEM
// =========================

app.post("/api/items", authenticateToken, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      location,
      dateFound,
      rewardAmount,
      imageUrl,
    } = req.body;

    if (!title || !category || !location || !dateFound) {
      return res.status(400).json({
        error: "Required item fields are missing",
      });
    }

    const [result] = await pool.query(
      `INSERT INTO items
      (title, description, category, location, date_found,
       status, student_id, school, reward_amount, image_url)
      VALUES (?, ?, ?, ?, ?, 'FOUND', ?, ?, ?, ?)`,
      [
        title,
        description || "",
        category,
        location,
        dateFound,
        req.user.id,
        req.user.school,
        rewardAmount || 0,
        imageUrl || null,
      ]
    );

    res.status(201).json({
      message: "Found item reported successfully",
      itemId: result.insertId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to report item",
    });
  }
});

// =========================
// CLAIMS ON MY POSTED ITEMS
// =========================

app.get("/api/items/:id/claims", authenticateToken, async (req, res) => {
  try {
    const [items] = await pool.query("SELECT * FROM items WHERE id = ?", [
      req.params.id,
    ]);

    if (items.length === 0) {
      return res.status(404).json({ error: "Item not found" });
    }

    if (items[0].student_id !== req.user.id) {
      return res.status(403).json({ error: "You did not post this item" });
    }

    const [claims] = await pool.query(
      `SELECT claims.*, users.full_name AS claimant_name
       FROM claims
       JOIN users ON claims.student_id = users.id
       WHERE claims.item_id = ?
       ORDER BY claims.created_at DESC`,
      [req.params.id]
    );

    res.json(claims);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch claims for this item" });
  }
});

// =========================
// CLAIM ITEM
// =========================

app.post("/api/claims", authenticateToken, async (req, res) => {
  try {
    const { itemId, evidence } = req.body;

    if (!itemId || !evidence) {
      return res.status(400).json({
        error: "Item and evidence are required",
      });
    }

    // Shared rules (claimRules.js): blocks claiming your own item or a returned one,
    // blocks duplicate claims, sets the item to CLAIMED, and notifies the finder.
    const claimId = await submitClaim({
      itemId: Number(itemId),
      userId: req.user.id,
      evidence,
    });

    res.status(201).json({
      message: "Claim submitted successfully",
      claimId,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.status === 404 ? "Item not found" : error.message });
    }
    console.error(error);
    res.status(500).json({
      error: "Failed to submit claim",
    });
  }
});

// =========================
// MY CLAIMS
// =========================

app.get("/api/claims", authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;

    let sql = `
      SELECT
        claims.*,
        items.title,
        items.category,
        items.location
      FROM claims
      JOIN items ON claims.item_id = items.id
      WHERE claims.student_id = ?
    `;

    const params = [req.user.id];

    if (status) {
      sql += " AND claims.status = ?";
      params.push(status.toUpperCase());
    }

    sql += " ORDER BY claims.created_at DESC";

    const [rows] = await pool.query(sql, params);

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to fetch claims",
    });
  }
});

// =========================
// SINGLE CLAIM
// =========================

app.get("/api/claims/:id", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
        claims.*,
        items.title,
        items.category,
        items.location,
        items.reward_amount
       FROM claims
       JOIN items ON claims.item_id = items.id
       WHERE claims.id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: "Claim not found",
      });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to fetch claim",
    });
  }
});

// =========================
// APPROVE / REJECT CLAIM (finder only)
// =========================

app.patch("/api/claims/:id", authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({ error: "Invalid claim status" });
    }

    const [claims] = await pool.query(
      `SELECT claims.student_id, claims.item_id, items.title,
              items.student_id AS founder_id
       FROM claims
       JOIN items ON claims.item_id = items.id
       WHERE claims.id = ?`,
      [req.params.id]
    );

    if (claims.length === 0) {
      return res.status(404).json({ error: "Claim not found" });
    }

    if (claims[0].founder_id !== req.user.id) {
      return res
        .status(403)
        .json({ error: "Only the item's finder can review this claim" });
    }

    // Shared rules (claimRules.js): approving rejects the other pending claims,
    // marks the item RETURNED, records the fee and notifies everyone involved.
    await setClaimStatus(Number(req.params.id), status);

    res.json({ message: `Claim ${status.toLowerCase()}` });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error(error);
    res.status(500).json({ error: "Failed to update claim" });
  }
});

// =========================
// MY POSTED ITEMS
// =========================

app.get("/api/my-items", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT *
       FROM items
       WHERE student_id = ?
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to fetch posted items",
    });
  }
});

// =========================
// NOTIFICATIONS
// =========================

app.get("/api/notifications", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT *
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to fetch notifications",
    });
  }
});

// =========================
// PROFILE
// =========================

app.get("/api/profile", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
        id,
        full_name,
        student_id,
        school,
        email,
        created_at
       FROM users
       WHERE id = ?`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to fetch profile",
    });
  }
});

// =========================
// TEAM 6 API
// =========================

// Students
app.get("/api/students", async (req, res) => {
  try {
    const { schoolId } = req.query;

    // No email addresses: this route is public, so it must not expose personal contact details.
    let sql = `
      SELECT id, full_name, student_id, school
      FROM users
    `;

    const params = [];

    if (schoolId) {
      sql += " WHERE school = ?";
      params.push(schoolId);
    }

    const [rows] = await pool.query(sql, params);

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to fetch students",
    });
  }
});

app.get("/api/students/:studentId", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, full_name, student_id, school
       FROM users
       WHERE student_id = ?`,
      [req.params.studentId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: "Student not found",
      });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to fetch student",
    });
  }
});

// Statistics
app.get("/api/statistics/lost-items", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        COUNT(*) AS total_items,
        SUM(status = 'FOUND') AS found_items,
        SUM(status = 'CLAIMED') AS claimed_items,
        SUM(status = 'RETURNED') AS returned_items,
        COALESCE(SUM(reward_amount), 0) AS total_reward_amount
      FROM items
    `);

    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to fetch statistics",
    });
  }
});

// =========================
// UPSTREAM PARTNER: VENUES (Week 10 integration) — Team 4's Artist Platform API
// See routes/partnerVenues.js. Our server calls the partner; the browser only calls our server.
// =========================

app.use(require("./routes/partnerVenues"));

// =========================
// PARTNER CONTRACT API (openapi.yaml) for Team 6
// =========================

app.use(contractRoutes);

// API docs (Week 8): the contract rendered with Swagger UI at http://localhost:5000/docs/
const path = require("path");
app.use("/docs", express.static(path.join(__dirname, "..", "docs")));
app.get("/openapi.yaml", (req, res) => {
  res.type("text/yaml").sendFile(path.join(__dirname, "..", "openapi.yaml"));
});

// Unknown paths: JSON, not Express's default HTML page
app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
});

// Errors: bad JSON gets 400; anything unexpected gets 500 with details kept in the server log
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body is not valid JSON" });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

// =========================
// START SERVER
// =========================

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;