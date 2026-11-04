import { useEffect, useState } from "react";
import { APP_CONFIG } from "../config";
import { API_URL, apiFetch } from "../api";
import { shrinkImage, imageSrc } from "../media";
import Sidebar from "../components/Sidebar";
import PlaceSuggestions from "../components/PlaceSuggestions";

// Report a found item. Made for a phone, in about 30 seconds: photo, what, where, and where the owner
// collects it. Everything else is optional and folded away under "More details".
function ReportItems() {
  const today = new Date().toISOString().slice(0, 10);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [dateFound, setDateFound] = useState(today);
  const [rewardAmount, setRewardAmount] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [handover, setHandover] = useState("FINDER");
  const [handoverNote, setHandoverNote] = useState("");
  const [checkQuestion, setCheckQuestion] = useState("");

  const [photoStatus, setPhotoStatus] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null); // { itemId, lookingCount }

  useEffect(() => {
    if (!localStorage.getItem("token")) window.location.href = "/login?next=/report";
  }, []);

  async function handlePhoto(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setPhotoStatus("Uploading photo...");
    try {
      const image = await shrinkImage(file);
      const response = await apiFetch(`${API_URL}/api/uploads`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ image }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed");
      setImageUrl(data.url);
      setPhotoStatus("");
    } catch (err) {
      console.error(err);
      setPhotoStatus(err.message || "Could not upload the photo. You can still report the item without it.");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");

    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login?next=/report";
      return;
    }

    setSubmitting(true);

    try {
      const response = await apiFetch(`${API_URL}/api/items`, {
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
          handover,
          handoverNote,
          checkQuestion,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Failed to report item.");
        setSubmitting(false);
        return;
      }

      setDone({ itemId: data.itemId, lookingCount: data.lookingCount || 0 });
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
          <h2>I Found Something</h2>
        </header>

        <section className="section">
          {done ? (
            <div className="glass" style={{ padding: "24px" }}>
              <h3>Thank you! The item is posted.</h3>
              <p style={{ margin: "10px 0 18px" }}>
                {done.lookingCount > 0
                  ? `${done.lookingCount} student${done.lookingCount === 1 ? " is" : "s are"} looking for something like this. We've notified them.`
                  : "Nobody has reported losing something like this yet. We'll show it to anyone who does."}{" "}
                You'll get a notification when someone claims it.
              </p>
              <div className="item-actions">
                <a className="btn btn-primary" href={`/items/${done.itemId}`}>View the item</a>
                <a className="btn btn-secondary" href="/posted">My posted items</a>
                <a className="btn btn-secondary" href="/report">Report another</a>
              </div>
            </div>
          ) : (
            <form className="form glass" style={{ padding: "24px" }} onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="photo">Photo (recommended)</label>
                <input id="photo" type="file" accept="image/*" capture="environment" onChange={handlePhoto} />
                {photoStatus && <p className="muted">{photoStatus}</p>}
                {imageUrl && (
                  <img src={imageSrc(imageUrl)} alt="Your photo" style={{ maxWidth: "220px", borderRadius: "12px", marginTop: "8px" }} />
                )}
              </div>

              <div className="field">
                <label htmlFor="title">What did you find?</label>
                <input
                  id="title"
                  type="text"
                  placeholder="e.g. Black HP laptop"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
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
                <label htmlFor="location">Where did you find it?</label>
                <input
                  id="location"
                  type="text"
                  list="place-suggestions"
                  placeholder="Start typing, e.g. Library"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
                <PlaceSuggestions id="place-suggestions" />
              </div>

              <div className="field">
                <label htmlFor="dateFound">Date found</label>
                <input
                  id="dateFound"
                  type="date"
                  required
                  max={today}
                  value={dateFound}
                  onChange={(e) => setDateFound(e.target.value)}
                />
              </div>

              <fieldset style={{ border: "none", padding: 0, margin: "0 0 14px" }}>
                <legend style={{ fontWeight: 700, marginBottom: "8px" }}>Where can the owner collect it?</legend>
                <label style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px" }}>
                  <input type="radio" style={{ width: "auto", flex: "none" }} name="handover" value="SECURITY" checked={handover === "SECURITY"} onChange={() => setHandover("SECURITY")} />
                  I handed it to campus security (safest, no need to meet)
                </label>
                <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input type="radio" style={{ width: "auto", flex: "none" }} name="handover" value="FINDER" checked={handover === "FINDER"} onChange={() => setHandover("FINDER")} />
                  I'll keep it and meet the owner
                </label>
              </fieldset>

              <div className="field">
                <label htmlFor="handoverNote">Pickup details (only shown to the owner after you approve them)</label>
                <input
                  id="handoverNote"
                  type="text"
                  maxLength={255}
                  placeholder={handover === "SECURITY" ? "e.g. Security desk at the main gate" : "e.g. Usually at the library 2-5pm weekdays"}
                  value={handoverNote}
                  onChange={(e) => setHandoverNote(e.target.value)}
                />
              </div>

              <details style={{ margin: "6px 0 14px" }}>
                <summary style={{ cursor: "pointer", fontWeight: 700 }}>More details (optional)</summary>

                <div className="field" style={{ marginTop: "12px" }}>
                  <label htmlFor="checkQuestion">A question only the owner can answer</label>
                  <input
                    id="checkQuestion"
                    type="text"
                    maxLength={255}
                    placeholder="e.g. What is on the keychain? What's the lock-screen photo?"
                    value={checkQuestion}
                    onChange={(e) => setCheckQuestion(e.target.value)}
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
                  <label htmlFor="rewardAmount">Reward you'd like, KSh</label>
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
              </details>

              {message && <p>{message}</p>}

              <button className="btn btn-primary" type="submit" disabled={submitting || photoStatus === "Uploading photo..."}>
                {submitting ? "Posting..." : "Post Found Item"}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}

export default ReportItems;
