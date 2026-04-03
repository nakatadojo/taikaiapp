/**
 * Migration 056 — Check-in absent / withdrawn status
 *
 * Adds a `status` column to the `checkins` table so directors can mark
 * competitors as absent (no-show) or withdrawn (pulled out on event day)
 * in addition to the existing checked-in state.
 *
 * Also adds a `reason` text column for optional notes on the status.
 */
exports.up = (pgm) => {
  pgm.addColumn('checkins', {
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'checked_in',
      check: "status IN ('checked_in', 'absent', 'withdrawn')",
    },
    status_reason: {
      type: 'text',
      notNull: false,
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('checkins', 'status_reason');
  pgm.dropColumn('checkins', 'status');
};
