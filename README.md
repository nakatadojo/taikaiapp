# Karate Tournament Management System

> **Desktop Admin Interface + Mobile Public Site**
> Built with vanilla JavaScript, HTML5, and CSS3
> 100% client-side with localStorage persistence

---

## 📚 Documentation Quick Links

### 👋 **New Developer? START HERE:**
1. 📖 [README_DEVELOPERS.md](README_DEVELOPERS.md) - Developer onboarding guide
2. 📋 [CODE_ANNOTATIONS.md](CODE_ANNOTATIONS.md) - Annotation system explained
3. 🐛 [AUDIT_REPORT.md](AUDIT_REPORT.md) - 58 documented bugs and fixes

### 🔍 **Reference Documentation:**
- 💾 [SCHEMA_ANALYSIS.md](SCHEMA_ANALYSIS.md) - Data structure deep dive
- 📊 [FINDINGS.md](FINDINGS.md) - Analysis summary and recommendations

---

## 🎯 What This System Does

### For Tournament Organizers (Desktop):
- ✅ Register competitors with Date of Birth (age calculated dynamically)
- ✅ Multi-event registration (competitors can register for multiple events)
- ✅ Event pricing support (ready for payment integration)
- ✅ Comprehensive club management with logos
- ✅ Manage instructors with club affiliations
- ✅ Create custom division criteria (age, gender, weight, rank, experience)
- ✅ Auto-generate divisions with age calculation (event date vs registration date)
- ✅ Create brackets (single/double elimination, round robin, kata flags/points)
- ✅ Separate scoreboard type and bracket type configuration
- ✅ Schedule divisions across multiple mats with custom names
- ✅ Run operator scoreboards (Kumite and Kata) with TV displays
- ✅ Custom corner names and colors (RED/BLUE or AKA/SHIRO)
- ✅ Generate results and certificates

### For Spectators (Mobile):
- ✅ View live brackets and results
- ✅ Search competitors
- ✅ See upcoming matches
- ✅ Mobile-optimized responsive design

---

## 🚀 Quick Start

### Running the App:
```bash
# Simply open in a browser (no build step required)
open index.html
```

### Loading Test Data:
```bash
# Open the import tool
open import-data.html
# Click "Import Data" to load 200 sample competitors
```

### Debugging:
```bash
# Division data inspector
open check-divisions.html

# General localStorage inspector
open debug.html
```

---

## 📂 File Structure

```
TOURNAMENT/
├── index.html              # Main admin interface
├── app.js                  # Core logic (3,500+ lines, ANNOTATED)
├── styles.css              # Desktop dark theme
│
├── public.html             # Mobile public site
├── public.js               # Public site logic
├── public-styles.css       # Mobile-optimized styling
│
├── tv-display.html         # Full-screen TV scoreboard
├── tv-display-styles.css   # TV display styling
│
├── import-data.html        # Import 200 test competitors
├── check-divisions.html    # Division data debugger
├── debug.html              # localStorage inspector
│
├── README.md               # 👋 This file
├── README_DEVELOPERS.md    # Developer guide
├── CODE_ANNOTATIONS.md     # Annotation system
├── AUDIT_REPORT.md         # Bug documentation
├── SCHEMA_ANALYSIS.md      # Data structure reference
└── FINDINGS.md             # Analysis summary
```

---

## 🆕 Recent Major Features (2026-02-13)

### 1. Date of Birth with Dynamic Age Calculation
- **What**: Competitors register with DOB instead of static age
- **Why**: Age changes between registration and event date
- **How**: Tournament setting controls age calculation method
  - "Age at Event Date" (standard for tournaments)
  - "Age at Registration" (for rolling registrations)
- **Impact**: Divisions now correctly account for birthdays
- **Example**:
  - Registration: Jan 1, competitor born Mar 10, 2014 (age 11)
  - Event: Mar 15, 2026 (age 12 after birthday)
  - Result: Competes in correct 12-14 division

### 2. Multi-Event Registration
- **What**: Competitors can register for multiple events at once
- **Why**: Many competitors participate in both kata and kumite
- **How**: Checkbox selection in registration form
- **Data**: `competitor.events = [1, 3, 5]` (array of event IDs)
- **Display**: Shows all registered events in competitor table

