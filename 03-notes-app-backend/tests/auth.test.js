const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const { setupDB, clearDB, teardownDB } = require('./helpers');
const app = require('../src/app');
const User = require('../src/models/User');
const config = require('../src/config/env');

const api = request(app);
const alice = { name: 'Alice', email: 'alice@example.com', password: 'Str0ngPassw0rd' };

const register = (body = alice) => api.post('/api/auth/register').send(body);
const login = (body) => api.post('/api/auth/login').send(body);
const me = (token) => api.get('/api/auth/me').set('Authorization', `Bearer ${token}`);

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

before(setupDB);
beforeEach(clearDB);
after(teardownDB);

describe('POST /api/auth/register', () => {
  it('creates a user and returns a JWT', async () => {
    const res = await register().expect(201);
    const { user, token, tokenType } = res.body.data;
    assert.equal(user.email, 'alice@example.com');
    assert.equal(user.name, 'Alice');
    assert.equal(tokenType, 'Bearer');
    assert.equal(jwt.decode(token).sub, user._id);
  });

  it('never returns the password or its hash', async () => {
    const res = await register().expect(201);
    assert.equal(res.body.data.user.password, undefined);
    assert.ok(!JSON.stringify(res.body).includes(alice.password));
  });

  it('stores a bcrypt hash, not the plain password', async () => {
    await register().expect(201);
    const stored = await User.findOne({ email: alice.email }).select('+password').lean();
    assert.notEqual(stored.password, alice.password);
    assert.match(stored.password, /^\$2[aby]\$\d{2}\$/);
  });

  it('normalises email and rejects duplicates case-insensitively (409)', async () => {
    await register({ ...alice, email: '  Alice@Example.COM ' }).expect(201);
    const res = await register().expect(409);
    assert.equal(res.body.error.message, 'An account with this email already exists');
  });

  it('validates name, email and password strength', async () => {
    const res = await register({ name: 'A', email: 'not-an-email', password: 'short' }).expect(400);
    const fields = res.body.error.details.map((d) => d.field).sort();
    assert.deepEqual(fields, ['email', 'name', 'password']);
    await register({ ...alice, password: 'onlyletters' }).expect(400);
    await register({ ...alice, password: '12345678' }).expect(400);
    await register({ ...alice, password: `a1${'x'.repeat(80)}` }).expect(400); // > 72 bytes
  });

  it('ignores extra fields such as role (mass assignment)', async () => {
    const res = await register({ ...alice, role: 'admin', _id: '64b000000000000000000000' }).expect(201);
    assert.equal(res.body.data.user.role, undefined);
    assert.notEqual(res.body.data.user._id, '64b000000000000000000000');
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => register());

  it('returns a token for valid credentials', async () => {
    const res = await login({ email: 'ALICE@example.com', password: alice.password }).expect(200);
    assert.ok(res.body.data.token);
    assert.equal(res.body.data.user.password, undefined);
  });

  it('uses the same 401 message for wrong password and unknown email', async () => {
    const wrong = await login({ email: alice.email, password: 'WrongPassw0rd' }).expect(401);
    const unknown = await login({ email: 'nobody@example.com', password: 'WrongPassw0rd' }).expect(401);
    assert.equal(wrong.body.error.message, 'Invalid email or password');
    assert.equal(unknown.body.error.message, wrong.body.error.message);
  });

  it('blocks NoSQL injection attempts', async () => {
    await login({ email: { $ne: null }, password: { $ne: null } }).expect(400);
    await login({ email: alice.email, password: { $gt: '' } }).expect(400);
  });

  it('requires email and password', async () => {
    await login({}).expect(400);
  });
});

describe('GET /api/auth/me (protected route)', () => {
  let token;
  let userId;
  beforeEach(async () => {
    const res = await register();
    ({ token } = res.body.data);
    userId = res.body.data.user._id;
  });

  it('returns the current user with a valid token', async () => {
    const res = await me(token).expect(200);
    assert.equal(res.body.data.user.email, alice.email);
    assert.equal(res.body.data.user.password, undefined);
  });

  it('returns 401 with WWW-Authenticate when no token is sent', async () => {
    const res = await api.get('/api/auth/me').expect(401);
    assert.equal(res.headers['www-authenticate'], 'Bearer');
  });

  it('rejects a malformed Authorization header', async () => {
    await api.get('/api/auth/me').set('Authorization', token).expect(401); // missing "Bearer"
    await api.get('/api/auth/me').set('Authorization', 'Bearer not.a.jwt!').expect(401);
  });

  it('rejects a tampered token', async () => {
    const [header, , signature] = token.split('.');
    const forgedPayload = b64url({ ...jwt.decode(token), sub: '64b000000000000000000000' });
    await me(`${header}.${forgedPayload}.${signature}`).expect(401);
  });

  it('rejects tokens signed with another secret', async () => {
    const forged = jwt.sign({}, 'attacker-secret-attacker-secret-attacker', {
      subject: userId, issuer: config.jwt.issuer, audience: config.jwt.audience,
    });
    await me(forged).expect(401);
  });

  it('rejects "alg: none" tokens', async () => {
    const payload = { sub: userId, iss: config.jwt.issuer, aud: config.jwt.audience, exp: Math.floor(Date.now() / 1000) + 3600 };
    await me(`${b64url({ alg: 'none', typ: 'JWT' })}.${b64url(payload)}.`).expect(401);
  });

  it('rejects tokens with the wrong audience', async () => {
    const other = jwt.sign({}, config.jwt.secret, { subject: userId, issuer: config.jwt.issuer, audience: 'other-app' });
    await me(other).expect(401);
  });

  it('rejects expired tokens', async () => {
    const expired = jwt.sign(
      { exp: Math.floor(Date.now() / 1000) - 60 },
      config.jwt.secret,
      { subject: userId, issuer: config.jwt.issuer, audience: config.jwt.audience },
    );
    const res = await me(expired).expect(401);
    assert.equal(res.body.error.message, 'Token has expired');
  });

  it('rejects tokens of users that were deleted', async () => {
    await User.deleteOne({ _id: userId });
    await me(token).expect(401);
  });
});

describe('App hardening', () => {
  it('sends secure headers and hides X-Powered-By', async () => {
    const res = await api.get('/api/health').expect(200);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-powered-by'], undefined);
  });

  it('rejects bodies over 100kb (413)', async () => {
    await register({ ...alice, name: 'x'.repeat(200_000) }).expect(413);
  });
});
