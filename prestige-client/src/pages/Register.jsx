import { useState } from "react";
import { APP_CONFIG } from "../config";
import { API_URL } from "../api";

function Register() {
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [school, setSchool] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleRegister(e) {
    e.preventDefault();
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/api/auth/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            studentId,
            school,
            email,
            password,
            confirmPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Registration failed");
        return;
      }

      setMessage("Registration successful! You can now log in.");

      setName("");
      setStudentId("");
      setSchool("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error(error);
      setMessage("Could not connect to the server.");
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card glass">
        <div className="auth-header">
          <div className="brand-mark lg">CLF</div>
          <h1>Create Account</h1>
          <p>Join your school's Lost & Found network.</p>
        </div>

        <form className="form" onSubmit={handleRegister}>
          <div className="field">
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              placeholder="Enter name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="studentId">Student ID</label>
            <input
              id="studentId"
              type="text"
              placeholder="Enter ID"
              required
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="school">School</label>
            <select
              id="school"
              required
              value={school}
              onChange={(e) => setSchool(e.target.value)}
            >
              <option value="">Select school</option>

              {APP_CONFIG.schools.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="email">Student Email</label>
            <input
              id="email"
              type="email"
              placeholder="name@school.edu"
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
              placeholder="Create strong password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="confirmPassword">
              Confirm Password
            </label>

            <input
              id="confirmPassword"
              type="password"
              placeholder="Confirm password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {message && <p>{message}</p>}

          <button className="btn btn-primary full" type="submit">
            Register
          </button>
        </form>
      </section>
    </main>
  );
}

export default Register;