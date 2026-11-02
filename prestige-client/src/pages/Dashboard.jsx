import UnreadBadge from "../components/UnreadBadge";

function Dashboard() {
  const user = JSON.parse(localStorage.getItem("user"));

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
          <a href="/report-lost">Report Lost Item</a>
          <a href="/lost-reports">My Lost Reports</a>
          <a href="/claims">My Claims</a>
          <a href="/posted">My Posted Items</a>
          <a href="/notifications">Notifications<UnreadBadge /></a>
          <a href="/profile">Profile</a>

          <button className="side-link danger" onClick={logout}>
            Logout
          </button>
        </nav>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-top glass">
          <h2>Welcome, {user?.name || "Student"} 👋</h2>
        </header>

        <section className="section">
          <h2>Dashboard</h2>

          <div className="grid-3">
            <a href="/items" className="feature-card glass">
              <h3>Browse Items</h3>
              <p>Search found items.</p>
            </a>

            <a href="/report" className="feature-card glass">
              <h3>Report Found Item</h3>
              <p>Help someone recover their belongings.</p>
            </a>

            <a href="/claims" className="feature-card glass">
              <h3>My Claims</h3>
              <p>Track your ownership claims.</p>
            </a>

            <a href="/report-lost" className="feature-card glass">
              <h3>Report Lost Item</h3>
              <p>Tell us what you lost. We'll show similar found items and notify you.</p>
            </a>

            <a href="/lost-reports" className="feature-card glass">
              <h3>My Lost Reports</h3>
              <p>See possible matches for things you lost.</p>
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Dashboard;