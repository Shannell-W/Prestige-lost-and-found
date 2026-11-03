import Sidebar from "../components/Sidebar";

function Dashboard() {
  const user = JSON.parse(localStorage.getItem("user"));

  return (
    <div className="dashboard-layout">
      <Sidebar />

      <main className="dashboard-main">
        <header className="dashboard-top glass">
          <h2>Welcome, {user?.name || "Student"} 👋</h2>
        </header>

        <section className="section">
          <h2>Dashboard</h2>

          <div className="grid-3">
            <a href="/report-lost" className="feature-card glass">
              <h3>I lost something</h3>
              <p>Tell us what you lost. We'll show similar found items and alert you when one turns up.</p>
            </a>

            <a href="/report" className="feature-card glass">
              <h3>I found something</h3>
              <p>Post it with a photo in 30 seconds and help someone get it back.</p>
            </a>

            <a href="/items" className="feature-card glass">
              <h3>Browse Items</h3>
              <p>Search found items.</p>
            </a>

            <a href="/claims" className="feature-card glass">
              <h3>My Claims</h3>
              <p>Track your ownership claims.</p>
            </a>

            <a href="/lost-reports" className="feature-card glass">
              <h3>My Lost Reports</h3>
              <p>See possible matches for things you lost.</p>
            </a>

            <a href="/posted" className="feature-card glass">
              <h3>My Posted Items</h3>
              <p>Review claims on things you found.</p>
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Dashboard;