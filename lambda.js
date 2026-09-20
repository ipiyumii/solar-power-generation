'use strict';

// The Lambda entry point. API Gateway invokes this; index.js binds a port for
// local development. Both run the identical Express app, so nothing in app.js
// or below it knows which one is hosting it.
//
// serverless-http translates the API Gateway event into the req/res pair
// Express expects. It detects the payload format itself, so the same handler
// serves an HTTP API (payload v2) and a REST API (v1).
const serverless = require('serverless-http');

const app = require('./app');

// Built once per container, not per invocation — the wrapper is reused across
// warm invocations along with the database pool it closes over.
module.exports.handler = serverless(app);
