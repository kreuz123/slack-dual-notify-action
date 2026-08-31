const SLACK_POST_MESSAGE_URL = "https://slack.com/api/chat.postMessage";

/**
 * Sends a message via Slack's chat.postMessage API.
 *
 * @param {object} options
 * @param {string} options.token - Slack bot token used as the bearer credential.
 * @param {string} options.channel - Slack channel ID or user ID to post to.
 * @param {string} options.text - Message text to send.
 * @throws {Error} If the HTTP request fails, or Slack responds with `ok: false`.
 *   Error messages never include the token and only reference the safe
 *   channel/user ID and Slack error code.
 */
async function postMessage({ token, channel, text }) {
  const authorizationHeader = ["Bearer", token].join(" ");
  let response;
  try {
    response = await fetch(SLACK_POST_MESSAGE_URL, {
      method: "POST",
      headers: {
        Authorization: authorizationHeader,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ channel, text }),
    });
  } catch (error) {
    throw new Error(`Slack request to ${channel} failed: ${error.message}`);
  }

  if (!response.ok) {
    throw new Error(`Slack request to ${channel} failed with HTTP status ${response.status}`);
  }

  const result = await response.json();
  if (!result.ok) {
    throw new Error(`Slack request to ${channel} failed: ${result.error || "unknown_error"}`);
  }

  return result;
}

module.exports = { postMessage };
