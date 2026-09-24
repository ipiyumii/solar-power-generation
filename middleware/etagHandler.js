'use strict';

const { generateETag, parseETag, etagMatches, lastModifiedOf } = require('../utils/etag');

// HTTP dates carry whole seconds, so the comparison drops the milliseconds.
const toSeconds = (date) => Math.floor(date.getTime() / 1000);

function isNotModified(req, etag, lastModified) {
  const ifNoneMatch = req.get('If-None-Match');
  if (ifNoneMatch) {
    // When both are sent, If-None-Match decides (RFC 9110 §13.2.2).
    return etagMatches(etag, parseETag(ifNoneMatch));
  }
  const ifModifiedSince = Date.parse(req.get('If-Modified-Since') ?? '');
  return Boolean(lastModified) && !Number.isNaN(ifModifiedSince)
    && toSeconds(lastModified) <= Math.floor(ifModifiedSince / 1000);
}

// Validators are attached to successful 200 responses only. An error body is
// not a representation of the resource, and must never answer a conditional
// GET with 304.
function etagHandler(req, res, next) {
  const originalJson = res.json;

  res.json = function json(body) {
    if (res.statusCode === 200) {
      const etag = generateETag(body);
      res.set('ETag', etag);

      // A collection page's newest timestamp does not change when rows shift
      // between pages, so Last-Modified would claim "unchanged" wrongly. Pages
      // carry the ETag only; single resources carry both.
      const lastModified = Array.isArray(body?.data) ? null : lastModifiedOf(body);
      if (lastModified) {
        res.set('Last-Modified', lastModified.toUTCString());
      }

      if ((req.method === 'GET' || req.method === 'HEAD') && isNotModified(req, etag, lastModified)) {
        return res.status(304).end();
      }
    }

    return originalJson.call(this, body);
  };

  next();
}

module.exports = etagHandler;
