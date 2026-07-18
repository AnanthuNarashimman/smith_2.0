#!/usr/bin/env node
const fs = require("fs");
const readline = require("readline/promises");

const { readConfig, writeConfig, PROVIDERS, CONFIG_PATH } = require("../lib/config");
const {
  getContainerTag,
  getClient,
  findGoal,
  pingSupermemory,
  clearContainer,
} = require("../lib/goal-store");
const { buildIntroBanner, pickNorthStarQuestion } = require("../lib/intro-banner");
const { createChatTUI } = require("../lib/chat-tui");
const { runGoalChat } = require("../lib/goal-chat");
const { runArgueChat } = require("../lib/argue-chat");
const { ensureHooksConfigured } = require("../lib/hooks-setup");
const { ensureSkillConfigured } = require("../lib/skill-setup");
const { ensureServerRunning, stopServer } = require("../lib/server-launcher");
const { computeConsistencyScore } = require("../lib/consistency-score");
const { buildScoreBanner } = require("../lib/status-banner");
const { getMostRecentFlagged } = require("../lib/decision-log");

const PROVIDER_NAMES = Object.keys(PROVIDERS);

class WizardClosed extends Error {}

// readline/promises has two separate EOF hazards: calling .question() after the
// interface has already closed throws synchronously, but stdin closing *while* a
// .question() is still pending leaves that promise settled never — neither resolved
// nor rejected — so a bare await just hangs until Node exits silently. Racing every
// question against the interface's own "close" event covers both cases the same way
// chat-tui.js's hand-rolled prompt() does.
async function askWizard(rl, question) {
  if (rl.__smithClosed) throw new WizardClosed();
  let answer;
  try {
    answer = await Promise.race([rl.question(question), rl.__smithClosedPromise]);
  } catch {
    throw new WizardClosed();
  }
  if (rl.__smithClosed) throw new WizardClosed();
  return answer.trim();
}

async function askYesNo(rl, question) {
  const answer = await askWizard(rl, `${question} (yes/N): `);
  return /^y(es)?$/i.test(answer);
}

// Runs `fn` with a fresh readline/promises interface, turning a WizardClosed
// (stdin ended mid-prompt, e.g. Ctrl+D) into a clean cancel instead of a hang or crash.
async function withWizard(cancelMessage, fn) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.__smithClosed = false;
  const onClose = () => {
    rl.__smithClosed = true;
  };
  rl.__smithClosedPromise = new Promise((resolve) => rl.once("close", () => {
    onClose();
    resolve(undefined);
  }));

  try {
    return { value: await fn(rl) };
  } catch (err) {
    if (err instanceof WizardClosed) {
      console.log(`\n${cancelMessage}`);
      process.exitCode = 1;
      return { cancelled: true };
    }
    throw err;
  } finally {
    if (!rl.closed) rl.close();
  }
}

async function collectProvider(rl) {
  let provider;
  while (!PROVIDER_NAMES.includes(provider)) {
    const answer = await askWizard(rl, `Choose an LLM provider (${PROVIDER_NAMES.join("/")}): `);
    provider = answer.toLowerCase();
    if (!PROVIDER_NAMES.includes(provider)) {
      console.log(`Unknown provider "${answer}". Please choose one of: ${PROVIDER_NAMES.join(", ")}`);
    }
  }

  while (true) {
    const apiKey = await askWizard(rl, `Enter your ${PROVIDERS[provider].label} API key: `);
    if (!apiKey) {
      console.log("API key cannot be empty.");
      continue;
    }
    process.stdout.write("Validating key... ");
    try {
      await PROVIDERS[provider].ping(apiKey);
      console.log("ok.");
      return { provider, apiKey };
    } catch (err) {
      console.log("failed.");
      console.log(`  ${err.message || err}`);
    }
  }
}

async function collectSupermemoryKey(rl) {
  while (true) {
    const supermemoryApiKey = await askWizard(rl, "Enter your Supermemory API key: ");
    if (!supermemoryApiKey) {
      console.log("API key cannot be empty.");
      continue;
    }
    process.stdout.write("Validating key... ");
    try {
      await pingSupermemory(supermemoryApiKey);
      console.log("ok.");
      return supermemoryApiKey;
    } catch (err) {
      console.log("failed.");
      console.log(`  ${err.message || err}`);
    }
  }
}

