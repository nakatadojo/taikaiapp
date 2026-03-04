# Tournament Management System - Schema Analysis

## Critical Issues Found

### 1. **DIVISIONS DATA STRUCTURE INCONSISTENCY** ⚠️ CRITICAL

The `divisions` object has **three conflicting schemas**:

#### Schema A: Template Storage (saveDivisionTemplate)
```javascript
divisions = {
  "eventId": {
    criteria: [...],
    updatedAt: "timestamp"
  }
}
```

#### Schema B: Generated Divisions (generateDivisions)
```javascript
divisions = {
  "Division Name (e.g., '8-10 Male 30-40kg')": [
    { competitor1 },
    { competitor2 },
    ...
  ]
}
```

#### Schema C: Expected by Certificate Generation
```javascript
divisions = {
  "eventId": [
    { division1 },
    { division2 }
  ]
}
```

**Problem**: These three schemas are incompatible and will cause data corruption!

---

## Current Data Structure

### ✅ Arrays (Correct)
- `competitors[]` - Array of competitor objects
- `instructors[]` - Array of instructor objects
- `clubs[]` - Array of club objects with logos
- `templates[]` - Array of division template objects
- `mats[]` - Array of mat objects
- `matches[]` - Array of match objects
- `tournaments[]` - Array of tournament objects
- `eventTypes[]` - Array of event type objects

### ⚠️ Objects (Inconsistent)
- `divisions{}` - **INCONSISTENT** (see above)
- `matSchedule{}` - Object mapping matId to scheduled divisions
  ```javascript
  {
    "1": [{ time, division, eventId }],
    "2": [{ time, division, eventId }]
  }
  ```
- `matScoreboards{}` - Object mapping matId to scoreboard state

---

## Database Methods vs. Data Types

### Problem with `db.clear()`
```javascript
clear(table) {
    this.save(table, []);  // Always saves empty array
}
```

This is **wrong for object-based tables**:
- ❌ `divisions` should be cleared to `{}`
- ❌ `matSchedule` should be cleared to `{}`
- ❌ `matScoreboards` should be cleared to `{}`

### Problem with `db.load()`
```javascript
load(table) {
    const data = localStorage.getItem(table);
    if (table === 'divisions') {
        return JSON.parse(data || '{}');  // Only divisions gets special handling
    }
    return JSON.parse(data || '[]');
}
```

**Missing**: `matSchedule` and `matScoreboards` need the same object handling!

---

## Recommended Fixes

### 1. Standardize Divisions Schema

**Proposed Schema**:
```javascript
divisions = {
  "eventId": {
    criteria: [...],           // Template criteria
    generated: {               // Generated divisions
      "8-10 Male 30-40kg": [   // Division name -> competitors
        { competitor1 },
        { competitor2 }
      ],
      "11-13 Female 40-50kg": [...]
    },
    updatedAt: "timestamp"
  }
}
```

This schema:
- ✅ Stores templates (criteria)
- ✅ Stores generated divisions by name
- ✅ Organized by eventId
- ✅ Single source of truth

### 2. Fix Database Methods

```javascript
load(table) {
    const data = localStorage.getItem(table);
    const objectTables = ['divisions', 'matSchedule', 'matScoreboards'];
    if (objectTables.includes(table)) {
        return JSON.parse(data || '{}');
    }
    return JSON.parse(data || '[]');
}

clear(table) {
    const objectTables = ['divisions', 'matSchedule', 'matScoreboards'];
    if (objectTables.includes(table)) {
        this.save(table, {});
    } else {
        this.save(table, []);
    }
}
```

### 3. Add Tournament Scoping

Currently, all data is global. For multi-tournament support:

```javascript
// Instead of:
localStorage.getItem('competitors')

// Should be:
localStorage.getItem(`tournament_${tournamentId}_competitors`)
```

---

## Missing Initializations

### In `Database.init()`:

Missing:
- `tournaments` - Should initialize to `[]`
- `eventTypes` - Should initialize to `[]`

These are currently initialized conditionally in their respective functions, which is inconsistent.

---

## Data Flow Issues

### Division Generation Flow
1. User creates Event Type → stored in `eventTypes[]`
2. User creates Division Template → stored in `divisions[eventId].criteria`
3. User generates divisions → **OVERWRITES** entire divisions object!
4. Generated divisions lost when template saved again

**Solution**: Use the proposed nested schema above.

---

## Schedule Data Inconsistency

### matSchedule Storage
```javascript
matSchedule = {
  "1": [
    { time: "9:00 AM", division: "8-10 Male", eventId: "123" }
  ]
}
```

**Problem**: Division name is stored, but when divisions are regenerated with different names, schedule becomes invalid!

**Solution**: Store division ID or criteria hash instead of name.

---

## Summary of Required Changes

### HIGH PRIORITY
1. ✅ Fix `db.clear()` to handle object tables
2. ✅ Fix `db.load()` to handle all object tables
3. ⚠️ Redesign divisions schema (BREAKING CHANGE)
4. ⚠️ Add tournament scoping to all data

### MEDIUM PRIORITY
5. Add missing initializations (tournaments, eventTypes)
6. Fix schedule-division relationship
7. Add data migration for existing users

### LOW PRIORITY
8. Add data validation
9. Add schema versioning
10. Add export/import with schema validation

---

## Current State Assessment

### What Works ✅
- Competitor registration
- Instructor registration with club logos
- Club management
- Event type creation
- Mat configuration
- Basic scoreboard functionality

### What's Broken ⚠️
- Division template + generation workflow (schema conflict)
- Clear competitors doesn't properly clear divisions
- Multi-tournament support incomplete
- Certificate generation expects wrong schema
- Schedule loses connection to divisions after regeneration

---

## Immediate Action Items

1. **Fix db.clear() for object tables** (5 minutes)
2. **Fix db.load() for object tables** (5 minutes)
3. **Document current division schema used** (check what actual data looks like)
4. **Plan migration strategy** if changing divisions schema
