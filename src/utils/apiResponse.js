function meta(extra = {}) {
  return {
    timestamp: new Date().toISOString(),
    ...extra
  };
}

function success(res, data = null, statusCode = 200, extraMeta = {}) {
  return res.status(statusCode).json({
    success: true,
    data,
    meta: meta(extraMeta)
  });
}

function fail(res, error, statusCode = 500, extraMeta = {}) {
  return res.status(statusCode).json({
    success: false,
    error,
    meta: meta(extraMeta)
  });
}

module.exports = {
  success,
  fail
};
