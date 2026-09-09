import { useEffect, useState } from "react";

function Claims() {
  const user = JSON.parse(localStorage.getItem("user"));
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }

    fetch("http://localhost:5000/api/claims", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => {
        if (!response.ok) throw new Error("Failed to fetch claims");
        return response.json();
      })
      .then((data) => {
        setClaims(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Could not load your claims.");
        setLoading(false);
      });
  }, []);

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/";
  }

  return (
    <div className="dashboard-layout">
      <aside className="sidebar glass">
        <div className="sidebar-brand">
          <div className="brand-mark">CLF</div>
          <div>
            <strong>Campus Lost & Found</strong>
            <p>{user?.school || "School Portal"}</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <a href="/dashboard">Dashboard</a>
          <a href="/items">Browse Items</a>
          <a href="/report">Report Found Item</a>
          <a href="/claims">My Claims</a>
          <a href="/posted">My Posted Items</a>
          <a href="/notifications">Notifications</a>
          <a href="/profile">Profile</a>
          <button className="side-link danger" onClick={logout}>
            Logout
          </button>
        </nav>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-top glass">
          <h2>My Claims</h2>
        </header>

        <section className="section">
          {loading && <p>Loading claims...</p>}
          {error && <p>{error}</p>}
          {!loading && !error && claims.length === 0 && (
            <p>You haven't submitted any claims yet.</p>
          )}

          {!loading && !error && claims.length > 0 && (
            <div className="glass" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr>
                    <th style={{ padding: "15px" }}>Item</th>
                    <th style={{ padding: "15px" }}>Category</th>
                    <th style={{ padding: "15px" }}>Location</th>
                    <th style={{ padding: "15px" }}>Status</th>
                    <th style={{ padding: "15px" }}>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((c) => (
                    <tr key={c.id}>
                      <td style={{ padding: "15px" }}>{c.title}</td>
                      <td style={{ padding: "15px" }}>{c.category}</td>
                      <td style={{ padding: "15px" }}>{c.location}</td>
                      <td style={{ padding: "15px" }}>{c.status}</td>
                      <td style={{ padding: "15px" }}>
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Claims;