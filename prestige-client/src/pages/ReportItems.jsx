import { useState } from "react";
import { APP_CONFIG } from "../config";
import { API_URL } from "../api";

function ReportItems() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [dateFound, setDateFound] = useState("");
  const [rewardAmount, setRewardAmount] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      const response = await fetch(`${API_URL}/api/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description,
          category,
          location,
          dateFound,
          rewardAmount: rewardAmount || 0,
          imageUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Failed to report item.");
        setSubmitting(false);
        return;
      }

      window.location.href = "/items";
    } catch (error) {
      console.error(error);
      setMessage("Could not connect to the server.");
      setSubmitting(false);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/";
  }

  const user = JSON.parse(localStorage.getItem("user"));

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
          <h2>Report Found Item</h2>
        </header>

        <section className="section">
          <form className="form glass" style={{ padding: "24px" }} onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="title">Item Title</label>
              <input
                id="title"
                type="text"
                placeholder="e.g. Black HP Laptop"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                placeholder="General description (avoid identifying details only the owner would know)"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="category">Category</label>
              <select
                id="category"
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Select category</option>
                {APP_CONFIG.categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="location">Location Found</label>
              <input
                id="location"
                type="text"
                placeholder="e.g. Library, 2nd floor"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="dateFound">Date Found</label>
              <input
                id="dateFound"
                type="date"
                required
                value={dateFound}
                onChange={(e) => setDateFound(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="rewardAmount">Reward Amount (optional)</label>
              <input
                id="rewardAmount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={rewardAmount}
                onChange={(e) => setRewardAmount(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="imageUrl">Image URL (optional)</label>
              <input
                id="imageUrl"
                type="text"
                placeholder="https://..."
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
            </div>

            {message && <p>{message}</p>}

            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Report Item"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

export default ReportItems;