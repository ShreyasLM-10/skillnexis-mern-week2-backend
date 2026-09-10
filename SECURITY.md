# Security Review

This document records the security review done on all three Week 2 projects before publishing the repository, and the protections built into the code.

**Review date:** 10 September 2026  
**Scope:** `01-todo-api`, `02-user-auth-api`, `03-notes-app-backend`, repository configuration

## 1. Checks performed and results

| Check | Tool | Result |
|-------|------|--------|
| Known vulnerable dependencies | `npm audit` (all 3 projects + root dev tools) | **0 vulnerabilities** |
| Static code analysis | ESLint + `eslint-plugin-security` | **0 problems** (1 finding fixed, see below) |
| Secrets in files / git history | gitleaks v8.30.1 + custom scan in `scripts/security-check.js` | **No leaks found** |
| Git hygiene | `.gitignore` check, `git ls-files` | No `.env` files or `node_modules` tracked |
| Automated security tests | Node test runner + supertest | **84/84 tests pass** (incl. the attack cases in section 3) |
| End-to-end API tests | Postman collections run with Newman against live servers | **38 requests, 50 assertions, 0 failures** |
| Brute-force protection | Live test: repeated failed logins | Blocked with `429 Too Many Requests` + `Retry-After` after 10 failures |
| Insecure configuration | Start server with a weak `JWT_SECRET` | Server refuses to start |

### Findings fixed during the review

1. **Potentially unsafe regular expression (ReDoS)** in the To-Do API's due-date validator (flagged by `security/detect-unsafe-regex`). Replaced the hand-written regex with express-validator's strict `isISO8601`, which is linear-time and also rejects impossible dates such as `2026-02-30`.
2. **Optional fields could be overwritten with `undefined`** when handling explicit `null` values in `PUT`/`PATCH` requests. Fixed by dropping absent fields before updating, and covered by tests.

### Note on the test database

In the review environment, automated tests ran against [FerretDB](https://www.ferretdb.com/), a MongoDB-wire-compatible server. The GitHub Actions workflow (`.github/workflows/ci.yml`) runs the same tests against **MongoDB 8** on every push.

## 2. Protections in place

| Threat | Mitigation | Where |
|--------|-----------|-------|
| **NoSQL injection** (e.g. `{"email": {"$ne": null}}`) | Type checks on every input (`isString`, `isMongoId`, ...); Mongoose `sanitizeFilter` wraps user objects containing `$` keys in `$eq`; Express 5's simple query parser never builds nested objects | `validators/`, `config/db.js` |
| **Mass assignment** (client sets `_id`, `owner`, `role`, ...) | Controllers only use `matchedData()`, which returns validated, whitelisted fields; `owner` is `immutable` | `controllers/`, `models/Note.js` |
| **Broken access control / IDOR** | Every notes query is scoped with `owner: req.user._id`; other users' notes return `404` (existence is not revealed) | `controllers/noteController.js` |
| **Password theft** | bcrypt hashing (cost 12, configurable, minimum 10 in production); hash is `select: false` and stripped from JSON output | `models/User.js` |
| **bcrypt 72-byte truncation** | Passwords longer than 72 bytes are rejected instead of silently truncated | `validators/authValidators.js` |
| **Weak passwords** | Minimum 8 characters, at least one letter and one number | `validators/authValidators.js` |
| **User enumeration** | Same `401` message for unknown email and wrong password; dummy bcrypt comparison keeps response time equal | `controllers/authController.js` |
| **Brute-force login** | Only failed register/login attempts are counted: 10 per IP per 15 minutes | `routes/authRoutes.js` |
| **JWT forgery** | Algorithm pinned to HS256 (blocks `alg: none` and algorithm confusion); issuer and audience are verified; tokens expire (default 1h) | `utils/tokens.js` |
| **Tokens of deleted users** | The user is loaded from the database on every authenticated request | `middleware/auth.js` |
| **Weak or missing JWT secret** | Server refuses to start unless `JWT_SECRET` is at least 32 characters | `config/env.js` |
| **Regex injection / ReDoS in search** | Search input is escaped and matched literally; max 100 characters | `controllers/noteController.js` |
| **Denial of service** | JSON body size limits (10 kb, or 100 kb for notes); pagination `limit` capped at 100; global rate limit of 100 requests per 15 minutes | `app.js`, validators |
| **Information leakage** | Central error handler: no stack traces in responses, generic `500` message in production, connection string never logged | `middleware/errorHandler.js`, `server.js` |
| **Insecure HTTP headers** | `helmet` (CSP, `nosniff`, HSTS, frame protection, removes `X-Powered-By`) | `app.js` |
| **Cross-origin abuse** | CORS allowed only for origins listed in `CORS_ORIGIN` | `app.js` |
| **Secrets in the repository** | `.env*` ignored (only `.env.example` with empty/placeholder values is committed); gitleaks in CI; `npm run security` before pushing | `.gitignore`, CI |
| **Vulnerable dependencies over time** | Lockfiles committed; `npm audit` in CI; Dependabot opens update PRs monthly | `.github/` |
| **Accidental npm publish** | `"private": true` in every `package.json` | `package.json` |
| **Tests wiping real data** | Tests refuse to run unless the database name ends in `_test` | `tests/helpers.js` |

## 3. Attack cases covered by automated tests

- NoSQL operator injection in login, task and note bodies
- Tampered payload, wrong-secret signature, `alg: none`, wrong audience and expired JWTs
- Missing or malformed `Authorization` header (returns `401` with `WWW-Authenticate`)
- Token belonging to a deleted user
- User B reading, updating, replacing or deleting User A's note
- Changing a note's `owner`, or setting `_id` / `createdAt` / `role` through the body
- Regex metacharacters in search (`.*`, `(a+)+$`)
- Oversized request bodies, malformed JSON, duplicated query parameters
- Password hash never appearing in any response; stored password is a bcrypt hash
- Security headers present, `X-Powered-By` absent, CORS restricted

## 4. Known limitations (out of scope for Week 2)

- **The To-Do API is public by design.** Assignment 1 doesn't include authentication. Projects 2 and 3 show how to add it.
- **No token revocation or refresh tokens.** A JWT stays valid until it expires (default 1 hour). Logging out means discarding the token on the client.
- **No email verification or password reset.**
- **Registration reveals whether an email exists** (`409 Conflict`). This is a common UX trade-off. The login endpoint does not reveal it.
- **The rate limiter uses in-memory storage.** Limits are per server process and reset on restart. A multi-instance deployment should use a shared store such as Redis.
- **Where the front-end stores tokens** (Week 3+): prefer memory or httpOnly cookies over `localStorage`, to limit exposure to XSS.

## 5. Deployment checklist

- [ ] `NODE_ENV=production`
- [ ] A new random `JWT_SECRET` (64+ characters), different from development
- [ ] HTTPS only (provided by the hosting platform)
- [ ] `TRUST_PROXY=1` when behind one reverse proxy (Render, Railway, ...), so rate limiting sees real client IPs
- [ ] `CORS_ORIGIN` set to the real front-end URL only
- [ ] MongoDB Atlas: a database user with access to this database only, a strong password, and a restricted network access list
- [ ] Secrets set in the platform's environment settings, never in code

## Reporting a vulnerability

This is a learning project. If you notice a security issue, please open a GitHub issue (without including exploit details for anything deployed) or contact the author directly.
