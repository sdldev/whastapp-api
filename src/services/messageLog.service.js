const { randomUUID } = require('crypto');
const env = require('../config/env');
const persistence = require('./persistence.service');
const logger = require('../utils/logger');

function nowIso() {
  return new Date().toISOString();
}

function truncateBody(body) {
  if (!env.messageLogStoreBody || body === undefined || body === null) return null;
  const text = String(body);
  if (env.messageLogBodyMaxLength <= 0) return null;
  return text.length > env.messageLogBodyMaxLength ? text.slice(0, env.messageLogBodyMaxLength) : text;
}

function messageIdFrom(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value._serialized || value.id || String(value);
}

function normalizeTimestamp(value, fallback = nowIso()) {
  if (!value) return fallback;
  if (typeof value === 'number') return new Date(value * 1000).toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function rowToMessageLog(row) {
  if (!row) return null;
  return {
    id: row.id,
    waMessageId: row.wa_message_id || null,
    sessionId: row.session_id,
    apiClientId: row.api_client_id || null,
    direction: row.direction,
    chatId: row.chat_id,
    fromId: row.from_id || null,
    toId: row.to_id || null,
    type: row.type,
    body: row.body || null,
    hasMedia: Boolean(row.has_media),
    status: row.status,
    error: row.error || null,
    requestId: row.request_id || null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    sentAt: row.sent_at ? (row.sent_at instanceof Date ? row.sent_at.toISOString() : row.sent_at) : null,
    receivedAt: row.received_at ? (row.received_at instanceof Date ? row.received_at.toISOString() : row.received_at) : null
  };
}

function buildOutboundLog({ sessionId, chatId, message, status, sent, error, actor = {}, requestId = null, type = 'chat' }) {
  const createdAt = nowIso();
  return {
    id: randomUUID(),
    waMessageId: sent ? messageIdFrom(sent.id) : null,
    sessionId,
    apiClientId: actor && actor.authMode === 'api-client' ? actor.clientId : null,
    direction: 'outbound',
    chatId,
    fromId: sent ? (sent.from || null) : null,
    toId: sent ? (sent.to || chatId) : chatId,
    type: sent ? (sent.type || type) : type,
    body: truncateBody(sent && sent.body !== undefined ? sent.body : message),
    hasMedia: Boolean(sent && sent.hasMedia),
    status,
    error: error ? String(error.message || error).slice(0, 1000) : null,
    requestId,
    createdAt,
    sentAt: status === 'sent' ? createdAt : null,
    receivedAt: null
  };
}

function buildInboundLog(sessionId, message) {
  const serializedId = messageIdFrom(message && message.id);
  const timestamp = normalizeTimestamp(message && message.timestamp);
  return {
    id: randomUUID(),
    waMessageId: serializedId,
    sessionId,
    apiClientId: null,
    direction: message && message.fromMe ? 'outbound' : 'inbound',
    chatId: (message && (message.fromMe ? message.to : message.from)) || 'unknown',
    fromId: message ? (message.from || null) : null,
    toId: message ? (message.to || null) : null,
    type: (message && message.type) || 'chat',
    body: truncateBody(message && message.body),
    hasMedia: Boolean(message && message.hasMedia),
    status: message && message.fromMe ? 'created' : 'received',
    error: null,
    requestId: null,
    createdAt: timestamp,
    sentAt: message && message.fromMe ? timestamp : null,
    receivedAt: message && !message.fromMe ? timestamp : null
  };
}

async function appendMessageLog(entry) {
  if (!persistence.isPostgresEnabled()) return null;
  try {
    await persistence.query(
      `INSERT INTO message_logs (
        id,
        wa_message_id,
        session_id,
        api_client_id,
        direction,
        chat_id,
        from_id,
        to_id,
        type,
        body,
        has_media,
        status,
        error,
        request_id,
        created_at,
        sent_at,
        received_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        entry.id,
        entry.waMessageId,
        entry.sessionId,
        entry.apiClientId,
        entry.direction,
        entry.chatId,
        entry.fromId,
        entry.toId,
        entry.type,
        entry.body,
        entry.hasMedia,
        entry.status,
        entry.error,
        entry.requestId,
        entry.createdAt,
        entry.sentAt,
        entry.receivedAt
      ]
    );
    return entry;
  } catch (error) {
    logger.warn({ err: error, sessionId: entry.sessionId, direction: entry.direction }, 'Failed to append message log');
    return null;
  }
}

async function logOutboundSuccess(context) {
  return appendMessageLog(buildOutboundLog({ ...context, status: 'sent' }));
}

async function logOutboundFailure(context) {
  return appendMessageLog(buildOutboundLog({ ...context, status: 'failed' }));
}

async function logIncomingMessage(sessionId, message) {
  return appendMessageLog(buildInboundLog(sessionId, message));
}

async function listMessageLogs(filters = {}) {
  if (!persistence.isPostgresEnabled()) {
    return { driver: env.persistenceDriver, items: [] };
  }

  const where = [];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replace('?', `$${params.length}`));
  };

  if (filters.sessionId) add('session_id = ?', filters.sessionId);
  if (filters.apiClientId) add('api_client_id = ?', filters.apiClientId);
  if (filters.chatId) add('chat_id = ?', filters.chatId);
  if (filters.direction) add('direction = ?', filters.direction);
  if (filters.status) add('status = ?', filters.status);
  if (filters.fromDate) add('created_at >= ?', filters.fromDate);
  if (filters.toDate) add('created_at <= ?', filters.toDate);

  const limit = Math.min(Math.max(Number(filters.limit || 100), 1), 1000);
  params.push(limit);
  const sql = `SELECT * FROM message_logs ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT $${params.length}`;
  const result = await persistence.query(sql, params);
  return { driver: env.persistenceDriver, items: result.rows.map(rowToMessageLog) };
}

module.exports = {
  appendMessageLog,
  logOutboundSuccess,
  logOutboundFailure,
  logIncomingMessage,
  listMessageLogs,
  truncateBody,
  buildOutboundLog,
  buildInboundLog
};
