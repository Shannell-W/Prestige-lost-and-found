// Events at Team 4's venues (GET /api/partner-events), built from Team 4's bookings and artists.
// A stand-in Team 4 server plays their real server (artist-api-server.onrender.com).
const http = require("http");
const { app, request, pool } = require("../test/helpers");
const partnerEvents = require("../routes/partnerEvents");

const BOOKINGS = [
  { id: 1, artistId: 1, venueId: 3, eventDate: "2026-09-15T00:00:00.000Z", offeredFee: "1200.00", status: "Completed", notes: "Live showcase", createdAt: "2026-09-08T17:28:13.000Z" },
  { id: 2, artistId: 2, venueId: 3, eventDate: "2026-11-21T00:00:00.000Z", offeredFee: "800.00", status: "Accepted", notes: "", createdAt: "2026-10-01T10:00:00.000Z" },
  { id: 3, artistId: 1, venueId: 1, eventDate: "2026-10-10T00:00:00.000Z", offeredFee: "500.00", status: "Rejected", notes: "", createdAt: "2026-10-02T10:00:00.000Z" },
  { id: 4, artistId: 2, venueId: 1, eventDate: null, offeredFee: "0.00", status: "Pending", notes: "date to be agreed", createdAt: "2026-10-03T10:00:00.000Z" },
];
const ARTISTS = [
  { id: 1, name: "DJ Mo", genre: "Afrobeats", bio: "" },
  { id: 2, name: "Nadia K", genre: "R&B", bio: "" },
];

let team4;
let team4Url;
let calls;
let mode; // "normal" | "artistsDown" | "bookingsDown" | "renamed"

beforeAll((done) => {
  team4 = http.createServer((req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    calls += 1;
    if (req.url === "/api/bookings") {
      if (mode === "bookingsDown") return send(500, { error: "Failed to fetch bookings." });
      if (mode === "renamed") return send(200, BOOKINGS.map(({ venueId, ...b }) => ({ ...b, venue: venueId })));
      return send(200, BOOKINGS);
    }
    if (req.url === "/api/artists") {
      if (mode === "artistsDown") return send(500, { error: "Failed to fetch artists." });
      return send(200, ARTISTS);
    }
    send(404, { error: "Not found" });
  });
  team4.listen(0, () => {
    team4Url = `http://127.0.0.1:${team4.address().port}`;
    done();
  });
});

beforeEach(() => {
  calls = 0;
  mode = "normal";
  partnerEvents.resetCache();
  Object.assign(process.env, { PARTNER_URL: team4Url, PARTNER_API_KEY: "", PARTNER_CACHE_MINUTES: "20", PARTNER_TIMEOUT_MS: "20000" });
});

afterAll((done) => {
  pool.end();
  team4.close(done);
});

const getEvents = () => request(app).get("/api/partner-events");

describe("GET /api/partner-events (shows at Team 4's venues)", () => {
  it("turns Team 4's bookings into dated events with artist names, newest first", async () => {
    const res = await getEvents();
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: "2", venueId: "3", date: "2026-11-21", artist: "Nadia K", status: "Accepted" },
      { id: "1", venueId: "3", date: "2026-09-15", artist: "DJ Mo", status: "Completed" },
    ]);
  });

  it("leaves out rejected bookings and bookings with no date", async () => {
    const ids = (await getEvents()).body.map((e) => e.id);
    expect(ids).not.toContain("3");
    expect(ids).not.toContain("4");
  });

  it("still shows the dates if Team 4's artists call fails, with artist null", async () => {
    mode = "artistsDown";
    const res = await getEvents();
    expect(res.status).toBe(200);
    expect(res.body.map((e) => [e.date, e.artist])).toEqual([
      ["2026-11-21", null],
      ["2026-09-15", null],
    ]);
  });

  it("remembers the answer: 5 page loads make only one round of calls to Team 4", async () => {
    for (let i = 0; i < 5; i += 1) expect((await getEvents()).status).toBe(200);
    expect(calls).toBe(2); // one bookings call and one artists call
  });

  it("if Team 4's bookings fail with no saved copy: the friendly 502", async () => {
    mode = "bookingsDown";
    const res = await getEvents();
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: "Partner data unavailable" });
  });

  it("if Team 4's bookings fail later: serves the saved copy, marked as old", async () => {
    await getEvents();
    process.env.PARTNER_CACHE_MINUTES = "0";
    mode = "bookingsDown";
    const res = await getEvents();
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.headers["x-partner-data-stale"]).toBe("true");
  });

  it("if Team 4 renames venueId: 502 instead of events with no venue", async () => {
    mode = "renamed";
    expect((await getEvents()).status).toBe(502);
  });
});
