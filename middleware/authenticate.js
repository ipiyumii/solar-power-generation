'use strict';

const ApiError = require('../utils/ApiError');
const { verify } = require('../utils/jwt');

module.exports = (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next(ApiError.unauthorized('AUTHENTICATION_REQUIRED', 'Authentication is required.'));
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return next(ApiError.unauthorized('INVALID_TOKEN', 'Authorization header must be "Bearer <token>".'));
  }

  const token = parts[1];

  try {
    const decoded = verify(token);
    req.principal = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(ApiError.unauthorized('INVALID_TOKEN', 'Token has expired.'));
    }
    if (err.name === 'JsonWebTokenError') {
      return next(ApiError.unauthorized('INVALID_TOKEN', 'Invalid or malformed token.'));
    }
    next(ApiError.unauthorized('INVALID_TOKEN', 'Token validation failed.'));
  }
};
