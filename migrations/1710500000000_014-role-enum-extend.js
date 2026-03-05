/**
 * Migration 014: Extend user_role ENUM
 *
 * Adds 'parent' and 'staff' values to the existing user_role PostgreSQL ENUM type,
 * enabling the role-based registration system.
 */

exports.up = (pgm) => {
  pgm.sql("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'parent'");
  pgm.sql("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'staff'");
};

exports.down = () => {
  // PostgreSQL ENUM values cannot be removed without recreating the type.
  // These values will remain in the type.
};
