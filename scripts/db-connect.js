'use strict';

// Connection for the operator scripts (migrate, seed). They run from a laptop,
// not the Lambda, so they read DB_* directly rather than config/env.js, which
// also demands the API's runtime variables.
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');

require('dotenv').config();

const CA_BUNDLE = path.join(__dirname, '..', 'db', 'rds-ca-bundle.pem');

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing environment variable ${name}.`);
    process.exit(1);
  }
  return value;
}

// DDL needs a user with ALTER rights; the application user deliberately has
// none. DB_ADMIN_* is used when set, so the app credentials never gain them.
function connect({ admin = false, multipleStatements = false } = {}) {
  const host = required('DB_HOST');
  const user = admin && process.env.DB_ADMIN_USER ? process.env.DB_ADMIN_USER : required('DB_USER');
  const password = admin && process.env.DB_ADMIN_USER ? required('DB_ADMIN_PASSWORD') : required('DB_PASSWORD');

  // TLS is decided by the target, not NODE_ENV: seeding RDS from a laptop in
  // development mode must still verify the certificate.
  const ssl = host.endsWith('.rds.amazonaws.com')
    ? { ca: fs.readFileSync(CA_BUNDLE), rejectUnauthorized: true }
    : undefined;

  return mysql.createConnection({
    host,
    port: Number(process.env.DB_PORT || 3306),
    database: required('DB_NAME'),
    user,
    password,
    ssl,
    timezone: 'Z',
    decimalNumbers: true,
    multipleStatements,
  });
}

module.exports = { connect };
