const fs = require("fs");
const path = require("path");
const os = require("os");

const CONFIG_DIR = path.join(os.homedir(), ".agent-smith");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

const PROVIDERS = {
  groq: {
    label: "Groq",
    defaultModel: "llama-3.3-70b-versatile",
    async ping(apiKey) {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) throw new Error(`Groq rejected the key (HTTP ${res.status})`);
    },
    async chat(apiKey, model, systemPrompt, messages) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          temperature: 0.3,
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) throw new Error(`Groq request failed (${res.status}): ${await res.text()}`);
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content;
      if (!raw) throw new Error("Groq response missing message content");
      return raw;
    },
  },
  openai: {
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    async ping(apiKey) {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) throw new Error(`OpenAI rejected the key (HTTP ${res.status})`);
    },
    async chat(apiKey, model, systemPrompt, messages) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          temperature: 0.3,
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) throw new Error(`OpenAI request failed (${res.status}): ${await res.text()}`);
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content;
      if (!raw) throw new Error("OpenAI response missing message content");
      return raw;
    },
  },
  anthropic: {
    label: "Anthropic",
    defaultModel: "claude-haiku-4-5",
    async ping(apiKey) {
      const res = await fetch("https://api.anthropic.com/v1/models", {
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      });
      if (!res.ok) throw new Error(`Anthropic rejected the key (HTTP ${res.status})`);
    },
    async chat(apiKey, model, systemPrompt, messages) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          system: systemPrompt,
          messages,
        }),
      });
      if (!res.ok) throw new Error(`Anthropic request failed (${res.status}): ${await res.text()}`);
      const data = await res.json();
      const raw = data.content?.find((b) => b.type === "text")?.text;
      if (!raw) throw new Error("Anthropic response missing text content");
      return raw;
    },
  },
  gemini: {
    label: "Gemini",
    defaultModel: "gemini-2.5-flash",
    async ping(apiKey) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
      );
      if (!res.ok) throw new Error(`Gemini rejected the key (HTTP ${res.status})`);
    },
    async chat(apiKey, model, systemPrompt, messages) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: messages.map((m) => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }],
            })),
            generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
          }),
        }
      );
      if (!res.ok) throw new Error(`Gemini request failed (${res.status}): ${await res.text()}`);
      const data = await res.json();
      const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("");
      if (!raw) throw new Error("Gemini response missing text content");
      return raw;
    },
  },
};

function readConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return null;
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}

function writeConfig(config) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
}

module.exports = { readConfig, writeConfig, PROVIDERS, CONFIG_PATH, CONFIG_DIR };
