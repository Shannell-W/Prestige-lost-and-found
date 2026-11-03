// Creates the database and all tables from schema.sql, without needing the `mysql` command line.
//
//   node setup-db.js
//
// Uses the MySQL login in server/.env (DB_HOST, DB_USER, DB_PASSWORD, DB_PORT, DB_NAME).
// Safe on an existing database: every table uses CREATE TABLE IF NOT EXISTS, so nothing is deleted.
// (For a database from before lost reports, also run `npm run migrate` to add the new columns.)
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

async function main() {
  const name = process.env.DB_NAME || "prestige_db";
  if (!/^\w+$/.test(name)) throw new Error(`DB_NAME "${name}" may only contain letters, numbers and _`);

  const schema = fs
    .readFileSync(path.join(__dirname, "schema.sql"), "utf8")
    .replace(/CREATE DATABASE IF NOT EXISTS prestige_db\b/, `CREATE DATABASE IF NOT EXISTS ${name}`)
    .replace(/USE prestige_db;/, `USE ${name};`);

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    multipleStatements: true,
  });
  try {
    await conn.query(schema);
    console.log(`Database "${name}" and its tables are ready.`);
    console.log("Next: npm run seed   (adds sample students and items), then npm start");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("Setting up the database failed:", err.code || "", err.message);
  if (err.code === "ECONNREFUSED") console.error("MySQL isn't running (or isn't on DB_HOST/DB_PORT). Start the MySQL service and try again.");
  if (err.code === "ER_ACCESS_DENIED_ERROR") console.error("Wrong DB_USER or DB_PASSWORD in server/.env.");
  process.exitCode = 1;
});