import { useEffect, useState } from "react";
import { API_URL, apiFetch } from "../api";

function Posted() {
  const user = JSON.parse(localStorage.getItem("user"));
  const [items, setItems] = useState([]);
  const [claimsByItem, setClaimsByItem] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) {
      window.location.href = "/login";
      return;
    }
    loadItems();
  }, []);

  async function loadItems() {
    try {
      const response = await apiFetch(`${API_URL}/api/my-items`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setItems(data);
      setLoading(false);

      const claimedItems = data.filter((i) => i.status === "CLAIMED");
      for (const item of claimedItems) {
        loadClaimsForItem(item.id);
      }
    } catch (err) {
      console.error(err);
      setError("Could not load your posted items.");
      setLoading(false);
    }
  }

  async function loadClaimsForItem(itemId) {
    try {
      const response = await apiFetch(
        `${API_URL}/api/items/${itemId}/claims`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      setClaimsByItem((prev) => ({ ...prev, [itemId]: data }));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleReview(claimId, status, itemId) {
    setActionMessage("");
    try {
      const response = await apiFetch(
        `${API_URL}/api/claims/${claimId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setActionMessage(data.error || "Failed to update claim.");
        return;
      }

      setActionMessage(`Claim ${status.toLowerCase()}.`);
      loadItems();
    } catch (err) {
      console.error(err);
      setActionMessage("Could not connect to the server.");
    }
  }

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
          <h2>My Posted Items</h2>
        </header>

        <section className="section">
          {loading && <p>Loading your items...</p>}
          {error && <p>{error}</p>}
          {actionMessage && <p>{actionMessage}</p>}

          {!loading && !error && items.length === 0 && (
            <p>You haven't posted any items yet.</p>
          )}

          {!loading &&
            !error &&
            items.map((item) => (
              <div key={item.id} className="glass" style={{ padding: "16px", marginBottom: "16px" }}>
                <h3>{item.title}</h3>
                <p>
                  <strong>Status:</strong> {item.status} &nbsp;|&nbsp;
                  <strong> Category:</strong> {item.category} &nbsp;|&nbsp;
                  <strong> Location:</strong> {item.location}
                </p>

                {item.status === "CLAIMED" && (
                  <div style={{ marginTop: "12px" }}>
                    <h4>Claims on this item</h4>
                    {!claimsByItem[item.id] && <p>Loading claims...</p>}

                    {claimsByItem[item.id] && claimsByItem[item.id].length === 0 && (
                      <p>No claims found (unexpected — refresh to retry).</p>
                    )}

                    {claimsByItem[item.id] &&
                      claimsByItem[item.id].map((claim) => (
                        <div
                          key={claim.id}
                          style={{
                            padding: "12px",
                            borderTop: "1px solid rgba(255,255,255,0.1)",
                          }}
                        >
                          <p><strong>From:</strong> {claim.claimant_name}</p>
                          <p><strong>Proof:</strong> {claim.evidence}</p>
                          <p><strong>Status:</strong> {claim.status}</p>

                          {claim.status === "PENDING" && (
                            <div style={{ marginTop: "8px" }}>
                              <button
                                className="btn btn-primary sm"
                                onClick={() => handleReview(claim.id, "APPROVED", item.id)}
                              >
                                Approve
                              </button>{" "}
                              <button
                                className="btn btn-secondary sm"
                                onClick={() => handleReview(claim.id, "REJECTED", item.id)}
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
        </section>
      </main>
    </div>
  );
}

export default Posted;