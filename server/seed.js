// Loads sample data so anyone can run and test the project.
//
//   npm run seed            add sample data (only if the database has no users yet)
//   npm run seed -- --reset DELETE ALL DATA in every table, then add sample data
//
// Run schema.sql first. Every sample student's password is: password123
require("dotenv").config();
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");

const RESET = process.argv.includes("--reset");

async function seed(conn) {
  const password = await bcrypt.hash("password123", 10);

  // Students (id is fixed so the rows below can refer to them)
  await conn.query(
    `INSERT INTO users (id, full_name, student_id, school, email, password, created_at) VALUES
     (1, 'Amani Otieno',   'SU-1001', 'Strathmore University', 'amani@strathmore.test',   ?, '2026-09-01 09:00:00'),
     (2, 'Wanjiku Mwangi', 'SU-1002', 'Strathmore University', 'wanjiku@strathmore.test', ?, '2026-09-01 09:05:00'),
     (3, 'Brian Kiprop',   'SU-1003', 'Strathmore University', 'brian@strathmore.test',   ?, '2026-09-02 10:00:00'),
     (4, 'Faith Njeri',    'KU-2001', 'Kenyatta University',   'faith@ku.test',           ?, '2026-09-03 11:00:00')`,
    [password, password, password, password]
  );

  // Found items. student_id is the finder (users.id).
  await conn.query(
    `INSERT INTO items (id, title, description, category, location, date_found, status, student_id, school, reward_amount, image_url, created_at) VALUES
     (1, 'Black backpack', 'Black backpack with a red keychain and a maths textbook inside.', 'Accessories', 'Library, 2nd floor', '2026-09-30', 'RETURNED', 2, 'Strathmore University', 150.00, NULL, '2026-09-30 15:20:00'),
     (2, 'Scientific calculator', 'Casio fx-991ES with initials scratched on the back.', 'Electronics', 'Science Lab 3', '2026-10-02', 'CLAIMED', 3, 'Strathmore University', 100.00, NULL, '2026-10-02 12:10:00'),
     (3, 'Student ID card', 'Strathmore student ID found near the cafeteria.', 'Documents', 'Cafeteria', '2026-10-05', 'FOUND', 2, 'Strathmore University', 0.00, NULL, '2026-10-05 17:45:00'),
     (4, 'House keys', 'Three keys on a silver ring with a small torch.', 'Other', 'Main gate', '2026-10-06', 'FOUND', 3, 'Strathmore University', 50.00, NULL, '2026-10-06 07:30:00'),
     (5, 'Grey hoodie', 'Grey hoodie, size M, school logo on the sleeve.', 'Clothing', 'Dining hall', '2026-10-04', 'FOUND', 4, 'Kenyatta University', 0.00, NULL, '2026-10-04 13:00:00')`
  );

  // Claims. student_id is the claimant (users.id).
  await conn.query(
    `INSERT INTO claims (id, item_id, student_id, evidence, status, created_at) VALUES
     (1, 1, 1, 'The keychain is a red Arsenal one and my name is inside the textbook cover.', 'APPROVED', '2026-10-01 09:15:00'),
     (2, 2, 1, 'My calculator has A.O. scratched on the back.', 'PENDING', '2026-10-03 10:00:00'),
     (3, 2, 2, 'I lost a calculator in Lab 3 last week.', 'PENDING', '2026-10-03 11:30:00')`
  );

  // The approved claim has a handling fee, and part of it was refunded.
  await conn.query(
    `INSERT INTO fees (id, claim_id, amount_payable_cents, created_at) VALUES (1, 1, 10000, '2026-10-01 14:00:00')`
  );
  await conn.query(
    `INSERT INTO refunds (id, claim_id, student_id, amount_cents, reason, refunded_at) VALUES
     (1, 1, 1, 2500, 'Item returned with a broken zip; partial refund issued.', '2026-10-08 16:30:00')`
  );

  await conn.query(
    `INSERT INTO notifications (user_id, message, is_read, created_at) VALUES
     (1, 'Your claim for "Black backpack" was approved.', 1, '2026-10-01 14:00:00'),
     (3, 'Someone submitted a claim for your item "Scientific calculator".', 0, '2026-10-03 10:00:00'),
     (3, 'Someone submitted a claim for your item "Scientific calculator".', 0, '2026-10-03 11:30:00')`
  );
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
  });

  try {
    const [[{ count }]] = await conn.query("SELECT COUNT(*) AS count FROM users");

    if (count > 0 && !RESET) {
      console.log(`The database already has ${count} user(s), so no sample data was added.`);
      console.log("To wipe everything and load sample data instead, run: npm run seed -- --reset");
      return;
    }

    await conn.beginTransaction();
    if (RESET) {
      // Children first, so foreign keys are never broken.
      for (const table of ["refunds", "fees", "notifications", "claims", "items", "users"]) {
        await conn.query(`DELETE FROM ${table}`);
      }
    }
    await seed(conn);
    await conn.commit();

    console.log("Sample data loaded.");
    console.log("Log in as amani@strathmore.test / password123 / Strathmore University");
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error("Seeding failed:", err.code || "", err.message);
    if (err.code === "ER_NO_SUCH_TABLE") console.error("Run schema.sql first: mysql -u root -p < schema.sql");
    if (err.code === "ER_BAD_DB_ERROR") console.error("DB_NAME in .env doesn't match the database in schema.sql");
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

if (require.main === module) main();

module.exports = { seed };
