const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate.middleware');
const { success } = require('../utils/apiResponse');
const webhookService = require('../services/webhook.service');
const {
  webhookCreateSchema,
  webhookUpdateSchema,
  webhookParamSchema,
  webhookDeliveryParamSchema
} = require('../schemas/common.schema');

const router = express.Router();

router.post('/', validate(webhookCreateSchema), asyncHandler(async (req, res) => {
  return success(res, await webhookService.createWebhook(req.body, req.apiClient), 201);
}));

router.get('/', (req, res) => {
  return success(res, webhookService.listWebhooks(req.apiClient));
});

router.get('/:webhookId', validate(webhookParamSchema), (req, res) => {
  return success(res, webhookService.getWebhook(req.params.webhookId, req.apiClient));
});

router.patch('/:webhookId', validate(webhookUpdateSchema), asyncHandler(async (req, res) => {
  return success(res, await webhookService.updateWebhook(req.params.webhookId, req.body, req.apiClient));
}));

router.delete('/:webhookId', validate(webhookParamSchema), asyncHandler(async (req, res) => {
  return success(res, { deleted: webhookService.deleteWebhook(req.params.webhookId, req.apiClient) });
}));

router.get('/:webhookId/deliveries', validate(webhookParamSchema), (req, res) => {
  return success(res, webhookService.listDeliveries(req.params.webhookId, req.apiClient));
});

router.post('/deliveries/:deliveryId/retry', validate(webhookDeliveryParamSchema), asyncHandler(async (req, res) => {
  return success(res, await webhookService.retryDelivery(req.params.deliveryId, req.apiClient), 202);
}));

module.exports = router;
