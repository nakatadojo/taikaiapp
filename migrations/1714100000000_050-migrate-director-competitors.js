/**
 * Migration 050: Copy existing director_competitors JSONB data into
 * the new tournament_director_competitors table created by migration 049.
 *
 * The old director_competitors column on the tournaments table is NOT dropped —
 * it stays as a backup. Only the read/write path in the application changed.
 */
exports.up = async (pgm) => {
  // For every tournament that has a non-empty director_competitors JSONB array,
  // insert each element as a row in tournament_director_competitors.
  // We use a DO $$ block so we can loop in plain SQL without needing PL/pgSQL
  // to be separately enabled.
  await pgm.db.query(`
    DO $$
    DECLARE
      rec   RECORD;
      comp  JSONB;
      comp_id TEXT;
      is_test_val BOOLEAN;
    BEGIN
      FOR rec IN
        SELECT id AS tournament_id, director_competitors
        FROM tournaments
        WHERE director_competitors IS NOT NULL
          AND jsonb_array_length(director_competitors) > 0
      LOOP
        FOR comp IN SELECT * FROM jsonb_array_elements(rec.director_competitors)
        LOOP
          -- Use the existing id if it looks like a UUID, otherwise generate one
          comp_id := comp->>'id';
          is_test_val := (comp->>'is_test')::boolean;

          -- Skip if already migrated (idempotent)
          IF EXISTS (
            SELECT 1 FROM tournament_director_competitors
            WHERE tournament_id = rec.tournament_id
              AND data->>'id' = comp_id
          ) THEN
            CONTINUE;
          END IF;

          -- Also skip if a row with this UUID primary key already exists
          IF comp_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            IF EXISTS (SELECT 1 FROM tournament_director_competitors WHERE id = comp_id::uuid) THEN
              CONTINUE;
            END IF;
            INSERT INTO tournament_director_competitors (id, tournament_id, data, is_test)
            VALUES (
              comp_id::uuid,
              rec.tournament_id,
              comp - 'id',
              COALESCE(is_test_val, false)
            );
          ELSE
            -- Non-UUID legacy id — let the DB generate a new UUID primary key
            INSERT INTO tournament_director_competitors (tournament_id, data, is_test)
            VALUES (
              rec.tournament_id,
              comp,
              COALESCE(is_test_val, false)
            );
          END IF;
        END LOOP;
      END LOOP;
    END $$;
  `);
};

exports.down = async (pgm) => {
  // On rollback: delete rows that were migrated FROM the JSONB column.
  // We identify them by checking if tournament.director_competitors contains a matching entry.
  await pgm.db.query(`
    DELETE FROM tournament_director_competitors tdc
    WHERE EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tdc.tournament_id
        AND t.director_competitors IS NOT NULL
        AND t.director_competitors @> jsonb_build_array(jsonb_build_object('id', tdc.data->>'id'))
    );
  `);
};
