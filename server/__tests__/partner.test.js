// Week 13: the parsers for Team 4's API (partner.js). Every version must give our page the same thing.
const { versions, currentVersion } = require("../partner");

const wanted = [{ id: "1", name: "Royal Arena", capacity: 1200, location: "Nairobi", genres: "Afrobeats,R&B,Pop" }];

describe("Team 4 venues: v1 parser", () => {
  it("reads their live server's shape (venueName)", () => {
    const body = [{ id: 1, userId: 3, venueName: "Royal Arena", location: "Nairobi", capacity: 1200,
      supportedGenres: "Afrobeats,R&B,Pop", description: "Large venue" }];
    expect(versions.v1.parse(body)).toEqual(wanted);
  });

  it("also reads their contract's shape (name)", () => {
    expect(versions.v1.parse([{ id: "venue-1", name: "North Quad Hall", capacity: 450 }])).toEqual([
      { id: "venue-1", name: "North Quad Hall", capacity: 450 },
    ]);
  });

  it("fails loudly on a shape it doesn't know, e.g. a wrapped list", () => {
    const message = (fn) => {
      try {
        fn();
      } catch (err) {
        return err.message;
      }
      return "no error";
    };
    expect(message(() => versions.v1.parse({ data: [], count: 0 }))).toMatch(/^unexpected v1 shape/);
    expect(message(() => versions.v1.parse([{ id: 1, title: "Royal Arena", capacity: 1200 }]))).toMatch(/^unexpected v1 shape/);
  });
});

describe("PARTNER_VERSION", () => {
  afterEach(() => delete process.env.PARTNER_VERSION);

  it("defaults to v1", () => {
    expect(currentVersion().name).toBe("v1");
    expect(currentVersion().path).toBe("/api/venues");
  });

  it("an unknown version falls back to v1 instead of crashing", () => {
    process.env.PARTNER_VERSION = "v9"; // prints a warning naming the mistake
    expect(currentVersion().name).toBe("v1");
  });
});
