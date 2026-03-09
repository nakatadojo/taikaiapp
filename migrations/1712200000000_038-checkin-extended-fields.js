/**
 * Migration 038: Extend checkins table with weight/document verification fields
 * Also add checked_in_at/checked_in_by to tournament_members for personnel check-in
 */

exports.up = (pgm) => {
  // Extend checkins with weight and document verification
  pgm.addColumns('checkins', {
    actual_weight: {
      type: 'decimal(5,1)',
    },
    weight_verified: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    aau_verified: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
  });

  // Add personnel check-in to tournament_members
  pgm.addColumns('tournament_members', {
    checked_in_at: {
      type: 'timestamptz',
    },
    checked_in_by: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'SET NULL',
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('checkins', ['actual_weight', 'weight_verified', 'aau_verified']);
  pgm.dropColumns('tournament_members', ['checked_in_at', 'checked_in_by']);
};
