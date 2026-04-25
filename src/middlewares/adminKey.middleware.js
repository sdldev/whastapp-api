const env = require('../config/env');
const { AppError } = require('../utils/errors');
const { auditMiddleware } = require('../services/auditLog.service');

function adminKeyMiddleware(req, res, next) {
  if (!env.adminApiKey) {
    return next(new AppError('Admin API key is not configured', 503, 'ADMIN_API_KEY_NOT_CONFIGURED'));
  }

  const providedKey = req.get('x-admin-key');
  if (providedKey && providedKey === env.adminApiKey) {
    req.authMode = 'admin';
    return auditMiddleware(req, res, next);
  }

  return next(new AppError('Invalid or missing admin API key', 401, 'INVALID_ADMIN_API_KEY'));
}

module.exports = adminKeyMiddleware;
