# SLSEA Solar Generation API

Real-time and historical generation data for Sri Lanka's rooftop solar estate.

Built for the **Sri Lanka Sustainable Energy Authority (SLSEA)**, Ministry of Energy. Metering devices push generation readings automatically; SLSEA analysts and regional operators query them — live and historically — to feed operational dashboards and BI systems.

| | |
|---|---|
| **Live API** | `https://<your-service>.onrender.com/api/v1` — *fill in once deployed* |
| **OpenAPI / Swagger** | `https://<your-service>.onrender.com/api/v1/docs` |
| **Health** | `https://<your-service>.onrender.com/health` |
| **Status** | In development |
| **Full specification** | [project.md](project.md) |

**Documentation:** [project.md](project.md) (purpose, requirements, constraints) · [ARCHITECTURE.md](ARCHITECTURE.md) (layers, request lifecycle) · [API_DESIGN.md](API_DESIGN.md) (endpoints, methods, status codes) · [DATABASE.md](DATABASE.md) (collections, indexes, seed) · [SECURITY.md](SECURITY.md) (threat model, JWT, jurisdiction scoping)

> This is a backend service only. No dashboard, BI tool or client application is part of the deliverable — **the OpenAPI surface is the interface**.

---

## What it does

1. **Acquires** generation readings pushed by smart meters and inverters, one per installation every 15 minutes.
2. **Serves** those readings plus the surrounding geographic and asset hierarchy to SLSEA staff, scoped to the jurisdiction each user is responsible for.
3. **Documents itself** through an OpenAPI 3.1 surface served from the deployment.

### The write–read split

Two client classes exist and they never overlap. This drives the entire security model.

| Client | Identity | Can | Cannot |
|---|---|---|---|
| **Metering device** | Authenticates as one installation | Push readings **for that installation only** | Read anything; write anything else |
| **SLSEA user** | Authenticates as a person with a jurisdiction | Read data **within that jurisdiction** | Write readings, ever |

The data producer (the device) and the data consumer (the analyst) are different parties with different permissions.

### Two consumer scopes

| Scope | Question it answers | Shape |
|---|---|---|
| **Operational** | *What is generating right now?* | Last-known-reading per installation; district generation summary |
| **Analytical** | *How has generation behaved over time and by region?* | Readings history with pagination, filtering, sorting and conditional GET |

---

## Quickstart

```bash
git clone <repo-url> && cd solar-power-generation
npm ci
cp .env.example .env          # then fill in MONGODB_URI and JWT_SECRET
npm run seed -- --fresh       # ~148k readings, takes 2-4 minutes
npm start                     # http://localhost:5000
```

Generate a signing secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### Environment

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | yes | MongoDB Atlas connection string |
| `JWT_SECRET` | yes | HS256 signing secret, 256 bits or longer |
| `JWT_USER_TTL` | yes | User token lifetime, e.g. `8h` |
| `JWT_DEVICE_TTL` | yes | Device token lifetime, e.g. `1h` |
| `PUBLIC_BASE_URL` | **yes in production** | Base URL for pagination links. Unset, every link points at `localhost` |
| `NODE_ENV` | yes | `development` / `production` |
| `PORT` | no | Defaults to `5000` |

`.env` is never committed.

---

## Authenticating

Both client types use JWT bearer tokens over HTTPS. The token is always sent in the `Authorization` header — **never** in a query string.

**SLSEA user (read path):**

```bash
curl -X POST https://<host>/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"analyst.kandy@slsea.lk","password":"..."}'
```

**Metering device (write path):**

```bash
curl -X POST https://<host>/api/v1/auth/device-token \
  -H 'Content-Type: application/json' \
  -d '{"meter_id":"MTR-000042","device_secret":"..."}'
```

Then:

```bash
curl https://<host>/api/v1/installations/42/last-known-reading \
  -H "Authorization: Bearer $TOKEN"
```

A device token can never satisfy a read route, and a user token can never satisfy the ingestion route — the principal *type* is checked before any scope is examined.

---

## Endpoints

