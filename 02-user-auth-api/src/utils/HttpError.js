/**
 * An error that carries an HTTP status code (and optional field-level details).
 * Throw it from any controller or middleware; the central error handler turns
 * it into a JSON response.
 */
class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

module.exports = HttpError;
