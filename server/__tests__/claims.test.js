// Contract endpoints for claims, fees and refunds (openapi.yaml).
const { app, request, pool, resetDb, expectClaim, expectRefund, expectError } = require("../test/helpers");

beforeEach(resetDb);
afterAll(() => pool.end());

describe("GET /claims?status=claimed", () => {
  it("happy path: returns approved claims in the exact contract shape", async () => {
    const res = await request(app).get("/claims").query({ status: "claimed" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    res.body.forEach(expectClaim);
    expect(res.body[0]).toEqual({
      claimId: "1",
      studentId: "SU-1001",
      itemId: "1",
      status: "claimed",
      rewardAmountCents: 15000,
    });
  });

  it("filters by the other statuses too", async () => {
    const res = await request(app).get("/claims").query({ status: "pending" });
    expect(res.status).toBe(200);
    expect(res.body.map((c) => c.claimId)).toEqual(["2", "3"]);
    res.body.forEach((c) => expect(c.status).toBe("pending"));
  });

  it("edge: returns an empty list, not 404, when nothing has that status", async () => {
    const res = await request(app).get("/claims").query({ status: "rejected" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("validation: missing status is rejected with 400", async () => {
    expectError(await request(app).get("/claims"), 400, /status/);
  });

  it("validation: an invalid status value is rejected with 400", async () => {
    expectError(await request(app).get("/claims").query({ status: "banana" }), 400, /pending, claimed, rejected/);
  });
});

describe("POST /claims", () => {
  it("happy path: creates a pending claim, returns 201, and the item becomes CLAIMED", async () => {
    const res = await request(app).post("/claims").send({ studentId: "SU-1001", itemId: "3" });
    expect(res.status).toBe(201);
    expectClaim(res.body);
    expect(res.body).toMatchObject({ studentId: "SU-1001", itemId: "3", status: "pending" });

    // Re-fetch to confirm the write really happened
    const mine = await request(app).get("/students/SU-1001/claims");
    expect(mine.body.map((c) => c.claimId)).toContain(res.body.claimId);
    const [[item]] = await pool.query("SELECT status FROM items WHERE id = 3");
    expect(item.status).toBe("CLAIMED");
  });

  it("validation: missing studentId gives 400 and writes nothing", async () => {
    expectError(await request(app).post("/claims").send({ itemId: "3" }), 400, /studentId/);
    const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM claims");
    expect(Number(n)).toBe(3);
  });

  it("validation: wrong types give 400", async () => {
    expectError(await request(app).post("/claims").send({ studentId: 1, itemId: "3" }), 400, /studentId/);
    expectError(await request(app).post("/claims").send({ studentId: "SU-1001", itemId: 3 }), 400, /itemId/);
  });

  it("validation: a body that is not JSON gives 400", async () => {
    const res = await request(app).post("/claims").set("Content-Type", "application/json").send("{bad");
    expectError(res, 400, /JSON/);
  });

  it("not found: unknown student or item gives 404", async () => {
    expectError(await request(app).post("/claims").send({ studentId: "NOPE-1", itemId: "3" }), 404, /student/);
    expectError(await request(app).post("/claims").send({ studentId: "SU-1001", itemId: "999" }), 404, /item/);
  });

  it("conflict: claiming your own item, a returned item, or twice gives 409", async () => {
    expectError(await request(app).post("/claims").send({ studentId: "SU-1002", itemId: "3" }), 409); // Wanjiku found item 3
    expectError(await request(app).post("/claims").send({ studentId: "SU-1003", itemId: "1" }), 409); // item 1 is RETURNED
    expectError(await request(app).post("/claims").send({ studentId: "SU-1001", itemId: "2" }), 409); // already claimed
  });
});

describe("PATCH /claims/:claimId", () => {
  it("approving: the claim becomes claimed, the rival claim is rejected, the item is RETURNED, a fee exists", async () => {
    const res = await request(app).patch("/claims/2").send({ status: "claimed" });
    expect(res.status).toBe(200);
    expectClaim(res.body);
    expect(res.body.status).toBe("claimed");

    const rival = await request(app).get("/students/SU-1002/claims");
    expect(rival.body.find((c) => c.claimId === "3").status).toBe("rejected");
    const [[item]] = await pool.query("SELECT status FROM items WHERE id = 2");
    expect(item.status).toBe("RETURNED");
    const fee = await request(app).get("/claims/2/fees");
    expect(fee.status).toBe(200);
  });

  it("idempotent: the same PATCH twice gives the same end state", async () => {
    const first = await request(app).patch("/claims/2").send({ status: "claimed" });
    const second = await request(app).patch("/claims/2").send({ status: "claimed" });
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
  });

  it("conflict: approving a second claim on the same item gives 409", async () => {
    await request(app).patch("/claims/2").send({ status: "claimed" });
    expectError(await request(app).patch("/claims/3").send({ status: "claimed" }), 409, /already been approved/);
  });

  it("rejecting the only pending claim puts the item back to FOUND", async () => {
    await request(app).post("/claims").send({ studentId: "SU-1001", itemId: "4" });
    const [[claim]] = await pool.query("SELECT id FROM claims WHERE item_id = 4");
    const res = await request(app).patch(`/claims/${claim.id}`).send({ status: "rejected" });
    expect(res.status).toBe(200);
    const [[item]] = await pool.query("SELECT status FROM items WHERE id = 4");
    expect(item.status).toBe("FOUND");
  });

  it("validation: missing or invalid status gives 400, checked before the claim exists", async () => {
    expectError(await request(app).patch("/claims/2").send({}), 400, /status/);
    expectError(await request(app).patch("/claims/99999").send({ status: "resolved" }), 400, /status/);
  });

  it("not found: unknown or malformed claim id gives 404", async () => {
    expectError(await request(app).patch("/claims/99999").send({ status: "claimed" }), 404, /claim not found/);
    expectError(await request(app).patch("/claims/abc").send({ status: "claimed" }), 404, /claim not found/);
  });
});

describe("DELETE /claims/:claimId", () => {
  it("deletes the claim and returns 204 with no body", async () => {
    const res = await request(app).delete("/claims/2");
    expect(res.status).toBe(204);
    const after = await request(app).get("/students/SU-1001/claims");
    expect(after.body.map((c) => c.claimId)).not.toContain("2");
  });

  it("deleting the approved claim makes the item claimable again", async () => {
    expect((await request(app).delete("/claims/1")).status).toBe(204);
    const [[item]] = await pool.query("SELECT status FROM items WHERE id = 1");
    expect(item.status).toBe("FOUND");
    expect((await request(app).post("/claims").send({ studentId: "SU-1003", itemId: "1" })).status).toBe(201);
  });

  it("not found: deleting twice gives 404 the second time", async () => {
    await request(app).delete("/claims/2");
    expectError(await request(app).delete("/claims/2"), 404, /claim not found/);
  });
});

describe("GET /claims/:claimId/fees", () => {
  it("happy path: returns the fee in the contract shape", async () => {
    const res = await request(app).get("/claims/1/fees");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ claimId: "1", studentId: "SU-1001", itemId: "1", amountPayableCents: 10000 });
  });

  it("edge: a claim with no fee yet gives 404 with a clear message", async () => {
    expectError(await request(app).get("/claims/2/fees"), 404, /no fee/);
  });

  it("not found: unknown or malformed claim gives 404", async () => {
    expectError(await request(app).get("/claims/999999999/fees"), 404, /claim not found/);
    expectError(await request(app).get("/claims/abc/fees"), 404, /claim not found/);
  });
});

describe("GET /claims/:claimId/refunds", () => {
  it("happy path: returns a list of refunds in the contract shape", async () => {
    const res = await request(app).get("/claims/1/refunds");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    res.body.forEach(expectRefund);
    expect(res.body[0]).toMatchObject({ refundId: "1", claimId: "1", studentId: "SU-1001", amountCents: 2500 });
  });

  it("edge: a claim with no refunds gives an empty list", async () => {
    const res = await request(app).get("/claims/2/refunds");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("not found: unknown claim gives 404", async () => {
    expectError(await request(app).get("/claims/999999999/refunds"), 404, /claim not found/);
  });
});

describe("POST /claims/:claimId/refunds", () => {
  const valid = { studentId: "SU-1001", amountCents: 1000, reason: "Collected late because the office was closed." };

  it("happy path: creates a refund (201) that then appears in the list", async () => {
    const res = await request(app).post("/claims/1/refunds").send(valid);
    expect(res.status).toBe(201);
    expectRefund(res.body);
    expect(res.body).toMatchObject({ claimId: "1", studentId: "SU-1001", amountCents: 1000 });
    const list = await request(app).get("/claims/1/refunds");
    expect(list.body).toHaveLength(2);
  });

  it("boundary: refunding exactly what is left of the fee is allowed, one cent more is not", async () => {
    expectError(await request(app).post("/claims/1/refunds").send({ ...valid, amountCents: 7501 }), 409, /7500 cents/);
    expect((await request(app).post("/claims/1/refunds").send({ ...valid, amountCents: 7500 })).status).toBe(201);
  });

  it.each([
    ["missing studentId", { amountCents: 100, reason: "x" }, /studentId/],
    ["amountCents as a string", { studentId: "SU-1001", amountCents: "100", reason: "x" }, /amountCents/],
    ["amountCents with decimals", { studentId: "SU-1001", amountCents: 1.5, reason: "x" }, /amountCents/],
    ["amountCents of zero", { studentId: "SU-1001", amountCents: 0, reason: "x" }, /greater than 0/],
    ["missing reason", { studentId: "SU-1001", amountCents: 100 }, /reason/],
  ])("validation: %s gives 400 and writes nothing", async (_name, body, message) => {
    expectError(await request(app).post("/claims/1/refunds").send(body), 400, message);
    const list = await request(app).get("/claims/1/refunds");
    expect(list.body).toHaveLength(1);
  });

  it("validation: a studentId that is not the claimant gives 400", async () => {
    expectError(await request(app).post("/claims/1/refunds").send({ ...valid, studentId: "SU-1002" }), 400, /does not match/);
  });

  it("conflict: a claim with no fee gives 409", async () => {
    expectError(await request(app).post("/claims/2/refunds").send(valid), 409, /no fee/);
  });

  it("not found: unknown claim gives 404", async () => {
    expectError(await request(app).post("/claims/999/refunds").send(valid), 404, /claim not found/);
  });
});
