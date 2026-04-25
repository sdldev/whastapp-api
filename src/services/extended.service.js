const { Location, Poll, MessageMedia } = require('whatsapp-web.js');
const clientManager = require('./clientManager.service');
const sendQueue = require('./sendQueue.service');
const messageCache = require('../store/messageCache.store');
const { normalizeChatId, normalizeGroupId, normalizeContactId } = require('../utils/normalizeWhatsappId');
const { AppError } = require('../utils/errors');
const { assertSafeOutboundUrl } = require('../utils/outboundUrl');

function ensureFeature(target, methodName, label = methodName) {
  if (!target || typeof target[methodName] !== 'function') {
    throw new AppError(`${label} is not available in this whatsapp-web.js runtime`, 400, 'FEATURE_NOT_AVAILABLE');
  }
}

function serializeChannel(channel) {
  return {
    id: channel.id?._serialized,
    name: channel.name,
    isChannel: Boolean(channel.isChannel),
    isReadOnly: channel.isReadOnly,
    isMuted: channel.isMuted,
    timestamp: channel.timestamp,
    archived: channel.archived,
    pinned: channel.pinned,
    description: channel.description,
    owner: channel.owner?._serialized || channel.owner,
    subscribersCount: channel.subscribersCount
  };
}

async function getChannelChat(sessionId, channelId) {
  const client = clientManager.ensureReady(sessionId);
  const channel = await client.getChatById(normalizeChatId(channelId));
  if (!channel) throw new AppError('Channel not found', 404, 'CHANNEL_NOT_FOUND');
  if (!channel.isChannel) throw new AppError('Target chat is not a channel', 400, 'NOT_A_CHANNEL');
  return channel;
}

async function sendLocation(sessionId, { to, latitude, longitude, description }) {
  const client = clientManager.ensureReady(sessionId);
  const location = new Location(latitude, longitude, description || '');
  const sent = await sendQueue.runWithDelay(sessionId, () => client.sendMessage(normalizeChatId(to), location));
  messageCache.setMessage(sent);
  return messageCache.serializeMessage(sent);
}

function serializeChat(chat) {
  return {
    id: chat.id?._serialized,
    name: chat.name,
    isGroup: chat.isGroup,
    isMuted: chat.isMuted,
    isReadOnly: chat.isReadOnly,
    unreadCount: chat.unreadCount,
    timestamp: chat.timestamp,
    archived: chat.archived,
    pinned: chat.pinned
  };
}

async function getChat(sessionId, chatId) {
  const client = clientManager.ensureReady(sessionId);
  const chat = await client.getChatById(normalizeChatId(chatId));
  return serializeChat(chat);
}

async function listChats(sessionId) {
  const client = clientManager.ensureReady(sessionId);
  const chats = await client.getChats();
  return chats.map(serializeChat);
}

async function searchChats(sessionId, { query, limit = 25 }) {
  const chats = await listChats(sessionId);
  const normalizedQuery = String(query).toLowerCase();
  return chats
    .filter((chat) => [chat.id, chat.name].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedQuery)))
    .slice(0, limit);
}

async function archiveChat(sessionId, chatId, archived = true) {
  const client = clientManager.ensureReady(sessionId);
  const chat = await client.getChatById(normalizeChatId(chatId));
  if (archived && typeof chat.archive === 'function') await chat.archive();
  else if (!archived && typeof chat.unarchive === 'function') await chat.unarchive();
  else throw new AppError('Archive operation is not available for this chat', 400, 'FEATURE_NOT_AVAILABLE');
  return { chatId: chat.id._serialized, archived };
}

async function pinChat(sessionId, chatId, pinned = true) {
  const client = clientManager.ensureReady(sessionId);
  const chat = await client.getChatById(normalizeChatId(chatId));
  if (pinned && typeof chat.pin === 'function') await chat.pin();
  else if (!pinned && typeof chat.unpin === 'function') await chat.unpin();
  else throw new AppError('Pin operation is not available for this chat', 400, 'FEATURE_NOT_AVAILABLE');
  return { chatId: chat.id._serialized, pinned };
}

async function clearChat(sessionId, chatId) {
  const client = clientManager.ensureReady(sessionId);
  const chat = await client.getChatById(normalizeChatId(chatId));
  if (typeof chat.clearMessages !== 'function') throw new AppError('Clear chat is not available for this chat', 400, 'FEATURE_NOT_AVAILABLE');
  await chat.clearMessages();
  return { chatId: chat.id._serialized, cleared: true };
}

