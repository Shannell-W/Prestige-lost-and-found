import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { API_URL } from "../api";

function ItemDetails() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [evidence, setEvidence] = useState("");
  const [claimMessage, setClaimMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/items/${id}`)
      .then((response) => {
        if (!response.ok) throw new Error("Item not found");
        return response.json();
      })
      .then((data) => {
        setItem(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Could not load this item.");
        setLoading(false);
      });
  }, [id]);

  async function handleClaim(e) {
    e.preventDefault();
    setClaimMessage("");

    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/api/claims`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ itemId: id, evidence }),
      });

      const data = await response.json();

      if (!response.ok) {
        setClaimMessage(data.error || "Failed to submit claim.");
      } else {
        setClaimMessage("Claim submitted! The finder will review it.");
        setEvidence("");
      }
    } catch (err) {
      console.error(err);
      setClaimMessage("Could not connect to the server.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <main className="container section"><p>Loading item...</p></main>;
  if (error) return <main className="container section"><p>{error}</p></main>;

  return (
    <main className="container section">
      <Link to="/items" className="btn btn-secondary sm">← Back to Items</Link>

      <div className="item-detail-page glass" style={{ marginTop: "20px", padding: "20px" }}>
        <h2>{item.title}</h2>
        <p><strong>Category:</strong> {item.category}</p>
        <p><strong>Location found:</strong> {item.location}</p>
        <p><strong>Date found:</strong> {new Date(item.date_found).toLocaleDateString()}</p>
        <p><strong>Status:</strong> {item.status}</p>
        {item.description && <p><strong>Description:</strong> {item.description}</p>}
        {item.reward_amount > 0 && <p><strong>Reward:</strong> {item.reward_amount}</p>}

        {item.status === "FOUND" && (
          <form className="form" onSubmit={handleClaim} style={{ marginTop: "20px" }}>
            <h3>Claim this item</h3>
            <div className="field">
              <label htmlFor="evidence">Proof of ownership</label>
              <textarea
                id="evidence"
                placeholder="Describe identifying details only the real owner would know (min. 20 characters)"
                required
                minLength={20}
                rows={4}
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
              />
            </div>

            {claimMessage && <p>{claimMessage}</p>}

            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Claim"}
            </button>
          </form>
        )}

        {item.status !== "FOUND" && (
          <p style={{ marginTop: "20px" }}>
            This item is no longer available to claim (status: {item.status}).
          </p>
        )}
      </div>
    </main>
  );
}

export default ItemDetails;