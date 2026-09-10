# Week 2 – Backend Development (Node.js, Express.js, MongoDB)

Assignments and mini project for **Week 2** of the **Full Stack Web Development (MERN)** internship at **Skill Nexis**.

Topics covered: Node.js & NPM · Express.js routing · MongoDB & Mongoose · REST API design · Authentication with JWT and bcrypt.

| # | Project | Task | Port | Highlights |
|---|---------|------|------|------------|
| 1 | [**To-Do List REST API**](./01-todo-api) | Assignment 1 | `5000` | Full CRUD (GET/POST/PUT/PATCH/DELETE), filtering, sorting, pagination, validation |
| 2 | [**User Authentication API**](./02-user-auth-api) | Assignment 2 | `5001` | Register & login, bcrypt password hashing, JWT, protected route, brute-force protection |
| 3 | [**Notes App Backend**](./03-notes-app-backend) | Mini Project | `5002` | JWT-secured notes CRUD, per-user data isolation, tags, pinning, search, pagination |

Each project is **self-contained** (own `package.json`, tests, Postman collection and README), so it can be run and graded on its own.

## Tech stack

- **Runtime:** Node.js 22+
- **Framework:** Express 5 (async errors handled natively)
- **Database:** MongoDB with Mongoose 9
- **Auth:** bcrypt (password hashing) + jsonwebtoken (JWT)
- **Validation:** express-validator
- **Security:** helmet, cors, express-rate-limit, Mongoose `sanitizeFilter`
- **Testing:** Node's built-in test runner + supertest, Postman collections
- **Tooling:** ESLint + eslint-plugin-security, gitleaks, GitHub Actions, Dependabot

## Repository structure

```
.
├── 01-todo-api/              Assignment 1 - To-Do List REST API
├── 02-user-auth-api/         Assignment 2 - User Authentication API
├── 03-notes-app-backend/     Mini Project - Notes App Backend
│   ├── src/
│   │   ├── config/           env loading & MongoDB connection
│   │   ├── controllers/      request handlers (business logic)
│   │   ├── middleware/       auth, validation, error handling
│   │   ├── models/           Mongoose schemas
│   │   ├── routes/           Express routers
│   │   ├── utils/            helpers (HttpError, JWT)
│   │   ├── validators/       express-validator rules
│   │   ├── app.js            Express app (exported for tests)
│   │   └── server.js         connects to MongoDB and starts listening
│   ├── tests/                automated API tests
│   ├── postman/              Postman collection
│   ├── .env.example          template for environment variables
│   └── README.md
├── scripts/
│   ├── run-all.js            install / test every project at once
│   ├── security-check.js     pre-push security check
│   └── spawn-npm.js          runs npm safely (no shell) for the scripts above
├── .github/                  CI workflow + Dependabot
├── eslint.config.js
├── SECURITY.md               security review report
└── README.md
```

(The three projects share the same layout.)

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) **22 or newer** (`node -v`)
- MongoDB: either [MongoDB Community Server](https://www.mongodb.com/try/download/community) running locally, or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster
- [Postman](https://www.postman.com/downloads/) (for manual API testing)

### Install

```bash
git clone https://github.com/ShreyasLM-10/skillnexis-mern-week2-backend.git
cd skillnexis-mern-week2-backend
npm install        # root dev tools (ESLint, security plugin)
npm run setup      # installs dependencies of all three projects
```

### Run a project

```bash
cd 01-todo-api                 # or 02-user-auth-api / 03-notes-app-backend
cp .env.example .env           # Windows (cmd): copy .env.example .env
npm run dev                    # auto-restarts on file changes
```

For projects 2 and 3 you **must** set `JWT_SECRET` in `.env` (at least 32 characters). Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Testing

### Automated tests

The tests need a running MongoDB. They use `mongodb://127.0.0.1:27017/<project>_test` by default; override it with the `MONGO_URI_TEST` environment variable. As a safety net, tests refuse to run unless the database name ends in `_test`, because they wipe the test data.

```bash
npm run test:all        # from the repo root: all three projects
# or inside one project:
npm test
```

| Project | Tests |
|---------|-------|
| To-Do API | 25 |
| Auth API | 21 |
| Notes App | 38 (17 notes + 21 auth) |
| **Total** | **84** |

### Postman

Each project has a ready-made collection in its `postman/` folder:

1. Start the project (`npm run dev`).
2. In Postman: **Import** → select `postman/*.postman_collection.json`.
3. Run requests top-to-bottom, or use **Run collection**. IDs and JWTs are saved into collection variables automatically, and every request includes test assertions.

## API conventions

All responses are JSON with a consistent shape:

```jsonc
// success
{ "success": true, "data": { ... } }
// list endpoints also include
{ "success": true, "data": [ ... ], "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 } }
// error
{ "success": false, "error": { "message": "Validation failed", "details": [ { "field": "title", "message": "Title is required" } ] } }
```

| Status | Meaning |
|--------|---------|
| `200` / `201` / `204` | OK / Created / Deleted (no content) |
| `400` | Validation failed, malformed JSON or invalid id |
| `401` | Missing, invalid or expired token; wrong credentials |
| `404` | Resource or route not found |
| `409` | Email already registered |
| `413` | Request body too large |
| `429` | Rate limit exceeded |

## Security

All projects were reviewed before publishing. Results and the full list of protections are in **[SECURITY.md](./SECURITY.md)**.

Re-run the checks any time (especially before pushing):

```bash
npm run security
```

It verifies that no `.env` files are tracked by git, scans for leaked credentials, runs `npm audit` on every project, runs ESLint with the security plugin and, if installed, runs [gitleaks](https://github.com/gitleaks/gitleaks) over the git history.

## Author

**Shreyas** — B.Tech Computer Science & Engineering, DKTE's Textile and Engineering Institute  
Full Stack Developer Intern (MERN Stack), Skill Nexis

## License

MIT
