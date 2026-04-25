const env = require('../config/env');

const sessionChains = new Map();
const sessionLastSentAt = new Map();
const sessionStats = new Map();
const pausedSessions = new Set();

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
      lastFailedAt: null
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

async function runWithDelay(sessionId, operation) {
  const stats = getStats(sessionId);
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

  return currentChain;
}

function getSessionSendState(sessionId) {
  const lastSentAt = sessionLastSentAt.get(sessionId) || null;
  return {
    sessionId,
    delayMs: env.sendMessageDelayMs,
    lastSentAt,
    nextAllowedAt: lastSentAt ? new Date(lastSentAt + env.sendMessageDelayMs).toISOString() : null,
    waitMs: getWaitMs(sessionId),
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
  return {
    delayMs: env.sendMessageDelayMs,
    sessions: states.length,
    activeChains: states.filter((state) => state.queued).length,
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
