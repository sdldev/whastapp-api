const clientManager = require('./clientManager.service');
const sendQueue = require('./sendQueue.service');
const messageCache = require('../store/messageCache.store');
const { normalizeChatId } = require('../utils/normalizeWhatsappId');
const { AppError } = require('../utils/errors');
const messageLogService = require('./messageLog.service');

async function sendText(sessionId, { to, message, options = {} }, context = {}) {
  const client = clientManager.ensureReady(sessionId);
  const chatId = normalizeChatId(to);
  try {
    const sent = await sendQueue.runWithDelay(sessionId, () => client.sendMessage(chatId, message, options));
    messageCache.setMessage(sent);
    await messageLogService.logOutboundSuccess({
      sessionId,
      chatId,
      message,
      sent,
      actor: context.actor,
      requestId: context.requestId,
      type: 'chat'
    });
    return messageCache.serializeMessage(sent);
  } catch (error) {
    await messageLogService.logOutboundFailure({
      sessionId,
      chatId,
      message,
      error,
      actor: context.actor,
      requestId: context.requestId,
      type: 'chat'
    });
    throw error;
  }
}

async function reply(sessionId, { messageId, message }) {
  clientManager.ensureReady(sessionId);
  const cached = messageCache.getMessage(messageId);
  if (!cached) throw new AppError('Message not found in runtime cache', 404, 'MESSAGE_NOT_FOUND_IN_CACHE');
  const sent = await sendQueue.runWithDelay(sessionId, () => cached.reply(message));
  messageCache.setMessage(sent);
  return messageCache.serializeMessage(sent);
}

async function react(sessionId, { messageId, reaction }) {
  clientManager.ensureReady(sessionId);
  const cached = messageCache.getMessage(messageId);
  if (!cached) throw new AppError('Message not found in runtime cache', 404, 'MESSAGE_NOT_FOUND_IN_CACHE');
  await cached.react(reaction);
  return { messageId, reaction };
}

async function forward(sessionId, messageId, { to }) {
  clientManager.ensureReady(sessionId);
  const cached = messageCache.getMessage(messageId);
  if (!cached) throw new AppError('Message not found in runtime cache', 404, 'MESSAGE_NOT_FOUND_IN_CACHE');
  const forwarded = await sendQueue.runWithDelay(sessionId, () => cached.forward(normalizeChatId(to)));
  messageCache.setMessage(forwarded);
  return messageCache.serializeMessage(forwarded);
}

async function edit(sessionId, messageId, { message }) {
  clientManager.ensureReady(sessionId);
  const cached = messageCache.getMessage(messageId);
  if (!cached) throw new AppError('Message not found in runtime cache', 404, 'MESSAGE_NOT_FOUND_IN_CACHE');
  if (typeof cached.edit !== 'function') throw new AppError('Message edit is not available in this runtime', 400, 'FEATURE_NOT_AVAILABLE');
  const edited = await cached.edit(message);
  if (edited) messageCache.setMessage(edited);
  return edited ? messageCache.serializeMessage(edited) : { messageId, edited: true };
}

async function deleteMessage(sessionId, messageId, options = {}) {
  clientManager.ensureReady(sessionId);
  const cached = messageCache.getMessage(messageId);
  if (!cached) throw new AppError('Message not found in runtime cache', 404, 'MESSAGE_NOT_FOUND_IN_CACHE');
  await cached.delete(Boolean(options.everyone));
  return { messageId, deleted: true, everyone: Boolean(options.everyone) };
}

async function star(sessionId, messageId) {
  clientManager.ensureReady(sessionId);
  const cached = messageCache.getMessage(messageId);
  if (!cached) throw new AppError('Message not found in runtime cache', 404, 'MESSAGE_NOT_FOUND_IN_CACHE');
  await cached.star();
  return { messageId, starred: true };
}

async function unstar(sessionId, messageId) {
  clientManager.ensureReady(sessionId);
  const cached = messageCache.getMessage(messageId);
  if (!cached) throw new AppError('Message not found in runtime cache', 404, 'MESSAGE_NOT_FOUND_IN_CACHE');
  await cached.unstar();
  return { messageId, starred: false };
}

async function getQuoted(sessionId, messageId) {
  clientManager.ensureReady(sessionId);
  const cached = messageCache.getMessage(messageId);
  if (!cached) throw new AppError('Message not found in runtime cache', 404, 'MESSAGE_NOT_FOUND_IN_CACHE');
  if (typeof cached.getQuotedMessage !== 'function') throw new AppError('Quoted message lookup is not available', 400, 'FEATURE_NOT_AVAILABLE');
  const quoted = await cached.getQuotedMessage();
  if (!quoted) throw new AppError('Quoted message not found', 404, 'QUOTED_MESSAGE_NOT_FOUND');
  messageCache.setMessage(quoted);
  return messageCache.serializeMessage(quoted);
}

