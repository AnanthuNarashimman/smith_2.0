const crypto = require("crypto");

// Deterministic stringify (sorted keys at every level) so the same tool call
// always hashes the same way regardless of key insertion order.
function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

function hashToolCall(tool_name, tool_input) {
  const normalized = stableStringify({ tool_name, tool_input: tool_input || {} });
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

module.exports = { hashToolCall };
