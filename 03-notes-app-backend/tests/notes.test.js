const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const { setupDB, clearDB, teardownDB } = require('./helpers');
const app = require('../src/app');
const config = require('../src/config/env');

const api = request(app);

async function signUp(name, email) {
  const res = await api.post('/api/auth/register').send({ name, email, password: 'Str0ngPassw0rd' }).expect(201);
  return { token: res.body.data.token, id: res.body.data.user._id };
}

// Small helper: authenticated request as a given user
const as = (user) => ({
  get: (url) => api.get(url).set('Authorization', `Bearer ${user.token}`),
  post: (url, body) => api.post(url).set('Authorization', `Bearer ${user.token}`).send(body),
  put: (url, body) => api.put(url).set('Authorization', `Bearer ${user.token}`).send(body),
  patch: (url, body) => api.patch(url).set('Authorization', `Bearer ${user.token}`).send(body),
  delete: (url) => api.delete(url).set('Authorization', `Bearer ${user.token}`),
});

let alice;
let bob;

before(setupDB);
beforeEach(async () => {
  await clearDB();
  alice = await signUp('Alice', 'alice@example.com');
  bob = await signUp('Bob', 'bob@example.com');
});
after(teardownDB);

describe('Authentication on /api/notes', () => {
  it('rejects requests without a token (401)', async () => {
    await api.get('/api/notes').expect(401);
    await api.post('/api/notes').send({ title: 'x' }).expect(401);
  });

  it('rejects invalid, forged and expired tokens', async () => {
    await api.get('/api/notes').set('Authorization', 'Bearer abc.def.ghi').expect(401);
    const forged = jwt.sign({}, 'attacker-secret-attacker-secret-attacker', {
      subject: alice.id, issuer: config.jwt.issuer, audience: config.jwt.audience,
    });
    await api.get('/api/notes').set('Authorization', `Bearer ${forged}`).expect(401);
    const expired = jwt.sign({ exp: Math.floor(Date.now() / 1000) - 1 }, config.jwt.secret, {
      subject: alice.id, issuer: config.jwt.issuer, audience: config.jwt.audience,
    });
    const res = await api.get('/api/notes').set('Authorization', `Bearer ${expired}`).expect(401);
    assert.equal(res.body.error.message, 'Token has expired');
  });

  it('login returns a token that works on notes routes', async () => {
    const res = await api.post('/api/auth/login').send({ email: 'alice@example.com', password: 'Str0ngPassw0rd' }).expect(200);
    await api.get('/api/notes').set('Authorization', `Bearer ${res.body.data.token}`).expect(200);
  });
});

describe('Notes CRUD', () => {
  it('creates a note owned by the current user', async () => {
    const res = await as(alice).post('/api/notes', { title: 'First note', content: 'Hello', tags: ['Work', 'work', ' Ideas '] }).expect(201);
    assert.equal(res.body.data.title, 'First note');
    assert.equal(res.body.data.owner, alice.id);
    assert.deepEqual(res.body.data.tags, ['work', 'ideas']); // normalised + de-duplicated
    assert.equal(res.body.data.pinned, false);
  });

  it('validates the note body', async () => {
    const res = await as(alice).post('/api/notes', { content: 'no title', tags: 'not-an-array', pinned: 'yes' }).expect(400);
    const fields = res.body.error.details.map((d) => d.field).sort();
    assert.deepEqual(fields, ['pinned', 'tags', 'title']);
    await as(alice).post('/api/notes', { title: 'x', tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }).expect(400);
  });

  it('reads a single note', async () => {
    const { body } = await as(alice).post('/api/notes', { title: 'Read me' });
    const res = await as(alice).get(`/api/notes/${body.data._id}`).expect(200);
    assert.equal(res.body.data.title, 'Read me');
    await as(alice).get('/api/notes/bad-id').expect(400);
  });

  it('PATCH updates only the sent fields', async () => {
    const { body } = await as(alice).post('/api/notes', { title: 'Draft', content: 'keep me' });
    const res = await as(alice).patch(`/api/notes/${body.data._id}`, { pinned: true }).expect(200);
    assert.equal(res.body.data.pinned, true);
    assert.equal(res.body.data.content, 'keep me');
    await as(alice).patch(`/api/notes/${body.data._id}`, {}).expect(400);
  });

  it('PUT replaces all editable fields', async () => {
    const { body } = await as(alice).post('/api/notes', { title: 'Old', content: 'old', tags: ['a'], pinned: true });
    const res = await as(alice).put(`/api/notes/${body.data._id}`, { title: 'New' }).expect(200);
    assert.equal(res.body.data.title, 'New');
    assert.equal(res.body.data.content, '');
    assert.deepEqual(res.body.data.tags, []);
    assert.equal(res.body.data.pinned, false);
  });

  it('DELETE removes a note', async () => {
    const { body } = await as(alice).post('/api/notes', { title: 'Temp' });
    await as(alice).delete(`/api/notes/${body.data._id}`).expect(204);
    await as(alice).get(`/api/notes/${body.data._id}`).expect(404);
  });
});

