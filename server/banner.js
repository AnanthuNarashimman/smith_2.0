const AGENT_LINES = [
  " █████   ██████  ███████ ███    ██ ████████ ",
  "██   ██ ██       ██      ████   ██    ██    ",
  "███████ ██   ███ █████   ██ ██  ██    ██    ",
  "██   ██ ██    ██ ██      ██  ██ ██    ██    ",
  "██   ██  ██████  ███████ ██   ████    ██    ",
];

const SMITH_LINES = [
  "███████ ███    ███ ██ ████████ ██   ██ ",
  "██      ████  ████ ██    ██    ██   ██ ",
  "███████ ██ ████ ██ ██    ██    ███████ ",
  "     ██ ██  ██  ██ ██    ██    ██   ██ ",
  "███████ ██      ██ ██    ██    ██   ██ ",
];

const LINES = AGENT_LINES.map((line, i) => line + " " + SMITH_LINES[i]);

function buildInterruptMessage(reasoning) {
  return [...LINES, "", reasoning, "", "Run `smith argue` if you believe this doesn't violate your goal."].join("\n");
}

module.exports = { buildInterruptMessage };
