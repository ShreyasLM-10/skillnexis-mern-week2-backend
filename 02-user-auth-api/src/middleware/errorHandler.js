const mongoose = require('mongoose');
const config = require('../config/env');
const HttpError = require('../utils/HttpError');

function notFound(req, res, next) {
  next(new HttpError(404, 'Route not found'));
}

// Express recognises error handlers by their 4 arguments, so `next` must stay.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = 500;
  let message = 'Internal Server Error';
  let details;

  if (err instanceof HttpError) {
    ({ status, message, details } = err);
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON in request body';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request body is too large';
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid value for "${err.path}"`;
  } else if (err.code === 11000) {
    status = 409;
    message = 'Resource already exists';
  } else if (Number.isInteger(err.status) && err.status >= 400 && err.status < 500 && err.expose) {
    // Other client errors raised by Express / body-parser (e.g. 415)
    status = err.status;
    message = err.message;
  }

  if (status >= 500) {
    // Log the full error on the server, but never leak internals to the client.
    console.error(err);
    if (!config.isProduction && err.message) message = err.message;
  }

  res.status(status).json({
    success: false,
    error: { message, ...(details && { details }) },
  });
}

module.exports = { notFound, errorHandler };
