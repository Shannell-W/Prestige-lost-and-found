// traffic.js (Week 12): sends a random mix of requests to our API, to give /stats and the log some data.
//
//   node traffic.js <base-url> <api-key> [count]
//   node traffic.js http://localhost:5000 <your-key> 60
//
// (Or the handout's style, on Mac/Linux/Git Bash: API=http://localhost:5000 KEY=<your-key> N=60 node traffic.js)
// Our partner (Team 6) runs the same script against our tunnel URL with the key we gave them.
const API = (process.argv[2] || process.env.API || "http://localhost:5000").replace(/\/+$/, "");
const KEY = process.argv[3] || process.env.KEY;
const N = Number(process.argv[4] || process.env.N || 60);

if (!KEY) {
  console.error("Usage: node traffic.js <base-url> <api-key> [count]");
  process.exit(1);
}

// Our real endpoints (README / openapi.yaml), plus some requests that should fail.
const mix = [
  { method: "GET", path: "/claims?status=pending", key: true },
  { method: "GET", path: "/claims?status=claimed", key: true },
  { method: "GET", path: "/students/SU-1001/claims", key: true },
  { method: "GET", path: "/schools/Strathmore%20University/item-statistics", key: true },
  { method: "GET", path: "/claims/1/fees", key: true },
  { method: "GET", path: "/claims/1/refunds", key: true },
  { method: "GET", path: "/api/items", key: true }, // the website's item list (biggest query)
  { method: "GET", path: "/claims/99999/fees", key: true }, // no such claim: 404
  { method: "GET", path: "/students/NOPE-1/claims", key: true }, // no such student: 404
  { method: "GET", path: "/claims", key: true }, // missing ?status=: 400
  { method: "GET", path: "/claims?status=pending", key: false }, // no key at all: 401
  { method: "GET", path: "/not-a-route", key: true }, // no such path: 404
];

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  const counts = {};
  for (let i = 0; i < N; i++) {
    const r = mix[Math.floor(Math.random() * mix.length)];
    try {
      const res = await fetch(API + r.path, {
        method: r.method,
        headers: r.key ? { "X-API-Key": KEY } : {},
      });
      counts[res.status] = (counts[res.status] || 0) + 1;
    } catch (err) {
      counts.failed = (counts.failed || 0) + 1;
    }
    await pause(50);
  }
  console.log("Status codes received:", counts);
})();
