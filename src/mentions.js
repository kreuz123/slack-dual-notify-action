const { lookupSlackId } = require("./reviewer-map");

/**
 * Splits a comma-separated list of usernames, trimming whitespace and
 * removing empty entries.
 *
 * @param {string} targetUsers - Comma-separated usernames, e.g. "alice, bob,, carol".
 * @returns {string[]} Cleaned list of usernames.
 */
function parseTargetUsers(targetUsers) {
  return targetUsers
    .split(",")
    .map((user) => user.trim())
    .filter(Boolean);
}

/**
 * Resolves the mention text and Slack IDs for a list of target usernames.
 *
 * @param {string[]} targetUsers - Cleaned list of usernames.
 * @param {Map<string, string>} reviewerMap - Map produced by parseReviewerMap.
 * @returns {{ mentions: string, slackIds: string[] }} Space-joined mention
 *   text (mapped users as `<@ID>`, unmapped users as `@username`) and the
 *   list of resolved Slack user IDs, in the same relative order.
 */
function buildMentions(targetUsers, reviewerMap) {
  const slackIds = [];
  const textUsers = [];

  for (const user of targetUsers) {
    const id = lookupSlackId(reviewerMap, user);
    if (id) {
      slackIds.push(id);
    } else {
      textUsers.push(user);
    }
  }

  const mentions = [...slackIds.map((id) => `<@${id}>`), ...textUsers.map((u) => `@${u}`)].join(" ");

  return { mentions, slackIds };
}

module.exports = { parseTargetUsers, buildMentions };
