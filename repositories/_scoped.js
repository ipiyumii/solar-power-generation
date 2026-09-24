'use strict';

// Converts the authenticated req.scope object into a SQL WHERE fragment and
// its bound parameters. It only ever narrows a query, never widens it.
//
// scope: {} (national), { province_id } (provincial) or
//        { district_id, province_id } (district)
//
// hasDistrictColumn: false for tables without district_id (provinces). A
// district user is then limited to its own province, and a district scope
// that somehow lacks province_id matches nothing rather than everything.
function scopePredicate(scope, { hasDistrictColumn = true } = {}) {
  if (scope.district_id != null && hasDistrictColumn) {
    return { where: 'district_id = ?', params: [scope.district_id] };
  }
  if (scope.province_id != null) {
    return { where: 'province_id = ?', params: [scope.province_id] };
  }
  if (scope.district_id != null) {
    return { where: '1 = 0', params: [] };
  }
  return { where: '', params: [] };
}

// Equality filters on whitelisted columns. Keys come from strict schemas, and
// the whitelist keeps a column name from ever being taken from input.
function equalityFilters(filters, allowedColumns) {
  const conditions = [];
  const params = [];
  for (const column of allowedColumns) {
    if (filters && filters[column] !== undefined && filters[column] !== null) {
      conditions.push(`${column} = ?`);
      params.push(filters[column]);
    }
  }
  return { where: conditions.join(' AND '), params };
}

// Joins fragments into one WHERE clause. The scope fragment is passed last so
// it is always ANDed on, whatever the filters asked for.
function whereClause(...fragments) {
  const parts = fragments.filter((f) => f.where);
  return {
    sql: parts.length > 0 ? `WHERE ${parts.map((f) => f.where).join(' AND ')}` : '',
    params: parts.flatMap((f) => f.params),
  };
}

module.exports = {
  scopePredicate,
  equalityFilters,
  whereClause,
};
