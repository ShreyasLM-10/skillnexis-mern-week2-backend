const { Router } = require('express');
const validate = require('../middleware/validate');
const rules = require('../validators/taskValidators');
const tasks = require('../controllers/taskController');

// Express 5 forwards errors thrown in async handlers to the error middleware,
// so no try/catch or asyncHandler wrapper is needed.
const router = Router();

router
  .route('/')
  .get(rules.listQuery, validate, tasks.listTasks)
  .post(rules.createTask, validate, tasks.createTask);

router
  .route('/:id')
  .get(rules.idParam, validate, tasks.getTask)
  .put(rules.idParam, rules.replaceTask, validate, tasks.replaceTask)
  .patch(rules.idParam, rules.updateTask, validate, tasks.updateTask)
  .delete(rules.idParam, validate, tasks.deleteTask);

module.exports = router;
