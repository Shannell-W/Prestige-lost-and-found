import { useEffect, useState } from "react";
import { API_URL, apiFetch } from "../api";

// The number of unread notifications, shown next to "Notifications" in the sidebar. Hidden when 0.
function UnreadBadge() {
  const [count, setCount] = useState(0);

  // Opening the Notifications page marks everything read, so no badge there.
  const onNotificationsPage = window.location.pathname === "/notifications";

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || onNotificationsPage) return;
    apiFetch(`${API_URL}/api/notifications/unread-count`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => (response.ok ? response.json() : { count: 0 }))
      .then((data) => setCount(data.count || 0))
      .catch(() => setCount(0));
  }, [onNotificationsPage]);

  if (count === 0) return null;
  return (
    <span className="notif-badge" style={{ position: "static", display: "inline-grid", marginLeft: "8px" }} aria-label={`${count} unread`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default UnreadBadge;
