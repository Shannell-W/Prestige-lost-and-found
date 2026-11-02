// Brings an EXISTING database up to date with schema.sql, without losing any data.
//
//   npm run migrate
//
// Safe to run as often as you like:
// - every CREATE TABLE IF NOT EXISTS in schema.sql is run, so new tables are added and existing ones left alone;
// - columns added to existing tables after the first release (listed below) are added only if missing.
// Works the same on Windows PowerShell (no `<` redirection needed).
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

// Columns added to tables that already existed. Add new ones to the end of this list.
const NEW_COLUMNS = [
  { table: "notifications", column: "item_id", definition: "INT NULL AFTER `message`" },
  { table: "claims", column: "offered_amount", definition: "DECIMAL(10,2) NULL AFTER `status`" },
  { table: "claims", column: "counter_amount", definition: "DECIMAL(10,2) NULL AFTER `offered_amount`" },
];

// The CREATE TABLE statements from schema.sql (comments and CREATE DATABASE / USE removed).
function createTableStatements() {
  const sql = fs
    .readFileSync(path.join(__dirname, "schema.sql"), "utf8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .map((line) => line.replace(/\s--\s.*$/, ""))
    .join("\n");
  return sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => /^CREATE TABLE IF NOT EXISTS/i.test(s));
}

async function migrate(conn, database) {
  const done = [];
  for (const statement of createTableStatements()) {
    const name = statement.match(/CREATE TABLE IF NOT EXISTS\s+(\w+)/i)[1];
    const [[{ found }]] = await conn.query(
      "SELECT COUNT(*) AS found FROM information_schema.tables WHERE table_schema = ? AND table_name = ?",
      [database, name]
    );
    if (Number(found) === 0) {
      await conn.query(statement);
      done.push(`created table ${name}`);
    }
  }
  for (const { table, column, definition } of NEW_COLUMNS) {
    const [[{ found }]] = await conn.query(
      "SELECT COUNT(*) AS found FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?",
      [database, table, column]
    );
    if (Number(found) === 0) {
      await conn.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      done.push(`added ${table}.${column}`);
    }
  }
  return done;
}

async function main() {
  const database = process.env.DB_NAME;
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database,
    port: process.env.DB_PORT,
  });
  try {
    const done = await migrate(conn, database);
    console.log(done.length ? done.map((d) => `- ${d}`).join("\n") : "Database is already up to date.");
  } catch (err) {
    console.error("Migration failed:", err.code || "", err.message);
    if (err.code === "ER_BAD_DB_ERROR") console.error("Create the database first: mysql -u root -p < schema.sql");
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

if (require.main === module) main();

module.exports = { migrate };
