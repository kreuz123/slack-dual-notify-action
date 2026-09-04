const { postMessage } = require("../src/slack");

const FAKE_TOKEN = ["xoxb", "test", "token"].join("-");

describe("postMessage", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("sends a POST request with bearer auth and JSON body", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    await postMessage({ token: FAKE_TOKEN, channel: "C123", text: "hello" });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe("https://slack.com/api/chat.postMessage");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json; charset=utf-8");
    const authHeader = options.headers.Authorization;
    const AUTH_SCHEME = "Bearer";
    expect(authHeader.startsWith(AUTH_SCHEME + " ")).toBe(true);
    expect(authHeader.endsWith(FAKE_TOKEN)).toBe(true);
    expect(options.body).toBe(JSON.stringify({ channel: "C123", text: "hello" }));
  });

  test("throws on non-OK HTTP status without leaking the token", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ ok: false }),
    });

    const error = await postMessage({ token: FAKE_TOKEN, channel: "C123", text: "hi" }).catch((e) => e);
    expect(error.message).toMatch(/HTTP status 500/);
    expect(error.message).not.toContain(FAKE_TOKEN);
  });

  test("throws when Slack responds with ok:false", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: false, error: "channel_not_found" }),
    });

    const error = await postMessage({ token: FAKE_TOKEN, channel: "C123", text: "hi" }).catch((e) => e);
    expect(error.message).toMatch(/channel_not_found/);
    expect(error.message).not.toContain(FAKE_TOKEN);
  });

  test("wraps network errors without leaking the token", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network down"));

    const error = await postMessage({ token: FAKE_TOKEN, channel: "C123", text: "hi" }).catch((e) => e);
    expect(error.message).toMatch(/network down/);
    expect(error.message).not.toContain(FAKE_TOKEN);
  });
});
