require('dotenv').config();

const { env } = process;

function parseList(value, fallback = []) {
  if (!value) return fallback;
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

module.exports = {
  nodeEnv: env.NODE_ENV || 'development',
  port: parseNumber(env.PORT, 7000),
  apiKey: env.API_KEY || '',
  adminApiKey: env.ADMIN_API_KEY || '',
  allowAnonymousAccess: parseBoolean(env.ALLOW_ANONYMOUS_ACCESS, false),
  enableLegacyApiKey: parseBoolean(env.ENABLE_LEGACY_API_KEY, (env.NODE_ENV || 'development') !== 'production'),
  apiKeyPepper: env.API_KEY_PEPPER || env.API_KEY || 'development-api-key-pepper',
  enableApiDocs: parseBoolean(env.ENABLE_API_DOCS, (env.NODE_ENV || 'development') !== 'production'),
  exposeHealthSessionIds: parseBoolean(env.EXPOSE_HEALTH_SESSION_IDS, false),
  allowedOutboundHosts: parseList(env.OUTBOUND_URL_ALLOWED_HOSTS, []),
  allowPrivateOutboundUrls: parseBoolean(env.ALLOW_PRIVATE_OUTBOUND_URLS, false),
  defaultApiClientRateLimitPerMinute: parseNumber(env.DEFAULT_API_CLIENT_RATE_LIMIT_PER_MINUTE, 60),
  corsOrigins: parseList(env.CORS_ORIGIN, ['*']),
  jsonBodyLimit: env.JSON_BODY_LIMIT || '10mb',
  mediaBodyLimit: env.MEDIA_BODY_LIMIT || '50mb',
  uploadMaxBytes: parseNumber(env.UPLOAD_MAX_BYTES || env.MEDIA_UPLOAD_MAX_BYTES, 50 * 1024 * 1024),
  uploadAllowedMimeTypes: parseList(env.UPLOAD_ALLOWED_MIME_TYPES, []),
  authPath: env.WWEBJS_AUTH_PATH || '.wwebjs_auth',
  puppeteerHeadless: parseBoolean(env.PUPPETEER_HEADLESS, true),
  chromeExecutablePath: env.CHROME_EXECUTABLE_PATH || '',
  webhookTimeoutMs: parseNumber(env.WEBHOOK_TIMEOUT_MS, 10000),
  webhookRetryCount: parseNumber(env.WEBHOOK_RETRY_COUNT, 3),
  webhookDeliveryConcurrency: Math.max(parseNumber(env.WEBHOOK_DELIVERY_CONCURRENCY, 5), 1),
  webhookDeliveryMaxQueue: Math.max(parseNumber(env.WEBHOOK_DELIVERY_MAX_QUEUE, 1000), 1),
  webhookMaxConsecutiveFailures: Math.max(parseNumber(env.WEBHOOK_MAX_CONSECUTIVE_FAILURES, 10), 0),
  sendQueueMaxPendingPerSession: Math.max(parseNumber(env.SEND_QUEUE_MAX_PENDING_PER_SESSION, 100), 1),
  messageCacheMaxEntries: Math.max(parseNumber(env.MESSAGE_CACHE_MAX_ENTRIES, 1000), 1),
  messageCacheTtlMs: Math.max(parseNumber(env.MESSAGE_CACHE_TTL_MS, 60 * 60 * 1000), 1000),
  sessionInitializeTimeoutMs: Math.max(parseNumber(env.SESSION_INITIALIZE_TIMEOUT_MS, 120000), 1000),
  sessionRestoreConcurrency: Math.max(parseNumber(env.SESSION_RESTORE_CONCURRENCY, 2), 1),
  jsonlLogMaxBytes: Math.max(parseNumber(env.JSONL_LOG_MAX_BYTES, 10 * 1024 * 1024), 1024),
  jsonlLogMaxBackupFiles: Math.max(parseNumber(env.JSONL_LOG_MAX_BACKUP_FILES, 5), 0),
  sendMessageDelayMs: Math.max(parseNumber(env.SEND_MESSAGE_DELAY_MS, 5000), 5000),
  uploadDir: env.UPLOAD_DIR || 'uploads',
  dataDir: env.DATA_DIR || 'data',
  webhookStoreFile: env.WEBHOOK_STORE_FILE || 'data/webhooks.json',
  webhookDeliveryLogFile: env.WEBHOOK_DELIVERY_LOG_FILE || 'data/webhook-deliveries.log',
  apiClientStoreFile: env.API_CLIENT_STORE_FILE || 'data/api-clients.json',
  apiUsageLogFile: env.API_USAGE_LOG_FILE || 'data/api-usage.log',
  auditLogFile: env.AUDIT_LOG_FILE || 'data/audit.log',
  persistenceDriver: env.PERSISTENCE_DRIVER || 'file',
  databaseUrl: env.DATABASE_URL || '',
  postgresHost: env.POSTGRES_HOST || '127.0.0.1',
  postgresPort: parseNumber(env.POSTGRES_PORT, 5432),
  postgresDatabase: env.POSTGRES_DB || 'whatsapp_api',
  postgresUser: env.POSTGRES_USER || 'postgres',
  postgresPassword: env.POSTGRES_PASSWORD || '',
  postgresSsl: parseBoolean(env.POSTGRES_SSL, false),
  redisUrl: env.REDIS_URL || '',
  redisHost: env.REDIS_HOST || '127.0.0.1',
  redisPort: parseNumber(env.REDIS_PORT, 6379),
  redisPassword: env.REDIS_PASSWORD || '',
  redisDb: parseNumber(env.REDIS_DB, 0)
};
