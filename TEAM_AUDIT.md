# Team Registration — Codebase Audit

> Read-only investigation. No code was changed.
> Date: 2026-03-17

---

## Quick Summary

The infrastructure is roughly **40–50% built but not integrated**. A `tournament_teams` table exists, a team sync API exists, and the director UI has full team search/create/join flows — but none of that data ever flows into the registration or payment system. Teams live in their own silo, disconnected from `registrations`, `registration_events`, brackets, and checkout.

---

## 1. Database Schema

### 1.1 `tournament_events` — **EXISTS, COMPLETE**

**Migration:** `migrations/1709500000002_003-tournament-registration-system.js` (lines 54–108), extended by several later migrations.

| Column | Type | Source Migration | Notes |
|---|---|---|---|
| `id` | UUID PK | 003 | |
| `tournament_id` | UUID FK | 003 | |
| `name` | varchar(255) | 003 | |
| `event_type` | varchar(50) | 003 | Stores `"kata"`, `"kumite"`, `"weapons"`, `"team-kata"`, `"team-kumite"` |
| `division` | varchar(100) | 003 | |
| `gender` | enum | 003 | male / female / mixed |
| `age_min`, `age_max` | integer | 003 | |
| `rank_min`, `rank_max` | varchar(50) | 003 | |
| `price_override` | decimal(10,2) | 003 | Individual per-event price |
| `addon_price_override` | decimal(10,2) | 003 | Add-on price for non-primary events |
| `max_competitors` | integer | 003 | |
| `criteria_templates` | JSONB | 010 (`migrations/1710100000000_010-...`) | Division criteria per event type |
| `is_event_type` | boolean | 010 | Marks this row as an event-type template vs. a specific division |
| `match_duration_seconds` | integer | 011 | |
| `prerequisite_event_id` | UUID FK | 019 | Enforced at checkout |
| `is_default` | boolean | 041 (`migrations/1712500000000_041-...`) | Pre-selects event in registration UI |
| `team_size` | integer | 041 | **Stored, but not enforced anywhere in registration** |
| `description` | text | 041 | |

**Gap:** No `team_price` column. Team events currently share the individual `price_override` / `addon_price_override` pricing model. There is no flat per-team price field.

---

### 1.2 `registrations` — **EXISTS, MISSING TEAM COLUMNS**

**Migration:** `migrations/1709500000002_003-tournament-registration-system.js` (lines 115–166), extended by later migrations.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `tournament_id` | UUID FK | |
| `user_id` | UUID FK | |
| `registered_by` | UUID FK | |
| `academy_id` | UUID FK | |
| `profile_id` | UUID FK | Added migration 005 |
| `payment_status` | enum | unpaid / paid / partial / waived |
| `amount_paid` | decimal(10,2) | |
| `total_due` | decimal(10,2) | |
| `notes` | text | JSON blob with competitor metadata overrides |
| `stripe_session_id` | varchar(255) | |
| `status` | varchar | pending_guardian / active / cancelled / etc. |

**Gaps:** No `team_id` column. No `is_team_registration` flag. No `team_name`. There is no way to determine from the `registrations` table whether a registration belongs to a team event.

---

### 1.3 `registration_events` — **EXISTS, MISSING TEAM COLUMNS**

**Migration:** `migrations/1709500000002_003-tournament-registration-system.js` (lines 176–215).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `registration_id` | UUID FK | |
| `event_id` | UUID FK | |
| `is_primary` | boolean | First event = base price; rest = add-ons |
| `price` | decimal(10,2) | |
| `selection_order` | integer | |
| `assigned_division` | varchar(200) | Added migration 020 |

**Gap:** No `team_id` or team context. Cannot reconstruct which team a registration_event belongs to.

---

### 1.4 `tournament_teams` — **EXISTS, ORPHANED**

**Migration:** `migrations/1711900000002_030-tournament-teams.js` (lines 8–55)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `tournament_id` | UUID FK | |
| `event_id` | UUID FK (nullable) | Which event this team is for |
| `team_code` | text | Unique 6-char code per tournament |
| `team_name` | text | |
| `members` | JSONB | Array of `{ name, userId, profileId, … }` |
| `created_at`, `updated_at` | timestamptz | |

**Constraints:** `UNIQUE (tournament_id, team_code)`. Index on `tournament_id`.

**Critical finding:** This table is synced from the director dashboard (`app.js` → `POST /api/tournaments/:id/teams/sync`) but is **never queried during checkout, registration creation, or bracket generation**. It is a data island.

