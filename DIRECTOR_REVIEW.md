# Tournament Director Review — Taikai by Kimesoft

*Reviewed by: Elite Director Simulation (20+ years experience)*
*Date: March 2026*

---

## Task 2 — Elite Director UX Review

### Wizard (`wizard.html`)

**Step Sequence:** Basics → Events → Divisions → Pricing → Review
- ✅ Overall flow is logical. Events before divisions makes sense (divisions depend on event types).
- ⚠️ Pricing after divisions is slightly backward — directors think "what events, then what cost" before division rules. However, this is a minor preference issue since the division preset (AAU/WKF) affects the tournament structure more than pricing does.

**Step 1-2 (Basics + Events):**
- ✅ Tournament name required, good validation with focus
- ✅ Organization auto-populated, prevents editing mistakes
- ✅ T-shirt size collection toggle added (Task 7)
- ✅ Pricing defaults pre-populated from director settings (Task 1)
- ✅ Sanctioning body pre-selected from scoreboard preferences (Task 1)
- ⚠️ Registration deadline should be more prominent — on tournament day, "deadline passed" matters
- ⚠️ Contact email should be required (currently optional)
- 📋 **Document for later**: City/State/Region as 3 separate fields is fractured — should be one "Location" field

**Step 3 (Division Rules):**
- ✅ AAU and WKF presets exist and are selectable
- ✅ Match durations per age group stored on templates (Task 4)
- ✅ Director's per-age-group duration overrides applied to templates (Task 4)
- ⚠️ Preset descriptions are vague — "Age groups with experience levels" doesn't specify which age groups
- ⚠️ Summary only appears after clicking a preset — should show inline previews
- 📋 **Document for later**: Custom preset is a dead-end ("Configure later in Tournament Manager")

**Step 4 (Pricing):**
- ✅ Base + add-on model is clear and well-explained
- ✅ Per-event overrides available when 2+ events selected
- ✅ Default values read from director settings (Task 1 fix)

**Step 5 (Review):**
- ✅ Shows all entered data organized by section
- ✅ Edit links to jump back to relevant steps
- ✅ Publish confirmation dialog prevents accidental publishing (Task 3)
- ⚠️ Missing cover image preview
- ⚠️ No registration deadline countdown ("closes in X days")

**Error Handling:**
- ✅ Toast notifications with color coding
- ⚠️ Toasts auto-dismiss after 3s — easy to miss under stress
- ⚠️ No inline field validation — errors only show on "Next" click

---

### Director Dashboard (`director.html`)

**Dashboard View:**
- ✅ Tournament cards with name, date, competitor count, status
- ✅ "Host a Tournament" CTA card is prominent
- ✅ Discount Codes button on each tournament card (Task 5)
- ✅ Staff management button on each tournament card (Task 6)
- ⚠️ Credit balance shown before tournament info — wrong priority on tournament day
- ⚠️ No "unpaid registrations" count on tournament cards
- ⚠️ No "schedule status" or "divisions finalized" indicator
- 📋 **Document for later**: Need tournament day command center with checklist

**Settings View (Task 1 — New):**
- ✅ Pricing Defaults (base price, addon price) — auto-saved, pre-populates wizard
- ✅ Match Duration Defaults (7 age categories: Mini Kids through Seniors) — per-age-group overrides
- ✅ Default Ring/Mat Setup (ring count + customizable names)
- ✅ Scoreboard Preferences (scoring system WKF/AAU, overtime duration)
- ✅ Default Event Types pre-selection
- ✅ All sections with debounced auto-save and visual status feedback

**Discount Codes View (Task 5 — New):**
- ✅ Per-tournament discount code management
- ✅ Create/edit modal with code, type (percentage/fixed), value, max uses, expiry, active toggle
- ✅ Table view with uses counter, status badges, enable/disable/delete actions
- ✅ Director ownership verification on all API calls

**Event Staff View (Task 6 — New):**
- ✅ Per-tournament staff management with stats cards (total, confirmed, pending, roles filled)
- ✅ Full CRUD with modal form: name, role, status, email, phone, t-shirt size, notes
- ✅ 7 role types: Judge, Ring Coordinator, Table Worker, Medical, Volunteer, Announcer, Photographer
- ✅ Status tracking: Pending, Confirmed, Declined

**Registrants View:**
- ✅ Stats cards (competitors, revenue, events)
- ✅ Search by name/email/academy
- ✅ Event filter dropdown
- ✅ Paid/Unpaid badges color-coded
- ✅ CSV export
- ✅ T-shirt size included in registrant data (Task 7)
- ⚠️ No "unpaid only" filter — director has to eyeball the table
- ⚠️ No registrant detail view (click to see full profile)
- 📋 **Document for later**: Add unpaid filter, check-in list export, weigh-in status

