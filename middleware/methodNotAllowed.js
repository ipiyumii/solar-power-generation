'use strict';

const ApiError = require('../utils/ApiError');

// Mounted with route().all() after the supported methods, so only the
// methods the resource does not support reach it.
module.exports = (allow) => (_req, _res, next) => next(ApiError.methodNotAllowed(allow));
