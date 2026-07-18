const fs = require("fs");
const path = require("path");

const ASSETS_DIR = path.join(__dirname, "..", "assets");

const LETTERS = {
  A: [" ### ", "#   #", "#####", "#   #", "#   #"],
  G: [" ### ", "#    ", "# ###", "#   #", " ### "],
  E: ["#####", "#    ", "###  ", "#    ", "#####"],
  N: ["#   #", "##  #", "# # #", "#  ##", "#   #"],
  T: ["#####", "  #  ", "  #  ", "  #  ", "  #  "],
  S: [" ####", "#    ", " ### ", "    #", "#### "],
  M: ["#   #", "## ##", "# # #", "#   #", "#   #"],
  I: ["#####", "  #  ", "  #  ", "  #  ", "#####"],
  H: ["#   #", "#   #", "#####", "#   #", "#   #"],
};

function widenGlyphRow(row) {
  return row
    .split("")
    .map((c) => (c === "#" ? "██" : "  "))
    .join("");
}

function buildWordBlock(word) {
  const rows = ["", "", "", "", ""];
  for (const ch of word) {
    const glyph = LETTERS[ch];
    for (let r = 0; r < 5; r++) {
      rows[r] += widenGlyphRow(glyph[r]) + "   ";
    }
  }
  return rows.map((r) => r.trimEnd());
}

function loadArtLines(fileName) {
  const raw = fs.readFileSync(path.join(ASSETS_DIR, fileName), "utf8");
  return raw.replace(/\r\n/g, "\n").split("\n");
}

function resizeAsciiArt(lines, targetWidth, targetHeight) {
  const srcHeight = lines.length;
  const srcWidth = Math.max(...lines.map((l) => l.length));

  const out = [];
  for (let y = 0; y < targetHeight; y++) {
    const srcY = Math.min(srcHeight - 1, Math.floor((y / targetHeight) * srcHeight));
    const srcLine = lines[srcY] || "";
    let row = "";
    for (let x = 0; x < targetWidth; x++) {
      const srcX = Math.min(srcWidth - 1, Math.floor((x / targetWidth) * srcWidth));
      row += srcLine[srcX] || " ";
    }
    out.push(row);
  }
  return out;
}

function wrapText(text, width) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

module.exports = { buildWordBlock, loadArtLines, resizeAsciiArt, wrapText };
