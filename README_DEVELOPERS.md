# Developer Guide
## Karate Tournament Management System

## 🚀 Quick Start

### For New Developers:
1. Read `CODE_ANNOTATIONS.md` first
2. Open `app.js` and read the header comment
3. Review `AUDIT_REPORT.md` to understand known issues
4. Use annotations to navigate code

### Making Your First Change:
1. Find the section in `app.js` (search for `═══════`)
2. Read the annotation header
3. Make your changes
4. **UPDATE the annotation** (MANDATORY!)
5. Test against known issues listed in annotation

---

## 📂 File Structure

```
TOURNAMENT/
├── index.html              - Main app UI
├── app.js                  - Main application logic (ANNOTATED)
├── styles.css              - Desktop-only styling
├── tv-display.html         - Full-screen scoreboard for audience
├── public.html             - Mobile-optimized public site
├── public-styles.css       - Public site styling
│
├── CODE_ANNOTATIONS.md     - 📖 START HERE - Annotation system guide
├── AUDIT_REPORT.md         - 🐛 23 critical bugs documented
├── SCHEMA_ANALYSIS.md      - 💾 Data structure deep dive
├── FINDINGS.md             - 📊 Analysis summary
├── README_DEVELOPERS.md    - 👋 This file
│
├── debug.html              - Debugging tools
├── check-divisions.html    - Division data inspector
└── import-data.html        - Import 200 test competitors
```

---

## 🔑 Key Concepts

### localStorage Tables

All data stored in browser localStorage:

| Table | Type | Purpose |
|-------|------|---------|
| `competitors` | Array | Registered competitors |
| `instructors` | Array | Instructors with club logos |
| `clubs` | Array | Club data with logos |
| `eventTypes` | Array | Event configurations (Kumite, Kata, etc.) |
| `divisions` | **Object** | Event criteria + generated divisions |
| `brackets` | Object | Elimination brackets |
| `matSchedule` | Object | Mat time slot assignments |
| `tournaments` | Array | Tournament metadata |

⚠️ **CRITICAL**: `divisions` has inconsistent schema - see AUDIT_REPORT.md #2

### Data Flow

```
Tournament → Competitors → Divisions → Brackets → Schedule → Scoreboard → Results
```

### Navigation Structure

```
Dashboard
├── Competitors (registration)
├── Instructors (with club logos)
├── Event Types (Kumite, Kata, etc.)
├── Divisions (criteria → generation)
├── Brackets (elimination trees)
├── Schedule (mat assignments)
├── Scoreboards (operator controls + TV display)
├── Results (certificates)
└── Public Site (mobile website)
```

---

## ⚠️ Critical Issues

### 🔴 HIGHEST PRIORITY

