const request = require("supertest");
const app = require("../index");

const PREFIX = ""; // change to "/api" if your routes use it

async function getToken() {
  const res = await request(app).post(`${PREFIX}/auth/login`).send({
    email: process.env.TEST_EMAIL,
    password: process.env.TEST_PASSWORD,
    school: process.env.TEST_SCHOOL,
  });
  return res.body.token; // adjust if your login returns a different field
}

module.exports = { app, request, PREFIX, getToken };