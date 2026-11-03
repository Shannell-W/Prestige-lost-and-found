// The word matching in matching.js, without a database.
const { words, scorePair, similarWord, confidence, MIN_SCORE } = require("../matching");

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

describe("spelling mistakes", () => {
  it("forgives a small typo in longer words", () => {
    expect(similarWord("calculater", new Set(["calculator"]))).toBe("calculator");
    expect(similarWord("umbrela", new Set(["umbrella"]))).toBe("umbrella");
    expect(similarWord("headfones", new Set(["headphones"]))).toBe("headphones"); // 2 edits, 9+ letters
    expect(similarWord("keychian", new Set(["keychain"]))).toBe("keychain"); // swapped letters = 1 edit
  });

  it("a misspelt synonym still folds: 'bakpack' is a bag", () => {
    expect(words("bakpack").has("bag")).toBe(true);
  });

  it("does not stretch short words, numbers, or different first letters", () => {
    expect(similarWord("black", new Set(["block"]))).toBeNull();
    expect(similarWord("fx991es", new Set(["fx992es"]))).toBeNull();
    expect(similarWord("wallet", new Set(["mallet"]))).toBeNull();
  });

  it("a misspelt lost report still finds the item, and shows the item's spelling", () => {
    const s = scorePair(
      { title: "Casio calculater", category: "Electronics" },
      { title: "Scientific calculator", description: "Casio fx-991ES", category: "Electronics", location: "Lab 3" }
    );
    expect(s.score).toBeGreaterThanOrEqual(MIN_SCORE);
    expect(s.matchedWords).toContain("calculator");
  });
});
