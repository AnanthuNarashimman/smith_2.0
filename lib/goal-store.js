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
  // search.memories() depends on Supermemory's async "dreaming" consolidation step,
  // which can lag well past documents.get() reporting status: "done" (observed 25s+
  // with no results). documents.list() reads the container directly and is immediately
  // consistent, so it's used here instead — this is a structured lookup by metadata,
  // not a semantic search, so nothing is lost by not going through search.memories().
  const result = await client.documents.list({
    containerTags: [containerTag],
    includeContent: true,
    limit: 1,
    filters: { AND: [{ key: "type", value: "goal", filterType: "metadata" }] },
  });
  const doc = result.memories[0];
  if (!doc) return null;
  return { memory: doc.content, updatedAt: doc.updatedAt, id: doc.id };
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
