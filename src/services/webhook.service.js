const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const env = require('../config/env');
const logger = require('../utils/logger');
const eventBus = require('./eventBus.service');
const { AppError } = require('../utils/errors');

const webhooks = new Map();
let loaded = false;

function nowIso() {
  return new Date().toISOString();
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readJsonLines(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    return fs.readFileSync(filePath, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    logger.error({ err: error, file: filePath }, 'Failed to read JSONL file');
    return [];
  }
}

function appendJsonLine(filePath, entry) {
  try {
    ensureDir(filePath);
    fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`);
  } catch (error) {
    logger.error({ err: error, file: filePath }, 'Failed to append JSONL file');
  }
}

function ensureLoaded() {
  if (loaded) return;
  loaded = true;

  try {
    if (!fs.existsSync(env.webhookStoreFile)) return;
    const raw = fs.readFileSync(env.webhookStoreFile, 'utf8');
    if (!raw.trim()) return;
    const parsed = JSON.parse(raw);
    for (const webhook of parsed) {
      if (webhook.id && webhook.url) webhooks.set(webhook.id, webhook);
    }
    logger.info({ count: webhooks.size }, 'Loaded webhooks from persistent store');
  } catch (error) {
    logger.error({ err: error, file: env.webhookStoreFile }, 'Failed to load webhook store');
  }
}

function persist() {
  try {
    ensureDir(env.webhookStoreFile);
    fs.writeFileSync(env.webhookStoreFile, JSON.stringify(Array.from(webhooks.values()), null, 2));
  } catch (error) {
    logger.error({ err: error, file: env.webhookStoreFile }, 'Failed to persist webhook store');
  }
}

function sanitize(webhook) {
  return {
    id: webhook.id,
    url: webhook.url,
    events: webhook.events,
    active: webhook.active,
    ownerClientId: webhook.ownerClientId || null,
    createdAt: webhook.createdAt,
    updatedAt: webhook.updatedAt,
    hasSecret: Boolean(webhook.secret)
  };
}

function canAccessWebhook(actor, webhook) {
  if (!actor || actor.authMode === 'legacy') return true;
  if (!webhook.ownerClientId) return true;
  return webhook.ownerClientId === actor.clientId;
}

function assertWebhookAccess(actor, webhook) {
  if (!canAccessWebhook(actor, webhook)) {
    throw new AppError('This API client is not allowed to access this webhook', 403, 'WEBHOOK_ACCESS_DENIED');
  }
}

function createWebhook({ url, events, secret, active = true }, actor = {}) {
  ensureLoaded();
  const webhook = {
    id: uuidv4(),
    url,
    events,
    secret: secret || '',
    active,
    ownerClientId: actor.authMode === 'api-client' ? actor.clientId : null,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  webhooks.set(webhook.id, webhook);
  persist();
  return sanitize(webhook);
}

function listWebhooks(actor = {}) {
  ensureLoaded();
  return Array.from(webhooks.values())
    .filter((webhook) => canAccessWebhook(actor, webhook))
    .map(sanitize);
}

function getWebhook(id, actor = {}) {
  ensureLoaded();
  const webhook = webhooks.get(id);
  if (!webhook) throw new AppError('Webhook not found', 404, 'WEBHOOK_NOT_FOUND');
  assertWebhookAccess(actor, webhook);
  return sanitize(webhook);
}

function updateWebhook(id, input, actor = {}) {
  ensureLoaded();
  const webhook = webhooks.get(id);
  if (!webhook) throw new AppError('Webhook not found', 404, 'WEBHOOK_NOT_FOUND');
  assertWebhookAccess(actor, webhook);

  if (input.url !== undefined) webhook.url = input.url;
  if (input.events !== undefined) webhook.events = input.events;
  if (input.secret !== undefined) webhook.secret = input.secret || '';
  if (input.active !== undefined) webhook.active = input.active;
  webhook.updatedAt = nowIso();

  persist();
  return sanitize(webhook);
}

function deleteWebhook(id, actor = {}) {
  ensureLoaded();
  const webhook = webhooks.get(id);
  if (!webhook) return false;
  assertWebhookAccess(actor, webhook);
  const deleted = webhooks.delete(id);
  if (deleted) persist();
  return deleted;
}

function signPayload(secret, payload) {
  return `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
}

function deliveryToPublic(delivery) {
  return {
    id: delivery.id,
    webhookId: delivery.webhookId,
    ownerClientId: delivery.ownerClientId || null,
    event: delivery.event,
    sessionId: delivery.sessionId,
    status: delivery.status,
    attempts: delivery.attempts,
    statusCode: delivery.statusCode || null,
    error: delivery.error || null,
    createdAt: delivery.createdAt,
    deliveredAt: delivery.deliveredAt || null,
    failedAt: delivery.failedAt || null
  };
}

function appendDelivery(delivery) {
  appendJsonLine(env.webhookDeliveryLogFile, delivery);
}

function listDeliveries(webhookId, actor = {}) {
  ensureLoaded();
  const webhook = webhooks.get(webhookId);
  if (!webhook) throw new AppError('Webhook not found', 404, 'WEBHOOK_NOT_FOUND');
  assertWebhookAccess(actor, webhook);

  return readJsonLines(env.webhookDeliveryLogFile)
    .filter((delivery) => delivery.webhookId === webhookId)
    .map(deliveryToPublic)
    .slice(-100)
    .reverse();
}

async function deliver(webhook, payload, existingDelivery = null) {
  const delivery = existingDelivery || {
    id: uuidv4(),
    webhookId: webhook.id,
    ownerClientId: webhook.ownerClientId || null,
    event: payload.event,
    sessionId: payload.sessionId,
    payload,
    status: 'pending',
    attempts: 0,
    createdAt: nowIso()
  };

  const body = JSON.stringify(payload);
  const headers = {
    'content-type': 'application/json',
    'x-webhook-event-id': delivery.id
  };
  if (webhook.secret) headers['x-webhook-signature'] = signPayload(webhook.secret, body);

  let lastError = null;
  for (let attempt = 1; attempt <= env.webhookRetryCount; attempt += 1) {
    delivery.attempts += 1;
    try {
      const response = await axios.post(webhook.url, payload, {
        timeout: env.webhookTimeoutMs,
        headers
      });
      delivery.status = 'delivered';
      delivery.statusCode = response.status;
      delivery.error = null;
      delivery.deliveredAt = nowIso();
      appendDelivery(delivery);
      return delivery;
    } catch (error) {
      lastError = error;
      logger.warn({ webhookId: webhook.id, event: payload.event, attempt, err: error.message }, 'Webhook delivery failed');
      if (attempt < env.webhookRetryCount) await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }

  delivery.status = 'failed';
  delivery.error = lastError?.message || 'Unknown webhook delivery error';
  delivery.failedAt = nowIso();
  appendDelivery(delivery);
  logger.error({ webhookId: webhook.id, event: payload.event, err: delivery.error }, 'Webhook delivery exhausted');
  return delivery;
}

function dispatch(event, sessionId, data) {
  ensureLoaded();
  const payload = {
    event,
    sessionId,
    data,
    timestamp: nowIso()
  };

  eventBus.publish(event, sessionId, data);

  for (const webhook of webhooks.values()) {
    if (!webhook.active) continue;
    if (!webhook.events.includes(event) && !webhook.events.includes('*')) continue;
    deliver(webhook, payload);
  }
}

function retryDelivery(deliveryId, actor = {}) {
  ensureLoaded();
  const delivery = readJsonLines(env.webhookDeliveryLogFile).find((item) => item.id === deliveryId);
  if (!delivery) throw new AppError('Webhook delivery not found', 404, 'WEBHOOK_DELIVERY_NOT_FOUND');
  const webhook = webhooks.get(delivery.webhookId);
  if (!webhook) throw new AppError('Webhook not found', 404, 'WEBHOOK_NOT_FOUND');
  assertWebhookAccess(actor, webhook);

  const retryPayload = delivery.payload;
  if (!retryPayload) throw new AppError('Webhook delivery payload is not available', 409, 'WEBHOOK_PAYLOAD_NOT_AVAILABLE');

  return deliver(webhook, retryPayload, {
    id: uuidv4(),
    webhookId: webhook.id,
    ownerClientId: webhook.ownerClientId || null,
    event: retryPayload.event,
    sessionId: retryPayload.sessionId,
    payload: retryPayload,
    status: 'retrying',
    attempts: 0,
    createdAt: nowIso(),
    retriedFrom: delivery.id
  });
}

ensureLoaded();

module.exports = {
  createWebhook,
  listWebhooks,
  getWebhook,
  updateWebhook,
  deleteWebhook,
  listDeliveries,
  retryDelivery,
  dispatch
};
