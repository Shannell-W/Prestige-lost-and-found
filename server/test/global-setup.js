// Runs once before all tests: builds a fresh test database from schema.sql.
// Uses the MySQL login from server/.env (DB_HOST, DB_USER, DB_PASSWORD, DB_PORT).
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

module.exports = async () => {
  require("./setup-env");
  const name = process.env.DB_NAME; // prestige_db_test

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    multipleStatements: true,
  });

  // Same tables as the real database, but in prestige_db_test.
  const schema = fs
    .readFileSync(path.join(__dirname, "..", "schema.sql"), "utf8")
    .replace(/CREATE DATABASE IF NOT EXISTS prestige_db\b/, `CREATE DATABASE ${name}`)
    .replace(/USE prestige_db;/, `USE ${name};`);

  await conn.query(`DROP DATABASE IF EXISTS ${name}`);
  await conn.query(schema);
  await conn.end();
};
