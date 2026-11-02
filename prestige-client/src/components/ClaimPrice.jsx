import { useState } from "react";
import { API_URL, apiFetch } from "../api";
import { ksh } from "../money";

// The price on a claim, and what each side can do about it while the claim is pending.
//   role="claimant": see the finder's ask, accept a counter-offer, or make a new offer.
//   role="finder":   see the claimant's offer, or ask for a different amount (counter-offer).
// Approving the claim (finder) accepts the claimant's current offer.
function ClaimPrice({ claim, role, askingReward, onUpdated }) {
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const offer = claim.offered_amount;
  const counter = claim.counter_amount;
  const asking = Number(askingReward || 0);
  const pending = claim.status === "PENDING";

  async function send(path, method, body) {
    setMessage("");
    setBusy(true);
    try {
      const response = await apiFetch(`${API_URL}/api/claims/${claim.id}/${path}`, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Could not update the price.");
        return;
      }
      setAmount("");
      onUpdated?.({ ...claim, ...data });
    } catch (err) {
      console.error(err);
      setMessage("Could not connect to the server.");
    } finally {
      setBusy(false);
    }
  }

  function submit(e) {
    e.preventDefault();
    if (amount === "") return;
    if (role === "finder") send("counter", "PATCH", { amount });
    else send("offer", "PATCH", { amount });
  }

  const offerText = offer != null ? ksh(offer) : pending ? "none yet" : "no price agreed";

  return (
    <div style={{ margin: "6px 0" }}>
      {role === "claimant" ? (
        <p>
          <strong>{claim.status === "APPROVED" ? "Agreed price:" : "Your offer:"}</strong> {offerText}
          {asking > 0 && <span className="muted"> · finder asks {ksh(asking)}</span>}
        </p>
      ) : (
        <p>
          <strong>Their offer:</strong> {offerText}
          {asking > 0 && <span className="muted"> · you asked {ksh(asking)}</span>}
        </p>
      )}

      {pending && counter != null && role === "claimant" && (
        <p style={{ marginTop: "6px" }}>
          The finder asks <strong>{ksh(counter)}</strong>.{" "}
          <button className="btn btn-primary sm" disabled={busy} onClick={() => send("accept-counter", "POST")}>
            Accept {ksh(counter)}
          </button>
        </p>
      )}
      {pending && counter != null && role === "finder" && (
        <p className="muted" style={{ marginTop: "6px" }}>
          You asked them for {ksh(counter)}. Waiting for their answer.
        </p>
      )}

      {pending && (
        <form onSubmit={submit} style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginTop: "6px" }}>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="KSh"
            aria-label={role === "finder" ? "Counter-offer amount" : "New offer amount"}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ width: "110px", padding: "8px 10px", borderRadius: "10px", border: "1px solid rgba(123,75,42,.25)" }}
          />
          <button className="btn btn-secondary sm" type="submit" disabled={busy || amount === ""}>
            {role === "finder" ? "Counter-offer" : "Send new offer"}
          </button>
        </form>
      )}

      {message && <p style={{ marginTop: "6px" }}>{message}</p>}
    </div>
  );
}

export default ClaimPrice;
