# Slack Dual Notify Action

A GitHub Action that sends a Slack channel notification, direct messages (DMs) to reviewers, or both. Map GitHub usernames to Slack user IDs to mention reviewers in the channel and notify them directly.

## Features

- ✅ Sends to a Slack channel, mapped reviewers by DM, or both.
- ✅ Resolves GitHub usernames case-insensitively through a reviewer map.
- ✅ Mentions mapped users as `<@SLACK_USER_ID>` and leaves unmapped users as `@username`.
- ✅ Supports channel-only notifications with an empty reviewer map (`{}`).
- ✅ Retries transient Slack API failures and rate limits through `@slack/web-api`.
- ✅ Fails safely when Slack rejects a request—error messages never expose the bot token.

## How it works

1. Splits `target-users` on commas, trims whitespace, and removes empty entries.
2. Looks up each GitHub username in `slack-reviewer-map`.
3. When `send-channel` is enabled, posts the message to `slack-channel-id`, adding reviewer mentions when applicable.
4. When `send-dm` is enabled, sends the original message to every mapped Slack user. Unmapped users do not receive DMs.
5. If any DM fails, the action still attempts the remaining DMs, then fails the step after all attempts finish.

If no mapped users are supplied, no DMs are sent. Set both `send-channel` and `send-dm` to `false` to skip sending messages.

## Usage

```yaml
name: Notify reviewers on Slack

on:
  pull_request:
    types: [review_requested]

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Send Slack notification
        uses: kreuz123/slack-dual-notify-action@v1
        with:
          message-template: |
            A new PR needs your review!
          target-users: alice, bob, carol
          send-channel: true
          send-dm: true
          slack-bot-token: ${{ secrets.SLACK_BOT_TOKEN }}
          slack-channel-id: ${{ secrets.SLACK_CHANNEL_ID }}
          slack-reviewer-map: ${{ secrets.SLACK_REVIEWER_MAP }}
```

Store `SLACK_REVIEWER_MAP` as a repository or organization secret:

```json
{ "alice": "U0123456789", "bob": "U9876543210" }
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `message-template` | Yes | — | Message body to send. Newlines and special characters are preserved. |
| `target-users` | No | `""` | Comma-separated GitHub usernames, such as `alice, bob`. |
| `send-channel` | No | `true` | Send a notification to the Slack channel. |
| `send-dm` | No | `true` | Send DMs to users found in the reviewer map. |
| `slack-bot-token` | Yes | — | Slack bot token, typically `${{ secrets.SLACK_BOT_TOKEN }}`. |
| `slack-channel-id` | When `send-channel` is `true` | — | Target Slack channel ID. |
| `slack-reviewer-map` | Yes | — | JSON map of GitHub usernames to Slack user IDs. Use `{}` for channel-only notifications. |

## Outputs

| Output | Description |
|---|---|
| `channel-ts` | Timestamp of the channel message, when one was sent. |
| `dm-ts` | JSON object mapping successfully messaged Slack user IDs to timestamps. |
| `dm-failures` | Number of failed DM deliveries. |

## Slack app setup

Your Slack bot needs:

- `chat:write` to send channel messages and DMs.
- `chat:write.public` *(optional)* to post to public channels the bot has not joined.

The bot must be in the target channel unless it has `chat:write.public`, and it must share a workspace with DM recipients.

## Migrating from the reusable workflow

Replace a reusable-workflow job with a normal job step and use hyphenated action inputs:

```yaml
jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - uses: kreuz123/slack-dual-notify-action@v1
        with:
          message-template: ${{ inputs.message_template }}
          target-users: ${{ inputs.target_users }}
          send-channel: ${{ inputs.send_channel }}
          send-dm: ${{ inputs.send_dm }}
          slack-bot-token: ${{ secrets.SLACK_BOT_TOKEN }}
          slack-channel-id: ${{ secrets.SLACK_CHANNEL_ID }}
          slack-reviewer-map: ${{ secrets.SLACK_REVIEWER_MAP }}
```

## Notes

- Slack requests use a 10-second timeout and up to three SDK retries, including rate-limit retries.
- A Slack API error (non-2xx response or `ok: false`) fails the action.
- The reviewer map must be a flat JSON object of `GitHub username -> Slack user ID` string pairs.

## Development

```bash
npm install
npm test
npm run lint
npm run build
```

## License

[MIT](LICENSE)
