'use strict';

const ApiError = require('../utils/ApiError');

const LABEL = { query: 'query parameters', body: 'request body', params: 'path parameters' };

function toDetails(issues) {
  return issues.flatMap((issue) =>
    issue.code === 'unrecognized_keys'
      ? issue.keys.map((key) => ({ field: key, issue: 'is not a recognised parameter' }))
      : [{ field: issue.path.join('.') || null, issue: issue.message }]
  );
}

// Parsed values go on req.validated, never back onto req.query, which is a
// getter in Express 5.
module.exports = (schema, source) => (req, _res, next) => {
  const result = schema.safeParse(req[source] ?? {});

  if (!result.success) {
    return next(ApiError.badRequest('VALIDATION_FAILED', `Invalid ${LABEL[source]}.`, toDetails(result.error.issues)));
  }

  req.validated = { ...req.validated, [source]: result.data };
  next();
};
