const { body } = require('express-validator');

const email = body('email')
  .exists().withMessage('Email is required').bail()
  .isString().withMessage('Email must be a string').bail()
  .trim()
  .toLowerCase()
  .isEmail().withMessage('Enter a valid email address')
  .isLength({ max: 254 }).withMessage('Email is too long');

const register = [
  body('name')
    .exists().withMessage('Name is required').bail()
    .isString().withMessage('Name must be a string').bail()
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
  email,
  body('password')
    .exists().withMessage('Password is required').bail()
    .isString().withMessage('Password must be a string').bail()
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters').bail()
    // bcrypt only uses the first 72 BYTES of a password - reject longer ones
    // instead of silently ignoring the extra characters.
    .custom((value) => Buffer.byteLength(value, 'utf8') <= 72).withMessage('Password must be at most 72 bytes').bail()
    .matches(/[A-Za-z]/).withMessage('Password must contain at least one letter')
    .matches(/\d/).withMessage('Password must contain at least one number'),
];

const login = [
  email,
  body('password')
    .exists().withMessage('Password is required').bail()
    .isString().withMessage('Password must be a string').bail()
    .isLength({ min: 1, max: 128 }).withMessage('Password is required'),
];

module.exports = { register, login };
