import { useEffect, useState } from "react";
import { API_URL, apiFetch } from "../api";

function Notifications() {
  const user = JSON.parse(localStorage.getItem("user"));
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      window.location.href = "/login";
      return;
    }

    apiFetch(`${API_URL}/api/notifications`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch notifications");
        }
        return response.json();
      })
      .then((data) => {
        setNotifications(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Could not load notifications.");
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
          <h2>Notifications</h2>
        </header>

        <section className="section">
          {loading && <p>Loading notifications...</p>}
          {error && <p>{error}</p>}

          {!loading && !error && notifications.length === 0 && (
            <p>You have no notifications yet.</p>
          )}

          {!loading && !error && notifications.length > 0 && (
            <div className="glass" style={{ padding: "10px" }}>
              {notifications.map((n) => (
                <div
                  key={n.id}
                  style={{
                    padding: "14px 16px",
                    borderBottom: "1px solid rgba(255,255,255,0.1)",
                    opacity: n.is_read ? 0.6 : 1,
                  }}
                >
                  <p style={{ margin: 0 }}>{n.message}</p>
                  <small>
                    {new Date(n.created_at).toLocaleString()}
                  </small>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Notifications;