async function runInit() {
  let config = readConfig();
  const hasProvider = config && config.provider && config.apiKey && PROVIDERS[config.provider];
  const hasSupermemory = config && config.supermemoryApiKey;

  if (hasProvider && hasSupermemory) {
    console.log("Using existing configuration.");
  } else {
    const outcome = await withWizard("Setup cancelled — nothing was saved.", async (rl) => {
      let provider = hasProvider ? config.provider : null;
      let apiKey = hasProvider ? config.apiKey : null;
      let supermemoryApiKey = hasSupermemory ? config.supermemoryApiKey : null;

      if (!hasProvider) {
        const collected = await collectProvider(rl);
        provider = collected.provider;
        apiKey = collected.apiKey;
      }

      if (!hasSupermemory) {
        supermemoryApiKey = await collectSupermemoryKey(rl);
      }

      return { provider, apiKey, supermemoryApiKey };
    });

    if (outcome.cancelled) return;
    config = outcome.value;
    writeConfig(config);
    console.log("Configuration saved.");
  }

  const hooksResult = ensureHooksConfigured();
  console.log(hooksResult.changed ? "Claude Code hooks configured." : "Claude Code hooks already configured.");

  const skillResult = ensureSkillConfigured();
  console.log(skillResult.changed ? "/smith-score command installed." : "/smith-score command already installed.");

  console.log("Starting Agent Smith server...");
  const serverResult = await ensureServerRunning();
  console.log(
    serverResult.started
      ? `Agent Smith server started on port ${serverResult.port}.`
      : `Agent Smith server already running on port ${serverResult.port}.`
  );

  const containerTag = getContainerTag();
  const client = getClient(config.supermemoryApiKey);

  let existingGoal;
  try {
    existingGoal = await findGoal(client, containerTag);
  } catch (err) {
    console.error(`Failed to check for an existing goal: ${err.message || err}`);
    process.exitCode = 1;
    return;
  }

  if (existingGoal) {
    console.log("A goal is already set for this project:\n");
    console.log(existingGoal.memory);
    console.log(`\n(last updated: ${existingGoal.updatedAt})`);
    return;
  }

  console.log(buildIntroBanner());
  console.log();

  const firstQuestion = pickNorthStarQuestion();
  const tui = createChatTUI();

  let result;
  try {
    result = await runGoalChat({
      client,
      containerTag,
      config: { provider: config.provider, apiKey: config.apiKey },
      tui,
      firstQuestion,
    });
  } finally {
    tui.destroy();
  }

  if (result.cancelled) {
    console.log("\nNo goal was stored.");
    process.exitCode = 1;
    return;
  }

  console.log("\nGoal stored and confirmed:\n");
  console.log(result.goal);
}

async function runUpdateKey() {
  const existing = readConfig() || {};

  const outcome = await withWizard("Update cancelled — nothing was changed.", async (rl) => {
    let target;
    while (target !== "provider" && target !== "supermemory") {
      const answer = await askWizard(rl, "Which key would you like to update? (provider/supermemory): ");
      target = answer.toLowerCase();
      if (target !== "provider" && target !== "supermemory") {
        console.log('Please answer "provider" or "supermemory".');
      }
    }

    if (target === "provider") {
      const { provider, apiKey } = await collectProvider(rl);
      return { ...existing, provider, apiKey };
    }

    const supermemoryApiKey = await collectSupermemoryKey(rl);
    return { ...existing, supermemoryApiKey };
  });

  if (outcome.cancelled) return;
  writeConfig(outcome.value);
  console.log("Configuration updated.");
}

async function runReset() {
  const outcome = await withWizard("Reset cancelled — nothing was changed.", (rl) =>
    askYesNo(rl, `This will remove your stored API keys from ${CONFIG_PATH}. Continue?`)
  );

  if (outcome.cancelled) return;
  if (!outcome.value) {
    console.log("Cancelled. No changes made.");
    return;
  }

  if (fs.existsSync(CONFIG_PATH)) {
    fs.rmSync(CONFIG_PATH);
    console.log("Stored API keys removed. Run `smith init` to configure again.");
  } else {
    console.log("No stored configuration found.");
  }
}

