'use strict';

const crypto = require('node:crypto');

function generateETag(data) {
  const hash = crypto.createHash('sha256');
  if (typeof data === 'string') {
    hash.update(data);
  } else {
    hash.update(JSON.stringify(data));
  }
  return `"${hash.digest('hex').substring(0, 16)}"`;
}

function parseETag(etagHeader) {
  if (!etagHeader) {
    return null;
  }
  const etags = etagHeader.split(',').map(tag => tag.trim());
  return etags;
}

function etagMatches(etag, clientETags) {
  if (!clientETags) {
    return false;
  }
  return clientETags.some(clientTag => clientTag === '*' || clientTag === etag);
}

module.exports = {
  generateETag,
  parseETag,
  etagMatches,
};
