import { useEffect, useState } from "react";

function Venues() {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("http://localhost:5000/api/partner-venues")
      .then((response) => {
        if (!response.ok) throw new Error("Partner data unavailable");
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

  return (
    <main className="container section">
      <h2>Partner Venues</h2>

      {loading && <p>Loading venues...</p>}
      {error && <p>{error}</p>}

      {!loading && !error && venues.length === 0 && <p>No venues found.</p>}

      {!loading && !error && venues.length > 0 && (
        <div className="glass" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr>
                <th style={{ padding: "15px" }}>Venue</th>
                <th style={{ padding: "15px" }}>Location</th>
                <th style={{ padding: "15px" }}>Capacity</th>
                <th style={{ padding: "15px" }}>Genres</th>
              </tr>
            </thead>
            <tbody>
              {venues.map((v) => (
                <tr key={v.id}>
                  <td style={{ padding: "15px" }}>{v.venueName}</td>
                  <td style={{ padding: "15px" }}>{v.location}</td>
                  <td style={{ padding: "15px" }}>{v.capacity}</td>
                  <td style={{ padding: "15px" }}>{v.supportedGenres}</td>
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