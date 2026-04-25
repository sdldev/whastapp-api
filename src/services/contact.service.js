const clientManager = require('./clientManager.service');
const sendQueue = require('./sendQueue.service');
const messageCache = require('../store/messageCache.store');
const { MessageMedia } = require('whatsapp-web.js');
const { normalizeChatId, normalizeContactId } = require('../utils/normalizeWhatsappId');
const { AppError } = require('../utils/errors');

function serializeContact(contact) {
  return {
    id: contact.id?._serialized,
    name: contact.name,
    pushname: contact.pushname,
    number: contact.number,
    shortName: contact.shortName,
    isBusiness: contact.isBusiness,
    isEnterprise: contact.isEnterprise,
    isMe: contact.isMe,
    isUser: contact.isUser,
    isGroup: contact.isGroup,
    isBlocked: contact.isBlocked
  };
}

async function getContact(sessionId, contactId) {
  const client = clientManager.ensureReady(sessionId);
  const contact = await client.getContactById(normalizeContactId(contactId));
  return serializeContact(contact);
}

async function listContacts(sessionId) {
  const client = clientManager.ensureReady(sessionId);
  const contacts = await client.getContacts();
  return contacts.map(serializeContact);
}

async function getAbout(sessionId, contactId) {
  const client = clientManager.ensureReady(sessionId);
  const contact = await client.getContactById(normalizeContactId(contactId));
  if (typeof contact.getAbout !== 'function') throw new AppError('Contact about is not available in this runtime', 400, 'FEATURE_NOT_AVAILABLE');
  const about = await contact.getAbout();
  return { contactId: contact.id._serialized, about };
}

async function getCommonGroups(sessionId, contactId) {
  const client = clientManager.ensureReady(sessionId);
  const contact = await client.getContactById(normalizeContactId(contactId));
  if (typeof contact.getCommonGroups !== 'function') throw new AppError('Common groups lookup is not available in this runtime', 400, 'FEATURE_NOT_AVAILABLE');
  const groups = await contact.getCommonGroups();
  return { contactId: contact.id._serialized, groups };
}

async function checkRegistered(sessionId, number) {
  const client = clientManager.ensureReady(sessionId);
  const contactId = normalizeContactId(number);
  const registeredId = await client.getNumberId(contactId.replace('@c.us', ''));
  return { number, registered: Boolean(registeredId), contactId: registeredId?._serialized || null };
}

async function getNumberId(sessionId, number) {
  const client = clientManager.ensureReady(sessionId);
  const numberId = await client.getNumberId(String(number).replace(/\D/g, ''));
  return { number, contactId: numberId?._serialized || null };
}

async function getFormattedNumber(sessionId, number) {
  const client = clientManager.ensureReady(sessionId);
  const formattedNumber = await client.getFormattedNumber(String(number));
  return { number, formattedNumber };
}

async function getCountryCode(sessionId, number) {
  const client = clientManager.ensureReady(sessionId);
  const countryCode = await client.getCountryCode(String(number));
  return { number, countryCode };
}

async function getProfilePicture(sessionId, contactId) {
  const client = clientManager.ensureReady(sessionId);
  const profilePictureUrl = await client.getProfilePicUrl(normalizeContactId(contactId));
  return { profilePictureUrl };
}

async function block(sessionId, contactId) {
  const client = clientManager.ensureReady(sessionId);
  const contact = await client.getContactById(normalizeContactId(contactId));
  await contact.block();
  return { contactId: contact.id._serialized, blocked: true };
}

async function unblock(sessionId, contactId) {
  const client = clientManager.ensureReady(sessionId);
  const contact = await client.getContactById(normalizeContactId(contactId));
  await contact.unblock();
  return { contactId: contact.id._serialized, blocked: false };
}

async function sendContactCard(sessionId, { to, contactId }) {
  const client = clientManager.ensureReady(sessionId);
  const contact = await client.getContactById(normalizeContactId(contactId));
  const sent = await sendQueue.runWithDelay(sessionId, () => client.sendMessage(normalizeChatId(to), contact));
  messageCache.setMessage(sent);
  return messageCache.serializeMessage(sent);
}

async function setDisplayName(sessionId, value) {
  const client = clientManager.ensureReady(sessionId);
  if (typeof client.setDisplayName !== 'function') throw new AppError('Set display name is not available in this runtime', 400, 'FEATURE_NOT_AVAILABLE');
  await client.setDisplayName(value);
  return { displayName: value };
}

async function setStatus(sessionId, value) {
  const client = clientManager.ensureReady(sessionId);
  if (typeof client.setStatus !== 'function') throw new AppError('Set status is not available in this runtime', 400, 'FEATURE_NOT_AVAILABLE');
  await client.setStatus(value);
  return { status: value };
}

async function setProfilePicture(sessionId, { mimetype, data, filename }) {
  const client = clientManager.ensureReady(sessionId);
  if (typeof client.setProfilePicture !== 'function') throw new AppError('Set profile picture is not available in this runtime', 400, 'FEATURE_NOT_AVAILABLE');
  const media = new MessageMedia(mimetype, data, filename);
  await client.setProfilePicture(media);
  return { profilePictureUpdated: true };
}

async function deleteProfilePicture(sessionId) {
  const client = clientManager.ensureReady(sessionId);
  if (typeof client.deleteProfilePicture !== 'function') throw new AppError('Delete profile picture is not available in this runtime', 400, 'FEATURE_NOT_AVAILABLE');
  await client.deleteProfilePicture();
  return { profilePictureDeleted: true };
}

module.exports = {
  getContact,
  listContacts,
  getAbout,
  getCommonGroups,
  checkRegistered,
  getNumberId,
  getFormattedNumber,
  getCountryCode,
  getProfilePicture,
  block,
  unblock,
  sendContactCard,
  setDisplayName,
  setStatus,
  setProfilePicture,
  deleteProfilePicture
};
