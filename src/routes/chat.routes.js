const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate.middleware');
const { success } = require('../utils/apiResponse');
const extended = require('../services/extended.service');
const { muteSchema, chatParamSchema, chatListSchema, chatSearchSchema } = require('../schemas/extended.schema');

const router = express.Router({ mergeParams: true });

router.get('/', validate(chatListSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.listChats(req.params.sessionId));
}));

router.post('/search', validate(chatSearchSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.searchChats(req.params.sessionId, req.body));
}));

router.get('/:chatId', validate(chatParamSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.getChat(req.params.sessionId, req.params.chatId));
}));

router.post('/:chatId/mute', validate(muteSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.muteChat(req.params.sessionId, req.params.chatId, req.body.until));
}));

router.post('/:chatId/unmute', validate(muteSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.unmuteChat(req.params.sessionId, req.params.chatId));
}));

router.post('/:chatId/archive', validate(chatParamSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.archiveChat(req.params.sessionId, req.params.chatId, true));
}));

router.post('/:chatId/unarchive', validate(chatParamSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.archiveChat(req.params.sessionId, req.params.chatId, false));
}));

router.post('/:chatId/pin', validate(chatParamSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.pinChat(req.params.sessionId, req.params.chatId, true));
}));

router.post('/:chatId/unpin', validate(chatParamSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.pinChat(req.params.sessionId, req.params.chatId, false));
}));

router.post('/:chatId/clear', validate(chatParamSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.clearChat(req.params.sessionId, req.params.chatId));
}));

router.delete('/:chatId', validate(chatParamSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.deleteChat(req.params.sessionId, req.params.chatId));
}));

module.exports = router;
