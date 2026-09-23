'use strict';

const ApiError = require('../utils/ApiError');

module.exports = (requiredScope) => {
  return (req, _res, next) => {
    const principal = req.principal;

    if (!principal) {
      return next(ApiError.unauthorized('AUTHENTICATION_REQUIRED', 'Authentication is required.'));
    }

    const scopes = (principal.scope ?? '').split(' ').filter(Boolean);
    const hasScope = scopes.includes(requiredScope);

    if (!hasScope) {
      return next(ApiError.forbidden('INSUFFICIENT_SCOPE', `This endpoint requires the ${requiredScope} scope.`));
    }

    next();
  };
};
