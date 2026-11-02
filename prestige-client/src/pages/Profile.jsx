import { useEffect, useState } from "react";
import { API_URL, apiFetch } from "../api";
import Sidebar from "../components/Sidebar";

function Profile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [alertsEmail, setAlertsEmail] = useState(true);
  const [alertsSms, setAlertsSms] = useState(true);
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }

    apiFetch(`${API_URL}/api/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => {
        if (!response.ok) throw new Error("Failed to fetch profile");
        return response.json();
      })
      .then((data) => {
        setProfile(data);
        setPhone(data.phone || "");
        setAlertsEmail(Boolean(data.alerts_email));
        setAlertsSms(Boolean(data.alerts_sms));
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Could not load your profile.");
        setLoading(false);
      });
  }, []);

  async function saveAlerts(e) {
    e.preventDefault();
    setSaveMessage("");
    setSaving(true);
    try {
      const response = await apiFetch(`${API_URL}/api/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ phone, alertsEmail, alertsSms }),
      });
      const data = await response.json();
      if (!response.ok) {
        setSaveMessage(data.error || "Could not save.");
        return;
      }
      setProfile(data);
      setPhone(data.phone || "");
      setSaveMessage("Saved.");
    } catch (err) {
      console.error(err);
      setSaveMessage("Could not connect to the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />

      <main className="dashboard-main">
        <header className="dashboard-top glass">
          <h2>Profile</h2>
        </header>

        <section className="section">
          {loading && <p>Loading profile...</p>}
          {error && <p>{error}</p>}

          {!loading && !error && profile && (
            <div className="glass" style={{ padding: "20px", maxWidth: "400px" }}>
              <p><strong>Full Name:</strong> {profile.full_name}</p>
              <p><strong>Student ID:</strong> {profile.student_id}</p>
              <p><strong>School:</strong> {profile.school}</p>
              <p><strong>Email:</strong> {profile.email}</p>
              <p><strong>Joined:</strong> {new Date(profile.created_at).toLocaleDateString()}</p>
            </div>
          )}

          {!loading && !error && profile && (
            <form className="form glass" onSubmit={saveAlerts} style={{ padding: "20px", maxWidth: "400px", marginTop: "18px" }}>
              <h3>How should we tell you?</h3>
              <p className="muted">
                When a possible match is found, someone claims your item, or there's a new price offer, we notify you here.
                We can also email or text you, so you don't miss it.
              </p>

              <div className="field">
                <label htmlFor="phone">Phone for SMS (optional)</label>
                <input id="phone" type="tel" placeholder="e.g. 0712 345 678" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>

              <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input type="checkbox" checked={alertsEmail} onChange={(e) => setAlertsEmail(e.target.checked)} />
                Email me ({profile.email})
              </label>
              <label style={{ display: "flex", gap: "8px", alignItems: "center", margin: "8px 0 14px" }}>
                <input type="checkbox" checked={alertsSms} onChange={(e) => setAlertsSms(e.target.checked)} />
                Text me {phone ? "" : "(add a phone number first)"}
              </label>

              {saveMessage && <p>{saveMessage}</p>}
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}

export default Profile;