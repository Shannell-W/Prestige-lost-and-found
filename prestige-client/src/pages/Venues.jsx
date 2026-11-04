import { useEffect, useState } from "react";
import { API_URL, apiFetch } from "../api";

// Venues from our upstream partner, Team 4 (Week 10).
// Our server fetches them and remembers them for a while, so the page still works while
// Team 4's server is waking up or down. Location and genres show only if Team 4 sends them.
// The Events column shows when shows were held (or will be) at each venue, from Team 4's bookings
// (our server combines them at /api/partner-events; see server/routes/partnerEvents.js).

const MAX_EVENTS_SHOWN = 3;

// "2026-09-15" -> "Tue 15 Sep 2026"
function formatDate(isoDate) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Today as "YYYY-MM-DD" in the viewer's own time zone, to tell past shows from upcoming ones.
function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Venues() {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [staleMinutes, setStaleMinutes] = useState(null);
  // Shows at each venue: { venueId: [{ id, date, artist, status }, ...] }, newest first.
  const [eventsByVenue, setEventsByVenue] = useState({});
  const [eventsAvailable, setEventsAvailable] = useState(true);

  useEffect(() => {
    apiFetch(`${API_URL}/api/partner-events`)
      .then((response) => {
        if (!response.ok) throw new Error("Partner events unavailable");
        return response.json();
      })
      .then((events) => {
        const grouped = {};
        events.forEach((e) => {
          (grouped[e.venueId] = grouped[e.venueId] || []).push(e);
        });
        setEventsByVenue(grouped);
      })
      .catch(() => setEventsAvailable(false)); // the venues still show, just without dates
  }, []);

  useEffect(() => {
    apiFetch(`${API_URL}/api/partner-venues`)
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
  const today = todayIso();

  return (
    <main className="container section">
      <h2>Partner Venues</h2>
      <p>
        Venues from Team 4's artist platform, with the dates of shows held there. Lost something at a concert
        or show? Check the date, then look for it on the Items page.
      </p>

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
                <th style={{ padding: "15px" }}>Events</th>
              </tr>
            </thead>
            <tbody>
              {venues.map((v) => (
                <tr key={v.id}>
                  <td style={{ padding: "15px" }}>{v.name}</td>
                  {hasLocation && <td style={{ padding: "15px" }}>{v.location}</td>}
                  <td style={{ padding: "15px" }}>{v.capacity.toLocaleString()}</td>
                  {hasGenres && <td style={{ padding: "15px" }}>{v.genres}</td>}
                  <td style={{ padding: "15px" }}>
                    {!eventsAvailable && "Not available right now"}
                    {eventsAvailable && !(eventsByVenue[v.id] || []).length && "No events yet"}
                    {eventsAvailable &&
                      (eventsByVenue[v.id] || []).slice(0, MAX_EVENTS_SHOWN).map((e) => (
                        <div key={e.id} style={{ marginBottom: "6px" }}>
                          <strong>{formatDate(e.date)}</strong>
                          {e.artist && ` · ${e.artist}`}
                          <div style={{ fontSize: "0.85em", opacity: 0.75 }}>
                            {e.date >= today ? "Upcoming" : "Held"}
                            {e.status === "Pending" && " (not confirmed yet)"}
                          </div>
                        </div>
                      ))}
                    {eventsAvailable && (eventsByVenue[v.id] || []).length > MAX_EVENTS_SHOWN && (
                      <div style={{ fontSize: "0.85em", opacity: 0.75 }}>
                        + {(eventsByVenue[v.id] || []).length - MAX_EVENTS_SHOWN} more
                      </div>
                    )}
                  </td>
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