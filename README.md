# Agent Smith

> "Never send a human to do a machine's job."

A goal-fidelity watchdog for AI coding agents. You tell Smith, once, what your project is actually supposed to do. From then on, he watches every risky action your agent takes, flags the ones that contradict what you said, and keeps score of how well you stuck to it.

## The problem

AI coding agents drift. You ask for a simple auth fix, three prompts later it's refactoring your database layer. Nobody told it to stop; it just quietly wandered off the stated goal, and by the time you notice, you're reviewing a diff that has nothing to do with what you asked for.

## What Smith does

You state your project's goal once, through a live in-terminal conversation with Smith — styled after Agent Smith from *The Matrix*: measured, formal, faintly ominous. He asks just enough questions to pin down what you're actually building, then locks it in as a durable, retrievable memory.

From then on, a background server watches every risky `Bash`/`Edit`/`Write` call Claude Code makes in that project. Most calls don't match anything interesting and pass through invisibly. The ones that look risky (package installs, infra keywords, destructive commands, sensitive files) get checked against your stated goal by an LLM judge. If an action looks like it contradicts what you said you wanted, Claude Code shows you a normal permission prompt — with Smith's reasoning attached — and you decide. A **Consistency Score** tracks how often you actually stuck to your own stated intent versus overrode it.

## How it works

- **One conversation, one goal.** `smith init` opens a chat with Smith. He asks about the core of what you're building — not an exhaustive spec — and drafts a concrete goal statement for you to confirm.
- **Hosted memory, not a local server.** Your goal, decision history, and override history are all stored via the [Supermemory](https://supermemory.ai) API, scoped to your project so one account cleanly separates everything across every project you work on.
- **A web dashboard across all your projects.** Every flag, override, and goal change is also pushed to a hosted dashboard, so you can watch Consistency Score and decision history for all your projects in one place instead of one terminal at a time.
- **Bring your own LLM.** Smith talks to you — and judges every flagged action — using whichever provider you configure: Groq, OpenAI, Anthropic, or Gemini.
- **Nothing is guessed.** The goal is only ever written (or changed) once you explicitly confirm it — never inferred, never assumed.
- **A cheap filter before any LLM call.** A static regex/filename filter (package managers, infra keywords, destructive commands, sensitive files) runs first, with no network call. Only matches go to the LLM judge — everything else is allowed through instantly.
- **Smith flags, he doesn't gatekeep.** Every judged action is either silently allowed or shown to you as an `ask` permission prompt with his reasoning. He never hard-denies anything — the decision is always yours.
- **Fail open, always.** If the judge, the LLM, or Supermemory itself is unreachable or errors, the action is allowed. Agent Smith should never be the reason a legitimate command can't run.
- **The score reflects what you actually did, not what you promised.** Consistency Score = kept flags / total flags. Approving a flagged action anyway counts against it — and so does forcing a goal change through `smith argue` to make an objection go away.

## Getting started

```sh
npm install
npm link          # exposes the `smith` command globally
smith init
```

`smith init` will:
1. Ask for and validate an LLM provider API key.
2. Ask for and validate a Supermemory API key.
3. Ask for and validate your dashboard access token, then register this project with your dashboard account.
4. Wire the Claude Code hooks (`PreToolUse`, `PostToolUse`, `PostToolUseFailure`) into this project's `.claude/settings.json`.
5. Install the `/smith-score` and `/smith-commit` skills for this project.
6. Start the background watchdog server (`localhost:6789` by default).
7. Open a chat with Smith to pin down your project's goal (skipped if one is already set).

Run it again in the same project and Smith just shows you the goal already on file — no need to repeat yourself, and the server/hooks are left running if already active.

## Living with Smith

```sh
smith status       # Consistency Score, goal, and flagged decision history for this project
smith argue        # contest a flag or force a goal revision, through the same kind of chat as init
smith off          # stop the background watchdog server
```

`/smith-score` inside Claude Code does the same thing as `smith status`, formatted for the chat.

Every flagged action stays visible in your permission prompt with Smith's in-character reasoning. If you think a flag is wrong, or your goal itself needs to change, `smith argue` opens a conversation — Smith will push back if he disagrees, but the choice to override him is always yours. If you force a change through, it's logged as an override and reflected in your score, the same as approving a flagged action directly.

## The dashboard

Smith is a terminal tool, but the record he keeps is easier to read on a screen than in a scrollback buffer. Alongside the local watchdog, every project you run `smith init` in registers itself with a hosted dashboard, and from then on the local server pushes a running summary to it.

**What gets pushed**

- **Flagged decisions** — every action the judge ruled on, with the action, whether it contradicted your goal, and Smith's reasoning.
- **Overrides** — every time you approved a flagged action anyway, or forced a goal change through `smith argue`.
- **Goal snapshots** — pushed when the goal is first set, when `smith argue` revises it, and whenever you run `smith update`.

**What never gets pushed**

Your Supermemory API key stays on your machine. The dashboard never receives it and never talks to Supermemory — the local watchdog pushes scoped per-project summaries instead. A Supermemory key is account-wide across every project you work on, so handing it to a hosted service was a bigger blast radius than a scoped sync token was worth.

**Pushing a status update**

Decisions and overrides sync on their own as they happen. Goal and progress snapshots are explicit, so you control when your dashboard reflects a milestone:

```sh
smith update                 # sync the goal, tagged with your latest git commit message
smith update "shipped auth"  # sync with your own message instead
```

`/smith-commit` inside Claude Code does the same thing. This is deliberately a command you invoke rather than a hook that fires on every commit — Smith syncs when you say you've reached something worth recording, not on every stray write.

**Notes**

- Dashboard pushes are fire-and-forget and fail open, same as everything else. If the dashboard is down, your flags, score, and Supermemory history all keep working locally — you just won't see the latest on the web until the next sync.
- The resolved project ID is cached in `~/.agent-smith/config.json` under `dashboardProjects`, keyed by project, so nothing re-registers on every run.
- `smith update-key` can replace the dashboard token (choose `web`) without touching your other keys.
- `smith clear` unlinks the project from the dashboard as well, so the next `smith init` registers it fresh.
- The dashboard host defaults to `https://smith-bmjd.onrender.com` and can be pointed elsewhere with the `AGENT_SMITH_DASHBOARD_URL` environment variable.

## Managing your setup

```sh
smith update-key   # replace the provider key or the Supermemory key
smith reset        # clear your stored API keys and start over
smith clear        # permanently delete this project's goal, decision history, and Consistency Score from Supermemory, and unlink it from the dashboard
```

## Tech stack

- Node.js (CLI + a small Express server for the watchdog, no other framework)
- [Supermemory](https://supermemory.ai) — hosted memory store for the goal, decision log, and override log
- Groq / OpenAI / Anthropic / Gemini — pluggable LLM backends for both the chat and the contradiction judge
- Claude Code `PreToolUse` / `PostToolUse` / `PostToolUseFailure` HTTP hooks — how the watchdog actually sees what your agent is about to do
- A hosted dashboard (separate service, Supabase-backed) — cross-project view of scores, flagged decisions, and overrides

## Status

The onboarding flow, the watchdog layer, and the dashboard integration are built: key collection, goal-setting chat, the background `/analyze` server, hook wiring, the Consistency Score, `smith argue` for contesting flags or revising the goal, and the full terminal side of the dashboard sync (project registration, decision/override pushes, and `smith update` / `/smith-commit` status syncs). Not yet built: team-wide policies, and running a `smith argue`-style goal negotiation from the dashboard itself.