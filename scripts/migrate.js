'use strict';

// Applies db/migrations/*.sql in filename order, once each, recording them in
// schema_migrations. An empty database is built from db/schema.sql instead,
// which already contains every migration and records them itself.
const fs = require('node:fs');
const path = require('node:path');
const { connect } = require('./db-connect');

const DB_DIR = path.join(__dirname, '..', 'db');
const MIGRATIONS_DIR = path.join(DB_DIR, 'migrations');

async function main() {
  const conn = await connect({ admin: true, multipleStatements: true });

  try {
    const [[{ n }]] = await conn.query(
      `SELECT COUNT(*) AS n FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = 'provinces'`
    );

    if (n === 0) {
      console.log('Empty database: applying db/schema.sql');
      await conn.query(fs.readFileSync(path.join(DB_DIR, 'schema.sql'), 'utf8'));
      return;
    }

    await conn.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         filename   VARCHAR(128) NOT NULL PRIMARY KEY,
         applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    );

    const [rows] = await conn.query('SELECT filename FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.filename));
    const pending = fs.readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql') && !applied.has(f))
      .sort();

    if (pending.length === 0) {
      console.log('Up to date.');
      return;
    }

    // MySQL DDL commits implicitly, so a failed file cannot be rolled back;
    // it stays unrecorded and the error names it.
    for (const file of pending) {
      console.log(`Applying ${file}`);
      await conn.query(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
      await conn.execute('INSERT INTO schema_migrations (filename) VALUES (?)', [file]);
    }
    console.log(`Applied ${pending.length} migration(s).`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(`Migration failed: ${err.message}`);
  process.exit(1);
});
