const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs/promises');
const env = require('../config/env');
const logger = require('../utils/logger');
const { toDataUrl } = require('../utils/qr');
const { AppError } = require('../utils/errors');
const messageCache = require('../store/messageCache.store');
const webhookService = require('./webhook.service');
const persistence = require('./persistence.service');
const messageLogService = require('./messageLog.service');

const sessions = new Map();

function publicSession(session) {
  if (!session) return null;
  return {
    sessionId: session.sessionId,
    status: session.status,
    me: session.me,
    lastError: session.lastError,
    startedAt: session.startedAt,
    readyAt: session.readyAt,
    disconnectedAt: session.disconnectedAt
  };
}

function buildPuppeteerOptions() {
  const options = {
    headless: env.puppeteerHeadless,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  };

  if (env.chromeExecutablePath) {
    options.executablePath = env.chromeExecutablePath;
  }

  return options;
}

function createSessionState(sessionId) {
  return {
    sessionId,
    client: null,
    status: 'idle',
    qr: null,
    qrDataUrl: null,
    me: null,
    lastError: null,
    startedAt: null,
    readyAt: null,
    disconnectedAt: null
  };
}

function getSessionOrThrow(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
  return session;
}

function getClientState(session) {
  const client = session ? session.client : null;
  const pupBrowser = client ? client.pupBrowser : null;
  return {
    hasClient: Boolean(client),
    browserConnected: Boolean(pupBrowser && pupBrowser.isConnected && pupBrowser.isConnected()),
    whatsappReady: Boolean(session && session.status === 'ready')
  };
}

function timeoutError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function withTimeout(promise, timeoutMs, timeoutMessage, timeoutCode) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(timeoutError(timeoutMessage, timeoutCode)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function findStoredSessionIds() {
  try {
    const entries = await fs.readdir(env.authPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('session-'))
      .map((entry) => entry.name.replace(/^session-/, ''))
      .filter(Boolean);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function dispatchWebhook(event, sessionId, data) {
  webhookService.dispatch(event, sessionId, data).catch((error) => {
    logger.error({ err: error, event, sessionId }, 'Webhook dispatch failed');
  });
}

function appendMessageLog(sessionId, message) {
  messageLogService.logIncomingMessage(sessionId, message).catch((error) => {
    logger.warn({ err: error, sessionId }, 'Message log append failed');
  });
}

function registerClientEvents(session) {
  const { client, sessionId } = session;

  client.on('qr', async (qr) => {
    session.status = 'qr';
    session.qr = qr;
    session.qrDataUrl = await toDataUrl(qr);
    logger.info({ sessionId }, 'WhatsApp QR received');
    dispatchWebhook('session.qr', sessionId, { qr, qrDataUrl: session.qrDataUrl });
  });

  client.on('authenticated', () => {
    session.status = 'authenticated';
    session.lastError = null;
    logger.info({ sessionId }, 'WhatsApp session authenticated');
    dispatchWebhook('session.authenticated', sessionId, publicSession(session));
  });

  client.on('ready', () => {
    session.status = 'ready';
    session.readyAt = new Date().toISOString();
    session.qr = null;
    session.qrDataUrl = null;
    session.me = client.info || null;
    logger.info({ sessionId }, 'WhatsApp client ready');
    dispatchWebhook('session.ready', sessionId, publicSession(session));
  });

  client.on('auth_failure', (message) => {
    session.status = 'auth_failure';
    session.lastError = message || 'Authentication failed';
    logger.warn({ sessionId, message }, 'WhatsApp authentication failure');
    dispatchWebhook('session.auth_failure', sessionId, publicSession(session));
  });

  client.on('disconnected', (reason) => {
    session.status = 'disconnected';
    session.disconnectedAt = new Date().toISOString();
    session.lastError = reason || null;
    logger.warn({ sessionId, reason }, 'WhatsApp session disconnected');
    dispatchWebhook('session.disconnected', sessionId, publicSession(session));
  });

  client.on('message', async (message) => {
    messageCache.setMessage(message);
    appendMessageLog(sessionId, message);
    const serialized = messageCache.serializeMessage(message);
    dispatchWebhook('message.received', sessionId, serialized);

    if (message.hasMedia) {
      dispatchWebhook('message.media', sessionId, serialized);
    }

    if (message.type === 'location' || message.location) {
      dispatchWebhook('message.location', sessionId, serialized);
    }
  });

  client.on('message_create', (message) => {
    messageCache.setMessage(message);
    appendMessageLog(sessionId, message);
    dispatchWebhook('message.created', sessionId, messageCache.serializeMessage(message));
  });

  client.on('message_reaction', (reaction) => {
    dispatchWebhook('message.reaction', sessionId, reaction);
  });
}

async function startSession(sessionId, options = {}) {
  const existing = sessions.get(sessionId);

  if (existing && !options.restartIfExists) {
    return publicSession(existing);
  }

  if (existing && options.restartIfExists) {
    await destroySession(sessionId);
  }

  const session = createSessionState(sessionId);
  session.status = 'initializing';
  session.startedAt = new Date().toISOString();

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: sessionId,
      dataPath: env.authPath
    }),
    puppeteer: buildPuppeteerOptions()
  });

  session.client = client;
  sessions.set(sessionId, session);
  registerClientEvents(session);

  try {
    await withTimeout(
      client.initialize(),
      env.sessionInitializeTimeoutMs,
      `WhatsApp session initialization timed out after ${env.sessionInitializeTimeoutMs}ms`,
      'SESSION_INITIALIZE_TIMEOUT'
    );
  } catch (error) {
    session.status = 'error';
    session.lastError = error.message;
    logger.error({ err: error, sessionId }, 'Failed to initialize WhatsApp client');
    try {
      if (client.destroy) await client.destroy();
    } catch (destroyError) {
      logger.warn({ err: destroyError, sessionId }, 'Failed to destroy timed out WhatsApp client');
    }
    const statusCode = error.code === 'SESSION_INITIALIZE_TIMEOUT' ? 504 : 500;
    throw new AppError(error.message, statusCode, error.code || 'SESSION_INITIALIZE_FAILED');
  }

  return publicSession(session);
}

