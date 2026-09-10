const { validationResult } = require('express-validator');
const HttpError = require('../utils/HttpError');

/**
 * Runs after express-validator rule chains. If any rule failed, it forwards a
 * 400 error listing every invalid field (first error per field only).
 */
function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const details = result
    .array({ onlyFirstError: true })
    .map((err) => ({ field: err.path, message: err.msg }));

  return next(new HttpError(400, 'Validation failed', details));
}

module.exports = validate;
