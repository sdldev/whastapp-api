const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate.middleware');
const { success } = require('../utils/apiResponse');
const clientManager = require('../services/clientManager.service');
const { startSessionSchema, sessionOnlySchema } = require('../schemas/session.schema');

const router = express.Router();

router.get('/', (req, res) => success(res, clientManager.listSessions()));

router.post('/restore', asyncHandler(async (req, res) => {
  return success(res, await clientManager.restoreSessions(), 202);
}));

router.post('/terminate-all', asyncHandler(async (req, res) => {
  await clientManager.destroyAll();
  return success(res, { status: 'destroyed' });
}));

router.post('/:sessionId/start', validate(startSessionSchema), asyncHandler(async (req, res) => {
  const data = await clientManager.startSession(req.params.sessionId, req.body);
  return success(res, data, 202);
}));

router.get('/:sessionId/status', validate(sessionOnlySchema), (req, res) => {
  return success(res, clientManager.getStatus(req.params.sessionId));
});

router.get('/:sessionId/health', validate(sessionOnlySchema), (req, res) => {
  return success(res, clientManager.getSessionHealth(req.params.sessionId));
});

router.get('/:sessionId/screenshot', validate(sessionOnlySchema), asyncHandler(async (req, res) => {
  return success(res, await clientManager.getScreenshot(req.params.sessionId));
}));

router.get('/:sessionId/qr', validate(sessionOnlySchema), (req, res) => {
  return success(res, clientManager.getQr(req.params.sessionId));
});

router.post('/:sessionId/logout', validate(sessionOnlySchema), asyncHandler(async (req, res) => {
  return success(res, await clientManager.logoutSession(req.params.sessionId));
}));

router.post('/:sessionId/restart', validate(sessionOnlySchema), asyncHandler(async (req, res) => {
  return success(res, await clientManager.restartSession(req.params.sessionId), 202);
}));

router.post('/:sessionId/recover', validate(sessionOnlySchema), asyncHandler(async (req, res) => {
  return success(res, await clientManager.recoverSession(req.params.sessionId), 202);
}));

router.delete('/:sessionId', validate(sessionOnlySchema), asyncHandler(async (req, res) => {
  return success(res, await clientManager.destroySession(req.params.sessionId));
}));

module.exports = router;
