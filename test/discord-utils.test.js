import test from "node:test";
import assert from "node:assert/strict";
import { parsePrompt, splitDiscordMessage } from "../src/discord-utils.js";

const guildMessage = (content) => ({ content, guild: {} });

test("parses mention prompts", () => {
  const config = { replyMode: "mention" };
  assert.equal(parsePrompt(guildMessage("<@123> hello"), "123", config), "hello");
  assert.equal(parsePrompt(guildMessage("unrelated"), "123", config), null);
  assert.equal(parsePrompt(guildMessage("gpt hello"), "123", config), null);
});

test("accepts plain direct messages", () => {
  assert.equal(parsePrompt({ content: "hello", guild: null }, "123", { replyMode: "both" }), "hello");
});

test("accepts guild messages containing gpt regardless of case", () => {
  const config = { replyMode: "detect" };
  assert.equal(parsePrompt(guildMessage("gpt 질문 있어"), "123", config), "gpt 질문 있어");
  assert.equal(parsePrompt(guildMessage("오늘 GPT에게 물어보자"), "123", config), "오늘 GPT에게 물어보자");
  assert.equal(parsePrompt(guildMessage("일반 메시지"), "123", config), null);
});

test("both accepts mentions and gpt detection while all accepts every message", () => {
  assert.equal(parsePrompt(guildMessage("<@123> hello"), "123", { replyMode: "both" }), "hello");
  assert.equal(parsePrompt(guildMessage("ChatGPT 질문"), "123", { replyMode: "both" }), "ChatGPT 질문");
  assert.equal(parsePrompt(guildMessage("일반 메시지"), "123", { replyMode: "both" }), null);
  assert.equal(parsePrompt(guildMessage("일반 메시지"), "123", { replyMode: "all" }), "일반 메시지");
});

test("splits long Discord messages within the limit", () => {
  const chunks = splitDiscordMessage("a".repeat(4100));
  assert.equal(chunks.length, 3);
  assert.ok(chunks.every((chunk) => chunk.length <= 2000));
  assert.equal(chunks.join(""), "a".repeat(4100));
});
