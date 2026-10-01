# Slack Dual Notify Action

A GitHub Action that sends a Slack channel notification, direct messages (DMs) to reviewers, or both. Map GitHub usernames to Slack user IDs to mention reviewers in the channel and notify them directly.

## Features

- ✅ Sends to a Slack channel, mapped reviewers by DM, or both.
- ✅ Resolves GitHub usernames case-insensitively through a reviewer map.
- ✅ Mentions mapped users as `<@SLACK_USER_ID>` and leaves unmapped users as `@username`.
- ✅ Supports channel-only notifications with an empty reviewer map (`{}`).
- ✅ Optionally mentions a different set of users in the channel (`mention-users`) than the users who receive DMs (`target-users`).
- ✅ Retries transient Slack API failures and rate limits through `@slack/web-api`.
- ✅ Fails safely when Slack rejects a request—error messages never expose the bot token.

## How it works

1. Splits `target-users` (and `mention-users`, if set) on commas, trims whitespace, and removes empty entries. Duplicates are not removed.
2. Looks up each GitHub username in `slack-reviewer-map`.
3. When `send-channel` is enabled, posts the message to `slack-channel-id`, adding mentions for `mention-users`—or for `target-users` when `mention-users` contains no usernames.
4. When `send-dm` is enabled, sends the original message to every mapped Slack user in `target-users`. Unmapped users and users listed only in `mention-users` do not receive DMs.
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

### Separate channel mentions and DM recipients

`mention-users` controls **only** who is mentioned in the channel message. `target-users` controls **only** who receives DMs. For example, this run posts one channel message mentioning Alice, Bob, and Carol, and DMs only Alice:

```yaml
      - uses: kreuz123/slack-dual-notify-action@v1 # requires a release that includes mention-users
        with:
          message-template: Urgent PR needs review
          mention-users: alice, bob, carol # channel mentions only
          target-users: alice              # DM recipients only
          send-channel: true
          send-dm: true
          slack-bot-token: ${{ secrets.SLACK_BOT_TOKEN }}
          slack-channel-id: ${{ secrets.SLACK_CHANNEL_ID }}
          slack-reviewer-map: ${{ secrets.SLACK_REVIEWER_MAP }}
```

If `mention-users` is omitted, empty, whitespace-only, or contains only commas, the channel mentions fall back to `target-users`, so existing workflows behave exactly as before. An empty value is **not** a way to suppress mentions.

### Integration with `urgent-pr-slack-notification`

> **Companion update required.** This snippet depends on a companion change in [`kreuz123/urgent-pr-slack-notification`](https://github.com/kreuz123/urgent-pr-slack-notification) that adds the `mention-users` output and decides `send-channel` per run. Neither that output nor `mention-users` in this action is available in currently published tags; pin both actions to releases that include these changes before using it. Release this action first so that it accepts `mention-users` before the caller starts sending it.

```yaml
      - id: check
        uses: kreuz123/urgent-pr-slack-notification@<release-with-mention-users>
        # ...

      - if: steps.check.outputs.urgent == 'true'
        uses: kreuz123/slack-dual-notify-action@<release-with-mention-users>
        with:
          message-template: ${{ steps.check.outputs.message }}
          target-users: ${{ steps.check.outputs.target-users }}   # unchanged
          mention-users: ${{ steps.check.outputs.mention-users }} # new
          send-channel: ${{ steps.check.outputs.send-channel }}
          send-dm: ${{ steps.check.outputs.send-dm }}
          slack-bot-token: ${{ secrets.SLACK_BOT_TOKEN }}
          slack-channel-id: ${{ secrets.SLACK_CHANNEL_ID }}
          slack-reviewer-map: ${{ secrets.SLACK_REVIEWER_MAP }}
```

Adjust the `steps.check.outputs.*` names to match the outputs of the urgent action version you use.

### Responsibilities and limitations

- This action handles **one workflow run at a time**. It does not deduplicate messages across runs or reruns and cannot enforce exactly-once delivery.
- Whether a run posts to the channel is decided entirely by the caller through `send-channel`. Avoiding duplicate channel posts for a PR created with several reviewers relies on the upstream action setting `send-channel: true` in only one run.
- `mention-users` does not solve differences between the reviewer lists seen by different runs, or a failure of the run chosen to post to the channel; in those cases there may be duplicate or missing channel messages.
- Rerunning a workflow sends its messages again.
- Error handling is unchanged: the channel message is sent before DMs, and if the channel post fails, the step fails before any DMs are attempted. DM failures do not stop the remaining DMs, but they fail the step after all attempts.

**Tested:** unit tests with mocked Slack requests cover separate channel mentions and DM recipients, fallback to `target-users`, channel-only, DM-only, and disabled modes, normalization and unmapped users, DM failures, and a simulated three-run caller where only the first run has `send-channel: true` (one channel post, one DM per reviewer). That simulation only checks this action's input contract; it does not show that the upstream action picks one leader consistently.

**Not tested:** live Slack or GitHub integration, concurrent `review_requested` runs, workflow reruns, and partial Slack send failures in a real environment.

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `message-template` | Yes | — | Message body to send. Newlines and special characters are preserved. |
| `target-users` | No | `""` | Comma-separated GitHub usernames, such as `alice, bob`. Determines DM recipients, and channel mentions when `mention-users` is not set. |
| `mention-users` | No | `""` | Comma-separated GitHub usernames to mention in the channel message only, resolved through `slack-reviewer-map`. Never receive DMs unless also in `target-users`. Falls back to `target-users` when it contains no usernames. |
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
