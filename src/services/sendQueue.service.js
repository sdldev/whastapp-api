const env = require('../config/env');
const { AppError } = require('../utils/errors');

const sessionChains = new Map();
const sessionLastSentAt = new Map();
const sessionStats = new Map();
const pausedSessions = new Set();
const pendingCounts = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getStats(sessionId) {
  if (!sessionStats.has(sessionId)) {
    sessionStats.set(sessionId, {
      enqueued: 0,
      completed: 0,
      failed: 0,
      lastError: null,
      lastEnqueuedAt: null,
      lastCompletedAt: null,
      lastFailedAt: null,
      rejected: 0,
      maxPending: env.sendQueueMaxPendingPerSession
    });
  }
  return sessionStats.get(sessionId);
}

function getWaitMs(sessionId) {
  const lastSentAt = sessionLastSentAt.get(sessionId) || 0;
  const elapsed = Date.now() - lastSentAt;
  return Math.max(env.sendMessageDelayMs - elapsed, 0);
}

async function waitUntilResumed(sessionId) {
  while (pausedSessions.has(sessionId)) {
    await sleep(250);
  }
}

function getPendingCount(sessionId) {
  return pendingCounts.get(sessionId) || 0;
}

function incrementPending(sessionId) {
  const pending = getPendingCount(sessionId);
  if (pending >= env.sendQueueMaxPendingPerSession) {
    const stats = getStats(sessionId);
    stats.rejected += 1;
    stats.lastError = 'Send queue is full';
    throw new AppError('Send queue is full for this session', 429, 'SEND_QUEUE_FULL', {
      sessionId,
      maxPending: env.sendQueueMaxPendingPerSession
    });
  }
  pendingCounts.set(sessionId, pending + 1);
}

function decrementPending(sessionId) {
  const pending = getPendingCount(sessionId);
  if (pending <= 1) {
    pendingCounts.delete(sessionId);
    return;
  }
  pendingCounts.set(sessionId, pending - 1);
}

async function runWithDelay(sessionId, operation) {
  const stats = getStats(sessionId);
  incrementPending(sessionId);
  stats.enqueued += 1;
  stats.lastEnqueuedAt = new Date().toISOString();

  const previousChain = sessionChains.get(sessionId) || Promise.resolve();

  const currentChain = previousChain
    .catch(() => {})
    .then(async () => {
      await waitUntilResumed(sessionId);
      const waitMs = getWaitMs(sessionId);
      if (waitMs > 0) await sleep(waitMs);
      await waitUntilResumed(sessionId);

      try {
        const result = await operation();
        stats.completed += 1;
        stats.lastCompletedAt = new Date().toISOString();
        stats.lastError = null;
        return result;
      } catch (error) {
        stats.failed += 1;
        stats.lastFailedAt = new Date().toISOString();
        stats.lastError = error.message;
        throw error;
      } finally {
        sessionLastSentAt.set(sessionId, Date.now());
      }
    });

  sessionChains.set(sessionId, currentChain.finally(() => {
    if (sessionChains.get(sessionId) === currentChain) {
      sessionChains.delete(sessionId);
    }
  }));

  return currentChain.finally(() => decrementPending(sessionId));
}

function getSessionSendState(sessionId) {
  const lastSentAt = sessionLastSentAt.get(sessionId) || null;
  return {
    sessionId,
    delayMs: env.sendMessageDelayMs,
    lastSentAt,
    nextAllowedAt: lastSentAt ? new Date(lastSentAt + env.sendMessageDelayMs).toISOString() : null,
    waitMs: getWaitMs(sessionId),
    pending: getPendingCount(sessionId),
    maxPending: env.sendQueueMaxPendingPerSession,
    queued: sessionChains.has(sessionId),
    paused: pausedSessions.has(sessionId),
    stats: { ...getStats(sessionId) }
  };
}

function listSessionSendStates() {
  const sessionIds = new Set([
    ...sessionChains.keys(),
    ...sessionLastSentAt.keys(),
    ...sessionStats.keys(),
    ...pendingCounts.keys(),
    ...pausedSessions.values()
  ]);
  return Array.from(sessionIds).sort().map(getSessionSendState);
}

function pauseSession(sessionId) {
  pausedSessions.add(sessionId);
  return getSessionSendState(sessionId);
}

function resumeSession(sessionId) {
  pausedSessions.delete(sessionId);
  return getSessionSendState(sessionId);
}

function getQueueSummary() {
  const states = listSessionSendStates();
  const redisEnabled = env.queueDriver === 'redis';
  return {
    driver: redisEnabled ? 'redis' : 'memory',
    redisConfigured: Boolean(env.redisUrl || env.redisHost),
    redisReady: Boolean(redisEnabled && require('./persistence.service').getRedisClient()),
    delayMs: env.sendMessageDelayMs,
    sessions: states.length,
    activeChains: states.filter((state) => state.queued).length,
    totalPending: states.reduce((sum, state) => sum + state.pending, 0),
    maxPendingPerSession: env.sendQueueMaxPendingPerSession,
    pausedSessions: states.filter((state) => state.paused).length,
    totalEnqueued: states.reduce((sum, state) => sum + state.stats.enqueued, 0),
    totalCompleted: states.reduce((sum, state) => sum + state.stats.completed, 0),
    totalFailed: states.reduce((sum, state) => sum + state.stats.failed, 0),
    states
  };
}

module.exports = {
  runWithDelay,
  getSessionSendState,
  listSessionSendStates,
  pauseSession,
  resumeSession,
  getQueueSummary
};
