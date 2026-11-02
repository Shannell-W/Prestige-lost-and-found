// Filters on GET /api/items, used by the Browse Items page.
const { app, request, pool, resetDb } = require("../test/helpers");

beforeAll(resetDb);
afterAll(() => pool.end());

const ids = (res) => res.body.map((i) => i.id).sort((a, b) => a - b);

describe("GET /api/items filters", () => {
  it("by category", async () => {
    expect(ids(await request(app).get("/api/items?category=Electronics"))).toEqual([2]);
  });

  it("by location (part of the name)", async () => {
    expect(ids(await request(app).get("/api/items?location=gate"))).toEqual([4]);
  });

  it("by date found range", async () => {
    expect(ids(await request(app).get("/api/items?dateFrom=2026-10-04&dateTo=2026-10-05"))).toEqual([3, 5]);
  });

  it("combined with the existing school, status and search filters", async () => {
    const res = await request(app).get(
      "/api/items?school=Strathmore%20University&status=found&search=keys&category=Other"
    );
    expect(ids(res)).toEqual([4]);
  });

  it("ignores dates that aren't YYYY-MM-DD", async () => {
    expect((await request(app).get("/api/items?dateFrom=yesterday")).body).toHaveLength(5);
  });
});
