// Lost reports (routes/lostReports.js) and matching (matching.js):
// a student reports a lost item, sees similar found items, and is notified when one is reported later.
//
// Sample data (seed.js): lost report 1 is Amani's keys, already matched to found item 4 (house keys, found by Brian).
// Lost report 2 is Brian's water bottle, with no match.
const { app, request, pool, resetDb, loginAs, expectError } = require("../test/helpers");

beforeEach(resetDb);
afterAll(() => pool.end());

const keys = {
  title: "Lost keys",
  description: "Three keys on a silver ring with a small torch",
  category: "Other",
  location: "Main gate",
  dateLost: "2026-10-06",
  rewardOffered: 300,
};

describe("POST /api/lost-reports", () => {
  it("needs a login", async () => {
    expectError(await request(app).post("/api/lost-reports").send(keys), 401);
  });

  it("returns similar found items straight away when there are some", async () => {
    const wanjiku = await loginAs("wanjiku@strathmore.test");
    const res = await wanjiku.post("/api/lost-reports", keys);
    expect(res.status).toBe(201);
    expect(res.body.lostReportId).toEqual(expect.any(Number));
    expect(res.body.matches.map((m) => m.id)).toEqual([4]);

    const match = res.body.matches[0];
    expect(match.title).toBe("House keys");
    expect(match.confidence).toMatch(/high|medium|low/);
    expect(match.matchedWords).toEqual(expect.arrayContaining(["key", "torch"]));
    expect(Number(match.reward_amount)).toBe(50); // the finder's price, shown next to the owner's offer
    expect(res.body.message).toMatch(/may be yours/);
  });

  it("says it will notify when nothing similar has been found", async () => {
    const amani = await loginAs("amani@strathmore.test");
    const res = await amani.post("/api/lost-reports", {
      title: "Green umbrella",
      category: "Other",
      dateLost: "2026-10-06",
    });
    expect(res.status).toBe(201);
    expect(res.body.matches).toEqual([]);
    expect(res.body.message).toMatch(/notify you/);
  });

  it("saves the owner's reward offer", async () => {
    const wanjiku = await loginAs("wanjiku@strathmore.test");
    const res = await wanjiku.post("/api/lost-reports", keys);
    const report = await wanjiku.get(`/api/lost-reports/${res.body.lostReportId}`);
    expect(Number(report.body.reward_offered)).toBe(300);
    expect(report.body.status).toBe("OPEN");
    expect(report.body.school).toBe("Strathmore University");
  });

  it("never matches items from another school", async () => {
    // Item 5 (grey hoodie) is at Kenyatta; Amani is at Strathmore.
    const amani = await loginAs("amani@strathmore.test");
    const res = await amani.post("/api/lost-reports", {
      title: "Grey hoodie",
      description: "size M with school logo on the sleeve",
      category: "Clothing",
      location: "Dining hall",
      dateLost: "2026-10-03",
    });
    expect(res.body.matches).toEqual([]);
  });

  it("never matches the student's own found items", async () => {
    // Brian found item 4 himself.
    const brian = await loginAs("brian@strathmore.test");
    const res = await brian.post("/api/lost-reports", keys);
    expect(res.body.matches).toEqual([]);
  });

  it("ignores items found well before the item was lost", async () => {
    const wanjiku = await loginAs("wanjiku@strathmore.test");
    const res = await wanjiku.post("/api/lost-reports", { ...keys, dateLost: "2026-10-20" }); // keys found 10-06
    expect(res.body.matches).toEqual([]);
  });

  it("only offers items that can still be claimed (not RETURNED)", async () => {
    // Item 1 (black backpack) was already RETURNED.
    const brian = await loginAs("brian@strathmore.test");
    const res = await brian.post("/api/lost-reports", {
      title: "Black backpack",
      description: "red keychain",
      category: "Accessories",
      dateLost: "2026-09-29",
    });
    expect(res.body.matches.map((m) => m.id)).not.toContain(1);
  });

  it.each([
    [{ ...keys, title: "" }, /required/],
    [{ ...keys, category: undefined }, /required/],
    [{ ...keys, dateLost: undefined }, /required/],
    [{ ...keys, dateLost: "05/10/2026" }, /date like/],
    [{ ...keys, dateLost: "2026-02-30" }, /date like/],
    [{ ...keys, dateLost: "2999-01-01" }, /future/],
    [{ ...keys, rewardOffered: -5 }, /Reward offered/],
    [{ ...keys, rewardOffered: "lots" }, /Reward offered/],
    [{ ...keys, title: "x".repeat(151) }, /150 characters/],
  ])("rejects bad input with 400 (%#)", async (body, message) => {
    const amani = await loginAs("amani@strathmore.test");
    expectError(await amani.post("/api/lost-reports", body), 400, message);
  });
});

