const bcrypt = require('bcrypt');
const { matchedData } = require('express-validator');
const User = require('../models/User');
const HttpError = require('../utils/HttpError');
const { signToken } = require('../utils/tokens');
const config = require('../config/env');

const authResponse = (user) => ({
  user,
  token: signToken(user.id),
  tokenType: 'Bearer',
  expiresIn: config.jwt.expiresIn,
});

// When the email is unknown we still run one bcrypt comparison against this
// dummy hash, so "unknown email" and "wrong password" take the same time.
// This stops attackers from discovering registered emails by timing.
let dummyHashPromise;
const dummyHash = () => {
  dummyHashPromise ??= bcrypt.hash('timing-attack-dummy-password', config.bcryptSaltRounds);
  return dummyHashPromise;
};

// POST /api/auth/register
async function register(req, res) {
  const { name, email, password } = matchedData(req, { locations: ['body'] });

  if (await User.exists({ email })) {
    throw new HttpError(409, 'An account with this email already exists');
  }

  const user = await User.create({ name, email, password });
  res.status(201).json({ success: true, data: authResponse(user) });
}

// POST /api/auth/login
async function login(req, res) {
  const { email, password } = matchedData(req, { locations: ['body'] });

  const user = await User.findOne({ email }).select('+password');
  const passwordOk = user
    ? await user.comparePassword(password)
    : await bcrypt.compare(password, await dummyHash()).then(() => false);

  // Same message for both cases, so the response doesn't reveal which emails exist.
  if (!user || !passwordOk) throw new HttpError(401, 'Invalid email or password');

  res.json({ success: true, data: authResponse(user) });
}

// GET /api/auth/me  (protected)
function me(req, res) {
  res.json({ success: true, data: { user: req.user } });
}

module.exports = { register, login, me };
