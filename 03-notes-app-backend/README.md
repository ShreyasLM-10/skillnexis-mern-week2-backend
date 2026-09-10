# Notes App Backend

**Week 2 · Mini Project**: the backend API for a note-taking app. It offers full CRUD on notes, secured with **JWT authentication**. Every user can only ever access their own notes.

## Features

- Register and log in (bcrypt + JWT), with the same auth layer as Assignment 2
- Create, read, update (`PUT` / `PATCH`) and delete notes; **all note routes require a JWT**
- Per-user data isolation: another user's note returns `404`
- Tags (normalised and de-duplicated), pinning (pinned notes are listed first), case-insensitive search, pagination and sorting
- Protected against IDOR, NoSQL injection, regex injection, mass assignment and brute-force login
- 38 automated tests and a Postman collection

## Endpoints

Base URL: `http://localhost:5002`

### Auth

| Method | Endpoint | Auth | Description | Success |
|--------|----------|------|-------------|---------|
| `POST` | `/api/auth/register` | – | Create an account, returns a JWT | `201` |
| `POST` | `/api/auth/login` | – | Log in, returns a JWT | `200` |
| `GET` | `/api/auth/me` | Bearer | Current user | `200` |

### Notes (all require `Authorization: Bearer <token>`)

| Method | Endpoint | Description | Success |
|--------|----------|-------------|---------|
| `GET` | `/api/notes` | List my notes (filter, search, paginate) | `200` |
| `GET` | `/api/notes/:id` | Get one of my notes | `200` |
| `POST` | `/api/notes` | Create a note | `201` |
| `PUT` | `/api/notes/:id` | Replace a note (omitted fields reset to defaults) | `200` |
| `PATCH` | `/api/notes/:id` | Update only the fields sent | `200` |
| `DELETE` | `/api/notes/:id` | Delete a note | `204` |

### Query parameters for `GET /api/notes`

| Param | Description | Default |
|-------|-------------|---------|
| `search` | Case-insensitive text search in title and content (max 100 characters) | – |
| `tag` | Only notes with this tag | – |
| `pinned` | `true` / `false` | all |
| `sort` | `updatedAt`, `createdAt`, `title` (prefix `-` for descending); pinned notes always come first | `-updatedAt` |
| `page` | integer ≥ 1 | `1` |
| `limit` | 1–100 | `20` |

Example: `GET /api/notes?search=jwt&tag=backend&page=1&limit=10`

### Note fields

| Field | Type | Rules |
|-------|------|-------|
| `title` | string | **required**, 1–200 characters |
| `content` | string | optional, max 20 000 characters |
| `tags` | string[] | optional, max 10 tags of 1–30 characters; lower-cased and de-duplicated |
| `pinned` | boolean | optional, default `false` |

`owner`, `_id`, `createdAt` and `updatedAt` are set by the server. `owner` can never be changed.

## Example flow

```bash
# 1. Register (or log in) and copy the token from the response
curl -X POST http://localhost:5002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Student", "email": "student@example.com", "password": "Str0ngPassw0rd"}'

# 2. Create a note
curl -X POST http://localhost:5002/api/notes \
  -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" \
  -d '{"title": "Week 2 learnings", "content": "Express routing, Mongoose, JWT", "tags": ["MERN", "backend"]}'
```

```json
{
  "success": true,
  "data": {
    "_id": "66f1c2a9e4b0a1b2c3d4e5f6",
    "owner": "66f1c1f0e4b0a1b2c3d4e5a1",
    "title": "Week 2 learnings",
    "content": "Express routing, Mongoose, JWT",
    "tags": ["mern", "backend"],
    "pinned": false,
    "createdAt": "2026-09-10T07:00:00.000Z",
    "updatedAt": "2026-09-10T07:00:00.000Z"
  }
}
```

```bash
# 3. Pin it
curl -X PATCH http://localhost:5002/api/notes/66f1c2a9e4b0a1b2c3d4e5f6 \
  -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" \
  -d '{"pinned": true}'

# 4. Search my notes
curl "http://localhost:5002/api/notes?search=jwt" -H "Authorization: Bearer <JWT>"

# 5. Delete it
curl -X DELETE http://localhost:5002/api/notes/66f1c2a9e4b0a1b2c3d4e5f6 -H "Authorization: Bearer <JWT>"
```

## How notes are kept private

Every database query includes the logged-in user's id, for example:

```js
Note.findOne({ _id: req.params.id, owner: req.user._id })
```

So if User B requests User A's note id, the query finds nothing and the API returns `404 Note not found`. It doesn't even reveal that the note exists. The same applies to update, replace and delete, and a tested scenario confirms it.

## Setup

```bash
npm install
cp .env.example .env      # Windows (cmd): copy .env.example .env
```

Set `JWT_SECRET` in `.env` (at least 32 characters):

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
| `JWT_EXPIRES_IN` | Token lifetime | `1h` |
| `BCRYPT_SALT_ROUNDS` | bcrypt cost factor | `12` |
| `PORT` | Port to listen on | `5002` |
| `NODE_ENV` | `development` / `production` | `development` |
| `CORS_ORIGIN` | Comma-separated allowed front-end origins | `http://localhost:5173` |
| `RATE_LIMIT_MAX` | Requests per IP per 15 minutes | `100` |
| `AUTH_RATE_LIMIT_MAX` | Failed register/login attempts per IP per 15 minutes | `10` |
| `TRUST_PROXY` | `1` when behind a reverse proxy | `0` |

## Testing

**Automated tests.** Requires a running MongoDB; uses the `notes_app_test` database, or `MONGO_URI_TEST` if set.

```bash
npm test
```

`tests/notes.test.js` (17 tests) covers auth on every notes route, CRUD, tag normalisation, filters, search, regex injection, pagination, IDOR protection, owner immutability and NoSQL injection. `tests/auth.test.js` (21 tests) covers the auth layer.

**Postman.** Import `postman/notes-app.postman_collection.json`. Run the **Auth** folder first (it saves `{{token}}`), then the **Notes** folder. Every notes request sends the token automatically through collection-level Bearer auth.

## Project structure

```
src/
├── config/                 env (fail-fast checks) + MongoDB connection
├── models/User.js          user schema + bcrypt hashing
├── models/Note.js          note schema (owner, title, content, tags, pinned)
├── utils/tokens.js         JWT sign / verify
├── middleware/auth.js      protect: verifies JWT, loads req.user
├── validators/             authValidators.js, noteValidators.js
├── controllers/            authController.js, noteController.js
├── routes/                 authRoutes.js, noteRoutes.js (router.use(protect))
├── middleware/validate.js, errorHandler.js, utils/HttpError.js
├── app.js
└── server.js
```

See [SECURITY.md](../SECURITY.md) for the full security review.
