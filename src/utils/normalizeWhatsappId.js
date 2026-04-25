function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeContactId(value) {
  if (!value) return value;
  const text = String(value).trim();
  if (text.endsWith('@c.us')) return text;
  if (text.endsWith('@g.us')) return text;
  if (text.includes('@')) return text;
  return `${onlyDigits(text)}@c.us`;
}

function normalizeGroupId(value) {
  if (!value) return value;
  const text = String(value).trim();
  if (text.endsWith('@g.us')) return text;
  return text;
}

function normalizeChatId(value) {
  if (!value) return value;
  const text = String(value).trim();
  if (text.endsWith('@c.us') || text.endsWith('@g.us') || text.endsWith('@newsletter')) return text;
  return `${onlyDigits(text)}@c.us`;
}

function normalizeMentionId(value) {
  const text = String(value).trim();
  if (text.endsWith('@c.us')) return text;
  return `${onlyDigits(text)}@c.us`;
}

function contactIdToMentionText(value) {
  return normalizeMentionId(value).replace('@c.us', '');
}

module.exports = {
  normalizeContactId,
  normalizeGroupId,
  normalizeChatId,
  normalizeMentionId,
  contactIdToMentionText
};
