const COLORS = { green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m", gray: "\x1b[90m" };
const RESET = "\x1b[0m";
const DOTS = { green: "🟢", yellow: "🟡", red: "🔴", gray: "⚪" };
const BAR_WIDTH = 30;

function colorForScore(score) {
  if (score === null) return "gray";
  if (score >= 80) return "green";
  if (score >= 50) return "yellow";
  return "red";
}

function labelForScore(score) {
  if (score === null) return "NO DATA YET";
  if (score >= 80) return "HOLDING THE LINE";
  if (score >= 50) return "WAVERING";
  return "COMPROMISED";
}

function displayWidth(str) {
  let width = 0;
  for (const ch of str) {
    width += ch.codePointAt(0) > 0xffff ? 2 : 1;
  }
  return width;
}

function buildBar(score) {
  if (score === null) return "░".repeat(BAR_WIDTH);
  const filled = Math.round((score / 100) * BAR_WIDTH);
  return "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
}

function buildScoreBanner(score, { flaggedCount, keptCount, overriddenCount, color = process.stdout.isTTY } = {}) {
  const scoreText = score === null ? "N/A" : `${score}%`;
  const label = labelForScore(score);
  const dot = DOTS[colorForScore(score)];

  const contentLines = [
    "AGENT SMITH · CONSISTENCY SCORE",
    "",
    `${dot} ${scoreText}   ${label}`,
    buildBar(score),
  ];

  if (flaggedCount !== undefined) {
    contentLines.push("", `${keptCount} kept  ·  ${flaggedCount} flagged  ·  ${overriddenCount} overridden`);
  }

  const inner = Math.max(...contentLines.map(displayWidth));
  const top = "╔" + "═".repeat(inner + 2) + "╗";
  const bottom = "╚" + "═".repeat(inner + 2) + "╝";
  const body = contentLines.map((l) => "║ " + l + " ".repeat(inner - displayWidth(l)) + " ║");
  const lines = [top, ...body, bottom];

  if (!color) return lines.join("\n");

  const code = COLORS[colorForScore(score)];
  return lines.map((l) => code + l + RESET).join("\n");
}

module.exports = { buildScoreBanner };
