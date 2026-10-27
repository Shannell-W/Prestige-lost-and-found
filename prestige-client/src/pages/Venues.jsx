import { useEffect, useState } from "react";
import { API_URL } from "../api";

// Venues from our upstream partner, Team 4 (Week 10).
// Our server fetches them and remembers them for a while, so the page still works while
// Team 4's server is waking up or down. Location and genres show only if Team 4 sends them.
function Venues() {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [staleMinutes, setStaleMinutes] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/partner-venues`)
      .then((response) => {
        if (!response.ok) throw new Error("Partner data unavailable");
        // If Team 4 isn't answering, our server sends its last saved copy and says how old it is.
        if (response.headers.get("X-Partner-Data-Stale") === "true") {
          const ageSeconds = Number(response.headers.get("X-Partner-Data-Age") || 0);
          setStaleMinutes(Math.max(1, Math.round(ageSeconds / 60)));
        }
        return response.json();
      })
      .then((data) => {
        setVenues(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Partner data is unavailable right now. Please try again later.");
        setLoading(false);
      });
  }, []);

  const hasLocation = venues.some((v) => v.location);
  const hasGenres = venues.some((v) => v.genres);

  return (
    <main className="container section">
      <h2>Partner Venues</h2>
      <p>Venues from Team 4's artist platform.</p>

      {loading && <p>Loading venues...</p>}
      {error && <p>{error}</p>}

      {staleMinutes !== null && (
        <p>
          Team 4's API isn't answering right now, so these venues are from {staleMinutes} minute
          {staleMinutes === 1 ? "" : "s"} ago.
        </p>
      )}

      {!loading && !error && venues.length === 0 && <p>No venues found.</p>}

      {!loading && !error && venues.length > 0 && (
        <div className="glass" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr>
                <th style={{ padding: "15px" }}>Venue</th>
                {hasLocation && <th style={{ padding: "15px" }}>Location</th>}
                <th style={{ padding: "15px" }}>Capacity</th>
                {hasGenres && <th style={{ padding: "15px" }}>Genres</th>}
              </tr>
            </thead>
            <tbody>
              {venues.map((v) => (
                <tr key={v.id}>
                  <td style={{ padding: "15px" }}>{v.name}</td>
                  {hasLocation && <td style={{ padding: "15px" }}>{v.location}</td>}
                  <td style={{ padding: "15px" }}>{v.capacity.toLocaleString()}</td>
                  {hasGenres && <td style={{ padding: "15px" }}>{v.genres}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

export default Venues;
