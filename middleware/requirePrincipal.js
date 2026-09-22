'use strict';

const ApiError = require('../utils/ApiError');

module.exports = (requiredType) => {
  return (req, _res, next) => {
    const principal = req.principal;

    if (!principal) {
      return next(ApiError.unauthorized('AUTHENTICATION_REQUIRED', 'Authentication is required.'));
    }

    if (principal.typ !== requiredType) {
      return next(ApiError.forbidden('WRONG_PRINCIPAL_TYPE', `This endpoint requires a ${requiredType} principal.`));
    }

    next();
  };
};
