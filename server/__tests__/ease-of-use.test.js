// The ease-of-use features: alerts by email/SMS, phone & alert settings, pickup details,
// the finder's check question, photo uploads, "N students are looking", reminders and Home statistics.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { app, request, pool, resetDb, loginAs, expectError } = require("../test/helpers");
const { waitForAlerts, normalizePhone } = require("../alerts");
const { runReminders } = require("../reminders");
const { UPLOAD_DIR } = require("../routes/uploads");

beforeEach(resetDb);
afterAll(() => pool.end());

const phoneLost = {
  title: "Samsung phone",
  description: "Black Samsung phone, cracked screen, blue case",
  category: "Electronics",
  location: "Library",
  dateLost: "2026-10-10",
};
const phoneFound = {
  title: "Black mobile phone",
  description: "Samsung, cracked screen, blue case",
  category: "Electronics",
  location: "Library entrance",
  dateFound: "2026-10-11",
};

describe("Email and SMS alerts", () => {
  let server;
  let received;
  const saved = {};
  const KEYS = ["RESEND_API_KEY", "EMAIL_FROM", "RESEND_URL", "AT_USERNAME", "AT_API_KEY", "AT_URL"];

  beforeAll(async () => {
    // A stand-in for Resend and Africa's Talking that records what it was sent.
    server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        received.push({ path: req.url, headers: req.headers, body });
        res.writeHead(201, { "Content-Type": "application/json" }).end("{}");
      });
    });
    await new Promise((r) => server.listen(0, r));
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const k of KEYS) saved[k] = process.env[k];
    Object.assign(process.env, {
      RESEND_API_KEY: "re_test",
      EMAIL_FROM: "Lost & Found <alerts@test>",
      RESEND_URL: `${base}/email`,
      AT_USERNAME: "sandbox",
      AT_API_KEY: "at_test",
      AT_URL: `${base}/sms`,
    });
  });
  afterAll(async () => {
    for (const k of KEYS) (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]));
    await new Promise((r) => server.close(r));
  });
  beforeEach(() => (received = []));

  it("a match is emailed and texted to the owner, using their settings", async () => {
    const amani = await loginAs("amani@strathmore.test");
    await amani.patch("/api/profile", { phone: "0712 345 678" });
    await amani.post("/api/lost-reports", phoneLost);

    const brian = await loginAs("brian@strathmore.test");
    await brian.post("/api/items", phoneFound);
    await waitForAlerts();

    const email = received.find((r) => r.path === "/email");
    expect(email.headers.authorization).toBe("Bearer re_test");
    const sent = JSON.parse(email.body);
    expect(sent.to).toEqual(["amani@strathmore.test"]);
    expect(sent.text).toMatch(/Samsung phone/);
    expect(sent.text).toMatch(/\/notifications/);

    const sms = received.find((r) => r.path === "/sms");
    expect(sms.headers.apikey).toBe("at_test");
    const form = new URLSearchParams(sms.body);
    expect(form.get("to")).toBe("+254712345678");
    expect(form.get("username")).toBe("sandbox");
    expect(form.get("message")).toMatch(/Samsung phone/);
  });

  it("no SMS without a phone, nothing when the student turned alerts off", async () => {
    const amani = await loginAs("amani@strathmore.test");
    await amani.post("/api/lost-reports", phoneLost);
    const brian = await loginAs("brian@strathmore.test");
    await brian.post("/api/items", phoneFound);
    await waitForAlerts();
    expect(received.map((r) => r.path)).toEqual(["/email"]);

    received = [];
    await amani.patch("/api/profile", { phone: "0712345678", alertsEmail: false, alertsSms: false });
    await brian.post("/api/items", { ...phoneFound, title: "Samsung phone in blue case" });
    await waitForAlerts();
    expect(received).toEqual([]);
  });

  it("alerts inside a transaction go out after it commits (claim submitted -> finder)", async () => {
    const amani = await loginAs("amani@strathmore.test");
    await amani.post("/api/claims", { itemId: 3, evidence: "My name is printed on the card." });
    await waitForAlerts();
    const email = received.find((r) => r.path === "/email");
    expect(JSON.parse(email.body).to).toEqual(["wanjiku@strathmore.test"]); // Wanjiku found item 3
  });

  it("a failing provider never breaks the request", async () => {
    process.env.RESEND_URL = "http://127.0.0.1:9/nothing-here";
    const errors = jest.spyOn(console, "error").mockImplementation(() => {});
    const amani = await loginAs("amani@strathmore.test");
    const res = await amani.post("/api/claims", { itemId: 3, evidence: "My name is printed on the card." });
    await waitForAlerts();
    expect(res.status).toBe(201);
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
    process.env.RESEND_URL = `http://127.0.0.1:${server.address().port}/email`;
  });
});