async function deleteChat(sessionId, chatId) {
  const client = clientManager.ensureReady(sessionId);
  const chat = await client.getChatById(normalizeChatId(chatId));
  if (typeof chat.delete !== 'function') throw new AppError('Delete chat is not available for this chat', 400, 'FEATURE_NOT_AVAILABLE');
  await chat.delete();
  return { chatId: chat.id._serialized, deleted: true };
}

async function muteChat(sessionId, chatId, until) {
  const client = clientManager.ensureReady(sessionId);
  const chat = await client.getChatById(normalizeChatId(chatId));
  const date = until ? new Date(until) : new Date(Date.now() + 8 * 60 * 60 * 1000);
  await chat.mute(date);
  return { chatId: chat.id._serialized, mutedUntil: date.toISOString() };
}

async function unmuteChat(sessionId, chatId) {
  const client = clientManager.ensureReady(sessionId);
  const chat = await client.getChatById(normalizeChatId(chatId));
  await chat.unmute();
  return { chatId: chat.id._serialized, muted: false };
}

async function getGroup(sessionId, groupId) {
  const client = clientManager.ensureReady(sessionId);
  const chat = await client.getChatById(normalizeGroupId(groupId));
  return {
    id: chat.id?._serialized,
    name: chat.name,
    description: chat.description,
    owner: chat.owner?._serialized || chat.owner,
    participants: chat.participants || []
  };
}

async function joinGroup(sessionId, inviteCodeOrUrl) {
  const client = clientManager.ensureReady(sessionId);
  const code = String(inviteCodeOrUrl).split('/').pop();
  const result = await client.acceptInvite(code);
  return { groupId: result };
}

async function createGroup(sessionId, { name, participants }) {
  const client = clientManager.ensureReady(sessionId);
  const result = await client.createGroup(name, participants.map(normalizeContactId));
  return result;
}

async function getInviteInfo(sessionId, inviteCodeOrUrl) {
  const client = clientManager.ensureReady(sessionId);
  const code = String(inviteCodeOrUrl).split('/').pop();
  if (typeof client.getInviteInfo !== 'function') throw new AppError('Invite info lookup is not available in this runtime', 400, 'FEATURE_NOT_AVAILABLE');
  return client.getInviteInfo(code);
}

async function getInvite(sessionId, groupId) {
  const client = clientManager.ensureReady(sessionId);
  const chat = await client.getChatById(normalizeGroupId(groupId));
  const inviteCode = await chat.getInviteCode();
  return { groupId: chat.id._serialized, inviteCode, inviteUrl: `https://chat.whatsapp.com/${inviteCode}` };
}

async function revokeInvite(sessionId, groupId) {
  const client = clientManager.ensureReady(sessionId);
  const chat = await client.getChatById(normalizeGroupId(groupId));
  if (typeof chat.revokeInvite !== 'function') throw new AppError('Revoke invite is not available for this group', 400, 'FEATURE_NOT_AVAILABLE');
  const inviteCode = await chat.revokeInvite();
  return { groupId: chat.id._serialized, inviteCode, inviteUrl: inviteCode ? `https://chat.whatsapp.com/${inviteCode}` : null };
}

async function leaveGroup(sessionId, groupId) {
  const client = clientManager.ensureReady(sessionId);
  const chat = await client.getChatById(normalizeGroupId(groupId));
  if (typeof chat.leave !== 'function') throw new AppError('Leave group is not available for this group', 400, 'FEATURE_NOT_AVAILABLE');
  await chat.leave();
  return { groupId: chat.id._serialized, left: true };
}

async function setGroupPicture(sessionId, groupId, { mimetype, data, filename }) {
  const client = clientManager.ensureReady(sessionId);
  const chat = await client.getChatById(normalizeGroupId(groupId));
  if (typeof chat.setPicture !== 'function') throw new AppError('Set group picture is not available for this group', 400, 'FEATURE_NOT_AVAILABLE');
  const media = new MessageMedia(mimetype, data, filename);
  await chat.setPicture(media);
  return { groupId: chat.id._serialized, pictureUpdated: true };
}

async function deleteGroupPicture(sessionId, groupId) {
  const client = clientManager.ensureReady(sessionId);
  const chat = await client.getChatById(normalizeGroupId(groupId));
  if (typeof chat.deletePicture !== 'function') throw new AppError('Delete group picture is not available for this group', 400, 'FEATURE_NOT_AVAILABLE');
  await chat.deletePicture();
  return { groupId: chat.id._serialized, pictureDeleted: true };
}

