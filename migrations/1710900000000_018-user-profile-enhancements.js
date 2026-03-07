/**
 * Migration 018 — User profile enhancements for simplified account creation
 *
 * Adds profile_completed flag, parent address fields, and judge certification fields.
 * Supports the new multi-step signup flow where role selection and profile
 * completion happen after initial account creation.
 */

exports.up = (pgm) => {
  // Profile completion tracking
  pgm.sql('ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN NOT NULL DEFAULT false');

  // Parent address fields (required for waiver purposes)
  pgm.sql('ALTER TABLE users ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(255)');
  pgm.sql('ALTER TABLE users ADD COLUMN IF NOT EXISTS address_city VARCHAR(100)');
  pgm.sql('ALTER TABLE users ADD COLUMN IF NOT EXISTS address_state VARCHAR(50)');
  pgm.sql('ALTER TABLE users ADD COLUMN IF NOT EXISTS address_zip VARCHAR(20)');

  // Judge certification fields
  pgm.sql('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_certified BOOLEAN DEFAULT false');
  pgm.sql('ALTER TABLE users ADD COLUMN IF NOT EXISTS certification_body VARCHAR(100)');
  pgm.sql('ALTER TABLE users ADD COLUMN IF NOT EXISTS certification_class VARCHAR(50)');

  // Mark existing users with roles as profile_completed (backward compat)
  pgm.sql(`
    UPDATE users SET profile_completed = true
    WHERE id IN (SELECT DISTINCT user_id FROM user_roles)
  `);
};

exports.down = (pgm) => {
  pgm.sql('ALTER TABLE users DROP COLUMN IF EXISTS profile_completed');
  pgm.sql('ALTER TABLE users DROP COLUMN IF EXISTS address_line1');
  pgm.sql('ALTER TABLE users DROP COLUMN IF EXISTS address_city');
  pgm.sql('ALTER TABLE users DROP COLUMN IF EXISTS address_state');
  pgm.sql('ALTER TABLE users DROP COLUMN IF EXISTS address_zip');
  pgm.sql('ALTER TABLE users DROP COLUMN IF EXISTS is_certified');
  pgm.sql('ALTER TABLE users DROP COLUMN IF EXISTS certification_body');
  pgm.sql('ALTER TABLE users DROP COLUMN IF EXISTS certification_class');
};
