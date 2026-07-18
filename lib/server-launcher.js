const { spawn } = require("child_process");
const path = require("path");
const net = require("net");

const PORT = Number(process.env.AGENT_SMITH_PORT) || 6789;

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
    socket.connect(port, "127.0.0.1");
  });
}

async function ensureServerRunning() {
  const running = await isPortOpen(PORT);
  if (running) return { started: false, port: PORT };

  const serverPath = path.join(__dirname, "..", "server", "server.js");
  const child = spawn(process.execPath, [serverPath], {
    detached: true,
    stdio: "ignore",
    cwd: process.cwd(),
  });
  child.unref();

  for (let i = 0; i < 20; i++) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (await isPortOpen(PORT)) return { started: true, port: PORT };
  }
  throw new Error(`Agent Smith server didn't come up on port ${PORT} in time`);
}

async function stopServer() {
  const running = await isPortOpen(PORT);
  if (!running) return { stopped: false, port: PORT };

  await fetch(`http://localhost:${PORT}/shutdown`, { method: "POST" });

  for (let i = 0; i < 20; i++) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (!(await isPortOpen(PORT))) return { stopped: true, port: PORT };
  }
  throw new Error(`Agent Smith server on port ${PORT} didn't shut down in time`);
}

module.exports = { ensureServerRunning, stopServer, isPortOpen, PORT };
