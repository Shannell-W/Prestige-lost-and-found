import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { API_URL, apiFetch } from "../api";
import { ksh } from "../money";
import { imageSrc } from "../media";
import { StatusBadge } from "../labels";

function ItemDetails() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [evidence, setEvidence] = useState("");
  const [checkAnswer, setCheckAnswer] = useState("");
  // What the claimant offers the finder. Pre-filled from their lost report's offer when they come from a match.
  const [offeredAmount, setOfferedAmount] = useState(
    () => new URLSearchParams(window.location.search).get("offer") || ""
  );
  const [claimMessage, setClaimMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch(`${API_URL}/api/items/${id}`)
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
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return;
    }

    setSubmitting(true);

    try {
      const response = await apiFetch(`${API_URL}/api/claims`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          itemId: id,
          evidence,
          checkAnswer,
          offeredAmount: offeredAmount === "" ? undefined : offeredAmount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setClaimMessage(data.error || "Failed to submit claim.");
      } else {
        setClaimMessage("Claim submitted! The finder will review it. Follow it, and any price offers, in My Claims.");
        setEvidence("");
        setCheckAnswer("");
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
        <div>
          {item.image_url && <img src={imageSrc(item.image_url)} alt={item.title} />}
          <h2>{item.title}</h2>
          <p style={{ margin: "8px 0" }}><StatusBadge kind="item" status={item.status} /></p>
          <p><strong>Category:</strong> {item.category}</p>
          <p><strong>Location found:</strong> {item.location}</p>
          <p><strong>Date found:</strong> {new Date(item.date_found).toLocaleDateString()}</p>
          {item.description && <p><strong>Description:</strong> {item.description}</p>}
          {item.reward_amount > 0 && <p><strong>Finder asks:</strong> {ksh(item.reward_amount)}</p>}
          <p className="muted" style={{ marginTop: "10px" }}>
            {item.handover === "SECURITY"
              ? "Pickup: it's with campus security. Once the finder approves your claim you'll see exactly where to collect it."
              : "Pickup: the finder keeps it. Once they approve your claim you'll see their contact details to arrange a meeting."}
          </p>
        </div>

        {/* CLAIMED items can still be claimed: someone else's claim may be wrong, and the finder picks the real owner. */}
        {(item.status === "FOUND" || item.status === "CLAIMED") && (
          <form className="form" onSubmit={handleClaim} style={{ marginTop: "20px" }}>
            <h3>Claim this item</h3>
            {item.status === "CLAIMED" && (
              <p className="muted">
                Someone else has already claimed this item. If it's yours, claim it too: the finder compares the
                proof and picks the real owner.
              </p>
            )}
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

            {item.check_question && (
              <div className="field">
                <label htmlFor="checkAnswer">The finder asks: {item.check_question}</label>
                <input
                  id="checkAnswer"
                  type="text"
                  required
                  maxLength={500}
                  value={checkAnswer}
                  onChange={(e) => setCheckAnswer(e.target.value)}
                />
              </div>
            )}

            <div className="field">
              <label htmlFor="offeredAmount">
                Amount you'll pay the finder, KSh (optional
                {Number(item.reward_amount) > 0 ? `; they ask ${ksh(item.reward_amount)}` : ""})
              </label>
              <input
                id="offeredAmount"
                type="number"
                min="0"
                step="0.01"
                placeholder={Number(item.reward_amount) > 0 ? String(Number(item.reward_amount)) : "0"}
                value={offeredAmount}
                onChange={(e) => setOfferedAmount(e.target.value)}
              />
            </div>

            {claimMessage && <p>{claimMessage}</p>}

            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Claim"}
            </button>
          </form>
        )}

        {item.status !== "FOUND" && item.status !== "CLAIMED" && (
          <p style={{ marginTop: "20px" }}>
            This item is no longer available to claim: {item.status === "RETURNED" ? "it was returned to its owner" : "the finder closed it"}.
          </p>
        )}
      </div>
    </main>
  );
}

export default ItemDetails;