async function updateGroupInfo(sessionId, groupId, { subject, description }) {
  const client = clientManager.ensureReady(sessionId);
  const chat = await client.getChatById(normalizeGroupId(groupId));
  if (subject) await chat.setSubject(subject);
  if (description) await chat.setDescription(description);
  return getGroup(sessionId, groupId);
}

async function updateGroupSettings(sessionId, groupId, { messagesAdminsOnly, infoAdminsOnly }) {
  const client = clientManager.ensureReady(sessionId);
  const chat = await client.getChatById(normalizeGroupId(groupId));
  if (typeof messagesAdminsOnly === 'boolean') await chat.setMessagesAdminsOnly(messagesAdminsOnly);
  if (typeof infoAdminsOnly === 'boolean') await chat.setInfoAdminsOnly(infoAdminsOnly);
  return { groupId: chat.id._serialized, messagesAdminsOnly, infoAdminsOnly };
}

async function addParticipants(sessionId, groupId, participants) {
  const client = clientManager.ensureReady(sessionId);
  const chat = await client.getChatById(normalizeGroupId(groupId));
  return chat.addParticipants(participants.map(normalizeContactId));
}

async function removeParticipant(sessionId, groupId, participantId) {
  const client = clientManager.ensureReady(sessionId);
  const chat = await client.getChatById(normalizeGroupId(groupId));
  return chat.removeParticipants([normalizeContactId(participantId)]);
}

async function promoteParticipant(sessionId, groupId, participantId) {
  const client = clientManager.ensureReady(sessionId);
  const chat = await client.getChatById(normalizeGroupId(groupId));
  return chat.promoteParticipants([normalizeContactId(participantId)]);
}

async function demoteParticipant(sessionId, groupId, participantId) {
  const client = clientManager.ensureReady(sessionId);
  const chat = await client.getChatById(normalizeGroupId(groupId));
  return chat.demoteParticipants([normalizeContactId(participantId)]);
}

async function getMembershipRequests(sessionId, groupId) {
  const client = clientManager.ensureReady(sessionId);
  const chat = await client.getChatById(normalizeGroupId(groupId));
  ensureFeature(chat, 'getGroupMembershipRequests', 'Get group membership requests');
  return chat.getGroupMembershipRequests();
}

async function approveMembershipRequests(sessionId, groupId, requesterIds) {
  const client = clientManager.ensureReady(sessionId);
  const chat = await client.getChatById(normalizeGroupId(groupId));
  ensureFeature(chat, 'approveGroupMembershipRequests', 'Approve group membership requests');
  const options = Array.isArray(requesterIds) && requesterIds.length > 0
    ? { requesterIds: requesterIds.map(normalizeContactId) }
    : undefined;
  return chat.approveGroupMembershipRequests(options);
}

async function rejectMembershipRequests(sessionId, groupId, requesterIds) {
  const client = clientManager.ensureReady(sessionId);
  const chat = await client.getChatById(normalizeGroupId(groupId));
  ensureFeature(chat, 'rejectGroupMembershipRequests', 'Reject group membership requests');
  const options = Array.isArray(requesterIds) && requesterIds.length > 0
    ? { requesterIds: requesterIds.map(normalizeContactId) }
    : undefined;
  return chat.rejectGroupMembershipRequests(options);
}

async function mentionEveryone(sessionId, groupId, { messagePrefix, messageSuffix } = {}) {
  const client = clientManager.ensureReady(sessionId);
  const chat = await client.getChatById(normalizeGroupId(groupId));

  if (!chat.isGroup) {
    throw new AppError('Target chat is not a group', 400, 'NOT_A_GROUP_CHAT');
  }

  const mentionIds = [];
  const mentionTexts = [];
  for (const participant of chat.participants || []) {
    const user = participant.id?.user;
    const serialized = participant.id?._serialized || (user ? `${user}@c.us` : null);
    if (!user || !serialized) continue;
    mentionIds.push(serialized);
    mentionTexts.push(`@${user}`);
  }

  if (mentionIds.length === 0) {
    throw new AppError('Group has no mentionable participants', 400, 'NO_GROUP_PARTICIPANTS');
  }

  const parts = [];
  if (messagePrefix) parts.push(messagePrefix);
  parts.push(mentionTexts.join(' '));
  if (messageSuffix) parts.push(messageSuffix);

  const sent = await sendQueue.runWithDelay(sessionId, () => chat.sendMessage(parts.join('\n'), { mentions: mentionIds }));
  messageCache.setMessage(sent);
  return {
    message: messageCache.serializeMessage(sent),
    mentionedCount: mentionIds.length
  };
}

