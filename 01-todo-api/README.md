# To-Do List REST API

**Week 2 · Assignment 1**: a RESTful API for managing tasks, built with Node.js, Express 5, MongoDB and Mongoose, and tested with Postman.

## Features

- Create, read, update (full `PUT` and partial `PATCH`) and delete tasks
- Filter by status and priority, sort, and paginate
- Input validation with clear, field-level error messages
- Consistent JSON responses and correct HTTP status codes
- Hardened with helmet, CORS, rate limiting, body-size limits and NoSQL-injection protection
- 25 automated tests and a Postman collection

## Endpoints

Base URL: `http://localhost:5000`

| Method | Endpoint | Description | Success |
|--------|----------|-------------|---------|
| `GET` | `/api/health` | Health check | `200` |
| `GET` | `/api/tasks` | List tasks (filter, sort, paginate) | `200` |
| `GET` | `/api/tasks/:id` | Get one task | `200` |
| `POST` | `/api/tasks` | Create a task | `201` |
| `PUT` | `/api/tasks/:id` | Replace a task (omitted fields reset to defaults) | `200` |
| `PATCH` | `/api/tasks/:id` | Update only the fields sent | `200` |
| `DELETE` | `/api/tasks/:id` | Delete a task | `204` |

### Query parameters for `GET /api/tasks`

| Param | Values | Default |
|-------|--------|---------|
| `completed` | `true` / `false` | all |
| `priority` | `low` / `medium` / `high` | all |
| `sort` | `createdAt`, `updatedAt`, `dueDate`, `title` (prefix `-` for descending) | `-createdAt` |
| `page` | integer ≥ 1 | `1` |
| `limit` | 1–100 | `20` |

Example: `GET /api/tasks?completed=false&priority=high&sort=dueDate&page=1&limit=10`

### Task fields

| Field | Type | Rules |
|-------|------|-------|
| `title` | string | **required**, 1–200 characters |
| `description` | string | optional, max 2000 characters, default `""` |
| `completed` | boolean | optional, default `false` |
| `priority` | string | `low` / `medium` / `high`, default `medium` |
| `dueDate` | ISO 8601 date or `null` | optional, e.g. `"2026-09-30"`; `null` clears it |

`_id`, `createdAt` and `updatedAt` are set by the server. Any other fields sent by the client are ignored.

## Examples

**Create a task**

```bash
curl -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Finish Week 2 assignment", "priority": "high", "dueDate": "2026-09-30"}'
```

```json
{
  "success": true,
  "data": {
    "_id": "66f1c2a9e4b0a1b2c3d4e5f6",
    "title": "Finish Week 2 assignment",
    "description": "",
    "completed": false,
    "priority": "high",
    "dueDate": "2026-09-30T00:00:00.000Z",
    "createdAt": "2026-09-10T07:00:00.000Z",
    "updatedAt": "2026-09-10T07:00:00.000Z"
  }
}
```

**Mark it as done**

```bash
curl -X PATCH http://localhost:5000/api/tasks/66f1c2a9e4b0a1b2c3d4e5f6 \
  -H "Content-Type: application/json" \
  -d '{"completed": true}'
```

**Validation error (`400`)**

```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "details": [
      { "field": "title", "message": "Title is required" },
      { "field": "priority", "message": "priority must be one of: low, medium, high" }
    ]
  }
}
```

## Setup

```bash
npm install
cp .env.example .env      # Windows (cmd): copy .env.example .env
npm run dev               # or: npm start
```

The API runs on http://localhost:5000.

### Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGO_URI` | MongoDB connection string (local or Atlas) | **required** |
| `PORT` | Port to listen on | `5000` |
| `NODE_ENV` | `development` / `production` | `development` |
| `CORS_ORIGIN` | Comma-separated allowed front-end origins | `http://localhost:5173` |
| `RATE_LIMIT_MAX` | Requests per IP per 15 minutes | `100` |
| `TRUST_PROXY` | `1` when behind a reverse proxy | `0` |

## Testing

**Automated tests.** Requires a running MongoDB; uses the `todo_api_test` database, or `MONGO_URI_TEST` if set.

```bash
npm test
```

They cover all CRUD operations, filters, sorting, pagination, validation, `404`/`400` handling, mass-assignment protection, NoSQL injection, malformed JSON, body-size limits, security headers and CORS.

**Postman.** Import `postman/todo-api.postman_collection.json` and run it top to bottom. The created task's id is saved to `{{taskId}}` automatically.

## Project structure

```
src/
├── config/env.js               loads and validates environment variables
├── config/db.js                MongoDB connection + global Mongoose security settings
├── models/Task.js              Mongoose schema
├── validators/taskValidators.js  request validation rules
├── controllers/taskController.js route handlers
├── routes/taskRoutes.js        /api/tasks routes
├── middleware/validate.js      turns validation errors into 400 responses
├── middleware/errorHandler.js  404 + central error handler
├── utils/HttpError.js          error class with an HTTP status
├── app.js                      Express app (middleware + routes)
└── server.js                   connects to MongoDB and starts the server
```

## Security notes

This API is **public** because the assignment doesn't require authentication. See [02-user-auth-api](../02-user-auth-api) and [03-notes-app-backend](../03-notes-app-backend) for JWT-protected routes. Full details are in [SECURITY.md](../SECURITY.md).
