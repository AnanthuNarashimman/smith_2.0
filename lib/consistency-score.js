async function listByType(client, containerTag, type) {
  const result = await client.documents.list({
    containerTags: [containerTag],
    filters: { AND: [{ key: "type", value: type, filterType: "metadata" }] },
    includeContent: true,
    sort: "createdAt",
    order: "desc",
    limit: 200,
  });
  return result.memories;
}

async function computeConsistencyScore(client, containerTag) {
  const decisions = await listByType(client, containerTag, "decision");
  const overrides = await listByType(client, containerTag, "override");

  const flagged = decisions.filter((d) => d.metadata && d.metadata.contradicts === true);
  const overriddenCount = overrides.length;
  const flaggedCount = flagged.length;
  const keptCount = Math.max(flaggedCount - overriddenCount, 0);
  const score = flaggedCount === 0 ? null : Math.round((keptCount / flaggedCount) * 100);

  return { score, flaggedCount, keptCount, overriddenCount, flaggedDecisions: flagged, overrides };
}

module.exports = { computeConsistencyScore };
