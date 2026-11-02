import { useEffect, useState } from "react";
import { API_URL, apiFetch } from "../api";

function Home() {
  // Real numbers from the server; the cards show "—" until they arrive (or if the server is down).
  const [stats, setStats] = useState(null);
  useEffect(() => {
    apiFetch(`${API_URL}/api/statistics/summary`)
      .then((response) => (response.ok ? response.json() : null))
      .then(setStats)
      .catch(() => setStats(null));
  }, []);
  const show = (n) => (stats ? Number(n).toLocaleString() : "—");

  return (
    <>
      <header className="topbar glass">
        <div className="container nav">
          <div className="brand">
            <div className="brand-mark">CLF</div>
            <div>
              <h1>Campus Lost & Found</h1>
              <p>Student recovery network</p>
            </div>
          </div>
          <div className="nav-actions">
            <a href="/login" className="btn btn-outline">Login</a>
            <a href="/register" className="btn btn-primary">Register</a>
          </div>
        </div>
      </header>

      <main>
        <section className="hero container">
          <div className="hero-copy fade-in">
            <span className="pill">Trusted by student communities</span>
            <h2>Recover lost items faster on your campus.</h2>
            <p>
              Browse found items, report discoveries, submit ownership claims,
              and let finders review evidence securely within each school portal.
            </p>
            <div className="hero-actions">
              <a href="/report-lost" className="btn btn-primary">I lost something</a>
              <a href="/report" className="btn btn-secondary">I found something</a>
            </div>
            <p className="muted" style={{ marginTop: "12px" }}>
              New here? <a className="link" href="/register">Create an account</a> or{" "}
              <a className="link" href="/items">browse found items</a>.
            </p>
          </div>
          <div className="hero-card glass fade-in delay-1">
            <h3>How it works</h3>
            <ul>
              <li>1. Sign up with your student account</li>
              <li>2. Enter your school portal</li>
              <li>3. Lost something? Report it: we show similar found items and text you when one turns up</li>
              <li>4. Found something? Post a photo in 30 seconds</li>
              <li>5. The owner proves it's theirs; the finder approves and you agree a reward</li>
            </ul>
          </div>
        </section>

        <section className="container section">
          <h3 className="section-title">Why students use it</h3>
          <div className="grid-3">
            <article className="feature-card glass fade-in">
              <h4>School-Specific Access</h4>
              <p>Students only see items from their selected school portal.</p>
            </article>
            <article className="feature-card glass fade-in delay-1">
              <h4>Evidence-Based Claims</h4>
              <p>Ownership claims include identifying proof and optional images.</p>
            </article>
            <article className="feature-card glass fade-in delay-2">
              <h4>Finder Control</h4>
              <p>The student who found the item reviews claims and selects the owner.</p>
            </article>
          </div>
        </section>

        <section className="container section">
          <h3 className="section-title">How it works</h3>
          <div className="grid-4">
            <div className="step-card glass"><span>01</span><h4>Create Account</h4><p>Register with school details.</p></div>
            <div className="step-card glass"><span>02</span><h4>Choose School</h4><p>Enter your campus-specific portal.</p></div>
            <div className="step-card glass"><span>03</span><h4>Report / Browse</h4><p>Post found items or search the database.</p></div>
            <div className="step-card glass"><span>04</span><h4>Claim & Return</h4><p>Submit evidence and retrieve your item.</p></div>
          </div>
        </section>

        <section className="container section">
          <h3 className="section-title">Platform statistics</h3>
          <div className="stats-grid">
            <div className="stat glass"><strong>{show(stats?.itemsPosted)}</strong><span>Items Posted</span></div>
            <div className="stat glass"><strong>{show(stats?.itemsReturned)}</strong><span>Items Returned</span></div>
            <div className="stat glass"><strong>{show(stats?.studentsLooking)}</strong><span>Students Looking Now</span></div>
            <div className="stat glass"><strong>{show(stats?.schools)}</strong><span>Schools</span></div>
          </div>
        </section>

        <section className="container cta glass section">
          <h3>Ready to help students recover what matters?</h3>
          <p>Create an account and join your school's Lost & Found network.</p>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <p>© 2026 Campus Lost & Found</p>
        </div>
      </footer>
    </>
  );
}

export default Home;