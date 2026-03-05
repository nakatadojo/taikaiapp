/**
 * Criteria Presets — Shared constants and builder for WKF/AAU/Simple division rules.
 * Used by both wizard.html and manage.html to generate app.js-compatible criteria templates.
 */

const CRITERIA_PRESETS = (() => {

  const AGE_GROUPS = [
    { label: 'U6',     min: 4,  max: 5,  tier: 'young' },
    { label: 'U8',     min: 6,  max: 7,  tier: 'young' },
    { label: 'U10',    min: 8,  max: 9,  tier: 'middle' },
    { label: 'U12',    min: 10, max: 11, tier: 'middle' },
    { label: 'U14',    min: 12, max: 13, tier: 'middle' },
    { label: 'U16',    min: 14, max: 15, tier: 'older' },
    { label: 'U18',    min: 16, max: 17, tier: 'older' },
    { label: 'Adult',  min: 18, max: 34, tier: 'older' },
    { label: 'Senior', min: 35, max: 99, tier: 'senior' },
  ];

  const GENDERS = [
    { value: 'male',   label: 'Male' },
    { value: 'female', label: 'Female' },
  ];

  const RANK_ORDER = [
    'white', 'yellow', 'orange', 'green', 'blue', 'purple', 'brown',
    'black', '1st dan', '2nd dan', '3rd dan', '4th dan', '5th dan',
    '6th dan', '7th dan', '8th dan', '9th dan', '10th dan',
  ];

  // AAU experience levels — age-tier dependent
  const AAU_TIERS = {
    young: {
      label: 'Young (U6-U8)',
      ages: AGE_GROUPS.filter(ag => ag.tier === 'young'),
      ranks: [
        { label: 'Beginner',     rankMin: 'white',  rankMax: 'yellow' },
        { label: 'Intermediate', rankMin: 'orange', rankMax: 'blue' },
        { label: 'Advanced',     rankMin: 'purple', rankMax: 'brown' },
      ],
    },
    middle: {
      label: 'Middle (U10-U14)',
      ages: AGE_GROUPS.filter(ag => ag.tier === 'middle'),
      ranks: [
        { label: 'Beginner',     rankMin: 'white',  rankMax: 'yellow' },
        { label: 'Intermediate', rankMin: 'orange', rankMax: 'green' },
        { label: 'Advanced',     rankMin: 'blue',   rankMax: 'brown' },
        { label: 'Black Belt',   rankMin: 'black',  rankMax: '10th dan' },
      ],
    },
    older: {
      label: 'Older (U16-Adult)',
      ages: AGE_GROUPS.filter(ag => ag.tier === 'older'),
      ranks: [
        { label: 'Novice',       rankMin: 'white',   rankMax: 'green' },
        { label: 'Intermediate', rankMin: 'blue',    rankMax: 'brown' },
        { label: 'Advanced',     rankMin: '1st dan', rankMax: '3rd dan' },
        { label: 'Elite',        rankMin: '4th dan', rankMax: '10th dan' },
      ],
    },
    senior: {
      label: 'Senior',
      ages: AGE_GROUPS.filter(ag => ag.tier === 'senior'),
      ranks: [
        { label: 'Novice',     rankMin: 'white', rankMax: 'brown' },
        { label: 'Black Belt', rankMin: 'black', rankMax: '10th dan' },
      ],
    },
  };

  // WKF belt groupings — same for all ages
  const WKF_BELTS = [
    { label: 'White-Yellow',  rankMin: 'white',  rankMax: 'yellow' },
    { label: 'Orange-Green',  rankMin: 'orange', rankMax: 'green' },
    { label: 'Blue-Purple',   rankMin: 'blue',   rankMax: 'purple' },
    { label: 'Brown',         rankMin: 'brown',  rankMax: 'brown' },
    { label: 'Black Belt',    rankMin: 'black',  rankMax: '10th dan' },
  ];

  const EVENT_TYPE_LABELS = {
    kata:        'Kata',
    kumite:      'Kumite',
    weapons:     'Weapons',
    'team-kata': 'Team Kata',
  };

  /**
   * Build criteria templates for a given preset and event type.
   * Returns an array of app.js-compatible template objects.
   */
  function buildTemplates(preset, eventType) {
    if (eventType === 'team-kata') {
      // Team kata: age groups only, mixed gender
      return [{
        id: 1,
        name: 'Team Kata Standard',
        criteria: [
          {
            type: 'age',
            ranges: AGE_GROUPS.map(ag => ({ label: ag.label, min: ag.min, max: ag.max })),
          },
        ],
      }];
    }

    if (preset === 'simple') {
      return [{
        id: 1,
        name: 'Simple',
        criteria: [
          {
            type: 'age',
            ranges: AGE_GROUPS.map(ag => ({ label: ag.label, min: ag.min, max: ag.max })),
          },
          {
            type: 'gender',
            ranges: GENDERS.map(g => ({ value: g.value, label: g.label })),
          },
        ],
      }];
    }

    if (preset === 'wkf') {
      return [{
        id: 1,
        name: 'WKF Standard',
        criteria: [
          {
            type: 'age',
            ranges: AGE_GROUPS.map(ag => ({ label: ag.label, min: ag.min, max: ag.max })),
          },
          {
            type: 'gender',
            ranges: GENDERS.map(g => ({ value: g.value, label: g.label })),
          },
          {
            type: 'rank',
            ranges: WKF_BELTS.map(b => ({ label: b.label, rankMin: b.rankMin, rankMax: b.rankMax })),
          },
        ],
      }];
    }

    if (preset === 'aau') {
      // AAU: one template per age tier (different rank groupings per tier)
      let id = 1;
      return Object.values(AAU_TIERS).map(tier => ({
        id: id++,
        name: `AAU ${tier.label}`,
        criteria: [
          {
            type: 'age',
            ranges: tier.ages.map(ag => ({ label: ag.label, min: ag.min, max: ag.max })),
          },
          {
            type: 'gender',
            ranges: GENDERS.map(g => ({ value: g.value, label: g.label })),
          },
          {
            type: 'rank',
            ranges: tier.ranks.map(r => ({ label: r.label, rankMin: r.rankMin, rankMax: r.rankMax })),
          },
        ],
      }));
    }

    // Custom: empty — director will build from scratch in manage page
    return [];
  }

  /**
   * Get a human-readable summary of what a preset includes.
   */
  function getPresetSummary(preset) {
    if (preset === 'simple') {
      return `${AGE_GROUPS.length} age groups \u00d7 2 genders. No rank/belt split.`;
    }
    if (preset === 'wkf') {
      return `${AGE_GROUPS.length} age groups \u00d7 2 genders \u00d7 ${WKF_BELTS.length} belt groups. Divisions generated from registered competitors.`;
    }
    if (preset === 'aau') {
      return `${AGE_GROUPS.length} age groups \u00d7 2 genders \u00d7 3-4 experience levels (age-dependent). Divisions generated from registered competitors.`;
    }
    return 'Custom criteria. You\u2019ll configure division rules in the Tournament Manager.';
  }

  return {
    AGE_GROUPS,
    GENDERS,
    RANK_ORDER,
    AAU_TIERS,
    WKF_BELTS,
    EVENT_TYPE_LABELS,
    buildTemplates,
    getPresetSummary,
  };
})();
