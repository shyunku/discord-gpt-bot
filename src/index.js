import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
} from "discord.js";
import { loadConfig } from "./config.js";
import { ConversationStore, conversationKey } from "./conversation-store.js";
import { imageAttachments, parsePrompt, splitDiscordMessage } from "./discord-utils.js";
import { OpenAIResponsesClient } from "./openai.js";

let config;
try {
  config = loadConfig();
} catch (error) {
  console.error(`[configuration] ${error.message}`);
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
  allowedMentions: { parse: [], repliedUser: false },
});

const ai = new OpenAIResponsesClient({
  apiKey: config.openaiApiKey,
  baseUrl: config.openaiBaseUrl,
  model: config.openaiModel,
  maxOutputTokens: config.maxOutputTokens,
  reasoningEffort: config.reasoningEffort,
  instructions: config.systemPrompt,
  timeoutMs: config.openaiTimeoutMs,
  maxRetries: config.openaiMaxRetries,
});

const conversations = new ConversationStore({
  filename: config.sqlitePath,
  maxMessages: config.maxHistoryMessages,
  maxConversations: config.maxConversations,
  ttlMs: config.conversationTtlMs,
});
const cleanupTimer = setInterval(() => {
  try {
    conversations.cleanup();
  } catch (error) {
    console.error("[database cleanup]", error);
  }
}, Math.min(config.conversationTtlMs, 10 * 60_000));
cleanupTimer.unref();
const queues = new Map();
const lastRequestByUser = new Map();

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready as ${readyClient.user.tag} | model=${config.openaiModel} | mode=${config.replyMode}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !client.user) return;

  const prompt = parsePrompt(message, client.user.id, config);
  if (prompt === null) return;

  const images = imageAttachments(message);
  const command = prompt.trim().toLowerCase();
  const key = conversationKey(message, config.conversationScope);

  if (command === "help") {
    await message.reply(helpText());
    return;
  }
  if (command === "reset" || command === "new") {
    conversations.reset(key);
    await message.reply("대화 기록을 초기화했습니다.");
    return;
  }
  if (!prompt && images.length === 0) {
    await message.reply("봇을 태그하면서 질문을 함께 보내 주세요.");
    return;
  }
  if (prompt.length > config.maxInputChars) {
    await message.reply(`입력이 너무 깁니다. 최대 ${config.maxInputChars.toLocaleString()}자까지 보낼 수 있습니다.`);
    return;
  }

  const now = Date.now();
  const remaining = config.userCooldownMs - (now - (lastRequestByUser.get(message.author.id) || 0));
  if (remaining > 0) {
    await message.reply(`${Math.ceil(remaining / 1000)}초 후 다시 시도해 주세요.`);
    return;
  }
  lastRequestByUser.set(message.author.id, now);

  enqueue(key, async () => {
    const stopTyping = keepTyping(message.channel);
    try {
      const history = conversations.get(key);
      const answer = await ai.respond(history, prompt, images);
      conversations.append(key, [
        { role: "user", content: prompt || "[Image attachment]" },
        { role: "assistant", content: answer },
      ]);

      const chunks = splitDiscordMessage(answer);
      await message.reply({ content: chunks[0], allowedMentions: { parse: [], repliedUser: false } });
      for (const chunk of chunks.slice(1)) {
        await message.channel.send({ content: chunk, allowedMentions: { parse: [] } });
      }
    } catch (error) {
      console.error(`[request] user=${message.author.id} channel=${message.channelId}`, error);
      await message.reply("요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요. 자세한 내용은 봇 로그를 확인하세요.")
        .catch(() => undefined);
    } finally {
      stopTyping();
    }
  });
});

client.on(Events.Error, (error) => console.error("[discord]", error));

process.on("unhandledRejection", (error) => console.error("[unhandledRejection]", error));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    console.log(`Received ${signal}; shutting down.`);
    clearInterval(cleanupTimer);
    client.destroy();
    conversations.close();
    process.exit(0);
  });
}

client.login(config.discordToken).catch((error) => {
  console.error(`[login] ${error.message}`);
  clearInterval(cleanupTimer);
  conversations.close();
  process.exit(1);
});

function enqueue(key, task) {
  const previous = queues.get(key) || Promise.resolve();
  const current = previous.catch(() => undefined).then(task);
  queues.set(key, current);
  current.finally(() => {
    if (queues.get(key) === current) queues.delete(key);
  });
}

function keepTyping(channel) {
  channel.sendTyping().catch(() => undefined);
  const timer = setInterval(() => channel.sendTyping().catch(() => undefined), 8000);
  return () => clearInterval(timer);
}

function helpText() {
  return [
    "**ChatGPT 봇 사용법**",
    "• 질문: `@봇이름 오늘 저녁 메뉴 추천해줘` 또는 `gpt 오늘 저녁 메뉴 추천해줘`",
    "• 새 대화: `@봇이름 reset`",
    "• 도움말: `@봇이름 help`",
    "• DM에서는 접두사 없이 바로 질문할 수 있습니다.",
    "• 이미지 파일을 질문과 함께 첨부할 수 있습니다.",
  ].join("\n");
}
