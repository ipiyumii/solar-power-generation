'use strict';

const { pool } = require('../db/client');

// Internal lookup for login: includes password_hash for verification.
// Never expose this method's result through an API response.
async function findByEmailForAuth(email) {
  const [rows] = await pool.execute(
    `SELECT
       user_id,
       email,
       password_hash,
       full_name,
       role,
       jurisdiction_level,
       province_id,
       district_id,
       scopes,
       is_active
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email]
  );
  return rows.length > 0 ? rows[0] : null;
}

module.exports = {
  findByEmailForAuth,
};
