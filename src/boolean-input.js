const VALID_TRUE_VALUES = new Set(["true"]);
const VALID_FALSE_VALUES = new Set(["false"]);

/**
 * Parses a boolean-style GitHub Action input, mirroring the strictness of
 * YAML `type: boolean` workflow inputs.
 *
 * @param {string} name - Name of the input, used for error messages.
 * @param {string} rawValue - Raw string value of the input.
 * @param {boolean} defaultValue - Default value to use when rawValue is empty.
 * @returns {boolean} Parsed boolean value.
 * @throws {Error} If rawValue is non-empty and not "true"/"false" (case-insensitive).
 */
function parseBooleanInput(name, rawValue, defaultValue) {
  const trimmed = (rawValue || "").trim();
  if (trimmed === "") return defaultValue;

  const normalized = trimmed.toLowerCase();
  if (VALID_TRUE_VALUES.has(normalized)) return true;
  if (VALID_FALSE_VALUES.has(normalized)) return false;

  throw new Error(`Input "${name}" must be a boolean ("true" or "false"). Received: "${rawValue}"`);
}

module.exports = { parseBooleanInput };
