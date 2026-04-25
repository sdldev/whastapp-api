const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate.middleware');
const { success } = require('../utils/apiResponse');
const extended = require('../services/extended.service');
const {
  channelParamSchema,
  channelListSchema,
  channelSearchSchema,
  channelMessageSchema,
  channelFetchMessagesSchema,
  channelInfoSchema,
  channelPictureSchema,
  channelReactionSettingSchema,
  channelUserSchema,
  channelSubscribersSchema
} = require('../schemas/extended.schema');

const router = express.Router({ mergeParams: true });

router.get('/', validate(channelListSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.listChannels(req.params.sessionId));
}));

router.post('/search', validate(channelSearchSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.searchChannels(req.params.sessionId, req.body));
}));

router.get('/:channelId', validate(channelParamSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.getChannel(req.params.sessionId, req.params.channelId));
}));

router.post('/:channelId/messages', validate(channelMessageSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.sendChannelMessage(req.params.sessionId, req.params.channelId, req.body), 201);
}));

router.get('/:channelId/messages', validate(channelFetchMessagesSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.fetchChannelMessages(req.params.sessionId, req.params.channelId, {
    searchOptions: req.body.searchOptions,
    limit: req.query.limit
  }));
}));

router.post('/:channelId/seen', validate(channelParamSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.sendChannelSeen(req.params.sessionId, req.params.channelId));
}));

router.post('/:channelId/mute', validate(channelParamSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.muteChannel(req.params.sessionId, req.params.channelId, true));
}));

router.post('/:channelId/unmute', validate(channelParamSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.muteChannel(req.params.sessionId, req.params.channelId, false));
}));

router.patch('/:channelId/info', validate(channelInfoSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.updateChannelInfo(req.params.sessionId, req.params.channelId, req.body));
}));

router.put('/:channelId/picture', validate(channelPictureSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.setChannelPicture(req.params.sessionId, req.params.channelId, req.body));
}));

router.patch('/:channelId/reaction-setting', validate(channelReactionSettingSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.setChannelReactionSetting(req.params.sessionId, req.params.channelId, req.body.reactionCode));
}));

router.post('/:channelId/admin-invites/accept', validate(channelParamSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.acceptChannelAdminInvite(req.params.sessionId, req.params.channelId));
}));

router.post('/:channelId/admin-invites/:userId', validate(channelUserSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.sendChannelAdminInvite(req.params.sessionId, req.params.channelId, req.params.userId, req.body.options), 201);
}));

router.delete('/:channelId/admin-invites/:userId', validate(channelUserSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.revokeChannelAdminInvite(req.params.sessionId, req.params.channelId, req.params.userId));
}));

router.post('/:channelId/ownership/transfer/:userId', validate(channelUserSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.transferChannelOwnership(req.params.sessionId, req.params.channelId, req.params.userId, req.body.options));
}));

router.post('/:channelId/admins/:userId/demote', validate(channelUserSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.demoteChannelAdmin(req.params.sessionId, req.params.channelId, req.params.userId));
}));

router.get('/:channelId/subscribers', validate(channelSubscribersSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.getChannelSubscribers(req.params.sessionId, req.params.channelId, req.query.limit || req.body.limit));
}));

router.delete('/:channelId', validate(channelParamSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.deleteChannel(req.params.sessionId, req.params.channelId));
}));

module.exports = router;
