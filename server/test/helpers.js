// Shared test helpers.
const request = require("supertest");
const app = require("../index");
const { pool } = require("../db");
const { seed } = require("../seed");

// Put the test database back to exactly the sample data from seed.js.
// Sample data: students SU-1001 (Amani), SU-1002 (Wanjiku), SU-1003 (Brian) at Strathmore,
// KU-2001 (Faith) at Kenyatta. Claim 1 is approved (with a fee of 10000 and a refund of 2500);
// claims 2 and 3 are pending on item 2.
async function resetDb() {
  for (const table of ["refunds", "fees", "notifications", "claims", "items", "users"]) {
    await pool.query(`DELETE FROM ${table}`);
  }
  await seed(pool);
}

// Log in as a sample student and return a request helper that sends their token.
async function loginAs(email, school = "Strathmore University") {
  const res = await request(app).post("/api/auth/login").send({ email, password: "password123", school });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  const auth = { Authorization: `Bearer ${res.body.token}` };
  return {
    get: (url) => request(app).get(url).set(auth),
    post: (url, body) => request(app).post(url).set(auth).send(body),
    patch: (url, body) => request(app).patch(url).set(auth).send(body),
  };
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const keysOf = (obj) => Object.keys(obj).sort();

// Strict contract checks: exact field names, types, and no extra fields.
function expectClaim(c) {
  expect(keysOf(c)).toEqual(["claimId", "itemId", "rewardAmountCents", "status", "studentId"]);
  expect(typeof c.claimId).toBe("string");
  expect(typeof c.studentId).toBe("string");
  expect(typeof c.itemId).toBe("string");
  expect(["pending", "claimed", "rejected"]).toContain(c.status);
  expect(Number.isInteger(c.rewardAmountCents)).toBe(true);
}

function expectRefund(r) {
  expect(keysOf(r)).toEqual(["amountCents", "claimId", "reason", "refundId", "refundedAt", "studentId"]);
  expect(typeof r.refundId).toBe("string");
  expect(Number.isInteger(r.amountCents)).toBe(true);
  expect(r.refundedAt).toMatch(ISO);
}

function expectError(res, status, messagePart) {
  expect(res.status).toBe(status);
  expect(keysOf(res.body)).toEqual(["error"]);
  if (messagePart) expect(res.body.error).toMatch(messagePart);
}

module.exports = { app, request, pool, resetDb, loginAs, ISO, keysOf, expectClaim, expectRefund, expectError };