function listSessions() {
  return Array.from(sessions.values()).map(publicSession);
}

function getStatus(sessionId) {
  return publicSession(getSessionOrThrow(sessionId));
}

function getQr(sessionId) {
  const session = getSessionOrThrow(sessionId);
  if (!session.qr && session.status !== 'ready') {
    throw new AppError('QR is not available yet', 404, 'QR_NOT_AVAILABLE');
  }
  return {
    sessionId,
    status: session.status,
    qr: session.qr,
    qrDataUrl: session.qrDataUrl
  };
}

function getClient(sessionId) {
  return getSessionOrThrow(sessionId).client;
}

function ensureReady(sessionId) {
  const session = getSessionOrThrow(sessionId);
  if (session.status !== 'ready' || !session.client) {
    throw new AppError('WhatsApp session is not ready', 409, 'SESSION_NOT_READY', { status: session.status });
  }
  return session.client;
}

async function logoutSession(sessionId) {
  const session = getSessionOrThrow(sessionId);
  if (session.client) await session.client.logout();
  session.status = 'destroyed';
  return publicSession(session);
}

async function destroySession(sessionId) {
  const session = getSessionOrThrow(sessionId);
  if (session.client) await session.client.destroy();
  session.status = 'destroyed';
  sessions.delete(sessionId);
  return { sessionId, status: 'destroyed' };
}

async function restartSession(sessionId) {
  await destroySession(sessionId);
  return startSession(sessionId);
}

async function recoverSession(sessionId) {
  const existing = sessions.get(sessionId);
  if (existing) {
    await destroySession(sessionId);
  }
  return startSession(sessionId);
}

async function restoreSessions() {
  const storedSessionIds = await findStoredSessionIds();
  const results = [];
  let cursor = 0;

  async function restoreNext() {
    while (cursor < storedSessionIds.length) {
      const sessionId = storedSessionIds[cursor];
      cursor += 1;

      if (sessions.has(sessionId)) {
        results.push({ sessionId, restored: false, status: sessions.get(sessionId).status, reason: 'already_loaded' });
        continue;
      }

      try {
        const session = await startSession(sessionId);
        results.push({ sessionId, restored: true, status: session.status });
      } catch (error) {
        results.push({ sessionId, restored: false, status: 'error', error: error.message, code: error.code || null });
      }
    }
  }

  const workerCount = Math.min(env.sessionRestoreConcurrency, storedSessionIds.length || 1);
  await Promise.all(Array.from({ length: workerCount }, restoreNext));

  return {
    total: storedSessionIds.length,
    restored: results.filter((item) => item.restored).length,
    concurrency: env.sessionRestoreConcurrency,
    results
  };
}

function getSessionHealth(sessionId) {
  const session = getSessionOrThrow(sessionId);
  return {
    ...publicSession(session),
    ...getClientState(session)
  };
}

async function getScreenshot(sessionId) {
  const session = getSessionOrThrow(sessionId);
  if (!session.client || !session.client.pupPage) {
    throw new AppError('Puppeteer page is not available for this session', 409, 'SCREENSHOT_NOT_AVAILABLE');
  }

  const screenshot = await session.client.pupPage.screenshot({ encoding: 'base64', fullPage: true });
  return {
    sessionId,
    mimetype: 'image/png',
    data: screenshot
  };
}

async function destroyAll() {
  const ids = Array.from(sessions.keys());
  await Promise.allSettled(ids.map((sessionId) => destroySession(sessionId)));
}

function getHealthSummary() {
  const summary = { total: 0, ready: 0, unhealthy: 0 };
  for (const session of sessions.values()) {
    summary.total += 1;
    summary[session.status] = (summary[session.status] || 0) + 1;
    if (session.status === 'ready') summary.ready += 1;
    if (['auth_failure', 'disconnected', 'error'].includes(session.status)) summary.unhealthy += 1;
  }
  return summary;
}

async function getAdvancedHealth({ includeSessionIds = env.exposeHealthSessionIds } = {}) {
  const storedSessionIds = await findStoredSessionIds();
  const storedSessions = {
    total: storedSessionIds.length
  };
  if (includeSessionIds) storedSessions.sessionIds = storedSessionIds;

  return {
    api: 'ok',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    sessions: getHealthSummary(),
    storedSessions,
    persistence: await persistence.getHealth()
  };
}

module.exports = {
  startSession,
  listSessions,
  getStatus,
  getQr,
  getClient,
  ensureReady,
  logoutSession,
  destroySession,
  restartSession,
  recoverSession,
  restoreSessions,
  getSessionHealth,
  getScreenshot,
  destroyAll,
  getHealthSummary,
  getAdvancedHealth,
  withTimeout
};