describe("Phone and alert settings", () => {
  it("normalizes Kenyan numbers", () => {
    expect(normalizePhone("0712345678")).toBe("+254712345678");
    expect(normalizePhone("+254 712 345 678")).toBe("+254712345678");
    expect(normalizePhone("254112345678")).toBe("+254112345678");
    expect(normalizePhone("12345")).toBeNull();
  });

  it("register takes an optional phone", async () => {
    const base = { name: "New", studentId: "SU-9", school: "Strathmore University", email: "n@s.test", password: "pw123456", confirmPassword: "pw123456" };
    expectError(await request(app).post("/api/auth/register").send({ ...base, phone: "abc" }), 400, /Kenyan mobile/);
    expect((await request(app).post("/api/auth/register").send({ ...base, phone: "0798765432" })).status).toBe(201);
    const [[u]] = await pool.query("SELECT phone, alerts_email, alerts_sms FROM users WHERE email = 'n@s.test'");
    expect(u).toEqual({ phone: "+254798765432", alerts_email: 1, alerts_sms: 1 });
  });

  it("profile shows and updates the settings", async () => {
    const amani = await loginAs("amani@strathmore.test");
    const res = await amani.patch("/api/profile", { phone: "0712345678", alertsSms: false });
    expect(res.body).toMatchObject({ phone: "+254712345678", alerts_email: 1, alerts_sms: 0 });
    expect((await amani.get("/api/profile")).body).toMatchObject({ phone: "+254712345678", alerts_sms: 0 });
    expect((await amani.patch("/api/profile", { phone: "" })).body.phone).toBeNull();
    expectError(await amani.patch("/api/profile", { alertsEmail: "yes" }), 400);
    expectError(await amani.patch("/api/profile", {}), 400);
  });
});

describe("Finder: handover, check question, demand", () => {
  it("reports where to collect it and a check question; the pickup note stays private", async () => {
    const brian = await loginAs("brian@strathmore.test");
    const res = await brian.post("/api/items", {
      ...phoneFound,
      handover: "SECURITY",
      handoverNote: "Security desk at the main gate, ask for Mr. Otieno",
      checkQuestion: "What is the lock-screen photo?",
    });
    expect(res.status).toBe(201);

    const item = (await request(app).get(`/api/items/${res.body.itemId}`)).body;
    expect(item).toMatchObject({ handover: "SECURITY", check_question: "What is the lock-screen photo?" });
    expect(item).not.toHaveProperty("handover_note");
    const list = (await request(app).get("/api/items")).body;
    expect(list.every((i) => !("handover_note" in i))).toBe(true);
  });

  it("rejects an unknown handover", async () => {
    const brian = await loginAs("brian@strathmore.test");
    expectError(await brian.post("/api/items", { ...phoneFound, handover: "POST_OFFICE" }), 400, /FINDER or SECURITY/);
  });

  it("tells the finder how many students are looking for something like it", async () => {
    const amani = await loginAs("amani@strathmore.test");
    await amani.post("/api/lost-reports", phoneLost);
    const wanjiku = await loginAs("wanjiku@strathmore.test");
    await wanjiku.post("/api/lost-reports", { ...phoneLost, title: "Samsung mobile" });
    const brian = await loginAs("brian@strathmore.test");
    expect((await brian.post("/api/items", phoneFound)).body.lookingCount).toBe(2);
    expect((await brian.post("/api/items", { ...phoneFound, title: "Red umbrella", description: "", category: "Other" })).body.lookingCount).toBe(0);
  });

  it("the check question must be answered, and the finder sees the answer", async () => {
    const brian = await loginAs("brian@strathmore.test");
    const { itemId } = (await brian.post("/api/items", { ...phoneFound, checkQuestion: "What is the lock-screen photo?" })).body;
    const amani = await loginAs("amani@strathmore.test");
    expectError(await amani.post("/api/claims", { itemId, evidence: "Blue case with a crack" }), 400, /answer the finder/);
    const ok = await amani.post("/api/claims", { itemId, evidence: "Blue case with a crack", checkAnswer: "My dog Simba" });
    expect(ok.status).toBe(201);
    const claims = (await brian.get(`/api/items/${itemId}/claims`)).body;
    expect(claims[0].check_answer).toBe("My dog Simba");
  });
});