async function fetchMessages(sessionId, chatId, { limit = 25, fromMe } = {}) {
  const client = clientManager.ensureReady(sessionId);
  const chat = await client.getChatById(normalizeChatId(chatId));
  const messages = await chat.fetchMessages({ limit, fromMe });
  messages.forEach((message) => messageCache.setMessage(message));
  return messages.map(messageCache.serializeMessage);
}

async function searchMessages(sessionId, chatId, { query, limit = 25, page = 0 }) {
  const client = clientManager.ensureReady(sessionId);
  if (typeof client.searchMessages !== 'function') {
    throw new AppError('Message search is not available in this runtime', 400, 'FEATURE_NOT_AVAILABLE');
  }
  const messages = await client.searchMessages(query, { chatId: normalizeChatId(chatId), limit, page });
  messages.forEach((message) => messageCache.setMessage(message));
  return messages.map(messageCache.serializeMessage);
}

async function sendSeen(sessionId, chatId) {
  const client = clientManager.ensureReady(sessionId);
  const chat = await client.getChatById(normalizeChatId(chatId));
  if (typeof chat.sendSeen !== 'function') throw new AppError('Send seen is not available for this chat', 400, 'FEATURE_NOT_AVAILABLE');
  await chat.sendSeen();
  return { chatId: chat.id._serialized, seen: true };
}

async function markUnread(sessionId, chatId) {
  const client = clientManager.ensureReady(sessionId);
  const chat = await client.getChatById(normalizeChatId(chatId));
  if (typeof chat.markUnread !== 'function') throw new AppError('Mark unread is not available for this chat', 400, 'FEATURE_NOT_AVAILABLE');
  await chat.markUnread();
  return { chatId: chat.id._serialized, unread: true };
}

async function sendTyping(sessionId, chatId, { durationMs } = {}) {
  const client = clientManager.ensureReady(sessionId);
  const chat = await client.getChatById(normalizeChatId(chatId));
  if (typeof chat.sendStateTyping !== 'function') throw new AppError('Typing presence is not available for this chat', 400, 'FEATURE_NOT_AVAILABLE');
  await chat.sendStateTyping();
  if (durationMs) {
    setTimeout(() => chat.clearState().catch(() => {}), durationMs).unref?.();
  }
  return { chatId: chat.id._serialized, presence: 'typing', durationMs: durationMs || null };
}

async function sendRecording(sessionId, chatId, { durationMs } = {}) {
  const client = clientManager.ensureReady(sessionId);
  const chat = await client.getChatById(normalizeChatId(chatId));
  if (typeof chat.sendStateRecording !== 'function') throw new AppError('Recording presence is not available for this chat', 400, 'FEATURE_NOT_AVAILABLE');
  await chat.sendStateRecording();
  if (durationMs) {
    setTimeout(() => chat.clearState().catch(() => {}), durationMs).unref?.();
  }
  return { chatId: chat.id._serialized, presence: 'recording', durationMs: durationMs || null };
}

async function clearPresence(sessionId, chatId) {
  const client = clientManager.ensureReady(sessionId);
  const chat = await client.getChatById(normalizeChatId(chatId));
  if (typeof chat.clearState !== 'function') throw new AppError('Clear presence is not available for this chat', 400, 'FEATURE_NOT_AVAILABLE');
  await chat.clearState();
  return { chatId: chat.id._serialized, presence: 'cleared' };
}

async function sendPresenceAvailable(sessionId) {
  const client = clientManager.ensureReady(sessionId);
  if (typeof client.sendPresenceAvailable !== 'function') throw new AppError('Presence available is not available in this runtime', 400, 'FEATURE_NOT_AVAILABLE');
  await client.sendPresenceAvailable();
  return { presence: 'available' };
}

async function sendPresenceUnavailable(sessionId) {
  const client = clientManager.ensureReady(sessionId);
  if (typeof client.sendPresenceUnavailable !== 'function') throw new AppError('Presence unavailable is not available in this runtime', 400, 'FEATURE_NOT_AVAILABLE');
  await client.sendPresenceUnavailable();
  return { presence: 'unavailable' };
}

async function listMessageLogs(filters = {}) {
  return messageLogService.listMessageLogs(filters);
}

module.exports = {
  sendText,
  listMessageLogs,
  reply,
  react,
  forward,
  edit,
  deleteMessage,
  star,
  unstar,
  getQuoted,
  fetchMessages,
  searchMessages,
  sendSeen,
  markUnread,
  sendTyping,
  sendRecording,
  clearPresence,
  sendPresenceAvailable,
  sendPresenceUnavailable
};
