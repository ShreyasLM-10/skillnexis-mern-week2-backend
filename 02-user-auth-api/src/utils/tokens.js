const jwt = require('jsonwebtoken');
const config = require('../config/env');

const { secret, expiresIn, issuer, audience } = config.jwt;

/** Create a signed access token whose subject is the user's id. */
function signToken(userId) {
  return jwt.sign({}, secret, {
    algorithm: 'HS256',
    subject: String(userId),
    expiresIn,
    issuer,
    audience,
  });
}

/**
 * Verify a token. Pinning `algorithms` blocks the classic "alg: none" and
 * algorithm-confusion attacks; issuer/audience stop tokens minted for another
 * app (with the same secret) from being accepted.
 */
function verifyToken(token) {
  return jwt.verify(token, secret, { algorithms: ['HS256'], issuer, audience });
}

module.exports = { signToken, verifyToken };
