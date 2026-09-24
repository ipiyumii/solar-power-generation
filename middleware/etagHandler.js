'use strict';

const { generateETag, parseETag, etagMatches } = require('../utils/etag');
const ApiError = require('../utils/ApiError');

function etagHandler(req, res, next) {
  const originalJson = res.json;

  res.json = function(data) {
    if (!res.headersSent) {
      const etag = generateETag(data);
      res.set('ETag', etag);

      if (req.method === 'GET') {
        const ifNoneMatch = req.get('If-None-Match');
        if (ifNoneMatch) {
          const clientETags = parseETag(ifNoneMatch);
          if (etagMatches(etag, clientETags)) {
            return res.status(304).end();
          }
        }
      }

      if (req.method === 'PUT' || req.method === 'PATCH') {
        const ifMatch = req.get('If-Match');
        if (ifMatch) {
          const clientETags = parseETag(ifMatch);
          if (!etagMatches(etag, clientETags)) {
            return next(ApiError.preconditionFailed('ETAG_MISMATCH', 'Resource has been modified. ETag does not match.'));
          }
        }
      }
    }

    return originalJson.call(this, data);
  };

  next();
}

module.exports = etagHandler;
