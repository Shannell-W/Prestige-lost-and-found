import UnreadBadge from "./UnreadBadge";

// The logged-in sidebar, shared by every portal page (one place to add a link).
function Sidebar() {
  const user = JSON.parse(localStorage.getItem("user"));

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/";
  }

  return (
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
        <a href="/report-lost">I Lost Something</a>
        <a href="/report">I Found Something</a>
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
  );
}

export default Sidebar;
