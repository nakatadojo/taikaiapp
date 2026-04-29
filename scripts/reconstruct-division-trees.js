/**
 * Reconstruct division_tree from criteria_templates for events that have templates
 * but no division_tree (e.g. seeded via script rather than built via UI).
 *
 * Run: node scripts/reconstruct-division-trees.js
 */
require('dotenv').config();
const pool = require('../server/db/pool');
const { v4: uuidv4 } = require('uuid');

const TOURNAMENT_ID = 'e42eeb54-8258-41cc-b898-42e42c330abf';

/**
 * Build a tree from a flat list of criteria_templates.
 * Each template has: { id, name, criteria: [{type, ranges: [{label, ...values}]}] }
 *
 * We use a trie-style build: for each template, walk its criteria levels and
 * create/reuse nodes at each level. The template ID becomes the leaf node's ID
 * so that generated_divisions (which stores competitor IDs by template ID) still
 * resolves correctly.
 */
function buildTreeFromTemplates(eventName, templates) {
  const root = {
    id: uuidv4(),
    label: eventName,
    codePrefix: '',
    criteriaType: null,
    criteriaValue: null,
    children: [],
    _weightUnit: 'kg',
  };

  for (const tpl of templates) {
    const criteria = tpl.criteria || [];
    let parent = root;

    for (let i = 0; i < criteria.length; i++) {
      const c = criteria[i];
      const range = c.ranges?.[0] || {};
      const label = range.label || c.type;
      const isLast = i === criteria.length - 1;

      // Build the criteriaValue matching what the tree builder stores
      let criteriaValue = {};
      switch (c.type) {
        case 'gender':
          criteriaValue = { value: range.value || label };
          break;
        case 'age':
        case 'weight':
        case 'experience':
          criteriaValue = { min: range.min ?? 0, max: range.max ?? 999, label };
          break;
        case 'rank':
          criteriaValue = { rankMin: range.rankMin || '', rankMax: range.rankMax || '', label };
          break;
        default:
          criteriaValue = { value: label };
      }

      if (isLast) {
        // Use the template's own ID as the leaf node ID so that
        // generated_divisions lookups by leaf ID still work.
        const leaf = {
          id: tpl.id,
          label,
          codePrefix: '',
          criteriaType: c.type,
          criteriaValue,
          children: [],
        };
        parent.children.push(leaf);
      } else {
        // Find or create an intermediate node for this criteria level+value
        const existingKey = JSON.stringify({ type: c.type, label });
        let existing = parent.children.find(
          ch => ch.criteriaType === c.type && ch.label === label
        );
        if (!existing) {
          existing = {
            id: uuidv4(),
            label,
            codePrefix: '',
            criteriaType: c.type,
            criteriaValue,
            children: [],
          };
          parent.children.push(existing);
        }
        parent = existing;
      }
    }

    // If template has no criteria, add as a custom leaf directly under root
    if (criteria.length === 0) {
      root.children.push({
        id: tpl.id,
        label: tpl.name,
        codePrefix: '',
        criteriaType: 'custom',
        criteriaValue: { value: tpl.name },
        children: [],
      });
    }
  }

  return root;
}

async function main() {
  const { rows } = await pool.query(
    `SELECT id, name, criteria_templates, division_tree
     FROM tournament_events
     WHERE tournament_id = $1`,
    [TOURNAMENT_ID]
  );

  for (const row of rows) {
    const templates = row.criteria_templates || [];
    if (templates.length === 0) {
      console.log(`SKIP  ${row.name} — no criteria_templates`);
      continue;
    }
    if (row.division_tree) {
      console.log(`SKIP  ${row.name} — division_tree already exists`);
      continue;
    }

    const tree = buildTreeFromTemplates(row.name, templates);
    await pool.query(
      `UPDATE tournament_events SET division_tree = $1 WHERE id = $2`,
      [JSON.stringify(tree), row.id]
    );
    console.log(`✓  ${row.name} — reconstructed tree with ${templates.length} leaf divisions`);
  }

  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); process.exit(1); });
