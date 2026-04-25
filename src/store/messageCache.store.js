const env = require('../config/env');

const messages = new Map();

function now() {
  return Date.now();
}

function getMessageId(message) {
  if (!message || !message.id) return null;
  return message.id._serialized || message.id.id || String(message.id);
}

function pruneExpired(timestamp = now()) {
  const ttlMs = env.messageCacheTtlMs;
  for (const [id, entry] of messages.entries()) {
    if (timestamp - entry.cachedAt > ttlMs) messages.delete(id);
  }
}

function enforceMaxEntries() {
  while (messages.size > env.messageCacheMaxEntries) {
    const oldestId = messages.keys().next().value;
    if (!oldestId) return;
    messages.delete(oldestId);
  }
}

function setMessage(message) {
  const id = getMessageId(message);
  if (!id) return null;

  if (messages.has(id)) messages.delete(id);
  messages.set(id, {
    message,
    cachedAt: now()
  });
  pruneExpired();
  enforceMaxEntries();
  return id;
}

function getMessage(messageId) {
  pruneExpired();
  const entry = messages.get(messageId);
  if (!entry) return undefined;

  messages.delete(messageId);
  messages.set(messageId, entry);
  return entry.message;
}

function getCacheStats() {
  pruneExpired();
  return {
    size: messages.size,
    maxEntries: env.messageCacheMaxEntries,
    ttlMs: env.messageCacheTtlMs
  };
}

function serializeMessage(message) {
  if (!message) return null;
  const id = message.id?._serialized || message.id?.id || null;
  return {
    id,
    from: message.from,
    to: message.to,
    author: message.author,
    body: message.body,
    type: message.type,
    timestamp: message.timestamp,
    hasMedia: Boolean(message.hasMedia),
    fromMe: Boolean(message.fromMe),
    mentionedIds: message.mentionedIds || []
  };
}

module.exports = {
  setMessage,
  getMessage,
  getCacheStats,
  serializeMessage
};