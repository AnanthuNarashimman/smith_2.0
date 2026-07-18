const fs = require("fs");
const path = require("path");

function getSettingsPath() {
  return path.join(process.cwd(), ".claude", "settings.json");
}

function buildHookEntry(port) {
  return {
    matcher: "Bash|Edit|Write",
    hooks: [{ type: "http", url: `http://localhost:${port}/analyze`, timeout: 30 }],
  };
}

function hasAgentSmithHook(entries, port) {
  if (!Array.isArray(entries)) return false;
  const url = `http://localhost:${port}/analyze`;
  return entries.some(
    (e) => Array.isArray(e.hooks) && e.hooks.some((h) => h.type === "http" && h.url === url)
  );
}

function ensureHooksConfigured(port = 6789) {
  const settingsPath = getSettingsPath();
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } else {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  }

  settings.hooks = settings.hooks || {};
  let changed = false;

  for (const event of ["PreToolUse", "PostToolUse"]) {
    settings.hooks[event] = settings.hooks[event] || [];
    if (!hasAgentSmithHook(settings.hooks[event], port)) {
      settings.hooks[event].push(buildHookEntry(port));
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
  }

  return { settingsPath, changed };
}

module.exports = { ensureHooksConfigured };
