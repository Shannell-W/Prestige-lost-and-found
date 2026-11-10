// Week 13: the ONE place that knows the shape of our upstream partner's (Team 4's) venues API.
// Every version turns Team 4's response into the same thing for our page:
//   [{ id, name, capacity, location?, genres? }]
// Pick the version in server/.env:  PARTNER_VERSION=v1  (switching, or rolling back, is one word).
//
// Team 4 hasn't sent a v2 notice yet. When it arrives: add `v2` below with their new path and
// shape (copy the example in their notice), add a test in __tests__/partner.test.js, then set
// PARTNER_VERSION=v2.

// v1: GET /api/venues -> a bare list. Accepts their server's `venueName` or their contract's `name`.
function parseV1(body) {
  if (!Array.isArray(body)) throw new Error("unexpected v1 shape: expected a list of venues");
  return body.map((v) => {
    const name = v && typeof v.venueName === "string" ? v.venueName : v && v.name;
    if (typeof name !== "string" || typeof v.capacity !== "number") {
      throw new Error("unexpected v1 shape: a venue has no name or capacity");
    }
    const venue = { id: String(v.id), name, capacity: v.capacity };
    if (typeof v.location === "string") venue.location = v.location;
    if (typeof v.supportedGenres === "string") venue.genres = v.supportedGenres;
    return venue;
  });
}

const versions = {
  v1: { path: "/api/venues", parse: parseV1 },
  // v2: { path: "/v2/api/venues", parse: (body) => ... }   <- add from Team 4's notice
};

// The version chosen in .env. An unknown name is a mistake in .env, so say so and use v1.
function currentVersion() {
  const name = process.env.PARTNER_VERSION || "v1";
  if (!versions[name]) {
    console.error(`PARTNER_VERSION=${name} is not defined in partner.js; using v1`);
    return { name: "v1", ...versions.v1 };
  }
  return { name, ...versions[name] };
}

module.exports = { versions, currentVersion };
