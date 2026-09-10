const mongoose = require('mongoose');
const User = require('../models/User');
const HttpError = require('../utils/HttpError');
const { verifyToken } = require('../utils/tokens');

const BEARER = /^Bearer\s+([A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]*)$/i;

function unauthorized(res, message, invalidToken = false) {
  res.set('WWW-Authenticate', invalidToken ? 'Bearer error="invalid_token"' : 'Bearer');
  return new HttpError(401, message);
}

/**
 * Protects a route: requires "Authorization: Bearer <JWT>", verifies it and
 * loads the user. On success `req.user` holds the user document.
 */
async function protect(req, res, next) {
  const match = BEARER.exec(req.get('authorization') || '');
  if (!match) throw unauthorized(res, 'Authentication required');

  let payload;
  try {
    payload = verifyToken(match[1]);
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token has expired' : 'Invalid token';
    throw unauthorized(res, message, true);
  }

  // The account may have been deleted after the token was issued.
  const user = mongoose.isValidObjectId(payload.sub) ? await User.findById(payload.sub) : null;
  if (!user) throw unauthorized(res, 'Invalid token', true);

  req.user = user;
  next();
}

module.exports = { protect };
