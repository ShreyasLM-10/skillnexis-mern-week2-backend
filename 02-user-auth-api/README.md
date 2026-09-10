# User Authentication API

**Week 2 · Assignment 2**: user registration and login with **bcrypt** password hashing and **JWT**-based authentication, built with Node.js, Express 5, MongoDB and Mongoose.

## Features

- `POST /register` and `POST /login` return a signed JWT
- Passwords hashed with bcrypt (cost 12); the hash is never returned by the API
- A protected route (`GET /me`) guarded by JWT middleware
- Password strength rules; email normalisation (trimmed, lower-case, unique)
- Hardened against NoSQL injection, JWT forgery (`alg: none`, wrong secret or audience), user enumeration and brute-force login
- 21 automated tests and a Postman collection

## Endpoints

Base URL: `http://localhost:5001`

| Method | Endpoint | Auth | Description | Success |
|--------|----------|------|-------------|---------|
| `GET` | `/api/health` | – | Health check | `200` |
| `POST` | `/api/auth/register` | – | Create an account, returns a JWT | `201` |
| `POST` | `/api/auth/login` | – | Log in, returns a JWT | `200` |
| `GET` | `/api/auth/me` | **Bearer JWT** | Get the logged-in user | `200` |

### Validation rules

| Field | Rules |
|-------|-------|
| `name` | required, 2–50 characters |
| `email` | required, valid email, unique (case-insensitive) |
| `password` | required, 8–72 bytes, at least one letter and one number |

## How authentication works

```
1. Client ──POST /api/auth/register or /login──▶ API
2. API: validate input → bcrypt hash / compare → sign JWT { sub: userId, exp, iss, aud }
3. API ──{ user, token }──▶ Client (stores the token)
4. Client ──GET /api/auth/me   Authorization: Bearer <token>──▶ API
5. protect middleware: verify signature (HS256 only), expiry, issuer, audience
   → load user from DB → req.user → route handler
```

## Examples

**Register**

```bash
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Student", "email": "student@example.com", "password": "Str0ngPassw0rd"}'
```

```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "66f1c2a9e4b0a1b2c3d4e5f6",
      "name": "Test Student",
      "email": "student@example.com",
      "createdAt": "2026-09-10T07:00:00.000Z",
      "updatedAt": "2026-09-10T07:00:00.000Z"
    },
    "token": "<JWT>",
    "tokenType": "Bearer",
    "expiresIn": "1h"
  }
}
```

**Login.** Same response shape, status `200`:

```bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "student@example.com", "password": "Str0ngPassw0rd"}'
```

**Call the protected route**

```bash
curl http://localhost:5001/api/auth/me -H "Authorization: Bearer <JWT>"
```

### Error responses

| Status | When | Message |
|--------|------|---------|
| `400` | Invalid input | `Validation failed` + field details |
| `401` | Wrong email **or** password | `Invalid email or password` (same for both, on purpose) |
| `401` | No / bad / expired token | `Authentication required` / `Invalid token` / `Token has expired` |
| `409` | Email already registered | `An account with this email already exists` |
| `429` | 10 failed register/login attempts in 15 minutes | `Too many attempts, please try again in 15 minutes.` |

## Setup

```bash
npm install
cp .env.example .env      # Windows (cmd): copy .env.example .env
```

Open `.env` and set `JWT_SECRET`. The server won't start without a secret of at least 32 characters. Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Then run:

```bash
npm run dev
```

### Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGO_URI` | MongoDB connection string | **required** |
| `JWT_SECRET` | Secret for signing tokens (≥ 32 characters) | **required** |
| `JWT_EXPIRES_IN` | Token lifetime (`15m`, `1h`, `7d`, ...) | `1h` |
| `BCRYPT_SALT_ROUNDS` | bcrypt cost factor (≥ 10 in production) | `12` |
| `PORT` | Port to listen on | `5001` |
| `NODE_ENV` | `development` / `production` | `development` |
| `CORS_ORIGIN` | Comma-separated allowed front-end origins | `http://localhost:5173` |
| `RATE_LIMIT_MAX` | Requests per IP per 15 minutes (all routes) | `100` |
| `AUTH_RATE_LIMIT_MAX` | Failed register/login attempts per IP per 15 minutes | `10` |
| `TRUST_PROXY` | `1` when behind a reverse proxy | `0` |

## Testing

**Automated tests.** Requires a running MongoDB; uses the `auth_api_test` database, or `MONGO_URI_TEST` if set.

```bash
npm test
```

They cover registration, login, the protected route, password hashing in the database, duplicate emails, password rules, mass assignment, NoSQL injection, and tampered, forged, `alg: none`, wrong-audience, expired and deleted-user tokens.

**Postman.** Import `postman/user-auth-api.postman_collection.json`. **Register** creates a unique email each run and saves the JWT to `{{token}}`, which the protected request uses automatically.

## Project structure

```
src/
├── config/env.js               env variables + fail-fast checks (JWT secret, bcrypt cost)
├── config/db.js                MongoDB connection + Mongoose security settings
├── models/User.js              schema, bcrypt pre-save hook, comparePassword()
├── utils/tokens.js             signToken() / verifyToken()
├── middleware/auth.js          protect: verifies JWT, loads req.user
├── validators/authValidators.js  register/login validation rules
├── controllers/authController.js register, login, me
├── routes/authRoutes.js        /api/auth routes + brute-force rate limiter
├── middleware/validate.js, errorHandler.js, utils/HttpError.js
├── app.js
└── server.js
```

See [SECURITY.md](../SECURITY.md) for the full security review.
