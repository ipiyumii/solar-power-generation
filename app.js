'use strict';

const crypto = require('node:crypto');
const express = require('express');

const env = require('./config/env');
const db = require('./db/client');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

const app = express();

// Behind API Gateway every request reaches the function from the platform, so
// without this all clients would share one rate-limit bucket. The value is 1,
// not true: true trusts the whole X-Forwarded-For chain, which a client can
// prepend to. API Gateway appends the real caller as the last hop, which is
// the one hop this setting reads.
app.set('trust proxy', 1);

// One ETag owner. utils/etag.js becomes the only producer in session A6;
// two generators produce two values for one body and caches never hit.
app.set('etag', false);

app.disable('x-powered-by');

app.use(express.json({ limit: '16kb', strict: true }));

// Correlates a client's error body to a log line.
app.use((req, _res, next) => {
  req.id = crypto.randomUUID();
  next();
});

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

app.use(notFound);
app.use(errorHandler);

module.exports = app;
