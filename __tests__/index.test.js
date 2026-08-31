const core = require("@actions/core");

const { run } = require("../index");
const FAKE_TOKEN = ["xoxb", "test", "token"].join("-");

function mockInputs(overrides = {}) {
  const defaults = {
    "message-template": "Hello team!",
    "target-users": "alice, bob",
    "send-channel": "",
    "send-dm": "",
    "slack-bot-token": FAKE_TOKEN,
    "slack-channel-id": "C0123456789",
    "slack-reviewer-map": '{"alice": "U0123456789"}',
  };
  const inputs = { ...defaults, ...overrides };
  jest.spyOn(core, "getInput").mockImplementation((name) => inputs[name] ?? "");
}

describe("run", () => {
  let setFailedSpy;

  beforeEach(() => {
    setFailedSpy = jest.spyOn(core, "setFailed").mockImplementation(() => {});
    jest.spyOn(core, "info").mockImplementation(() => {});
    jest.spyOn(core, "error").mockImplementation(() => {});
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("sends channel message with mixed mapped/unmapped mentions and DMs to mapped users only", async () => {
    mockInputs();
    await run();

    expect(setFailedSpy).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(2);

    const [channelUrl, channelOptions] = global.fetch.mock.calls[0];
    expect(channelUrl).toBe("https://slack.com/api/chat.postMessage");
    const channelBody = JSON.parse(channelOptions.body);
    expect(channelBody.channel).toBe("C0123456789");
    expect(channelBody.text).toBe("Hello team! <@U0123456789> @bob");

    const [, dmOptions] = global.fetch.mock.calls[1];
    const dmBody = JSON.parse(dmOptions.body);
    expect(dmBody.channel).toBe("U0123456789");
    expect(dmBody.text).toBe("Hello team!");
  });

  test("is case-insensitive when mapping reviewer usernames", async () => {
    mockInputs({ "target-users": "ALICE", "slack-reviewer-map": '{"alice": "U0123456789"}' });
    await run();

    expect(setFailedSpy).not.toHaveBeenCalled();
    const [, channelOptions] = global.fetch.mock.calls[0];
    expect(JSON.parse(channelOptions.body).text).toBe("Hello team! <@U0123456789>");
  });

  test("trims target-users and removes empty entries", async () => {
    mockInputs({ "target-users": " alice ,, bob ,  " });
    await run();

    expect(setFailedSpy).not.toHaveBeenCalled();
    const [, channelOptions] = global.fetch.mock.calls[0];
    expect(JSON.parse(channelOptions.body).text).toBe("Hello team! <@U0123456789> @bob");
  });

  test("does not send channel message when send-channel is false", async () => {
    mockInputs({ "send-channel": "false", "target-users": "alice" });
    await run();

    expect(setFailedSpy).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, dmOptions] = global.fetch.mock.calls[0];
    expect(JSON.parse(dmOptions.body).channel).toBe("U0123456789");
  });

  test("does not send DMs when send-dm is false", async () => {
    mockInputs({ "send-dm": "false", "target-users": "alice" });
    await run();

    expect(setFailedSpy).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, channelOptions] = global.fetch.mock.calls[0];
    expect(JSON.parse(channelOptions.body).channel).toBe("C0123456789");
  });

  test("does not send any DM when there are no mapped users", async () => {
    mockInputs({ "target-users": "carol", "slack-reviewer-map": "{}" });
    await run();

    expect(setFailedSpy).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, channelOptions] = global.fetch.mock.calls[0];
    expect(JSON.parse(channelOptions.body).text).toBe("Hello team! @carol");
  });

  test("sends multiple DMs to multiple mapped users", async () => {
    mockInputs({
      "target-users": "alice, bob",
      "slack-reviewer-map": '{"alice": "U111", "bob": "U222"}',
    });
    await run();

    expect(setFailedSpy).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(3);
    const dmChannels = global.fetch.mock.calls.slice(1).map(([, options]) => JSON.parse(options.body).channel);
    expect(dmChannels).toEqual(["U111", "U222"]);
  });

  test("both channel and DM disabled sends nothing", async () => {
    mockInputs({ "send-channel": "false", "send-dm": "false" });
    await run();

    expect(setFailedSpy).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("fails the action on invalid reviewer map JSON", async () => {
    mockInputs({ "slack-reviewer-map": "{not-json" });
    await run();

    expect(setFailedSpy).toHaveBeenCalledWith(expect.stringMatching(/valid JSON/));
  });

  test("fails the action on invalid boolean input", async () => {
    mockInputs({ "send-channel": "maybe" });
    await run();

    expect(setFailedSpy).toHaveBeenCalledWith(expect.stringMatching(/must be a boolean/));
  });

  test("fails the action when slack-channel-id is missing and send-channel is true", async () => {
    mockInputs({ "slack-channel-id": "" });
    await run();

    expect(setFailedSpy).toHaveBeenCalledWith(expect.stringMatching(/slack-channel-id/));
  });

  test("fails when a required input is missing", async () => {
    jest.spyOn(core, "getInput").mockImplementation((name, options) => {
      if (name === "message-template" && options && options.required) {
        throw new Error('Input required and not supplied: message-template');
      }
      return "";
    });
    await run();

    expect(setFailedSpy).toHaveBeenCalledWith(expect.stringMatching(/message-template/));
  });

  test("fails the action when the Slack HTTP request fails", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ ok: false }),
    });
    mockInputs();
    await run();

    expect(setFailedSpy).toHaveBeenCalledWith(expect.stringMatching(/HTTP status 500/));
  });

  test("fails the action when Slack responds with ok:false", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: false, error: "invalid_auth" }),
    });
    mockInputs();
    await run();

    expect(setFailedSpy).toHaveBeenCalledWith(expect.stringMatching(/invalid_auth/));
  });

  test("preserves newlines, quotes, backticks, and template placeholders in message-template", async () => {
    const tricky = 'Line1\nLine2 "quoted" `backtick` ${injected} end';
    mockInputs({ "message-template": tricky, "target-users": " , " });
    await run();

    expect(setFailedSpy).not.toHaveBeenCalled();
    const [, channelOptions] = global.fetch.mock.calls[0];
    expect(JSON.parse(channelOptions.body).text).toBe(`${tricky} `);
  });
});
