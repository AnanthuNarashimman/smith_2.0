# Agent Smith

> "Never send a human to do a machine's job."

A goal-fidelity watchdog for AI coding agents. You tell Smith, once, what your project is actually supposed to do. From then on, he remembers — and he's watching.

## The problem

AI coding agents drift. You ask for a simple auth fix, three prompts later it's refactoring your database layer. Nobody told it to stop; it just quietly wandered off the stated goal, and by the time you notice, you're reviewing a diff that has nothing to do with what you asked for.

## What Smith does

You state your project's goal once, through a live in-terminal conversation with Smith — styled after Agent Smith from *The Matrix*: measured, formal, faintly ominous. He asks just enough questions to pin down what you're actually building, then locks it in as a durable, retrievable memory.

That memory is the foundation for everything Smith does next: watching the actions your agent takes and calling out the ones that contradict what you said you wanted.

## How it works

- **One conversation, one goal.** `smith init` opens a chat with Smith. He asks about the core of what you're building — not an exhaustive spec — and drafts a concrete goal statement for you to confirm.
- **Hosted memory, not a local server.** Your goal (and the conversation that produced it) is stored via the [Supermemory](https://supermemory.ai) API, scoped to your project so one account cleanly separates goals across everything you work on.
- **Bring your own LLM.** Smith talks to you using whichever provider you configure — Groq, OpenAI, Anthropic, or Gemini.
- **Nothing is guessed.** The goal is only ever written once you explicitly confirm it — never inferred, never assumed.

## Getting started

```sh
npm install
npm link          # exposes the `smith` command globally
smith init
```

`smith init` will:
1. Ask for and validate an LLM provider API key.
2. Ask for and validate a Supermemory API key.
3. Open a chat with Smith to pin down your project's goal.
4. Store the confirmed goal, scoped to the current project.

Run it again in the same project and Smith just shows you the goal already on file — no need to repeat yourself.

## Managing your setup

```sh
smith update-key   # replace the provider key or the Supermemory key
smith reset        # clear your stored API keys and start over
smith clear        # permanently delete this project's stored memories from Supermemory
```

## Tech stack

- Node.js (CLI, no framework)
- [Supermemory](https://supermemory.ai) — hosted memory store for the goal and conversation history
- Groq / OpenAI / Anthropic / Gemini — pluggable LLM backends for the chat

## Status

This is the onboarding slice of a larger project: collecting keys and getting a goal on record. The background watchdog that checks live agent actions against that goal — and scores how well you stick to it — is the next phase.
