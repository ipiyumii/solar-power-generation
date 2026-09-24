'use strict';

const crypto = require('node:crypto');
const ApiError = require('./ApiError');

// The only ETag producer. A GET and a write's If-Match check both hash the
// same representation through this function, so they always agree.
function generateETag(data) {
  const hash = crypto.createHash('sha256');
  hash.update(typeof data === 'string' ? data : JSON.stringify(data));
  return `"${hash.digest('hex').substring(0, 16)}"`;
}

function parseETag(etagHeader) {
  if (!etagHeader) {
    return null;
  }
  return etagHeader.split(',').map((tag) => tag.trim());
}

// If-None-Match uses weak comparison (RFC 9110 §13.1.2): W/ is ignored.
function etagMatches(etag, clientETags) {
  if (!clientETags) {
    return false;
  }
  const strip = (tag) => tag.replace(/^W\//, '');
  return clientETags.some((tag) => tag === '*' || strip(tag) === strip(etag));
}

// If-Match uses strong comparison and applies to the representation as it is
// now, so it must be checked before a write, not against the write's result.
function checkIfMatch(ifMatchHeader, currentRepresentation) {
  if (!ifMatchHeader) {
    return;
  }
  const current = generateETag(currentRepresentation);
  const tags = parseETag(ifMatchHeader);
  if (!tags.some((tag) => tag === '*' || tag === current)) {
    throw ApiError.preconditionFailed(
      'PRECONDITION_FAILED',
      'The resource has changed since it was read. Fetch it again and retry with the new ETag.'
    );
  }
}

// The newest updated_at / ingested_at anywhere in a single-resource
// representation. Returns null when the body carries neither.
function lastModifiedOf(body, depth = 0) {
  if (!body || typeof body !== 'object' || depth > 3) {
    return null;
  }
  let newest = null;
  for (const [key, value] of Object.entries(body)) {
    let candidate = null;
    if (key === 'updated_at' || key === 'ingested_at') {
      const date = value instanceof Date ? value : new Date(value);
      candidate = Number.isNaN(date.getTime()) ? null : date;
    } else if (value && typeof value === 'object' && !(value instanceof Date)) {
      candidate = lastModifiedOf(value, depth + 1);
    }
    if (candidate && (!newest || candidate > newest)) {
      newest = candidate;
    }
  }
  return newest;
}

module.exports = {
  generateETag,
  parseETag,
  etagMatches,
  checkIfMatch,
  lastModifiedOf,
};
