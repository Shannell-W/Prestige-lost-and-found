// Week 10: the Venues page's data from Team 4.
// A stand-in Team 4 server plays both of their servers:
// - "backend" mode: like artist-api-server.onrender.com (the address Team 4 gave us): no key,
//   venues have venueName, location, supportedGenres.
// - otherwise: like their contracted API (EMT-MOSES/Team-4--Artist-platform): needs x-api-key,
//   venues have id, name, capacity, and it allows 3 successful requests per hour, then answers 429.
const http = require("http");
const { app, request, pool } = require("../test/helpers");
const partnerVenues = require("../routes/partnerVenues");

const KEY = "team-4-test-key";
const VENUES = [
  { id: "venue-1", name: "North Quad Hall", capacity: 450 },
  { id: "venue-2", name: "The Foundry", capacity: 1200 },
];

let team4;
let team4Url;
let calls; // successful calls Team 4 has answered
let mode; // "backend" | "normal" | "renamed" | "slow"
let lastKey;

beforeAll((done) => {
  team4 = http.createServer((req, res) => {
    lastKey = req.headers["x-api-key"];
    const send = (status, body) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (mode === "backend" && req.url === "/api/venues") {
      return send(200, [
        { id: 1, userId: 3, venueName: "Royal Arena", location: "Nairobi", capacity: 1200,
          supportedGenres: "Afrobeats,R&B,Pop", description: "Large venue", createdAt: "2026-09-08T17:28:13.000Z" },
      ]);
    }
    if (req.headers["x-api-key"] !== KEY) return send(401, { error: "Unauthorized" });
    if (req.url !== "/api/venues") return send(404, { error: "Not found" });
    if (calls >= 3) {
      res.setHeader("Retry-After", "3600");
      return send(429, { error: "Rate limit exceeded" });
    }
    if (mode === "slow") return setTimeout(() => send(200, VENUES), 1000);
    calls += 1;
    if (mode === "renamed") return send(200, VENUES.map(({ id, name, capacity }) => ({ id, title: name, capacity })));
    send(200, VENUES.map((v) => ({ ...v, internalNote: "not for partners" })));
  });
  team4.listen(0, () => {
    team4Url = `http://127.0.0.1:${team4.address().port}`;
    done();
  });
});

beforeEach(() => {
  calls = 0;
  mode = "normal";
  lastKey = undefined;
  partnerVenues.resetCache();
  Object.assign(process.env, {
    PARTNER_URL: team4Url,
    PARTNER_API_KEY: KEY,
    PARTNER_CACHE_MINUTES: "20",
    PARTNER_TIMEOUT_MS: "20000",
  });
});

afterAll((done) => {
  pool.end();
  team4.close(done);
});

const getVenues = () => request(app).get("/api/partner-venues");

describe("GET /api/partner-venues (Team 4's venues)", () => {
  it("works with the backend Team 4 gave us: no key sent, venueName shown as name, location and genres kept", async () => {
    mode = "backend";
    process.env.PARTNER_API_KEY = "";
    const res = await getVenues();
    expect(res.status).toBe(200);
    expect(lastKey).toBeUndefined();
    expect(res.body).toEqual([
      { id: "1", name: "Royal Arena", capacity: 1200, location: "Nairobi", genres: "Afrobeats,R&B,Pop" },
    ]);
  });

  it("with their contracted API: sends our key in x-api-key and returns only id, name and capacity", async () => {
    const res = await getVenues();
    expect(res.status).toBe(200);
    expect(lastKey).toBe(KEY);
    expect(res.body).toEqual([
      { id: "venue-1", name: "North Quad Hall", capacity: 450 },
      { id: "venue-2", name: "The Foundry", capacity: 1200 },
    ]);
  });

  it("remembers the answer, so 5 page loads make only 1 call to Team 4 (their limit is 3 an hour)", async () => {
    for (let i = 0; i < 5; i += 1) {
      expect((await getVenues()).status).toBe(200);
    }
    expect(calls).toBe(1);
  });

  it("when Team 4 rate-limits us (429), shows the saved copy and marks it as old", async () => {
    await getVenues(); // saved
    process.env.PARTNER_CACHE_MINUTES = "0"; // saved copy counts as expired, so we call Team 4 again
    calls = 3; // Team 4's hourly limit is used up
    const res = await getVenues();
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.headers["x-partner-data-stale"]).toBe("true");
  });

  it("with no saved copy, a 429 gives the friendly 502", async () => {
    calls = 3;
    const res = await getVenues();
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: "Partner data unavailable" });
  });

  it("a wrong key (401) gives the friendly 502", async () => {
    process.env.PARTNER_API_KEY = "wrong-key";
    expect((await getVenues()).status).toBe(502);
  });

  it("a missing PARTNER_URL gives the friendly 502 without calling Team 4", async () => {
    process.env.PARTNER_URL = "";
    expect((await getVenues()).status).toBe(502);
    expect(lastKey).toBeUndefined();
  });

  it("when Team 4 is down, gives 502 and the rest of our server keeps working", async () => {
    process.env.PARTNER_URL = "http://127.0.0.1:59999";
    expect((await getVenues()).status).toBe(502);
    expect((await request(app).get("/api/health")).status).toBe(200);
  });

  it("when Team 4 renames a field, gives 502 instead of a table of blanks", async () => {
    mode = "renamed";
    expect((await getVenues()).status).toBe(502);
  });

  it("gives up on a slow Team 4 instead of hanging the page", async () => {
    mode = "slow";
    process.env.PARTNER_TIMEOUT_MS = "200";
    expect((await getVenues()).status).toBe(502);
  });
});