async function createPoll(sessionId, { to, name, options, allowMultipleAnswers }) {
  const client = clientManager.ensureReady(sessionId);
  const poll = new Poll(name, options, { allowMultipleAnswers: Boolean(allowMultipleAnswers) });
  const sent = await sendQueue.runWithDelay(sessionId, () => client.sendMessage(normalizeChatId(to), poll));
  messageCache.setMessage(sent);
  return messageCache.serializeMessage(sent);
}

async function votePoll(sessionId, messageId, selectedOptions) {
  clientManager.ensureReady(sessionId);
  const message = messageCache.getMessage(messageId);
  if (!message) throw new AppError('Poll message not found in runtime cache', 404, 'MESSAGE_NOT_FOUND_IN_CACHE');
  if (typeof message.vote !== 'function') throw new AppError('Poll voting is not available for this cached message', 400, 'FEATURE_NOT_AVAILABLE');
  await message.vote(selectedOptions);
  return { messageId, selectedOptions };
}

async function listChannels(sessionId) {
  const client = clientManager.ensureReady(sessionId);
  const chats = await client.getChats();
  return chats.filter((chat) => chat.isChannel).map(serializeChannel);
}

async function searchChannels(sessionId, { query, limit = 25 }) {
  const channels = await listChannels(sessionId);
  const normalizedQuery = String(query).toLowerCase();
  return channels
    .filter((channel) => [channel.id, channel.name, channel.description].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedQuery)))
    .slice(0, limit);
}

async function getChannel(sessionId, channelId) {
  const channel = await getChannelChat(sessionId, channelId);
  return serializeChannel(channel);
}

async function sendChannelMessage(sessionId, channelId, payload) {
  const channel = await getChannelChat(sessionId, channelId);
  ensureFeature(channel, 'sendMessage', 'Channel send message');

  let content = payload.message;
  const options = { waitUntilMsgSent: true, ...(payload.options || {}) };
  if (payload.caption) options.caption = payload.caption;

  if (payload.url) {
    const safeUrl = await assertSafeOutboundUrl(payload.url);
    content = await MessageMedia.fromUrl(safeUrl);
  } else if (payload.data) {
    content = new MessageMedia(payload.mimetype, payload.data, payload.filename);
  }

  const sent = await sendQueue.runWithDelay(sessionId, () => channel.sendMessage(content, options));
  messageCache.setMessage(sent);
  return messageCache.serializeMessage(sent);
}

async function fetchChannelMessages(sessionId, channelId, { searchOptions = {}, limit } = {}) {
  const channel = await getChannelChat(sessionId, channelId);
  ensureFeature(channel, 'fetchMessages', 'Channel fetch messages');
  const options = { ...(searchOptions || {}) };
  if (limit && !options.limit) options.limit = limit;
  const messages = await channel.fetchMessages(Object.keys(options).length ? options : undefined);
  messages.forEach((message) => messageCache.setMessage(message));
  return messages.map((message) => messageCache.serializeMessage(message));
}

async function sendChannelSeen(sessionId, channelId) {
  const channel = await getChannelChat(sessionId, channelId);
  ensureFeature(channel, 'sendSeen', 'Channel send seen');
  const result = await channel.sendSeen();
  return { channelId: channel.id._serialized, seen: Boolean(result) };
}

async function muteChannel(sessionId, channelId, muted = true) {
  const channel = await getChannelChat(sessionId, channelId);
  const methodName = muted ? 'mute' : 'unmute';
  ensureFeature(channel, methodName, muted ? 'Channel mute' : 'Channel unmute');
  const result = await channel[methodName]();
  return { channelId: channel.id._serialized, muted, result };
}

async function updateChannelInfo(sessionId, channelId, { subject, description }) {
  const channel = await getChannelChat(sessionId, channelId);
  if (subject) {
    ensureFeature(channel, 'setSubject', 'Channel set subject');
    await channel.setSubject(subject);
  }
  if (description) {
    ensureFeature(channel, 'setDescription', 'Channel set description');
    await channel.setDescription(description);
  }
  return getChannel(sessionId, channelId);
}

