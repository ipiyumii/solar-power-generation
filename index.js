'use strict';

// Composition root.validates the environment and exits on a
// bad configuration before the socket ever opens.
const env = require('./config/env');
const db = require('./db/client');
const app = require('./app');

// Express 5 passes a listen failure to this callback instead of throwing, so
// ignoring the argument would log "listening" and then exit silently.
const server = app.listen(env.PORT, (err) => {
  if (err) {
    console.error(err.code === 'EADDRINUSE'
      ? `Port ${env.PORT} is already in use — stop the other server or set PORT.`
      : `Could not start: ${err.message}`);
    process.exit(1);
  }
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
