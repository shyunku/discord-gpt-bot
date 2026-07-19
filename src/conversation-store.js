import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";

export class ConversationStore {
  constructor({ filename, maxMessages, maxConversations, ttlMs }) {
    this.maxMessages = maxMessages;
    this.maxConversations = maxConversations;
    this.ttlMs = ttlMs;

    const databaseFile = filename === ":memory:" ? filename : resolve(filename);
    if (databaseFile !== ":memory:") mkdirSync(dirname(databaseFile), { recursive: true });

    this.db = new Database(databaseFile);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        conversation_key TEXT PRIMARY KEY,
        messages_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS conversations_updated_at_idx
        ON conversations(updated_at);
    `);

    this.selectStatement = this.db.prepare(`
      SELECT messages_json, updated_at
      FROM conversations
      WHERE conversation_key = ?
    `);
    this.touchStatement = this.db.prepare(`
      UPDATE conversations SET updated_at = ? WHERE conversation_key = ?
    `);
    this.upsertStatement = this.db.prepare(`
      INSERT INTO conversations (conversation_key, messages_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(conversation_key) DO UPDATE SET
        messages_json = excluded.messages_json,
        updated_at = excluded.updated_at
    `);
    this.deleteStatement = this.db.prepare(`
      DELETE FROM conversations WHERE conversation_key = ?
    `);
    this.deleteExpiredStatement = this.db.prepare(`
      DELETE FROM conversations WHERE updated_at < ?
    `);
    this.evictStatement = this.db.prepare(`
      DELETE FROM conversations
      WHERE conversation_key IN (
        SELECT conversation_key
        FROM conversations
        ORDER BY updated_at DESC, conversation_key DESC
        LIMIT -1 OFFSET ?
      )
    `);
    this.appendTransaction = this.db.transaction((key, messages, now) => {
      const current = this.get(key, now);
      const next = [...current, ...messages].slice(-this.maxMessages);
      this.upsertStatement.run(key, JSON.stringify(next), now);
      this.cleanup(now);
    });

    this.cleanup();
  }

  get(key, now = Date.now()) {
    const row = this.selectStatement.get(key);
    if (!row) return [];
    if (now - row.updated_at > this.ttlMs) {
      this.deleteStatement.run(key);
      return [];
    }

    try {
      const messages = JSON.parse(row.messages_json);
      if (!Array.isArray(messages)) throw new Error("Stored messages are not an array.");
      this.touchStatement.run(now, key);
      return messages.map((message) => ({ ...message }));
    } catch {
      this.deleteStatement.run(key);
      return [];
    }
  }

  append(key, messages, now = Date.now()) {
    if (this.maxMessages === 0) {
      this.reset(key);
      return;
    }
    this.appendTransaction(key, messages, now);
  }

  reset(key) {
    return this.deleteStatement.run(key).changes > 0;
  }

  cleanup(now = Date.now()) {
    const expired = this.deleteExpiredStatement.run(now - this.ttlMs).changes;
    const evicted = this.evictStatement.run(this.maxConversations).changes;
    return expired + evicted;
  }

  close() {
    if (this.db.open) this.db.close();
  }
}

export function conversationKey(message, scope) {
  if (scope === "user") return `user:${message.author.id}`;
  if (scope === "channel") return `channel:${message.channelId}`;
  return `channel-user:${message.channelId}:${message.author.id}`;
}
