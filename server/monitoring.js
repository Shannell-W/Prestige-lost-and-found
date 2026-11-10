// Week 12: monitoring. One log line per request (what happened) and running totals at GET /stats (how much).
//
// Log line (JSON, one per request):
//   {"time":"...","method":"GET","path":"/claims","status":200,"ms":5.2,"caller":"key-dc87f9","consumer":"team6"}
// - path is req.path only: never the query string (it can carry emails, tokens, names).
// - caller is a 6-character fingerprint of the API key (sha256), never the key itself.
// - consumer is the key's NAME from API_KEYS (e.g. team6), which is not a secret. Our addition to the handout.
// - Never logged: keys, tokens, passwords, request or response bodies, headers, query strings.
//
// Totals live in memory, so they reset when the server restarts (fine for this course).
const crypto = require("crypto");

const round = (n) => Math.round(n * 10) / 10;

const stats = {
  startedAt: new Date().toISOString(),
  total: 0,
  clientErrors: 0, // 4xx: usually the caller's mistake
  serverErrors: 0, // 5xx: our fault
  totalMs: 0,
  routes: {},
  // Stretch (Week 11): how often Team 4's venues API let us down, and what we did about it.
  partner: { calls: 0, failures: 0, staleServed: 0, unavailable: 0 },
};

function newRoute() {
  return { count: 0, clientErrors: 0, serverErrors: 0, totalMs: 0, maxMs: 0 };
}

// A label for who called, without ever writing the key itself.
function who(req) {
  if (!req.apiKey) return "none";
  const hash = crypto.createHash("sha256").update(req.apiKey).digest("hex");
  return "key-" + hash.slice(0, 6);
}

// Log lines go to the terminal (and requests.log when started with tee). Quiet during `npm test`,
// unless a test sets MONITOR_LOG=1, so the test output stays readable. Our addition to the handout.
function write(line) {
  if (process.env.NODE_ENV !== "test" || process.env.MONITOR_LOG) console.log(line);
}

function monitor(req, res, next) {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    // after the response is sent
    const ms = Number(process.hrtime.bigint() - start) / 1e6;

    write(
      JSON.stringify({
        time: new Date().toISOString(),
        method: req.method,
        path: req.baseUrl + req.path, // path only, with its /v1 or /v2 prefix; no query string
        status: res.statusCode,
        ms: round(ms),
        caller: who(req),
        consumer: req.apiConsumer || null,
      })
    );

    // Group by route pattern: /claims/1/fees and /claims/2/fees both become GET /claims/:claimId/fees
    const route = req.route ? req.baseUrl + req.route.path : "(no route)";
    const label = `${req.method} ${route}`;
    const r = stats.routes[label] || newRoute();
    stats.routes[label] = r;

    stats.total += 1;
    stats.totalMs += ms;
    r.count += 1;
    r.totalMs += ms;
    r.maxMs = Math.max(r.maxMs, ms);
    if (res.statusCode >= 500) {
      stats.serverErrors += 1;
      r.serverErrors += 1;
    } else if (res.statusCode >= 400) {
      stats.clientErrors += 1;
      r.clientErrors += 1;
    }
  });

  next();
}

// Stretch: routes/partnerVenues.js calls this: "call" (we asked Team 4), "failure" (they didn't answer
// usefully), "stale" (we served our saved copy instead), "unavailable" (nothing saved: friendly 502).
function recordPartner(event) {
  const key = { call: "calls", failure: "failures", stale: "staleServed", unavailable: "unavailable" }[event];
  if (key) stats.partner[key] += 1;
}

function statsHandler(req, res) {
  const routes = {};
  for (const [label, r] of Object.entries(stats.routes)) {
    routes[label] = {
      count: r.count,
      clientErrors: r.clientErrors,
      serverErrors: r.serverErrors,
      avgMs: round(r.totalMs / r.count),
      maxMs: round(r.maxMs),
    };
  }
  const rate = stats.total ? (stats.serverErrors / stats.total) * 100 : 0;
  const avg = stats.total ? stats.totalMs / stats.total : 0;

  res.json({
    startedAt: stats.startedAt,
    uptimeSeconds: Math.round(process.uptime()),
    total: stats.total,
    clientErrors: stats.clientErrors,
    serverErrors: stats.serverErrors,
    errorRatePercent: round(rate),
    avgMs: round(avg),
    routes,
    partner: { ...stats.partner },
  });
}

// For tests: start the totals again.
function resetStats() {
  Object.assign(stats, {
    startedAt: new Date().toISOString(),
    total: 0,
    clientErrors: 0,
    serverErrors: 0,
    totalMs: 0,
    routes: {},
    partner: { calls: 0, failures: 0, staleServed: 0, unavailable: 0 },
  });
}

module.exports = { monitor, statsHandler, recordPartner, resetStats, who };
