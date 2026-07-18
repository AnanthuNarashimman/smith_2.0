async function logOverride(client, containerTag, { action, actionHash }) {
  await client.documents.add({
    content: `Overridden action: ${action}`,
    containerTag,
    metadata: {
      type: "override",
      actionHash,
      timestamp: new Date().toISOString(),
    },
  });
}

// Prevents the same flagged incident from being counted twice — e.g. once when the
// user directly approves the flagged action, then again if they later run `smith
// argue` against that same flag. actionHash is undefined for goal changes made
// without a specific contested action, which always get logged (nothing to dedupe).
async function wasAlreadyOverridden(client, containerTag, actionHash) {
  if (!actionHash) return false;
  const result = await client.documents.list({
    containerTags: [containerTag],
    filters: {
      AND: [
        { key: "type", value: "override", filterType: "metadata" },
        { key: "actionHash", value: actionHash, filterType: "metadata" },
      ],
    },
    limit: 1,
  });
  return result.memories.length > 0;
}

module.exports = { logOverride, wasAlreadyOverridden };
