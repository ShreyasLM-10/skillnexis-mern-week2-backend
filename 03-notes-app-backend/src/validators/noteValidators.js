const { body, param, query } = require('express-validator');
const { LIMITS } = require('../models/Note');

const SORT_OPTIONS = Object.freeze(['updatedAt', '-updatedAt', 'createdAt', '-createdAt', 'title', '-title']);

// A query-string value must appear once (?page=1&page=2 becomes an array).
const singleQuery = (name) =>
  query(name)
    .optional()
    .custom((value) => typeof value === 'string')
    .withMessage(`${name} must be a single value`)
    .bail();

const idParam = [param('id').isMongoId().withMessage('Invalid note id')];

const listQuery = [
  singleQuery('page').isInt({ min: 1, max: 100_000 }).withMessage('page must be a positive integer'),
  singleQuery('limit').isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
  singleQuery('sort').isIn(SORT_OPTIONS).withMessage(`sort must be one of: ${SORT_OPTIONS.join(', ')}`),
  singleQuery('pinned').isIn(['true', 'false']).withMessage('pinned must be true or false'),
  singleQuery('tag').trim().toLowerCase().isLength({ min: 1, max: LIMITS.tagLength }).withMessage('Invalid tag'),
  singleQuery('search').trim().isLength({ min: 1, max: 100 }).withMessage('search must be 1-100 characters'),
];

/**
 * Body rules. `partial: true` (PATCH) makes every field optional.
 * Controllers only use matchedData(), so fields like owner/_id/createdAt
 * sent by a client are ignored (mass-assignment protection).
 */
const noteBody = ({ partial }) => [
  (partial ? body('title').optional() : body('title').exists().withMessage('Title is required'))
    .isString().withMessage('Title must be a string').bail()
    .trim()
    .notEmpty().withMessage('Title cannot be empty')
    .isLength({ max: LIMITS.title }).withMessage(`Title must be at most ${LIMITS.title} characters`),
  body('content')
    .optional()
    .isString().withMessage('Content must be a string').bail()
    .trim()
    .isLength({ max: LIMITS.content }).withMessage(`Content must be at most ${LIMITS.content} characters`),
  body('tags')
    .optional()
    .isArray({ max: LIMITS.tags }).withMessage(`tags must be an array of at most ${LIMITS.tags} strings`),
  body('tags.*')
    .isString().withMessage('Each tag must be a string').bail()
    .trim()
    .toLowerCase()
    .isLength({ min: 1, max: LIMITS.tagLength }).withMessage(`Each tag must be 1-${LIMITS.tagLength} characters`),
  body('pinned')
    .optional()
    .custom((value) => typeof value === 'boolean')
    .withMessage('pinned must be true or false'),
];

module.exports = {
  SORT_OPTIONS,
  idParam,
  listQuery,
  createNote: noteBody({ partial: false }),
  replaceNote: noteBody({ partial: false }),
  updateNote: noteBody({ partial: true }),
};
