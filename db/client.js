'use strict';

const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');

const env = require('../config/env');

const CA_BUNDLE = path.join(__dirname, 'rds-ca-bundle.pem');

// RDS requires TLS and we verify the certificate against Amazon's CA.
// rejectUnauthorized: false would accept any certificate, which makes the
// encryption decorative — see docs/SECURITY.md §7. Local MySQL runs without TLS.
function sslOptions() {
  if (!env.isProduction) return undefined;
  if (!fs.existsSync(CA_BUNDLE)) {
    console.error(`Missing ${CA_BUNDLE}. Download the Amazon RDS CA bundle.`);
    process.exit(1);
  }
  return { ca: fs.readFileSync(CA_BUNDLE), rejectUnauthorized: true };
}

// Under Lambda the pool is per container, not per service: every warm
// container holds its own. Reserved concurrency 10 x a cap of 2 bounds the
// estate at 20 connections against db.t4g.micro's ~60. As a long-running
// server there is one process, so one pool of 10 is the right shape.
const isLambda = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  ssl: sslOptions(),

  // db.t4g.micro allows ~60 connections. One instance at 10 leaves headroom
  // for a seeding session and an interactive client
  connectionLimit: isLambda ? 2 : 10,
  waitForConnections: true,
  queueLimit: 0,

  // A frozen Lambda container can wake holding a connection RDS has already
  // dropped. Keepalives do not run while frozen, so this narrows the window
 
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,

  timezone: 'Z', // DATETIME columns are stored in UTC
  decimalNumbers: true, // DECIMAL as number, not string
  supportBigNumbers: true,
  bigNumberStrings: false,
});

const ping = async () => {
  await pool.query('SELECT 1');
};

const close = () => pool.end();

module.exports = { pool, ping, close };
