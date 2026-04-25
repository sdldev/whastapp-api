const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate.middleware');
const { success } = require('../utils/apiResponse');
const extended = require('../services/extended.service');
const { locationSchema } = require('../schemas/extended.schema');

const router = express.Router({ mergeParams: true });

router.post('/', validate(locationSchema), asyncHandler(async (req, res) => {
  return success(res, await extended.sendLocation(req.params.sessionId, req.body), 201);
}));

module.exports = router;
