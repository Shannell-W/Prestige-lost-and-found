const { app, request, PREFIX, getToken } = require("./helpers");

describe("GET /students/:studentId/claims", () => {
  it("rejects requests with no authentication", async () => {
    const res = await request(app).get(`${PREFIX}/students/TEST123/claims`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("message");
  });

  it("not-found: unknown student returns 404", async () => {
    const token = await getToken();
    const res = await request(app)
      .get(`${PREFIX}/students/DOES-NOT-EXIST-999/claims`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("happy path: returns claims with a status field", async () => {
    const token = await getToken();
    const res = await request(app)
      .get(`${PREFIX}/students/${process.env.TEST_STUDENT_ID}/claims`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    res.body.forEach((c) => expect(typeof c.status).toBe("string"));
  });
});