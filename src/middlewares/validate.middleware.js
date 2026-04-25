function validate(schema) {
  return function validateRequest(req, res, next) {
    const result = schema.safeParse({
      params: req.params,
      query: req.query,
      body: req.body
    });

    if (!result.success) return next(result.error);

    req.validated = result.data;
    return next();
  };
}

module.exports = validate;
