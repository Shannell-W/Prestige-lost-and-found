// Our own website's claim routes (/api/...), checking the bug fixes:
// submitting a claim now marks the item CLAIMED, students can't claim their own or a returned item,
// and approving one claim rejects the others.
const { app, request, pool, resetDb, loginAs, expectError } = require("../test/helpers");

beforeEach(resetDb);
afterAll(() => pool.end());

describe("POST /api/claims", () => {
  it("needs a login", async () => {
    expectError(await request(app).post("/api/claims").send({ itemId: 3, evidence: "mine" }), 401);
  });

  it("submitting a claim marks the item CLAIMED, so it shows up for review", async () => {
    const amani = await loginAs("amani@strathmore.test");
    const res = await amani.post("/api/claims", { itemId: 3, evidence: "My name is printed on the card." });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("claimId");

    const item = await request(app).get("/api/items/3");
    expect(item.body.status).toBe("CLAIMED");
    const claimed = await request(app).get("/api/items/claimed");
    expect(claimed.body.map((i) => i.id)).toContain(3);
  });

  it("notifies the finder", async () => {
    const amani = await loginAs("amani@strathmore.test");
    await amani.post("/api/claims", { itemId: 3, evidence: "My name is printed on the card." });
    const wanjiku = await loginAs("wanjiku@strathmore.test");
    const notes = await wanjiku.get("/api/notifications");
    expect(notes.body[0].message).toMatch(/Student ID card/);
  });

  it("blocks claiming your own item (409)", async () => {
    const wanjiku = await loginAs("wanjiku@strathmore.test");
    expectError(await wanjiku.post("/api/claims", { itemId: 3, evidence: "I found it" }), 409, /reported this item/);
  });

  it("blocks claiming an item that was already returned (409)", async () => {
    const brian = await loginAs("brian@strathmore.test");
    expectError(await brian.post("/api/claims", { itemId: 1, evidence: "It is mine" }), 409, /no longer available/);
  });

  it("blocks claiming the same item twice (409)", async () => {
    const amani = await loginAs("amani@strathmore.test");
    expectError(await amani.post("/api/claims", { itemId: 2, evidence: "Again" }), 409, /already claimed/);
  });

  it("unknown item gives 404", async () => {
    const amani = await loginAs("amani@strathmore.test");
    expectError(await amani.post("/api/claims", { itemId: 99999, evidence: "Mine" }), 404, /Item not found/);
  });
});

describe("PATCH /api/claims/:id (finder reviews a claim)", () => {
  it("approving one claim rejects the other and marks the item RETURNED", async () => {
    const brian = await loginAs("brian@strathmore.test"); // Brian found item 2
    const res = await brian.patch("/api/claims/2", { status: "APPROVED" });
    expect(res.status).toBe(200);

    const [[rival]] = await pool.query("SELECT status FROM claims WHERE id = 3");
    expect(rival.status).toBe("REJECTED");
    const item = await request(app).get("/api/items/2");
    expect(item.body.status).toBe("RETURNED");
  });

  it("only the finder can review (403)", async () => {
    const amani = await loginAs("amani@strathmore.test");
    expectError(await amani.patch("/api/claims/3", { status: "APPROVED" }), 403);
  });

  it("can't approve a second claim on the same item (409)", async () => {
    const brian = await loginAs("brian@strathmore.test");
    await brian.patch("/api/claims/2", { status: "APPROVED" });
    expectError(await brian.patch("/api/claims/3", { status: "APPROVED" }), 409, /already been approved/);
  });

  it("rejects an invalid status (400)", async () => {
    const brian = await loginAs("brian@strathmore.test");
    expectError(await brian.patch("/api/claims/2", { status: "MAYBE" }), 400);
  });
});

describe("Unknown paths", () => {
  it("return JSON 404 instead of an HTML page", async () => {
    expectError(await request(app).get("/no-such-route"), 404, /No route/);
  });
});
