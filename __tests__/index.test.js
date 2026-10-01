const core = require("@actions/core");
jest.mock("../src/slack", () => ({ postMessage: jest.fn() }));
const { postMessage } = require("../src/slack");
const { run } = require("../index");

const FAKE_TOKEN = "xoxb-test-token";

function mockInputs(overrides = {}) {
  const inputs = {
    "message-template": "Hello team!",
    "target-users": "alice, bob",
    "send-channel": "",
    "send-dm": "",
    "slack-bot-token": FAKE_TOKEN,
    "slack-channel-id": "C0123456789",
    "slack-reviewer-map": '{"alice": "U0123456789"}',
    ...overrides,
  };
  jest.spyOn(core, "getInput").mockImplementation((name) => inputs[name] ?? "");
}

describe("run", () => {
  let setFailedSpy;
  let setOutputSpy;

  beforeEach(() => {
    postMessage.mockClear();
    setFailedSpy = jest.spyOn(core, "setFailed").mockImplementation(() => {});
    setOutputSpy = jest.spyOn(core, "setOutput").mockImplementation(() => {});
    jest.spyOn(core, "info").mockImplementation(() => {});
    jest.spyOn(core, "error").mockImplementation(() => {});
    postMessage.mockImplementation(async ({ channel }) => ({ ts: `ts-${channel}` }));
  });

  afterEach(() => jest.restoreAllMocks());

  test("sends channel and mapped DMs with outputs", async () => {
    mockInputs();
    await run();
    expect(setFailedSpy).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenNthCalledWith(1, {
      token: FAKE_TOKEN, channel: "C0123456789", text: "Hello team! <@U0123456789> @bob",
    });
    expect(postMessage).toHaveBeenNthCalledWith(2, {
      token: FAKE_TOKEN, channel: "U0123456789", text: "Hello team!",
    });
    expect(setOutputSpy).toHaveBeenCalledWith("channel-ts", "ts-C0123456789");
    expect(setOutputSpy).toHaveBeenCalledWith("dm-ts", '{"U0123456789":"ts-U0123456789"}');
    expect(setOutputSpy).toHaveBeenCalledWith("dm-failures", "0");
  });

  test("allows empty target-users without trailing whitespace", async () => {
    mockInputs({ "target-users": "" });
    await run();
    expect(setFailedSpy).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith({ token: FAKE_TOKEN, channel: "C0123456789", text: "Hello team!" });
    expect(setOutputSpy).toHaveBeenCalledWith("dm-ts", "{}");
  });

  test("continues DMs after a failure and fails overall", async () => {
    mockInputs({ "target-users": "alice, bob", "slack-reviewer-map": '{"alice":"U111","bob":"U222"}' });
    postMessage.mockImplementation(async ({ channel }) => {
      if (channel === "U111") throw new Error("first failed");
      return { ts: "ts-U222" };
    });
    await run();
    expect(postMessage).toHaveBeenCalledTimes(3);
    expect(setOutputSpy).toHaveBeenCalledWith("dm-ts", '{"U222":"ts-U222"}');
    expect(setOutputSpy).toHaveBeenCalledWith("dm-failures", "1");
    expect(setFailedSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to send 1 Slack DM(s)"));
  });

  test("supports channel-only mode", async () => {
    mockInputs({ "send-dm": "false" });
    await run();
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  test("supports DM-only mode", async () => {
    mockInputs({ "send-channel": "false", "target-users": "alice", "slack-reviewer-map": '{"alice":"U0123456789"}' });
    await run();
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith({
      token: FAKE_TOKEN, channel: "U0123456789", text: "Hello team!",
    });
    expect(postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ channel: "C0123456789" }));
  });

  test("fails when channel sending is enabled without a channel ID", async () => {
    mockInputs({ "slack-channel-id": "  " });
    await run();
    expect(postMessage).not.toHaveBeenCalled();
    expect(setFailedSpy).toHaveBeenCalledWith(
      'Input "slack-channel-id" is required when "send-channel" is true.',
    );
  });

  test("sends no messages when channel and DM sending are disabled", async () => {
    mockInputs({ "send-channel": "false", "send-dm": "false" });
    await run();
    expect(postMessage).not.toHaveBeenCalled();
    expect(setFailedSpy).not.toHaveBeenCalled();
  });

  test("preserves special characters in a message without mentions", async () => {
    const message = 'line one\n"quoted" `code` ${value}\nline two';
    mockInputs({ "message-template": message, "target-users": "" });
    await run();
    expect(postMessage).toHaveBeenCalledWith({
      token: FAKE_TOKEN, channel: "C0123456789", text: message,
    });
  });

  test("fails on invalid reviewer map JSON", async () => {
    mockInputs({ "slack-reviewer-map": "{not-json" });
    await run();
    expect(setFailedSpy).toHaveBeenCalledWith(expect.stringMatching(/valid JSON/));
  });

  describe("mention-users", () => {
    const MAP = '{"alice":"U111","bob":"U222","carol":"U333"}';
    const channelCalls = () => postMessage.mock.calls.filter(([a]) => a.channel === "C0123456789");
    const dmCalls = () => postMessage.mock.calls.filter(([a]) => a.channel !== "C0123456789");

    test("mentions all mention-users in one channel post but DMs only target-users", async () => {
      mockInputs({
        "target-users": "alice", "mention-users": "alice,bob,carol",
        "send-channel": "true", "send-dm": "true", "slack-reviewer-map": MAP,
      });
      await run();
      expect(setFailedSpy).not.toHaveBeenCalled();
      expect(postMessage).toHaveBeenCalledTimes(2);
      expect(channelCalls()).toEqual([[{
        token: FAKE_TOKEN, channel: "C0123456789", text: "Hello team! <@U111> <@U222> <@U333>",
      }]]);
      expect(dmCalls()).toEqual([[{ token: FAKE_TOKEN, channel: "U111", text: "Hello team!" }]]);
      expect(setOutputSpy).toHaveBeenCalledWith("channel-ts", "ts-C0123456789");
      expect(setOutputSpy).toHaveBeenCalledWith("dm-ts", '{"U111":"ts-U111"}');
      expect(setOutputSpy).toHaveBeenCalledWith("dm-failures", "0");
    });

    test("DM-only run with mention-users DMs only the target user", async () => {
      mockInputs({
        "target-users": "bob", "mention-users": "alice,bob,carol",
        "send-channel": "false", "slack-reviewer-map": MAP,
      });
      await run();
      expect(setFailedSpy).not.toHaveBeenCalled();
      expect(postMessage).toHaveBeenCalledTimes(1);
      expect(postMessage).toHaveBeenCalledWith({ token: FAKE_TOKEN, channel: "U222", text: "Hello team!" });
      expect(setOutputSpy).not.toHaveBeenCalledWith("channel-ts", expect.anything());
      expect(setOutputSpy).toHaveBeenCalledWith("dm-ts", '{"U222":"ts-U222"}');
    });

    test.each([
      ["omitted", undefined],
      ["empty", ""],
      ["whitespace-only", "   "],
      ["commas only", " , , "],
    ])("falls back to target-users when mention-users is %s", async (_label, value) => {
      const overrides = { "target-users": "alice, bob", "slack-reviewer-map": MAP };
      if (value !== undefined) overrides["mention-users"] = value;
      mockInputs(overrides);
      await run();
      expect(setFailedSpy).not.toHaveBeenCalled();
      expect(postMessage.mock.calls).toEqual([
        [{ token: FAKE_TOKEN, channel: "C0123456789", text: "Hello team! <@U111> <@U222>" }],
        [{ token: FAKE_TOKEN, channel: "U111", text: "Hello team!" }],
        [{ token: FAKE_TOKEN, channel: "U222", text: "Hello team!" }],
      ]);
    });

    test("supports channel-only mentions with empty target-users", async () => {
      mockInputs({ "target-users": "", "mention-users": "alice,bob,carol", "slack-reviewer-map": MAP });
      await run();
      expect(setFailedSpy).not.toHaveBeenCalled();
      expect(postMessage.mock.calls).toEqual([
        [{ token: FAKE_TOKEN, channel: "C0123456789", text: "Hello team! <@U111> <@U222> <@U333>" }],
      ]);
      expect(setOutputSpy).toHaveBeenCalledWith("dm-ts", "{}");
      expect(setOutputSpy).toHaveBeenCalledWith("dm-failures", "0");
    });

    test("sends nothing when both flags are false even with mention-users", async () => {
      mockInputs({
        "target-users": "alice", "mention-users": "alice,bob,carol",
        "send-channel": "false", "send-dm": "false", "slack-reviewer-map": MAP,
      });
      await run();
      expect(postMessage).not.toHaveBeenCalled();
      expect(setFailedSpy).not.toHaveBeenCalled();
    });

    test("applies existing trimming, case-insensitive mapping, unmapped and duplicate handling", async () => {
      mockInputs({
        "target-users": " ALICE ,, ",
        "mention-users": " Alice , ,bob, dave , bob ",
        "slack-reviewer-map": '{"alice":"U111","bob":"U222"}',
      });
      await run();
      expect(setFailedSpy).not.toHaveBeenCalled();
      // Duplicates are not removed by existing parsing, so they are kept as-is.
      expect(postMessage.mock.calls).toEqual([
        [{ token: FAKE_TOKEN, channel: "C0123456789", text: "Hello team! <@U111> <@U222> <@U222> @dave" }],
        [{ token: FAKE_TOKEN, channel: "U111", text: "Hello team!" }],
      ]);
    });

    test("does not DM mention-only users and keeps DM failure semantics", async () => {
      mockInputs({
        "target-users": "alice", "mention-users": "alice,bob,carol", "slack-reviewer-map": MAP,
      });
      postMessage.mockImplementation(async ({ channel }) => {
        if (channel === "U111") throw new Error("dm failed");
        return { ts: `ts-${channel}` };
      });
      await run();
      expect(postMessage).toHaveBeenCalledTimes(2);
      expect(dmCalls().map(([a]) => a.channel)).toEqual(["U111"]);
      expect(setOutputSpy).toHaveBeenCalledWith("dm-ts", "{}");
      expect(setOutputSpy).toHaveBeenCalledWith("dm-failures", "1");
      expect(setFailedSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to send 1 Slack DM(s)"));
    });

    // Simulates the caller contract only: the upstream urgent action supplies
    // send-channel per run. This does not prove cross-run leader consistency.
    test("three caller runs with send-channel only on the first produce one channel post and one DM each", async () => {
      const runs = [
        { "target-users": "alice", "send-channel": "true" },
        { "target-users": "bob", "send-channel": "false" },
        { "target-users": "carol", "send-channel": "false" },
      ];
      for (const overrides of runs) {
        mockInputs({ ...overrides, "mention-users": "alice,bob,carol", "send-dm": "true", "slack-reviewer-map": MAP });
        await run();
      }
      expect(setFailedSpy).not.toHaveBeenCalled();
      expect(channelCalls()).toEqual([[{
        token: FAKE_TOKEN, channel: "C0123456789", text: "Hello team! <@U111> <@U222> <@U333>",
      }]]);
      expect(dmCalls().map(([a]) => a.channel)).toEqual(["U111", "U222", "U333"]);
    });
  });
});
