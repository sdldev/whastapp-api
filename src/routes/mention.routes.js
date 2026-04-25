const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate.middleware');
const { success } = require('../utils/apiResponse');
const mentionService = require('../services/mention.service');
const { userMentionsSchema, groupMentionsSchema } = require('../schemas/mention.schema');

const router = express.Router({ mergeParams: true });

router.post('/users', validate(userMentionsSchema), asyncHandler(async (req, res) => {
  return success(res, await mentionService.mentionUsers(req.params.sessionId, req.body), 201);
}));

router.post('/groups', validate(groupMentionsSchema), asyncHandler(async (req, res) => {
  return success(res, await mentionService.mentionGroups(req.params.sessionId, req.body), 201);
}));

module.exports = router;
