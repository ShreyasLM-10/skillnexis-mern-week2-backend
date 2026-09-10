const path = require('node:path');

// Load variables from the project's .env file (if it exists).
// Variables that are already set in the real environment always win.
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

const toInt = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

const env = process.env.NODE_ENV || 'development';
const isProduction = env === 'production';

// --- Fail fast on insecure configuration -----------------------------------
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error(
    'JWT_SECRET must be set to a random string of at least 32 characters. Generate one with:\n' +
      '  node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"',
  );
}

const bcryptSaltRounds = toInt(process.env.BCRYPT_SALT_ROUNDS, 12);
if (isProduction && bcryptSaltRounds < 10) {
  throw new Error('BCRYPT_SALT_ROUNDS must be at least 10 in production.');
}

const config = Object.freeze({
  env,
  isProduction,
  isTest: env === 'test',
  port: toInt(process.env.PORT, 5002),
  mongoUri: process.env.MONGO_URI,
  jwt: Object.freeze({
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    issuer: 'notes-app-backend',
    audience: 'notes-app-backend:clients',
  }),
  bcryptSaltRounds,
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  trustProxy: toInt(process.env.TRUST_PROXY, 0),
  rateLimit: Object.freeze({
    windowMs: 15 * 60 * 1000,
    max: toInt(process.env.RATE_LIMIT_MAX, 100),
    authMax: toInt(process.env.AUTH_RATE_LIMIT_MAX, 10),
  }),
});

module.exports = config;
