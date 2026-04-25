const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const env = require('../config/env');
const logger = require('../utils/logger');
const eventBus = require('./eventBus.service');
const { AppError } = require('../utils/errors');
const { assertSafeOutboundUrl } = require('../utils/outboundUrl');
const { appendJsonLine, readJsonLines } = require('../utils/jsonlFile');
const persistence = require('./persistence.service');

const webhooks = new Map();
const deliveryQueue = [];
let activeDeliveries = 0;
let loaded = false;

function nowIso() {
  return new Date().toISOString();
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function ensureLoaded() {
  if (persistence.isPostgresEnabled()) return;
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
  if (persistence.isPostgresEnabled()) return;
  try {
    ensureDir(env.webhookStoreFile);
    fs.writeFileSync(env.webhookStoreFile, JSON.stringify(Array.from(webhooks.values()), null, 2));
  } catch (error) {
    logger.error({ err: error, file: env.webhookStoreFile }, 'Failed to persist webhook store');
  }
}

function webhookFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    url: row.url,
    events: row.events || [],
    secret: row.secret || '',
    active: row.active,
    ownerClientId: row.owner_client_id || null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    consecutiveFailures: Number(row.consecutive_failures || 0),
    lastFailureAt: row.last_failure_at ? (row.last_failure_at instanceof Date ? row.last_failure_at.toISOString() : row.last_failure_at) : null
  };
}

function deliveryFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    webhookId: row.webhook_id,
    ownerClientId: row.owner_client_id || null,
    event: row.event,
    sessionId: row.session_id || null,
    payload: row.payload || {},
    status: row.status,
    attempts: row.attempts,
    statusCode: row.status_code || null,
    error: row.error || null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    deliveredAt: row.delivered_at ? (row.delivered_at instanceof Date ? row.delivered_at.toISOString() : row.delivered_at) : null,
    failedAt: row.failed_at ? (row.failed_at instanceof Date ? row.failed_at.toISOString() : row.failed_at) : null,
    retriedFrom: row.retried_from || null
  };
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
    consecutiveFailures: Number(webhook.consecutiveFailures || 0),
    lastFailureAt: webhook.lastFailureAt || null,
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