### 3. Event Pricing System
- **What**: Each event can have a registration price
- **Why**: Prepare for payment integration
- **Status**: Price stored, displayed, but no payment processing yet
- **Future**: Ready for Stripe/PayPal integration

### 4. Comprehensive Club Management
- **What**: Dedicated Clubs tab with full CRUD
- **Features**:
  - Add clubs with name, country, logo
  - View member count (auto-calculated)
  - Club dropdown in competitor registration
  - "Add New Club" during registration with logo upload
- **Impact**: Better organization tracking and visual identification

### 5. Scoreboard Type vs Bracket Type Separation
- **What**: Independent configuration of UI type and structure type
- **Scoreboard Type**: Determines operator UI (kumite, kata-flags, kata-points)
- **Bracket Type**: Determines structure (single-elim, double-elim, round-robin)
- **Configuration Levels**:
  1. Event level (default for all divisions)
  2. Division criteria level (per age group, etc.)
  3. Bracket generation level (per bracket override)
- **Impact**: Can have kata event with single-elimination bracket

### 6. Enhanced Operator Scoreboard
- **Kumite**: Points, penalties, timer, winner declaration
- **Kata**: Flags or points mode, multi-judge support (3/5/7)
- **Auto-Load**: Competitors loaded from brackets automatically
- **Auto-Advance**: Winner moves to next round automatically
- **Custom Names**: Corner names (RED/BLUE or AKA/SHIRO)
- **Custom Colors**: Full color customization

### 7. Mat Name Customization
- **What**: Rename mats from "Mat 1" to "Center Ring", etc.
- **Where**: Inline editing in Schedule tab
- **Persistence**: Names saved and used throughout system
- **Display**: Shows on TV display and schedules

---

## ⚠️ Known Critical Issues

### 🔴 MUST READ BEFORE USING:

