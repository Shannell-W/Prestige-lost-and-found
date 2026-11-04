// Events at Team 4's venues, so our Venues page can show when shows were (or will be) held there.
//
// Team 4's server has no "events" endpoint, but its bookings are the same thing: an artist playing
// at a venue on a date.
//   GET <PARTNER_URL>/api/bookings -> [{ "id": 1, "artistId": 1, "venueId": 3,
//                                        "eventDate": "2026-09-15T00:00:00.000Z", "status": "Pending", ... }]
//   GET <PARTNER_URL>/api/artists  -> [{ "id": 1, "name": "DJ Mo", "genre": "...", "bio": "..." }]
// Booking status is Pending, Accepted, Rejected or Completed. We leave out Rejected bookings
// (that show never happened) and bookings with no date.
//
// Our route:  GET /api/partner-events -> [{ "id": "1", "venueId": "3", "date": "2026-09-15",
//                                           "artist": "DJ Mo", "status": "Pending" }]
// It works like /api/partner-venues: our server calls Team 4 (the browser never does), keeps the answer
// for PARTNER_CACHE_MINUTES, serves the saved copy if Team 4 fails, and otherwise answers 502.
// If only the artists call fails, we still show the dates, with artist set to null.
const express = require("express");

const router = express.Router();
const UNAVAILABLE = { error: "Partner data unavailable" };

let cache = null; // { events, fetchedAt }

function settings() {
  return {
    url: (process.env.PARTNER_URL || "").replace(/\/+$/, ""),
    key: process.env.PARTNER_API_KEY || "",
    cacheMs: Number(process.env.PARTNER_CACHE_MINUTES || 20) * 60 * 1000,
    timeoutMs: Number(process.env.PARTNER_TIMEOUT_MS || 20000),
  };
}

// GET one of Team 4's endpoints. Returns the parsed JSON, or null if it failed (logged, never the key).
async function getJson({ url, key, timeoutMs }, path) {
  const headers = key ? { "x-api-key": key, Accept: "application/json" } : { Accept: "application/json" };
  try {
    const r = await fetch(`${url}${path}`, { headers, signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) {
      console.error(`partner ${path} returned ${r.status}`);
      return null;
    }
    return await r.json();
  } catch (err) {
    const reason = err.name === "TimeoutError" ? `no response within ${timeoutMs}ms` : err.cause?.code || err.message;
    console.error(`partner ${path} failed:`, reason);
    return null;
  }
}

// Team 4's bookings (+ artist names) -> the events our page needs. Returns null if the shape isn't
// what we expect, so a renamed field shows our "unavailable" message instead of wrong dates.
function toEvents(bookings, artists) {
  if (!Array.isArray(bookings)) return null;
  const names = new Map();
  if (Array.isArray(artists)) {
    for (const a of artists) if (a && typeof a.name === "string") names.set(String(a.id), a.name);
  }
  const events = [];
  for (const b of bookings) {
    if (!b || typeof b !== "object" || b.venueId === undefined || b.venueId === null) return null;
    if (b.status === "Rejected") continue;
    if (typeof b.eventDate !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(b.eventDate)) continue; // no date set yet
    events.push({
      id: String(b.id),
      venueId: String(b.venueId),
      date: b.eventDate.slice(0, 10), // "2026-09-15T00:00:00.000Z" -> "2026-09-15"
      artist: names.get(String(b.artistId)) || null,
      status: typeof b.status === "string" ? b.status : null,
    });
  }
  events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // newest first
  return events;
}

router.get("/api/partner-events", async (req, res) => {
  const s = settings();
  if (!s.url) {
    console.error("PARTNER_URL is not set in server/.env");
    return res.status(502).json(UNAVAILABLE);
  }

  if (cache && Date.now() - cache.fetchedAt < s.cacheMs) {
    res.set("X-Partner-Data-Age", String(Math.round((Date.now() - cache.fetchedAt) / 1000)));
    return res.json(cache.events);
  }

  const [bookings, artists] = await Promise.all([getJson(s, "/api/bookings"), getJson(s, "/api/artists")]);
  const events = bookings === null ? null : toEvents(bookings, artists);
  if (bookings !== null && events === null) {
    console.error("partner bookings shape changed (expected venueId and eventDate)");
  }
  if (events) {
    cache = { events, fetchedAt: Date.now() };
    res.set("X-Partner-Data-Age", "0");
    return res.json(events);
  }

  if (cache) {
    res.set("X-Partner-Data-Age", String(Math.round((Date.now() - cache.fetchedAt) / 1000)));
    res.set("X-Partner-Data-Stale", "true");
    return res.json(cache.events);
  }
  return res.status(502).json(UNAVAILABLE);
});

// For tests: forget the remembered answer.
router.resetCache = () => {
  cache = null;
};

module.exports = router;
