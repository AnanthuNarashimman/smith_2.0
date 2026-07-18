async function logDecision(client, containerTag, { action, actionHash, contradicts, reasoning }) {
  await client.documents.add({
    content: `Action: ${action}\nVerdict: ${contradicts ? "contradiction flagged" : "allowed"}\nReasoning: ${reasoning}`,
    containerTag,
    metadata: {
      type: "decision",
      contradicts,
      actionHash,
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
  const actionHash = match.metadata && match.metadata.actionHash;
  return { action, reasoning, actionHash, createdAt: match.createdAt };
}

// Matches by a hash of the actual tool call (see lib/action-hash.js) rather than a
// substring of the rendered action text — a literal-text match breaks the moment the
// same command gets rendered with different whitespace/quoting between the PreToolUse
// write and the PostToolUse/PostToolUseFailure lookup, either silently missing a real
// override or, worse, matching an unrelated later run of what looks like the same text.
async function wasFlaggedContradiction(client, containerTag, actionHash) {
  const result = await client.documents.list({
    containerTags: [containerTag],
    filters: {
      AND: [
        { key: "type", value: "decision", filterType: "metadata" },
        { key: "actionHash", value: actionHash, filterType: "metadata" },
      ],
    },
    includeContent: true,
    sort: "createdAt",
    order: "desc",
    limit: 20,
  });
  const match = result.memories.find((d) => d.metadata && d.metadata.contradicts === true);
  return Boolean(match);
}

module.exports = { logDecision, wasFlaggedContradiction, getMostRecentFlagged };
