const core = require("@actions/core");
const { parseBooleanInput } = require("./src/boolean-input");
const { parseReviewerMap } = require("./src/reviewer-map");
const { parseTargetUsers, buildMentions } = require("./src/mentions");
const { postMessage } = require("./src/slack");

async function run() {
  try {
    const messageTemplate = core.getInput("message-template", { required: true, trimWhitespace: false });
    const targetUsersInput = core.getInput("target-users");
    const mentionUsersInput = core.getInput("mention-users");
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
    const { slackIds } = buildMentions(targetUsers, reviewerMap);
    const parsedMentionUsers = parseTargetUsers(mentionUsersInput);
    const mentionUsers = parsedMentionUsers.length > 0 ? parsedMentionUsers : targetUsers;
    const { mentions } = buildMentions(mentionUsers, reviewerMap);

    if (sendChannel) {
      const channelText = mentions ? `${messageTemplate} ${mentions}` : messageTemplate;
      const result = await postMessage({ token, channel: channelId.trim(), text: channelText });
      core.setOutput("channel-ts", result.ts || "");
      core.info(`Slack channel notification sent to ${channelId.trim()}`);
    }

    const dmTimestamps = {};
    const errors = [];
    if (sendDm && slackIds.length > 0) {
      for (const userId of slackIds) {
        try {
          const result = await postMessage({ token, channel: userId, text: messageTemplate });
          dmTimestamps[userId] = result.ts || "";
          core.info(`Slack DM sent to ${userId}`);
        } catch (error) {
          core.error(error.message);
          errors.push(error.message);
        }
      }
      core.info(`Processed ${slackIds.length} Slack DM(s)`);
    }
    core.setOutput("dm-ts", JSON.stringify(dmTimestamps));
    core.setOutput("dm-failures", String(errors.length));
    if (errors.length > 0) {
      throw new Error(`Failed to send ${errors.length} Slack DM(s): ${errors.join("; ")}`);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

module.exports = { run };

if (require.main === module) run();
