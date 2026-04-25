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
  adminApiKey: env.ADMIN_API_KEY || env.API_KEY || '',
  apiKeyPepper: env.API_KEY_PEPPER || env.API_KEY || 'development-api-key-pepper',
  defaultApiClientRateLimitPerMinute: parseNumber(env.DEFAULT_API_CLIENT_RATE_LIMIT_PER_MINUTE, 60),
  corsOrigins: parseList(env.CORS_ORIGIN, ['*']),
  jsonBodyLimit: env.JSON_BODY_LIMIT || '10mb',
  mediaBodyLimit: env.MEDIA_BODY_LIMIT || '50mb',
  authPath: env.WWEBJS_AUTH_PATH || '.wwebjs_auth',
  puppeteerHeadless: parseBoolean(env.PUPPETEER_HEADLESS, true),
  chromeExecutablePath: env.CHROME_EXECUTABLE_PATH || '',
  webhookTimeoutMs: parseNumber(env.WEBHOOK_TIMEOUT_MS, 10000),
  webhookRetryCount: parseNumber(env.WEBHOOK_RETRY_COUNT, 3),
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