**Gap:** No `registered_by` (which user paid), no `payment_status`, no `stripe_payment_id`, no `size_required` vs `size_actual` tracking.

---

### 1.5 `tournament_brackets` — **EXISTS, NOT TEAM-AWARE**

**Migration:** `migrations/1711800000000_027-tournament-brackets.js` (lines 9–52)

| Column | Type | Notes |
|---|---|---|
| `id` | varchar(255) PK | Composite string ID |
| `tournament_id` | UUID FK | |
| `event_id` | varchar(255) | |
| `division_name` | varchar(255) | |
| `bracket_type` | varchar(50) | |
| `data` | JSONB | Full bracket: matches, competitor IDs, scores |
| `published` | boolean | |

**Gap:** The `data` JSONB stores competitor IDs as bracket slot identifiers. There is no team entity in the bracket model. Two teams cannot face each other — only individual competitors can.

---

### 1.6 `competitor_profiles` — **EXISTS, NO TEAM AFFILIATION**

**Migration:** `migrations/1709600000000_005-registration-rework.js` (lines 10–69)

Columns: `id`, `user_id`, `first_name`, `last_name`, `date_of_birth`, `gender`, `belt_rank`, `experience_level`, `weight`, `academy_name`, `academy_id`, `is_self`, `photo_url`.

**Gap:** No `team_id` or team affiliation field. A profile cannot express team membership.

---

## 2. Backend Routes & Controllers

### 2.1 Teams Routes — **EXISTS, COMPLETE (but isolated)**

**File:** `server/routes/teams.js` (full file, ~21 lines)

| Method | Route | Auth | Purpose |
|---|---|---|---|
| `GET` | `/:id/teams/public?eventId=&name=` | None | Public team search for registration UI |
| `GET` | `/:id/teams` | Owner | All teams for director dashboard |
| `POST` | `/:id/teams/sync` | Owner | Bulk upsert teams from client |

All three endpoints work correctly in isolation. None are called by the registration or checkout flow.

---

### 2.2 Team Controller — **EXISTS, COMPLETE (but isolated)**

**File:** `server/controllers/teamController.js` (lines 1–76)

- `getTeams()` — queries `tournament_teams` by tournament
- `syncTeams()` — transaction-safe delete + upsert
- `listTeamsPublic()` — returns `{ code, name, memberCount }` filtered by name substring and event

---

### 2.3 Tournament Events CRUD — **EXISTS, ACCEPTS `team_size`**

**File:** `server/controllers/tournamentController.js`

- `createEvent()` (lines 365–385): Accepts `teamSize` and stores it as `team_size` on `tournament_events`.
- `updateEvent()` (lines 391–419): Can update `team_size` (line 413).

**Gap:** No `team_price` field in create or update. No validation that `event_type === 'team-kata'` requires `team_size > 1`.

---

### 2.4 Registration Checkout — **EXISTS, DOES NOT ACCEPT TEAM DATA**

**File:** `server/controllers/registrationController.js`

**`POST /api/registrations/checkout`** (lines 329–681):

Current cart structure accepted:
```json
{
  "tournamentId": "...",
  "competitors": [
    { "profileId": "...", "events": [{ "eventId": "..." }] }
  ]
}
```

What it does:
1. Validates profileId and eventId (lines 360–413)
2. Validates event prerequisites via `prerequisite_event_id` (lines 414–434)
3. Checks event capacity via `max_competitors` (lines 436–445)
4. Builds Stripe line items and stores `cartData` in Stripe metadata (line 568)
5. Returns Stripe checkout URL

**What it does NOT do:**
- Accept `team_code`, `team_name`, or team member list
- Validate team size requirements
- Link any team entity to the payment

**`POST /api/registrations/confirm`** (lines 687–819):
- Retrieves `cartData` from Stripe metadata (line 725)
- Calls `createRegistrationsFromCart()` (line 737)

**`createRegistrationsFromCart()`** (lines 1119–1202):
- Inserts `registrations` row per competitor
- Inserts `registration_events` rows per event per competitor
- Calls `assignDivision()` per registration event (line 1254)
- **Never touches `tournament_teams`**

---

### 2.5 Division Assignment Service — **EXISTS, NOT TEAM-AWARE**

**File:** `server/services/divisionAssignment.js`

`assignDivision(profile, templates, tournamentDate)` — takes an individual competitor profile and returns a division name string. No concept of team, teammates, or team-level criteria.

