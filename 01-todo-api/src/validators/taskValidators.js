const { body, param, query } = require('express-validator');
const { PRIORITIES } = require('../models/Task');

// Allowed values for ?sort=  (a leading "-" means descending)
const SORT_OPTIONS = Object.freeze([
  'createdAt', '-createdAt', 'updatedAt', '-updatedAt', 'dueDate', '-dueDate', 'title', '-title',
]);

// A query-string value must appear once (?page=1&page=2 becomes an array).
const singleQuery = (name) =>
  query(name)
    .optional()
    .custom((value) => typeof value === 'string')
    .withMessage(`${name} must be a single value`)
    .bail();

const idParam = [param('id').isMongoId().withMessage('Invalid task id')];

const listQuery = [
  singleQuery('completed').isIn(['true', 'false']).withMessage('completed must be true or false'),
  singleQuery('priority').isIn(PRIORITIES).withMessage(`priority must be one of: ${PRIORITIES.join(', ')}`),
  singleQuery('page').isInt({ min: 1, max: 100_000 }).withMessage('page must be a positive integer'),
  singleQuery('limit').isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
  singleQuery('sort').isIn(SORT_OPTIONS).withMessage(`sort must be one of: ${SORT_OPTIONS.join(', ')}`),
];

/**
 * Body rules for a task. `partial: true` (PATCH) makes every field optional;
 * otherwise (POST / PUT) the title is required.
 *
 * Only fields listed here ever reach the database (controllers use
 * matchedData), so clients cannot set _id, createdAt, etc. (mass assignment).
 */
const taskBody = ({ partial }) => [
  (partial ? body('title').optional() : body('title').exists().withMessage('Title is required'))
    .isString().withMessage('Title must be a string').bail()
    .trim()
    .notEmpty().withMessage('Title cannot be empty')
    .isLength({ max: 200 }).withMessage('Title must be at most 200 characters'),
  body('description')
    .optional()
    .isString().withMessage('Description must be a string').bail()
    .trim()
    .isLength({ max: 2000 }).withMessage('Description must be at most 2000 characters'),
  body('completed')
    .optional()
    .custom((value) => typeof value === 'boolean')
    .withMessage('completed must be true or false'),
  body('priority')
    .optional()
    .isIn(PRIORITIES)
    .withMessage(`priority must be one of: ${PRIORITIES.join(', ')}`),
  body('dueDate')
    .optional({ values: 'null' }) // null is allowed and clears the due date
    .isISO8601({ strict: true, strictSeparator: true })
    .withMessage('dueDate must be a valid ISO 8601 date (e.g. 2026-09-30) or null')
    .toDate(),
];

module.exports = {
  SORT_OPTIONS,
  idParam,
  listQuery,
  createTask: taskBody({ partial: false }),
  replaceTask: taskBody({ partial: false }),
  updateTask: taskBody({ partial: true }),
};
