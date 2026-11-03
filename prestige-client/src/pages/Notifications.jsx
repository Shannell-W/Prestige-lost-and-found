import { useEffect, useState } from "react";
import { API_URL, apiFetch } from "../api";
import Sidebar from "../components/Sidebar";

function Notifications() {
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
        // They've now been seen. The ones that were unread keep their "New" label until the page is left.
        if (data.some((n) => !n.is_read)) {
          apiFetch(`${API_URL}/api/notifications/read-all`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          }).catch((err) => console.error(err));
        }
      })
      .catch((err) => {
        console.error(err);
        setError("Could not load notifications.");
        setLoading(false);
      });
  }, []);

  return (
    <div className="dashboard-layout">
      <Sidebar />

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
                  <p style={{ margin: 0 }}>
                    {!n.is_read && (
                      <span className="status-badge status-claimed" style={{ marginRight: "8px", padding: "2px 8px" }}>New</span>
                    )}
                    {n.message}
                  </p>
                  {n.lost_report_id && (
                    <a className="link" href={`/lost-reports/${n.lost_report_id}`} style={{ display: "inline-block", margin: "4px 12px 0 0" }}>
                      {n.item_id ? "Compare with my report →" : "View my report →"}
                    </a>
                  )}
                  {n.item_id && (
                    <a className="link" href={`/items/${n.item_id}`} style={{ display: "inline-block", margin: "4px 12px 0 0" }}>
                      View item →
                    </a>
                  )}
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