const path = require('node:path');

// Load variables from the project's .env file (if it exists).
// Variables that are already set in the real environment always win.
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

const toInt = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

const env = process.env.NODE_ENV || 'development';

const config = Object.freeze({
  env,
  isProduction: env === 'production',
  isTest: env === 'test',
  port: toInt(process.env.PORT, 5000),
  mongoUri: process.env.MONGO_URI,
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  trustProxy: toInt(process.env.TRUST_PROXY, 0),
  rateLimit: Object.freeze({
    windowMs: 15 * 60 * 1000,
    max: toInt(process.env.RATE_LIMIT_MAX, 100),
  }),
});

module.exports = config;
