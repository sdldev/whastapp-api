const fs = require('fs/promises');
const { MessageMedia } = require('whatsapp-web.js');
const clientManager = require('./clientManager.service');
const sendQueue = require('./sendQueue.service');
const messageCache = require('../store/messageCache.store');
const { normalizeChatId } = require('../utils/normalizeWhatsappId');
const { AppError } = require('../utils/errors');

async function sendBase64(sessionId, { to, mimetype, data, filename, caption }) {
  const client = clientManager.ensureReady(sessionId);
  const media = new MessageMedia(mimetype, data, filename);
  const sent = await sendQueue.runWithDelay(sessionId, () => client.sendMessage(normalizeChatId(to), media, caption ? { caption } : {}));
  messageCache.setMessage(sent);
  return messageCache.serializeMessage(sent);
}

async function sendUrl(sessionId, { to, url, caption }) {
  const client = clientManager.ensureReady(sessionId);
  const media = await MessageMedia.fromUrl(url);
  const sent = await sendQueue.runWithDelay(sessionId, () => client.sendMessage(normalizeChatId(to), media, caption ? { caption } : {}));
  messageCache.setMessage(sent);
  return messageCache.serializeMessage(sent);
}

async function sendUpload(sessionId, { to, caption, file }) {
  if (!file) throw new AppError('File is required', 400, 'FILE_REQUIRED');
  const client = clientManager.ensureReady(sessionId);
  const media = MessageMedia.fromFilePath(file.path);
  const sent = await sendQueue.runWithDelay(sessionId, () => client.sendMessage(normalizeChatId(to), media, caption ? { caption } : {}));
  await fs.unlink(file.path).catch(() => {});
  messageCache.setMessage(sent);
  return messageCache.serializeMessage(sent);
}

async function sendStickerBase64(sessionId, { to, mimetype, data, filename }) {
  const client = clientManager.ensureReady(sessionId);
  const media = new MessageMedia(mimetype, data, filename);
  const sent = await sendQueue.runWithDelay(sessionId, () => client.sendMessage(normalizeChatId(to), media, { sendMediaAsSticker: true }));
  messageCache.setMessage(sent);
  return messageCache.serializeMessage(sent);
}

async function sendStickerUrl(sessionId, { to, url }) {
  const client = clientManager.ensureReady(sessionId);
  const media = await MessageMedia.fromUrl(url);
  const sent = await sendQueue.runWithDelay(sessionId, () => client.sendMessage(normalizeChatId(to), media, { sendMediaAsSticker: true }));
  messageCache.setMessage(sent);
  return messageCache.serializeMessage(sent);
}

async function download(sessionId, messageId) {
  clientManager.ensureReady(sessionId);
  const cached = messageCache.getMessage(messageId);
  if (!cached) throw new AppError('Message not found in runtime cache', 404, 'MESSAGE_NOT_FOUND_IN_CACHE');
  if (!cached.hasMedia) throw new AppError('Message does not contain media', 400, 'MESSAGE_HAS_NO_MEDIA');
  const media = await cached.downloadMedia();
  if (!media) throw new AppError('Media is not available or cannot be downloaded', 404, 'MEDIA_NOT_AVAILABLE');
  return media;
}

async function downloadBinary(sessionId, messageId) {
  const media = await download(sessionId, messageId);
  return {
    mimetype: media.mimetype,
    filename: media.filename || null,
    buffer: Buffer.from(media.data, 'base64')
  };
}

module.exports = {
  sendBase64,
  sendUrl,
  sendUpload,
  sendStickerBase64,
  sendStickerUrl,
  download,
  downloadBinary
};
