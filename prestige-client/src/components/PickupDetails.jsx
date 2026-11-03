import { useState } from "react";
import { API_URL, apiFetch } from "../api";
import { ksh } from "../money";

// After a claim is approved: how the owner collects the item, and the other person's contact details.
// Shown on My Claims (to the owner) and My Posted Items (to the finder).
function PickupDetails({ claimId }) {
  const [details, setDetails] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const response = await apiFetch(`${API_URL}/api/claims/${claimId}/handover`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await response.json();
      if (!response.ok) setMessage(data.error || "Could not load pickup details.");
      else setDetails(data);
    } catch (err) {
      console.error(err);
      setMessage("Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  if (!details) {
    return (
      <div style={{ marginTop: "6px" }}>
        <button className="btn btn-primary sm" onClick={load} disabled={loading}>
          {loading ? "Loading..." : "How to hand over / collect"}
        </button>
        {message && <p>{message}</p>}
      </div>
    );
  }

  const { contact } = details;
  const owner = details.role === "owner";
  return (
    <div className="glass" style={{ padding: "12px", marginTop: "8px" }}>
      <p>
        <strong>{owner ? "How to collect it" : "Handing it over"}:</strong>{" "}
        {owner ? details.instructions : details.handover === "SECURITY" ? "It's with campus security; the owner will collect it there." : "Arrange a public place on campus to meet the owner."}
      </p>
      {details.handoverNote && (
        <p>
          <strong>Pickup details:</strong> {details.handoverNote}
        </p>
      )}
      {details.agreedAmount != null && (
        <p>
          <strong>Agreed price:</strong> {ksh(details.agreedAmount)}
        </p>
      )}
      <p style={{ marginTop: "6px" }}>
        <strong>{owner ? "Finder" : "Owner"}:</strong> {contact.name} ·{" "}
        <a className="link" href={`mailto:${contact.email}`}>{contact.email}</a>
        {contact.phone && (
          <>
            {" "}· <a className="link" href={`tel:${contact.phone}`}>{contact.phone}</a>
          </>
        )}
      </p>
    </div>
  );
}

export default PickupDetails;
