const COLORS = { green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m", gray: "\x1b[90m" };
const RESET = "\x1b[0m";
const DOTS = { green: "🟢", yellow: "🟡", red: "🔴", gray: "⚪" };

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

function buildScoreBanner(score, { color = process.stdout.isTTY } = {}) {
  const scoreText = score === null ? "N/A" : `${score}%`;
  const label = labelForScore(score);
  const dot = DOTS[colorForScore(score)];
  const line1 = ` ${dot} CONSISTENCY SCORE: ${scoreText}`;
  const line2 = ` ${label}`;
  const width = Math.max(displayWidth(line1), displayWidth(line2)) + 1;
  const top = "╔" + "═".repeat(width) + "╗";
  const bottom = "╚" + "═".repeat(width) + "╝";
  const pad = (s) => "║" + s + " ".repeat(width - displayWidth(s)) + "║";
  const lines = [top, pad(line1), pad(line2), bottom];

  if (!color) return lines.join("\n");

  const code = COLORS[colorForScore(score)];
  return lines.map((l) => code + l + RESET).join("\n");
}

module.exports = { buildScoreBanner };