describe('Listing, filtering and search', () => {
  beforeEach(async () => {
    await as(alice).post('/api/notes', { title: 'Shopping list', content: 'milk, eggs', tags: ['home'] });
    await as(alice).post('/api/notes', { title: 'Sprint plan', content: 'Build notes API (v1.0)', tags: ['work'], pinned: true });
    await as(alice).post('/api/notes', { title: 'Ideas', content: 'side project', tags: ['work', 'ideas'] });
    await as(bob).post('/api/notes', { title: "Bob's secret", content: 'milk' });
  });

  it('lists only the current user\'s notes, pinned first', async () => {
    const res = await as(alice).get('/api/notes').expect(200);
    assert.deepEqual(res.body.data.map((n) => n.title), ['Sprint plan', 'Ideas', 'Shopping list']);
    assert.equal(res.body.pagination.total, 3);
  });

  it('filters by tag and pinned', async () => {
    const work = await as(alice).get('/api/notes?tag=WORK').expect(200);
    assert.equal(work.body.data.length, 2);
    const pinned = await as(alice).get('/api/notes?pinned=true').expect(200);
    assert.deepEqual(pinned.body.data.map((n) => n.title), ['Sprint plan']);
  });

  it('searches title and content case-insensitively', async () => {
    const res = await as(alice).get('/api/notes?search=MILK').expect(200);
    assert.deepEqual(res.body.data.map((n) => n.title), ['Shopping list']); // not Bob's
  });

  it('treats search input literally (no regex injection)', async () => {
    const dot = await as(alice).get('/api/notes?search=.*').expect(200);
    assert.equal(dot.body.data.length, 0);
    const parens = await as(alice).get(`/api/notes?search=${encodeURIComponent('(v1.0)')}`).expect(200);
    assert.deepEqual(parens.body.data.map((n) => n.title), ['Sprint plan']);
    await as(alice).get(`/api/notes?search=${encodeURIComponent('(a+)+$')}`).expect(200);
  });

  it('paginates and validates query params', async () => {
    const res = await as(alice).get('/api/notes?limit=1&page=2&sort=title').expect(200);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.pagination.totalPages, 3);
    await as(alice).get('/api/notes?limit=0').expect(400);
    await as(alice).get('/api/notes?sort=owner').expect(400);
  });
});

describe('Access control (IDOR protection)', () => {
  let aliceNoteId;
  beforeEach(async () => {
    const res = await as(alice).post('/api/notes', { title: 'Alice private', content: 'secret' });
    aliceNoteId = res.body.data._id;
  });

  it('another user cannot read, update, replace or delete it (404)', async () => {
    await as(bob).get(`/api/notes/${aliceNoteId}`).expect(404);
    await as(bob).patch(`/api/notes/${aliceNoteId}`, { title: 'hacked' }).expect(404);
    await as(bob).put(`/api/notes/${aliceNoteId}`, { title: 'hacked' }).expect(404);
    await as(bob).delete(`/api/notes/${aliceNoteId}`).expect(404);

    const res = await as(alice).get(`/api/notes/${aliceNoteId}`).expect(200);
    assert.equal(res.body.data.title, 'Alice private');
  });

  it('owner cannot be changed through the request body', async () => {
    const created = await as(bob).post('/api/notes', { title: 'Sneaky', owner: alice.id }).expect(201);
    assert.equal(created.body.data.owner, bob.id);
    const patched = await as(alice).patch(`/api/notes/${aliceNoteId}`, { title: 'Mine', owner: bob.id }).expect(200);
    assert.equal(patched.body.data.owner, alice.id);
  });

  it('blocks NoSQL operator injection in bodies and queries', async () => {
    await as(alice).post('/api/notes', { title: { $ne: null } }).expect(400);
    await as(alice).post('/api/notes', { title: 'ok', tags: [{ $gt: '' }] }).expect(400);
    // Express 5's default "simple" query parser does not build nested objects,
    // so tag[$ne]=x is just an unknown literal key and is ignored (never an operator).
    const res = await as(alice).get('/api/notes?tag[$ne]=x').expect(200);
    assert.deepEqual(res.body.data.map((n) => n.owner), [alice.id]);
  });
});