**Navigation:**
- ✅ Hash-based routing works for all views (dashboard, settings, registrants, discount-codes, staff)
- ⚠️ Tournament operations (manage, scoreboard, brackets) are on external pages — no seamless integration
- 📋 **Document for later**: Add breadcrumb navigation between Manage page and dashboard

---

### Tournament Public Page (`tournament.html`)

- ✅ Professional dark glassmorphism design
- ✅ Hero section with status badge (Open/Closed/Completed)
- ✅ Info bar with date, location, competitor count, deadline
- ✅ Event list with pricing and eligibility tags
- ✅ Sticky sidebar with CTA on desktop
- ⚠️ Hero placeholder gradient looks unprofessional when no cover image uploaded
- ⚠️ CTA sidebar disappears on mobile (below 900px) — registration buried
- ⚠️ Division tags shown in technical format (e.g., "M_U14" instead of "Boys Under 14")
- ⚠️ Event descriptions missing — parents don't know what "Kata" or "Kumite" means
- 📋 **Document for later**: Add social sharing buttons, "Add to Calendar" link

---

### Registration Flow (`register.html`)

- ✅ Multi-competitor registration works (parent can register children)
- ✅ Cart with per-competitor breakdown and discount codes
- ✅ Stripe checkout integration
- ✅ T-shirt size field shown conditionally when tournament enables collection (Task 7)
- ⚠️ Guardian/Competitor account type choice is confusing for parents
- ⚠️ "No Eligible Events" doesn't explain WHY (age? rank? weight?)
- ⚠️ Weight field has no unit specification (kg vs lbs)
- ⚠️ "PRIMARY" vs "ADD-ON" event badges unexplained
- ⚠️ No order review before payment — jumps straight to Stripe
- ⚠️ No confirmation number or email indication after registration
- ⚠️ Empty cart has no "Back to Events" recovery path
- 📋 **Document for later**: Add inline form validation, "Add to Calendar" post-registration

---

### Scoreboard Files

**Kumite Scoreboard:**
- ✅ Beautiful responsive design with dynamic text color based on background
- ✅ Clear red/blue competitor separation
- ✅ Winner declaration has confirmation dialog (Task 3 fix)
- ✅ Match duration reads from bracket data with cascade: division > director settings > hardcoded default (Task 4)
- ⚠️ Reset button clears entire match with no warning
- ⚠️ Score buttons have no undo functionality
- ⚠️ Timer start can be accidentally triggered on tablet

**Kata Scoreboard:**
- ✅ Gorgeous broadcast-quality display
- ✅ Judge score cards with min/max highlighting
- ✅ Clean competitor panel with photo/logo support

**Kata Flags Scoreboard:**
- ✅ Clear flag count display with judge voting panel
- ✅ Color-coded judge votes match corner colors
- ✅ Winner celebration overlay
- ✅ Repechage matches included in operator search (bracket flow fix)
- ✅ Match progress bar showing "Match X of Y" (bracket flow fix)

**TV Display:**
- ✅ Auto-redirects to correct scoreboard type
- ✅ Fullscreen mode auto-triggers
- ⚠️ Hidden buttons in HTML (CSS `display:none`) — fragile pattern

**Mat Display:**
- ✅ Clean kumite and kata layouts
- ⚠️ Multiple state sources (matScoreboards vs scoreboard-state) could desync

---

## Task 3 — Button & Interaction Audit

### Issues Fixed:

1. **Wizard publish button** — Added confirmation dialog before publishing tournament
2. **Winner declaration** — Added confirmation dialog with winner name to `operatorDeclareWinner()`
3. **Empty bracket matches** — Hidden completely instead of showing "Pending" with unusable "Score Match" button
4. **Bracket match display** — "Waiting" status shown for matches awaiting opponents instead of confusing "Pending"
5. **Bracket flow** — Fixed `checkBracketComplete()` premature completion, missing repechage matches, strict ID comparison

### Issues Documented for Later:

| Page | Issue | Severity | Description |
|------|-------|----------|-------------|
| wizard.html | Toast auto-dismiss 3s | 🟡 | Error messages disappear too fast under stress |
| register.html | Payment error uses alert() | 🟡 | Should use inline error message |
| register.html | Cart "Remove All" no confirm | 🟡 | Could accidentally wipe cart |
| app.js | Reset match no confirm | 🟡 | Operator can wipe live match (reset button) |
| app.js | No undo for score buttons | 🟡 | Fat-finger clicks on tablet are likely |
| director.html | Delete tournament no confirm | 🟡 | Destructive action needs gate |
| tournament.html | CTA hidden on mobile | 🟡 | Registration button disappears below 900px |

---

## Task 4 — WKF & AAU Division Templates

### Match Duration Implementation

Migration: `match_duration_seconds` column on `tournament_events` table.

