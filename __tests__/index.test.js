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
});
