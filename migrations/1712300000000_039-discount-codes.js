/**
 * Migration 039 — Discount Codes
 *
 * Allows tournament directors to create discount codes that registrants
 * can apply during registration. Supports:
 *   - discount_type: 'percentage' | 'flat'
 *   - discount_value: the amount (e.g. 20 for 20% off, or 10 for $10 off)
 *   - scope: 'total' (entire registration) | 'event' (specific event only)
 *   - event_id: when scope = 'event', which event the discount applies to
 *   - max_uses: optional cap on how many times the code can be used
 *   - valid_from / valid_until: optional date window
 *   - current_uses: tracked automatically on each redemption
 */

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS discount_codes (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tournament_id   UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      code            VARCHAR(50) NOT NULL,
      description     VARCHAR(255),
      discount_type   VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'flat')),
      discount_value  DECIMAL(10,2) NOT NULL CHECK (discount_value > 0),
      scope           VARCHAR(20) NOT NULL DEFAULT 'total' CHECK (scope IN ('total', 'event')),
      event_id        UUID REFERENCES tournament_events(id) ON DELETE SET NULL,
      max_uses        INTEGER,
      current_uses    INTEGER NOT NULL DEFAULT 0,
      valid_from      TIMESTAMPTZ,
      valid_until     TIMESTAMPTZ,
      is_active       BOOLEAN NOT NULL DEFAULT true,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tournament_id, code)
    )
  `);
  pgm.sql('CREATE INDEX IF NOT EXISTS idx_discount_codes_tournament ON discount_codes(tournament_id)');
  pgm.sql('CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(tournament_id, code)');

  // Track which discount code was used on a registration
  pgm.sql('ALTER TABLE registrations ADD COLUMN IF NOT EXISTS discount_code_id UUID REFERENCES discount_codes(id) ON DELETE SET NULL');
  pgm.sql('ALTER TABLE registrations ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2)');
};

exports.down = (pgm) => {
  pgm.sql('ALTER TABLE registrations DROP COLUMN IF EXISTS discount_amount');
  pgm.sql('ALTER TABLE registrations DROP COLUMN IF EXISTS discount_code_id');
  pgm.sql('DROP TABLE IF EXISTS discount_codes');
};
