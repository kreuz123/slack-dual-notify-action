const { parseTargetUsers, buildMentions } = require("../src/mentions");
const { parseReviewerMap } = require("../src/reviewer-map");

describe("parseTargetUsers", () => {
  test("trims whitespace and removes empty entries", () => {
    expect(parseTargetUsers(" alice , bob,, carol ")).toEqual(["alice", "bob", "carol"]);
  });

  test("returns an empty array when input has no usable entries", () => {
    expect(parseTargetUsers(" , , ")).toEqual([]);
  });
});

describe("buildMentions", () => {
  test("maps known users to <@ID> and unknown users to @username", () => {
    const reviewerMap = parseReviewerMap('{"alice": "U0123456789"}');
    const { mentions, slackIds } = buildMentions(["alice", "bob"], reviewerMap);
    expect(mentions).toBe("<@U0123456789> @bob");
    expect(slackIds).toEqual(["U0123456789"]);
  });

  test("performs case-insensitive matching", () => {
    const reviewerMap = parseReviewerMap('{"Alice": "U0123456789"}');
    const { mentions, slackIds } = buildMentions(["ALICE"], reviewerMap);
    expect(mentions).toBe("<@U0123456789>");
    expect(slackIds).toEqual(["U0123456789"]);
  });

  test("returns empty mentions and slackIds when there are no target users", () => {
    const reviewerMap = parseReviewerMap("{}");
    const { mentions, slackIds } = buildMentions([], reviewerMap);
    expect(mentions).toBe("");
    expect(slackIds).toEqual([]);
  });

  test("supports multiple mapped users", () => {
    const reviewerMap = parseReviewerMap('{"alice": "U111", "bob": "U222"}');
    const { mentions, slackIds } = buildMentions(["alice", "bob"], reviewerMap);
    expect(mentions).toBe("<@U111> <@U222>");
    expect(slackIds).toEqual(["U111", "U222"]);
  });
});
