const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { setupDB, clearDB, teardownDB } = require('./helpers');
const app = require('../src/app');

const api = request(app);
const createTask = (body) => api.post('/api/tasks').send(body);

before(setupDB);
beforeEach(clearDB);
after(teardownDB);

describe('Health & basics', () => {
  it('GET /api/health returns ok', async () => {
    const res = await api.get('/api/health').expect(200);
    assert.equal(res.body.data.status, 'ok');
  });

  it('unknown routes return a JSON 404', async () => {
    const res = await api.get('/api/nope').expect(404);
    assert.equal(res.body.success, false);
  });
});

describe('POST /api/tasks', () => {
  it('creates a task with sensible defaults', async () => {
    const res = await createTask({ title: '  Learn Express  ' }).expect(201);
    assert.equal(res.body.data.title, 'Learn Express');
    assert.equal(res.body.data.completed, false);
    assert.equal(res.body.data.priority, 'medium');
    assert.equal(res.body.data.dueDate, null);
    assert.match(res.headers.location, /^\/api\/tasks\/[a-f0-9]{24}$/);
  });

  it('accepts all optional fields', async () => {
    const res = await createTask({
      title: 'Submit assignment',
      description: 'Week 2',
      priority: 'high',
      completed: true,
      dueDate: '2026-09-30',
    }).expect(201);
    assert.equal(res.body.data.priority, 'high');
    assert.equal(res.body.data.completed, true);
    assert.equal(res.body.data.dueDate, '2026-09-30T00:00:00.000Z');
  });

  it('rejects a missing title with field details', async () => {
    const res = await createTask({ description: 'no title' }).expect(400);
    assert.equal(res.body.error.message, 'Validation failed');
    assert.equal(res.body.error.details[0].field, 'title');
  });

  it('rejects invalid field values', async () => {
    const res = await createTask({ title: 'x', priority: 'urgent', completed: 'yes', dueDate: 'tomorrow' }).expect(400);
    const fields = res.body.error.details.map((d) => d.field).sort();
    assert.deepEqual(fields, ['completed', 'dueDate', 'priority']);
  });

  it('rejects impossible calendar dates', async () => {
    await createTask({ title: 'x', dueDate: '2026-02-30' }).expect(400);
  });

  it('ignores fields that are not allowed (mass assignment)', async () => {
    const res = await createTask({ title: 'Safe', _id: '64b000000000000000000000', createdAt: '1999-01-01', isAdmin: true }).expect(201);
    assert.notEqual(res.body.data._id, '64b000000000000000000000');
    assert.notEqual(res.body.data.createdAt.slice(0, 4), '1999');
    assert.equal(res.body.data.isAdmin, undefined);
  });
});

describe('GET /api/tasks', () => {
  beforeEach(async () => {
    await createTask({ title: 'A', priority: 'low' });
    await createTask({ title: 'B', priority: 'high', completed: true });
    await createTask({ title: 'C', priority: 'high' });
  });

  it('lists tasks newest first with pagination info', async () => {
    const res = await api.get('/api/tasks').expect(200);
    assert.deepEqual(res.body.data.map((t) => t.title), ['C', 'B', 'A']);
    assert.deepEqual(res.body.pagination, { page: 1, limit: 20, total: 3, totalPages: 1 });
  });

  it('filters by completed and priority', async () => {
    const done = await api.get('/api/tasks?completed=true').expect(200);
    assert.deepEqual(done.body.data.map((t) => t.title), ['B']);
    const high = await api.get('/api/tasks?priority=high&completed=false').expect(200);
    assert.deepEqual(high.body.data.map((t) => t.title), ['C']);
  });

  it('paginates and sorts', async () => {
    const res = await api.get('/api/tasks?sort=title&limit=2&page=2').expect(200);
    assert.deepEqual(res.body.data.map((t) => t.title), ['C']);
    assert.equal(res.body.pagination.totalPages, 2);
  });

  it('rejects invalid query parameters', async () => {
    await api.get('/api/tasks?limit=1000').expect(400);
    await api.get('/api/tasks?sort=password').expect(400);
    await api.get('/api/tasks?page=1&page=2').expect(400);
  });
});

describe('GET /api/tasks/:id', () => {
  it('returns one task', async () => {
    const { body } = await createTask({ title: 'Find me' });
    const res = await api.get(`/api/tasks/${body.data._id}`).expect(200);
    assert.equal(res.body.data.title, 'Find me');
  });

  it('returns 400 for a malformed id and 404 for a missing one', async () => {
    await api.get('/api/tasks/not-an-id').expect(400);
    await api.get('/api/tasks/64b000000000000000000000').expect(404);
  });
});

describe('PATCH & PUT /api/tasks/:id', () => {
  it('PATCH updates only the given fields', async () => {
    const { body } = await createTask({ title: 'Patch me', description: 'keep' });
    const res = await api.patch(`/api/tasks/${body.data._id}`).send({ completed: true }).expect(200);
    assert.equal(res.body.data.completed, true);
    assert.equal(res.body.data.description, 'keep');
  });

  it('PATCH can clear the due date with null', async () => {
    const { body } = await createTask({ title: 'Due', dueDate: '2026-10-01' });
    const res = await api.patch(`/api/tasks/${body.data._id}`).send({ dueDate: null }).expect(200);
    assert.equal(res.body.data.dueDate, null);
  });

  it('PATCH with no valid fields returns 400', async () => {
    const { body } = await createTask({ title: 'Nothing' });
    await api.patch(`/api/tasks/${body.data._id}`).send({ foo: 'bar' }).expect(400);
  });

  it('PUT replaces all editable fields', async () => {
    const { body } = await createTask({ title: 'Old', description: 'old desc', priority: 'high' });
    const res = await api.put(`/api/tasks/${body.data._id}`).send({ title: 'New' }).expect(200);
    assert.equal(res.body.data.title, 'New');
    assert.equal(res.body.data.description, '');
    assert.equal(res.body.data.priority, 'medium');
  });

  it('PUT without a title returns 400', async () => {
    const { body } = await createTask({ title: 'Old' });
    await api.put(`/api/tasks/${body.data._id}`).send({ completed: true }).expect(400);
  });
});

describe('DELETE /api/tasks/:id', () => {
  it('deletes a task and returns 204', async () => {
    const { body } = await createTask({ title: 'Bye' });
    await api.delete(`/api/tasks/${body.data._id}`).expect(204);
    await api.get(`/api/tasks/${body.data._id}`).expect(404);
    await api.delete(`/api/tasks/${body.data._id}`).expect(404);
  });
});

describe('Security', () => {
  it('blocks NoSQL operator injection in the body', async () => {
    await createTask({ title: { $gt: '' } }).expect(400);
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await api.post('/api/tasks').set('Content-Type', 'application/json').send('{"title": ').expect(400);
    assert.equal(res.body.error.message, 'Malformed JSON in request body');
  });

  it('rejects bodies larger than 10kb with 413', async () => {
    await createTask({ title: 'big', description: 'x'.repeat(20_000) }).expect(413);
  });

  it('sends secure headers and hides X-Powered-By', async () => {
    const res = await api.get('/api/health');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.ok(res.headers['content-security-policy']);
    assert.equal(res.headers['x-powered-by'], undefined);
  });

  it('only allows CORS for configured origins', async () => {
    const allowed = await api.get('/api/health').set('Origin', 'http://localhost:5173');
    assert.equal(allowed.headers['access-control-allow-origin'], 'http://localhost:5173');
    const blocked = await api.get('/api/health').set('Origin', 'https://evil.example');
    assert.equal(blocked.headers['access-control-allow-origin'], undefined);
  });
});
