import { useEffect, useState } from "react";
import { API_URL, apiFetch } from "../api";
import { ksh } from "../money";
import Sidebar from "../components/Sidebar";
import { StatusBadge } from "../labels";

function MyLostReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }

    apiFetch(`${API_URL}/api/lost-reports`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => {
        if (!response.ok) throw new Error("Failed to fetch lost reports");
        return response.json();
      })
      .then((data) => {
        setReports(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Could not load your lost reports.");
        setLoading(false);
      });
  }, []);

  return (
    <div className="dashboard-layout">
      <Sidebar />

      <main className="dashboard-main">
        <header className="dashboard-top glass">
          <h2>My Lost Reports</h2>
        </header>

        <section className="section">
          {loading && <p>Loading your lost reports...</p>}
          {error && <p>{error}</p>}

          {!loading && !error && reports.length === 0 && (
            <div className="empty">
              <p>You haven't reported anything lost.</p>
              <a className="btn btn-primary" href="/report-lost" style={{ marginTop: "12px", display: "inline-block" }}>
                Report a lost item
              </a>
            </div>
          )}

          {reports.map((r) => (
            <a
              key={r.id}
              href={`/lost-reports/${r.id}`}
              className="glass"
              style={{ display: "block", padding: "16px", marginBottom: "14px", color: "inherit", textDecoration: "none" }}
            >
              <div className="toolbar" style={{ marginTop: 0, marginBottom: "6px" }}>
                <h3>{r.title}</h3>
                <StatusBadge kind="report" status={r.status} />
              </div>
              <p className="item-meta">
                {r.category} · lost {new Date(r.date_lost).toLocaleDateString()}
                {r.location && ` · ${r.location}`} · reward offered {ksh(r.reward_offered)}
              </p>
              {r.status === "OPEN" && (
                <p style={{ marginTop: "8px" }}>
                  {r.match_count > 0
                    ? `${r.match_count} possible match${r.match_count === 1 ? "" : "es"}. Open to check.`
                    : "No match yet. We'll notify you when a similar item is found."}
                </p>
              )}
            </a>
          ))}
        </section>
      </main>
    </div>
  );
}

export default MyLostReports;
