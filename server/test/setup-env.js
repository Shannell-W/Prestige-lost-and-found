// Runs before every test file. Points the server at a separate TEST database
// (prestige_db_test), so running the tests never touches your real data.
require("dotenv").config();

process.env.NODE_ENV = "test";
process.env.DB_NAME = "prestige_db_test";
process.env.JWT_SECRET = "test-secret";
process.env.CLAIM_FEE_CENTS = "10000";
