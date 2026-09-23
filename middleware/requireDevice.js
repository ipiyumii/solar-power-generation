'use strict';

const ApiError = require('../utils/ApiError');

module.exports = (_req, _res, next) => {
  const principal = _req.principal;

  if (!principal || principal.typ !== 'device') {
    return next(ApiError.forbidden('DEVICE_REQUIRED', 'Only metering devices can perform this action.'));
  }

  next();
};
