const { app, request, PREFIX } = require("./helpers");

describe("GET /claims?status=claimed", () => {
  it("happy path: returns claimed items with reward amounts", async () => {
    const res = await request(app).get(`${PREFIX}/claims`).query({ status: "claimed" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    res.body.forEach((c) => {
      expect(c).toHaveProperty("rewardAmount");
      expect(typeof c.rewardAmount).toBe("number");
    });
  });

  it("validation: rejects an invalid status value", async () => {
    const res = await request(app).get(`${PREFIX}/claims`).query({ status: "banana" });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("message");
  });

  it("edge: returns an array (possibly empty) when nothing matches", async () => {
    const res = await request(app).get(`${PREFIX}/claims`).query({ status: "claimed" });
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("GET /claims/:claimId/fees", () => {
  it("not-found: unknown claim returns 404", async () => {
    const res = await request(app).get(`${PREFIX}/claims/999999999/fees`);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("message");
  });

  it("validation: non-numeric claim id is rejected", async () => {
    const res = await request(app).get(`${PREFIX}/claims/abc/fees`);
    expect(res.status).toBe(400);
  });

  it("happy path: returns claim, student, item and amount fields", async () => {
    const list = await request(app).get(`${PREFIX}/claims`).query({ status: "claimed" });
    if (list.body.length === 0) return; // nothing to arrange yet
    const id = list.body[0].id;
    const res = await request(app).get(`${PREFIX}/claims/${id}/fees`);
    expect(res.status).toBe(200);
    ["claimId", "studentId", "itemId", "amountPayable"].forEach((f) =>
      expect(res.body).toHaveProperty(f)
    );
    expect(typeof res.body.amountPayable).toBe("number");
  });
});

describe("GET /claims/:claimId/refunds", () => {
  it("not-found: unknown claim returns 404", async () => {
    const res = await request(app).get(`${PREFIX}/claims/999999999/refunds`);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("message");
  });

  it("validation: non-numeric claim id is rejected", async () => {
    const res = await request(app).get(`${PREFIX}/claims/abc/refunds`);
    expect(res.status).toBe(400);
  });

  it("edge + happy path: returns an array of refunds with the right fields", async () => {
    const list = await request(app).get(`${PREFIX}/claims`).query({ status: "claimed" });
    if (list.body.length === 0) return;
    const res = await request(app).get(`${PREFIX}/claims/${list.body[0].id}/refunds`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true); // contract allows multiple/partial refunds
    res.body.forEach((r) => {
      ["claimId", "studentId", "amount", "reason"].forEach((f) => expect(r).toHaveProperty(f));
    });
  });
});