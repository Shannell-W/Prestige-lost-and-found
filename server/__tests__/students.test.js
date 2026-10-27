// Contract endpoint: GET /students/{studentId}/claims, plus the /api/students privacy fix.
const { app, request, pool, resetDb, ISO, keysOf, expectError } = require("../test/helpers");

beforeAll(resetDb);
afterAll(() => pool.end());

describe("GET /students/:studentId/claims", () => {
  it("happy path: returns the student's claims, oldest first, in the contract shape", async () => {
    const res = await request(app).get("/students/SU-1001/claims");
    expect(res.status).toBe(200);
    expect(res.body.map((c) => c.claimId)).toEqual(["1", "2"]);
    res.body.forEach((c) => {
      expect(keysOf(c)).toEqual(["claimId", "itemId", "status", "submittedAt"]);
      expect(["pending", "claimed", "rejected"]).toContain(c.status);
      expect(c.submittedAt).toMatch(ISO);
    });
    expect(res.body[0]).toMatchObject({ claimId: "1", itemId: "1", status: "claimed" });
  });

  it("edge: a real student with no claims gets an empty list, not 404", async () => {
    const res = await request(app).get("/students/KU-2001/claims");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("not found: an unknown student gives 404", async () => {
    expectError(await request(app).get("/students/DOES-NOT-EXIST-999/claims"), 404, /student not found/);
  });
});

describe("GET /api/students (privacy)", () => {
  it("never returns email addresses", async () => {
    const res = await request(app).get("/api/students");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    res.body.forEach((s) => expect(s).not.toHaveProperty("email"));
    const one = await request(app).get("/api/students/SU-1001");
    expect(one.body).not.toHaveProperty("email");
  });
});