**Division Criteria Disappearing** (Bug #1)
- **Location**: `app.js` lines 1280-1360
- **Cause**: Data structure overwriting
- **Impact**: Users lose configured criteria
- **Status**: Documented, not fixed
- **Fix**: See AUDIT_REPORT.md #1

### 🔴 HIGH PRIORITY

**No Tournament Scoping** (Bug #4)
- **Issue**: All data is global, not per-tournament
- **Impact**: Multiple tournaments have data collisions
- **Fix**: Prefix localStorage keys with tournamentId

**Clear Competitors Wipes Divisions** (Bug #3)
- **Issue**: Clearing competitors deletes ALL division data
- **Impact**: Users lose criteria templates
- **Fix**: Separate operations or warn users

---

## 📋 Common Tasks

### Adding a New Feature

1. **Choose location** in app.js
2. **Add annotation header** (use template from CODE_ANNOTATIONS.md)
3. **Write code**
4. **Update annotation** with data structures, workflow
5. **Test** against edge cases
6. **Document limitations** in KNOWN ISSUES section

### Fixing a Bug

1. **Check AUDIT_REPORT.md** - might be documented
2. **Read annotation** for affected section
3. **Fix the bug**
4. **Remove from KNOWN ISSUES** in annotation
5. **Update Last Updated date**
6. **Test related functionality** (check FLOW section)

### Refactoring

1. **Read all annotations** for affected sections
2. **Note all KNOWN ISSUES** - don't reintroduce bugs
3. **Refactor code**
4. **Update ALL affected annotations**
5. **Update data flow diagram** if changed
6. **Test entire workflow** end-to-end

---

## 🐛 Debugging Tips

### Division Not Showing
1. Check console logs (extensive logging in generateDivisions)
2. Open `check-divisions.html` to inspect data
3. Verify eventId matches between criteria and generated
4. Check if `divisions[eventId].generated` exists

### Scoreboard Not Syncing
1. Check localStorage['scoreboard-state']
2. Verify TV display is polling
3. Check for timer conflicts (multiple mats)
4. Ensure updateOperatorTVDisplay() is called

### Data Disappeared
1. Check if clearAllCompetitors() was called
2. Inspect localStorage in browser dev tools
3. Look for race conditions in save operations
4. Check annotation KNOWN ISSUES for similar problems

---

## 🧪 Testing

### Manual Test Checklist

**Division Generation:**
- [ ] Create criteria
- [ ] Save template
- [ ] Generate divisions
- [ ] Edit criteria
- [ ] Regenerate
- [ ] Verify both preserved

**Scoreboard:**
- [ ] Open operator scoreboard
- [ ] Select competitors
- [ ] Open TV display
- [ ] Update scores
- [ ] Verify TV syncs
- [ ] Close and reopen - check cleanup

**Tournament Switching:**
- [ ] Create 2 tournaments
- [ ] Add competitors to first
- [ ] Switch to second
- [ ] Verify data isolation (BUG: will fail!)

---

## 📚 Annotation Format

### Every Section Has:

```javascript
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SECTION NAME
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ROUTE: Navigation path
 *
 * FLOW:
 * 1. Step by step workflow
 *
 * DATA STRUCTURE:
 * Schema documentation
 *
 * ⚠️ KNOWN ISSUES:
 * Documented bugs
 *
 * 📝 TODO:
 * Future improvements
 *
 * Last Updated: YYYY-MM-DD
 * ═══════════════════════════════════════════════════════════════════════════
 */
```

### Finding Annotations

Search for: `═══════════════════════════════════════════════════════════════════════════`

---

## 🚨 Critical Reminders

### ALWAYS:
- ✅ Read annotations before modifying
- ✅ Update annotations after changes
- ✅ Update Last Updated date
- ✅ Test related functionality
- ✅ Document new bugs in KNOWN ISSUES

### NEVER:
- ❌ Delete annotations
- ❌ Ignore KNOWN ISSUES section
- ❌ Skip updating data structures
- ❌ Leave console.log in production
- ❌ Modify division code without reading audit report

---

## 🎓 Learning Path

### Week 1: Understanding
1. Day 1-2: Read CODE_ANNOTATIONS.md and this file
2. Day 3-4: Read AUDIT_REPORT.md, trace one bug
3. Day 5: Review all annotation headers in app.js

### Week 2: Contributing
1. Fix a LOW priority bug
2. Update annotations
3. Submit for review

### Week 3: Ownership
1. Fix a MEDIUM priority bug
2. Refactor small section
3. Add new feature with annotations

---

## 🔧 Tools

### Debugging Pages:
- `debug.html` - General localStorage inspector
- `check-divisions.html` - Division data inspector
- `import-data.html` - Load 200 test competitors

### Browser DevTools:
- **Application tab** → LocalStorage → Inspect data
- **Console** → Watch for extensive logging
- **Network tab** → (not used, app is client-only)

---

## 📞 Getting Help

### Confused About:
- **Data structure?** → Check annotation DATA STRUCTURE section
- **Workflow?** → Check annotation FLOW section
- **Bug?** → Check annotation KNOWN ISSUES + AUDIT_REPORT.md
- **Navigation?** → Check annotation ROUTE section

### Before Asking:
1. Read relevant annotation
2. Check audit report
3. Search code for similar patterns
4. Use debugging tools

---

## 🎯 Code Quality Standards

### Required:
- Annotations for all major sections
- Data structure documentation
- Known issues documented
- Last Updated date current

### Encouraged:
- Inline comments for complex logic
- TODO comments for incomplete work
- Error handling with try-catch
- Input validation

### Discouraged:
- Global variables (minimize)
- Magic numbers (use constants)
- Duplicate code
- console.log in production

---

## 📊 Metrics

**Current State:**
- 23 critical bugs
- 15 high priority bugs
- 12 medium priority bugs
- 8 low priority bugs
- 11 annotated major sections
- 3,500+ lines of code

**Goal State:**
- 0 critical bugs
- All sections annotated
- Tournament-scoped data
- Full test coverage

---

Last Updated: 2026-02-13
Maintainer: See CODE_ANNOTATIONS.md
Version: 1.0