**Duration Cascade (highest priority wins):**
1. Division-specific duration from template matching (per-age-group in criteriaTemplates)
2. Event-level `match_duration_seconds` (max of all template durations for the event)
3. Director's saved match duration settings (from users.settings JSONB, applied at wizard time)
4. Scoreboard config matchDuration (from unified scoreboard settings)
5. Hardcoded defaults based on sanctioning body (WKF=180s, AAU=120s)

### WKF Presets

| Category | Age | Kumite Duration |
|----------|-----|----------------|
| Mini Kids | 6-7 | 60 sec |
| Kids | 8-11 | 90 sec |
| Cadets | 12-13 | 90 sec |
| Juniors | 14-15 | 120 sec |
| Youth | 16-17 | 120 sec |
| Under 21 | 18-20 | 180 sec |
| Seniors | 21+ | 180 sec |

WKF Kumite weight classes per age-gender combination.
Kata: age + gender + belt only (no weight).

### AAU Presets

| Category | Age | Kumite Duration |
|----------|-----|----------------|
| 5 & Under | 5 | 60 sec |
| 6-7 | 6-7 | 60 sec |
| 8-9 | 8-9 | 90 sec |
| 10-11 | 10-11 | 90 sec |
| 12-13 | 12-13 | 120 sec |
| 14-15 | 14-15 | 120 sec |
| 16-17 | 16-17 | 120 sec |
| 18+ Adult | 18+ | 180 sec |

AAU uses experience levels (Beginner, Intermediate, Advanced, Black Belt).
Weight classes only for Black Belt Kumite 14+.

---

## Task 5 — Discount Code System

### Implementation

- **Backend**: Director-scoped routes at `/api/tournaments/:id/discount-codes` (GET, POST, PUT, DELETE)
- **Frontend**: New "Discount Codes" view in director dashboard
- **Access**: Only tournament owner (or admin/super_admin) can manage codes
- **Features**: Code, type (percentage/fixed), value, max uses, expiry date, active toggle
- **Validation**: Duplicate code check, value validation, tournament ownership verification

---

## Task 6 — Event Staff Registration

### Implementation

- **Migration 012**: `event_staff` table with columns: name, email, phone, role, status, notes, tshirt_size, user_id, tournament_id, created_by
- **Backend**: Director-scoped CRUD routes at `/api/tournaments/:id/staff`
- **Frontend**: New "Staff" view in director dashboard with stats cards and table
- **Roles**: Judge, Ring Coordinator, Table Worker, Medical, Volunteer, Announcer, Photographer
- **Status Tracking**: Pending, Confirmed, Declined

---

## Task 7 — T-Shirt Size Collection

### Implementation

- **Migration 013**: `tshirt_size` column on registrations, `collect_tshirt_sizes` boolean on tournaments
- **Wizard**: Checkbox in Step 1 (Basics) to enable t-shirt size collection
- **Registration**: T-shirt size dropdown conditionally shown when tournament has collection enabled
- **API**: T-shirt size included in registrant query for director's registrant view
- **Staff**: T-shirt size field included in event staff management modal

---

## Remaining Missing Features

| Feature | Where Gap Is Felt | Criticality | What It Would Take |
|---------|-------------------|-------------|-------------------|
| Tournament day command center | director.html dashboard | 🔴 Blocker | Dashboard redesign with status widgets, checklist, quick actions |
| Unpaid registrations filter | Registrants view | 🔴 Blocker | Add filter dropdown with paid/unpaid/all options |
| Score undo button | Scoreboard operator | 🟡 Important | Add action history stack with undo button |
| Check-in system | Registration day-of | 🟡 Important | New check-in view with barcode/QR scanning |
| Bracket status on dashboard | Tournament card | 🟡 Important | Show "Brackets: Ready / Not Generated" on each card |
| Inline form validation | Registration flow | 🟡 Important | Add real-time field validation with error messages |
| Mobile registration CTA | tournament.html | 🟡 Important | Fixed bottom CTA bar on mobile |
| Weight classes in registration | register.html | 🟡 Important | Weight field with proper units and division matching |
| Confirmation email content | Post-registration | 🟡 Important | Rich email with events, schedule, venue directions |
| Auto-scheduling engine | Manage page | 🟡 Important | Algorithm to assign divisions to rings with time blocks |
| Spectator tickets | tournament.html | 🟢 Nice to have | Add spectator ticket option to registration |
| Social sharing | tournament.html | 🟢 Nice to have | Share buttons for Facebook, WhatsApp, Instagram |
| Bracket live display | TV display | 🟢 Nice to have | Show live bracket progression on secondary screen |
| Multi-day tournament support | Wizard | 🟢 Nice to have | Date range instead of single date |
| Results/rankings export | Post-tournament | 🟢 Nice to have | PDF results with podium placements |

