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
- ⚠️ Registration deadline should be more prominent — on tournament day, "deadline passed" matters
- ⚠️ Contact email should be required (currently optional)
- 📋 **Document for later**: City/State/Region as 3 separate fields is fractured — should be one "Location" field

**Step 3 (Division Rules):**
- ✅ AAU and WKF presets exist and are selectable
- ⚠️ Preset descriptions are vague — "Age groups with experience levels" doesn't specify which age groups
- ⚠️ Summary only appears after clicking a preset — should show inline previews
- 📋 **Document for later**: Custom preset is a dead-end ("Configure later in Tournament Manager")

**Step 4 (Pricing):**
- ✅ Base + add-on model is clear and well-explained
- ✅ Per-event overrides available when 2+ events selected
- ⚠️ Default values ($75/$25) are hardcoded — now reads from director settings (Task 1 fix)

**Step 5 (Review):**
- ✅ Shows all entered data organized by section
- ✅ Edit links to jump back to relevant steps
- ⚠️ Missing cover image preview
- ⚠️ No registration deadline countdown ("closes in X days")

**Error Handling:**
- ✅ Toast notifications with color coding
- ⚠️ Toasts auto-dismiss after 3s — easy to miss under stress
- ⚠️ No inline field validation — errors only show on "Next" click

**Critical Issue Fixed:** Publish button now has confirmation dialog (see Task 3)

---

### Director Dashboard (`director.html`)

**Dashboard View:**
- ✅ Tournament cards with name, date, competitor count, status
- ✅ "Host a Tournament" CTA card is prominent
- ⚠️ Credit balance shown before tournament info — wrong priority on tournament day
- ⚠️ No "unpaid registrations" count on tournament cards
- ⚠️ No "schedule status" or "divisions finalized" indicator
- 📋 **Document for later**: Need tournament day command center with checklist

**Registrants View:**
- ✅ Stats cards (competitors, revenue, events)
- ✅ Search by name/email/academy
- ✅ Event filter dropdown
- ✅ Paid/Unpaid badges color-coded
- ✅ CSV export
- ⚠️ No "unpaid only" filter — director has to eyeball the table
- ⚠️ No registrant detail view (click to see full profile)
- 📋 **Document for later**: Add unpaid filter, check-in list export, weigh-in status

**Navigation:**
- ✅ Hash-based routing works
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
- 🔴 **CRITICAL**: Winner declaration buttons have NO confirmation dialog
- 🔴 **CRITICAL**: Reset button clears entire match with no warning
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

**TV Display:**
- ✅ Auto-redirects to correct scoreboard type
- ✅ Fullscreen mode auto-triggers
- ⚠️ Hidden buttons in HTML (CSS `display:none`) — fragile pattern

**Mat Display:**
- ✅ Clean kumite and kata layouts
- ⚠️ Multiple state sources (matScoreboards vs scoreboard-state) could desync

---

## Task 3 — Button & Interaction Audit

### Issues Fixed Immediately:

1. **Wizard publish button** — Added confirmation dialog before publishing tournament
2. **Empty bracket matches** — Hidden completely instead of showing "Pending" with unusable "Score Match" button (previous commit)
3. **Bracket match display** — "Waiting" status shown for matches awaiting opponents instead of confusing "Pending"

### Issues Documented for Later:

| Page | Issue | Severity | Description |
|------|-------|----------|-------------|
| wizard.html | Toast auto-dismiss 3s | 🟡 | Error messages disappear too fast under stress |
| wizard.html | No validation on publish | 🔴 | Fixed — added confirmation dialog |
| register.html | Payment error uses alert() | 🟡 | Should use inline error message |
| register.html | Cart "Remove All" no confirm | 🟡 | Could accidentally wipe cart |
| app.js | Winner declaration no confirm | 🔴 | Operator can accidentally declare wrong winner |
| app.js | Reset match no confirm | 🔴 | Operator can wipe live match |
| app.js | No undo for score buttons | 🟡 | Fat-finger clicks on tablet are likely |
| director.html | Delete tournament no confirm | 🟡 | Destructive action needs gate |
| tournament.html | CTA hidden on mobile | 🟡 | Registration button disappears below 900px |

---

## Task 4 — WKF & AAU Division Templates

### Match Duration Implementation

Migration added: `match_duration_seconds` column on `tournament_events` table.

**Duration Cascade (highest priority wins):**
1. Division-specific `match_duration_seconds` from tournament_events
2. Director's saved match duration settings (from users.settings JSONB)
3. Hardcoded defaults based on sanctioning body

### WKF Presets

| Category | Age | Kumite Duration |
|----------|-----|----------------|
| Mini Kids | 6–7 | 60 sec |
| Kids | 8–11 | 90 sec |
| Cadets | 12–13 | 90 sec |
| Juniors | 14–15 | 120 sec |
| Youth | 16–17 | 120 sec |
| Under 21 | 18–20 | 180 sec |
| Seniors | 21+ | 180 sec |

WKF Kumite weight classes:
- Male: U55, U61, U67, U75, U84, O84
- Female: U50, U55, U61, U68, O68
- Kids/Cadets: lighter age-appropriate brackets
- Kata: age + gender only (no weight)

