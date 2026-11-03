// Week 12: request logging and GET /stats (monitoring.js).
const crypto = require("crypto");
const { app, request, rawRequest, TEST_KEY, OTHER_KEY, pool, resetDb, expectError } = require("../test/helpers");
const { resetStats } = require("../monitoring");
const { rateLimit } = require("../security");
const partnerVenues = require("../routes/partnerVenues");

let lines;
let spy;

beforeAll(resetDb);
beforeEach(() => {
  resetStats();
  rateLimit.reset();
  lines = [];
  process.env.MONITOR_LOG = "1";
  spy = jest.spyOn(console, "log").mockImplementation((msg) => {
    if (typeof msg === "string" && msg.startsWith("{")) lines.push(JSON.parse(msg));
  });
});
afterEach(() => {
  spy.mockRestore();
  delete process.env.MONITOR_LOG;
});
afterAll(() => pool.end());

const fingerprint = (key) => "key-" + crypto.createHash("sha256").update(key).digest("hex").slice(0, 6);
const stats = async () => (await request(app).get("/stats")).body;

describe("request log", () => {
  it("one line per request with time, method, path, status, ms and caller", async () => {
    await request(app).get("/claims?status=pending");
    await rawRequest(app).get("/claims").set("X-API-Key", "wrong");
    await rawRequest(app).get("/claims");

    expect(lines).toHaveLength(3);
    expect(Object.keys(lines[0]).sort()).toEqual(["caller", "consumer", "method", "ms", "path", "status", "time"]);
    expect(lines.map((l) => [l.status, l.caller])).toEqual([
      [200, fingerprint(TEST_KEY)],
      [401, "none"],
      [401, "none"],
    ]);
    expect(lines[0]).toMatchObject({ method: "GET", path: "/claims", consumer: "tests" });
    expect(lines[0].time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(typeof lines[0].ms).toBe("number");
    expect(lines[0].ms).toBeGreaterThan(0); // hrtime, not a rounded-to-0 Date.now()
  });

  it("never contains a key, a query string, or a body", async () => {
    await request(app).get("/claims?status=pending&email=secret@x.test");
    await request(app).post("/api/auth/login").send({ email: "amani@strathmore.test", password: "password123", school: "Strathmore University" });
    const text = spy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(text).not.toContain(TEST_KEY);
    expect(text).not.toContain("secret@x.test");
    expect(text).not.toContain("status=");
    expect(text).not.toContain("password123");
    expect(text).not.toContain("token");
  });

  it("tells callers apart by fingerprint", async () => {
    await request(app).get("/claims?status=pending");
    await request(app, OTHER_KEY).get("/claims?status=pending");
    expect(lines[0].caller).not.toBe(lines[1].caller);
    expect(lines[1]).toMatchObject({ caller: fingerprint(OTHER_KEY), consumer: "team6-test" });
  });

  it("rate-limited requests (429) are logged too, because monitor runs first", async () => {
    const before = process.env.RATE_LIMIT_MAX;
    process.env.RATE_LIMIT_MAX = "2";
    for (let i = 0; i < 3; i++) await request(app).get("/claims?status=pending");
    process.env.RATE_LIMIT_MAX = before;
    expect(lines.map((l) => l.status)).toEqual([200, 200, 429]);
  });
});

describe("GET /stats", () => {
  it("needs a key", async () => {
    expectError(await rawRequest(app).get("/stats"), 401);
  });

  it("counts totals, 4xx, 5xx, error rate and times", async () => {
    await request(app).get("/claims?status=pending"); // 200
    await request(app).get("/claims"); // 400
    await rawRequest(app).get("/claims"); // 401
    await request(app).get("/no-such-path"); // 404
    const errors = jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(pool, "query").mockRejectedValueOnce(new Error("db down"));
    await request(app).get("/api/items"); // 500
    errors.mockRestore();

    const s = await stats();
    expect(s).toMatchObject({ total: 5, clientErrors: 3, serverErrors: 1, errorRatePercent: 20 });
    expect(s.avgMs).toBeGreaterThan(0);
    expect(typeof s.uptimeSeconds).toBe("number");
    expect(s.routes["GET /api/items"]).toMatchObject({ count: 1, serverErrors: 1 });
    expect(s.routes["GET /claims"]).toMatchObject({ count: 2, clientErrors: 1 });
    expect(s.routes["(no route)"]).toBeUndefined(); // see the next test for what lands there
  });

  it("groups by route pattern; rejected and unknown paths land in (no route)", async () => {
    await request(app).get("/claims/1/fees");
    await request(app).get("/claims/2/fees");
    await rawRequest(app).get("/claims/1/fees"); // 401 before any route
    await request(app).get("/no-such-path"); // 404

    const { routes } = await stats();
    expect(routes["GET /claims/:claimId/fees"]).toMatchObject({ count: 2, clientErrors: 1 }); // claim 2 has no fee: 404
    expect(Object.keys(routes).filter((r) => r.includes("/claims/1") || r.includes("/claims/2"))).toEqual([]);
    expect(routes["GET (no route)"]).toMatchObject({ count: 2, clientErrors: 2 });
    expect(routes["GET /claims/:claimId/fees"].maxMs).toBeGreaterThanOrEqual(routes["GET /claims/:claimId/fees"].avgMs);
  });

  it("doesn't count itself in its own reply, but does in the next", async () => {
    expect((await stats()).total).toBe(0);
    expect((await stats()).total).toBe(1);
  });
});

describe("stretch: partner fallback counts", () => {
  it("counts calls, failures and the friendly 502 when Team 4 is unreachable", async () => {
    const saved = { url: process.env.PARTNER_URL, timeout: process.env.PARTNER_TIMEOUT_MS };
    process.env.PARTNER_URL = "http://127.0.0.1:9"; // nothing listens here
    process.env.PARTNER_TIMEOUT_MS = "500";
    partnerVenues.resetCache();
    const errors = jest.spyOn(console, "error").mockImplementation(() => {});
    expect((await request(app).get("/api/partner-venues")).status).toBe(502);
    errors.mockRestore();
    process.env.PARTNER_URL = saved.url;
    process.env.PARTNER_TIMEOUT_MS = saved.timeout;

    expect((await stats()).partner).toEqual({ calls: 1, failures: 1, staleServed: 0, unavailable: 1 });
  });
});