describe("Reporting a found item notifies matching owners", () => {
  const phone = {
    title: "Samsung phone",
    description: "Black Samsung phone with a cracked screen and a blue case",
    category: "Electronics",
    location: "Library",
    dateLost: "2026-10-10",
    rewardOffered: 500,
  };
  const foundPhone = {
    title: "Black mobile phone",
    description: "Samsung, cracked screen, blue case",
    category: "Electronics",
    location: "Library entrance",
    dateFound: "2026-10-11",
    rewardAmount: 200,
  };

  it("sends the owner a notification that links to the new item", async () => {
    const amani = await loginAs("amani@strathmore.test");
    const lost = await amani.post("/api/lost-reports", phone);
    expect(lost.body.matches).toEqual([]);

    const brian = await loginAs("brian@strathmore.test");
    const found = await brian.post("/api/items", foundPhone);
    expect(found.status).toBe(201);

    const notes = await amani.get("/api/notifications");
    const note = notes.body.find((n) => n.item_id === found.body.itemId);
    expect(note).toBeDefined();
    expect(note.message).toMatch(/Samsung phone/);

    const matches = await amani.get(`/api/lost-reports/${lost.body.lostReportId}/matches`);
    expect(matches.body.map((m) => m.id)).toEqual([found.body.itemId]);
  });

  it("does not notify for unrelated items, other schools, or closed reports", async () => {
    const amani = await loginAs("amani@strathmore.test");
    const lost = await amani.post("/api/lost-reports", phone);
    const before = (await amani.get("/api/notifications")).body.length;

    const brian = await loginAs("brian@strathmore.test");
    await brian.post("/api/items", { title: "Red umbrella", category: "Other", location: "Library", dateFound: "2026-10-11" });

    const faith = await loginAs("faith@ku.test", "Kenyatta University");
    await faith.post("/api/items", foundPhone); // same phone, but at Kenyatta

    await amani.patch(`/api/lost-reports/${lost.body.lostReportId}`, { status: "CLOSED" });
    await brian.post("/api/items", foundPhone); // matches, but the report is closed

    expect((await amani.get("/api/notifications")).body.length).toBe(before);
  });

  it("does not notify the finder about their own item", async () => {
    const brian = await loginAs("brian@strathmore.test");
    await brian.post("/api/lost-reports", phone);
    const before = (await brian.get("/api/notifications")).body.length;
    await brian.post("/api/items", foundPhone);
    expect((await brian.get("/api/notifications")).body.length).toBe(before);
  });

  it("still reports the found item even if no lost reports exist", async () => {
    await pool.query("DELETE FROM lost_report_matches");
    await pool.query("DELETE FROM lost_reports");
    const brian = await loginAs("brian@strathmore.test");
    expect((await brian.post("/api/items", foundPhone)).status).toBe(201);
  });
});

describe("GET /api/lost-reports and /:id", () => {
  it("lists only my reports, with how many claimable matches each has", async () => {
    const amani = await loginAs("amani@strathmore.test");
    const res = await amani.get("/api/lost-reports");
    expect(res.status).toBe(200);
    expect(res.body.map((r) => r.id)).toEqual([1]);
    expect(res.body[0].match_count).toBe(1);
  });

  it("another student's report is 403, an unknown one is 404", async () => {
    const wanjiku = await loginAs("wanjiku@strathmore.test");
    expectError(await wanjiku.get("/api/lost-reports/1"), 403);
    expectError(await wanjiku.get("/api/lost-reports/1/matches"), 403);
    expectError(await wanjiku.get("/api/lost-reports/99999"), 404);
  });
});

