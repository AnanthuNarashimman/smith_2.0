async function logDecision(client, containerTag, { action, contradicts, reasoning }) {
  await client.documents.add({
    content: `Action: ${action}\nVerdict: ${contradicts ? "contradiction flagged" : "allowed"}\nReasoning: ${reasoning}`,
    containerTag,
    metadata: {
      type: "decision",
      contradicts,
      timestamp: new Date().toISOString(),
    },
  });
}

async function getMostRecentFlagged(client, containerTag) {
  const result = await client.documents.list({
    containerTags: [containerTag],
    filters: { AND: [{ key: "type", value: "decision", filterType: "metadata" }] },
    includeContent: true,
    sort: "createdAt",
    order: "desc",
    limit: 20,
  });
  const match = result.memories.find((d) => d.metadata && d.metadata.contradicts === true);
  if (!match) return null;

  const lines = match.content.split("\n");
  const action = (lines[0] || "").replace(/^Action:\s*/, "");
  const reasoning = (lines[2] || "").replace(/^Reasoning:\s*/, "");
  return { action, reasoning, createdAt: match.createdAt };
}

async function wasFlaggedContradiction(client, containerTag, action) {
  const result = await client.documents.list({
    containerTags: [containerTag],
    filters: { AND: [{ key: "type", value: "decision", filterType: "metadata" }] },
    includeContent: true,
    sort: "createdAt",
    order: "desc",
    limit: 20,
  });
  const match = result.memories.find((d) => d.content.includes(`Action: ${action}`));
  return Boolean(match && match.metadata && match.metadata.contradicts === true);
}

module.exports = { logDecision, wasFlaggedContradiction, getMostRecentFlagged };
