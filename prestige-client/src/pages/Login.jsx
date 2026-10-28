import { APP_CONFIG } from '../config';
import { useState } from 'react';
import { API_URL, apiFetch } from "../api";

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [school, setSchool] = useState('');

  async function handleLogin(e) {
    e.preventDefault();

    try {
      const response = await apiFetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ school, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Login failed");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      window.location.href = "/dashboard";
    } catch (error) {
      console.error(error);
      alert("Could not connect to the server.");
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card glass">
        <div className="auth-header">
          <div className="brand-mark lg">CLF</div>
          <p>Login to enter your school portal.</p>
        </div>

        <div className="field">
          <label htmlFor="school">School Selector</label>
          <select
            id="school"
            required
            value={school}
            onChange={(e) => setSchool(e.target.value)}
          >
            <option value="">Select school</option>
            {APP_CONFIG.schools.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <form className="form" onSubmit={handleLogin}>
          <div className="field">
            <label htmlFor="email">Student Email</label>
            <input
              id="email"
              type="email"
              placeholder="student@school.edu"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Enter password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button className="btn btn-primary full" type="submit">Login</button>
        </form>

        <div className="auth-footer">
          <p><a href="/register">Create an account</a></p>
        </div>
      </section>
    </main>
  );
}

export default Login;