describe("PATCH /api/lost-reports/:id", () => {
  it("the owner can close and reopen a report", async () => {
    const amani = await loginAs("amani@strathmore.test");
    const closed = await amani.patch("/api/lost-reports/1", { status: "CLOSED" });
    expect(closed.status).toBe(200);
    expect(closed.body.status).toBe("CLOSED");
    expect((await amani.patch("/api/lost-reports/1", { status: "OPEN" })).body.status).toBe("OPEN");
  });

  it("rejects other statuses and other students", async () => {
    const amani = await loginAs("amani@strathmore.test");
    expectError(await amani.patch("/api/lost-reports/1", { status: "RESOLVED" }), 400);
    const brian = await loginAs("brian@strathmore.test");
    expectError(await brian.patch("/api/lost-reports/1", { status: "CLOSED" }), 403);
  });
});

describe("Claiming a matched item, with a price from both sides", () => {
  it("the owner's offer is stored on the claim and shown to the finder; approval resolves the report", async () => {
    const amani = await loginAs("amani@strathmore.test");
    const claim = await amani.post("/api/claims", {
      itemId: 4,
      evidence: "Three keys, the torch has a cracked lens.",
      offeredAmount: 150,
    });
    expect(claim.status).toBe(201);

    const brian = await loginAs("brian@strathmore.test"); // the finder of item 4
    const claims = await brian.get("/api/items/4/claims");
    expect(Number(claims.body[0].offered_amount)).toBe(150);

    const notes = await brian.get("/api/notifications");
    expect(notes.body[0].message).toMatch(/offer KSh 150\.00/);
    expect(notes.body[0].item_id).toBe(4);

    // The match stays on the owner's page after they claim it, showing their claim's status.
    const pending = await amani.get("/api/lost-reports/1/matches");
    expect(pending.body.map((m) => [m.id, m.my_claim_status])).toEqual([[4, "PENDING"]]);

    await brian.patch(`/api/claims/${claim.body.claimId}`, { status: "APPROVED" });
    const report = await amani.get("/api/lost-reports/1");
    expect(report.body.status).toBe("RESOLVED");
    const approved = await amani.get("/api/lost-reports/1/matches");
    expect(approved.body.map((m) => [m.id, m.my_claim_status])).toEqual([[4, "APPROVED"]]);
  });

  it("an item someone else has claimed is still offered, since their claim may be wrong", async () => {
    const wanjiku = await loginAs("wanjiku@strathmore.test");
    await wanjiku.post("/api/claims", { itemId: 4, evidence: "Those are my keys from the gate" });
    const amani = await loginAs("amani@strathmore.test");
    const matches = (await amani.get("/api/lost-reports/1/matches")).body;
    expect(matches.map((m) => [m.id, m.status, m.my_claim_status])).toEqual([[4, "CLAIMED", null]]);
    // ...and the owner can claim it too.
    expect((await amani.post("/api/claims", { itemId: 4, evidence: "Torch lens is cracked, blue sticker" })).status).toBe(201);
  });

  it("an item returned to someone else is no longer offered", async () => {
    const wanjiku = await loginAs("wanjiku@strathmore.test");
    const claim = await wanjiku.post("/api/claims", { itemId: 4, evidence: "Those are my keys from the gate" });
    const brian = await loginAs("brian@strathmore.test");
    await brian.patch(`/api/claims/${claim.body.claimId}`, { status: "APPROVED" });
    const amani = await loginAs("amani@strathmore.test");
    expect((await amani.get("/api/lost-reports/1/matches")).body).toEqual([]);
  });

  it("an offer is optional, but must be a sensible number", async () => {
    const amani = await loginAs("amani@strathmore.test");
    expectError(await amani.post("/api/claims", { itemId: 4, evidence: "Mine, torch lens cracked", offeredAmount: -1 }), 400, /Offered amount/);
    const ok = await amani.post("/api/claims", { itemId: 4, evidence: "Mine, torch lens cracked" });
    expect(ok.status).toBe(201);
    const [[row]] = await pool.query("SELECT offered_amount FROM claims WHERE id = ?", [ok.body.claimId]);
    expect(row.offered_amount).toBeNull();
  });
});
