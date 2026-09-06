jest.mock("@slack/web-api", () => ({ WebClient: jest.fn() }));

const { WebClient } = require("@slack/web-api");
const { postMessage } = require("../src/slack");

describe("postMessage", () => {
  afterEach(() => jest.restoreAllMocks());

  test("configures WebClient and posts the message", async () => {
    const chatPostMessage = jest.fn().mockResolvedValue({ ok: true, ts: "123.456" });
    WebClient.mockImplementation(() => ({ chat: { postMessage: chatPostMessage } }));
    const token = "xoxb-test-token";
    await expect(postMessage({ token, channel: "C123", text: "hello" })).resolves.toEqual({ ok: true, ts: "123.456" });
    expect(WebClient).toHaveBeenCalledWith(token, { timeout: 10000, retryConfig: { retries: 3 } });
    expect(chatPostMessage).toHaveBeenCalledWith({ channel: "C123", text: "hello" });
  });

  test("converts Slack errors without leaking the token", async () => {
    WebClient.mockImplementation(() => ({
      chat: { postMessage: jest.fn().mockRejectedValue({ data: { error: "invalid_auth" } }) },
    }));
    const token = "xoxb-secret-token";
    const error = await postMessage({ token, channel: "C123", text: "hi" }).catch((e) => e);
    expect(error.message).toBe("Slack request to C123 failed: invalid_auth");
    expect(error.message).not.toContain(token);
  });

  test("converts transport errors without leaking the token", async () => {
    WebClient.mockImplementation(() => ({
      chat: {
        postMessage: jest.fn().mockRejectedValue(Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" })),
      },
    }));
    const token = "xoxb-secret-token";
    const error = await postMessage({ token, channel: "C123", text: "hi" }).catch((e) => e);
    expect(error.message).toBe("Slack request to C123 failed: ETIMEDOUT");
    expect(error.message).not.toContain(token);
  });

  test("falls back to unknown_error without leaking the token from a bare message", async () => {
    const token = "xoxb-secret-token";
    WebClient.mockImplementation(() => ({
      chat: { postMessage: jest.fn().mockRejectedValue(new Error(`leaked ${token}`)) },
    }));
    const error = await postMessage({ token, channel: "C123", text: "hi" }).catch((e) => e);
    expect(error.message).toBe("Slack request to C123 failed: unknown_error");
    expect(error.message).not.toContain(token);
  });
});
