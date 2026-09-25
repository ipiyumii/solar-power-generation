'use strict';

const ApiError = require('../utils/ApiError');

// Role is checked in addition to scope: a scope granted to the wrong user by
// mistake still cannot reach an admin-only route.
module.exports = (requiredRole) => (req, _res, next) => {
  if (req.principal?.role !== requiredRole) {
    return next(ApiError.forbidden('INSUFFICIENT_ROLE', `This endpoint requires the ${requiredRole} role.`));
  }
  next();
};
