// Stand-in partner for the Week 11 lab.
// Save it in your server folder and run:  node flaky-partner.js
// Switch behaviour without restarting by opening these in a browser:
//   http://localhost:4000/__mode/ok      normal
//   http://localhost:4000/__mode/slow    answers after 10 seconds
//   http://localhost:4000/__mode/flaky   fails twice (503), then works
//   http://localhost:4000/__mode/error   always fails (500)

const express = require("express");
const app = express();

let mode = "ok"; // ok | slow | flaky | error
let calls = 0;

const venues = [
  {
    id: 1,
    userId: 3,
    venueName: "Stand-in Arena",
    location: "Nairobi",
    capacity: 1200,
    supportedGenres: "Afrobeats,R&B,Pop",
    description: "Fake venue from the stand-in partner.",
    createdAt: "2026-09-08T17:28:13.000Z",
    updatedAt: "2026-09-08T17:28:13.000Z",
  },
  {
    id: 2,
    userId: 3,
    venueName: "Stand-in Hall",
    location: "Westlands",
    capacity: 500,
    supportedGenres: "Jazz",
    description: "Fake venue from the stand-in partner.",
    createdAt: "2026-09-08T17:28:13.000Z",
    updatedAt: "2026-09-08T17:28:13.000Z",
  },
  {
    id: 3,
    userId: 3,
    venueName: "Stand-in Club",
    location: "Langata",
    capacity: 800,
    supportedGenres: "Pop",
    description: "Fake venue from the stand-in partner.",
    createdAt: "2026-09-08T17:28:13.000Z",
    updatedAt: "2026-09-08T17:28:13.000Z",
  },
];

app.get("/__mode/:m", (req, res) => {
  mode = req.params.m;
  calls = 0;
  console.log(`--- mode switched to ${mode} ---`);
  res.json({ mode });
});

app.get("/api/venues", async (req, res) => {
  calls += 1;
  console.log(`GET /api/venues (call ${calls}, mode ${mode})`);

  if (mode === "slow") {
    // answers after 10 seconds
    await new Promise((r) => setTimeout(r, 10000));
  }

  if (mode === "flaky" && calls % 3 !== 0) {
    // fails twice, then works
    return res.status(503).json({ message: "Try again" });
  }

  if (mode === "error") {
    // always fails
    return res.status(500).json({ message: "Internal error" });
  }

  res.json(venues);
});

app.listen(4000, () => console.log("Stand-in partner on http://localhost:4000"));
