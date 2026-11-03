// One shared MySQL connection pool for the whole server.
require("dotenv").config();
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
});

// Run several queries as one all-or-nothing unit (for claims, where several tables change together).
// Jobs added to conn.afterCommit (e.g. email/SMS alerts, see notify.js) run only once the transaction
// has committed, so nobody is alerted about a change that was rolled back.
async function withTransaction(work) {
  const conn = await pool.getConnection();
  conn.afterCommit = [];
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    for (const job of conn.afterCommit) job();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    delete conn.afterCommit;
    conn.release();
  }
}

module.exports = { pool, withTransaction };
