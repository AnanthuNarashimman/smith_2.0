const { readConfig, PROVIDERS } = require("../lib/config");
const { extractJson } = require("../lib/json-utils");

const SYSTEM_PROMPT = `You are Agent Smith, judging whether a proposed action contradicts a stated project goal.

Judge based on what the action would typically mean in a real codebase, not just whether the literal wording is sparse. For example, "npm install redis" typically means the developer intends to introduce Redis as new infrastructure — treat it as such rather than giving a terse description the benefit of the doubt.

Only flag actions that would plainly contradict the goal (e.g. adding infrastructure or complexity when the goal says to avoid it). Do not flag routine, necessary, or trivial work — bug fixes, docs, tests, minor config — even though it's still real engineering work.

Respond with strict JSON only, no markdown, no code fences: {"contradicts": boolean, "reasoning": "<one or two sentences, in character as Agent Smith from The Matrix, addressed to the user>"}`;

async function judgeContradiction({ goal, action }) {
  const config = readConfig();
  if (!config) throw new Error("No LLM provider configured — run `smith init` first");

  const provider = PROVIDERS[config.provider];
  if (!provider) throw new Error(`Unknown configured provider "${config.provider}"`);

  const model = process.env.AGENT_SMITH_JUDGE_MODEL || provider.defaultModel;
  const userPrompt = `Project goal: "${goal}"\n\nProposed action: ${action}\n\nDoes this action contradict the stated goal?`;

  const raw = await provider.chat(config.apiKey, model, SYSTEM_PROMPT, [{ role: "user", content: userPrompt }]);
  const parsed = extractJson(raw);
  return { contradicts: Boolean(parsed.contradicts), reasoning: String(parsed.reasoning || "") };
}

module.exports = { judgeContradiction };
