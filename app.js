'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const yaml = require('yaml');
const swaggerUi = require('swagger-ui-express');

const env = require('./config/env');
const db = require('./db/client');
const authenticate = require('./middleware/authenticate');
const jurisdiction = require('./middleware/jurisdiction');
const etagHandler = require('./middleware/etagHandler');
const negotiate = require('./middleware/negotiate');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const rateLimits = require('./middleware/rateLimits');

const app = express();

// Parse OpenAPI spec once at startup
const specPath = path.join(__dirname, 'openapi', 'openapi.yaml');
const spec = yaml.parse(fs.readFileSync(specPath, 'utf8'));

// Behind API Gateway every request reaches the function from the platform, so
// without this all clients would share one rate-limit bucket. The value is 1,
// not true: true trusts the whole X-Forwarded-For chain, which a client can
// prepend to. API Gateway appends the real caller as the last hop, which is
// the one hop this setting reads.
app.set('trust proxy', 1);

// One ETag owner: utils/etag.js. Two generators would produce two values for
// one body and caches would never hit.
app.set('etag', false);

app.disable('x-powered-by');

// Security headers: HSTS, nosniff, frame denial, a restrictive CSP. No CORS
// headers are sent, so browsers refuse cross-origin reads by default; there
// is no browser client to allow.
app.use(helmet({ frameguard: { action: 'deny' } }));

// Correlates a client's error body to a log line. Before the body parser, so
// its errors (malformed JSON, 413) carry a request_id too.
app.use((req, _res, next) => {
  req.id = crypto.randomUUID();
  next();
});

app.use(express.json({ limit: '16kb', strict: true }));

// Outside /api/v1: it describes the deployment, not the API.
// It touches the database deliberately — a liveness-only check reports
// healthy while every endpoint 500s on a connectivity fault.
app.get('/health', async (_req, res) => {
  let database = 'connected';
  try {
    await db.ping();
  } catch {
    database = 'disconnected';
  }

  res.status(database === 'connected' ? 200 : 503).json({
    status: database === 'connected' ? 'ok' : 'degraded',
    version: require('./package.json').version,
    commit: env.GIT_COMMIT,
    database,
    uptime_seconds: Math.floor(process.uptime()),
  });
});

// Routers.
const authRouter = require('./routes/auth');
const provincesRouter = require('./routes/provinces');
const districtsRouter = require('./routes/districts');
const gridSubstationsRouter = require('./routes/gridSubstations');
const installationsRouter = require('./routes/installations');
const readingsRouter = require('./routes/readings');

// 406 / 415 apply to every API route, the public auth endpoints included.
app.use('/api/v1', negotiate);
app.use('/api/v1', rateLimits.general);

// OpenAPI docs (public, before authentication). Swagger UI's assets are all
// served from this origin and it has no inline scripts; it needs only inline
// styles and data: images, so the CSP is relaxed for exactly that, on this
// path only.
app.use('/api/v1/docs', helmet({
  frameguard: { action: 'deny' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      // Over plain-http localhost this would rewrite the page's own asset
      // requests to https and leave a blank page; production is HTTPS anyway.
      upgradeInsecureRequests: env.isProduction ? [] : null,
    },
  },
}));
// app.use, not app.get: /api/v1/docs redirects to /api/v1/docs/, and only a
// mounted handler catches the trailing-slash path before swagger-ui's own
// static index.html (the Petstore demo) is served instead of this spec.
app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(spec));
app.get('/api/v1/openapi.json', (_req, res) => {
  res.set('Content-Type', 'application/json');
  res.json(spec);
});

// Authentication endpoints (public), with a tighter limit on failed attempts.
app.use('/api/v1/auth', rateLimits.auth, authRouter);

// Protected endpoints: require authentication and jurisdiction scoping.
app.use('/api/v1', authenticate);
app.use('/api/v1', jurisdiction);
app.use('/api/v1', etagHandler);

app.use('/api/v1/provinces', provincesRouter);
app.use('/api/v1/districts', districtsRouter);
app.use('/api/v1/grid-substations', gridSubstationsRouter);
app.use('/api/v1/installations', installationsRouter);
app.use('/api/v1/readings', readingsRouter);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
