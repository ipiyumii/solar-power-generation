'use strict';

// "Today" for an SLSEA user is the Sri Lankan day, not the server's UTC day:
// UTC midnight is 05:30 in Colombo, which would split one solar day in two.
// Asia/Colombo is UTC+05:30 all year (no daylight saving).
const OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// The Colombo calendar day containing `at`, as a date string and the UTC
// instants of its start (inclusive) and end (exclusive).
function colomboDay(at) {
  const localMidnight = Math.floor((at.getTime() + OFFSET_MS) / DAY_MS) * DAY_MS;
  return {
    date: new Date(localMidnight).toISOString().slice(0, 10),
    start: new Date(localMidnight - OFFSET_MS),
    end: new Date(localMidnight - OFFSET_MS + DAY_MS),
  };
}

module.exports = { colomboDay };
