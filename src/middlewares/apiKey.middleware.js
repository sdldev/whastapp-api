const env = require('../config/env');
const { AppError } = require('../utils/errors');
const apiClientService = require('../services/apiClient.service');
const { auditMiddleware } = require('../services/auditLog.service');

function extractSessionId(req) {
  if (req.params && req.params.sessionId) return req.params.sessionId;
  const match = req.path.match(/^\/sessions\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function applyRateLimitHeaders(res, rateLimit) {
  if (!rateLimit || !rateLimit.limit) return;
  res.set('X-RateLimit-Limit', String(rateLimit.limit));
  res.set('X-RateLimit-Remaining', String(rateLimit.remaining));
  res.set('X-RateLimit-Reset', rateLimit.resetAt);
}

function auditAfterResponse(req, res) {
  res.on('finish', () => {
    if (!req.apiClient) return;

    apiClientService.appendUsageLog({
      clientId: req.apiClient.id,
      apiKeyId: req.apiKey ? req.apiKey.id : null,
      sessionId: extractSessionId(req),
      method: req.method,
      path: req.originalUrl || req.path,
      statusCode: res.statusCode,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
      scopeUsed: req.requiredScope || null,
      requestId: req.get('x-request-id') || null
    });
  });
}

function apiKeyMiddleware(req, res, next) {
  const providedKey = req.get('x-api-key');

  if (!providedKey && !env.apiKey) {
    req.authMode = 'anonymous';
    return auditMiddleware(req, res, next);
  }

  if (env.apiKey && providedKey === env.apiKey) {
    req.authMode = 'legacy';
    return auditMiddleware(req, res, next);
  }

  try {
    const auth = apiClientService.authenticateApiKey(providedKey);
    const requiredScope = apiClientService.getRequiredScope(req.method, req.path);
    const sessionId = extractSessionId(req);

    apiClientService.authorizeScope(auth.client, requiredScope);
    apiClientService.authorizeSession(auth.client, sessionId);

    const rateLimit = apiClientService.checkRateLimit(auth.client);
    applyRateLimitHeaders(res, rateLimit);

    req.authMode = 'api-client';
    req.apiClient = auth.client;
    req.apiKey = auth.key;
    req.requiredScope = requiredScope;
    req.rateLimit = rateLimit;

    auditAfterResponse(req, res);
    return auditMiddleware(req, res, next);
  } catch (error) {
    if (error instanceof AppError) return next(error);
    return next(new AppError('Invalid or missing API key', 401, 'INVALID_API_KEY'));
  }
}

module.exports = apiKeyMiddleware;
