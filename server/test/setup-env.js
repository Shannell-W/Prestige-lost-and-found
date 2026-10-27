// Runs before every test file. Points the server at a separate TEST database
// (prestige_db_test), so running the tests never touches your real data.
require("dotenv").config();

process.env.NODE_ENV = "test";
process.env.DB_NAME = "prestige_db_test";
process.env.JWT_SECRET = "test-secret";
process.env.CLAIM_FEE_CENTS = "10000";
// Two test consumers, and a limit high enough that the normal tests never hit it.
// (__tests__/security.test.js lowers the limit to prove the 429.)
process.env.API_KEYS = "tests:test-key-prestige,team6-test:test-key-team6";
process.env.RATE_LIMIT_MAX = "100000";
process.env.RATE_LIMIT_WINDOW_MS = "60000";
