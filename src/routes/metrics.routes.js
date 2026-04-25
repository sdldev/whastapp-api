const express = require('express');
const { success } = require('../utils/apiResponse');
const clientManager = require('../services/clientManager.service');
const sendQueue = require('../services/sendQueue.service');
const messageCache = require('../store/messageCache.store');
const webhookService = require('../services/webhook.service');
const env = require('../config/env');

const router = express.Router();

router.get('/', (req, res) => {
  const health = clientManager.getHealthSummary();
  const queue = sendQueue.getQueueSummary();
  const webhookDelivery = webhookService.getDeliveryQueueState();
  const memory = process.memoryUsage();
  return success(res, {
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    sessions: {
      ...health,
      initializeTimeoutMs: env.sessionInitializeTimeoutMs,
      restoreConcurrency: env.sessionRestoreConcurrency
    },
    queue: {
      delayMs: queue.delayMs,
      sessions: queue.sessions,
      activeChains: queue.activeChains,
      totalPending: queue.totalPending,
      maxPendingPerSession: queue.maxPendingPerSession,
      pausedSessions: queue.pausedSessions,
      totalEnqueued: queue.totalEnqueued,
      totalCompleted: queue.totalCompleted,
      totalFailed: queue.totalFailed
    },
    webhookDelivery,
    messageCache: messageCache.getCacheStats(),
    logs: {
      jsonlMaxBytes: env.jsonlLogMaxBytes,
      jsonlMaxBackupFiles: env.jsonlLogMaxBackupFiles
    },
    process: {
      pid: process.pid,
      nodeVersion: process.version,
      memory: {
        rss: memory.rss,
        heapTotal: memory.heapTotal,
        heapUsed: memory.heapUsed,
        external: memory.external
      }
    }
  });
});

module.exports = router;
