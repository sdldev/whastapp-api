const express = require('express');
const validate = require('../middlewares/validate.middleware');
const { success } = require('../utils/apiResponse');
const apiClientService = require('../services/apiClient.service');
const auditLogService = require('../services/auditLog.service');
const messageService = require('../services/message.service');
const persistence = require('../services/persistence.service');
const {
  apiClientCreateSchema,
  apiClientUpdateSchema,
  apiClientParamSchema,
  auditLogQuerySchema,
  usageLogQuerySchema,
  messageLogAdminQuerySchema,
  retentionCleanupSchema
} = require('../schemas/apiClient.schema');

const router = express.Router();

router.get('/audit-logs', validate(auditLogQuerySchema), async (req, res) => {
  return success(res, await auditLogService.listAuditLogs(req.query));
});

router.get('/usage-logs', validate(usageLogQuerySchema), async (req, res) => {
  return success(res, await apiClientService.listUsageLogs(req.query));
});

router.get('/message-logs', validate(messageLogAdminQuerySchema), async (req, res) => {
  return success(res, await messageService.listMessageLogs(req.query));
});

router.get('/persistence/health', async (req, res) => {
  return success(res, await persistence.getHealth());
});

router.post('/retention/cleanup', validate(retentionCleanupSchema), async (req, res) => {
  return success(res, await persistence.cleanupRetention(req.body));
});

router.post('/api-clients', validate(apiClientCreateSchema), async (req, res) => {
  return success(res, await apiClientService.createApiClient(req.body), 201);
});

router.get('/api-clients', async (req, res) => {
  return success(res, await apiClientService.listApiClients());
});

router.get('/api-clients/:clientId', validate(apiClientParamSchema), async (req, res) => {
  return success(res, await apiClientService.getApiClient(req.params.clientId));
});

router.patch('/api-clients/:clientId', validate(apiClientUpdateSchema), async (req, res) => {
  return success(res, await apiClientService.updateApiClient(req.params.clientId, req.body));
});

router.post('/api-clients/:clientId/revoke', validate(apiClientParamSchema), async (req, res) => {
  return success(res, await apiClientService.revokeApiClient(req.params.clientId));
});

router.post('/api-clients/:clientId/keys/rotate', validate(apiClientParamSchema), async (req, res) => {
  return success(res, await apiClientService.rotateApiKey(req.params.clientId));
});

module.exports = router;
