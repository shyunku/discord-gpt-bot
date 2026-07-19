import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConversationStore, conversationKey } from "../src/conversation-store.js";

function memoryStore(overrides = {}) {
  return new ConversationStore({
    filename: ":memory:",
    maxMessages: 2,
    maxConversations: 10,
    ttlMs: 1000,
    ...overrides,
  });
}

test("keeps only the configured number of messages", (t) => {
  const store = memoryStore();
  t.after(() => store.close());
  store.append("a", [{ role: "user", content: "1" }, { role: "assistant", content: "2" }], 10);
  store.append("a", [{ role: "user", content: "3" }], 20);
  assert.deepEqual(store.get("a", 20).map((x) => x.content), ["2", "3"]);
});

test("expires old conversations", (t) => {
  const store = memoryStore({ ttlMs: 100 });
  t.after(() => store.close());
  store.append("a", [{ role: "user", content: "hello" }], 10);
  assert.deepEqual(store.get("a", 111), []);
});

test("evicts the oldest conversations", (t) => {
  const store = memoryStore({ maxConversations: 2 });
  t.after(() => store.close());
  store.append("a", [{ role: "user", content: "a" }], 10);
  store.append("b", [{ role: "user", content: "b" }], 20);
  store.append("c", [{ role: "user", content: "c" }], 30);
  assert.deepEqual(store.get("a", 30), []);
  assert.equal(store.get("b", 30)[0].content, "b");
  assert.equal(store.get("c", 30)[0].content, "c");
});

test("persists conversations across database reopen", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "discord-gpt-test-"));
  const filename = join(directory, "conversations.db");
  const now = Date.now();
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  const first = new ConversationStore({ filename, maxMessages: 2, maxConversations: 10, ttlMs: 10_000 });
  first.append("a", [{ role: "user", content: "saved" }], now);
  first.close();

  const second = new ConversationStore({ filename, maxMessages: 2, maxConversations: 10, ttlMs: 10_000 });
  assert.equal(second.get("a", now + 1)[0].content, "saved");
  second.close();
});

test("builds keys for each scope", () => {
  const message = { author: { id: "u" }, channelId: "c" };
  assert.equal(conversationKey(message, "user"), "user:u");
  assert.equal(conversationKey(message, "channel"), "channel:c");
  assert.equal(conversationKey(message, "channel-user"), "channel-user:c:u");
});
