const { randomUUID } = require('crypto');
const env = require('../config/env');
const { appendJsonLine, readJsonLines } = require('../utils/jsonlFile');

const auditLogFile = env.auditLogFile;

const SENSITIVE_BODY_KEY_PATTERNS = [
  'apikey',
  'api_key',
  'authorization',
  'credential',
  'password',
  'secret',
  'token',
  'keyhash',
  'base64',
  'data'
];

function nowIso() {
  return new Date().toISOString();
}

function isSensitiveKey(key) {
  const normalized = String(key || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  return SENSITIVE_BODY_KEY_PATTERNS.some((pattern) => normalized.includes(pattern.replace(/[^a-z0-9]/g, '')));
}

function redactValue(key, value) {
  if (isSensitiveKey(key)) return '[REDACTED]';
  if (typeof value === 'string' && value.length > 500) return `${value.slice(0, 120)}...[TRUNCATED:${value.length}]`;
  if (Array.isArray(value)) return value.map((item) => redactValue('', item));
  if (value && typeof value === 'object') return redactObject(value);
  return value;
}

function redactObject(input) {
  if (!input || typeof input !== 'object') return input;
  const output = {};
  for (const [key, value] of Object.entries(input)) {
    output[key] = redactValue(key, value);
  }
  return output;
}

function appendAuditLog(entry) {
  try {
    const payload = {
      id: entry.id || `audit_${randomUUID().replace(/-/g, '').slice(0, 20)}`,
      createdAt: entry.createdAt || nowIso(),
      actorType: entry.actorType || 'unknown',
      actorId: entry.actorId || null,
      apiKeyId: entry.apiKeyId || null,
      authMode: entry.authMode || null,
      action: entry.action || 'unknown',
      sessionId: entry.sessionId || null,
      method: entry.method || null,
      path: entry.path || null,
      statusCode: entry.statusCode || null,
      ipAddress: entry.ipAddress || null,
      userAgent: entry.userAgent || null,
      requestId: entry.requestId || null,
      metadata: redactObject(entry.metadata || {})
    };
    appendJsonLine(auditLogFile, payload);
    return payload;
  } catch (error) {
    return null;
  }
}

function listAuditLogs({ limit = 100, actorId, sessionId, action, statusCode } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 1000);
  const lines = readJsonLines(auditLogFile, { limit: Math.max(safeLimit * 10, 1000) });
  const entries = [];

  for (let index = lines.length - 1; index >= 0 && entries.length < safeLimit; index -= 1) {
    const entry = lines[index];
    if (!entry) continue;
    if (actorId && entry.actorId !== actorId) continue;
    if (sessionId && entry.sessionId !== sessionId) continue;
    if (action && entry.action !== action) continue;
    if (statusCode && Number(entry.statusCode) !== Number(statusCode)) continue;
    entries.push(entry);
  }

  return entries;
}

function actionFromRequest(req) {
  const method = String(req.method || '').toUpperCase();
  const pathName = req.path || req.originalUrl || '';
  const scope = req.requiredScope;
  if (scope) return scope;
  if (pathName.startsWith('/admin/api-clients')) return `admin:${method.toLowerCase()}:api-clients`;
  return `${method} ${pathName}`;
}

function extractSessionId(req) {
  if (req.params && req.params.sessionId) return req.params.sessionId;
  const match = (req.path || '').match(/^\/sessions\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function auditMiddleware(req, res, next) {
  res.on('finish', () => {
    const isAdmin = req.baseUrl && req.baseUrl.startsWith('/admin');
    const actorId = req.apiClient ? req.apiClient.id : isAdmin ? 'admin' : null;
    const actorType = req.apiClient ? 'api_client' : isAdmin ? 'admin' : 'legacy';

    appendAuditLog({
      actorType,
      actorId,
      apiKeyId: req.apiKey ? req.apiKey.id : null,
      authMode: req.authMode || (isAdmin ? 'admin' : null),
      action: actionFromRequest(req),
      sessionId: extractSessionId(req),
      method: req.method,
      path: req.originalUrl || req.path,
      statusCode: res.statusCode,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
      requestId: req.get('x-request-id') || null,
      metadata: {
        params: req.params || {},
        query: req.query || {},
        body: req.method === 'GET' ? undefined : redactObject(req.body || {})
      }
    });
  });
  next();
}

module.exports = {
  appendAuditLog,
  listAuditLogs,
  auditMiddleware,
  redactObject
};
