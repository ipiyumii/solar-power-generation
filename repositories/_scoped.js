'use strict';

// Converts the authenticated req.scope object into a SQL WHERE fragment
// and its corresponding bound parameters. The generated SQL only narrows
// queries and never widens access.
//
// Usage:
//   const { where, params } = scopePredicate(req.scope);
//   const sql = `SELECT ... FROM installations WHERE status = 'active' ${where ? 'AND ' + where : ''}`;
//   await pool.execute(sql, ['active', ...params]);
//
// scope: { province_id?: N, district_id?: N } or {}
//
// Returns: { where: 'province_id = ? AND district_id = ?', params: [5, 12] }
//          or { where: '', params: [] } for national scope
function scopePredicate(scope) {
  const predicates = [];
  const params = [];

  if (scope.district_id !== undefined && scope.district_id !== null) {
    predicates.push('district_id = ?');
    params.push(scope.district_id);
  } else if (scope.province_id !== undefined && scope.province_id !== null) {
    predicates.push('province_id = ?');
    params.push(scope.province_id);
  }

  return {
    where: predicates.length > 0 ? predicates.join(' AND ') : '',
    params,
  };
}

module.exports = {
  scopePredicate,
};
