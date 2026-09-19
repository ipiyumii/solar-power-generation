'use strict';

// THE single error emitter. No route, service or repository writes an error
// body. That is what makes "one consistent error schema across the whole API"
module.exports = (err, req, res, _next) => {
  const status = Number.isInteger(err.status) ? err.status : 500;

  if (status >= 500) {
    // The detail goes to the log, keyed by the same request_id the client
    // received, so it stays diagnosable without leaking internals.
    console.error(JSON.stringify({ request_id: req.id, error: err.message, stack: err.stack }));
  }

  res.status(status).json({
    error: {
      code: err.code ?? 'INTERNAL_ERROR',
      message: status >= 500 ? 'An unexpected error occurred.' : err.message,
      details: err.details ?? [],
      request_id: req.id,
      timestamp: new Date().toISOString(),
    },
  });
};