describe("Pickup details after approval", () => {
  async function approvedClaim() {
    const brian = await loginAs("brian@strathmore.test");
    await pool.query("UPDATE items SET handover = 'SECURITY', handover_note = 'Main gate security desk' WHERE id = 4");
    await pool.query("UPDATE users SET phone = '+254700000003' WHERE id = 3");
    const amani = await loginAs("amani@strathmore.test");
    const claim = await amani.post("/api/claims", { itemId: 4, evidence: "Torch lens is cracked", offeredAmount: 120 });
    return { brian, amani, claimId: claim.body.claimId };
  }

  it("is hidden until approved, then shown to both sides with the other's contact", async () => {
    const { brian, amani, claimId } = await approvedClaim();
    expectError(await amani.get(`/api/claims/${claimId}/handover`), 409, /once the claim is approved/);

    await brian.patch(`/api/claims/${claimId}`, { status: "APPROVED" });
    const notes = (await amani.get("/api/notifications")).body;
    expect(notes[0].message).toMatch(/approved\. Open My Claims to see how to collect it/);

    const owner = (await amani.get(`/api/claims/${claimId}/handover`)).body;
    expect(owner).toMatchObject({
      role: "owner",
      handover: "SECURITY",
      handoverNote: "Main gate security desk",
      contact: { name: "Brian Kiprop", email: "brian@strathmore.test", phone: "+254700000003" },
    });
    expect(Number(owner.agreedAmount)).toBe(120);
    expect(owner.instructions).toMatch(/campus security/);

    const finder = (await brian.get(`/api/claims/${claimId}/handover`)).body;
    expect(finder).toMatchObject({ role: "finder", contact: { name: "Amani Otieno", email: "amani@strathmore.test" } });
  });

  it("nobody else can see it", async () => {
    const { brian, claimId } = await approvedClaim();
    await brian.patch(`/api/claims/${claimId}`, { status: "APPROVED" });
    const wanjiku = await loginAs("wanjiku@strathmore.test");
    expectError(await wanjiku.get(`/api/claims/${claimId}/handover`), 403);
    expectError(await wanjiku.get("/api/claims/99999/handover"), 404);
  });
});

describe("Photo uploads", () => {
  // The smallest valid PNG (1x1 pixel).
  const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const created = [];
  afterAll(() => created.forEach((f) => fs.rmSync(path.join(UPLOAD_DIR, f), { force: true })));

  it("saves a real image and serves it without an API key", async () => {
    const brian = await loginAs("brian@strathmore.test");
    const res = await brian.post("/api/uploads", { image: `data:image/png;base64,${PNG}` });
    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(/^\/uploads\/[0-9a-f]{32}\.png$/);
    created.push(path.basename(res.body.url));

    const supertest = require("supertest");
    const img = await supertest(app).get(res.body.url); // no X-API-Key, like an <img> tag
    expect(img.status).toBe(200);
    expect(img.headers["content-type"]).toBe("image/png");
  });

  it("refuses non-images, fakes, and anonymous uploads", async () => {
    const brian = await loginAs("brian@strathmore.test");
    expectError(await brian.post("/api/uploads", { image: "data:text/html;base64,PGgxPmhpPC9oMT4=" }), 400, /JPEG, PNG or WebP/);
    expectError(await brian.post("/api/uploads", { image: "data:image/png;base64,PGgxPmhpPC9oMT4=" }), 400, /not a real image/);
    expectError(await brian.post("/api/uploads", {}), 400);
    expectError(await request(app).post("/api/uploads").send({ image: `data:image/png;base64,${PNG}` }), 401);
  });

  it("a photo that is too big gets a clear 413", async () => {
    const brian = await loginAs("brian@strathmore.test");
    const huge = "A".repeat(6 * 1024 * 1024);
    expectError(await brian.post("/api/uploads", { image: `data:image/png;base64,${huge}` }), 413, /smaller than 3 MB/);
  });
});

describe("Still-looking reminders", () => {
  it("reminds once per 30 days for open reports, with a link to the report", async () => {
    // Seed: reports 1 and 2 are OPEN, created early October 2026.
    const now = new Date("2026-11-20T08:00:00Z");
    expect(await runReminders(pool, now)).toBe(2);
    expect(await runReminders(pool, now)).toBe(0); // not again straight away

    const amani = await loginAs("amani@strathmore.test");
    const note = (await amani.get("/api/notifications")).body.find((n) => n.lost_report_id === 1);
    expect(note.message).toMatch(/Still looking for your "Silver keys with torch"/);

    expect(await runReminders(pool, new Date("2026-12-21T08:00:00Z"))).toBe(2); // 30 days later
    await pool.query("UPDATE lost_reports SET status = 'CLOSED' WHERE id = 1");
    expect(await runReminders(pool, new Date("2027-01-21T08:00:00Z"))).toBe(1); // closed ones are left alone
  });

  it("new reports aren't reminded", async () => {
    expect(await runReminders(pool, new Date("2026-10-20T08:00:00Z"))).toBe(0);
  });
});

describe("GET /api/statistics/summary", () => {
  it("returns real numbers for the Home page", async () => {
    const res = await request(app).get("/api/statistics/summary");
    expect(res.body).toEqual({ itemsPosted: 5, itemsReturned: 1, claimsSubmitted: 3, studentsLooking: 2, schools: 2 });
  });
});
