const clientManager = require('./clientManager.service');
const sendQueue = require('./sendQueue.service');
const messageCache = require('../store/messageCache.store');
const { normalizeChatId, normalizeMentionId, normalizeGroupId } = require('../utils/normalizeWhatsappId');

async function mentionUsers(sessionId, { to, message, mentions }) {
  const client = clientManager.ensureReady(sessionId);
  const mentionIds = mentions.map(normalizeMentionId);
  const sent = await sendQueue.runWithDelay(sessionId, () => client.sendMessage(normalizeChatId(to), message, { mentions: mentionIds }));
  messageCache.setMessage(sent);
  return messageCache.serializeMessage(sent);
}

async function mentionGroups(sessionId, { to, message, groupMentions }) {
  const client = clientManager.ensureReady(sessionId);
  const normalized = groupMentions.map((item) => ({
    id: normalizeGroupId(item.id),
    subject: item.subject
  }));
  const sent = await sendQueue.runWithDelay(sessionId, () => client.sendMessage(normalizeChatId(to), message, { groupMentions: normalized }));
  messageCache.setMessage(sent);
  return messageCache.serializeMessage(sent);
}

module.exports = {
  mentionUsers,
  mentionGroups
};
