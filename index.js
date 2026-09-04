const core = require("@actions/core");
const { parseBooleanInput } = require("./src/boolean-input");
const { parseReviewerMap } = require("./src/reviewer-map");
const { parseTargetUsers, buildMentions } = require("./src/mentions");
const { postMessage } = require("./src/slack");

async function run() {
  try {
    const messageTemplate = core.getInput("message-template", { required: true, trimWhitespace: false });
    const targetUsersInput = core.getInput("target-users", { required: true });
    const token = core.getInput("slack-bot-token", { required: true });
    const reviewerMapInput = core.getInput("slack-reviewer-map", { required: true });

    const sendChannel = parseBooleanInput("send-channel", core.getInput("send-channel"), true);
    const sendDm = parseBooleanInput("send-dm", core.getInput("send-dm"), true);

    const channelId = core.getInput("slack-channel-id");
    if (sendChannel && channelId.trim() === "") {
      throw new Error('Input "slack-channel-id" is required when "send-channel" is true.');
    }

    const reviewerMap = parseReviewerMap(reviewerMapInput);
    const targetUsers = parseTargetUsers(targetUsersInput);
    const { mentions, slackIds } = buildMentions(targetUsers, reviewerMap);

    if (sendChannel) {
      const channelText = `${messageTemplate} ${mentions}`;
      await postMessage({ token, channel: channelId.trim(), text: channelText });
      core.info(`Slack channel notification sent to ${channelId.trim()}`);
    }

    if (sendDm && slackIds.length > 0) {
      const errors = [];
      for (const userId of slackIds) {
        try {
          await postMessage({ token, channel: userId, text: messageTemplate });
          core.info(`Slack DM sent to ${userId}`);
        } catch (error) {
          core.error(error.message);
          errors.push(error.message);
        }
      }
      if (errors.length > 0) {
        throw new Error(`Failed to send ${errors.length} Slack DM(s): ${errors.join("; ")}`);
      }
      core.info(`Processed ${slackIds.length} Slack DM(s)`);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

module.exports = { run };

if (require.main === module) run();
