async function logOverride(client, containerTag, { action }) {
  await client.documents.add({
    content: `Overridden action: ${action}`,
    containerTag,
    metadata: {
      type: "override",
      timestamp: new Date().toISOString(),
    },
  });
}

module.exports = { logOverride };