1. **Division Criteria Can Disappear** (Bug #1)
   - Saving/generating divisions can delete criteria
   - **Workaround**: Always verify criteria after generating
   - **Status**: Documented in AUDIT_REPORT.md

2. **No Tournament Scoping** (Bug #4)
   - All data is global (not per-tournament)
   - Multiple tournaments will share data
   - **Workaround**: Use only one tournament at a time
   - **Fix Required**: 12+ hours of dev work

3. **Clear Competitors Deletes Everything** (Bug #3)
   - Clearing competitors also clears divisions and schedules
   - **Workaround**: Don't use "Clear All" if you want to keep divisions
   - **Fix Required**: Separate operations

See [AUDIT_REPORT.md](AUDIT_REPORT.md) for all 58 bugs.

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+)
- **Storage**: Browser localStorage (no backend)
- **Styling**: CSS3 with glassmorphism effects
- **Icons**: Unicode emoji (no icon library)
- **Build**: None (runs directly in browser)

### Browser Requirements:
- Modern browser with localStorage support
- Recommended: Chrome, Safari, Firefox (latest)
- **Not supported**: IE11 or older browsers

---

## 🎨 Design System

### Admin Interface (Desktop):
- **Theme**: Pure black iPhone dark mode
- **Colors**: `#000` background, `#0a84ff` primary
- **Typography**: SF Pro Display, system fonts
- **Effects**: Glassmorphism with backdrop-filter

### Public Site (Mobile):
- **Theme**: Light, clean, minimal
- **Responsive**: Mobile-first design
- **Touch**: Large tap targets, swipe gestures

---

## 📋 Typical Workflow

### Setting Up a Tournament:

1. **Create Tournament**
   - Dashboard → Tournament Info
   - Set name, date, location
   - Choose age calculation method (event date vs registration)
   - Upload tournament logo (optional)

2. **Create Event Types**
   - Event Types tab → Create Event Type
   - Set scoreboard type (kumite, kata-flags, kata-points)
   - Set default bracket type (single-elim, double-elim, etc.)
   - Set registration price (optional, for future payments)
   - Configure kata-specific settings (judges, scoring method)

3. **Set Up Clubs** (Optional)
   - Clubs tab → Add Club
   - Enter club name, country, upload logo
   - Clubs appear in competitor registration dropdown

4. **Register Competitors**
   - Competitors tab → Add Competitor
   - Enter personal info (name, DOB, weight, rank, etc.)
   - See real-time age preview (registration vs event)
   - Select club from dropdown or add new club with logo
   - Select one or more events to register for
   - Upload competitor photo (optional)
   - Import 200 test competitors via import-data.html

5. **Configure Division Criteria**
   - Divisions tab → Select Event → Configure Division Criteria
   - Add criteria layers (age, gender, weight, rank, experience)
   - Set bracket type per criteria (optional override)
   - Age ranges use calculated age based on tournament setting
   - Generate divisions from criteria

6. **Create Brackets**
   - Brackets tab → Generate Bracket
   - Select division
   - Choose scoreboard type (optional override)
   - Choose bracket type (pre-filled from event/criteria)
   - Choose seeding method (pre-filled from event)
   - System validates kata brackets match kata scoreboards

7. **Schedule Matches**
   - Schedule tab → Customize mat names
   - Drag divisions to mats and time slots
   - View schedule by mat or time

8. **Run Scoreboards**
   - Schedule tab → Click on scheduled division
   - Opens appropriate scoreboard (Kumite or Kata)
   - Competitors auto-loaded from bracket
   - Operate scoring, declare winner
   - Winner auto-advances to next round
   - Click "📺 Open TV Display" for audience view

9. **View Results**
   - Brackets tab → See bracket progression
   - Winners automatically populated
   - Generate certificates (not yet implemented)

---

## 🐛 Debugging Tips

### Division Not Showing?
```bash
# Open the division debugger
open check-divisions.html
# Check if criteria and generated both exist
```

### Scoreboard Not Syncing?
```javascript
// In browser console:
localStorage.getItem('scoreboard-state-mat1')  // Check state
```

### Data Disappeared?
```bash
# Open general debugger
open debug.html
# Inspect all localStorage tables
```

### More Help:
- Read the annotation for the affected section in app.js
- Check AUDIT_REPORT.md for known bugs
- Search for `═══════` in app.js to find all annotations

---

## 🚨 Before Making Changes

### MANDATORY STEPS:

1. **Read the documentation**:
   - [ ] CODE_ANNOTATIONS.md (annotation system)
   - [ ] AUDIT_REPORT.md (known bugs)
   - [ ] Annotation header in app.js for your section

2. **Find your section**:
   ```bash
   # Search for annotation headers
   grep "═══════" app.js
   ```

3. **Check for related bugs**:
   - Read KNOWN ISSUES in annotation
   - Check AUDIT_REPORT.md for affected features

4. **After your changes**:
   - [ ] Update annotation header
   - [ ] Update "Last Updated" date
   - [ ] Add new bugs to KNOWN ISSUES
   - [ ] Remove fixed bugs from KNOWN ISSUES
   - [ ] Update AUDIT_REPORT.md if fixing documented bugs

---

## 📊 Current Status

### ✅ Working Features:
- Competitor registration with photos
- Instructor management with club logos
- Event type configuration
- Division generation (with bugs)
- Bracket generation (5 types, 4 seeding methods)
- Mat scheduling with drag-and-drop
- Operator scoreboard with TV display
- Public mobile site

### ⚠️ Buggy Features:
- Division criteria persistence (Bug #1)
- Tournament data isolation (Bug #4)
- Edit existing criteria (Bug #8)
- Scoreboard settings not applied (Bug #24)

### ❌ Not Implemented:
- Certificate generation (placeholder only)
- Export functionality
- Data backup/restore
- Undo functionality
- Bracket auto-advancement from scoreboard

---

## 🎓 Learning Path

### Week 1: Understanding
1. Read README_DEVELOPERS.md
2. Read CODE_ANNOTATIONS.md
3. Open index.html and explore the UI
4. Read AUDIT_REPORT.md (focus on critical bugs)
5. Search for `═══════` in app.js and read annotation headers

### Week 2: Contributing
1. Import test data via import-data.html
2. Test the complete workflow
3. Use debugging tools (check-divisions.html, debug.html)
4. Pick a LOW priority bug from AUDIT_REPORT.md
5. Fix it and update annotations

### Week 3: Mastery
1. Fix a MEDIUM priority bug
2. Refactor a small section with full annotation updates
3. Add a new feature with complete documentation

---

## 📈 Metrics

**Code Base**:
- ~3,500 lines in app.js
- 11 major annotated sections
- 12 localStorage tables
- 5 bracket types implemented
- 4 seeding algorithms

**Known Issues**:
- 23 critical bugs 🔴
- 15 high priority bugs 🟠
- 12 medium priority bugs 🟡
- 8 low priority bugs 🟢
- **Total**: 58 documented issues

**Documentation**:
- 5 markdown files
- 100+ annotations in code
- 3 debugging tools
- 1 test data importer

---

## 🤝 Contributing

### Bug Reports:
1. Check AUDIT_REPORT.md (might be documented)
2. Add to relevant annotation KNOWN ISSUES
3. Update AUDIT_REPORT.md with new bug

### Code Changes:
1. **ALWAYS** update annotations
2. **ALWAYS** update "Last Updated" date
3. **ALWAYS** test related functionality
4. **NEVER** delete annotations

### Testing:
```bash
# Manual test checklist in README_DEVELOPERS.md
# No automated tests yet (TODO)
```

---

## 📞 Support

### Documentation:
- **New developers**: README_DEVELOPERS.md
- **Understanding annotations**: CODE_ANNOTATIONS.md
- **Bug information**: AUDIT_REPORT.md
- **Data structures**: SCHEMA_ANALYSIS.md

### Debugging:
- **Division issues**: check-divisions.html
- **General data issues**: debug.html
- **Console logs**: Extensive logging in generateDivisions()

### Code Questions:
- Read annotation headers (search for `═══════`)
- Check FLOW section for workflow
- Check DATA STRUCTURE section for schemas
- Check KNOWN ISSUES for documented problems

---

## 🔐 Data Privacy

**All data is stored locally in browser localStorage**:
- No server backend
- No data transmission
- No analytics or tracking
- Competitor photos stored as Base64

**Backup Recommendations**:
- Export localStorage periodically
- Use browser dev tools: Application → LocalStorage
- No built-in backup feature (TODO: Bug #11)

---

## ⚡ Performance Notes

### localStorage Limits:
- **Max size**: ~5-10MB per domain
- **Photo storage**: Base64 encoding increases size ~33%
- **No quota checking**: Can crash if exceeded (Bug #13)

### Known Issues:
- Large photo uploads can freeze browser (Bug #34)
- Division generation with 1000+ competitors is slow
- Multiple unclosed timers cause memory leaks (Bug #26)

---

## 🎯 Roadmap

### Phase 1: Bug Fixes (Current)
- Fix division criteria disappearing (Bug #1)
- Standardize division schema (Bug #2)
- Fix clear competitors logic (Bug #3)
- Add edit mode for criteria (Bug #8)

### Phase 2: Architecture
- Implement tournament scoping (Bug #4)
- Add state management layer
- Add data validation
- Implement error boundaries

### Phase 3: Features
- Auto-advance winners in brackets
- Certificate generation
- Export/import functionality
- Undo/redo system
- Backup/restore

### Phase 4: Testing
- Unit tests for core logic
- Integration tests for workflows
- Automated browser testing
- Performance optimization

---

## 📜 License

**Status**: Not specified
**Usage**: Internal tournament management
**Distribution**: Contact maintainer

---

## 🙏 Credits

**Development**: Claude Agent (Anthropic)
**Documentation**: Comprehensive annotation system
**Audit**: 58 bugs identified and documented
**Version**: 1.0
**Last Updated**: 2026-02-13

---

## 🚀 Get Started Now

```bash
# 1. Open the main app
open index.html

# 2. Load test data
open import-data.html
# Click "Import Data"

# 3. Read the developer guide
cat README_DEVELOPERS.md

# 4. Check for bugs before using
cat AUDIT_REPORT.md
```

**Happy coding! 🥋**

---

**Documentation Links**:
- [Developer Guide](README_DEVELOPERS.md)
- [Annotation System](CODE_ANNOTATIONS.md)
- [Bug Report](AUDIT_REPORT.md)
- [Data Schemas](SCHEMA_ANALYSIS.md)
- [Analysis Summary](FINDINGS.md)
