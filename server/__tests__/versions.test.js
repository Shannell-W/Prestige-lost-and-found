// Week 13: v2 beside v1. v1 must not change; v2 wraps lists in { data, count };
// v1's changed endpoints announce their sunset; everything still needs a key.
const { app, request, rawRequest, pool, resetDb } = require("../test/helpers");
const { V1_SUNSET } = require("../deprecate");

const SUNSET = new Date(`${V1_SUNSET}T00:00:00Z`).toUTCString(); // "Mon, 16 Nov 2026 00:00:00 GMT"
const CLAIM_FIELDS = ["claimId", "itemId", "rewardAmountCents", "status", "studentId"];
const STUDENT_CLAIM_FIELDS = ["claimId", "itemId", "status", "submittedAt"];

beforeAll(resetDb);
afterAll(() => pool.end());

describe("v1 is frozen", () => {
  it("GET /v1/claims keeps its original shape: a bare list with exactly the contract's fields", async () => {
    const res = await request(app).get("/v1/claims").query({ status: "pending" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(Object.keys(res.body[0]).sort()).toEqual(CLAIM_FIELDS);
  });

  it("the old unversioned /claims answers exactly like /v1/claims", async () => {
    const a = await request(app).get("/claims").query({ status: "pending" });
    const b = await request(app).get("/v1/claims").query({ status: "pending" });
    expect(a.status).toBe(200);
    expect(a.body).toEqual(b.body);
  });

  it("the old /students/:id/claims is still a bare list, same as /v1", async () => {
    const a = await request(app).get("/students/SU-1001/claims");
    const b = await request(app).get("/v1/students/SU-1001/claims");
    expect(Array.isArray(a.body)).toBe(true);
    expect(Object.keys(a.body[0]).sort()).toEqual(STUDENT_CLAIM_FIELDS);
    expect(a.body).toEqual(b.body);
  });

  it("v1 error shapes are unchanged", async () => {
    const noStatus = await request(app).get("/v1/claims");
    expect(noStatus.status).toBe(400);
    expect(noStatus.body).toEqual({ error: "status query parameter is required" });
    const noStudent = await request(app).get("/v1/students/NOBODY/claims");
    expect(noStudent.status).toBe(404);
    expect(noStudent.body).toEqual({ error: "student not found" });
  });

  it("other v1 endpoints also answer under /v1, unchanged", async () => {
    const a = await request(app).get("/claims/1/fees");
    const b = await request(app).get("/v1/claims/1/fees");
    expect(a.status).toBe(200);
    expect(b.body).toEqual(a.body);
  });
});

describe("v2 has the new shape", () => {
  it("GET /v2/claims wraps the list in { data, count }, with the same items as v1", async () => {
    const v1 = await request(app).get("/claims").query({ status: "pending" });
    const v2 = await request(app).get("/v2/claims").query({ status: "pending" });
    expect(v2.status).toBe(200);
    expect(Object.keys(v2.body).sort()).toEqual(["count", "data"]);
    expect(v2.body.count).toBe(2);
    expect(v2.body.data).toEqual(v1.body);
  });

  it("the status filter still works on v2", async () => {
    const res = await request(app).get("/v2/claims").query({ status: "claimed" });
    expect(res.body.data.map((c) => c.claimId)).toEqual(["1"]);
    expect(res.body.count).toBe(1);
  });

  it("GET /v2/students/:id/claims is wrapped too, and an empty list is { data: [], count: 0 }", async () => {
    const res = await request(app).get("/v2/students/SU-1001/claims");
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(res.body.data.length);
    expect(Object.keys(res.body.data[0]).sort()).toEqual(STUDENT_CLAIM_FIELDS);
    const empty = await request(app).get("/v2/students/SU-1003/claims");
    expect(empty.body).toEqual({ data: [], count: 0 });
  });

  it("v2 errors use the same shape as v1", async () => {
    expect((await request(app).get("/v2/claims")).body).toEqual({ error: "status query parameter is required" });
    expect((await request(app).get("/v2/students/NOBODY/claims")).status).toBe(404);
  });

  it("v2 needs an API key like everything else", async () => {
    expect((await rawRequest(app).get("/v2/claims").query({ status: "claimed" })).status).toBe(401);
  });
});

describe("deprecation headers", () => {
  it("v1 and the old URLs of the changed endpoints announce the sunset and point to v2", async () => {
    const cases = [
      ["/claims?status=claimed", "</v2/claims>"],
      ["/v1/claims?status=claimed", "</v2/claims>"],
      ["/students/SU-1001/claims", "</v2/students/SU-1001/claims>"],
      ["/v1/students/SU-1001/claims", "</v2/students/SU-1001/claims>"],
    ];
    for (const [path, successor] of cases) {
      const res = await request(app).get(path);
      expect(res.headers.deprecation).toBe("true");
      expect(res.headers.sunset).toBe(SUNSET);
      expect(res.headers.link).toBe(`${successor}; rel="successor-version"`);
    }
  });

  it("v2, unchanged v1 endpoints and unknown paths do not carry them", async () => {
    for (const path of ["/v2/claims?status=claimed", "/claims/1/fees", "/schools/Strathmore%20University/item-statistics", "/nope"]) {
      const res = await request(app).get(path);
      expect(res.headers.deprecation).toBeUndefined();
    }
  });
});
