const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate.middleware');
const { success } = require('../utils/apiResponse');
const extended = require('../services/extended.service');
const { pollSchema, votePollSchema } = require('../schemas/extended.schema');

const router = express.Router({ mergeParams: true });

router.post('/', validate(pollSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.createPoll(req.params.sessionId, req.body), 201);
}));

router.post('/:pollMessageId/vote', validate(votePollSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.votePoll(req.params.sessionId, req.params.pollMessageId, req.body.selectedOptions));
}));

module.exports = router;
