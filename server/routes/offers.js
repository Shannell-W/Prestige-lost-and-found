// Agreeing a price on a claim, before the finder approves it.
//
// The claimant offers an amount (claims.offered_amount, set when claiming or later). The finder can answer
// with a counter-offer (claims.counter_amount). The claimant then accepts it (it becomes their offer) or
// makes a new offer (which clears the counter). Approving the claim accepts the claimant's current offer.
// Only while the claim is PENDING.
//
//   PATCH /api/claims/:id/offer           { amount }  claimant: make a new offer
//   PATCH /api/claims/:id/counter         { amount }  finder: ask for a different amount
//   POST  /api/claims/:id/accept-counter              claimant: agree to the finder's amount
const express = require("express");
const { withTransaction } = require("../db");
const { addNotification } = require("../notify");

const MAX_AMOUNT = 1000000; // KSh; a sanity limit

function parseAmount(value) {
  if (value === undefined || value === null || value === "") return { error: "Amount is required" };
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > MAX_AMOUNT) return { error: `Amount must be a number from 0 to ${MAX_AMOUNT}` };
  return { amount: Math.round(n * 100) / 100 };
}

const ksh = (n) => `KSh ${Number(n).toFixed(2)}`;

// The claim with its item, checked to be PENDING and to belong to `role` ("claimant" or "finder").
// Throws { status, message } for the route to send.
async function loadClaim(conn, claimId, userId, role) {
  const [[claim]] = await conn.query(
    `SELECT claims.*, items.title, items.student_id AS finder_id
     FROM claims JOIN items ON items.id = claims.item_id
     WHERE claims.id = ? FOR UPDATE`,
    [claimId]
  );
  if (!claim) throw { status: 404, message: "Claim not found" };
  const ownerId = role === "finder" ? claim.finder_id : claim.student_id;
  if (ownerId !== userId) {
    throw { status: 403, message: role === "finder" ? "Only the item's finder can do this" : "Only the claimant can do this" };
  }
  if (claim.status !== "PENDING") throw { status: 409, message: "The price can only change while the claim is pending" };
  return claim;
}

async function notify(conn, userId, message, itemId) {
  await addNotification(conn, userId, message, { itemId });
}

module.exports = function offerRoutes(authenticateToken) {
  const router = express.Router();

  // Wraps a route: runs `work` in a transaction and turns thrown { status, message } into a response.
  const handle = (work) => async (req, res) => {
    try {
      const claim = await withTransaction((conn) => work(conn, req));
      res.json(claim);
    } catch (err) {
      if (err && err.status) return res.status(err.status).json({ error: err.message });
      console.error(err);
      res.status(500).json({ error: "Failed to update the price" });
    }
  };

  const reload = async (conn, id) => (await conn.query("SELECT * FROM claims WHERE id = ?", [id]))[0][0];

  router.patch(
    "/api/claims/:id/offer",
    authenticateToken,
    handle(async (conn, req) => {
      const { amount, error } = parseAmount(req.body?.amount);
      if (error) throw { status: 400, message: error };
      const claim = await loadClaim(conn, req.params.id, req.user.id, "claimant");
      await conn.query("UPDATE claims SET offered_amount = ?, counter_amount = NULL WHERE id = ?", [amount, claim.id]);
      await notify(conn, claim.finder_id, `New offer of ${ksh(amount)} on a claim for your item "${claim.title}".`, claim.item_id);
      return reload(conn, claim.id);
    })
  );

  router.patch(
    "/api/claims/:id/counter",
    authenticateToken,
    handle(async (conn, req) => {
      const { amount, error } = parseAmount(req.body?.amount);
      if (error) throw { status: 400, message: error };
      const claim = await loadClaim(conn, req.params.id, req.user.id, "finder");
      await conn.query("UPDATE claims SET counter_amount = ? WHERE id = ?", [amount, claim.id]);
      await notify(
        conn,
        claim.student_id,
        `The finder of "${claim.title}" asks ${ksh(amount)}. Accept it or make a new offer in My Claims.`,
        claim.item_id
      );
      return reload(conn, claim.id);
    })
  );

  router.post(
    "/api/claims/:id/accept-counter",
    authenticateToken,
    handle(async (conn, req) => {
      const claim = await loadClaim(conn, req.params.id, req.user.id, "claimant");
      if (claim.counter_amount === null) throw { status: 409, message: "The finder hasn't asked for a different amount" };
      await conn.query("UPDATE claims SET offered_amount = counter_amount, counter_amount = NULL WHERE id = ?", [claim.id]);
      await notify(
        conn,
        claim.finder_id,
        `Your price of ${ksh(claim.counter_amount)} for "${claim.title}" was accepted. You can approve the claim.`,
        claim.item_id
      );
      return reload(conn, claim.id);
    })
  );

  return router;
};
