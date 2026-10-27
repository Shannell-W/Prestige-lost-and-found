import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { API_URL } from "../api";

function Items() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/api/items`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch items");
        }
        return response.json();
      })
      .then((data) => {
        setItems(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Could not load found items.");
        setLoading(false);
      });
  }, []);

  return (
    <>
      <header className="topbar glass">
        <div className="container nav">
          <div className="brand">
            <div className="brand-mark">CLF</div>

            <div>
              <h1>Campus Lost & Found</h1>
              <p>Student recovery network</p>
            </div>
          </div>

          <div className="nav-actions">
            <a href="/" className="btn btn-outline">
              Home
            </a>

            <a href="/login" className="btn btn-primary">
              Login
            </a>
          </div>
        </div>
      </header>

      <main className="container section">
        <h2 className="section-title">Found Items</h2>

        {loading && <p>Loading items...</p>}

        {error && <p>{error}</p>}

        {!loading && !error && (
          <div className="glass" style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
              }}
            >
              <thead>
                <tr>
                  <th style={{ padding: "15px" }}>ID</th>
                  <th style={{ padding: "15px" }}>Item</th>
                  <th style={{ padding: "15px" }}>Category</th>
                  <th style={{ padding: "15px" }}>Location</th>
                  <th style={{ padding: "15px" }}>Date Found</th>
                  <th style={{ padding: "15px" }}>Status</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td style={{ padding: "15px" }}>{item.id}</td>

<td style={{ padding: "15px" }}>
  <Link to={`/items/${item.id}`}>{item.title}</Link>
</td>

                    <td style={{ padding: "15px" }}>
                      {item.category}
                    </td>

                    <td style={{ padding: "15px" }}>
                      {item.location}
                    </td>

                    <td style={{ padding: "15px" }}>
                      {new Date(item.date_found).toLocaleDateString()}
                    </td>

                    <td style={{ padding: "15px" }}>
                      {item.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <p>No found items available.</p>
        )}
      </main>
    </>
  );
}

export default Items;