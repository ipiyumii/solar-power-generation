'use strict';

const ApiError = require('../utils/ApiError');

const WRITES = new Set(['POST', 'PUT', 'PATCH']);

// 406 when the client cannot accept JSON, the only representation served.
// A missing Accept header means "anything", so it passes. 415 when a write
// sends its body as something other than JSON, instead of letting the body
// arrive undefined and fail validation with a misleading message.
module.exports = (req, _res, next) => {
  if (!req.accepts('application/json')) {
    return next(ApiError.notAcceptable());
  }
  if (WRITES.has(req.method) && !req.is('application/json')) {
    return next(ApiError.unsupportedMediaType());
  }
  next();
};