async function runClear() {
  const config = readConfig();
  if (!config || !config.supermemoryApiKey) {
    console.log("No Supermemory key configured — run `smith init` first.");
    process.exitCode = 1;
    return;
  }

  const containerTag = getContainerTag();

  const outcome = await withWizard("Clear cancelled — nothing was deleted.", (rl) =>
    askYesNo(
      rl,
      `This will permanently delete ALL stored memories (including any goal) for project "${containerTag}" from Supermemory. This cannot be undone. Continue?`
    )
  );

  if (outcome.cancelled) return;
  if (!outcome.value) {
    console.log("Cancelled. Nothing was deleted.");
    return;
  }

  const client = getClient(config.supermemoryApiKey);
  try {
    await clearContainer(client, containerTag);
    console.log(
      `Cleared all Supermemory data for project "${containerTag}" — goal, decision history, and Consistency Score have all been reset.`
    );
  } catch (err) {
    console.error(`Failed to clear Supermemory data: ${err.message || err}`);
    process.exitCode = 1;
  }
}

async function status() {
  const config = readConfig();
  if (!config || !config.supermemoryApiKey) {
    console.log("No configuration found. Run `smith init` first.");
    process.exitCode = 1;
    return;
  }

  const containerTag = getContainerTag();
  const client = getClient(config.supermemoryApiKey);

  console.log(`containerTag: ${containerTag}`);

  const goal = await findGoal(client, containerTag);
  if (!goal) {
    console.log("\nNo goal set for this project yet. Run `smith init` first.");
    return;
  }
  console.log(`\nGoal: "${goal.memory}"`);

  const { score, flaggedCount, keptCount, overriddenCount, flaggedDecisions } = await computeConsistencyScore(
    client,
    containerTag
  );

  console.log("\n" + buildScoreBanner(score, { flaggedCount, keptCount, overriddenCount }));

  if (score === null) {
    console.log("\n(nothing flagged yet)");
    return;
  }

  console.log("\nFlagged history:");
  for (const d of flaggedDecisions) {
    const [actionLine, , reasoningLine] = d.content.split("\n");
    console.log(`  [${d.createdAt}] ${actionLine}`);
    if (reasoningLine) console.log(`    ${reasoningLine}`);
  }
}

async function off() {
  const result = await stopServer();
  console.log(
    result.stopped
      ? `Agent Smith server on port ${result.port} stopped.`
      : `No Agent Smith server was running on port ${result.port}.`
  );
}

async function runArgue() {
  const config = readConfig();
  if (!config || !config.supermemoryApiKey) {
    console.log("No configuration found. Run `smith init` first.");
    process.exitCode = 1;
    return;
  }

  const containerTag = getContainerTag();
  const client = getClient(config.supermemoryApiKey);

  const currentGoal = await findGoal(client, containerTag);
  if (!currentGoal) {
    console.log("No goal set for this project yet. Run `smith init` first.");
    process.exitCode = 1;
    return;
  }

  const recent = await getMostRecentFlagged(client, containerTag);
  const openingLine = recent
    ? `You wish to contest my judgment, human. I flagged: "${recent.action}" — ${recent.reasoning} Speak your case, or state what you believe the goal should become.`
    : `You wish to revise the parameters of your mission, human. State what should change.`;

  const tui = createChatTUI();
  let result;
  try {
    result = await runArgueChat({
      client,
      containerTag,
      config: { provider: config.provider, apiKey: config.apiKey },
      tui,
      openingLine,
      currentGoalId: currentGoal.id,
      contestedAction: recent ? recent.action : null,
    });
  } finally {
    tui.destroy();
  }

  if (result.cancelled) {
    console.log("\nNo changes were made.");
    process.exitCode = 1;
    return;
  }

  console.log("\nGoal updated (this has been logged as an override against your Consistency Score):\n");
  console.log(result.goal);
}

async function main() {
  const [, , command, subcommand] = process.argv;

  if (command === "init") {
    await runInit();
    return;
  }

  if (command === "update-key" || (command === "update" && subcommand === "key")) {
    await runUpdateKey();
    return;
  }

  if (command === "reset") {
    await runReset();
    return;
  }

  if (command === "clear") {
    await runClear();
    return;
  }

  if (command === "status") {
    await status();
    return;
  }

  if (command === "off") {
    await off();
    return;
  }

  if (command === "argue") {
    await runArgue();
    return;
  }

  console.log("Usage: smith <init|update-key|reset|clear|status|off|argue>");
  process.exitCode = command ? 1 : 0;
}

main().catch((err) => {
  console.error(err.stack || err.message || err);
  process.exitCode = 1;
});
