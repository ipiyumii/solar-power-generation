'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { z } = require('zod');

require('dotenv').config();

// CI writes the deployed commit SHA into the package, so /health can say
// which commit is live without CI rewriting the function's environment.
const COMMIT_FILE = path.join(__dirname, '..', 'COMMIT');
const packagedCommit = fs.existsSync(COMMIT_FILE) ? fs.readFileSync(COMMIT_FILE, 'utf8').trim() : 'unknown';

const isProduction = process.env.NODE_ENV === 'production';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),

  // No default. A silent localhost fallback would put "localhost" in every
  // pagination link of every collection response in production — see ADR A-8.
  PUBLIC_BASE_URL: z.string().url(),

  // Not needed until the auth session, but mandatory in production. An empty
  // value in .env counts as present, so it is normalised to absent first.
  JWT_SECRET: isProduction
    ? z.string().min(32)
    : z.preprocess((v) => (v === '' ? undefined : v), z.string().min(32).optional()),
  JWT_USER_TTL: z.string().default('8h'),
  JWT_DEVICE_TTL: z.string().default('1h'),

  GIT_COMMIT: z.string().default(packagedCommit),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Fail at boot, not on the first request. A misconfigured deployment that
  // starts successfully and then 500s is far harder to diagnose than one that
  // refuses to start and says which variable is missing.
  const issues = parsed.error.issues
    .map((i) => `  ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

const env = Object.freeze({
  ...parsed.data,
  isProduction,
  PUBLIC_BASE_URL: parsed.data.PUBLIC_BASE_URL.replace(/\/+$/, ''),
});

module.exports = env;