### AAU Presets

| Category | Age | Kumite Duration |
|----------|-----|----------------|
| 5 & Under | 5 | 60 sec |
| 6–7 | 6–7 | 60 sec |
| 8–9 | 8–9 | 90 sec |
| 10–11 | 10–11 | 90 sec |
| 12–13 | 12–13 | 90 sec |
| 14–15 | 14–15 | 120 sec |
| 16–17 | 16–17 | 120 sec |
| 18+ Adult | 18+ | 180 sec |

AAU uses experience levels (Beginner, Intermediate, Advanced, Black Belt).
Weight classes only for Black Belt Kumite 14+.

---

## Missing Features

| Feature | Where Gap Is Felt | Criticality | What It Would Take |
|---------|-------------------|-------------|-------------------|
| Tournament day command center | director.html dashboard | 🔴 Blocker | Dashboard redesign with status widgets, checklist, quick actions |
| Unpaid registrations filter | Registrants view | 🔴 Blocker | Add filter dropdown with paid/unpaid/all options |
| Winner declaration confirmation | Scoreboard operator | 🔴 Blocker | Add confirm() dialog to operatorDeclareWinner |
| Score undo button | Scoreboard operator | 🟡 Important | Add action history stack with undo button |
| Check-in system | Registration day-of | 🟡 Important | New check-in view with barcode/QR scanning |
| Bracket status on dashboard | Tournament card | 🟡 Important | Show "Brackets: Ready / Not Generated" on each card |
| Inline form validation | Registration flow | 🟡 Important | Add real-time field validation with error messages |
| Mobile registration CTA | tournament.html | 🟡 Important | Fixed bottom CTA bar on mobile |
| Weight classes in registration | register.html | 🟡 Important | Weight field with proper units and division matching |
| Confirmation email content | Post-registration | 🟡 Important | Rich email with events, schedule, venue directions |
| Spectator tickets | tournament.html | 🟢 Nice to have | Add spectator ticket option to registration |
| Social sharing | tournament.html | 🟢 Nice to have | Share buttons for Facebook, WhatsApp, Instagram |
| Bracket live display | TV display | 🟢 Nice to have | Show live bracket progression on secondary screen |
| Multi-day tournament support | Wizard | 🟢 Nice to have | Date range instead of single date |
| Results/rankings export | Post-tournament | 🟢 Nice to have | PDF results with podium placements |
| Auto-scheduling engine | Manage page | 🟡 Important | Algorithm to assign divisions to rings with time blocks |

---

## "If I Were Running a Tournament Tomorrow"

### What's Actually Solid and Ready

The **registration pipeline works**. A director can create a tournament, set events and pricing, publish it, and accept registrations with Stripe payments. The discount code system is functional. Parents can register multiple kids under one account. The **core loop is there**.

The **scoreboard system is visually impressive**. Kumite, Kata, and Kata Flags all look professional on TV displays. The operator interface is functional (if you train your people). The bracket system generates correctly and tracks match results.

The **wizard does its job** for simple tournaments. Name, date, events, pricing, publish. Five steps, reasonable flow. If you've done this before, it takes 10 minutes.

### What Would Cause Problems

**At 7am when I arrive at the venue:**
- I'd open the dashboard and see my credit balance before my tournament status. I don't care about credits at 7am. I need to know: How many registered? How many paid? Are my divisions set? Are my rings assigned?
- There's no tournament day checklist. I'd be clicking between the dashboard, manage page, and registrant views trying to piece together "am I ready?"
- If I have unpaid registrations, I can see them in the registrant table but can't filter to just those people. I'd have to scroll through everyone.

**During registration/check-in:**
- There's no check-in system. I'd need a printed list and a pen. In 2026.
- If a parent shows up and says "I registered but never paid," I have no quick way to handle that. No on-site payment collection.

**During matches:**
- My biggest fear is an operator accidentally declaring the wrong winner. There's no confirmation dialog. One mis-tap on a tablet and a match result is permanently wrong in the bracket.
- If an operator enters a wrong score, there's no undo. They'd have to remember what it was and manually subtract.
- Timer management works but there's no audio buzzer integration — operators need to watch the clock.

**After the tournament:**
- Results are in the system but there's no "print results" or "export podium placements" feature.
- No way to send "thank you for participating" emails to all registrants.
- No way to share results publicly.

### Bottom Line

**This app is 70% ready for a real tournament.** The registration and payment pipeline is solid. The scoreboard displays are beautiful. The bracket system works (after the fixes we made tonight).

The remaining 30% is all **operational tooling** — the stuff that makes the difference between a smooth tournament and a chaotic one. Check-in, winner confirmation dialogs, unpaid filters, tournament day dashboard, results export. These aren't fancy features — they're the basics that every director needs when 500 people show up at 7am.

**If I were running a tournament tomorrow, I'd use this app for registration and payment, then switch to paper for check-in and manual tracking for on-site operations.** The app gets people registered and paid — that's genuinely valuable. But it doesn't yet carry a director through the full tournament day.
