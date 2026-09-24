'use strict';

const ApiError = require('../utils/ApiError');

// express.json() raises these before any route runs; without a mapping they
// would reach the client as a 4xx labelled INTERNAL_ERROR.
const BODY_PARSER_ERRORS = {
  'entity.parse.failed': [400, 'MALFORMED_JSON', 'Request body is not valid JSON.'],
  'entity.too.large': [413, 'PAYLOAD_TOO_LARGE', 'Request body exceeds the 16 KB limit.'],
  'encoding.unsupported': [415, 'UNSUPPORTED_MEDIA_TYPE', 'Unsupported request body encoding.'],
  'charset.unsupported': [415, 'UNSUPPORTED_MEDIA_TYPE', 'Unsupported request body charset.'],
};

function classify(err) {
  if (err instanceof ApiError) {
    return { status: err.status, code: err.code, message: err.message, details: err.details ?? [] };
  }
  const known = BODY_PARSER_ERRORS[err.type];
  if (known) {
    const [status, code, message] = known;
    return { status, code, message, details: [] };
  }
  // Anything else is unexpected. Its code (e.g. a MySQL ER_* name) and
  // message describe internals, so neither reaches the client.
  return { status: 500, code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.', details: [] };
}

// THE single error emitter. No route, service or repository writes an error
// body. That is what makes "one consistent error schema across the whole API"
// a structural guarantee.
module.exports = (err, req, res, _next) => {
  const { status, code, message, details } = classify(err);

  if (status >= 500) {
    // The detail goes to the log, keyed by the same request_id the client
    // received, so it stays diagnosable without leaking internals.
    console.error(JSON.stringify({ request_id: req.id, error: err.message, code: err.code, stack: err.stack }));
  }

  if (err instanceof ApiError && err.headers) {
    res.set(err.headers);
  }

  res.status(status).json({
    error: {
      code,
      message,
      details,
      request_id: req.id,
      timestamp: new Date().toISOString(),
    },
  });
};
