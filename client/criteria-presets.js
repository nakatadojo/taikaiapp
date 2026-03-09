/**
 * Criteria Presets — WKF & AAU division rules with match durations and weight classes.
 * Used by wizard.html, manage.html, and app.js.
 */

const CRITERIA_PRESETS = (() => {

  /* ═══════════════════════════════════════════════════════════════════
   *  RANK ORDER — shared belt ranking used for grouped range matching
   * ═══════════════════════════════════════════════════════════════════ */
  const RANK_ORDER = [
    'white', 'yellow', 'orange', 'green', 'blue', 'purple', 'brown',
    'black', '1st dan', '2nd dan', '3rd dan', '4th dan', '5th dan',
    '6th dan', '7th dan', '8th dan', '9th dan', '10th dan',
  ];

  const GENDERS = [
    { value: 'male',   label: 'Male' },
    { value: 'female', label: 'Female' },
  ];

  const EVENT_TYPE_LABELS = {
    kata:        'Kata',
    kumite:      'Kumite',
    weapons:     'Weapons',
    'team-kata': 'Team Kata',
    'team-kumite': 'Team Kumite',
  };

  /* ═══════════════════════════════════════════════════════════════════
   *  WKF DEFINITIONS
   * ═══════════════════════════════════════════════════════════════════ */
  const WKF_AGE_GROUPS = [
    { label: 'Mini Kids', min: 6,  max: 7,  kumiteDuration: 60  },
    { label: 'Kids',      min: 8,  max: 11, kumiteDuration: 90  },
    { label: 'Cadets',    min: 12, max: 13, kumiteDuration: 90  },
    { label: 'Juniors',   min: 14, max: 15, kumiteDuration: 120 },
    { label: 'Youth',     min: 16, max: 17, kumiteDuration: 120 },
    { label: 'Under 21',  min: 18, max: 20, kumiteDuration: 180 },
    { label: 'Seniors',   min: 21, max: 99, kumiteDuration: 180 },
  ];

  const WKF_BELTS = [
    { label: 'White-Yellow',  rankMin: 'white',  rankMax: 'yellow' },
    { label: 'Orange-Green',  rankMin: 'orange', rankMax: 'green' },
    { label: 'Blue-Purple',   rankMin: 'blue',   rankMax: 'purple' },
    { label: 'Brown',         rankMin: 'brown',  rankMax: 'brown' },
    { label: 'Black Belt',    rankMin: 'black',  rankMax: '10th dan' },
  ];

  // WKF Kumite weight classes — keyed by "ageLabel-gender"
  const WKF_WEIGHTS = {
    'Cadets-male':   [{ label: '-52kg', min: 0, max: 52 }, { label: '-57kg', min: 52.01, max: 57 }, { label: '-63kg', min: 57.01, max: 63 }, { label: '-70kg', min: 63.01, max: 70 }, { label: '+70kg', min: 70.01, max: 999 }],
    'Cadets-female': [{ label: '-47kg', min: 0, max: 47 }, { label: '-54kg', min: 47.01, max: 54 }, { label: '+54kg', min: 54.01, max: 999 }],
    'Juniors-male':  [{ label: '-55kg', min: 0, max: 55 }, { label: '-61kg', min: 55.01, max: 61 }, { label: '-68kg', min: 61.01, max: 68 }, { label: '-76kg', min: 68.01, max: 76 }, { label: '+76kg', min: 76.01, max: 999 }],
    'Juniors-female':[{ label: '-48kg', min: 0, max: 48 }, { label: '-53kg', min: 48.01, max: 53 }, { label: '-59kg', min: 53.01, max: 59 }, { label: '+59kg', min: 59.01, max: 999 }],
    'Youth-male':    [{ label: '-55kg', min: 0, max: 55 }, { label: '-61kg', min: 55.01, max: 61 }, { label: '-68kg', min: 61.01, max: 68 }, { label: '-76kg', min: 68.01, max: 76 }, { label: '+76kg', min: 76.01, max: 999 }],
    'Youth-female':  [{ label: '-48kg', min: 0, max: 48 }, { label: '-53kg', min: 48.01, max: 53 }, { label: '-59kg', min: 53.01, max: 59 }, { label: '+59kg', min: 59.01, max: 999 }],
    'Under 21-male': [{ label: '-60kg', min: 0, max: 60 }, { label: '-67kg', min: 60.01, max: 67 }, { label: '-75kg', min: 67.01, max: 75 }, { label: '-84kg', min: 75.01, max: 84 }, { label: '+84kg', min: 84.01, max: 999 }],
    'Under 21-female':[{ label: '-50kg', min: 0, max: 50 }, { label: '-55kg', min: 50.01, max: 55 }, { label: '-61kg', min: 55.01, max: 61 }, { label: '-68kg', min: 61.01, max: 68 }, { label: '+68kg', min: 68.01, max: 999 }],
    'Seniors-male':  [{ label: '-60kg', min: 0, max: 60 }, { label: '-67kg', min: 60.01, max: 67 }, { label: '-75kg', min: 67.01, max: 75 }, { label: '-84kg', min: 75.01, max: 84 }, { label: '+84kg', min: 84.01, max: 999 }],
    'Seniors-female':[{ label: '-50kg', min: 0, max: 50 }, { label: '-55kg', min: 50.01, max: 55 }, { label: '-61kg', min: 55.01, max: 61 }, { label: '-68kg', min: 61.01, max: 68 }, { label: '+68kg', min: 68.01, max: 999 }],
  };

  /* ═══════════════════════════════════════════════════════════════════
   *  AAU DEFINITIONS
   * ═══════════════════════════════════════════════════════════════════ */
  const AAU_AGE_GROUPS = [
    { label: '5 & Under', min: 4,  max: 5,  kumiteDuration: 60,  tier: 'young' },
    { label: '6-7',       min: 6,  max: 7,  kumiteDuration: 60,  tier: 'young' },
    { label: '8-9',       min: 8,  max: 9,  kumiteDuration: 90,  tier: 'middle' },
    { label: '10-11',     min: 10, max: 11, kumiteDuration: 90,  tier: 'middle' },
    { label: '12-13',     min: 12, max: 13, kumiteDuration: 120, tier: 'older' },
    { label: '14-15',     min: 14, max: 15, kumiteDuration: 120, tier: 'older' },
    { label: '16-17',     min: 16, max: 17, kumiteDuration: 120, tier: 'older' },
    { label: '18+ Adult', min: 18, max: 99, kumiteDuration: 180, tier: 'adult' },
  ];

  // AAU experience levels per age tier
  const AAU_EXPERIENCE = {
    young: [
      { label: 'Beginner',     rankMin: 'white',  rankMax: 'yellow' },
      { label: 'Intermediate', rankMin: 'orange', rankMax: 'blue' },
      { label: 'Advanced',     rankMin: 'purple', rankMax: 'brown' },
    ],
    middle: [
      { label: 'Beginner',     rankMin: 'white',  rankMax: 'yellow' },
      { label: 'Intermediate', rankMin: 'orange', rankMax: 'green' },
      { label: 'Advanced',     rankMin: 'blue',   rankMax: 'brown' },
      { label: 'Black Belt',   rankMin: 'black',  rankMax: '10th dan' },
    ],
    older: [
      { label: 'Novice',       rankMin: 'white',   rankMax: 'green' },
      { label: 'Intermediate', rankMin: 'blue',    rankMax: 'brown' },
      { label: 'Advanced',     rankMin: '1st dan', rankMax: '3rd dan' },
      { label: 'Elite',        rankMin: '4th dan', rankMax: '10th dan' },
    ],
    adult: [
      { label: 'Novice',     rankMin: 'white', rankMax: 'brown' },
      { label: 'Black Belt', rankMin: 'black', rankMax: '10th dan' },
    ],
  };

  // AAU Kumite weight classes — only for Black Belt 14+
  const AAU_BB_WEIGHTS = {
    male:   [{ label: 'Light', min: 0, max: 68 }, { label: 'Medium', min: 68.01, max: 80 }, { label: 'Heavy', min: 80.01, max: 999 }],
    female: [{ label: 'Light', min: 0, max: 55 }, { label: 'Medium', min: 55.01, max: 68 }, { label: 'Heavy', min: 68.01, max: 999 }],
  };

  /* ═══════════════════════════════════════════════════════════════════
   *  SIMPLE PRESET — generic age groups, no rank/weight
   * ═══════════════════════════════════════════════════════════════════ */
  const SIMPLE_AGE_GROUPS = [
    { label: 'U6',     min: 4,  max: 5  },
    { label: 'U8',     min: 6,  max: 7  },
    { label: 'U10',    min: 8,  max: 9  },
    { label: 'U12',    min: 10, max: 11 },
    { label: 'U14',    min: 12, max: 13 },
    { label: 'U16',    min: 14, max: 15 },
    { label: 'U18',    min: 16, max: 17 },
    { label: 'Adult',  min: 18, max: 34 },
    { label: 'Senior', min: 35, max: 99 },
  ];

  /* ═══════════════════════════════════════════════════════════════════
   *  BUILD TEMPLATES
   * ═══════════════════════════════════════════════════════════════════ */

  /**
   * Build criteria templates for a given preset and event type.
   * Returns an array of template objects, each with:
   *   { id, name, matchDuration, criteria: [...] }
   */
  function buildTemplates(preset, eventType) {
    if (eventType === 'team-kata') {
      // Team kata: age groups only, no gender/rank/weight split
      const ageGroups = preset === 'wkf' ? WKF_AGE_GROUPS : preset === 'aau' ? AAU_AGE_GROUPS : SIMPLE_AGE_GROUPS;
      return [{
        id: 1,
        name: 'Team Kata',
        criteria: [{
          type: 'age',
          ranges: ageGroups.map(ag => ({ label: ag.label, min: ag.min, max: ag.max })),
        }],
      }];
    }

    if (preset === 'simple') {
      return [{
        id: 1,
        name: 'Simple',
        criteria: [
          { type: 'age', ranges: SIMPLE_AGE_GROUPS.map(ag => ({ label: ag.label, min: ag.min, max: ag.max })) },
          { type: 'gender', ranges: GENDERS.map(g => ({ value: g.value, label: g.label })) },
        ],
      }];
    }

    if (preset === 'wkf') {
      return buildWKFTemplates(eventType);
    }

    if (preset === 'aau') {
      return buildAAUTemplates(eventType);
    }

    // Custom: empty — director builds from scratch
    return [];
  }

  /**
   * WKF templates — one template per age group for Kumite (each has different weight classes + duration).
   * Kata/Weapons: single template with all age groups, no weight.
   */
  function buildWKFTemplates(eventType) {
    const isKumite = eventType === 'kumite';

    if (!isKumite) {
      // Kata / Weapons: one template, all age groups, gender + belt split
      return [{
        id: 1,
        name: 'WKF Kata/Weapons',
        criteria: [
          { type: 'age', ranges: WKF_AGE_GROUPS.map(ag => ({ label: ag.label, min: ag.min, max: ag.max })) },
          { type: 'gender', ranges: GENDERS.map(g => ({ value: g.value, label: g.label })) },
          { type: 'rank', ranges: WKF_BELTS.map(b => ({ label: b.label, rankMin: b.rankMin, rankMax: b.rankMax })) },
        ],
      }];
    }

    // Kumite: one template per age group (each has unique weight classes and duration)
    let id = 1;
    return WKF_AGE_GROUPS.map(ag => {
      const criteria = [
        { type: 'age', ranges: [{ label: ag.label, min: ag.min, max: ag.max }] },
        { type: 'gender', ranges: GENDERS.map(g => ({ value: g.value, label: g.label })) },
        { type: 'rank', ranges: WKF_BELTS.map(b => ({ label: b.label, rankMin: b.rankMin, rankMax: b.rankMax })) },
      ];

      // Add weight classes for Cadets and above
      const maleWeights = WKF_WEIGHTS[`${ag.label}-male`];
      const femaleWeights = WKF_WEIGHTS[`${ag.label}-female`];
      if (maleWeights || femaleWeights) {
        // Combine all unique weight ranges (male has more categories typically)
        const allWeights = maleWeights || femaleWeights;
        criteria.push({
          type: 'weight',
          ranges: allWeights.map(w => ({ label: w.label, min: w.min, max: w.max })),
          // Store per-gender weight maps for accurate division generation
          genderWeights: {
            male: maleWeights || allWeights,
            female: femaleWeights || allWeights,
          },
        });
      }

      return {
        id: id++,
        name: `WKF Kumite ${ag.label}`,
        matchDuration: ag.kumiteDuration,
        criteria,
      };
    });
  }

  /**
   * AAU templates — one template per age tier for Kumite (experience levels differ per tier).
   * Black Belt 14+ Kumite gets weight classes.
   */
  function buildAAUTemplates(eventType) {
    const isKumite = eventType === 'kumite';
    const tiers = {};

    // Group age groups by tier
    AAU_AGE_GROUPS.forEach(ag => {
      if (!tiers[ag.tier]) tiers[ag.tier] = [];
      tiers[ag.tier].push(ag);
    });

    let id = 1;
    return Object.entries(tiers).map(([tier, ageGroups]) => {
      const expLevels = AAU_EXPERIENCE[tier] || [];
      const maxDuration = Math.max(...ageGroups.map(ag => ag.kumiteDuration));

      const criteria = [
        { type: 'age', ranges: ageGroups.map(ag => ({ label: ag.label, min: ag.min, max: ag.max })) },
        { type: 'gender', ranges: GENDERS.map(g => ({ value: g.value, label: g.label })) },
        { type: 'rank', ranges: expLevels.map(r => ({ label: r.label, rankMin: r.rankMin, rankMax: r.rankMax })) },
      ];

      // Add weight classes for Black Belt Kumite 14+ only
      if (isKumite && (tier === 'older' || tier === 'adult')) {
        criteria.push({
          type: 'weight',
          ranges: AAU_BB_WEIGHTS.male.map(w => ({ label: w.label, min: w.min, max: w.max })),
          blackBeltOnly: true,  // app.js will only apply weights when rank is Black Belt
          genderWeights: AAU_BB_WEIGHTS,
        });
      }

      const tierLabel = tier === 'young' ? 'Young (5-7)' :
                        tier === 'middle' ? 'Middle (8-11)' :
                        tier === 'older' ? 'Older (12-17)' : 'Adult (18+)';

      return {
        id: id++,
        name: `AAU ${tierLabel}`,
        matchDuration: isKumite ? maxDuration : undefined,
        criteria,
      };
    });
  }

  /**
   * Get the default Kumite match duration for a preset (used as fallback).
   */
  function getDefaultDuration(preset) {
    if (preset === 'wkf') return 180;
    if (preset === 'aau') return 120;
    return 120;
  }

  /**
   * Get a human-readable summary of what a preset includes.
   */
  function getPresetSummary(preset) {
    if (preset === 'simple') {
      return `${SIMPLE_AGE_GROUPS.length} age groups \u00d7 2 genders. No rank/belt or weight split.`;
    }
    if (preset === 'wkf') {
      return `${WKF_AGE_GROUPS.length} WKF age categories (Mini Kids\u2013Seniors) \u00d7 2 genders \u00d7 ${WKF_BELTS.length} belt groups. Kumite includes weight classes for Cadets+. Match durations: 60s\u2013180s by age.`;
    }
    if (preset === 'aau') {
      return `${AAU_AGE_GROUPS.length} AAU age groups (5 & Under\u201318+ Adult) \u00d7 2 genders \u00d7 experience levels. Weight classes for Black Belt Kumite 14+. Match durations: 60s\u2013180s by age.`;
    }
    return 'Custom criteria. You\u2019ll configure division rules in the Tournament Manager.';
  }

  return {
    RANK_ORDER,
    GENDERS,
    EVENT_TYPE_LABELS,
    WKF_AGE_GROUPS,
    WKF_BELTS,
    WKF_WEIGHTS,
    AAU_AGE_GROUPS,
    AAU_EXPERIENCE,
    AAU_BB_WEIGHTS,
    SIMPLE_AGE_GROUPS,
    buildTemplates,
    getPresetSummary,
    getDefaultDuration,
  };
})();
