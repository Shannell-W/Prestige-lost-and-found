// Week 10 integration: venues from our upstream partner, Team 4.
//
// Team 4 told us (27 Oct) to use https://artist-api-server.onrender.com/api/venues, their app backend:
//   200 -> [{ "id": 1, "venueName": "Royal Arena", "location": "Nairobi", "capacity": 1200,
//             "supportedGenres": "Afrobeats,R&B,Pop", ... }]          (no key needed)
// Their contract (openapi.yaml in EMT-MOSES/Team-4--Artist-platform) describes a different server:
//   GET /api/venues with header x-api-key -> [{ "id": "venue-1", "name": "North Quad Hall", "capacity": 450 }]
//   and a limit of 3 requests per hour.
// This code accepts both shapes, and sends a key only if PARTNER_API_KEY is set, so either server works.
// We keep the last good answer for PARTNER_CACHE_MINUTES (default 20): it protects a 3-per-hour limit,
// and lets the page keep showing venues while the partner is down or waking up.
//
// The browser never calls Team 4: it calls our /api/partner-venues, and our server calls them.
const express = require("express");

const router = express.Router();
const UNAVAILABLE = { error: "Partner data unavailable" };

let cache = null; // { venues, fetchedAt }

function settings() {
  return {
    url: (process.env.PARTNER_URL || "").replace(/\/+$/, ""),
    key: process.env.PARTNER_API_KEY || "",
    cacheMs: Number(process.env.PARTNER_CACHE_MINUTES || 20) * 60 * 1000,
    timeoutMs: Number(process.env.PARTNER_TIMEOUT_MS || 20000),
  };
}

// Their response -> the fields our page needs. Returns null if the shape isn't what we expect,
// so a renamed field shows our "unavailable" message instead of a table of blanks.
// Accepts the backend's `venueName` or the contract's `name`.
function toVenues(data) {
  if (!Array.isArray(data)) return null;
  const venues = [];
  for (const v of data) {
    if (!v || typeof v !== "object") return null;
    const name = typeof v.venueName === "string" ? v.venueName : v.name;
    if (typeof name !== "string" || typeof v.capacity !== "number") return null;
    const venue = { id: String(v.id), name, capacity: v.capacity };
    if (typeof v.location === "string") venue.location = v.location;
    if (typeof v.supportedGenres === "string") venue.genres = v.supportedGenres;
    venues.push(venue);
  }
  return venues;
}

async function fetchFromPartner({ url, key, timeoutMs }) {
  // Send a key only if we have one: the backend Team 4 gave us needs none; their contracted API does.
  const headers = key ? { "x-api-key": key, Accept: "application/json" } : { Accept: "application/json" };
  const r = await fetch(`${url}/api/venues`, {
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) {
    // Log the status only, never the key.
    const wait = r.headers.get("retry-after");
    console.error(`partner returned ${r.status}${r.status === 429 && wait ? ` (retry after ${wait}s)` : ""}`);
    return null;
  }
  const venues = toVenues(await r.json());
  if (!venues) console.error("partner response shape changed (expected id, venueName or name, capacity)");
  return venues;
}

router.get("/api/partner-venues", async (req, res) => {
  const s = settings();
  if (!s.url) {
    console.error("PARTNER_URL is not set in server/.env");
    return res.status(502).json(UNAVAILABLE);
  }

  // Fresh enough: answer from memory without calling Team 4 (protects their 3-per-hour limit).
  if (cache && Date.now() - cache.fetchedAt < s.cacheMs) {
    res.set("X-Partner-Data-Age", String(Math.round((Date.now() - cache.fetchedAt) / 1000)));
    return res.json(cache.venues);
  }

  try {
    const venues = await fetchFromPartner(s);
    if (venues) {
      cache = { venues, fetchedAt: Date.now() };
      res.set("X-Partner-Data-Age", "0");
      return res.json(venues);
    }
  } catch (err) {
    const reason = err.name === "TimeoutError" ? `no response within ${s.timeoutMs}ms` : err.cause?.code || err.message;
    console.error("partner call failed:", reason);
  }

  // Partner failed (down, slow, 401, 429, changed shape). If we have an older answer, show it
  // rather than nothing, and say how old it is; otherwise show the friendly message.
  if (cache) {
    res.set("X-Partner-Data-Age", String(Math.round((Date.now() - cache.fetchedAt) / 1000)));
    res.set("X-Partner-Data-Stale", "true");
    return res.json(cache.venues);
  }
  return res.status(502).json(UNAVAILABLE);
});

// For tests: forget the remembered answer.
router.resetCache = () => {
  cache = null;
};

module.exports = router;
