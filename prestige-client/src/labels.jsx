// Plain words for statuses, so students don't have to learn FOUND / CLAIMED / RETURNED.
// The server still uses the codes; only what's shown changes.
const LABELS = {
  item: {
    FOUND: ["Waiting for owner", "found"],
    CLAIMED: ["Claim under review", "claimed"],
    RETURNED: ["Returned to owner", "returned"],
    CLOSED: ["Closed", "closed"],
  },
  claim: {
    PENDING: ["Under review", "claimed"],
    APPROVED: ["Approved: it's yours", "returned"],
    REJECTED: ["Not approved", "closed"],
  },
  report: {
    OPEN: ["Still looking", "claimed"],
    RESOLVED: ["Got it back", "returned"],
    CLOSED: ["Closed", "closed"],
  },
};

export function statusLabel(kind, status) {
  return (LABELS[kind] && LABELS[kind][status] && LABELS[kind][status][0]) || status;
}

// A coloured badge (styles in components.css: .status-found, .status-claimed, ...).
export function StatusBadge({ kind, status }) {
  const entry = LABELS[kind] && LABELS[kind][status];
  return <span className={`status-badge status-${entry ? entry[1] : "closed"}`}>{entry ? entry[0] : status}</span>;
}
