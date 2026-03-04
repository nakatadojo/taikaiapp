# Schema Analysis - Key Findings

## ✅ Fixed Issues

### 1. Database Class Object Handling
**FIXED**: Updated `Database` class to properly handle object-based tables.

#### Changes Made:
- ✅ Added `matSchedule` initialization in `init()`
- ✅ Added `tournaments` initialization in `init()`
- ✅ Added `eventTypes` initialization in `init()`
- ✅ Updated `load()` to return `{}` for object tables: `divisions`, `matSchedule`, `matScoreboards`
- ✅ Updated `clear()` to clear object tables to `{}` instead of `[]`

### 2. Clear All Competitors
**FIXED**: Now properly clears divisions, matches, and schedule when clearing competitors.

---

## ⚠️ Critical Schema Issue: DIVISIONS

### The Problem

There are **TWO SEPARATE WORKFLOWS** that use incompatible schemas:

#### Workflow A: Division Templates (Unused Currently)
Location: `saveDivisionTemplate()` - Lines 1199-1231

```javascript
// Saves as:
divisions[eventId] = {
    criteria: [...],
    updatedAt: "..."
}
```

**Purpose**: Save division criteria templates per event type
**Storage**: By `eventId`

#### Workflow B: Generated Divisions (Currently Active)
Location: `generateDivisions()` - Lines 1255-1285

```javascript
// Generates as:
divisions = {
    "8-10 Male 30-40kg": [competitor1, competitor2],
    "11-13 Female 40-50kg": [competitor3, competitor4]
}
```

**Purpose**: Generate actual divisions with competitors
**Storage**: By division name (flat structure)
**Problem**: **COMPLETELY OVERWRITES** the divisions object!

### The Conflict

1. User creates Event Type "Kumite Adults"
2. User clicks "Configure Divisions" → Opens division builder
3. User saves template → Stores as `divisions["eventId123"] = { criteria: ... }`
4. User clicks "Generate Divisions" → **OVERWRITES EVERYTHING** with flat structure
5. Division templates are **LOST**
6. Can't save more templates because divisions is now flat

### Current Behavior

Based on the code:
- ✅ `generateDivisions()` IS being used (creates flat structure)
- ❓ `saveDivisionTemplate()` EXISTS but conflicts with generation
- ❌ The two cannot coexist with current schema

---

## Recommended Solution

### Option 1: Keep Current (Simple Fix)
**Remove template saving entirely**, only use generation.

**Changes needed:**
- Remove `saveDivisionTemplate()` function
- Remove Division Builder UI from event types
- Keep only template-based generation from `templates` array
- Divisions remain flat: `{ "Division Name": [competitors] }`

**Pros:**
- ✅ Minimal code changes
- ✅ Works with existing data
- ✅ Simple mental model

**Cons:**
- ❌ Can't save division criteria per event
- ❌ Must use global templates

### Option 2: Nested Schema (Complex but Complete)
**Restructure to support both** templates AND generated divisions.

```javascript
divisions = {
    "eventId123": {
        criteria: [...],           // Template
        generated: {               // Generated divisions
            "8-10 Male 30-40kg": [competitors],
            "11-13 Female 40-50kg": [competitors]
        },
        updatedAt: "..."
    },
    "eventId456": { ... }
}
```

**Pros:**
- ✅ Supports templates per event
- ✅ Keeps generated divisions organized
- ✅ Can regenerate divisions per event
- ✅ Clear data hierarchy

**Cons:**
- ❌ Requires refactoring many functions
- ❌ Breaking change (data migration needed)
- ❌ More complex

### Option 3: Hybrid (Recommended)
**Use templates array for reusable templates**, store generated divisions per event.

```javascript
// templates[] - Reusable division templates (ALREADY EXISTS)
templates = [
    { id: 123, name: "Youth Divisions", criteria: [...] },
    { id: 456, name: "Adult Divisions", criteria: [...] }
]

// divisions{} - Generated divisions per event
divisions = {
    "eventId789": {
        templateId: 123,           // Reference to template used
        generated: {               // Generated divisions
            "8-10 Male": [competitors],
            "11-13 Male": [competitors]
        },
        generatedAt: "..."
    }
}
```

**Pros:**
- ✅ Uses existing `templates` array
- ✅ Organizes divisions by event
- ✅ Can reuse templates across events
- ✅ Can regenerate per event
- ✅ Moderate complexity

**Cons:**
- ❌ Still requires refactoring
- ❌ Need to update multiple functions

---

## Current System State

### What's Working:
1. ✅ Competitor registration
2. ✅ Instructor registration
3. ✅ Club management with logos
4. ✅ Event type creation
5. ✅ Template creation (global)
6. ✅ Division generation (flat structure)
7. ✅ Mat scheduling
8. ✅ Scoreboard with TV display
9. ✅ Database clear operations

### What's Broken/Inconsistent:
1. ❌ `saveDivisionTemplate()` conflicts with `generateDivisions()`
2. ❌ Can't save division criteria per event type
3. ❌ Schedule loses connection when divisions regenerated (division names change)
4. ⚠️ No tournament scoping (all data is global)

---

## Immediate Recommendations

### HIGH PRIORITY (Do Now)
1. ✅ **DONE**: Fix `db.clear()` and `db.load()` for object tables
2. ✅ **DONE**: Fix clear competitors to clear divisions properly
3. **CHOOSE**: Pick one of the 3 options above for divisions
4. **IMPLEMENT**: Chosen solution for divisions

### MEDIUM PRIORITY (Do Next)
1. Add tournament scoping to all data
2. Fix schedule-division relationship (use IDs not names)
3. Add data validation

### LOW PRIORITY (Future)
1. Add data export/import
2. Add schema versioning
3. Add automated tests

---

## Questions for User

1. **Division Templates**: Do you want to save division criteria per event type, or use global templates?
2. **Tournament Scoping**: Should each tournament have separate data, or share competitors/instructors?
3. **Data Migration**: Are you okay with a breaking change if needed?

---

## Performance Notes

- All data stored in localStorage (5-10MB limit)
- Base64 images in localStorage can fill quickly
- Consider IndexedDB for larger tournaments
- Current limit: ~100-200 competitors with photos

---

## Security Notes

- All data client-side only
- No authentication/authorization
- Anyone with file access has full access
- Consider adding password protection for tournaments
- Consider server-side storage for production use
