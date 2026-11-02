import { useState } from "react";
import { APP_CONFIG } from "../config";
import { API_URL, apiFetch } from "../api";
import Sidebar from "../components/Sidebar";

// A student announces something they lost. If similar found items already exist they go
// straight to them; otherwise they're told they'll be notified when one is reported.
function ReportLost() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [dateLost, setDateLost] = useState("");
  const [rewardOffered, setRewardOffered] = useState("");

  const [message, setMessage] = useState("");
  const [savedId, setSavedId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");

    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }

    setSubmitting(true);

    try {
      const response = await apiFetch(`${API_URL}/api/lost-reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, description, category, location, dateLost, rewardOffered: rewardOffered || 0 }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Failed to report lost item.");
        setSubmitting(false);
        return;
      }

      if (data.matches.length > 0) {
        // Similar items were already found: show them right away.
        window.location.href = `/lost-reports/${data.lostReportId}`;
        return;
      }

      setSavedId(data.lostReportId);
      setSubmitting(false);
    } catch (error) {
      console.error(error);
      setMessage("Could not connect to the server.");
      setSubmitting(false);
    }
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />

      <main className="dashboard-main">
        <header className="dashboard-top glass">
          <h2>Report Lost Item</h2>
        </header>

        <section className="section">
          {savedId ? (
            <div className="glass" style={{ padding: "24px" }}>
              <h3>Your lost item has been reported</h3>
              <p style={{ margin: "10px 0 18px" }}>
                Nothing similar has been found yet. We'll send you a notification as soon as someone reports an
                item that looks like yours.
              </p>
              <div className="item-actions">
                <a className="btn btn-primary" href={`/lost-reports/${savedId}`}>View my report</a>
                <a className="btn btn-secondary" href="/items">Browse found items</a>
              </div>
            </div>
          ) : (
            <form className="form glass" style={{ padding: "24px" }} onSubmit={handleSubmit}>
              <p className="muted">
                Describe what you lost. We'll show you found items that look similar, and notify you if one is
                reported later.
              </p>

              <div className="field">
                <label htmlFor="title">What did you lose?</label>
                <input
                  id="title"
                  type="text"
                  placeholder="e.g. Black HP laptop"
                  required
                  maxLength={150}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  placeholder="Colour, brand, stickers, what was inside... Keep one secret detail to yourself to prove it's yours when you claim it."
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="category">Category</label>
                <select id="category" required value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">Select category</option>
                  {APP_CONFIG.categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="location">Where do you think you lost it? (optional)</label>
                <input
                  id="location"
                  type="text"
                  placeholder="e.g. Library, 2nd floor"
                  maxLength={150}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="dateLost">Date lost</label>
                <input
                  id="dateLost"
                  type="date"
                  required
                  max={today}
                  value={dateLost}
                  onChange={(e) => setDateLost(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="rewardOffered">Reward you're offering the finder, KSh (optional)</label>
                <input
                  id="rewardOffered"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={rewardOffered}
                  onChange={(e) => setRewardOffered(e.target.value)}
                />
              </div>

              {message && <p>{message}</p>}

              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? "Searching..." : "Report & Find Matches"}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}

export default ReportLost;
