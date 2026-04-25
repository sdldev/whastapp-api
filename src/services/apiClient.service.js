const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { randomUUID } = require('crypto');
const env = require('../config/env');
const { AppError } = require('../utils/errors');
const persistence = require('./persistence.service');
const { appendJsonLine } = require('../utils/jsonlFile');

const storeFile = env.apiClientStoreFile;
const usageLogFile = env.apiUsageLogFile;
const rateLimitBuckets = new Map();
const SCOPE_BY_ROUTE = [
  { method: 'GET', pattern: /^\/sessions\/?$/, scope: 'sessions:read' },
  { method: 'POST', pattern: /^\/sessions\/restore\/?$/, scope: 'sessions:start' },
  { method: 'POST', pattern: /^\/sessions\/terminate-all\/?$/, scope: 'sessions:destroy' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/start\/?$/, scope: 'sessions:start' },
  { method: 'GET', pattern: /^\/sessions\/[^/]+\/status\/?$/, scope: 'sessions:read' },
  { method: 'GET', pattern: /^\/sessions\/[^/]+\/health\/?$/, scope: 'sessions:read' },
  { method: 'GET', pattern: /^\/sessions\/[^/]+\/screenshot\/?$/, scope: 'sessions:screenshot' },
  { method: 'GET', pattern: /^\/sessions\/[^/]+\/qr\/?$/, scope: 'sessions:read' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/logout\/?$/, scope: 'sessions:logout' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/(restart|recover)\/?$/, scope: 'sessions:restart' },
  { method: 'DELETE', pattern: /^\/sessions\/[^/]+\/?$/, scope: 'sessions:destroy' },
  { method: 'GET', pattern: /^\/metrics\/?$/, scope: 'metrics:read' },
  { method: 'GET', pattern: /^\/sessions\/[^/]+\/queue\/?$/, scope: 'queue:read' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/queue\/(pause|resume)\/?$/, scope: 'queue:manage' },
  { method: 'GET', pattern: /^\/sessions\/[^/]+\/messages\/logs\/?$/, scope: 'messages:read' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/messages\/text\/?$/, scope: 'messages:send' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/messages\/reply\/?$/, scope: 'messages:reply' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/messages\/react\/?$/, scope: 'messages:react' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/messages\/[^/]+\/forward\/?$/, scope: 'messages:forward' },
  { method: 'PATCH', pattern: /^\/sessions\/[^/]+\/messages\/[^/]+\/?$/, scope: 'messages:edit' },
  { method: 'DELETE', pattern: /^\/sessions\/[^/]+\/messages\/[^/]+\/?$/, scope: 'messages:delete' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/messages\/[^/]+\/star\/?$/, scope: 'messages:star' },
  { method: 'DELETE', pattern: /^\/sessions\/[^/]+\/messages\/[^/]+\/star\/?$/, scope: 'messages:star' },
  { method: 'GET', pattern: /^\/sessions\/[^/]+\/messages\/[^/]+\/quoted\/?$/, scope: 'messages:read' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/messages\/chats\/[^/]+\/messages\/(fetch|search)\/?$/, scope: 'messages:read' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/messages\/chats\/[^/]+\/(seen|mark-unread)\/?$/, scope: 'chats:update' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/messages\/chats\/[^/]+\/presence\/(typing|recording|clear)\/?$/, scope: 'presence:update' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/messages\/presence\/(available|unavailable)\/?$/, scope: 'presence:update' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/messages\/(buttons|lists)\/?$/, scope: 'messages:send' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/media\/(base64|url|upload)\/?$/, scope: 'media:send' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/media\/sticker\/(base64|url)\/?$/, scope: 'media:send_sticker' },
  { method: 'GET', pattern: /^\/sessions\/[^/]+\/media\/[^/]+\/download(\.bin)?\/?$/, scope: 'media:download' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/mentions\/users\/?$/, scope: 'mentions:users' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/mentions\/groups\/?$/, scope: 'mentions:groups' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/contacts\/card\/?$/, scope: 'contacts:send_card' },
  { method: 'GET', pattern: /^\/sessions\/[^/]+\/contacts\/?$/, scope: 'contacts:read' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/contacts\/(check-registered|number-id|formatted-number|country-code)\/?$/, scope: 'contacts:read' },
  { method: 'PATCH', pattern: /^\/sessions\/[^/]+\/contacts\/profile\/(display-name|status)\/?$/, scope: 'profile:update' },
  { method: 'PUT', pattern: /^\/sessions\/[^/]+\/contacts\/profile\/picture\/?$/, scope: 'profile:update' },
  { method: 'DELETE', pattern: /^\/sessions\/[^/]+\/contacts\/profile\/picture\/?$/, scope: 'profile:update' },
  { method: 'GET', pattern: /^\/sessions\/[^/]+\/contacts\/[^/]+\/(about|common-groups)\/?$/, scope: 'contacts:read' },
  { method: 'GET', pattern: /^\/sessions\/[^/]+\/contacts\/[^/]+\/?$/, scope: 'contacts:read' },
  { method: 'GET', pattern: /^\/sessions\/[^/]+\/contacts\/[^/]+\/profile-picture\/?$/, scope: 'contacts:read' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/contacts\/[^/]+\/block\/?$/, scope: 'contacts:block' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/contacts\/[^/]+\/unblock\/?$/, scope: 'contacts:unblock' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/location\/?$/, scope: 'location:send' },
  { method: 'GET', pattern: /^\/sessions\/[^/]+\/chats\/?$/, scope: 'chats:read' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/chats\/search\/?$/, scope: 'chats:read' },
  { method: 'GET', pattern: /^\/sessions\/[^/]+\/chats\/[^/]+\/?$/, scope: 'chats:read' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/chats\/[^/]+\/mute\/?$/, scope: 'chats:mute' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/chats\/[^/]+\/unmute\/?$/, scope: 'chats:unmute' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/chats\/[^/]+\/(archive|unarchive|pin|unpin|clear)\/?$/, scope: 'chats:update' },
  { method: 'DELETE', pattern: /^\/sessions\/[^/]+\/chats\/[^/]+\/?$/, scope: 'chats:delete' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/groups\/?$/, scope: 'groups:create' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/groups\/join\/?$/, scope: 'groups:join' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/groups\/invite-info\/?$/, scope: 'groups:read' },
  { method: 'GET', pattern: /^\/sessions\/[^/]+\/groups\/[^/]+\/?$/, scope: 'groups:read' },
  { method: 'GET', pattern: /^\/sessions\/[^/]+\/groups\/[^/]+\/invite\/?$/, scope: 'groups:read' },
  { method: 'DELETE', pattern: /^\/sessions\/[^/]+\/groups\/[^/]+\/invite\/?$/, scope: 'groups:update' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/groups\/[^/]+\/leave\/?$/, scope: 'groups:leave' },
  { method: 'PUT', pattern: /^\/sessions\/[^/]+\/groups\/[^/]+\/picture\/?$/, scope: 'groups:update' },
  { method: 'DELETE', pattern: /^\/sessions\/[^/]+\/groups\/[^/]+\/picture\/?$/, scope: 'groups:update' },
  { method: 'PATCH', pattern: /^\/sessions\/[^/]+\/groups\/[^/]+\/(info|settings)\/?$/, scope: 'groups:update' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/groups\/[^/]+\/participants\/?$/, scope: 'groups:participants:add' },
  { method: 'DELETE', pattern: /^\/sessions\/[^/]+\/groups\/[^/]+\/participants\/[^/]+\/?$/, scope: 'groups:participants:remove' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/groups\/[^/]+\/participants\/[^/]+\/promote\/?$/, scope: 'groups:participants:promote' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/groups\/[^/]+\/participants\/[^/]+\/demote\/?$/, scope: 'groups:participants:demote' },
  { method: 'GET', pattern: /^\/sessions\/[^/]+\/groups\/[^/]+\/membership-requests\/?$/, scope: 'groups:membership:read' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/groups\/[^/]+\/membership-requests\/(approve|reject)\/?$/, scope: 'groups:membership:update' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/groups\/[^/]+\/mention-everyone\/?$/, scope: 'groups:mention_everyone' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/polls\/?$/, scope: 'polls:create' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/polls\/[^/]+\/vote\/?$/, scope: 'polls:vote' },
  { method: 'GET', pattern: /^\/sessions\/[^/]+\/channels\/?$/, scope: 'channels:read' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/channels\/search\/?$/, scope: 'channels:read' },
  { method: 'GET', pattern: /^\/sessions\/[^/]+\/channels\/[^/]+\/?$/, scope: 'channels:read' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/channels\/[^/]+\/messages\/?$/, scope: 'channels:send' },
  { method: 'GET', pattern: /^\/sessions\/[^/]+\/channels\/[^/]+\/messages\/?$/, scope: 'channels:read' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/channels\/[^/]+\/seen\/?$/, scope: 'channels:read' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/channels\/[^/]+\/(mute|unmute)\/?$/, scope: 'channels:update' },
  { method: 'PATCH', pattern: /^\/sessions\/[^/]+\/channels\/[^/]+\/(info|reaction-setting)\/?$/, scope: 'channels:update' },
  { method: 'PUT', pattern: /^\/sessions\/[^/]+\/channels\/[^/]+\/picture\/?$/, scope: 'channels:update' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/channels\/[^/]+\/admin-invites\/accept\/?$/, scope: 'channels:admin' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/channels\/[^/]+\/admin-invites\/[^/]+\/?$/, scope: 'channels:admin' },
  { method: 'DELETE', pattern: /^\/sessions\/[^/]+\/channels\/[^/]+\/admin-invites\/[^/]+\/?$/, scope: 'channels:admin' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/channels\/[^/]+\/ownership\/transfer\/[^/]+\/?$/, scope: 'channels:admin' },
  { method: 'POST', pattern: /^\/sessions\/[^/]+\/channels\/[^/]+\/admins\/[^/]+\/demote\/?$/, scope: 'channels:admin' },
  { method: 'GET', pattern: /^\/sessions\/[^/]+\/channels\/[^/]+\/subscribers\/?$/, scope: 'channels:read' },
  { method: 'DELETE', pattern: /^\/sessions\/[^/]+\/channels\/[^/]+\/?$/, scope: 'channels:delete' },
  { method: 'GET', pattern: /^\/sessions\/[^/]+\/events\/?$/, scope: 'events:read' },
  { method: 'GET', pattern: /^\/webhooks\/?$/, scope: 'webhooks:read' },
  { method: 'POST', pattern: /^\/webhooks\/?$/, scope: 'webhooks:create' },
  { method: 'GET', pattern: /^\/webhooks\/[^/]+\/?$/, scope: 'webhooks:read' },
  { method: 'PATCH', pattern: /^\/webhooks\/[^/]+\/?$/, scope: 'webhooks:update' },
  { method: 'DELETE', pattern: /^\/webhooks\/[^/]+\/?$/, scope: 'webhooks:delete' },
  { method: 'GET', pattern: /^\/webhooks\/[^/]+\/deliveries\/?$/, scope: 'webhooks:read' },
  { method: 'POST', pattern: /^\/webhooks\/deliveries\/[^/]+\/retry\/?$/, scope: 'webhooks:retry' }
];

function ensureStoreDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readStore() {
  try {
    if (!fs.existsSync(storeFile)) return { clients: [], keys: [] };
    const parsed = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
    return {
      clients: Array.isArray(parsed.clients) ? parsed.clients : [],
      keys: Array.isArray(parsed.keys) ? parsed.keys : []
    };
  } catch (error) {
    return { clients: [], keys: [] };
  }
}

function writeStore(store) {
  ensureStoreDir(storeFile);
  fs.writeFileSync(storeFile, JSON.stringify(store, null, 2));
}

function nowIso() {
  return new Date().toISOString();
}

function hashApiKey(apiKey) {
  return crypto.createHmac('sha256', env.apiKeyPepper).update(apiKey).digest('hex');
}

function generateId(prefix) {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

function generateApiKey(clientId) {
  const secret = crypto.randomBytes(32).toString('hex');
  return `wa_sk_live_${clientId}_${secret}`;
}

function sanitizeKey(key) {
  if (!key) return null;
  return {
    id: key.id,
    clientId: key.clientId,
    keyPrefix: key.keyPrefix,
    status: key.status,
    createdAt: key.createdAt,
    expiresAt: key.expiresAt || null,
    revokedAt: key.revokedAt || null,
    lastUsedAt: key.lastUsedAt || null
  };
}

function sanitizeClient(client, keys = []) {
  return {
    id: client.id,
    name: client.name,
    description: client.description || '',
    status: client.status,
    allowedSessions: client.allowedSessions || [],
    scopes: client.scopes || [],
    rateLimitPerMinute: client.rateLimitPerMinute,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
    expiresAt: client.expiresAt || null,
    revokedAt: client.revokedAt || null,
    lastUsedAt: client.lastUsedAt || null,
    keys: keys.map(sanitizeKey)
  };
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
}

function dbClientFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    status: row.status,
    allowedSessions: row.allowed_sessions || [],
    scopes: row.scopes || [],
    rateLimitPerMinute: row.rate_limit_per_minute,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    expiresAt: row.expires_at ? (row.expires_at instanceof Date ? row.expires_at.toISOString() : row.expires_at) : null,
    revokedAt: row.revoked_at ? (row.revoked_at instanceof Date ? row.revoked_at.toISOString() : row.revoked_at) : null,
    lastUsedAt: row.last_used_at ? (row.last_used_at instanceof Date ? row.last_used_at.toISOString() : row.last_used_at) : null
  };
}

function dbKeyFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    clientId: row.client_id,
    keyPrefix: row.key_prefix,
    keyHash: row.key_hash,
    status: row.status,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    expiresAt: row.expires_at ? (row.expires_at instanceof Date ? row.expires_at.toISOString() : row.expires_at) : null,
    revokedAt: row.revoked_at ? (row.revoked_at instanceof Date ? row.revoked_at.toISOString() : row.revoked_at) : null,
    lastUsedAt: row.last_used_at ? (row.last_used_at instanceof Date ? row.last_used_at.toISOString() : row.last_used_at) : null
  };
}

async function dbGetKeysForClient(clientId) {
  const result = await persistence.query('SELECT * FROM api_keys WHERE client_id = $1 ORDER BY created_at DESC', [clientId]);
  return result.rows.map(dbKeyFromRow);
}

async function createApiClient(input) {
  if (persistence.isPostgresEnabled()) {
    const timestamp = nowIso();
    const clientId = generateId('cli');
    const apiKey = generateApiKey(clientId);
    const keyId = generateId('key');
    const keyPrefix = apiKey.slice(0, 24);
    const client = {
      id: clientId,
      name: input.name,
      description: input.description || '',
      status: input.status || 'active',
      allowedSessions: normalizeStringArray(input.allowedSessions),
      scopes: normalizeStringArray(input.scopes),
      rateLimitPerMinute: Number(input.rateLimitPerMinute || env.defaultApiClientRateLimitPerMinute),
      createdAt: timestamp,
      updatedAt: timestamp,
      expiresAt: input.expiresAt || null,
      revokedAt: null,
      lastUsedAt: null
    };
    const key = {
      id: keyId,
      clientId,
      keyPrefix,
      keyHash: hashApiKey(apiKey),
      status: 'active',
      createdAt: timestamp,
      expiresAt: input.expiresAt || null,
      revokedAt: null,
      lastUsedAt: null
    };

    await persistence.query(
      `INSERT INTO api_clients (id, name, description, status, allowed_sessions, scopes, rate_limit_per_minute, created_at, updated_at, expires_at, revoked_at, last_used_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [client.id, client.name, client.description, client.status, JSON.stringify(client.allowedSessions), JSON.stringify(client.scopes), client.rateLimitPerMinute, client.createdAt, client.updatedAt, client.expiresAt, client.revokedAt, client.lastUsedAt]
    );
    await persistence.query(
      `INSERT INTO api_keys (id, client_id, key_prefix, key_hash, status, created_at, expires_at, revoked_at, last_used_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [key.id, key.clientId, key.keyPrefix, key.keyHash, key.status, key.createdAt, key.expiresAt, key.revokedAt, key.lastUsedAt]
    );

    return { ...sanitizeClient(client, [key]), apiKey };
  }

  const store = readStore();
  const timestamp = nowIso();
  const clientId = generateId('cli');
  const apiKey = generateApiKey(clientId);
  const keyId = generateId('key');
  const keyPrefix = apiKey.slice(0, 24);

  const client = {
    id: clientId,
    name: input.name,
    description: input.description || '',
    status: input.status || 'active',
    allowedSessions: normalizeStringArray(input.allowedSessions),
    scopes: normalizeStringArray(input.scopes),
    rateLimitPerMinute: Number(input.rateLimitPerMinute || env.defaultApiClientRateLimitPerMinute),
    createdAt: timestamp,
    updatedAt: timestamp,
    expiresAt: input.expiresAt || null,
    revokedAt: null,
    lastUsedAt: null
  };

  const key = {
    id: keyId,
    clientId,
    keyPrefix,
    keyHash: hashApiKey(apiKey),
    status: 'active',
    createdAt: timestamp,
    expiresAt: input.expiresAt || null,
    revokedAt: null,
    lastUsedAt: null
  };

  store.clients.push(client);
  store.keys.push(key);
  writeStore(store);

  return {
    ...sanitizeClient(client, [key]),
    apiKey
  };
}

async function listApiClients() {
  if (persistence.isPostgresEnabled()) {
    const result = await persistence.query('SELECT * FROM api_clients ORDER BY created_at DESC');
    const clients = [];
    for (const row of result.rows) {
      const client = dbClientFromRow(row);
      clients.push(sanitizeClient(client, await dbGetKeysForClient(client.id)));
    }
    return clients;
  }

  const store = readStore();
  return store.clients.map((client) => sanitizeClient(
    client,
    store.keys.filter((key) => key.clientId === client.id)
  ));
}

async function getApiClient(clientId) {
  if (persistence.isPostgresEnabled()) {
    const result = await persistence.query('SELECT * FROM api_clients WHERE id = $1', [clientId]);
    const client = dbClientFromRow(result.rows[0]);
    if (!client) throw new AppError('API client not found', 404, 'API_CLIENT_NOT_FOUND');
    return sanitizeClient(client, await dbGetKeysForClient(client.id));
  }

  const store = readStore();
  const client = store.clients.find((item) => item.id === clientId);
  if (!client) throw new AppError('API client not found', 404, 'API_CLIENT_NOT_FOUND');
  return sanitizeClient(client, store.keys.filter((key) => key.clientId === client.id));
}

async function updateApiClient(clientId, input) {
  if (persistence.isPostgresEnabled()) {
    const existing = await persistence.query('SELECT * FROM api_clients WHERE id = $1', [clientId]);
    const client = dbClientFromRow(existing.rows[0]);
    if (!client) throw new AppError('API client not found', 404, 'API_CLIENT_NOT_FOUND');

    const updated = {
      name: input.name !== undefined ? input.name : client.name,
      description: input.description !== undefined ? input.description : client.description,
      status: input.status !== undefined ? input.status : client.status,
      allowedSessions: input.allowedSessions !== undefined ? normalizeStringArray(input.allowedSessions) : client.allowedSessions,
      scopes: input.scopes !== undefined ? normalizeStringArray(input.scopes) : client.scopes,
      rateLimitPerMinute: input.rateLimitPerMinute !== undefined ? Number(input.rateLimitPerMinute) : client.rateLimitPerMinute,
      expiresAt: input.expiresAt !== undefined ? input.expiresAt : client.expiresAt,
      updatedAt: nowIso()
    };

    const result = await persistence.query(
      `UPDATE api_clients
       SET name=$2, description=$3, status=$4, allowed_sessions=$5, scopes=$6, rate_limit_per_minute=$7, expires_at=$8, updated_at=$9
       WHERE id=$1 RETURNING *`,
      [clientId, updated.name, updated.description, updated.status, JSON.stringify(updated.allowedSessions), JSON.stringify(updated.scopes), updated.rateLimitPerMinute, updated.expiresAt, updated.updatedAt]
    );
    const dbClient = dbClientFromRow(result.rows[0]);
    return sanitizeClient(dbClient, await dbGetKeysForClient(clientId));
  }

  const store = readStore();
  const client = store.clients.find((item) => item.id === clientId);
  if (!client) throw new AppError('API client not found', 404, 'API_CLIENT_NOT_FOUND');

  if (input.name !== undefined) client.name = input.name;
  if (input.description !== undefined) client.description = input.description;
  if (input.status !== undefined) client.status = input.status;
  if (input.allowedSessions !== undefined) client.allowedSessions = normalizeStringArray(input.allowedSessions);
  if (input.scopes !== undefined) client.scopes = normalizeStringArray(input.scopes);
  if (input.rateLimitPerMinute !== undefined) client.rateLimitPerMinute = Number(input.rateLimitPerMinute);
  if (input.expiresAt !== undefined) client.expiresAt = input.expiresAt;
  client.updatedAt = nowIso();

  writeStore(store);
  return sanitizeClient(client, store.keys.filter((key) => key.clientId === client.id));
}

async function revokeApiClient(clientId) {
  if (persistence.isPostgresEnabled()) {
    const timestamp = nowIso();
    const existing = await persistence.query('SELECT * FROM api_clients WHERE id = $1', [clientId]);
    const client = dbClientFromRow(existing.rows[0]);
    if (!client) throw new AppError('API client not found', 404, 'API_CLIENT_NOT_FOUND');

    const result = await persistence.query(
      `UPDATE api_clients SET status='revoked', revoked_at=$2, updated_at=$2 WHERE id=$1 RETURNING *`,
      [clientId, timestamp]
    );
    await persistence.query(
      `UPDATE api_keys SET status='revoked', revoked_at=$2 WHERE client_id=$1 AND status='active'`,
      [clientId, timestamp]
    );
    const updated = dbClientFromRow(result.rows[0]);
    return sanitizeClient(updated, await dbGetKeysForClient(clientId));
  }

  const store = readStore();
  const timestamp = nowIso();
  const client = store.clients.find((item) => item.id === clientId);
  if (!client) throw new AppError('API client not found', 404, 'API_CLIENT_NOT_FOUND');

  client.status = 'revoked';
  client.revokedAt = timestamp;
  client.updatedAt = timestamp;
  for (const key of store.keys.filter((item) => item.clientId === clientId)) {
    key.status = 'revoked';
    key.revokedAt = timestamp;
  }

  writeStore(store);
  return sanitizeClient(client, store.keys.filter((key) => key.clientId === client.id));
}

async function rotateApiKey(clientId) {
  if (persistence.isPostgresEnabled()) {
    const timestamp = nowIso();
    const existing = await persistence.query('SELECT * FROM api_clients WHERE id = $1', [clientId]);
    const client = dbClientFromRow(existing.rows[0]);
    if (!client) throw new AppError('API client not found', 404, 'API_CLIENT_NOT_FOUND');

    await persistence.query(
      `UPDATE api_keys SET status='revoked', revoked_at=$2 WHERE client_id=$1 AND status='active'`,
      [clientId, timestamp]
    );

    const apiKey = generateApiKey(clientId);
    const key = {
      id: generateId('key'),
      clientId,
      keyPrefix: apiKey.slice(0, 24),
      keyHash: hashApiKey(apiKey),
      status: 'active',
      createdAt: timestamp,
      expiresAt: client.expiresAt || null,
      revokedAt: null,
      lastUsedAt: null
    };

    await persistence.query(
      `INSERT INTO api_keys (id, client_id, key_prefix, key_hash, status, created_at, expires_at, revoked_at, last_used_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [key.id, key.clientId, key.keyPrefix, key.keyHash, key.status, key.createdAt, key.expiresAt, key.revokedAt, key.lastUsedAt]
    );
    await persistence.query('UPDATE api_clients SET updated_at=$2 WHERE id=$1', [clientId, timestamp]);

    return {
      ...sanitizeClient(client, await dbGetKeysForClient(clientId)),
      apiKey
    };
  }

  const store = readStore();
  const timestamp = nowIso();
  const client = store.clients.find((item) => item.id === clientId);
  if (!client) throw new AppError('API client not found', 404, 'API_CLIENT_NOT_FOUND');

  for (const key of store.keys.filter((item) => item.clientId === clientId && item.status === 'active')) {
    key.status = 'revoked';
    key.revokedAt = timestamp;
  }

  const apiKey = generateApiKey(clientId);
  const key = {
    id: generateId('key'),
    clientId,
    keyPrefix: apiKey.slice(0, 24),
    keyHash: hashApiKey(apiKey),
    status: 'active',
    createdAt: timestamp,
    expiresAt: client.expiresAt || null,
    revokedAt: null,
    lastUsedAt: null
  };

  store.keys.push(key);
  client.updatedAt = timestamp;
  writeStore(store);

  return {
    ...sanitizeClient(client, store.keys.filter((item) => item.clientId === client.id)),
    apiKey
  };
}

function isExpired(expiresAt) {
  return expiresAt && new Date(expiresAt).getTime() <= Date.now();
}

async function authenticateApiKey(rawApiKey) {
  if (!rawApiKey) throw new AppError('Invalid or missing API key', 401, 'INVALID_API_KEY');

  const keyHash = hashApiKey(rawApiKey);

  if (persistence.isPostgresEnabled()) {
    const keyResult = await persistence.query('SELECT * FROM api_keys WHERE key_hash = $1', [keyHash]);
    const key = dbKeyFromRow(keyResult.rows[0]);
    if (!key) throw new AppError('Invalid or missing API key', 401, 'INVALID_API_KEY');
    if (key.status !== 'active' || key.revokedAt) throw new AppError('API key has been revoked', 401, 'API_KEY_REVOKED');
    if (isExpired(key.expiresAt)) throw new AppError('API key has expired', 401, 'API_KEY_EXPIRED');

    const clientResult = await persistence.query('SELECT * FROM api_clients WHERE id = $1', [key.clientId]);
    const client = dbClientFromRow(clientResult.rows[0]);
    if (!client) throw new AppError('API client not found', 401, 'API_CLIENT_NOT_FOUND');
    if (client.status !== 'active' || client.revokedAt) throw new AppError('API client is inactive', 403, 'API_CLIENT_INACTIVE');
    if (isExpired(client.expiresAt)) throw new AppError('API client has expired', 403, 'API_CLIENT_EXPIRED');

    const timestamp = nowIso();
    await persistence.query('UPDATE api_keys SET last_used_at=$2 WHERE id=$1', [key.id, timestamp]);
    await persistence.query('UPDATE api_clients SET last_used_at=$2 WHERE id=$1', [client.id, timestamp]);
    key.lastUsedAt = timestamp;
    client.lastUsedAt = timestamp;

    return { client: sanitizeClient(client, await dbGetKeysForClient(client.id)), key: sanitizeKey(key) };
  }

  const store = readStore();
  const key = store.keys.find((item) => item.keyHash === keyHash);
  if (!key) throw new AppError('Invalid or missing API key', 401, 'INVALID_API_KEY');
  if (key.status !== 'active' || key.revokedAt) throw new AppError('API key has been revoked', 401, 'API_KEY_REVOKED');
  if (isExpired(key.expiresAt)) throw new AppError('API key has expired', 401, 'API_KEY_EXPIRED');

  const client = store.clients.find((item) => item.id === key.clientId);
  if (!client) throw new AppError('API client not found', 401, 'API_CLIENT_NOT_FOUND');
  if (client.status !== 'active' || client.revokedAt) throw new AppError('API client is inactive', 403, 'API_CLIENT_INACTIVE');
  if (isExpired(client.expiresAt)) throw new AppError('API client has expired', 403, 'API_CLIENT_EXPIRED');

  const timestamp = nowIso();
  key.lastUsedAt = timestamp;
  client.lastUsedAt = timestamp;
  writeStore(store);

  return { client: sanitizeClient(client, store.keys.filter((item) => item.clientId === client.id)), key: sanitizeKey(key) };
}

function getRequiredScope(method, pathName) {
  const normalizedMethod = String(method).toUpperCase();
  const match = SCOPE_BY_ROUTE.find((item) => item.method === normalizedMethod && item.pattern.test(pathName));
  return match ? match.scope : null;
}

function authorizeScope(client, requiredScope) {
  if (!requiredScope) return;
  const scopes = client.scopes || [];
  if (scopes.includes('*') || scopes.includes(requiredScope)) return;
  throw new AppError('This API key does not have permission to access this endpoint', 403, 'INSUFFICIENT_SCOPE', { requiredScope });
}

function authorizeSession(client, sessionId) {
  if (!sessionId) return;
  const allowedSessions = client.allowedSessions || [];
  if (allowedSessions.includes('*') || allowedSessions.includes(sessionId)) return;
  throw new AppError('This API key is not allowed to access this WhatsApp session', 403, 'SESSION_ACCESS_DENIED', { sessionId });
}

function checkRateLimit(client) {
  const limit = Number(client.rateLimitPerMinute || env.defaultApiClientRateLimitPerMinute);
  if (!Number.isFinite(limit) || limit <= 0) return { limit: 0, remaining: null, resetAt: null };

  const now = Date.now();
  const windowMs = 60 * 1000;
  const bucketKey = client.id;
  let bucket = rateLimitBuckets.get(bucketKey);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
  }

  bucket.count += 1;
  rateLimitBuckets.set(bucketKey, bucket);

  const remaining = Math.max(limit - bucket.count, 0);
  if (bucket.count > limit) {
    throw new AppError('Too many requests', 429, 'RATE_LIMIT_EXCEEDED', {
      limit,
      resetAt: new Date(bucket.resetAt).toISOString()
    });
  }

  return {
    limit,
    remaining,
    resetAt: new Date(bucket.resetAt).toISOString()
  };
}

async function appendUsageLog(entry) {
  try {
    const payload = { ...entry, createdAt: nowIso() };
    if (persistence.isPostgresEnabled()) {
      await persistence.query(
        `INSERT INTO api_usage_logs (client_id, api_key_id, session_id, method, path, status_code, ip_address, user_agent, scope_used, request_id, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [payload.clientId, payload.apiKeyId, payload.sessionId, payload.method, payload.path, payload.statusCode, payload.ipAddress, payload.userAgent, payload.scopeUsed, payload.requestId, payload.createdAt]
      );
      return;
    }
    ensureStoreDir(usageLogFile);
    appendJsonLine(usageLogFile, payload);
  } catch (error) {
    // Audit logging must not break API request flow.
  }
}

function usageLogFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    clientId: row.client_id || null,
    apiKeyId: row.api_key_id || null,
    sessionId: row.session_id || null,
    method: row.method || null,
    path: row.path || null,
    statusCode: row.status_code || null,
    ipAddress: row.ip_address || null,
    userAgent: row.user_agent || null,
    scopeUsed: row.scope_used || null,
    requestId: row.request_id || null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at
  };
}

