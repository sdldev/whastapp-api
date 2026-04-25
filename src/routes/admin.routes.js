const express = require('express');
const validate = require('../middlewares/validate.middleware');
const { success } = require('../utils/apiResponse');
const apiClientService = require('../services/apiClient.service');
const auditLogService = require('../services/auditLog.service');
const {
  apiClientCreateSchema,
  apiClientUpdateSchema,
  apiClientParamSchema,
  auditLogQuerySchema
} = require('../schemas/apiClient.schema');

const router = express.Router();

router.get('/audit-logs', validate(auditLogQuerySchema), (req, res) => {
  return success(res, auditLogService.listAuditLogs(req.query));
});

router.post('/api-clients', validate(apiClientCreateSchema), (req, res) => {
  return success(res, apiClientService.createApiClient(req.body), 201);
});

router.get('/api-clients', (req, res) => {
  return success(res, apiClientService.listApiClients());
});

router.get('/api-clients/:clientId', validate(apiClientParamSchema), (req, res) => {
  return success(res, apiClientService.getApiClient(req.params.clientId));
});

router.patch('/api-clients/:clientId', validate(apiClientUpdateSchema), (req, res) => {
  return success(res, apiClientService.updateApiClient(req.params.clientId, req.body));
});

router.post('/api-clients/:clientId/revoke', validate(apiClientParamSchema), (req, res) => {
  return success(res, apiClientService.revokeApiClient(req.params.clientId));
});

router.post('/api-clients/:clientId/keys/rotate', validate(apiClientParamSchema), (req, res) => {
  return success(res, apiClientService.rotateApiKey(req.params.clientId));
});

module.exports = router;
