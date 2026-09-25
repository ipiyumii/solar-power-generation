'use strict';

const { rateLimit } = require('express-rate-limit');
const ApiError = require('../utils/ApiError');

const FIFTEEN_MINUTES = 15 * 60 * 1000;

// The 429 goes through the single error handler, so it has the same envelope
// as every other error, plus Retry-After.
function limiter({ limit, ...options }) {
  return rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res, next) => {
      const seconds = Math.max(1, Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000));
      res.set('Retry-After', String(seconds));
      next(ApiError.tooManyRequests(seconds));
    },
    ...options,
  });
}

// Counted per client IP (app.set('trust proxy', 1) makes req.ip the caller,
// not API Gateway). The store is per Lambda container, so with several warm
// containers the effective limit is a multiple of these; API Gateway's stage
// throttle is the global ceiling in front of them.
module.exports = {
  // Only failed attempts count, so brute-forcing a password or device secret
  // is slowed while a client that logs in correctly is never locked out.
  auth: limiter({ limit: 10, skipSuccessfulRequests: true }),
  ingestion: limiter({ limit: 200 }),
  general: limiter({ limit: 1000 }),
};
