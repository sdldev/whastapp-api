const express = require('express');
const { success } = require('../utils/apiResponse');
const clientManager = require('../services/clientManager.service');
const sendQueue = require('../services/sendQueue.service');

const router = express.Router();

router.get('/', (req, res) => {
  const health = clientManager.getHealthSummary();
  const queue = sendQueue.getQueueSummary();
  const memory = process.memoryUsage();
  return success(res, {
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    sessions: health,
    queue: {
      delayMs: queue.delayMs,
      sessions: queue.sessions,
      activeChains: queue.activeChains,
      pausedSessions: queue.pausedSessions,
      totalEnqueued: queue.totalEnqueued,
      totalCompleted: queue.totalCompleted,
      totalFailed: queue.totalFailed
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
