// API security: API keys and rate limiting.
//
// Every request must send a valid key in the X-API-Key header, or it gets 401 and no route runs.
// Each consumer has its own key, so we can tell callers apart and revoke one without breaking the rest.
// Keys live in server/.env (API_KEYS), never in this code or in git:
//
//   API_KEYS=team6:<key>,prestige-web:<key>,prestige-team:<key>
//
// The part before ":" is just a name for logs (we log the name, never the key).
// Make a key with:  node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
//
// Rate limit: each key may make RATE_LIMIT_MAX requests per RATE_LIMIT_WINDOW_MS (default 100 per minute).
// Request 101 within the minute gets 429 with a Retry-After header saying how many seconds to wait.
// The counts live in memory, so they reset when the server restarts (fine for this course).

// Read the keys from the environment: Map of key -> consumer name.
function loadKeys() {
  const keys = new Map();
  (process.env.API_KEYS || "").split(",").forEach((entry, i) => {
    const trimmed = entry.trim();
    if (!trimmed) return;
    const colon = trimmed.indexOf(":");
    const name = colon > 0 ? trimmed.slice(0, colon).trim() : `consumer-${i + 1}`;
    const key = colon > 0 ? trimmed.slice(colon + 1).trim() : trimmed;
    if (key) keys.set(key, name);
  });
  return keys;
}

// Say how many keys were loaded, and for whom, without printing any key.
function logKeysLoaded() {
  const keys = loadKeys();
  if (keys.size === 0) {
    console.warn("No API keys loaded: set API_KEYS in server/.env, or every request will get 401.");
  } else {
    console.log(`API keys loaded: ${keys.size} (${[...keys.values()].join(", ")})`);
  }
}

function requireApiKey(req, res, next) {
  const key = req.get("X-API-Key");
  const name = key ? loadKeys().get(key) : undefined;
  if (!name) {
    return res.status(401).json({ error: "Missing or invalid API key" });
  }
  req.apiKey = key;
  req.apiConsumer = name;
  next();
}

// In-memory counts: key -> { count, resetAt }
const hits = new Map();

function rateLimit(req, res, next) {
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
  const max = Number(process.env.RATE_LIMIT_MAX || 100);
  const id = req.apiKey || req.ip;
  const now = Date.now();

  let entry = hits.get(id);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    hits.set(id, entry);
  }
  entry.count += 1;

  res.set("RateLimit-Limit", String(max));
  res.set("RateLimit-Remaining", String(Math.max(0, max - entry.count)));

  if (entry.count > max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.set("Retry-After", String(retryAfter));
    console.warn(`rate limit hit by ${req.apiConsumer || "unknown"}: retry after ${retryAfter}s`);
    return res.status(429).json({ error: "Too many requests", retryAfter });
  }
  next();
}

// For tests: forget all counts.
rateLimit.reset = () => hits.clear();

module.exports = { requireApiKey, rateLimit, logKeysLoaded, loadKeys };
