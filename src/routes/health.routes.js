const express = require('express');
const { success } = require('../utils/apiResponse');
const clientManager = require('../services/clientManager.service');

const router = express.Router();

router.get('/', (req, res) => {
  const sessions = clientManager.getHealthSummary();
  return success(res, {
    status: 'ok',
    uptime: process.uptime(),
    sessions
  });
});

router.get('/ready', async (req, res, next) => {
  try {
    return success(res, await clientManager.getAdvancedHealth());
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
