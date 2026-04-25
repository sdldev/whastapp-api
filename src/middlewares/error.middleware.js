const { ZodError } = require('zod');
const { fail } = require('../utils/apiResponse');
const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');

function errorMiddleware(err, req, res, next) {
  if (err instanceof ZodError) {
    return fail(res, {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request payload',
      details: err.issues
    }, 400);
  }

  if (err instanceof AppError) {
    return fail(res, {
      code: err.code,
      message: err.message,
      details: err.details
    }, err.statusCode);
  }

  logger.error({ err, path: req.path, method: req.method }, 'Unhandled request error');

  return fail(res, {
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    details: null
  }, 500);
}

module.exports = errorMiddleware;
