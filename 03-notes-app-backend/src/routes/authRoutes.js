const { Router } = require('express');
const { rateLimit } = require('express-rate-limit');
const config = require('../config/env');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const rules = require('../validators/authValidators');
const auth = require('../controllers/authController');

// Brute-force protection: only FAILED register/login attempts count.
const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.authMax,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => config.isTest,
  message: { success: false, error: { message: 'Too many attempts, please try again in 15 minutes.' } },
});

const router = Router();

router.post('/register', authLimiter, rules.register, validate, auth.register);
router.post('/login', authLimiter, rules.login, validate, auth.login);
router.get('/me', protect, auth.me);

module.exports = router;
