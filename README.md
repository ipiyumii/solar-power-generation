# SLSEA Solar Generation API

Real-time and historical generation data for Sri Lanka's rooftop solar estate.

Built for the **Sri Lanka Sustainable Energy Authority (SLSEA)**, Ministry of Energy. Metering devices push generation readings automatically; SLSEA analysts and regional operators query them — live and historically — to feed operational dashboards and BI systems.

| | |
|---|---|
| **Live API** | `https://4qfu2ftwie.execute-api.us-east-1.amazonaws.com/api/v1` |
| **Health** | [`https://4qfu2ftwie.execute-api.us-east-1.amazonaws.com/health`](https://4qfu2ftwie.execute-api.us-east-1.amazonaws.com/health) |
| **OpenAPI / Swagger** | `/api/v1/docs` — *in progress* |
| **Hosting** | AWS Lambda + API Gateway (HTTP API) + RDS MySQL 8, `us-east-1` |

> This is a backend service only. No dashboard, BI tool or client application is part of the deliverable — the OpenAPI surface is the interface.

```bash
curl https://4qfu2ftwie.execute-api.us-east-1.amazonaws.com/health
# {"status":"ok","version":"1.0.0","commit":"<deployed git sha>","database":"connected","uptime_seconds":42}
```

`/health` queries the database on every call, so `"database":"connected"` means the API can actually serve data, and `commit` is the Git commit the running code was built from.

---

## What it does

1. **Acquires** generation readings pushed by smart meters, one per installation every 15 minutes.
2. **Serves** those readings and the surrounding geographic and asset hierarchy to SLSEA staff, scoped to the jurisdiction each user is responsible for.

### The write–read split

| Client | Identity | Can | Cannot |
|---|---|---|---|
| **Metering device** | Authenticates as one installation | Push readings **for that installation only** | Read anything; write anything else |
| **SLSEA user** | Authenticates as a person with a jurisdiction | Read data **within that jurisdiction** | Write readings |

### Two consumer scopes

| Scope | Question | Endpoints |
|---|---|---|
| **Operational** | *What is generating right now?* | `/installations/{id}/last-known-reading`, `/districts/{id}/generation-summary` |
| **Analytical** | *How has generation behaved over time and by region?* | `/installations/{id}/readings`, `/readings` — paginated, filtered, sorted, conditional |

---

## Authenticating

JWT bearer tokens (HS256) over HTTPS, always in the `Authorization` header — never in a query string.

```bash
# SLSEA user -> user token
curl -X POST https://4qfu2ftwie.execute-api.us-east-1.amazonaws.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"kandy.officer@slsea.lk","password":"..."}'

# Metering device -> device token
curl -X POST https://4qfu2ftwie.execute-api.us-east-1.amazonaws.com/api/v1/auth/device-token \
  -H 'Content-Type: application/json' \
  -d '{"meter_id":"MTR-000042","device_secret":"..."}'

# Then
curl https://4qfu2ftwie.execute-api.us-east-1.amazonaws.com/api/v1/installations/61/last-known-reading \
  -H "Authorization: Bearer $TOKEN"
```

Seeded accounts: a national analyst, a Central provincial officer, Kandy and Colombo district officers, and an admin. Their credentials are generated at seed time and supplied with the submission, not stored in this repository.

---

## Endpoints

All paths are under `/api/v1`.

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
| `GET` | `/installations/{id}/overview` | **Composite** — installation, its jurisdiction chain, latest reading, lifetime and today's energy |
| `GET` | `/installations/{id}/last-known-reading` | **Processing** — the most recent reading, derived from the series |
| `GET` | `/installations/{id}/readings` | **Scoped collection** — one installation's history |
| `GET` | `/installations/{id}/readings/{reading_id}` | Atomic |
| `GET` | `/readings` · `/readings/{id}` | Estate-wide history |
| `GET` | `/districts/{id}/generation-summary` | **Processing** — current total power and today's energy for a district |

### Write path

| Method | Path | Principal | Success |
|---|---|---|---|
| `POST` | `/installations/{id}/readings` | Device (its own installation only) | `201` + `Location` |
| `POST` | `/installations` | Admin | `201` + `Location`; the new device secret is returned once |
| `PUT` | `/installations/{id}` | Admin | `200` — full replacement, every mutable field required |
| `PATCH` | `/installations/{id}` | Admin | `200` — partial update |
| `DELETE` | `/installations/{id}` | Admin | `204`; `409` if it has readings |
| any mutation | `/installations/{id}/readings/{reading_id}` | — | `405` + `Allow: GET, HEAD` |

Readings are **append-only**. A replayed reading (same installation and `recorded_at`) returns `409 Conflict` with a `Location` header pointing at the reading already stored. The database enforces the same rule: the application's MySQL user holds only `SELECT, INSERT` on `readings`.

### Query parameters

| Parameter | Applies to | Example |
|---|---|---|
| `limit` (1–200, default 50), `offset` | Every collection | `?limit=50&offset=100` |
| `province_id`, `district_id`, `substation_id` | Jurisdiction filter — installations, readings, districts, substations | `?district_id=4` |
| `recorded_at_start`, `recorded_at_end` | Time window on readings, ISO 8601 with offset | `?recorded_at_start=2026-09-20T00:00:00+05:30` |
| `sort` | Collections, `field:asc` or `field:desc` | `?sort=recorded_at:asc` |
| `status` | Installations | `?status=active` |
| `at` | District summary — compute "as of" this instant (default: now) | `?at=2026-09-24T12:00:00+05:30` |

Query schemas are **strict**: an unknown or misspelled parameter returns `400`, never unfiltered data. A filter can only narrow a user's jurisdiction, never widen it.

---

## Response shapes

**Collection:**

```json
{
  "data": [ ],
  "pagination": { "total_count": 672, "limit": 50, "offset": 50, "returned": 50 },
  "links": {
    "self":  "https://…/api/v1/installations/61/readings?limit=50&offset=50",
    "first": "https://…/api/v1/installations/61/readings?limit=50&offset=0",
    "prev":  "https://…/api/v1/installations/61/readings?limit=50&offset=0",
    "next":  "https://…/api/v1/installations/61/readings?limit=50&offset=100",
    "last":  "https://…/api/v1/installations/61/readings?limit=50&offset=650"
  }
}
```

`prev` is `null` on the first page and `next` on the last. Links are absolute, built from `PUBLIC_BASE_URL`, and keep the request's filters and sort.

**Error** — one schema for every error the application returns:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Invalid query parameters.",
    "details": [ { "field": "distrct_id", "issue": "is not a recognised parameter" } ],
    "request_id": "2f6c1e9a-…",
    "timestamp": "2026-09-25T08:41:02.000Z"
  }
}
```

**Caching** — single resources carry `ETag` and `Last-Modified`, collection pages carry `ETag`. `If-None-Match` or `If-Modified-Since` on an unchanged resource returns `304` with an empty body. A write with a stale `If-Match` returns `412` and changes nothing.

**Status codes used:** `200` `201` `204` `304` `400` `401` `403` `404` `405` `406` `409` `412` `413` `415` `500`.

A cross-jurisdiction **read** returns `404`, identical to a missing resource — a `403` would confirm the resource exists. The device write path is the deliberate exception: a device posting to an installation that is not its own gets `403`.

---

## Running locally

Requires Node.js 22+ and MySQL 8.

```bash
git clone https://github.com/ipiyumii/solar-power-generation.git
cd solar-power-generation
npm ci
cp .env.example .env          # fill in the values
npm run migrate               # build or upgrade the schema
npm run seed -- --fresh       # 9 provinces, 25 districts, 25 substations, 220 installations, 147,840 readings
npm start                     # http://localhost:5000
```

`npm run migrate` builds an empty database from `db/schema.sql`, or applies any pending file in `db/migrations/` to an existing one. It uses `DB_ADMIN_USER` / `DB_ADMIN_PASSWORD` when set, so the application user never needs DDL rights.

`npm run seed -- --fresh` replaces all data and writes the generated user passwords and device secrets to `seed-credentials.local.json` (git-ignored). Only bcrypt hashes reach the database.

| Variable | Required | Purpose |
|---|---|---|
| `NODE_ENV` | no | `development` (default) or `production`. Production enforces TLS to RDS and a `JWT_SECRET` |
| `PORT` | no | Local port, default `5000` |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | yes | MySQL connection. Connections to `*.rds.amazonaws.com` verify the certificate against `db/rds-ca-bundle.pem` |
| `DB_ADMIN_USER`, `DB_ADMIN_PASSWORD` | no | Used only by `npm run migrate` |
| `PUBLIC_BASE_URL` | yes | Public origin for `Location` headers and pagination links. No default, so a deployment can never emit `localhost` links |
| `JWT_SECRET` | yes in production | HS256 signing secret, at least 32 characters |
| `JWT_USER_TTL`, `JWT_DEVICE_TTL` | no | Token lifetimes, default `8h` and `1h` |

Generate a signing secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

---

## Seed data

| Element | Count |
|---|---|
| Provinces | 9 — the real provinces of Sri Lanka |
| Districts | 25 — the real districts, each in its correct province |
| Grid substations | 25 |
| Solar installations | 220, weighted toward the western and central urban areas |
| Generation readings | 672 per installation (every 15 minutes for 7 days) = **147,840** |

Power follows the Sri Lankan day: zero overnight, rising from 06:00, peaking near midday, falling to zero by 18:15 (Asia/Colombo). `energy_kwh` is a **cumulative lifetime counter**, monotonic per installation, so a period's energy is `last − first`, never a sum.

```bash
npm run seed:verify    # 16 integrity checks: counts, orphans, jurisdiction consistency,
                       # duplicates, monotonic energy, zero night-time power, bcrypt-only secrets
