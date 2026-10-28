// The rules for claims, in one place, used by both our website's routes (/api/...)
// and the partner contract routes (/claims...), so both always behave the same way.
//
// Item status flow:  FOUND -> CLAIMED (has a pending claim) -> RETURNED (a claim was approved)
// Claim status:      PENDING -> APPROVED or REJECTED
const { withTransaction } = require("./db");

// An error with an HTTP status, so routes can turn it straight into a response.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// The handling fee recorded when a claim is approved, in cents (10000 = KSh 100.00).
// TEAM DECISION: change CLAIM_FEE_CENTS in .env if you agree on a different amount.
const CLAIM_FEE_CENTS = Number(process.env.CLAIM_FEE_CENTS || 10000);

async function notify(conn, userId, message) {
  await conn.query("INSERT INTO notifications (user_id, message) VALUES (?, ?)", [userId, message]);
}

// After a claim changes, set the item's status from what its claims now say.
async function refreshItemStatus(conn, itemId) {
  const [[item]] = await conn.query("SELECT status FROM items WHERE id = ?", [itemId]);
  if (!item || item.status === "CLOSED") return;

  const [[counts]] = await conn.query(
    `SELECT
       COALESCE(SUM(status = 'APPROVED'), 0) AS approved,
       COALESCE(SUM(status = 'PENDING'), 0) AS pending
     FROM claims WHERE item_id = ?`,
    [itemId]
  );

  let status = "FOUND";
  if (Number(counts.approved) > 0) status = "RETURNED";
  else if (Number(counts.pending) > 0) status = "CLAIMED";

  await conn.query("UPDATE items SET status = ? WHERE id = ?", [status, itemId]);
}

// A student claims an item. Returns the new claim's id.
async function submitClaim({ itemId, userId, evidence }) {
  return withTransaction(async (conn) => {
    const [[item]] = await conn.query("SELECT * FROM items WHERE id = ?", [itemId]);
    if (!item) throw new HttpError(404, "item not found");

    if (item.student_id === userId) {
      throw new HttpError(409, "You reported this item, so you cannot claim it");
    }
    if (item.status === "RETURNED" || item.status === "CLOSED") {
      throw new HttpError(409, "This item is no longer available to claim");
    }

    const [existing] = await conn.query(
      "SELECT id FROM claims WHERE item_id = ? AND student_id = ? AND status IN ('PENDING', 'APPROVED')",
      [itemId, userId]
    );
    if (existing.length > 0) throw new HttpError(409, "You have already claimed this item");

    const [result] = await conn.query(
      "INSERT INTO claims (item_id, student_id, evidence, status) VALUES (?, ?, ?, 'PENDING')",
      [itemId, userId, evidence]
    );

    // This was the missing step: the item now has a claim waiting for review,
    // which is what makes it show up on the finder's Posted page.
    await refreshItemStatus(conn, itemId);
    await notify(conn, item.student_id, `Someone submitted a claim for your item "${item.title}".`);

    return result.insertId;
  });
}

// Set a claim to PENDING, APPROVED or REJECTED.
// - Setting the status a claim already has changes nothing (idempotent).
// - Approving selects this claimant as the owner: other pending claims on the item are
//   rejected, the item becomes RETURNED, and the handling fee is recorded.
// - Only one claim per item can be approved.
async function setClaimStatus(claimId, newStatus) {
  return withTransaction(async (conn) => {
    const [[claim]] = await conn.query(
      `SELECT claims.*, items.title FROM claims JOIN items ON items.id = claims.item_id WHERE claims.id = ?`,
      [claimId]
    );
    if (!claim) throw new HttpError(404, "claim not found");
    if (claim.status === newStatus) return claim;

    if (newStatus === "APPROVED") {
      const [others] = await conn.query(
        "SELECT id FROM claims WHERE item_id = ? AND status = 'APPROVED' AND id <> ?",
        [claim.item_id, claimId]
      );
      if (others.length > 0) {
        throw new HttpError(409, "Another claim on this item has already been approved");
      }

      await conn.query("UPDATE claims SET status = 'APPROVED' WHERE id = ?", [claimId]);

      const [losers] = await conn.query(
        "SELECT id, student_id FROM claims WHERE item_id = ? AND status = 'PENDING' AND id <> ?",
        [claim.item_id, claimId]
      );
      for (const other of losers) {
        await conn.query("UPDATE claims SET status = 'REJECTED' WHERE id = ?", [other.id]);
        await notify(conn, other.student_id, `Your claim for "${claim.title}" was rejected.`);
      }

      const [fee] = await conn.query("SELECT id FROM fees WHERE claim_id = ?", [claimId]);
      if (fee.length === 0) {
        await conn.query("INSERT INTO fees (claim_id, amount_payable_cents) VALUES (?, ?)", [
          claimId,
          CLAIM_FEE_CENTS,
        ]);
      }
    } else {
      // Moving away from APPROVED undoes the approval, unless money has already been refunded.
      if (claim.status === "APPROVED") {
        const [refunds] = await conn.query("SELECT id FROM refunds WHERE claim_id = ?", [claimId]);
        if (refunds.length > 0) {
          throw new HttpError(409, "This claim has refunds, so its approval cannot be undone");
        }
        await conn.query("DELETE FROM fees WHERE claim_id = ?", [claimId]);
      }
      await conn.query("UPDATE claims SET status = ? WHERE id = ?", [newStatus, claimId]);
    }

    await refreshItemStatus(conn, claim.item_id);
    if (newStatus !== "PENDING") {
      await notify(conn, claim.student_id, `Your claim for "${claim.title}" was ${newStatus.toLowerCase()}.`);
    }

    const [[updated]] = await conn.query("SELECT * FROM claims WHERE id = ?", [claimId]);
    return updated;
  });
}

// Delete a claim with its fee and refunds, then update the item's status.
async function deleteClaim(claimId) {
  return withTransaction(async (conn) => {
    const [[claim]] = await conn.query("SELECT * FROM claims WHERE id = ?", [claimId]);
    if (!claim) throw new HttpError(404, "claim not found");

    await conn.query("DELETE FROM refunds WHERE claim_id = ?", [claimId]);
    await conn.query("DELETE FROM fees WHERE claim_id = ?", [claimId]);
    await conn.query("DELETE FROM claims WHERE id = ?", [claimId]);
    await refreshItemStatus(conn, claim.item_id);
    return claim;
  });
}

module.exports = { HttpError, CLAIM_FEE_CENTS, submitClaim, setClaimStatus, deleteClaim, refreshItemStatus };
