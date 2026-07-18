const fs = require("fs");
const path = require("path");

const SKILL_CONTENT = `---
description: Show the current Agent Smith Consistency Score and flagged decision history for this project.
disable-model-invocation: true
allowed-tools: Bash(smith status)
---

## Current Agent Smith status

!\`smith status\`

## Your task

First, reproduce the ASCII banner block from the output above verbatim, inside a fenced code block, exactly as it appeared (box-drawing characters and all) — do not paraphrase or redraw it. Then, below the code block, add a short plain-language summary: if no goal is set, tell the user to run \`smith init\`; otherwise briefly summarize the flagged history.
`;

function ensureSkillConfigured() {
  const skillPath = path.join(process.cwd(), ".claude", "skills", "smith-score", "SKILL.md");
  const alreadyExists = fs.existsSync(skillPath);

  if (!alreadyExists) {
    fs.mkdirSync(path.dirname(skillPath), { recursive: true });
    fs.writeFileSync(skillPath, SKILL_CONTENT);
  }

  return { skillPath, changed: !alreadyExists };
}

module.exports = { ensureSkillConfigured };
