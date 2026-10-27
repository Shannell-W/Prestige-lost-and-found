import { useEffect, useState } from "react";
import { API_URL, apiFetch } from "../api";

function Profile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Could not load your profile.");
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
            <p>{profile?.school || "School Portal"}</p>
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
        </section>
      </main>
    </div>
  );
}

export default Profile;