---

## "If I Were Running a Tournament Tomorrow" — Updated Assessment

### What's Actually Solid and Ready

The **registration pipeline works end-to-end**. A director can create a tournament with their saved defaults pre-populated (pricing, events, sanctioning body), set events and pricing, publish it, and accept registrations with Stripe payments. The discount code system is fully manageable from the dashboard. Parents can register multiple kids under one account. T-shirt sizes can be collected. **The core registration loop is production-ready.**

The **scoreboard system is visually impressive and safer**. Kumite, Kata, and Kata Flags all look professional on TV displays. Winner declaration now has a confirmation dialog preventing accidental mis-taps. Match durations cascade correctly from WKF/AAU presets per age group. The bracket system generates correctly, handles empty matches cleanly, and tracks match results through all rounds.

The **director tooling is substantially improved**. Settings consolidation means a director sets up their preferences once and they flow into every new tournament. Discount code management is per-tournament with full lifecycle (create, enable, disable, delete). Event staff can be tracked with roles, status, and t-shirt sizes. The wizard does its job for simple tournaments and pre-populates from settings.

### What Would Still Cause Problems

**At 7am when I arrive at the venue:**
- I'd still open the dashboard and see my credit balance before my tournament status. I still need a tournament day command center with: registered count, paid count, unpaid count, divisions generated status, and a checklist.
- I'd still need to click through to the registrant view to filter for unpaid registrations — no unpaid-only filter exists yet.

**During registration/check-in:**
- There's still no check-in system. I'd need a printed list and a pen. The CSV export helps, but a proper check-in view with status tracking would be essential for a 500+ person tournament.
- On-site payment collection is still not possible through the app.

**During matches:**
- Winner declaration is now safe (confirmation dialog). But score undo is still missing — operators can't reverse a fat-finger score entry on tablet.
- Timer management works but there's no audio buzzer integration.

**After the tournament:**
- Results are in the system but there's no "print results" or "export podium placements" feature.
- No way to send post-tournament emails to all registrants.

### Bottom Line

**This app is now 80% ready for a real tournament.** The registration, payment, and discount code pipeline is solid. Director settings save time across tournaments. Event staff management provides basic operational tracking. The scoreboard displays are beautiful and the operator interface is safer with confirmation dialogs. The bracket system works correctly through all rounds.

The remaining 20% is **operational day-of tooling** — the stuff that separates a smooth tournament from a chaotic one:
1. **Check-in system** (essential for 500+ person events)
2. **Unpaid filter** on registrants (need to find who owes money fast)
3. **Tournament day dashboard** (command center with at-a-glance status)
4. **Score undo** (operators will make mistakes on tablets)
5. **Results export** (parents and coaches expect printed results)

**If I were running a tournament tomorrow, I'd use this app for the full registration and payment flow, manage my staff and discount codes through the dashboard, and use the scoreboard system for all matches.** I'd still need a printed check-in list and a separate results tracker, but the app now carries a director much further through the tournament lifecycle than before.

---

## Changes Made This Session

### Commits

| Commit | Description |
|--------|-------------|
| `70c7b10` | Task 1: Settings consolidation — director defaults in Settings page |
| `8a808d0` | Tasks 2-3: Director UX review + button audit + safety fixes |
| `5609a4b` | Tasks 4-5: Template durations + discount code management |
| `6944598` | Tasks 6-7: Event staff management + t-shirt size collection |

### Database Migrations

| Migration | Table/Column | Purpose |
|-----------|-------------|---------|
| 011 (existing) | `tournament_events.match_duration_seconds` | Per-event match duration |
| 012 (new) | `event_staff` table | Volunteer/staff tracking |
| 013 (new) | `registrations.tshirt_size`, `tournaments.collect_tshirt_sizes` | T-shirt collection |

### Files Modified

| File | Changes |
|------|---------|
| `client/director.html` | Settings sections, discount codes view, staff view, routing |
| `client/wizard.html` | Settings pre-population, template duration overrides, t-shirt toggle, publish confirmation |
| `client/register.html` | T-shirt size field (conditional) |
| `client/app.js` | Winner confirmation dialog, empty match handling |
| `client/criteria-presets.js` | Already complete (verified) |
| `server/controllers/authController.js` | Extended settings validation |
| `server/controllers/tournamentController.js` | collectTshirtSizes support, tshirt_size in registrant query |
| `server/routes/tournaments.js` | Discount code + staff routes |
| `server/routes/auth.js` | Simplified settings route |
| `server/db/queries/discounts.js` | getByTournament query |
| `server/db/queries/eventStaff.js` | New CRUD queries |
| `server/db/queries/registrations.js` | tshirtSize in registration creation |
| `server/db/queries/tournaments.js` | collectTshirtSizes in tournament creation |
