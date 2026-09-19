'use strict';

// Services throw these; middleware/errorHandler.js is the only thing that
// turns one into a response body. Repositories throw nothing — they return
// null for absent and let the service decide whether that is a 404.
class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(code, message, details = []) {
    return new ApiError(400, code, message, details);
  }

  static unauthorized(code = 'AUTHENTICATION_REQUIRED', message = 'Authentication is required.') {
    return new ApiError(401, code, message);
  }

  static forbidden(code, message) {
    return new ApiError(403, code, message);
  }

  static notFound(code = 'RESOURCE_NOT_FOUND', message = 'Resource not found.') {
    return new ApiError(404, code, message);
  }

  static conflict(code, message, details = []) {
    return new ApiError(409, code, message, details);
  }
}

module.exports = ApiError;
