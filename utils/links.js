'use strict';

const env = require('../config/env');

// Absolute, from the configured public origin — never from the Host header,
// which behind API Gateway is not guaranteed to be the URL clients use.
const resourceUrl = (path) => `${env.PUBLIC_BASE_URL}/api/v1${path}`;

module.exports = { resourceUrl };
