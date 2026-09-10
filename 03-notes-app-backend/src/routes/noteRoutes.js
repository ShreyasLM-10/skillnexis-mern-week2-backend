const { Router } = require('express');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const rules = require('../validators/noteValidators');
const notes = require('../controllers/noteController');

const router = Router();

// Every notes route requires a valid JWT.
router.use(protect);

router
  .route('/')
  .get(rules.listQuery, validate, notes.listNotes)
  .post(rules.createNote, validate, notes.createNote);

router
  .route('/:id')
  .get(rules.idParam, validate, notes.getNote)
  .put(rules.idParam, rules.replaceNote, validate, notes.replaceNote)
  .patch(rules.idParam, rules.updateNote, validate, notes.updateNote)
  .delete(rules.idParam, validate, notes.deleteNote);

module.exports = router;
