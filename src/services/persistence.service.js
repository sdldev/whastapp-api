const { Pool } = require('pg');
const { createClient } = require('redis');
const env = require('../config/env');
const logger = require('../utils/logger');

let pool = null;
let redisClient = null;
let initialized = false;
let postgresAvailable = false;
let redisInitialized = false;

function isPostgresEnabled() {
  return env.persistenceDriver === 'postgres' && postgresAvailable;
}

function isPostgresConfigured() {
  return env.persistenceDriver === 'postgres';
}

function isRedisConfigured() {
  return Boolean(env.redisUrl || env.redisHost);
}

function createPool() {
  if (pool) return pool;
  if (env.databaseUrl) {
    pool = new Pool({
      connectionString: env.databaseUrl,
      ssl: env.postgresSsl ? { rejectUnauthorized: false } : false
    });
  } else {
    pool = new Pool({
      host: env.postgresHost,
      port: env.postgresPort,
      database: env.postgresDatabase,
      user: env.postgresUser,
      password: env.postgresPassword,
      ssl: env.postgresSsl ? { rejectUnauthorized: false } : false
    });
  }
  return pool;
}

async function migratePostgres() {
  if (!isPostgresEnabled()) return;
  const db = createPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS api_clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      allowed_sessions JSONB NOT NULL DEFAULT '[]'::jsonb,
      scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
      rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NULL,
      revoked_at TIMESTAMPTZ NULL,
      last_used_at TIMESTAMPTZ NULL
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES api_clients(id) ON DELETE CASCADE,
      key_prefix TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NULL,
      revoked_at TIMESTAMPTZ NULL,
      last_used_at TIMESTAMPTZ NULL
    );

    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      events JSONB NOT NULL DEFAULT '[]'::jsonb,
      secret TEXT NOT NULL DEFAULT '',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      owner_client_id TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      consecutive_failures INTEGER NOT NULL DEFAULT 0,
      last_failure_at TIMESTAMPTZ NULL
    );

    ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS last_failure_at TIMESTAMPTZ NULL;

    CREATE TABLE IF NOT EXISTS api_usage_logs (
      id BIGSERIAL PRIMARY KEY,
      client_id TEXT NULL,
      api_key_id TEXT NULL,
      session_id TEXT NULL,
      method TEXT NULL,
      path TEXT NULL,
      status_code INTEGER NULL,
      ip_address TEXT NULL,
      user_agent TEXT NULL,
      scope_used TEXT NULL,
      request_id TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL,
      actor_type TEXT NULL,
      actor_id TEXT NULL,
      api_key_id TEXT NULL,
      auth_mode TEXT NULL,
      action TEXT NULL,
      session_id TEXT NULL,
      method TEXT NULL,
      path TEXT NULL,
      status_code INTEGER NULL,
      ip_address TEXT NULL,
      user_agent TEXT NULL,
      request_id TEXT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id TEXT PRIMARY KEY,
      webhook_id TEXT NOT NULL,
      owner_client_id TEXT NULL,
      event TEXT NOT NULL,
      session_id TEXT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      status_code INTEGER NULL,
      error TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      delivered_at TIMESTAMPTZ NULL,
      failed_at TIMESTAMPTZ NULL,
      retried_from TEXT NULL
    );

    CREATE TABLE IF NOT EXISTS message_logs (
      id TEXT PRIMARY KEY,
      wa_message_id TEXT NULL,
      session_id TEXT NOT NULL,
      api_client_id TEXT NULL,
      direction TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      from_id TEXT NULL,
      to_id TEXT NULL,
      type TEXT NOT NULL DEFAULT 'chat',
      body TEXT NULL,
      has_media BOOLEAN NOT NULL DEFAULT FALSE,
      status TEXT NOT NULL,
      error TEXT NULL,
      request_id TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      sent_at TIMESTAMPTZ NULL,
      received_at TIMESTAMPTZ NULL
    );

    CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
    CREATE INDEX IF NOT EXISTS idx_api_usage_client_created ON api_usage_logs(client_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_message_logs_session_created ON message_logs(session_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_message_logs_chat_created ON message_logs(chat_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_message_logs_api_client_created ON message_logs(api_client_id, created_at DESC);
  `);
}

async function initRedis() {
  if (!env.redisUrl && !env.redisHost) return;
  if (redisClient) return;
  const url = env.redisUrl || `redis://${env.redisHost}:${env.redisPort}`;
  redisClient = createClient({
    url,
    password: env.redisPassword || undefined,
    database: env.redisDb
  });
  redisClient.on('error', (error) => logger.warn({ err: error }, 'Redis client error'));
  await redisClient.connect();
  redisInitialized = true;
}

async function initPersistence() {
  if (initialized) return;
  if (isPostgresConfigured()) {
    postgresAvailable = true;
    await migratePostgres();
    logger.info('Postgres persistence initialized');
  }
  try {
    await initRedis();
    if (redisInitialized) logger.info('Redis client initialized');
  } catch (error) {
    logger.warn({ err: error }, 'Redis initialization failed; continuing without Redis');
  }
  initialized = true;
}

async function query(text, params = []) {
  if (!isPostgresEnabled()) throw new Error('Postgres persistence is not enabled');
  return createPool().query(text, params);
}

async function getHealth() {
  const postgres = { enabled: isPostgresEnabled(), connected: false, error: null };
  const redis = { enabled: Boolean(env.redisUrl || env.redisHost), connected: false, error: null };

  if (postgres.enabled) {
    try {
      await query('SELECT 1');
      postgres.connected = true;
    } catch (error) {
      postgres.error = error.message;
    }
  }

  if (redis.enabled && redisClient) {
    try {
      await redisClient.ping();
      redis.connected = true;
    } catch (error) {
      redis.error = error.message;
    }
  }

  return { driver: env.persistenceDriver, postgres, redis };
}

async function cleanupRetention(options = {}) {
  if (!isPostgresEnabled()) {
    return {
      driver: env.persistenceDriver,
      skipped: true,
      reason: 'Postgres persistence is not enabled',
      deleted: {}
    };
  }

  const retention = {
    apiUsageDays: Number(options.apiUsageDays || env.retentionApiUsageDays),
    auditDays: Number(options.auditDays || env.retentionAuditDays),
    webhookDeliveryDays: Number(options.webhookDeliveryDays || env.retentionWebhookDeliveryDays),
    messageLogDays: Number(options.messageLogDays || env.retentionMessageLogDays)
  };

  const deleted = {};
  const statements = [
    ['apiUsageLogs', 'DELETE FROM api_usage_logs WHERE created_at < NOW() - ($1::int * INTERVAL \'1 day\')', retention.apiUsageDays],
    ['auditLogs', 'DELETE FROM audit_logs WHERE created_at < NOW() - ($1::int * INTERVAL \'1 day\')', retention.auditDays],
    ['webhookDeliveries', 'DELETE FROM webhook_deliveries WHERE created_at < NOW() - ($1::int * INTERVAL \'1 day\')', retention.webhookDeliveryDays],
    ['messageLogs', 'DELETE FROM message_logs WHERE created_at < NOW() - ($1::int * INTERVAL \'1 day\')', retention.messageLogDays]
  ];

  for (const [key, sql, days] of statements) {
    const result = await query(sql, [days]);
    deleted[key] = result.rowCount;
  }

  return { driver: env.persistenceDriver, skipped: false, retention, deleted };
}

async function closePersistence() {
  if (redisClient) {
    await redisClient.quit().catch(() => {});
    redisClient = null;
  }
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
  }
  redisInitialized = false;
  postgresAvailable = false;
  initialized = false;
}

module.exports = {
  initPersistence,
  closePersistence,
  query,
  getHealth,
  cleanupRetention,
  isPostgresEnabled,
  isPostgresConfigured,
  getRedisClient: () => redisClient
};
