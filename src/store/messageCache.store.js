const messages = new Map();

function setMessage(message) {
  if (!message || !message.id) return null;
  const id = message.id._serialized || message.id.id || String(message.id);
  messages.set(id, message);
  return id;
}

function getMessage(messageId) {
  return messages.get(messageId);
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
  serializeMessage
};
