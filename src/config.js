import "dotenv/config";

const REQUIRED_KEYS = ["DISCORD_TOKEN", "OPENAI_API_KEY", "OPENAI_MODEL"];

function integer(name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

function choice(name, fallback, values) {
  const value = process.env[name]?.trim().toLowerCase() || fallback;
  if (!values.includes(value)) {
    throw new Error(`${name} must be one of: ${values.join(", ")}.`);
  }
  return value;
}

export function loadConfig() {
  const missing = REQUIRED_KEYS.filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const baseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1";
  let parsedBaseUrl;
  try {
    parsedBaseUrl = new URL(baseUrl);
  } catch {
    throw new Error("OPENAI_BASE_URL must be a valid URL.");
  }
  if (!["http:", "https:"].includes(parsedBaseUrl.protocol)) {
    throw new Error("OPENAI_BASE_URL must use http or https.");
  }

  const reasoningEffort = process.env.OPENAI_REASONING_EFFORT?.trim().toLowerCase() || "";
  const reasoningEfforts = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];
  if (reasoningEffort && !reasoningEfforts.includes(reasoningEffort)) {
    throw new Error(`OPENAI_REASONING_EFFORT must be one of: ${reasoningEfforts.join(", ")}.`);
  }

  return Object.freeze({
    discordToken: process.env.DISCORD_TOKEN.trim(),
    openaiApiKey: process.env.OPENAI_API_KEY.trim(),
    openaiModel: process.env.OPENAI_MODEL.trim(),
    openaiBaseUrl: baseUrl.replace(/\/+$/, ""),
    maxOutputTokens: integer("MAX_OUTPUT_TOKENS", 2048, { min: 1, max: 128000 }),
    reasoningEffort,
    systemPrompt:
      process.env.SYSTEM_PROMPT?.trim() ||
      "You are a helpful, accurate, and concise assistant. Reply in the user's language.",
    openaiTimeoutMs: integer("OPENAI_TIMEOUT_MS", 120000, { min: 1000, max: 600000 }),
    openaiMaxRetries: integer("OPENAI_MAX_RETRIES", 2, { min: 0, max: 5 }),
    replyMode: choice("REPLY_MODE", "both", ["mention", "detect", "both", "all"]),
    conversationScope: choice("CONVERSATION_SCOPE", "channel-user", [
      "channel",
      "user",
      "channel-user",
    ]),
    maxHistoryMessages: integer("MAX_HISTORY_MESSAGES", 20, { min: 0, max: 100 }),
    maxConversations: integer("MAX_CONVERSATIONS", 500, { min: 1, max: 10000 }),
    conversationTtlMs:
      integer("CONVERSATION_TTL_MINUTES", 60, { min: 1, max: 10080 }) * 60_000,
    sqlitePath: process.env.SQLITE_PATH?.trim() || "./data/conversations.db",
    userCooldownMs: integer("USER_COOLDOWN_MS", 1000, { min: 0, max: 60000 }),
    maxInputChars: integer("MAX_INPUT_CHARS", 12000, { min: 1, max: 100000 }),
  });
}
