// The word matching in matching.js, without a database.
const { words, scorePair, confidence, MIN_SCORE } = require("../matching");

describe("words()", () => {
  it("drops common words, folds plurals and synonyms", () => {
    expect([...words("I lost my black Backpacks near the library")].sort()).toEqual(["bag", "black", "library"]);
    expect(words("keys").has("key")).toBe(true);
    expect(words("watches").has("watch")).toBe(true);
    expect(words("glass").has("glass")).toBe(true); // "ss" is not a plural
    expect(words("mobile").has("phone")).toBe(true);
  });
});

describe("scorePair()", () => {
  const item = {
    title: "Scientific calculator",
    description: "Casio fx-991ES with initials scratched on the back.",
    category: "Electronics",
    location: "Science Lab 3",
  };

  it("scores a close description high", () => {
    const s = scorePair({ title: "Casio calculator", description: "initials on the back", category: "Electronics", location: "Lab 3" }, item);
    expect(s.score).toBeGreaterThanOrEqual(9);
    expect(confidence(s.score)).toBe("high");
    expect(s.matchedWords).toEqual(expect.arrayContaining(["calculator", "casio"]));
  });

  it("same category alone is not a match", () => {
    const s = scorePair({ title: "Laptop charger", category: "Electronics" }, item);
    expect(s.score).toBe(0);
  });

  it("one shared word in another category is below the threshold", () => {
    const s = scorePair({ title: "Back brace", category: "Other" }, item);
    expect(s.score).toBeLessThan(MIN_SCORE);
  });

  it("a title word in the same category is enough", () => {
    const s = scorePair({ title: "Calculator", category: "Electronics" }, item);
    expect(s.score).toBeGreaterThanOrEqual(MIN_SCORE);
  });
});
