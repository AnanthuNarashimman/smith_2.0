const express = require("express");
const { checkToolCall } = require("./filter");
const { buildInterruptMessage } = require("./banner");
const { judgeContradiction } = require("./judge");
const { readConfig } = require("../lib/config");
const { getContainerTag, getClient, findGoal } = require("../lib/goal-store");
const { logDecision, wasFlaggedContradiction } = require("../lib/decision-log");
const { logOverride } = require("../lib/override-log");
const { hashToolCall } = require("../lib/action-hash");
const { pushDecision, pushOverride } = require("../lib/dashboard-client");

function describeAction(tool_name, tool_input) {
  if (tool_name === "Bash") return `Run shell command: ${tool_input.command}`;
  if (tool_name === "Edit" || tool_name === "Write") return `Write to file: ${tool_input.file_path}`;
  return `${tool_name}: ${JSON.stringify(tool_input)}`;
}

function allow() {
  return {
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow" },
  };
}

function ask(reasoning) {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: buildInterruptMessage(reasoning),
    },
  };
}

function requireClient() {
  const config = readConfig();
  if (!config || !config.supermemoryApiKey) {
    throw new Error("No Supermemory API key configured — run `smith init` first");
  }
  return getClient(config.supermemoryApiKey);
}

// Dashboard sync is best-effort on top of the Supermemory writes, not a replacement for
// them — if there's no token or the project was never registered (e.g. dashboard was
// down during `smith init`), just skip it silently rather than erroring the request.
function getDashboardTarget(containerTag) {
  const config = readConfig();
  if (!config || !config.webAccessToken) return null;
  const projectId = config.dashboardProjects && config.dashboardProjects[containerTag];
  if (!projectId) return null;
  return { token: config.webAccessToken, projectId };
}

async function handlePreToolUse(tool_name, tool_input, result, res) {
  try {
    const containerTag = getContainerTag();
    const client = requireClient();
    const goalMemory = await findGoal(client, containerTag);

    if (!goalMemory) {
      console.log(`[PreToolUse] matched filter but no goal set for ${containerTag}, allowing`);
      return res.json(allow());
    }

    const action = describeAction(tool_name, tool_input);
    const actionHash = hashToolCall(tool_name, tool_input);
    const verdict = await judgeContradiction({ goal: goalMemory.memory, action });

    console.log(`[PreToolUse] contradicts=${verdict.contradicts} action=${action} reasoning=${verdict.reasoning}`);

    logDecision(client, containerTag, { action, actionHash, contradicts: verdict.contradicts, reasoning: verdict.reasoning }).catch(
      (err) => console.error("[PreToolUse] decision log write failed (non-blocking):", err.message || err)
    );

    const dashboardTarget = getDashboardTarget(containerTag);
    if (dashboardTarget) {
      pushDecision(dashboardTarget.token, dashboardTarget.projectId, {
        action,
        contradicts: verdict.contradicts,
        reasoning: verdict.reasoning,
      }).catch((err) => console.error("[PreToolUse] dashboard push failed (non-blocking):", err.message || err));
    }

    if (!verdict.contradicts) {
      return res.json(allow());
    }

    return res.json(ask(verdict.reasoning));
  } catch (err) {
    console.error("[PreToolUse] judgment failed, failing open:", err.message || err);
    return res.json(allow());
  }
}

// Shared by PostToolUse and PostToolUseFailure: an approved action that got flagged
// is an override the moment the user lets it run, regardless of whether the command
// itself later succeeds or errors out — a failing `winget install` is still evidence
// the user chose to override Smith's flag, so a failure shouldn't erase that decision
// from the score just because Claude Code routes success/failure to different hooks.
function handlePostToolUse(hookEventName, tool_name, tool_input, result, res) {
  res.json({});

  if (!result.matched) return;

  (async () => {
    try {
      const containerTag = getContainerTag();
      const client = requireClient();
      const action = describeAction(tool_name, tool_input);
      const actionHash = hashToolCall(tool_name, tool_input);

      const wasReallyFlagged = await wasFlaggedContradiction(client, containerTag, actionHash);
      if (!wasReallyFlagged) {
        console.log(`[${hookEventName}] matched static filter but was not a real contradiction, skipping override: ${action}`);
        return;
      }

      console.log(`[${hookEventName}] flagged action actually executed, logging override: ${action}`);
      await logOverride(client, containerTag, { action, actionHash });

      const dashboardTarget = getDashboardTarget(containerTag);
      if (dashboardTarget) {
        pushOverride(dashboardTarget.token, dashboardTarget.projectId, { action, actionHash }).catch((err) =>
          console.error(`[${hookEventName}] dashboard push failed (non-blocking):`, err.message || err)
        );
      }
    } catch (err) {
      console.error(`[${hookEventName}] override log write failed (non-blocking):`, err.message || err);
    }
  })();
}

function createApp() {
  const app = express();
  app.use(express.json());

  app.post("/analyze", async (req, res) => {
    const { hook_event_name, tool_name, tool_input } = req.body || {};
    const result = checkToolCall({ tool: tool_name, input: tool_input || {} });

    if (hook_event_name === "PostToolUse" || hook_event_name === "PostToolUseFailure") {
      return handlePostToolUse(hook_event_name, tool_name, tool_input || {}, result, res);
    }

    if (!result.matched) {
      return res.json(allow());
    }

    return handlePreToolUse(tool_name, tool_input || {}, result, res);
  });

  app.post("/shutdown", (req, res) => {
    res.json({ stopped: true });
    setTimeout(() => process.exit(0), 100);
  });

  return app;
}

module.exports = { createApp };
