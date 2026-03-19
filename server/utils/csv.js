'use strict';

/**
 * Shared CSV helpers — imported by exportController, medicalIncidentController,
 * and feedbackController so the logic lives in exactly one place.
 */

/**
 * Escape a single value for CSV output.
 * Always wraps in double-quotes and escapes internal quotes by doubling them.
 */
function csvEscape(value) {
  const str = value == null ? '' : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Build a complete CSV string from a headers array and a rows array-of-arrays.
 * Uses CRLF line endings per RFC 4180.
 */
function buildCSV(headers, rows) {
  const headerLine = headers.map(csvEscape).join(',');
  const dataLines = rows.map(row => row.map(csvEscape).join(','));
  return [headerLine, ...dataLines].join('\r\n');
}

module.exports = { csvEscape, buildCSV };
