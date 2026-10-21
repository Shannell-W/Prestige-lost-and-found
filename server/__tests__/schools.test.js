const { app, request, PREFIX } = require("./helpers");

describe("GET /schools/:schoolId/item-statistics", () => {
  it("not-found: unknown school returns 404", async () => {
    const res = await request(app).get(`${PREFIX}/schools/DOES-NOT-EXIST/item-statistics`);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("message");
  });

  it("happy path: returns numeric aggregate counts", async () => {
    const res = await request(app).get(
      `${PREFIX}/schools/${encodeURIComponent(process.env.TEST_SCHOOL)}/item-statistics`
    );
    expect(res.status).toBe(200);
    ["totalItems", "claimedItems", "returnedItems"].forEach((f) => {
      expect(res.body).toHaveProperty(f);
      expect(typeof res.body[f]).toBe("number");
    });
  });

  it("edge: counts are never negative", async () => {
    const res = await request(app).get(
      `${PREFIX}/schools/${encodeURIComponent(process.env.TEST_SCHOOL)}/item-statistics`
    );
    expect(res.body.totalItems).toBeGreaterThanOrEqual(0);
  });
});