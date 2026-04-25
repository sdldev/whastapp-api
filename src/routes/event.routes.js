const express = require('express');
const { AppError } = require('../utils/errors');
const eventBus = require('../services/eventBus.service');

const router = express.Router({ mergeParams: true });

function sendSse(res, eventName, payload) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

router.get('/', (req, res, next) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) throw new AppError('Session ID is required', 400, 'SESSION_ID_REQUIRED');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    sendSse(res, 'connected', {
      event: 'connected',
      sessionId,
      timestamp: new Date().toISOString()
    });

    const unsubscribe = eventBus.subscribe((payload) => {
      if (payload.sessionId !== sessionId) return;
      sendSse(res, payload.event, payload);
    });

    const heartbeat = setInterval(() => {
      sendSse(res, 'heartbeat', {
        event: 'heartbeat',
        sessionId,
        timestamp: new Date().toISOString()
      });
    }, 30000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
