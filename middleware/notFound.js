'use strict';

const ApiError = require('../utils/ApiError');

// Pathless. app.use('*', handler) throws at startup under Express 5's
module.exports = (req, _res, next) => {
  next(ApiError.notFound('RESOURCE_NOT_FOUND', `No route matches ${req.method} ${req.path}.`));
};
