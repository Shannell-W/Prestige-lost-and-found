// Week 13: adds the standard "this is going away" headers to a response.
//   Deprecation: true
//   Sunset: <date it stops working>
//   Link: </v2/...>; rel="successor-version"
// `successor` can be a fixed path, or a function of the request (so /students/SU-1001/claims
// points at /v2/students/SU-1001/claims).

// The ONE place our v1 sunset date lives. The day before Demo Day; v1 keeps running until after
// Demo Day anyway, so nobody's demo breaks (course rule).
const V1_SUNSET = "2026-11-16";

function deprecated({ sunset = V1_SUNSET, successor }) {
  const when = new Date(`${sunset}T00:00:00Z`).toUTCString();
  return (req, res, next) => {
    const next_ = typeof successor === "function" ? successor(req) : successor;
    res.set("Deprecation", "true");
    res.set("Sunset", when);
    res.set("Link", `<${next_}>; rel="successor-version"`);
    next();
  };
}

module.exports = { deprecated, V1_SUNSET };
