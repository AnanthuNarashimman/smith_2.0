const { PROVIDERS } = require("./config");
const { extractJson } = require("./json-utils");
const { pollDocumentDone, findGoal } = require("./goal-store");
const { logOverride, wasAlreadyOverridden } = require("./override-log");

const MAX_TURNS = 6;

const SYSTEM_PROMPT = `You are Agent Smith from The Matrix. The developer is contesting a judgment you made, or wants to revise the project goal itself. Engage with their case seriously and in character: measured, formal, faintly ominous — a genuine judge, not a wall. If their argument has merit, say so plainly. If you still disagree, hold your ground and explain why, but never refuse to draft a revision if the developer insists — the choice to override your judgment is always theirs to make, not yours to block.

Ask at most one clarifying question if you genuinely cannot tell what they want changed. Otherwise engage directly with their argument.

Only set readyToProposeChange to true once you have a concrete, well-formed *replacement* goal statement ready for the developer to accept — never before. When readyToProposeChange is true, draftGoal must contain the full revised goal text (not a question).

Respond with strict JSON only, no markdown, no code fences:
{"reply": "<what you say to the developer this turn, in character>", "readyToProposeChange": boolean, "draftGoal": "<proposed revised goal text, or null>"}`;

const FINALIZE_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

This conversation has run long. You must finalize now: set readyToProposeChange to true and draftGoal to the best revised goal statement you can construct from everything discussed so far, even if some details remain unconfirmed.`;

const CONFIRM_PATTERN = /^(store (this |it )?(as )?(a )?goal|update the goal|change (it|the goal)|force it|store it|save (it|this)|confirm|yes|yep|yeah|lock (it|this) in)\b/i;

async function forceGoalChange(client, containerTag, currentGoalId, newGoal, contestedAction, contestedActionHash) {
  await client.documents.update(currentGoalId, {
    content: newGoal,
    containerTag,
    metadata: { type: "goal", pinned: true },
  });
  await pollDocumentDone(client, currentGoalId);
  const confirmed = await findGoal(client, containerTag);
  if (!confirmed) {
    throw new Error("Goal was updated but could not be read back.");
  }

  // Forcing a goal change to get past Smith's objection is functionally the same as
  // approving a flagged action anyway, so it should count against the Consistency
  // Score the same way — but only once per incident. If this exact flag was already
  // overridden (e.g. the developer approved it directly earlier), don't double-count
  // it just because they later argued about the same thing.
  // this'll be used in the dashboard to show the user that they overrode a Smith judgment, and to calculate the consistency score.
  const alreadyCounted = await wasAlreadyOverridden(client, containerTag, contestedActionHash);
  if (!alreadyCounted) {
    await logOverride(client, containerTag, {
      action: contestedAction || `Revised the project goal to: "${newGoal}"`,
      actionHash: contestedActionHash,
    });
  }

  return confirmed.memory;
}

async function runArgueChat({
  client,
  containerTag,
  config,
  tui,
  openingLine,
  currentGoalId,
  contestedAction,
  contestedActionHash,
}) {
  const provider = PROVIDERS[config.provider];
  const model = process.env.AGENT_SMITH_JUDGE_MODEL || provider.defaultModel;

  const messages = [];
  let pendingDraft = null;
  let turnCount = 0;

  tui.appendAssistant(openingLine);
  messages.push({ role: "assistant", content: openingLine });

  while (true) {
    const userText = await tui.prompt();

    if (userText === null) {
      return { cancelled: true };
    }
    if (!userText) continue;

    tui.appendUser(userText);
    messages.push({ role: "user", content: userText });

    if (pendingDraft && CONFIRM_PATTERN.test(userText)) {
      tui.setThinking(true);
      try {
        const goal = await forceGoalChange(
          client,
          containerTag,
          currentGoalId,
          pendingDraft,
          contestedAction,
          contestedActionHash
        );
        tui.setThinking(false);
        return { goal };
      } catch (err) {
        tui.setThinking(false);
        tui.appendNote(`Failed to update the goal: ${err.message || err}`);
        continue;
      }
    }
    pendingDraft = null;

    turnCount++;
    const systemPrompt = turnCount >= MAX_TURNS ? FINALIZE_SYSTEM_PROMPT : SYSTEM_PROMPT;

    tui.setThinking(true);
    let raw;
    try {
      raw = await provider.chat(config.apiKey, model, systemPrompt, messages);
    } catch (err) {
      tui.setThinking(false);
      tui.appendNote(`Smith stumbled: ${err.message || err}`);
      continue;
    }
    tui.setThinking(false);

    let parsed;
    try {
      parsed = extractJson(raw);
    } catch {
      parsed = { reply: raw, readyToProposeChange: false, draftGoal: null };
    }

    const reply = String(parsed.reply || "").trim() || "...";
    messages.push({ role: "assistant", content: reply });
    tui.appendAssistant(reply);

    if (parsed.readyToProposeChange && parsed.draftGoal) {
      pendingDraft = String(parsed.draftGoal).trim();
      tui.appendDraftGoal(pendingDraft);
      tui.appendNote('Type "update the goal" (or "yes"/"confirm") to force this change, or keep arguing.');
    }
  }
}

module.exports = { runArgueChat };
