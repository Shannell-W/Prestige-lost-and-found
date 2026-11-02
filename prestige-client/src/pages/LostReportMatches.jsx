import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { API_URL, apiFetch } from "../api";
import { ksh } from "../money";
import Sidebar from "../components/Sidebar";
import { StatusBadge } from "../labels";
import { imageSrc } from "../media";

// One of my lost reports, with the found items that look like it (best match first).
function LostReportMatches() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) {
      window.location.href = "/login";
      return;
    }
    load();
  }, [id]);

  async function load() {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [reportRes, matchesRes] = await Promise.all([
        apiFetch(`${API_URL}/api/lost-reports/${id}`, { headers }),
        apiFetch(`${API_URL}/api/lost-reports/${id}/matches`, { headers }),
      ]);
      if (!reportRes.ok || !matchesRes.ok) throw new Error("Failed to load lost report");
      setReport(await reportRes.json());
      setMatches(await matchesRes.json());
    } catch (err) {
      console.error(err);
      setError("Could not load this lost report.");
    } finally {
      setLoading(false);
    }
  }

  async function setStatus(status) {
    setActionMessage("");
    try {
      const response = await apiFetch(`${API_URL}/api/lost-reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) {
        setActionMessage(data.error || "Failed to update report.");
        return;
      }
      setReport(data);
      setActionMessage(status === "CLOSED" ? "Report closed. You won't get new match notifications." : "Report reopened.");
    } catch (err) {
      console.error(err);
      setActionMessage("Could not connect to the server.");
    }
  }

  const offer = Number(report?.reward_offered || 0);

  return (
    <div className="dashboard-layout">
      <Sidebar />

      <main className="dashboard-main">
        <header className="dashboard-top glass">
          <h2>Possible Matches</h2>
        </header>

        <section className="section">
          {loading && <p>Loading...</p>}
          {error && <p>{error}</p>}

          {report && (
            <div className="glass" style={{ padding: "20px", marginBottom: "20px" }}>
              <div className="toolbar" style={{ marginTop: 0 }}>
                <div>
                  <p className="muted">You lost</p>
                  <h3>{report.title}</h3>
                </div>
                <StatusBadge kind="report" status={report.status} />
              </div>
              <p>
                <strong>Category:</strong> {report.category}
                {report.location && <> &nbsp;|&nbsp; <strong>Where:</strong> {report.location}</>}
                &nbsp;|&nbsp; <strong>Date lost:</strong> {new Date(report.date_lost).toLocaleDateString()}
                &nbsp;|&nbsp; <strong>Your reward offer:</strong> {ksh(offer)}
              </p>
              {report.description && <p className="muted" style={{ marginTop: "8px" }}>{report.description}</p>}

              <div className="item-actions">
                {report.status === "OPEN" && (
                  <button className="btn btn-secondary sm" onClick={() => setStatus("CLOSED")}>
                    I found it, close this report
                  </button>
                )}
                {report.status === "CLOSED" && (
                  <button className="btn btn-secondary sm" onClick={() => setStatus("OPEN")}>
                    Reopen report
                  </button>
                )}
              </div>
              {actionMessage && <p style={{ marginTop: "10px" }}>{actionMessage}</p>}
            </div>
          )}

          {report && matches.length === 0 && (
            <div className="empty">
              <h3>No similar items found yet</h3>
              <p>
                {report.status === "OPEN"
                  ? "We'll notify you as soon as someone reports an item that looks like yours."
                  : "This report is not open, so you won't be notified about new items."}
              </p>
            </div>
          )}

          {matches.length > 0 && (
            <>
              <p style={{ marginBottom: "14px" }}>
                {matches.length === 1 ? "This found item looks" : `These ${matches.length} found items look`} like
                yours. Open one to check, then claim it with proof only the owner would know.
              </p>
              <div className="item-grid">
                {matches.map((m) => (
                  <article key={m.id} className="item-card glass" style={{ padding: "18px" }}>
                    {m.image_url && <img src={imageSrc(m.image_url)} alt={m.title} />}
                    <span className={`confidence-badge confidence-${m.confidence}`}>{m.confidence} match</span>
                    <h4 style={{ marginTop: "10px" }}>{m.title}</h4>
                    <p className="item-meta">
                      {m.category} · {m.location} · found {new Date(m.date_found).toLocaleDateString()}
                    </p>
                    {m.description && <p style={{ marginTop: "8px" }}>{m.description}</p>}
                    <p className="item-meta" style={{ marginTop: "8px" }}>
                      Similar: {m.matchedWords.join(", ")}
                    </p>
                    <p style={{ marginTop: "10px" }}>
                      <strong>Finder asks:</strong> {Number(m.reward_amount) > 0 ? ksh(m.reward_amount) : "no reward"}
                      <br />
                      <strong>You offered:</strong> {ksh(offer)}
                    </p>
                    <div className="item-actions">
                      {m.my_claim_status === "PENDING" && (
                        <span className="status-badge status-claimed">You claimed this. Waiting for the finder.</span>
                      )}
                      {m.my_claim_status === "APPROVED" && (
                        <span className="status-badge status-returned">Your claim was approved</span>
                      )}
                      {!m.my_claim_status && m.status === "CLAIMED" && (
                        <p className="muted" style={{ width: "100%" }}>
                          Someone else has claimed this. If it's yours, claim it too: the finder picks the real owner.
                        </p>
                      )}
                      {!m.my_claim_status && (
                        <a className="btn btn-primary sm" href={`/items/${m.id}${offer > 0 ? `?offer=${offer}` : ""}`}>
                          This is mine, claim it
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default LostReportMatches;
