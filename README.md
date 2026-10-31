# CommonGround Server

Backend for **CommonGround** — a Bangladesh-focused community volunteering event platform.

Built with Node.js, Express 5, TypeScript, the MongoDB native driver, helmet, cors, and JWT support for future protected APIs.

The frontend is a separate Next.js app (`commonground-client`) deployed at
<https://commonground-client-tau.vercel.app/>; both origins are allowed by CORS.

## Stack

| Concern | Choice |
| --- | --- |
| Runtime | Node.js >= 20 (ESM) |
| Framework | Express 5 |
| Language | TypeScript (strict, `tsc` 7) |
| Database | MongoDB via the official native driver |
| Config | `dotenv` |
| Security | `helmet`, allow-list CORS, JWT for future protected routes |
| Validation | `zod` schemas through a reusable `validate()` middleware |
| Tests | `vitest` + `supertest` |

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
copy .env.example .env      # Windows PowerShell: cp .env.example .env
# then edit .env with your real values

# 3. Develop
npm run dev                 # tsx watch with auto-reload

# 4. Production
npm run build               # compile TypeScript to dist/
npm start                   # node dist/server.js

# 5. Tests
npm test                    # vitest (no MongoDB required — the service layer is mocked)
```

## Environment variables

| Variable | Required | Default (dev) | Description |
| --- | --- | --- | --- |
| `PORT` | no | `5000` | Port the Express server listens on. |
| `MONGODB_URI` | yes | `mongodb://127.0.0.1:27017` | MongoDB connection string (local or Atlas). |
| `DB_NAME` | no | `commonground` | Database name. |
| `CLIENT_URL` | no | `http://localhost:3000` | Comma-separated list of frontend origins allowed by CORS. Includes the deployed Vercel URL. |
| `JWT_SECRET` | yes (for future protected APIs) | dev-only placeholder | Long random string used to sign JWTs. |

`.env` and `.env.local` are gitignored — **never commit real secrets**. Use `.env.example` as the template.

## Project structure

```text
src/
├── app.ts                    # Express app factory: helmet, cors, routes, error handling
├── server.ts                 # Bootstrap, MongoDB connect, graceful shutdown
├── config/
│   ├── env.ts                # dotenv loading + zod-validated environment config
│   └── db.ts                 # Reusable MongoDB connection handling (native driver)
├── routes/
│   ├── index.ts              # Mounts all routers under /api
│   ├── health.routes.ts      # GET /api/health
│   └── opportunity.routes.ts # GET /api/opportunities(+:id)
├── controllers/              # Request/response handling
├── services/                 # Business logic and data access
│   └── opportunity.service.ts
├── middleware/
│   ├── errorHandler.ts       # Centralized 400/404/500 JSON error handler + ApiError
│   ├── notFound.ts           # 404 fallback + async route wrapper
│   └── validate.ts           # Reusable zod validation middleware
├── schemas/
│   └── opportunity.schema.ts # Zod schemas for list query and :id params
└── types/                    # Shared TypeScript types
tests/                        # vitest + supertest API tests
```

## Endpoints

All endpoints are public and read-only right now. Authentication, registrations, and admin CRUD are intentionally **not implemented yet**.

### `GET /api/health`

Application status without exposing secrets.

```json
{
  "success": true,
  "status": "ok",
  "service": "commonground-server",
  "uptimeSeconds": 42,
  "database": { "connected": false, "status": "connecting" },
  "timestamp": "2026-10-31T17:00:00.000Z"
}
```

### `GET /api/opportunities`

Public, read-only list with pagination and filters.

| Query param | Type | Default | Notes |
| --- | --- | --- | --- |
| `page` | int ≥ 1 | `1` | |
| `limit` | int 1–50 | `12` | |
| `category` | string | – | Exact match, e.g. `Environment`. |
| `search` | string | – | Case-insensitive match on `title`/`description`. |

Response:

```json
{
  "success": true,
  "data": [ /* opportunity documents */ ],
  "page": 1,
  "limit": 12,
  "total": 0,
  "totalPages": 1
}
```

### `GET /api/opportunities/:id`

Public detail view for a single opportunity. `:id` must be a 24-hex-character Mongo `ObjectId`.

### Error responses

- `400` — validation failure (`details.issues` describes each problem)
- `404` — unknown route or non-existent opportunity
- `500` — unexpected failure (internals are never leaked to clients)

## Data policy

The MongoDB `opportunities` collection is kept **empty** until real data is available. The six sample opportunities in the frontend are fictional placeholders — no fake records are seeded automatically. If you want a demo seed, it must be requested explicitly.

## Development notes

- **ESM everywhere**: the package is `"type": "module"`; relative imports use `.js` extensions (TypeScript `NodeNext`).
- **Graceful shutdown**: on `SIGINT`/`SIGTERM` the HTTP server stops accepting connections, the MongoDB client is closed, and the process exits cleanly (with a forced-exit timeout).
- **MongoDB down ≠ server down**: if the database is unreachable at boot, the API still serves `/api/health` with `database.connected: false`; data endpoints return a handled `500` until the connection succeeds on restart.
- **Validating changes**: `npm run build` (strict `tsc`) and `npm test` must pass.
