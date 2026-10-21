const request = require("supertest");
const app = require("../index");

describe("Items API", () => {

  // GET /api/items
  test("GET /api/items returns an array of items", async () => {
    const res = await request(app)
      .get("/api/items");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty("id");
      expect(res.body[0]).toHaveProperty("title");
      expect(res.body[0]).toHaveProperty("category");
      expect(res.body[0]).toHaveProperty("location");
      expect(res.body[0]).toHaveProperty("status");
    }
  });

  // GET /api/items?status=FOUND
  test("GET /api/items supports status filtering", async () => {
    const res = await request(app)
      .get("/api/items")
      .query({ status: "FOUND" });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    res.body.forEach((item) => {
      expect(item.status).toBe("FOUND");
    });
  });

  // GET /api/items?search=...
  test("GET /api/items supports search filtering", async () => {
    const res = await request(app)
      .get("/api/items")
      .query({ search: "xyz-no-match-999999" });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  // GET /api/items/:id
  test("GET /api/items/:id returns an existing item", async () => {
    const list = await request(app)
      .get("/api/items");

    expect(list.status).toBe(200);

    if (list.body.length === 0) {
      return;
    }

    const itemId = list.body[0].id;

    const res = await request(app)
      .get(`/api/items/${itemId}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id", itemId);
    expect(res.body).toHaveProperty("title");
    expect(res.body).toHaveProperty("category");
    expect(res.body).toHaveProperty("location");
    expect(res.body).toHaveProperty("status");
  });

  // Not found
  test("GET /api/items/:id returns 404 for a non-existent item", async () => {
    const res = await request(app)
      .get("/api/items/999999999");

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "Item not found");
  });

  // GET /api/items/claimed
  test("GET /api/items/claimed returns claimed items", async () => {
    const res = await request(app)
      .get("/api/items/claimed");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty("id");
      expect(res.body[0]).toHaveProperty("title");
      expect(res.body[0]).toHaveProperty("reward_amount");
      expect(res.body[0].status).toBe("CLAIMED");
    }
  });

});