async function listUsageLogs(filters = {}) {
  if (!persistence.isPostgresEnabled()) return { driver: env.persistenceDriver, items: [] };

  const where = [];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replace('?', `$${params.length}`));
  };

  if (filters.clientId) add('client_id = ?', filters.clientId);
  if (filters.sessionId) add('session_id = ?', filters.sessionId);
  if (filters.statusCode) add('status_code = ?', Number(filters.statusCode));
  if (filters.scopeUsed) add('scope_used = ?', filters.scopeUsed);
  if (filters.fromDate) add('created_at >= ?', filters.fromDate);
  if (filters.toDate) add('created_at <= ?', filters.toDate);

  const limit = Math.min(Math.max(Number(filters.limit || 100), 1), 1000);
  params.push(limit);
  const sql = `SELECT * FROM api_usage_logs ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT $${params.length}`;
  const result = await persistence.query(sql, params);
  return { driver: env.persistenceDriver, items: result.rows.map(usageLogFromRow) };
}

module.exports = {
  createApiClient,
  listApiClients,
  getApiClient,
  updateApiClient,
  revokeApiClient,
  rotateApiKey,
  authenticateApiKey,
  getRequiredScope,
  authorizeScope,
  authorizeSession,
  checkRateLimit,
  appendUsageLog,
  listUsageLogs
};
