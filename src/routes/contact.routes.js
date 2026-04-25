const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate.middleware');
const { success } = require('../utils/apiResponse');
const contactService = require('../services/contact.service');
const {
  contactListSchema,
  contactParamSchema,
  contactCardSchema,
  numberLookupSchema,
  profileTextSchema,
  profilePictureSchema
} = require('../schemas/common.schema');

const router = express.Router({ mergeParams: true });

router.get('/', validate(contactListSchema), asyncHandler(async (req, res) => {
  return success(res, await contactService.listContacts(req.params.sessionId));
}));

router.post('/card', validate(contactCardSchema), asyncHandler(async (req, res) => {
  return success(res, await contactService.sendContactCard(req.params.sessionId, req.body), 201);
}));

router.post('/check-registered', validate(numberLookupSchema), asyncHandler(async (req, res) => {
  return success(res, await contactService.checkRegistered(req.params.sessionId, req.body.number));
}));

router.post('/number-id', validate(numberLookupSchema), asyncHandler(async (req, res) => {
  return success(res, await contactService.getNumberId(req.params.sessionId, req.body.number));
}));

router.post('/formatted-number', validate(numberLookupSchema), asyncHandler(async (req, res) => {
  return success(res, await contactService.getFormattedNumber(req.params.sessionId, req.body.number));
}));

router.post('/country-code', validate(numberLookupSchema), asyncHandler(async (req, res) => {
  return success(res, await contactService.getCountryCode(req.params.sessionId, req.body.number));
}));

router.patch('/profile/display-name', validate(profileTextSchema), asyncHandler(async (req, res) => {
  return success(res, await contactService.setDisplayName(req.params.sessionId, req.body.value));
}));

router.patch('/profile/status', validate(profileTextSchema), asyncHandler(async (req, res) => {
  return success(res, await contactService.setStatus(req.params.sessionId, req.body.value));
}));

router.put('/profile/picture', validate(profilePictureSchema), asyncHandler(async (req, res) => {
  return success(res, await contactService.setProfilePicture(req.params.sessionId, req.body));
}));

router.delete('/profile/picture', validate(contactListSchema), asyncHandler(async (req, res) => {
  return success(res, await contactService.deleteProfilePicture(req.params.sessionId));
}));

router.get('/:contactId/about', validate(contactParamSchema), asyncHandler(async (req, res) => {
  return success(res, await contactService.getAbout(req.params.sessionId, req.params.contactId));
}));

router.get('/:contactId/common-groups', validate(contactParamSchema), asyncHandler(async (req, res) => {
  return success(res, await contactService.getCommonGroups(req.params.sessionId, req.params.contactId));
}));

router.get('/:contactId', validate(contactParamSchema), asyncHandler(async (req, res) => {
  return success(res, await contactService.getContact(req.params.sessionId, req.params.contactId));
}));

router.get('/:contactId/profile-picture', validate(contactParamSchema), asyncHandler(async (req, res) => {
  return success(res, await contactService.getProfilePicture(req.params.sessionId, req.params.contactId));
}));

router.post('/:contactId/block', validate(contactParamSchema), asyncHandler(async (req, res) => {
  return success(res, await contactService.block(req.params.sessionId, req.params.contactId));
}));

router.post('/:contactId/unblock', validate(contactParamSchema), asyncHandler(async (req, res) => {
  return success(res, await contactService.unblock(req.params.sessionId, req.params.contactId));
}));

module.exports = router;
