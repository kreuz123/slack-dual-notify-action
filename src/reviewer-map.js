/**
 * Parses the SLACK_REVIEWER_MAP JSON input into a case-insensitive lookup map.
 *
 * @param {string} rawJson - Raw JSON string, e.g. `{ "alice": "U0123456789" }`.
 * @returns {Map<string, string>} Map keyed by lowercase username to Slack user ID.
 * @throws {Error} If the input is not valid JSON or not a plain object.
 */
function parseReviewerMap(rawJson) {
  let parsed;
  try {
    parsed = JSON.parse(rawJson);
  } catch (error) {
    throw new Error(`Input "slack-reviewer-map" must contain valid JSON: ${error.message}`);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error('Input "slack-reviewer-map" must be a JSON object, e.g. { "alice": "U0123456789" }');
  }

  const normalized = new Map();
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`Input "slack-reviewer-map" contains an invalid Slack user ID for key "${key}"`);
    }
    normalized.set(key.toLowerCase(), value.trim());
  }

  return normalized;
}

/**
 * Performs a case-insensitive lookup of a username in the reviewer map.
 *
 * @param {Map<string, string>} reviewerMap - Map produced by parseReviewerMap.
 * @param {string} username - Username to look up.
 * @returns {string|undefined} Slack user ID if found, otherwise undefined.
 */
function lookupSlackId(reviewerMap, username) {
  return reviewerMap.get(username.toLowerCase());
}

module.exports = { parseReviewerMap, lookupSlackId };