```

Foreign keys — including composite keys that tie each substation's and installation's district and province to their parent — plus `UNIQUE` and `CHECK` constraints make orphans, duplicate readings and mismatched jurisdictions impossible at the database, not merely unlikely.

---

## Project layout

```
.
├── app.js                 # Express app: middleware order and routers
├── index.js               # local entry point (binds PORT)
├── lambda.js              # AWS Lambda entry point (serverless-http)
├── config/env.js          # environment validation; refuses to start if misconfigured
├── routes/                # URLs, validation, response codes and headers — no SQL
├── services/              # business rules — never touches req or res
├── repositories/          # the only place that writes SQL; explicit column lists, no SELECT *
├── middleware/            # authentication, scopes, jurisdiction, validation, ETag, errors
├── utils/                 # schemas, error type, ETag, pagination links, time zone
├── db/                    # client, schema.sql, migrations, RDS CA bundle
├── scripts/               # migrate, seed
└── .github/workflows/     # build, package and deploy to Lambda on push to main
```

Routers never build a query, services never see `req`/`res`, and repositories use explicit column lists, so `password_hash` and `device_secret_hash` are never fetched into a response path at all.

---

## Deployment

```
Internet ──HTTPS──► API Gateway HTTP API ──► Lambda (Node.js, arm64)
                    (managed TLS,             │  TLS, certificate verified
                     throttling)              ▼
                                        RDS MySQL 8
```

Every push to `main` runs [.github/workflows/aws-lambda.yml](.github/workflows/aws-lambda.yml), which:

1. packages the application and stamps it with the commit SHA,
2. loads the Lambda handler from the package, failing the build on a missing module,
3. refuses to deploy if the credentials belong to a known non-coursework AWS account,
4. deploys, then fails unless `/health` answers `200` **and** reports the commit just deployed.

The Lambda connects to RDS as `slsea_app`, a least-privilege user with no DDL rights, `SELECT, INSERT` only on `readings`, and a TLS requirement enforced by MySQL itself.

---

## Design position

The API targets **Richardson Maturity Level 2**: individually addressable resources, HTTP methods used for their defined semantics, and specific status codes and headers. Level 3 (hypermedia) is out of scope: the pagination links navigate a collection, but a client cannot discover `last-known-reading` or `generation-summary` from a representation — it needs the OpenAPI contract.

---

## Academic context

Coursework for **NB6007CEM Web API Development** — BSc (Hons) Computing (Software Engineering), Level 6, Coventry University / NIBM.

AI-assisted code generation is permitted on this module and disclosed in the report appendix, including the generator faults found and repaired.