---

## 3. Frontend

### 3.1 Tournament Builder Wizard — **EXISTS, PARTIAL**

**File:** `client/wizard.html`

**Team event type cards** (lines 1247–1255):
```html
<div class="event-type-card" data-event="team-kata">Team Kata</div>
<div class="event-type-card" data-event="team-kumite">Team Kumite</div>
```
Both `team-kata` and `team-kumite` are selectable event types.

**Team size dropdown** (lines 1596–1640): When a team event type is selected, the wizard shows a dropdown to pick team size (1, 2, or 3). The value is stored in `wizardData.eventConfigs[et].teamSize` and sent to the server via `createEvent` / `syncEvents`. Works correctly.

**Gap:** No `team_price` field in the wizard. Team events currently use the same `priceOverride` / `addonPriceOverride` fields as individual events. There is nowhere to set a flat per-team price.

---

### 3.2 Director Dashboard — **EXISTS, PARTIAL**

**File:** `client/app.js`

**`EVENT_TYPE_INFO` map** (lines ~1546–1576):
```javascript
'team-kata':   { label: 'Team Kata',   icon: '👥', defaultTeamSize: 3 }
'team-kumite': { label: 'Team Kumite', icon: '👥', defaultTeamSize: 3 }
```

**Team UI (lines ~2659–2898):**
- `_selectedTeamData` global stores `{ code, name, memberCount, isNew }`
- Shows/hides a team section when `teamSize > 1` (line 2659)
- `searchTeams()` calls `GET /api/tournaments/:id/teams/public?eventId=X&name=Y` with debounce
- Filters out full teams (`memberCount >= max`, line 2829)
- Offers "Create new team" option (lines 2850–2858)
- `selectExistingTeam()` and `confirmNewTeam()` update `_selectedTeamData`

**Critical gap:** `_selectedTeamData` is populated in the UI but **never sent to the registration checkout API**. When the user proceeds to payment, the team selection is discarded.

**Team sync** (lines ~926–988): `_syncTeamsToServer()` pushes the director's team roster from `localStorage` to `POST /api/tournaments/:id/teams/sync`. This is the director-side team management flow and works correctly, but it is separate from the registration flow.

**Team medals display** (lines ~1869–1990): In the medals/awards section, the system detects `teamSize > 1` and renders team tags instead of individual names. This works for display purposes only.

---

### 3.3 Public Registration Page — **NO TEAM HANDLING**

**File:** `client/public.js`

- `loadPublicEventCheckboxes()` (lines 63–114): Renders checkboxes for each event. No special handling for team events.
- `calculatePricingBreakdown()` (lines 45–57): Calculates cart total. No team pricing model.
- No team name input, no teammate search, no team join flow.

---

### 3.4 Criteria Presets — **EXISTS, PARTIAL**

**File:** `client/criteria-presets.js`

`buildTemplates()` handles `team-kata` explicitly (lines 135–146):
- Returns a single template with **age criterion only** — no gender, rank, or weight splits for team kata.
- This is correct per WKF rules (team kata divides by age group only).

`team-kumite` has no special case in `buildTemplates()` — it falls through to the default empty return. The wizard would create a team-kumite event with no criteria templates.

---

## 4. How the Current Individual Registration Flow Works

End-to-end for reference, so it is clear where team events would need to plug in:

1. **Public page loads** (`tournament.html` + `public.js`)
   - Fetches tournament and events from `GET /api/tournaments/:id`
   - `loadPublicEventCheckboxes()` renders event checkboxes with prices
   - User selects events; cart is built in memory

2. **Checkout initiated**
   - `POST /api/registrations/checkout` with `{ tournamentId, competitors: [{ profileId, events }] }`
   - Server validates profiles, events, prerequisites, capacity
   - Server creates a Stripe Checkout Session with `cartData` in metadata
   - Returns `{ checkoutUrl }`

3. **Stripe payment**
   - User pays on Stripe-hosted page
   - Stripe redirects to `/confirmation?session_id=...`

4. **Confirmation**
   - Page calls `POST /api/registrations/confirm` with `{ sessionId }`
   - Server retrieves `cartData` from Stripe metadata
   - Calls `createRegistrationsFromCart()`:
     - Inserts `registrations` row (status = active, payment_status = paid)
     - Inserts `registration_events` rows per event
     - Calls `assignDivision()` per registration event → stores in `assigned_division`
   - Deducts credits from director account
   - Sends confirmation email via Resend

