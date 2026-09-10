const { matchedData } = require('express-validator');
const Task = require('../models/Task');
const HttpError = require('../utils/HttpError');

// Values used when a PUT request omits an optional field (full replacement).
const TASK_DEFAULTS = Object.freeze({
  description: '',
  completed: false,
  priority: 'medium',
  dueDate: null,
});

/**
 * Only validated fields are returned (mass-assignment protection).
 * includeOptionals keeps an explicit `dueDate: null`; fields the client did
 * not send come back as undefined and are dropped.
 */
const bodyData = (req) =>
  Object.fromEntries(
    Object.entries(matchedData(req, { locations: ['body'], includeOptionals: true }))
      .filter(([, value]) => value !== undefined),
  );

const parseSort = (sort = '-createdAt') => {
  const direction = sort.startsWith('-') ? -1 : 1;
  const field = sort.replace(/^-/, '');
  return { [field]: direction, _id: direction };
};

// GET /api/tasks?completed=&priority=&page=&limit=&sort=
async function listTasks(req, res) {
  const q = matchedData(req, { locations: ['query'] });
  const page = Number(q.page) || 1;
  const limit = Number(q.limit) || 20;

  const filter = {};
  if (q.completed !== undefined) filter.completed = q.completed === 'true';
  if (q.priority !== undefined) filter.priority = q.priority;

  const [tasks, total] = await Promise.all([
    Task.find(filter)
      .sort(parseSort(q.sort))
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Task.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: tasks,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

// GET /api/tasks/:id
async function getTask(req, res) {
  const task = await Task.findById(req.params.id).lean();
  if (!task) throw new HttpError(404, 'Task not found');
  res.json({ success: true, data: task });
}

// POST /api/tasks
async function createTask(req, res) {
  const task = await Task.create(bodyData(req));
  res.status(201).location(`/api/tasks/${task.id}`).json({ success: true, data: task });
}

// PATCH /api/tasks/:id  - update only the fields that were sent
async function updateTask(req, res) {
  const updates = bodyData(req);
  if (Object.keys(updates).length === 0) {
    throw new HttpError(400, 'Provide at least one field to update: title, description, completed, priority, dueDate');
  }

  const task = await Task.findByIdAndUpdate(
    req.params.id,
    { $set: updates },
    { returnDocument: 'after', runValidators: true },
  ).lean();

  if (!task) throw new HttpError(404, 'Task not found');
  res.json({ success: true, data: task });
}

// PUT /api/tasks/:id  - replace all editable fields (omitted ones reset to defaults)
async function replaceTask(req, res) {
  const replacement = { ...TASK_DEFAULTS, ...bodyData(req) };

  const task = await Task.findByIdAndUpdate(
    req.params.id,
    { $set: replacement },
    { returnDocument: 'after', runValidators: true },
  ).lean();

  if (!task) throw new HttpError(404, 'Task not found');
  res.json({ success: true, data: task });
}

// DELETE /api/tasks/:id
async function deleteTask(req, res) {
  const task = await Task.findByIdAndDelete(req.params.id).lean();
  if (!task) throw new HttpError(404, 'Task not found');
  res.status(204).end();
}

module.exports = { listTasks, getTask, createTask, updateTask, replaceTask, deleteTask };
