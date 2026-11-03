// migrate.js upgrades an old database (before lost reports) without losing data, and can run twice.
const mysql = require("mysql2/promise");
const { migrate } = require("../migrate");

const NAME = "prestige_db_migrate_test";
let conn;

beforeAll(async () => {
  conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  });
  await conn.query(`DROP DATABASE IF EXISTS ${NAME}`);
  await conn.query(`CREATE DATABASE ${NAME}`);
  await conn.query(`USE ${NAME}`);
  // The two tables as they were before this feature.
  await conn.query(`CREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY, full_name VARCHAR(120) NOT NULL)`);
  await conn.query(
    `CREATE TABLE notifications (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, message VARCHAR(500) NOT NULL,
     is_read TINYINT(1) NOT NULL DEFAULT 0, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  );
  await conn.query(
    `CREATE TABLE items (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(150) NOT NULL)`
  );
  await conn.query(
    `CREATE TABLE claims (id INT AUTO_INCREMENT PRIMARY KEY, item_id INT NOT NULL, student_id INT NOT NULL,
     evidence TEXT NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'PENDING')`
  );
  await conn.query("INSERT INTO users (full_name) VALUES ('Old user')");
  await conn.query("INSERT INTO notifications (user_id, message) VALUES (1, 'old message')");
});

afterAll(async () => {
  await conn.query(`DROP DATABASE IF EXISTS ${NAME}`);
  await conn.end();
});

it("adds the new tables and columns and keeps existing rows", async () => {
  const done = await migrate(conn, NAME);
  expect(done).toEqual(
    expect.arrayContaining([
      "created table lost_reports",
      "created table lost_report_matches",
      "added notifications.item_id",
      "added claims.offered_amount",
      "added claims.counter_amount",
    ])
  );
  const [[note]] = await conn.query("SELECT message, item_id FROM notifications");
  expect(note).toEqual({ message: "old message", item_id: null });
});

it("running it again changes nothing", async () => {
  expect(await migrate(conn, NAME)).toEqual(expect.not.arrayContaining(["added notifications.item_id"]));
  expect((await migrate(conn, NAME)).filter((d) => d.startsWith("added"))).toEqual([]);
});
