const BASE_URL = process.env.AGENT_SMITH_DASHBOARD_URL || "https://smith-bmjd.onrender.com";

async function apiRequest(path, token, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    throw new Error(`Dashboard request to ${path} failed (HTTP ${res.status})`);
  }
  return res.json();
}

async function pingDashboard(token) {
  const res = await fetch(`${BASE_URL}/api/cli/validate-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    throw new Error("Dashboard rejected the token");
  }
  if (!res.ok) {
    throw new Error(`Dashboard key check failed (HTTP ${res.status})`);
  }
  const data = await res.json();
  if (!data.valid) {
    throw new Error("Dashboard rejected the token");
  }
  return data;
}

async function registerProject(token, name, goal) {
  const result = await apiRequest("/api/cli/projects", token, { name, goal: goal || null });
  return result.projectId;
}

async function pushDecision(token, projectId, { action, contradicts, reasoning }) {
  await apiRequest(`/api/cli/projects/${projectId}/decisions`, token, { action, contradicts, reasoning });
}

async function pushOverride(token, projectId, { action, actionHash }) {
  await apiRequest(`/api/cli/projects/${projectId}/overrides`, token, { action, actionHash });
}

async function syncStatus(token, projectId, { goal, message }) {
  await apiRequest(`/api/cli/projects/${projectId}/sync`, token, { goal: goal || null, message: message || null });
}

module.exports = { pingDashboard, registerProject, pushDecision, pushOverride, syncStatus };
