/**
 * Migration 040 — Update Credit Packages
 *
 * Replaces the original hardcoded packages (seeded in migration 009)
 * with the new 4-tier pricing model:
 *
 *   Starter      —  25 credits — $50.00  ($2.00/credit)
 *   Club         — 100 credits — $160.00 ($1.60/credit, 20% off)
 *   Regional     — 300 credits — $420.00 ($1.40/credit, 30% off)
 *   Championship — 600 credits — $720.00 ($1.20/credit, 40% off)
 */

exports.up = (pgm) => {
  pgm.sql(`
    DELETE FROM credit_packages;

    INSERT INTO credit_packages (slug, credits, price_in_cents, label, sort_order) VALUES
    ('starter',      25,  5000,  'Starter — 25 credits',       1),
    ('club',        100, 16000,  'Club — 100 credits',          2),
    ('regional',    300, 42000,  'Regional — 300 credits',      3),
    ('championship',600, 72000,  'Championship — 600 credits',  4);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM credit_packages;

    INSERT INTO credit_packages (slug, credits, price_in_cents, label, sort_order) VALUES
    ('starter',  50,  4900,  'Starter — 50 credits',  1),
    ('standard', 150, 12900, 'Standard — 150 credits', 2),
    ('pro',      500, 39900, 'Pro — 500 credits',      3);
  `);
};
