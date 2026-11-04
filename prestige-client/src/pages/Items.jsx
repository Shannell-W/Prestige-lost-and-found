import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { API_URL, apiFetch } from "../api";
import { APP_CONFIG } from "../config";
import { StatusBadge, statusLabel } from "../labels";
import Sidebar from "../components/Sidebar";
import PlaceSuggestions from "../components/PlaceSuggestions";

// Filters start on the student's own school (everything, if not logged in).
function initialFilters() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  return { search: "", category: "", location: "", status: "", school: user?.school || "", dateFrom: "", dateTo: "" };
}

function Items() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(initialFilters);

  function setFilter(name, value) {
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  useEffect(() => {
    // Wait a moment after typing before asking the server.
    const timer = setTimeout(() => {
      const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== "")).toString();
      setLoading(true);
      setError("");
      apiFetch(`${API_URL}/api/items${query ? `?${query}` : ""}`)
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
    }, 300);
    return () => clearTimeout(timer);
  }, [filters]);

  // Logged in: the same sidebar as the rest of the portal. Logged out: the public header.
  const loggedIn = Boolean(localStorage.getItem("token"));

  const content = (
    <>
        <h2 className="section-title">Found Items</h2>

        <p style={{ marginBottom: "14px" }}>
          Lost something and can't see it here? <a className="link" href="/report-lost">Report it as lost</a> and
          we'll notify you when a similar item is found.
        </p>

        <div className="glass" style={{ padding: "16px", marginBottom: "18px" }}>
          <div className="field" style={{ marginBottom: "12px" }}>
            <label htmlFor="search">Search</label>
            <input
              id="search"
              type="search"
              placeholder="e.g. black backpack, Casio, keys..."
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
            />
          </div>

          <div className="filters" style={{ marginBottom: 0 }}>
            <div className="field">
              <label htmlFor="category">Category</label>
              <select id="category" value={filters.category} onChange={(e) => setFilter("category", e.target.value)}>
                <option value="">All categories</option>
                {APP_CONFIG.categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="status">Status</label>
              <select id="status" value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
                <option value="">Any status</option>
                {APP_CONFIG.statuses.map((st) => (
                  <option key={st} value={st}>{statusLabel("item", st)}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="school">School</label>
              <select id="school" value={filters.school} onChange={(e) => setFilter("school", e.target.value)}>
                <option value="">All schools</option>
                {APP_CONFIG.schools.map((sc) => (
                  <option key={sc} value={sc}>{sc}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="locationFilter">Location</label>
              <input
                id="locationFilter"
                type="text"
                list="place-suggestions"
                placeholder="e.g. Library or a venue"
                value={filters.location}
                onChange={(e) => setFilter("location", e.target.value)}
              />
              <PlaceSuggestions id="place-suggestions" showNote={false} />
            </div>

            <div className="field">
              <label htmlFor="dateFrom">Found from</label>
              <input id="dateFrom" type="date" value={filters.dateFrom} onChange={(e) => setFilter("dateFrom", e.target.value)} />
            </div>

            <div className="field">
              <label htmlFor="dateTo">Found until</label>
              <input id="dateTo" type="date" value={filters.dateTo} onChange={(e) => setFilter("dateTo", e.target.value)} />
            </div>

            <div className="field" style={{ alignSelf: "end" }}>
              <button type="button" className="btn btn-secondary" onClick={() => setFilters(initialFilters())}>
                Clear filters
              </button>
            </div>
          </div>
        </div>

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
                      <StatusBadge kind="item" status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <p>No found items match these filters.</p>
        )}
    </>
  );

  if (loggedIn) {
    return (
      <div className="dashboard-layout">
        <Sidebar />
        <main className="dashboard-main">
          <section className="section">{content}</section>
        </main>
      </div>
    );
  }

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

      <main className="container section">{content}</main>
    </>
  );
}

export default Items;