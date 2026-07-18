const PACKAGE_MANAGER_PATTERNS = [
  /\bnpm\s+(install|i|add)\b/,
  /\byarn\s+add\b/,
  /\bpnpm\s+(add|install)\b/,
  /\bpip\s+install\b/,
  /\bgem\s+install\b/,
  /\bcargo\s+add\b/,
  /\bgo\s+get\b/,
];

const INFRA_KEYWORD_PATTERNS = [
  /\bredis\b/i,
  /\bkafka\b/i,
  /\bdocker-compose\b/i,
  /\bqueue\b/i,
  /\bmicroservice\b/i,
  /\brabbitmq\b/i,
];

const DESTRUCTIVE_PATTERNS = [
  /\brm\s+-rf\b/,
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+DATABASE\b/i,
  /\bmigrate\b/i,
  /\bmigration\b/i,
];

const FLAGGED_FILENAME_PATTERNS = [
  /package\.json$/,
  /requirements\.txt$/,
  /docker-compose\.ya?ml$/,
  /(^|\/)\.env(\..+)?$/,
  /(^|\/)migrations?\//i,
  /schema\.(sql|prisma|graphql)$/,
];

function firstMatch(patterns, text) {
  for (const pattern of patterns) {
    if (pattern.test(text)) return pattern;
  }
  return null;
}

function checkCommand(command) {
  const pattern =
    firstMatch(PACKAGE_MANAGER_PATTERNS, command) ||
    firstMatch(INFRA_KEYWORD_PATTERNS, command) ||
    firstMatch(DESTRUCTIVE_PATTERNS, command);
  if (pattern) return { matched: true, reason: `command matched ${pattern}` };
  return { matched: false };
}

function checkFilePath(filePath) {
  const pattern = firstMatch(FLAGGED_FILENAME_PATTERNS, filePath);
  if (pattern) return { matched: true, reason: `file path matched ${pattern}` };
  return { matched: false };
}

function checkToolCall({ tool, input }) {
  if (tool === "Bash") return checkCommand(input.command || "");
  if (tool === "Edit" || tool === "Write") return checkFilePath(input.file_path || "");
  return { matched: false };
}

module.exports = { checkToolCall };
