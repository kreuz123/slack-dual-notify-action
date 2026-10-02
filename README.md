# Slack Dual Notify Action

A GitHub Action that sends a Slack channel message, reviewer direct messages (DMs), or both. Use it on its own, with [`kreuz123/urgent-pr-slack-notification`](https://github.com/kreuz123/urgent-pr-slack-notification), or with another workflow or action that provides a message and reviewer usernames.

`kreuz123/urgent-pr-slack-notification` is the recommended companion action. It detects pull requests with an `urgent` label and decides who to notify. `slack-dual-notify-action` sends the Slack channel message and reviewer DMs.

For instructions on setting up both actions together, see the [`urgent-pr-slack-notification` README](https://github.com/kreuz123/urgent-pr-slack-notification#readme).

## Setup

Complete Slack setup first, then add the Slack values as GitHub Actions secrets in the repository that will run the workflow.

### 1. Create and configure a Slack app

Go to [Slack API: Your Apps](https://api.slack.com/apps), select **Create New App**, and create an app for your Slack workspace.

Under **OAuth & Permissions**, add these **Bot Token Scopes**:

- `chat:write` — required to send channel messages and DMs.
- `chat:write.public` — optional; lets the bot post to public channels it has not joined.

Select **Install to Workspace** (or reinstall the app if you changed its permissions), authorize it, and copy the **Bot User OAuth Token**. Keep this token private; store it only as a secret.

### 2. Give the bot access to the channel

For a private channel, invite the bot to the channel. For a public channel, you can invite the bot or use the optional `chat:write.public` scope to post without joining. The bot also needs to share a workspace with the users it will DM.

### 3. Find the Slack channel and user IDs

Open the target channel in a browser. A Slack URL looks like:

```text
https://app.slack.com/client/T0123456789/C0123456789
```

Use the final `C...` value as the channel ID.

To find a user's ID, open their Slack profile, select **More** → **Copy member ID**, and use that value in the reviewer map.

For example, this JSON maps GitHub usernames to Slack user IDs:

```json
{
  "alice": "U0123456789",
  "bob": "U9876543210"
}
```

GitHub username matching is case-insensitive. Use `{}` if you only need channel notifications and do not need reviewer DMs or mapped Slack mentions.

### 4. Create GitHub Actions secrets

In the repository where you use this action, go to **Settings → Secrets and variables → Actions** and create these repository secrets:

| Secret | Value |
|---|---|
| `SLACK_BOT_TOKEN` | The Slack bot token. Store it only as a secret; never put it directly in a workflow file. |
| `SLACK_CHANNEL_ID` | The channel ID from the Slack URL. Needed when `send-channel` is `true`. |
| `SLACK_REVIEWER_MAP` | The JSON map of GitHub usernames to Slack user IDs, or `{}` for channel-only notifications. |

You can use organization secrets instead when multiple repositories share the same Slack configuration.

## Quick start

Once the Slack app and secrets are ready, add a workflow like this to the repository. Replace the trigger and usernames to match your workflow:

```yaml
name: Notify reviewers on Slack

on:
  pull_request:
    types: [review_requested]

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - uses: kreuz123/slack-dual-notify-action@v1
        with:
          message-template: A new PR needs your review!
          target-users: alice, bob
          send-channel: true
          send-dm: true
          slack-bot-token: ${{ secrets.SLACK_BOT_TOKEN }}
          slack-channel-id: ${{ secrets.SLACK_CHANNEL_ID }}
          slack-reviewer-map: ${{ secrets.SLACK_REVIEWER_MAP }}
```

## Use with `urgent-pr-slack-notification`

Use the urgent PR action's outputs as inputs to this action. Configure the first action for your workflow:

```yaml
- id: check
  uses: kreuz123/urgent-pr-slack-notification@v1
  # Configure the urgent PR action here.

- if: steps.check.outputs.urgent == 'true'
  uses: kreuz123/slack-dual-notify-action@v1
  with:
    message-template: ${{ steps.check.outputs.message }}
    target-users: ${{ steps.check.outputs.target-users }}
    mention-users: ${{ steps.check.outputs.mention-users }}
    send-channel: ${{ steps.check.outputs.send-channel }}
    send-dm: ${{ steps.check.outputs.send-dm }}
    slack-bot-token: ${{ secrets.SLACK_BOT_TOKEN }}
    slack-channel-id: ${{ secrets.SLACK_CHANNEL_ID }}
    slack-reviewer-map: ${{ secrets.SLACK_REVIEWER_MAP }}
```

Adjust the output names to match the version of `urgent-pr-slack-notification` you use. See its [README](https://github.com/kreuz123/urgent-pr-slack-notification#readme) for the complete combined setup.

## `target-users` and `mention-users`

- `target-users` lists GitHub usernames who receive DMs. If `mention-users` is empty or omitted, these users are also mentioned in the channel.
- `mention-users` lists users to mention in the channel only. They receive DMs only if they are also in `target-users`.

For example, this sends one channel message mentioning Alice and Bob, but sends a DM only to Alice:

```yaml
with:
  message-template: Urgent PR needs review
  mention-users: alice, bob
  target-users: alice
  send-channel: true
  send-dm: true
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `message-template` | Yes | — | Message body to send. |
| `target-users` | No | `""` | Comma-separated GitHub usernames who receive DMs. Also used for channel mentions when `mention-users` is empty. |
| `mention-users` | No | `""` | Comma-separated GitHub usernames to mention in the channel. Does not determine DM recipients. |
| `send-channel` | No | `true` | Whether to send a channel message. |
| `send-dm` | No | `true` | Whether to send DMs to mapped `target-users`. |
| `slack-bot-token` | Yes | — | Slack bot token. |
| `slack-channel-id` | When `send-channel` is `true` | — | Slack channel ID. |
| `slack-reviewer-map` | Yes | — | JSON map of GitHub usernames to Slack user IDs. |

## Outputs

| Output | Description |
|---|---|
| `channel-ts` | Timestamp of the channel message, when one was sent. |
| `dm-ts` | JSON map of Slack user IDs and timestamps for successfully sent DMs. |
| `dm-failures` | Number of failed DM deliveries. |

## Notes

- GitHub usernames are matched case-insensitively. Users without a Slack ID mapping are shown as `@username` in the channel and do not receive a DM.
- The action retries transient Slack API and rate-limit failures. Slack request failures fail the action without exposing the bot token.
- Rerunning a workflow sends notifications again.

## Development

```bash
npm install
npm test
npm run lint
npm run build
```

## License

[MIT](LICENSE)
