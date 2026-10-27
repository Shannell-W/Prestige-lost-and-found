// API keys, rate limiting, and the fixes from the security audit (SECURITY_AUDIT.md).
const { app, request, rawRequest, OTHER_KEY, pool, resetDb, loginAs, keysOf, expectError } = require("../test/helpers");
const { rateLimit } = require("../security");

beforeEach(async () => {
  await resetDb();
  rateLimit.reset();
  process.env.RATE_LIMIT_MAX = "100000";
});
afterAll(() => pool.end());

describe("API key (X-API-Key header)", () => {
  it("no key: 401 with a JSON error, on a partner endpoint", async () => {
    const res = await rawRequest(app).get("/claims").query({ status: "claimed" });
    expectError(res, 401, /API key/);
  });

  it("no key: 401 on our website's routes too", async () => {
    expectError(await rawRequest(app).get("/api/items"), 401, /API key/);
  });

  it("wrong key: 401", async () => {
    const res = await rawRequest(app).get("/api/items").set("X-API-Key", "wrong");
    expectError(res, 401, /API key/);
  });

  it("valid key: 200", async () => {
    const res = await request(app).get("/claims").query({ status: "claimed" });
    expect(res.status).toBe(200);
  });

  it("each consumer has its own key, and both work", async () => {
    expect((await request(app, OTHER_KEY).get("/api/items")).status).toBe(200);
  });

  it("no key on a write: 401, and nothing is written", async () => {
    const res = await rawRequest(app)
      .post("/claims")
      .send({ studentId: "SU-1003", itemId: "3", rewardAmountCents: 0 });
    expectError(res, 401);
    const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM claims");
    expect(Number(n)).toBe(3);
  });

  it("the key is checked before the body is read: bad JSON with no key gets 401, not 400", async () => {
    const res = await rawRequest(app).post("/claims").set("Content-Type", "application/json").send("{oops");
    expect(res.status).toBe(401);
  });

  it("the health check stays open with no key", async () => {
    const res = await rawRequest(app).get("/api/health");
    expect(res.status).toBe(200);
  });
});

describe("Rate limit", () => {
  it("with the limit set to 3: 200 200 200 429 429, and the 429 says when to retry", async () => {
    process.env.RATE_LIMIT_MAX = "3";
    const statuses = [];
    let last;
    for (let i = 0; i < 5; i += 1) {
      last = await request(app).get("/api/items");
      statuses.push(last.status);
    }
    expect(statuses).toEqual([200, 200, 200, 429, 429]);
    expect(Number(last.headers["retry-after"])).toBeGreaterThan(0);
    expect(last.body.error).toBe("Too many requests");
    expect(last.body.retryAfter).toBeGreaterThan(0);
  });

  it("counts each key separately: one busy consumer doesn't block another", async () => {
    process.env.RATE_LIMIT_MAX = "1";
    await request(app).get("/api/items");
    expect((await request(app).get("/api/items")).status).toBe(429);
    expect((await request(app, OTHER_KEY).get("/api/items")).status).toBe(200);
  });
});

describe("Fixes from the security audit", () => {
  it("a student can't read someone else's claim by changing the ID (403)", async () => {
    // Claim 2 is Amani's claim on item 2, which Brian found. Faith has nothing to do with it.
    const faith = await loginAs("faith@ku.test", "Kenyatta University");
    expectError(await faith.get("/api/claims/2"), 403);
  });

  it("the claimant and the finder can still read it", async () => {
    const amani = await loginAs("amani@strathmore.test");
    const brian = await loginAs("brian@strathmore.test");
    expect((await amani.get("/api/claims/2")).status).toBe(200);
    expect((await brian.get("/api/claims/2")).status).toBe(200);
  });

  it("a bad login token gets 401 (we don't know who you are), not 403", async () => {
    const res = await request(app).get("/api/profile").set("Authorization", "Bearer not-a-real-token");
    expectError(res, 401);
  });

  it("the profile never includes the password hash", async () => {
    const amani = await loginAs("amani@strathmore.test");
    const res = await amani.get("/api/profile");
    expect(res.status).toBe(200);
    expect(keysOf(res.body)).not.toContain("password");
  });

  it("login sends back no password hash", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "amani@strathmore.test", password: "password123", school: "Strathmore University" });
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/password|\$2[aby]\$/);
  });

  it("registering ignores extra fields like isAdmin or id", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Test Student",
      studentId: "SU-9999",
      school: "Strathmore University",
      email: "test@strathmore.test",
      password: "password123",
      confirmPassword: "password123",
      id: 1,
      isAdmin: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.userId).not.toBe(1);
  });

  it("server errors don't reveal SQL, table names or file paths", async () => {
    const res = await request(app).get("/claims/abc/fees");
    expect(JSON.stringify(res.body)).not.toMatch(/SELECT|FROM |ER_|\.js|at /);
  });
});
