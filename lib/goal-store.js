const path = require("path");
const { execSync } = require("child_process");
const Supermemory = require("supermemory").default;

function getContainerTag() {
  let root;
  try {
    root = execSync("git rev-parse --show-toplevel", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    root = process.cwd();
  }
  // Supermemory's hosted API only allows [a-zA-Z0-9_:-] in containerTag,
  // but folder names (e.g. "smith_2.0") often contain other characters.
  const safeName = path.basename(root).replace(/[^a-zA-Z0-9_:-]/g, "-");
  return `project-${safeName}`;
}

function getClient(supermemoryApiKey) {
  const opts = { apiKey: supermemoryApiKey };
  if (process.env.AGENT_SMITH_SUPERMEMORY_BASE_URL) {
    opts.baseURL = process.env.AGENT_SMITH_SUPERMEMORY_BASE_URL;
  }
  return new Supermemory(opts);
}

async function pollDocumentDone(client, id, { retries = 30, intervalMs = 500 } = {}) {
  for (let i = 0; i < retries; i++) {
    const doc = await client.documents.get(id);
    if (doc.status === "done") return doc;
    if (doc.status === "failed") throw new Error(`Document ${id} failed processing`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timed out waiting for document ${id} to finish processing`);
}

async function findGoal(client, containerTag) {
  const result = await client.search.memories({
    q: "project goal",
    containerTag,
    threshold: 0,
    filters: { AND: [{ key: "type", value: "goal", filterType: "metadata" }] },
  });
  return result.results[0] || null;
}

async function pingSupermemory(supermemoryApiKey) {
  const client = getClient(supermemoryApiKey);
  try {
    await client.search.memories({ q: "smith-init-key-check", containerTag: "smith-key-check", threshold: 0 });
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      throw new Error("Supermemory rejected the key");
    }
    throw new Error(`Supermemory key check failed: ${err.message || err}`);
  }
}

async function clearContainer(client, containerTag) {
  await client.documents.deleteBulk({ containerTags: [containerTag] });
}

module.exports = { getContainerTag, getClient, pollDocumentDone, findGoal, pingSupermemory, clearContainer };
