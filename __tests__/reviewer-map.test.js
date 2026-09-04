const { parseReviewerMap, lookupSlackId } = require("../src/reviewer-map");

describe("parseReviewerMap", () => {
  test("parses a valid JSON object", () => {
    const map = parseReviewerMap('{"alice": "U0123456789"}');
    expect(lookupSlackId(map, "alice")).toBe("U0123456789");
  });

  test("throws a clear error for invalid JSON", () => {
    expect(() => parseReviewerMap("{not json")).toThrow(/must contain valid JSON/);
  });

  test("throws when JSON is not an object", () => {
    expect(() => parseReviewerMap("[1,2,3]")).toThrow(/must be a JSON object/);
    expect(() => parseReviewerMap('"a string"')).toThrow(/must be a JSON object/);
    expect(() => parseReviewerMap("null")).toThrow(/must be a JSON object/);
  });

  test("throws when a value is not a non-empty string", () => {
    expect(() => parseReviewerMap('{"alice": 123}')).toThrow(/invalid Slack user ID/);
    expect(() => parseReviewerMap('{"alice": ""}')).toThrow(/invalid Slack user ID/);
  });
});

describe("lookupSlackId", () => {
  test("is case-insensitive on both map keys and lookup username", () => {
    const map = parseReviewerMap('{"Alice": "U0123456789", "bob": "U9876543210"}');
    expect(lookupSlackId(map, "alice")).toBe("U0123456789");
    expect(lookupSlackId(map, "ALICE")).toBe("U0123456789");
    expect(lookupSlackId(map, "Bob")).toBe("U9876543210");
  });

  test("returns undefined when username is not mapped", () => {
    const map = parseReviewerMap('{"alice": "U0123456789"}');
    expect(lookupSlackId(map, "carol")).toBeUndefined();
  });
});
