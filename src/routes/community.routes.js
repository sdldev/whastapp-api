const express = require('express');
const { fail } = require('../utils/apiResponse');

const router = express.Router({ mergeParams: true });

router.use((req, res) => fail(res, {
  code: 'FEATURE_NOT_READY',
  message: 'Communities are not implemented yet',
  details: null
}, 501));

module.exports = router;