All paths are under `/api/v1`. Full contracts, headers and status codes are in [project.md §4–§5](project.md#4-main-features--the-design-spine).

### Hierarchy and assets

| Method | Path | Kind |
|---|---|---|
| `GET` | `/provinces` · `/provinces/{id}` | Collection · Atomic |
| `GET` | `/provinces/{id}/districts` | Scoped collection |
| `GET` | `/districts` · `/districts/{id}` | Collection · Atomic |
| `GET` | `/districts/{id}/grid-substations` | Scoped collection |
| `GET` | `/grid-substations` · `/grid-substations/{id}` | Collection · Atomic |
| `GET` | `/grid-substations/{id}/installations` | Scoped collection |
| `GET` | `/installations` · `/installations/{id}` | Collection · Atomic |

### Operational and analytical reads

| Method | Path | Kind |
|---|---|---|
| `GET` | `/installations/{id}/overview` | **Composite** — installation + jurisdiction chain + last reading + today's energy |
| `GET` | `/installations/{id}/last-known-reading` | **Processing** — the operational "right now" view |
| `GET` | `/installations/{id}/readings` | **Scoped collection** — paginated, filtered, sorted, conditional |
| `GET` | `/installations/{id}/readings/{reading_id}` | Atomic |
| `GET` | `/readings` | Cross-asset history |
| `GET` | `/districts/{id}/generation-summary` | **Processing** — aggregate district generation |

### Write path

| Method | Path | Principal | Success |
|---|---|---|---|
| `POST` | `/installations/{id}/readings` | Device | `201` + `Location` |
| `POST` | `/installations` | Admin | `201` + `Location` |
| `PUT` | `/installations/{id}` | Admin | `200` — full replacement |
| `PATCH` | `/installations/{id}` | Admin | `200` — partial update |
| `DELETE` | `/installations/{id}` | Admin | `204` |
| `PUT`/`PATCH`/`DELETE` | `/installations/{id}/readings/{reading_id}` | — | `405` + `Allow: GET, HEAD` |

Readings are **append-only**. A replayed reading returns `409 Conflict` with a `Location` header pointing at the existing resource.

### Query parameters

| Parameter | Applies to | Example |
|---|---|---|
| `page`, `limit` | Any collection | `?page=3&limit=50` |
| `province_id`, `district_id`, `substation_id` | Jurisdiction filter | `?district_id=11` |
| `from`, `to` | Time window, ISO 8601 | `?from=2026-09-01T00:00:00Z&to=2026-09-08T00:00:00Z` |
| `sort` | Readings | `?sort=recorded_at` · `?sort=-recorded_at` |
| `status` | Installations | `?status=active` |

Query schemas are **strict** — an unknown or misspelled parameter returns `400`, never unfiltered data.

---

## Response shapes

**Collection:**

```json
{
  "data": [ ],
  "pagination": { "total_count": 147840, "page": 3, "limit": 50, "total_pages": 2957 },
  "links": { "self": "...", "next": "...", "prev": "...", "first": "...", "last": "..." }
}
```

**Error** — one schema for every client error across the whole API:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "One or more query parameters are invalid.",
    "details": [ { "field": "limit", "issue": "must be an integer between 1 and 200" } ],
    "request_id": "01JB2K8Q3F5N7X",
    "timestamp": "2026-09-19T08:41:02+00:00"
  }
}
```

**Caching** — retrievable resources carry `ETag` and `Last-Modified`. Send `If-None-Match` and an unchanged resource returns `304` with an empty body.

---

## Project layout

```
.
├── index.js              # app composition, middleware order, graceful start
├── router/               # parse, validate, delegate, respond — no queries here
├── services/             # business rules — never touches req or res
├── repositories/         # the only place that talks to MongoDB
├── middleware/           # auth, jurisdiction scope, error handler, not-found
├── utils/                # jwt, etag, pagination links
├── db/                   # connection, indexes, seeder
├── docs/openapi.yaml     # the contract — updated in the same commit as any change
└── project.md            # full specification and rubric traceability
```

**Layering is an invariant:** Controller → Service → Repository. Routers never build a query; services never see `req`/`res`; repositories are the only database consumers and the only place `_id`, `password_hash` and `device_secret_hash` are projected out.

---

## Seed data

| Element | Count |
|---|---|
| Provinces | 9 (the real Sri Lankan provinces) |
| Districts | 25 (correctly mapped to their provinces) |
| Grid substations | 25 |
| Solar installations | 220 |
| Generation readings | 672 per installation (one per 15 min × 7 days) ≈ **147,800** |

Readings follow a realistic diurnal curve — rising through the morning, peaking near midday, zero overnight. `energy_kwh` is a **cumulative lifetime counter** and is monotonic non-decreasing per installation.

```bash
npm run seed -- --fresh    # rebuild from scratch
npm run seed -- --verify   # row counts, orphans, monotonicity, duplicate keys
```

> **Reading the data correctly:** daily energy for an installation is `last − first` over the window, **not** a sum of `energy_kwh`. Summing a cumulative counter across 96 rows per day overstates generation by orders of magnitude.

---

## Scripts

```bash
npm start                 # run locally on :5000
npm run seed -- --fresh   # rebuild fixtures
npm run seed -- --verify  # data integrity report
npm run smoke             # end-to-end checks against $PUBLIC_BASE_URL
npm run lint
```

Before claiming anything works, run `npm run smoke` against the deployed URL and report what actually happened.

---

## Design position

The API targets **Richardson Maturity Level 2** — resources, correct HTTP methods, correct status codes and headers. Level 3 (hypermedia) is deliberately out of scope: pagination links are collection navigation, not state-transition affordances, and the named consumers are BI pipelines with compile-time knowledge of the contract. The reasoning is set out in [project.md §10](project.md#10-richardson-maturity-placement).

A cross-jurisdiction **read** returns `404`, not `403` — a `403` would confirm existence and let a district user enumerate the national estate. The device write path is the one deliberate exception and returns `403`, because a device already knows its own installation exists.

---

## Academic context

Coursework for **NB6007CEM Web API Development** — BSc (Hons) Computing (Software Engineering), Level 6, Coventry University / NIBM. Assessed on architecture, API design, coverage, implementation, functionality against seed data, deployment, security and report quality.

AI-assisted code generation is permitted and expected on this module; disclosure is mandatory. Prompts, AI-aids and the critique log of generator faults found and repaired are recorded in the report appendix — see [project.md §13](project.md#13-ai-disclosure-and-viva-preparation).
