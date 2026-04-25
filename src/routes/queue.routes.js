const express = require('express');
const validate = require('../middlewares/validate.middleware');
const { success } = require('../utils/apiResponse');
const sendQueue = require('../services/sendQueue.service');
const { sessionOnlySchema } = require('../schemas/session.schema');

const router = express.Router();

router.get('/', validate(sessionOnlySchema), (req, res) => {
  return success(res, sendQueue.getSessionSendState(req.params.sessionId));
});

router.post('/pause', validate(sessionOnlySchema), (req, res) => {
  return success(res, sendQueue.pauseSession(req.params.sessionId));
});

router.post('/resume', validate(sessionOnlySchema), (req, res) => {
  return success(res, sendQueue.resumeSession(req.params.sessionId));
});

module.exports = router;
