// Unread notifications (routes/notifications.js) and agreeing a price on a claim (routes/offers.js).
//
// Sample data: claims 2 (Amani) and 3 (Wanjiku) are PENDING on item 2, found by Brian, who asks KSh 100.
// Claim 1 is APPROVED. Brian has 2 unread notifications.
const { app, request, pool, resetDb, loginAs, expectError } = require("../test/helpers");

beforeEach(resetDb);
afterAll(() => pool.end());

describe("Notifications read/unread", () => {
  it("counts unread, marks all read", async () => {
    const brian = await loginAs("brian@strathmore.test");
    expect((await brian.get("/api/notifications/unread-count")).body).toEqual({ count: 2 });
    expect((await brian.post("/api/notifications/read-all")).body).toEqual({ updated: 2 });
    expect((await brian.get("/api/notifications/unread-count")).body).toEqual({ count: 0 });
  });

  it("marks one read; only your own", async () => {
    const brian = await loginAs("brian@strathmore.test");
    const [first] = (await brian.get("/api/notifications")).body;
    expect((await brian.patch(`/api/notifications/${first.id}/read`)).body.is_read).toBe(1);
    expect((await brian.get("/api/notifications/unread-count")).body.count).toBe(1);

    const amani = await loginAs("amani@strathmore.test");
    const [other] = (await brian.get("/api/notifications")).body.filter((n) => !n.is_read);
    expectError(await amani.patch(`/api/notifications/${other.id}/read`), 403);
    expectError(await amani.patch("/api/notifications/99999/read"), 404);
  });

  it("needs a login", async () => {
    expectError(await request(app).get("/api/notifications/unread-count"), 401);
  });
});

describe("Agreeing a price", () => {
  it("finder counters, claimant accepts: the counter becomes the offer, both are notified", async () => {
    const brian = await loginAs("brian@strathmore.test");
    const amani = await loginAs("amani@strathmore.test");

    const countered = await brian.patch("/api/claims/2/counter", { amount: 120 });
    expect(countered.status).toBe(200);
    expect(Number(countered.body.counter_amount)).toBe(120);
    expect((await amani.get("/api/notifications")).body[0].message).toMatch(/asks KSh 120\.00/);

    // The claimant sees the counter, and the finder's asking reward, on My Claims.
    const mine = (await amani.get("/api/claims")).body.find((c) => c.id === 2);
    expect(Number(mine.counter_amount)).toBe(120);
    expect(Number(mine.reward_amount)).toBe(100);

    const accepted = await amani.post("/api/claims/2/accept-counter");
    expect(accepted.status).toBe(200);
    expect(Number(accepted.body.offered_amount)).toBe(120);
    expect(accepted.body.counter_amount).toBeNull();
    expect((await brian.get("/api/notifications")).body[0].message).toMatch(/was accepted/);
  });

  it("claimant makes a new offer instead, which clears the counter", async () => {
    const brian = await loginAs("brian@strathmore.test");
    const amani = await loginAs("amani@strathmore.test");
    await brian.patch("/api/claims/2/counter", { amount: 150 });
    const res = await amani.patch("/api/claims/2/offer", { amount: 110 });
    expect(Number(res.body.offered_amount)).toBe(110);
    expect(res.body.counter_amount).toBeNull();
    expect((await brian.get("/api/notifications")).body[0].message).toMatch(/New offer of KSh 110\.00/);
  });

  it("only the right person can act, only on pending claims", async () => {
    const brian = await loginAs("brian@strathmore.test");
    const amani = await loginAs("amani@strathmore.test");
    expectError(await amani.patch("/api/claims/2/counter", { amount: 1 }), 403, /finder/);
    expectError(await brian.patch("/api/claims/2/offer", { amount: 1 }), 403, /claimant/);
    expectError(await amani.patch("/api/claims/1/offer", { amount: 1 }), 409, /pending/); // claim 1 is APPROVED
    expectError(await amani.post("/api/claims/2/accept-counter"), 409, /hasn't asked/);
    expectError(await amani.patch("/api/claims/99999/offer", { amount: 1 }), 404);
  });

  it("amounts are validated", async () => {
    const amani = await loginAs("amani@strathmore.test");
    expectError(await amani.patch("/api/claims/2/offer", {}), 400, /required/);
    expectError(await amani.patch("/api/claims/2/offer", { amount: -3 }), 400, /from 0/);
    expectError(await amani.patch("/api/claims/2/offer", { amount: "abc" }), 400, /from 0/);
  });
});
