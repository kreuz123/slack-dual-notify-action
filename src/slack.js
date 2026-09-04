const { WebClient } = require("@slack/web-api");

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
  const client = new WebClient(token, {
    timeout: 10000,
    retryConfig: { retries: 3 },
  });
  try {
    return await client.chat.postMessage({ channel, text });
  } catch (error) {
    const code = error.data?.error || error.code || error.message || "unknown_error";
    throw new Error(`Slack request to ${channel} failed: ${code}`);
  }
}

module.exports = { postMessage };
