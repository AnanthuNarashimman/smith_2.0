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

This is a status report, nothing else. Do not ask the user questions, offer choices, or suggest next steps (e.g. "want me to change the goal?" or "should I proceed anyway?") — just state what the current data shows and stop.
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

// User-invoked, not automatic: syncing to the dashboard on every commit would need the
// agent to reliably remember a CLAUDE.md instruction, which isn't dependable. A slash
// command shifts that to "the developer remembers to invoke it," which is simpler to
// reason about and doesn't depend on the LLM's cooperation.
const UPDATE_SKILL_CONTENT = `---
description: Push the current Agent Smith goal and status to the web dashboard.
disable-model-invocation: true
allowed-tools: Bash(smith update)
---

## Sync with the Agent Smith dashboard

!\`smith update\`

## Your task

Report in one sentence whether the sync succeeded or failed. Nothing else.
`;

function ensureCommitSkillConfigured() {
  const skillPath = path.join(process.cwd(), ".claude", "skills", "smith-commit", "SKILL.md");
  const alreadyExists = fs.existsSync(skillPath);

  if (!alreadyExists) {
    fs.mkdirSync(path.dirname(skillPath), { recursive: true });
    fs.writeFileSync(skillPath, UPDATE_SKILL_CONTENT);
  }

  return { skillPath, changed: !alreadyExists };
}

module.exports = { ensureSkillConfigured, ensureCommitSkillConfigured };
