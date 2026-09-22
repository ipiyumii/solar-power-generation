'use strict';

module.exports = (req, _res, next) => {
  const principal = req.principal;

  if (!principal || principal.typ !== 'user') {
    req.scope = {};
    return next();
  }

  const jurisdiction = principal.jurisdiction;

  if (!jurisdiction) {
    req.scope = {};
    return next();
  }

  const scope = {};

  if (jurisdiction.level === 'national') {
    // National users see everything
  } else if (jurisdiction.level === 'provincial') {
    scope.province_id = jurisdiction.province_id;
  } else if (jurisdiction.level === 'district') {
    scope.district_id = jurisdiction.district_id;
  }

  req.scope = scope;
  next();
};
