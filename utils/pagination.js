'use strict';

const env = require('../config/env');

// Wraps a service's { data, total, limit, offset } in the collection envelope:
// the page, its position, and absolute links to neighbouring pages. Built in
// the router because only the router knows the request URL; services stay
// free of req. Links keep every other query parameter (filters, sort) so
// "next" is the next page of the same query.
function withLinks(req, { data, total, limit, offset }) {
  const path = `${req.baseUrl}${req.path === '/' ? '' : req.path}`;
  const query = req.validated?.query ?? {};

  const at = (pageOffset) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && key !== 'limit' && key !== 'offset') {
        params.set(key, String(value));
      }
    }
    params.set('limit', String(limit));
    params.set('offset', String(pageOffset));
    return `${env.PUBLIC_BASE_URL}${path}?${params}`;
  };

  const lastOffset = total > 0 ? Math.floor((total - 1) / limit) * limit : 0;

  return {
    data,
    pagination: {
      total_count: total,
      limit,
      offset,
      returned: data.length,
    },
    links: {
      self: at(offset),
      first: at(0),
      prev: offset > 0 ? at(Math.max(0, offset - limit)) : null,
      next: offset + limit < total ? at(offset + limit) : null,
      last: at(lastOffset),
    },
  };
}

module.exports = { withLinks };
