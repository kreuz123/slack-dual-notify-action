const { parseBooleanInput } = require("../src/boolean-input");

describe("parseBooleanInput", () => {
  test("returns the default value when input is empty", () => {
    expect(parseBooleanInput("send-channel", "", true)).toBe(true);
    expect(parseBooleanInput("send-channel", "", false)).toBe(false);
  });

  test("parses true/false case-insensitively", () => {
    expect(parseBooleanInput("send-dm", "true", false)).toBe(true);
    expect(parseBooleanInput("send-dm", "TRUE", false)).toBe(true);
    expect(parseBooleanInput("send-dm", "false", true)).toBe(false);
    expect(parseBooleanInput("send-dm", "FALSE", true)).toBe(false);
  });

  test("throws a clear error for invalid boolean values", () => {
    expect(() => parseBooleanInput("send-dm", "yes", true)).toThrow(/must be a boolean/);
    expect(() => parseBooleanInput("send-dm", "1", true)).toThrow(/must be a boolean/);
  });
});