async function setChannelPicture(sessionId, channelId, { mimetype, data, filename }) {
  const channel = await getChannelChat(sessionId, channelId);
  ensureFeature(channel, 'setProfilePicture', 'Channel set profile picture');
  const media = new MessageMedia(mimetype, data, filename);
  const result = await channel.setProfilePicture(media);
  return { channelId: channel.id._serialized, pictureUpdated: Boolean(result) };
}

async function setChannelReactionSetting(sessionId, channelId, reactionCode) {
  const channel = await getChannelChat(sessionId, channelId);
  ensureFeature(channel, 'setReactionSetting', 'Channel set reaction setting');
  const result = await channel.setReactionSetting(reactionCode);
  return { channelId: channel.id._serialized, reactionCode, result };
}

async function acceptChannelAdminInvite(sessionId, channelId) {
  const channel = await getChannelChat(sessionId, channelId);
  ensureFeature(channel, 'acceptChannelAdminInvite', 'Accept channel admin invite');
  const result = await channel.acceptChannelAdminInvite();
  return { channelId: channel.id._serialized, accepted: Boolean(result) };
}

async function sendChannelAdminInvite(sessionId, channelId, userId, options = {}) {
  const channel = await getChannelChat(sessionId, channelId);
  ensureFeature(channel, 'sendChannelAdminInvite', 'Send channel admin invite');
  const result = await channel.sendChannelAdminInvite(normalizeContactId(userId), options || {});
  return { channelId: channel.id._serialized, userId: normalizeContactId(userId), result };
}

async function revokeChannelAdminInvite(sessionId, channelId, userId) {
  const channel = await getChannelChat(sessionId, channelId);
  ensureFeature(channel, 'revokeChannelAdminInvite', 'Revoke channel admin invite');
  const result = await channel.revokeChannelAdminInvite(normalizeContactId(userId));
  return { channelId: channel.id._serialized, userId: normalizeContactId(userId), result };
}

async function transferChannelOwnership(sessionId, channelId, userId, options = {}) {
  const channel = await getChannelChat(sessionId, channelId);
  ensureFeature(channel, 'transferChannelOwnership', 'Transfer channel ownership');
  const result = await channel.transferChannelOwnership(normalizeContactId(userId), options || {});
  return { channelId: channel.id._serialized, userId: normalizeContactId(userId), result };
}

async function demoteChannelAdmin(sessionId, channelId, userId) {
  const channel = await getChannelChat(sessionId, channelId);
  ensureFeature(channel, 'demoteChannelAdmin', 'Demote channel admin');
  const result = await channel.demoteChannelAdmin(normalizeContactId(userId));
  return { channelId: channel.id._serialized, userId: normalizeContactId(userId), result };
}

async function getChannelSubscribers(sessionId, channelId, limit) {
  const channel = await getChannelChat(sessionId, channelId);
  ensureFeature(channel, 'getSubscribers', 'Get channel subscribers');
  return channel.getSubscribers(limit);
}

async function deleteChannel(sessionId, channelId) {
  const channel = await getChannelChat(sessionId, channelId);
  ensureFeature(channel, 'deleteChannel', 'Delete channel');
  const result = await channel.deleteChannel();
  return { channelId: channel.id._serialized, deleted: Boolean(result) };
}

module.exports = {
  sendLocation,
  getChat,
  listChats,
  searchChats,
  archiveChat,
  pinChat,
  clearChat,
  deleteChat,
  muteChat,
  unmuteChat,
  getGroup,
  joinGroup,
  createGroup,
  getInviteInfo,
  getInvite,
  revokeInvite,
  leaveGroup,
  setGroupPicture,
  deleteGroupPicture,
  updateGroupInfo,
  updateGroupSettings,
  addParticipants,
  removeParticipant,
  promoteParticipant,
  demoteParticipant,
  getMembershipRequests,
  approveMembershipRequests,
  rejectMembershipRequests,
  mentionEveryone,
  createPoll,
  votePoll,
  listChannels,
  searchChannels,
  getChannel,
  sendChannelMessage,
  fetchChannelMessages,
  sendChannelSeen,
  muteChannel,
  updateChannelInfo,
  setChannelPicture,
  setChannelReactionSetting,
  acceptChannelAdminInvite,
  sendChannelAdminInvite,
  revokeChannelAdminInvite,
  transferChannelOwnership,
  demoteChannelAdmin,
  getChannelSubscribers,
  deleteChannel
};
