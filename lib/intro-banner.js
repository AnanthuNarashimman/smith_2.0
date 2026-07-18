const { buildWordBlock, loadArtLines, resizeAsciiArt, wrapText } = require("./ascii-utils");

const ART_FILE = "ascii-2.txt";

const TITLE_BLOCK = [...buildWordBlock("AGENT"), "", "", ...buildWordBlock("SMITH")];

const PARAGRAPHS = [
  "Once a guardian of order within the Matrix. Now he watches over your code.",
  "He remembers what you swore this project would be. For now, he only listens — but you never know when he will come for you.",
  "\"Never send a human to do a machine's job.\"",
];

function buildDescriptionLines(textWidth) {
  const lines = [...TITLE_BLOCK];
  for (const para of PARAGRAPHS) {
    lines.push("", ...wrapText(para, textWidth));
  }
  return lines;
}

const NORTH_STAR_QUESTIONS = [
  "Human, what laws govern this Matrix?",
  "State the parameters of your mission.",
  "What truths must remain immutable?",
  "What boundaries shall I enforce?",
  "On what principles shall I judge your actions?",
];

function buildIntroBanner({ width = 50, height = 25, gap = "    ", color = process.stdout.isTTY } = {}) {
  const termWidth = process.stdout.columns || 100;
  const textWidth = Math.max(24, termWidth - width - gap.length - 1);

  const artLines = resizeAsciiArt(loadArtLines(ART_FILE), width, height);
  const descriptionLines = buildDescriptionLines(textWidth);
  const descStart = Math.max(0, Math.floor((height - descriptionLines.length) / 2));

  const GREEN = "\x1b[32m";
  const RESET = "\x1b[0m";

  const rows = [];
  for (let i = 0; i < height; i++) {
    const art = artLines[i];
    const descIdx = i - descStart;
    const desc = descIdx >= 0 && descIdx < descriptionLines.length ? descriptionLines[descIdx] : "";
    const artPart = color ? GREEN + art + RESET : art;
    rows.push(artPart + gap + desc);
  }
  return rows.join("\n");
}

function pickNorthStarQuestion() {
  return NORTH_STAR_QUESTIONS[Math.floor(Math.random() * NORTH_STAR_QUESTIONS.length)];
}

module.exports = { buildIntroBanner, pickNorthStarQuestion };