async function createWebhook({ url, events, secret, active = true }, actor = {}) {
  ensureLoaded();
  const safeUrl = await assertSafeOutboundUrl(url, { requireHttps: env.nodeEnv === 'production' });
  const webhook = {
    id: uuidv4(),
    url: safeUrl,
    events,
    secret: secret || '',
    active,
    ownerClientId: actor.authMode === 'api-client' ? actor.clientId : null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    consecutiveFailures: 0,
    lastFailureAt: null
  };

  if (persistence.isPostgresEnabled()) {
    await persistence.query(
      `INSERT INTO webhooks (
        id,
        url,
        events,
        secret,
        active,
        owner_client_id,
        created_at,
        updated_at,
        consecutive_failures,
        last_failure_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        webhook.id,
        webhook.url,
        JSON.stringify(webhook.events),
        webhook.secret,
        webhook.active,
        webhook.ownerClientId,
        webhook.createdAt,
        webhook.updatedAt,
        webhook.consecutiveFailures,
        webhook.lastFailureAt
      ]
    );
    return sanitize(webhook);
  }

  webhooks.set(webhook.id, webhook);
  persist();
  return sanitize(webhook);
}

async function listWebhooks(actor = {}) {
  ensureLoaded();
  if (persistence.isPostgresEnabled()) {
    const params = [];
    let where = '';
    if (actor && actor.authMode === 'api-client') {
      params.push(actor.clientId);
      where = 'WHERE owner_client_id IS NULL OR owner_client_id = $1';
    }
    const result = await persistence.query(`SELECT * FROM webhooks ${where} ORDER BY created_at DESC`, params);
    return result.rows.map(webhookFromRow).map(sanitize);
  }

  return Array.from(webhooks.values())
    .filter((webhook) => canAccessWebhook(actor, webhook))
    .map(sanitize);
}

async function getStoredWebhook(id) {
  ensureLoaded();
  if (persistence.isPostgresEnabled()) {
    const result = await persistence.query('SELECT * FROM webhooks WHERE id = $1', [id]);
    return webhookFromRow(result.rows[0]);
  }
  return webhooks.get(id) || null;
}

async function getWebhook(id, actor = {}) {
  const webhook = await getStoredWebhook(id);
  if (!webhook) throw new AppError('Webhook not found', 404, 'WEBHOOK_NOT_FOUND');
  assertWebhookAccess(actor, webhook);
  return sanitize(webhook);
}

async function updateWebhook(id, input, actor = {}) {
  const webhook = await getStoredWebhook(id);
  if (!webhook) throw new AppError('Webhook not found', 404, 'WEBHOOK_NOT_FOUND');
  assertWebhookAccess(actor, webhook);

  if (input.url !== undefined) webhook.url = await assertSafeOutboundUrl(input.url, { requireHttps: env.nodeEnv === 'production' });
  if (input.events !== undefined) webhook.events = input.events;
  if (input.secret !== undefined) webhook.secret = input.secret || '';
  if (input.active !== undefined) webhook.active = input.active;
  webhook.updatedAt = nowIso();

  if (persistence.isPostgresEnabled()) {
    const result = await persistence.query(
      `UPDATE webhooks
       SET url=$2, events=$3, secret=$4, active=$5, updated_at=$6
       WHERE id=$1
       RETURNING *`,
      [webhook.id, webhook.url, JSON.stringify(webhook.events), webhook.secret, webhook.active, webhook.updatedAt]
    );
    return sanitize(webhookFromRow(result.rows[0]));
  }

  webhooks.set(webhook.id, webhook);
  persist();
  return sanitize(webhook);
}

async function deleteWebhook(id, actor = {}) {
  const webhook = await getStoredWebhook(id);
  if (!webhook) return false;
  assertWebhookAccess(actor, webhook);

  if (persistence.isPostgresEnabled()) {
    const result = await persistence.query('DELETE FROM webhooks WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  const deleted = webhooks.delete(id);
  if (deleted) persist();
  return deleted;
}

async function saveWebhookFailureState(webhook) {
  if (persistence.isPostgresEnabled()) {
    await persistence.query(
      `UPDATE webhooks
       SET active=$2, consecutive_failures=$3, last_failure_at=$4, updated_at=$5
       WHERE id=$1`,
      [
        webhook.id,
        webhook.active,
        Number(webhook.consecutiveFailures || 0),
        webhook.lastFailureAt || null,
        webhook.updatedAt || nowIso()
      ]
    );
    return;
  }
  webhooks.set(webhook.id, webhook);
  persist();
}

async function getDispatchWebhooks(event) {
  if (persistence.isPostgresEnabled()) {
    const result = await persistence.query(
      `SELECT * FROM webhooks
       WHERE active = TRUE AND (events ? $1 OR events ? '*')`,
      [event]
    );
    return result.rows.map(webhookFromRow);
  }

  ensureLoaded();
  return Array.from(webhooks.values())
    .filter((webhook) => webhook.active)
    .filter((webhook) => webhook.events.includes(event) || webhook.events.includes('*'));
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

async function appendDelivery(delivery) {
  try {
    if (persistence.isPostgresEnabled()) {
      await persistence.query(
        `INSERT INTO webhook_deliveries (
          id,
          webhook_id,
          owner_client_id,
          event,
          session_id,
          payload,
          status,
          attempts,
          status_code,
          error,
          created_at,
          delivered_at,
          failed_at,
          retried_from
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        ON CONFLICT (id) DO UPDATE SET
          payload=EXCLUDED.payload,
          status=EXCLUDED.status,
          attempts=EXCLUDED.attempts,
          status_code=EXCLUDED.status_code,
          error=EXCLUDED.error,
          delivered_at=EXCLUDED.delivered_at,
          failed_at=EXCLUDED.failed_at,
          retried_from=EXCLUDED.retried_from`,
        [
          delivery.id,
          delivery.webhookId,
          delivery.ownerClientId || null,
          delivery.event,
          delivery.sessionId || null,
          JSON.stringify(delivery.payload || {}),
          delivery.status,
          delivery.attempts || 0,
          delivery.statusCode || null,
          delivery.error || null,
          delivery.createdAt || nowIso(),
          delivery.deliveredAt || null,
          delivery.failedAt || null,
          delivery.retriedFrom || null
        ]
      );
      return;
    }
    appendJsonLine(env.webhookDeliveryLogFile, delivery);
  } catch (error) {
    logger.error({ err: error, deliveryId: delivery.id, webhookId: delivery.webhookId }, 'Failed to persist webhook delivery');
  }
}

async function listDeliveries(webhookId, actor = {}) {
  const webhook = await getStoredWebhook(webhookId);
  if (!webhook) throw new AppError('Webhook not found', 404, 'WEBHOOK_NOT_FOUND');
  assertWebhookAccess(actor, webhook);

  if (persistence.isPostgresEnabled()) {
    const result = await persistence.query(
      'SELECT * FROM webhook_deliveries WHERE webhook_id = $1 ORDER BY created_at DESC LIMIT 100',
      [webhookId]
    );
    return result.rows.map(deliveryFromRow).map(deliveryToPublic);
  }

  return readJsonLines(env.webhookDeliveryLogFile, { limit: 5000 })
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
      await appendDelivery(delivery);
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
  await appendDelivery(delivery);
  logger.error({ webhookId: webhook.id, event: payload.event, err: delivery.error }, 'Webhook delivery exhausted');
  return delivery;
}

function updateWebhookFailureState(webhook, delivered) {
  if (delivered) {
    webhook.consecutiveFailures = 0;
    webhook.lastFailureAt = null;
    return;
  }

  webhook.consecutiveFailures = Number(webhook.consecutiveFailures || 0) + 1;
  webhook.lastFailureAt = nowIso();
  if (env.webhookMaxConsecutiveFailures > 0 && webhook.consecutiveFailures >= env.webhookMaxConsecutiveFailures) {
    webhook.active = false;
    webhook.updatedAt = nowIso();
    logger.warn({ webhookId: webhook.id, failures: webhook.consecutiveFailures }, 'Webhook auto-disabled after consecutive failures');
  }
}

function processDeliveryQueue() {
  while (activeDeliveries < env.webhookDeliveryConcurrency && deliveryQueue.length > 0) {
    const job = deliveryQueue.shift();
    activeDeliveries += 1;
    deliver(job.webhook, job.payload, job.existingDelivery)
      .then(async (delivery) => {
        updateWebhookFailureState(job.webhook, delivery.status === 'delivered');
        await saveWebhookFailureState(job.webhook);
      })
      .catch(async (error) => {
        updateWebhookFailureState(job.webhook, false);
        await saveWebhookFailureState(job.webhook);
        logger.error({ err: error, webhookId: job.webhook.id }, 'Unhandled webhook delivery queue error');
      })
      .finally(() => {
        activeDeliveries -= 1;
        processDeliveryQueue();
      });
  }
}

function enqueueDelivery(webhook, payload, existingDelivery = null) {
  if (deliveryQueue.length >= env.webhookDeliveryMaxQueue) {
    const delivery = existingDelivery || {
      id: uuidv4(),
      webhookId: webhook.id,
      ownerClientId: webhook.ownerClientId || null,
      event: payload.event,
      sessionId: payload.sessionId,
      payload,
      status: 'dropped',
      attempts: 0,
      createdAt: nowIso(),
      failedAt: nowIso(),
      error: 'Webhook delivery queue is full'
    };
    appendDelivery(delivery).catch(() => {});
    logger.warn({ webhookId: webhook.id, event: payload.event }, 'Webhook delivery dropped because queue is full');
    return delivery;
  }

  const delivery = existingDelivery || {
    id: uuidv4(),
    webhookId: webhook.id,
    ownerClientId: webhook.ownerClientId || null,
    event: payload.event,
    sessionId: payload.sessionId,
    payload,
    status: 'queued',
    attempts: 0,
    createdAt: nowIso()
  };
  deliveryQueue.push({ webhook, payload, existingDelivery: delivery });
  processDeliveryQueue();
  return delivery;
}

function getDeliveryQueueState() {
  return {
    queued: deliveryQueue.length,
    active: activeDeliveries,
    concurrency: env.webhookDeliveryConcurrency,
    maxQueue: env.webhookDeliveryMaxQueue
  };
}

async function dispatch(event, sessionId, data) {
  const payload = {
    event,
    sessionId,
    data,
    timestamp: nowIso()
  };

  eventBus.publish(event, sessionId, data);

  const matchingWebhooks = await getDispatchWebhooks(event);
  for (const webhook of matchingWebhooks) {
    enqueueDelivery(webhook, payload);
  }
}

async function retryDelivery(deliveryId, actor = {}) {
  ensureLoaded();
  let delivery;
  if (persistence.isPostgresEnabled()) {
    const result = await persistence.query('SELECT * FROM webhook_deliveries WHERE id = $1', [deliveryId]);
    delivery = deliveryFromRow(result.rows[0]);
  } else {
    delivery = readJsonLines(env.webhookDeliveryLogFile, { limit: 10000 }).find((item) => item.id === deliveryId);
  }
  if (!delivery) throw new AppError('Webhook delivery not found', 404, 'WEBHOOK_DELIVERY_NOT_FOUND');
  const webhook = await getStoredWebhook(delivery.webhookId);
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
  dispatch,
  getDeliveryQueueState
};
