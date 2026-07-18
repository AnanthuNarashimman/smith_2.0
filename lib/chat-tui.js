const readline = require("readline");
const { wrapText } = require("./ascii-utils");

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const GRAY = "\x1b[90m";
const RESET = "\x1b[0m";
const PROMPT = `${CYAN}you ›${RESET} `;

function contentWidth() {
  return process.stdout.columns ? Math.max(40, process.stdout.columns - 2) : 76;
}

function separator() {
  console.log(`${GRAY}${"─".repeat(contentWidth())}${RESET}`);
}

function boxLines(text, width) {
  const inner = Math.max(10, width - 4);
  const wrapped = wrapText(text, inner);
  const top = "╔" + "═".repeat(inner + 2) + "╗";
  const bottom = "╚" + "═".repeat(inner + 2) + "╝";
  const body = wrapped.map((l) => "║ " + l + " ".repeat(inner - l.length) + " ║");
  return [top, ...body, bottom];
}

function createChatTUI() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  let cancelled = false;
  let pendingResolve = null;
  let spinnerTimer = null;

  rl.on("SIGINT", () => {
    cancelled = true;
    if (spinnerTimer) {
      clearInterval(spinnerTimer);
      spinnerTimer = null;
    }
    if (pendingResolve) {
      const resolve = pendingResolve;
      pendingResolve = null;
      console.log();
      resolve(null);
    }
  });

  // Input can end without SIGINT (Ctrl+D, piped/redirected stdin closing) — treat it the
  // same as a cancel instead of leaving a pending question() to throw ERR_USE_AFTER_CLOSE.
  rl.on("close", () => {
    cancelled = true;
    if (spinnerTimer) {
      clearInterval(spinnerTimer);
      spinnerTimer = null;
    }
    if (pendingResolve) {
      const resolve = pendingResolve;
      pendingResolve = null;
      resolve(null);
    }
  });

  function appendUser() {
    // readline's own question() already echoed what the user typed; nothing more to print.
  }

  function appendAssistant(text) {
    const width = contentWidth();
    const lines = wrapText(text, width - "Smith › ".length);
    console.log(`${GREEN}Smith ›${RESET} ${lines[0] || ""}`);
    for (let i = 1; i < lines.length; i++) {
      console.log(`  ${lines[i]}`);
    }
    separator();
  }

  function appendNote(text) {
    console.log(`${GRAY}${text}${RESET}`);
  }

  function appendDraftGoal(goal) {
    for (const line of boxLines(goal, Math.min(contentWidth(), 78))) {
      console.log(`${YELLOW}${line}${RESET}`);
    }
  }

  function setThinking(isThinking) {
    if (spinnerTimer) {
      clearInterval(spinnerTimer);
      spinnerTimer = null;
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
    }
    if (!isThinking) return;
    let frame = 0;
    spinnerTimer = setInterval(() => {
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(`${GREEN}${SPINNER_FRAMES[frame % SPINNER_FRAMES.length]} Smith is thinking...${RESET}`);
      frame++;
    }, 80);
  }

  function prompt() {
    if (cancelled) return Promise.resolve(null);
    return new Promise((resolve) => {
      pendingResolve = resolve;
      rl.question(PROMPT, (answer) => {
        pendingResolve = null;
        if (cancelled) return;
        resolve(answer.trim());
      });
    });
  }

  function destroy() {
    if (spinnerTimer) clearInterval(spinnerTimer);
    rl.close();
  }

  return { appendUser, appendAssistant, appendNote, appendDraftGoal, setThinking, prompt, destroy };
}

module.exports = { createChatTUI };
