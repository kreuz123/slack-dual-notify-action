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
    mockInputs({ "send-channel": "false" });
    await run();
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  test("fails when channel response is missing a message timestamp", async () => {
    mockInputs({ "send-dm": "false" });
    postMessage.mockImplementation(async () => ({ ts: "" }));
    await run();
    expect(setFailedSpy).toHaveBeenCalledWith(
      expect.stringContaining("Slack response for channel C0123456789 is missing a message timestamp."),
    );
    expect(setOutputSpy).not.toHaveBeenCalledWith("channel-ts", expect.anything());
  });

  test("treats a DM response missing a timestamp as a failure while other DMs continue", async () => {
    mockInputs({ "target-users": "alice, bob", "slack-reviewer-map": '{"alice":"U111","bob":"U222"}' });
    postMessage.mockImplementation(async ({ channel }) => {
      if (channel === "U111") return { ts: "" };
      return { ts: `ts-${channel}` };
    });
    await run();
    expect(postMessage).toHaveBeenCalledTimes(3);
    expect(setOutputSpy).toHaveBeenCalledWith("dm-ts", '{"U222":"ts-U222"}');
    expect(setOutputSpy).toHaveBeenCalledWith("dm-failures", "1");
    expect(setFailedSpy).toHaveBeenCalledWith(expect.stringContaining("missing a message timestamp"));
  });

  test("fails on invalid reviewer map JSON", async () => {
    mockInputs({ "slack-reviewer-map": "{not-json" });
    await run();
    expect(setFailedSpy).toHaveBeenCalledWith(expect.stringMatching(/valid JSON/));
  });
});
