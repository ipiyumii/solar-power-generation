'use strict';

// Composition root.validates the environment and exits on a
// bad configuration before the socket ever opens.
const env = require('./config/env');
const db = require('./db/client');
const app = require('./app');

const server = app.listen(env.PORT, () => {
  console.log(`listening on :${env.PORT} (${env.NODE_ENV})`);
});

const shutdown = (signal) => async () => {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await db.close();
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown('SIGTERM'));
process.on('SIGINT', shutdown('SIGINT'));
