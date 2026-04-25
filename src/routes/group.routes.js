const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate.middleware');
const { success } = require('../utils/apiResponse');
const extended = require('../services/extended.service');
const {
  groupParamsSchema,
  joinGroupSchema,
  createGroupSchema,
  inviteInfoSchema,
  groupPictureSchema,
  updateGroupInfoSchema,
  updateGroupSettingsSchema,
  participantsSchema,
  participantParamSchema,
  membershipRequestsActionSchema,
  mentionEveryoneSchema
} = require('../schemas/extended.schema');

const router = express.Router({ mergeParams: true });

router.post('/', validate(createGroupSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.createGroup(req.params.sessionId, req.body), 201);
}));

router.post('/join', validate(joinGroupSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.joinGroup(req.params.sessionId, req.body.inviteCodeOrUrl), 201);
}));

router.post('/invite-info', validate(inviteInfoSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.getInviteInfo(req.params.sessionId, req.body.inviteCodeOrUrl));
}));

router.get('/:groupId', validate(groupParamsSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.getGroup(req.params.sessionId, req.params.groupId));
}));

router.get('/:groupId/invite', validate(groupParamsSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.getInvite(req.params.sessionId, req.params.groupId));
}));

router.delete('/:groupId/invite', validate(groupParamsSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.revokeInvite(req.params.sessionId, req.params.groupId));
}));

router.post('/:groupId/leave', validate(groupParamsSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.leaveGroup(req.params.sessionId, req.params.groupId));
}));

router.put('/:groupId/picture', validate(groupPictureSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.setGroupPicture(req.params.sessionId, req.params.groupId, req.body));
}));

router.delete('/:groupId/picture', validate(groupParamsSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.deleteGroupPicture(req.params.sessionId, req.params.groupId));
}));

router.patch('/:groupId/info', validate(updateGroupInfoSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.updateGroupInfo(req.params.sessionId, req.params.groupId, req.body));
}));

router.patch('/:groupId/settings', validate(updateGroupSettingsSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.updateGroupSettings(req.params.sessionId, req.params.groupId, req.body));
}));

router.post('/:groupId/participants', validate(participantsSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.addParticipants(req.params.sessionId, req.params.groupId, req.body.participants));
}));

router.delete('/:groupId/participants/:participantId', validate(participantParamSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.removeParticipant(req.params.sessionId, req.params.groupId, req.params.participantId));
}));

router.post('/:groupId/participants/:participantId/promote', validate(participantParamSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.promoteParticipant(req.params.sessionId, req.params.groupId, req.params.participantId));
}));

router.post('/:groupId/participants/:participantId/demote', validate(participantParamSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.demoteParticipant(req.params.sessionId, req.params.groupId, req.params.participantId));
}));

router.get('/:groupId/membership-requests', validate(groupParamsSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.getMembershipRequests(req.params.sessionId, req.params.groupId));
}));

router.post('/:groupId/membership-requests/approve', validate(membershipRequestsActionSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.approveMembershipRequests(req.params.sessionId, req.params.groupId, req.body.requesterIds));
}));

router.post('/:groupId/membership-requests/reject', validate(membershipRequestsActionSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.rejectMembershipRequests(req.params.sessionId, req.params.groupId, req.body.requesterIds));
}));

router.post('/:groupId/mention-everyone', validate(mentionEveryoneSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.mentionEveryone(req.params.sessionId, req.params.groupId, req.body), 201);
}));

module.exports = router;
