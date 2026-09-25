'use strict';

const ApiError = require('../utils/ApiError');

const isId = (v) => Number.isInteger(v) && v > 0;

// Builds req.scope from the verified token, never from the request. It fails
// closed: a user token whose jurisdiction is missing or malformed is rejected,
// because the alternative — treating it as national — would show the whole
// estate to a token nobody meant to grant that.
module.exports = (req, _res, next) => {
  const principal = req.principal;

  // A device never reads, and requirePrincipal('user') keeps it off every
  // read route. null (not {}) means that if one ever reached a repository it
  // would fail rather than silently see national scope.
  if (principal.typ !== 'user') {
    req.scope = null;
    return next();
  }

  const j = principal.jurisdiction;
  const invalid = () => next(ApiError.unauthorized('INVALID_TOKEN', 'Token carries no valid jurisdiction.'));

  if (!j) {
    return invalid();
  }

  if (j.level === 'national') {
    req.scope = {};
  } else if (j.level === 'provincial' && isId(j.province_id)) {
    req.scope = { province_id: j.province_id };
  } else if (j.level === 'district' && isId(j.district_id) && isId(j.province_id)) {
    // province_id too: tables with no district column (provinces) are scoped
    // to the district's own province.
    req.scope = { district_id: j.district_id, province_id: j.province_id };
  } else {
    return invalid();
  }

  next();
};
