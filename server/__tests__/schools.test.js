// Contract endpoint: GET /schools/{schoolId}/item-statistics (schoolId is the school's name).
const { app, request, pool, resetDb, keysOf, expectError } = require("../test/helpers");

beforeAll(resetDb);
afterAll(() => pool.end());

const STRATHMORE = encodeURIComponent("Strathmore University");

describe("GET /schools/:schoolId/item-statistics", () => {
  it("happy path: returns live totals in the contract shape", async () => {
    const res = await request(app).get(`/schools/${STRATHMORE}/item-statistics`);
    expect(res.status).toBe(200);
    expect(keysOf(res.body)).toEqual([
      "schoolId",
      "schoolName",
      "totalItemsClaimed",
      "totalItemsReported",
      "totalRewardAmountPaidCents",
    ]);
    expect(res.body).toEqual({
      schoolId: "Strathmore University",
      schoolName: "Strathmore University",
      totalItemsReported: 4,
      totalItemsClaimed: 1,
      totalRewardAmountPaidCents: 15000,
    });
  });

  it("edge: a school with nothing returned gets zeros as numbers, not an error", async () => {
    const res = await request(app).get(`/schools/${encodeURIComponent("Kenyatta University")}/item-statistics`);
    expect(res.status).toBe(200);
    expect(res.body.totalItemsClaimed).toBe(0);
    expect(res.body.totalRewardAmountPaidCents).toBe(0);
  });

  it("not found: an unknown school gives 404", async () => {
    expectError(await request(app).get("/schools/DOES-NOT-EXIST/item-statistics"), 404, /school not found/);
  });
});
