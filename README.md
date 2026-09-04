# Slack Dual Notify Action

A GitHub Marketplace JavaScript Action that sends a Slack **channel notification** and/or **direct messages (DMs)** to reviewers, mapping GitHub usernames to Slack user IDs via a reviewer map.

It supports sending notifications to a channel, mapped reviewers by DM, or both.

This action is a drop-in replacement for the previous `workflow_call` reusable workflow ("Reusable Slack Notification") that relied on `actions/github-script` and `slackapi/slack-github-action`. It keeps the exact same functional behavior while being publishable as a standalone Marketplace action.

## Inputs

| Input                | Required                              | Default | Description |
|-----------------------|----------------------------------------|---------|-------------|
| `message-template`    | Yes                                    | —       | Message body sent to Slack. Newlines, whitespace, and special characters (quotes, backticks, `${...}`) are preserved exactly as provided. |
| `target-users`        | Yes                                    | —       | Comma-separated list of usernames to notify, e.g. `alice, bob`. Entries are trimmed and empty entries removed. |
| `send-channel`        | No                                     | `true`  | Whether to send a notification to the Slack channel. |
| `send-dm`             | No                                     | `true`  | Whether to send direct messages to users who are mapped to a Slack user ID. |
| `slack-bot-token`     | Yes                                    | —       | Slack bot token (e.g. from `secrets.SLACK_BOT_TOKEN`) used to authenticate API requests. |
| `slack-channel-id`    | Required when `send-channel` is `true` | —       | Slack channel ID to post the channel notification to. |
| `slack-reviewer-map`  | Yes                                    | —       | JSON object mapping GitHub usernames to Slack user IDs, e.g. `{ "alice": "U0123456789" }`. Lookup is **case-insensitive**. |

## Behavior

- `target-users` is split on commas, trimmed, and empty entries are removed.
- Each user is looked up in `slack-reviewer-map` case-insensitively.
  - Mapped users are rendered as `<@SLACK_USER_ID>` in the channel message.
  - Unmapped users are rendered as `@username` in the channel message.
- When `send-channel` is `true`, the action calls Slack's [`chat.postMessage`](https://api.slack.com/methods/chat.postMessage) with `channel: slack-channel-id` and `text: "<message-template> <mentions>"`.
- When `send-dm` is `true` **and** at least one user was mapped, the action calls `chat.postMessage` once per mapped Slack user ID, with `channel: <slack user id>` and `text: <message-template>` (without the mention list).
  - No DM is sent to unmapped users.
  - No DM is sent at all if there are no mapped users, even if `send-dm` is `true`.
- If `send-channel` is `false`, no channel message is sent.
- If `send-dm` is `false`, no DMs are sent.
- Any Slack API failure (non-2xx HTTP status, or `ok: false` in the JSON response) fails the action. Error messages never include the bot token — only the target channel/user ID and Slack's error code are surfaced.

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

`SLACK_REVIEWER_MAP` is a repository or organization secret containing a JSON object, for example:

```json
{ "alice": "U0123456789", "bob": "U9876543210" }
```

### Migrating from the reusable workflow

Previously, callers used:

```yaml
jobs:
  notify:
    uses: my-org/my-repo/.github/workflows/reusable-slack-notify.yml@main
    with:
      message_template: ${{ inputs.message_template }}
      target_users: ${{ inputs.target_users }}
      send_channel: ${{ inputs.send_channel }}
      send_dm: ${{ inputs.send_dm }}
    secrets:
      SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
      SLACK_CHANNEL_ID: ${{ secrets.SLACK_CHANNEL_ID }}
      SLACK_REVIEWER_MAP: ${{ secrets.SLACK_REVIEWER_MAP }}
```

Now, call this action directly from a job step:

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

## Slack app setup

Create/configure a Slack app with a bot token that has the following OAuth scopes:

- `chat:write` — required to post channel messages and DMs.
- `chat:write.public` (optional) — allows posting to public channels the bot has not been invited to.

The bot must be a member of the target channel (or have `chat:write.public`), and it must share a workspace with each target user for DMs to succeed.

## Development

```bash
npm install
npm test        # Jest unit tests
npm run lint    # ESLint
npm run build   # ncc bundle -> dist/index.js + dist/licenses.txt
```

### Test results

All 34 tests pass across 5 suites (`reviewer-map`, `mentions`, `boolean-input`, `slack`, `index`), covering:

- Case-insensitive reviewer map lookup and mention formatting (mapped/unmapped).
- Trimming and empty-entry removal for `target-users`.
- Channel-only, DM-only, both-enabled, and both-disabled combinations.
- No DM sent when there are no mapped users.
- Multiple DMs sent to multiple mapped users.
- Invalid `slack-reviewer-map` JSON, invalid boolean inputs, and missing required inputs.
- Slack HTTP errors and `ok: false` JSON responses.
- Message templates containing newlines, quotes, backticks, and `${...}` placeholders.

`npm run lint` and `npm run build` both complete without errors, and `dist/index.js` is committed and up to date with the compiled `src/` and `index.js` sources.

## Known limitations

- DM delivery attempts continue for all mapped users even if one fails, but the action is still marked as failed overall if any DM could not be delivered.
- Slack rate limits are not automatically retried; a `429` response will fail the action.
- The reviewer map is expected to be flat key/value pairs of `username -> Slack user ID` strings; nested structures are rejected.