5. **Director view**
   - Director refreshes data from server
   - Registrations appear in the competitor list
   - Divisions auto-assigned and visible in the divisions tab
   - Director generates brackets from division data

---

## 5. Gap Analysis

### 5.1 What Exists

| Component | Location | Status |
|---|---|---|
| `tournament_events.team_size` column | Migration 041 | ✅ Exists, stored, displayed in wizard and director UI |
| `tournament_events.event_type` values `team-kata` / `team-kumite` | Migration 003 | ✅ Exists, used throughout |
| `tournament_teams` table | Migration 030 | ✅ Schema well-designed |
| Teams API (3 endpoints) | `server/routes/teams.js` | ✅ Works correctly |
| Team controller (CRUD) | `server/controllers/teamController.js` | ✅ Works correctly |
| Team DB queries | `server/db/queries/teams.js` | ✅ Transaction-safe |
| Wizard team event type selection | `client/wizard.html:1247–1255` | ✅ Full UI exists |
| Wizard team size config | `client/wizard.html:1596–1640` | ✅ Stores correctly |
| Director team search/create UI | `client/app.js:2659–2898` | ✅ Search, join, create all work |
| Director team sync to server | `client/app.js:926–988` | ✅ Works |
| Event prerequisites enforcement | `registrationController.js:414–434` | ✅ Works for all event types |
| Team-kata criteria preset | `client/criteria-presets.js:135–146` | ✅ Age-only, correct per WKF |

### 5.2 What Is Partially Built

| Component | Location | Gap |
|---|---|---|
| Team selection in director UI | `app.js:2750` (`_selectedTeamData`) | Data is selected in UI but never sent to checkout API |
| Event capacity check | `registrationController.js:436–445` | Checks `max_competitors`; does not check team size or team slot availability |
| Team-kumite criteria preset | `criteria-presets.js` | No special-case for `team-kumite`; returns empty template array |
| Wizard team pricing | `wizard.html` | Uses individual pricing fields; no flat per-team price |

### 5.3 What Does Not Exist At All

| Missing Piece | Impact |
|---|---|
| `team_price` column on `tournament_events` | Cannot set a flat per-team price distinct from individual pricing |
| `team_id` column on `registrations` | Cannot link a paid registration to a team |
| `registered_by` / `payment_status` on `tournament_teams` | Cannot track who paid or whether a team is paid |
| Team data in checkout cart payload | Team selection is never sent to the server at payment time |
| Team creation during checkout | `createRegistrationsFromCart()` never touches `tournament_teams` |
| Team-aware division assignment | `assignDivision()` only handles individual profiles |
| Team entities in bracket slots | Bracket `data` JSONB stores competitor IDs, not team IDs |
| Team member invite emails | No Resend flow for inviting unregistered teammates |
| Account-claim flow for invited members | No pre-linking of team membership on signup |
| Teammate search in public registration | No autocomplete/search UI for the public registration page |
| Team name input in public registration | No team name field on the public-facing registration form |
| Team completeness indicator in director view | No amber/incomplete-team alert |
| Team member management post-registration | No swap/replace member flow |
| Flat-fee line item in Stripe | No single team line item; all pricing is per individual |
| `team_members` table (spec) | The spec calls for a dedicated table; what exists is a JSONB array in `tournament_teams.members` — functional but less queryable |

---

## 6. Architectural Considerations

**The `tournament_teams.members` JSONB vs. a `team_members` table:**
The existing schema stores team members as a JSONB array inside `tournament_teams`. The spec calls for a separate `team_members` table. The JSONB approach works for the director-managed team roster but would make it harder to query "all teams a given profile is in" or "send invites to unregistered teammates" efficiently. A migration to a proper `team_members` table (or adding it alongside the JSONB) would be needed.

**The `tournament_teams` table is already the right home** for team metadata (name, event, tournament). It just needs `registered_by` and `payment_status` columns added, and it needs to be written to at checkout time rather than only via the director sync endpoint.

**The bracket system would need a parallel code path** for team events. The existing bracket `data` JSONB is deeply built around competitor IDs. The least-invasive approach would be to use team codes (`TEAM-ABC123`) as the bracket slot identifier wherever competitor IDs are currently used, since the bracket code already operates on string IDs.

**Division assignment for team events** is currently a no-op — `assignDivision()` would assign each team member individually, producing three separate division strings for one team entry. Team events need either (a) a separate assignment path that uses a representative member's profile, or (b) criteria templates designed at the team level.
