# Team Registration — Implementation Plan

> Plan only. No code written. No files modified.
> Built from: TEAM_AUDIT.md + full read of dojo, registration, checkout, bracket, and email code.
> Date: 2026-03-17

---

## Part 1 — Dojo Member Management: Audit & Gap Analysis

### What Already Exists (and Works)

The academy/dojo system is substantially built. Most of what the spec asks for already exists.

#### Database Tables

| Table | File | Key Columns |
|---|---|---|
| `academies` | migration 002 | `id`, `name`, `head_coach_id` (FK users), `address`, `city`, `state`, `website`, `logo_url` |
| `academy_members` | migration 002 | `id`, `academy_id`, `user_id`, `role` (enum: head_coach / assistant_coach / competitor), `added_by` |
| `academy_membership_requests` | migration 004 | `id`, `academy_id`, `user_id`, `status` (pending / approved / denied), `reviewed_by` |
| `competitor_profiles` | migration 005 | `academy_name` (free text), `academy_id` (nullable FK → academies), `user_id` (NOT NULL) |
| `registrations` | migration 003 | `academy_id` (nullable FK → academies) |

The trigram index on `academies.name` (`pg_trgm`, added in migration 004) already powers fast fuzzy search.

#### Backend API — What Exists

| Endpoint | Purpose |
|---|---|
| `GET /api/academies/search?q=` | Public autocomplete search — works, rate-limited |
| `GET /api/academies/my` | Returns head coach's academy + member list |
| `POST /api/academies` | Create a dojo (user becomes head_coach) |
| `PUT /api/academies/:id` | Update dojo info |
| `POST /api/academies/:id/logo` | Upload dojo logo (resizes, uploads to storage) |
| `GET /api/academies/:id/members` | List all members with user details |
| `POST /api/academies/:id/members` | Add existing user by email or ID |
| `DELETE /api/academies/:id/members/:userId` | Remove a member |
| `PUT /api/academies/:id/members/:userId/rank` | Update member belt/rank in their competitor profile |
| `POST /api/academies/:id/register-competitor` | **Key:** Creates student account (passwordless if new), sends invite email, auto-links guardian if under 18 |
| `POST /api/academies/:id/register-assistant` | Creates assistant coach account, sends invite |
| `GET /api/academies/:id/registrations` | All tournament registrations for dojo members |
| `POST /api/academies/:id/bulk-register` | Bulk register dojo members for tournament events |
| `GET /api/academies/:id/membership-requests` | List pending membership requests |
| `PUT /api/academies/:id/membership-requests/:id` | Approve or deny a request |
| `POST /api/academies/:id/transfer` | Transfer dojo ownership by email |

#### Frontend — What Exists

- **`client/account.html` (lines 322–1264):** Full "My Dojo" tab with create dojo form, edit dojo info, member list, add/remove member, transfer ownership.
- **`client/register.html` (lines 2884–2917):** Dojo name field with debounced autocomplete calling `GET /api/academies/search?q=`. Dropdown populated with results. User can select an existing dojo or type freeform.
- **`client/account.html` (lines 406–416):** Profile form includes dojo name field.

---

### What's Missing (The Gaps)

#### Gap 1 — "Roster entry without a Taikai account" is not a first-class concept

The spec says: *"A student can exist as a dojo roster entry without having a Taikai account."*

**Current behavior:** `competitor_profiles.user_id` is `NOT NULL`. Every competitor profile is tied to a `users` row. The `register-competitor` endpoint creates a **passwordless** (unclaimed) Taikai account — the student exists in the system but hasn't activated a password. This is functionally equivalent to a roster entry without a live account. The invite email goes out and they claim it later.

**Assessment:** The existing `register-competitor` flow satisfies the spec intent. No schema change to `user_id` nullability is needed. What IS needed is clarity in the UI: the dojo member list should distinguish "claimed account" from "invited / unclaimed" so the manager knows who has actually logged in. This is a display-only change.

**How to detect unclaimed accounts:** Add a column `account_claimed BOOLEAN DEFAULT FALSE` to `academy_members`, set to `TRUE` when the invited user first logs in via the claim link. Alternatively, check `users.last_login_at IS NULL` — but a dedicated flag is cleaner.

#### Gap 2 — No CSV / bulk import for roster management

The spec asks for: *"They can import students from a CSV or spreadsheet."*

**Current behavior:** `POST /api/academies/:id/bulk-register` registers existing members for tournaments — it does NOT import new students from a CSV file. There is no CSV-to-roster import endpoint.

**What's needed:** A new `POST /api/academies/:id/import-roster` endpoint that accepts a CSV (columns: first_name, last_name, email, belt_rank, date_of_birth minimum) and calls `register-competitor` logic for each row in a batch, collecting success/error counts.

#### Gap 3 — Auto-link does not happen when a competitor selects a dojo during registration

**Current behavior:**
- Competitor fills dojo name field in `register.html` → autocomplete calls `GET /api/academies/search`
- Competitor selects a result → `competitor_profiles.academy_id` and `.academy_name` are stored
- **That's it.** Nothing else happens. The dojo manager is not notified. The competitor does not appear in `academy_members`.

**What the spec requires:**
> *"If they select an existing dojo, they are auto-linked to that dojo's roster immediately... The dojo manager receives an email notification... The dojo manager can unapprove/remove the member..."*

**What's needed:**
1. When `competitor_profiles.academy_id` is set (during profile save), automatically create an `academy_membership_requests` row with `status='pending'` — OR skip the request flow and directly create an `academy_members` row with `role='competitor'`.
2. Send a notification email to the dojo head coach via Resend.
3. The existing approval endpoint (`PUT /api/academies/:id/membership-requests/:id`) already supports approving/denying. The manager can remove via the existing `DELETE /api/academies/:id/members/:userId`.

**Decision (flagged):** The spec says "auto-linked... immediately" but also says "the dojo manager can unapprove/remove." This implies the auto-link happens on selection (direct add to `academy_members`), with the manager having post-hoc removal rights — not a pending-approval flow. However, the `academy_membership_requests` table and the approval UI already exist and work. Using the request → approval flow avoids adding random people to a dojo without consent. **Recommend: use the existing request + notification approach**, where the membership request is auto-created on profile save and the dojo manager gets an email to approve. Show the member in a "Pending" state in the dojo dashboard. This reuses existing infrastructure.

#### Gap 4 — No dojo manager notification email

The `sendEmail()` infrastructure (`server/email.js`) and Resend are already wired. No notification email template exists for "new member linked to your dojo." This is a new template to add.

#### Gap 5 — Invite link for students with no account (for team registration use case)

This partially exists: `register-competitor` already sends an "account setup email with verification token." The teammate invite email after team checkout is new but follows the same pattern.

---

### Dojo System: Summary of What to Build vs. What to Extend

| Feature | Status | Action |
|---|---|---|
| Roster management UI (add, edit, remove, rank update) | ✅ Exists | Preserve as-is |
| Add student with passwordless account + invite | ✅ Exists (`register-competitor`) | Preserve; surface more clearly in UI |
| Autocomplete dojo search during registration | ✅ Exists | Extend: trigger auto-link on selection |
| Distinguish claimed vs. unclaimed accounts in member list | ❌ Missing | Add `account_claimed` column to `academy_members` |
| CSV roster import | ❌ Missing | New endpoint + minimal UI |
| Auto-link competitor to dojo on profile save | ❌ Missing | New logic in profile save handler |
| Notify dojo manager when someone links to their dojo | ❌ Missing | New email template + send in profile save handler |
| Manager approval/removal of auto-linked member | ✅ Exists (approval flow) | Wire it to the auto-link trigger |
| Search dojo roster for team building | ✅ Exists (`GET /api/academies/:id/members`) | Use this endpoint in team building UI |

---

## Part 2 — Database Migrations

### Migration 049 — `tournament_events.team_price`

**Why:** No flat per-team price exists. Team events inherit the individual `price_override` / `addon_price_override` model, which is wrong for a flat-fee-per-team structure.

```sql
-- migrations/[timestamp]_049-team-price.js
ALTER TABLE tournament_events
  ADD COLUMN team_price DECIMAL(10,2) NULL;
```

No index. Read-only on event fetch; never filtered.

---

### Migration 050 — `registrations.team_id`

**Why:** This is the single critical missing link. No registration record can currently express team membership.

```sql
-- migrations/[timestamp]_050-registration-team-id.js
ALTER TABLE registrations
  ADD COLUMN team_id UUID NULL
    REFERENCES tournament_teams(id) ON DELETE SET NULL;

CREATE INDEX idx_registrations_team_id
  ON registrations(team_id)
  WHERE team_id IS NOT NULL;
```

`ON DELETE SET NULL`: if a team is deleted, the registration money record is preserved (with `team_id = NULL`). Money records must not be cascade-deleted.

---

### Migration 051 — `tournament_teams` payment tracking columns

**Why:** The `tournament_teams` table has no payment state. For director-created walk-in teams (Path C) with no Stripe session, payment status must live on the team row.

```sql
-- migrations/[timestamp]_051-team-payment-tracking.js
ALTER TABLE tournament_teams
  ADD COLUMN payment_status   VARCHAR(50) NOT NULL DEFAULT 'unpaid',
  ADD COLUMN registered_by    UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN stripe_session_id VARCHAR(255) NULL;
```

`payment_status` values: `'unpaid'` | `'paid'` | `'cash'` | `'waived'`

---

### Migration 052 — `academy_members.account_claimed`

**Why:** Needed to distinguish invited-but-unclaimed roster entries from active members in the dojo dashboard and team building UI.

```sql
-- migrations/[timestamp]_052-academy-member-claimed.js
ALTER TABLE academy_members
  ADD COLUMN account_claimed BOOLEAN NOT NULL DEFAULT FALSE;
```

Set to `TRUE` when the invited user first authenticates via their claim/setup link (in the auth controller, after account activation).

---

### Migration 053 — Team name uniqueness index

**Why:** The current UNIQUE constraint on `tournament_teams` is `(tournament_id, team_code)`. Two teams can have the same name in the same tournament. The spec requires unique team names per tournament.

```sql
-- migrations/[timestamp]_053-team-name-unique.js
CREATE UNIQUE INDEX idx_tournament_teams_name_unique
  ON tournament_teams(tournament_id, lower(team_name));
```

A partial unique index on lowercased name allows case-insensitive uniqueness without a CHECK constraint. "Dragon Dojo A" and "dragon dojo a" would collide.

---

### Summary of All Schema Changes

| Table | Column | Type | Nullable | Default |
|---|---|---|---|---|
| `tournament_events` | `team_price` | DECIMAL(10,2) | YES | NULL |
| `registrations` | `team_id` | UUID FK → tournament_teams | YES | NULL |
| `tournament_teams` | `payment_status` | VARCHAR(50) | NO | `'unpaid'` |
| `tournament_teams` | `registered_by` | UUID FK → users | YES | NULL |
| `tournament_teams` | `stripe_session_id` | VARCHAR(255) | YES | NULL |
| `academy_members` | `account_claimed` | BOOLEAN | NO | `FALSE` |
| New index | `tournament_teams(tournament_id, lower(team_name))` | UNIQUE | — | — |

**No new tables.** 6 column additions + 1 index across 4 existing tables.

---

## Part 3 — API Changes

### 3.1 Modified: Tournament Events CRUD

**File:** `server/controllers/tournamentController.js`

**`createEvent()` (lines 365–385):** Accept `teamPrice` in request body → store as `team_price`.

**`updateEvent()` (lines 391–419):** Accept `teamPrice` → add `if (teamPrice !== undefined) updates.team_price = teamPrice;` (same pattern as `teamSize` on line 413).

**Validation:** If `event_type` is `'team-kata'` or `'team-kumite'` and `teamPrice` is provided, must be `>= 0`.

---

### 3.2 Modified: Profile Save — Trigger Auto-Link

**File:** Wherever `competitor_profiles` is inserted/updated with an `academy_id`. This is in `server/controllers/profilesController.js` or equivalent (look for the profile upsert logic).

**Change:** After saving the profile, if `academy_id` is now set:
1. Upsert an `academy_membership_requests` row with `status='pending'` for `(academy_id, user_id)`.
2. Look up the dojo's `head_coach_id`.
3. Fetch the head coach's email from `users`.
4. Send a `sendDojoMemberRequestEmail()` notification.

**Conflict handling:** The `academy_membership_requests` table has `UNIQUE(academy_id, user_id)`. Use `ON CONFLICT DO NOTHING` — if the user is already linked or has a pending request, silently skip.

---

### 3.3 New: `POST /api/academies/:id/import-roster` — CSV Roster Import

**File:** Add to `server/routes/academies.js` + `server/controllers/academyController.js`

**Auth:** `requireAuth`, head_coach only

**Request:** `multipart/form-data` with a CSV file. Required columns: `first_name`, `last_name`, `email`. Optional: `belt_rank`, `date_of_birth`.

**Logic:** Parse CSV rows, for each row call the same logic as `register-competitor` (create passwordless account if email not found, add to `academy_members`, send invite email). Collect results per-row.

**Response:**
```json
{
  "imported": 12,
  "skipped": 2,
  "errors": [
    { "row": 3, "email": "bad@email", "error": "Invalid date_of_birth format" }
  ]
}
```

---

### 3.4 New: `POST /api/tournaments/:id/teams` — Create Single Team

**File:** `server/routes/teams.js` + `server/controllers/teamController.js`

**Auth:** `requireAuth` (any authenticated user — a competitor can create a team)

**Why new (not reuse sync):** The existing `POST /:id/teams/sync` is a bulk-replace operation for director localStorage sync. Checkout needs atomic single-team creation inside a transaction.

**Request body:**
```json
{
  "eventId": "uuid",
  "teamName": "Dragon Dojo A",
  "members": [
    { "profileId": "uuid", "firstName": "Ana", "lastName": "Garcia", "isRegistrant": true },
    { "firstName": "Carlos", "lastName": "Lopez", "email": "carlos@example.com" },
    { "firstName": "Maria", "lastName": "Ruiz", "email": "maria@example.com" }
  ]
}
```

**Validation:**
1. Tournament exists and is open for registration
2. `eventId` belongs to this tournament
3. `event_type` is `'team-kata'` or `'team-kumite'`
4. `team_price` is not NULL (must be set in wizard before team registration can proceed)
5. `teamName` not blank
6. `teamName` unique within tournament (enforced by migration 053 index — catch constraint violation)
7. `members.length` equals event `team_size`
8. Exactly one member has `isRegistrant: true`

**Team code generation:** Move the client-side code from `app.js` to a server utility `server/utils/teamCode.js`. Generate a random 6-char alphanumeric string, retry on collision against `tournament_teams`.

**Response (201):**
```json
{
  "team": {
    "id": "uuid",
    "teamCode": "TEAM-ABC123",
    "teamName": "Dragon Dojo A",
    "eventId": "uuid",
    "members": [...]
  }
}
```

**Response (409):** `{ "error": "A team named 'Dragon Dojo A' already exists in this tournament" }`

---

### 3.5 New: `PUT /api/tournaments/:id/teams/:teamId/members` — Swap Member

**Auth:** `requireAuth`, `requireTournamentOwner` (director only)

**Request body:**
```json
{
  "memberIndex": 1,
  "replacement": {
    "profileId": "uuid",
    "firstName": "New",
    "lastName": "Person",
    "email": "new@example.com"
  }
}
```

**Logic:** Load team, replace `members[memberIndex]` in JSONB array, UPDATE row. Return updated team.

---

### 3.6 New: `GET /api/tournaments/:id/teams/with-registrations` — Director Team List

**Auth:** `requireAuth`, `requireTournamentOwner`

**Query:**
```sql
SELECT
  tt.id, tt.event_id, tt.team_code, tt.team_name,
  tt.members, tt.payment_status, tt.registered_by, tt.created_at,
  r.id            AS registration_id,
  r.payment_status AS registration_payment_status,
  r.amount_paid,
  r.total_due
FROM tournament_teams tt
LEFT JOIN registrations r ON r.team_id = tt.id
WHERE tt.tournament_id = $1
ORDER BY tt.created_at DESC;
```

**Response:** `{ "teams": [{ id, teamCode, teamName, eventId, members, paymentStatus, hasUnclaimedMembers, registrationId }] }`

`hasUnclaimedMembers` = computed server-side: any member in the JSONB array that has no `profileId` field set.

---

### 3.7 New: `PATCH /api/tournaments/:id/teams/:teamId/payment` — Mark Cash Payment

**Auth:** `requireAuth`, `requireTournamentOwner`

**Request body:** `{ "paymentStatus": "cash" | "waived" | "unpaid" }`

**Logic:**
1. Verify tournament ownership
2. `UPDATE tournament_teams SET payment_status = $1 WHERE id = $2 AND tournament_id = $3`
3. If a linked `registrations` row exists, also update its `payment_status = 'paid'`

---

### 3.8 New: `GET /api/academies/:id/members/search?q=` — Roster Search for Team Building

**Auth:** `requireAuth` (any member of the academy, not just head coach — a competitor needs to search their own dojo's roster)

**Why:** The existing `GET /api/academies/:id/members` returns all members but is not searchable by name. The team building UI needs fast name search within a dojo.

**Query:** `SELECT users.id, users.first_name, users.last_name, competitor_profiles.belt_rank, competitor_profiles.id AS profile_id, academy_members.account_claimed FROM academy_members JOIN users ON ... LEFT JOIN competitor_profiles ON ... WHERE academy_id = $1 AND (first_name ILIKE $2 OR last_name ILIKE $2) LIMIT 10`

**Response:** `{ "members": [{ userId, profileId, firstName, lastName, beltRank, accountClaimed }] }`

---

### 3.9 Modified: `POST /api/registrations/checkout`

**File:** `server/controllers/registrationController.js` (lines 329–681)

**What changes:** Accept an optional top-level `teamData` field.

**If `teamData` is absent:** Flow is identical to current behavior. Zero regressions.

**New request body shape (team event):**
```json
{
  "tournamentId": "uuid",
  "competitors": [
    { "profileId": "uuid", "events": [{ "eventId": "uuid" }] }
  ],
  "teamData": {
    "eventId": "uuid",
    "teamName": "Dragon Dojo A",
    "isNewTeam": true,
    "existingTeamId": null,
    "members": [
      { "profileId": "uuid", "firstName": "Ana", "lastName": "Garcia", "isRegistrant": true },
      { "firstName": "Carlos", "lastName": "Lopez", "email": "carlos@example.com" },
      { "firstName": "Maria", "lastName": "Ruiz", "email": "maria@example.com" }
    ]
  },
  "discountCode": null
}
```

**Additional validation steps (when `teamData` present):**
1. Load event by `teamData.eventId` — must belong to this tournament
2. `event_type` must be `'team-kata'` or `'team-kumite'`
3. `team_price` must not be NULL
4. `members.length` must equal event `team_size`
5. Registrant's `profileId` must appear in `members` with `isRegistrant: true`
6. If `isNewTeam`: check name uniqueness (catch DB unique constraint violation)
7. If `!isNewTeam`: load existing team, verify it belongs to this tournament + event, verify `payment_status === 'unpaid'`, verify team is not already full
8. For members with `profileId`: check they are not already in a paid team for this event
9. Eligibility soft-check: if event has `age_min/max`, `rank_min/max`, `gender` constraints, load profiles and flag violations in the response as `warnings[]` — do NOT hard-block

**Stripe line item for team event:**
```
"[teamName] — [event.name]"   $[event.team_price]   qty: 1
```
Individual events on the same cart remain separate line items at standard per-competitor pricing.

**Metadata stored in Stripe session:** Add `teamDataJson: JSON.stringify(teamData)` as a separate metadata key alongside the existing `cartData` key (to stay under Stripe's 500-char per-key limit).

**⚠️ Stripe metadata size risk (flagged):** If `teamData` with 3 members + emails approaches the 500-char limit, store it server-side in a temporary table keyed by `stripe_session_id` and retrieve it at confirm time instead.

---

### 3.10 Modified: `createRegistrationsFromCart()` (lines 1119–1202)

**If `cartData.teamData` is present (inside the existing transaction):**

```
1. If isNewTeam:
   - Generate team_code (server-side, collision-safe)
   - INSERT tournament_teams {
       tournament_id, event_id, team_code, team_name,
       members (JSONB), payment_status='paid',
       registered_by=userId, stripe_session_id
     }
   - teamId = inserted.id

2. If !isNewTeam:
   - UPDATE tournament_teams SET
       members = updated_members_jsonb,
       payment_status='paid',
       registered_by=userId,
       stripe_session_id=sessionId
     WHERE id = existingTeamId
   - teamId = existingTeamId

3. UPDATE registrations SET team_id = teamId
   WHERE id = [registration id for the registrant's competitor entry]

4. [After transaction commit — post-commit side effects]
   For each member in teamData.members where profileId IS NULL:
     → sendTeamInviteEmail(member.email, tournament, teamName, registrant.name, signupUrl)
   For each member where profileId IS NOT NULL AND userId != registrant.userId:
     → sendTeamNotificationEmail(member.email, tournament, teamName, registrant.name)
```

**The individual registration path is completely unchanged.** The team logic is strictly inside an `if (cartData.teamData)` block.

---

### 3.11 Modified: `POST /api/registrations/pay-later`

Same pattern as 3.9 / 3.10: accept `teamData`, validate, create team with `payment_status='unpaid'`. Director marks paid later via endpoint 3.7.

---

## Part 4 — Frontend Changes

### 4.1 Tournament Builder Wizard — `team_price` Field

**File:** `client/wizard.html`

**Where:** In the event configuration panel, after the team size dropdown (~lines 1596–1640). Show only when event type is `'team-kata'` or `'team-kumite'`.

```html
<div class="form-group" id="team-price-group" style="display:none;">
  <label>Price Per Team</label>
  <div class="input-prefix-wrapper">
    <span class="prefix">$</span>
    <input type="number" id="team-price-input" min="0" step="0.01"
           placeholder="50.00" />
  </div>
  <p class="help-text">
    Flat fee per team. Replaces per-competitor pricing for this event.
  </p>
</div>
```

JS: show/hide alongside team size dropdown. Include `teamPrice: parseFloat(value) || null` in the event config payload. Send to `POST /api/tournaments/:id/events`.

---

### 4.2 Director Dashboard — Event Edit Form

**File:** `client/app.js`

**Where:** In the event edit modal/form where `priceOverride` and `addonPriceOverride` are currently shown. Add `team_price` input that appears/disappears based on `event_type`. Load from server's event data. Include `teamPrice` in PUT payload.

---

### 4.3 Public Registration — Team Event UI

**File:** `client/tournament.html` or `client/register.html` (wherever the event selection checkboxes and checkout call live)

When a competitor checks a team event, the standard per-event price display is replaced by a team registration panel:

```
┌──────────────────────────────────────────────────────┐
│  ☑  Team Kata — Advanced                             │
│  ─────────────────────────────────────────────────── │
│  Team Name *                                         │
│  [ Dragon Dojo A                               ]     │
│                                                      │
│  Teammate 1                                          │
│  [ Search your dojo roster...            ▾ ]         │
│  ── or add manually ──                               │
│  [ First name ] [ Last name ] [ Email       ]        │
│                                                      │
│  Teammate 2                                          │
│  [ Search your dojo roster...            ▾ ]         │
│  ── or add manually ──                               │
│  [ First name ] [ Last name ] [ Email       ]        │
│                                                      │
│  Team Price: $50.00 (flat fee for all 3 members)     │
└──────────────────────────────────────────────────────┘
```

**Roster search autocomplete:** Calls `GET /api/academies/:id/members/search?q=Y` (new endpoint 3.8) using the registrant's `academy_id`. If the user has no linked academy, falls back to free manual entry only. Shows `firstName lastName · beltRank` in the dropdown.

**Cart display for team events:**
```
Team Kata — Dragon Dojo A               $50.00
  Ana Garcia (you) · Carlos Lopez · Maria Ruiz
```

**Checkout payload:** Includes `teamData` per spec 3.9.

**Validation before submission:**
- Team name not blank
- Both teammate slots filled (either from roster or manual entry)
- If manual entry: first name + last name required, email optional but recommended (needed for invite)

---

### 4.4 Director Dashboard — Team List View

**File:** `client/app.js`

**Trigger:** When director selects a team event from the event list, show teams panel instead of individual registrations list.

**Table columns:** Team Name | Members | Payment | Complete | Actions

**Complete column:**
- 🟢 if all members have `profileId` set in the JSONB
- 🟡 if any member has no `profileId` (unregistered teammate). Tooltip: *"One or more teammates haven't created a Taikai account. This doesn't affect their bracket placement."*

**Actions per row:**
- **Edit Members** → opens member swap modal (calls endpoint 3.5)
- **Mark Paid** → visible only if `paymentStatus !== 'paid'` (calls endpoint 3.7)

**Data source:** `GET /api/tournaments/:id/teams/with-registrations` (endpoint 3.6)

---

### 4.5 Director Dashboard — Walk-in Team Creation (Path C)

**File:** `client/app.js`

**UI:** "Add Walk-in Team" button in the team list view → modal with:
- Event dropdown (filtered to team events only)
- Team name input
- Member entries (N = `team_size`): first name, last name, optional email
- Payment method: **Stripe** (generate checkout link to send to team captain) or **Cash** (create team immediately with `payment_status='cash'`)

**Flow:**
1. POST to `POST /api/tournaments/:id/teams` (endpoint 3.4)
2. If cash: `PATCH /api/tournaments/:id/teams/:teamId/payment` with `{ paymentStatus: 'cash' }` (endpoint 3.7)
3. Team appears in team list

---

### 4.6 Dojo Dashboard — Account Claimed Indicator

**File:** `client/account.html`

**Where:** The existing member list in the "My Dojo" tab.

**Change:** Add a status badge per member:
- ✅ **Active** if `account_claimed = true`
- 📧 **Invite Sent** if `account_claimed = false`

**Also add:** A "Resend Invite" button for unclaimed members, which calls the existing `register-competitor` endpoint to re-trigger the invite email.

---

### 4.7 Dojo Dashboard — CSV Import

**File:** `client/account.html`

**UI:** Small "Import from CSV" button in the member management section → modal with:
- File input accepting `.csv`
- Template download link (shows expected column format)
- Import results summary after upload (X imported, Y skipped, errors listed)

**Calls:** `POST /api/academies/:id/import-roster` (endpoint 3.3)

---

### 4.8 Registration — Auto-Link Dojo on Selection

**File:** `client/register.html` (lines 2884–2917, the autocomplete handler)

**Change:** When a user selects a dojo from the autocomplete dropdown, store the dojo's `id` in a hidden field alongside the name. When the profile is saved to the server, include `academyId: selectedAcademyId` in the payload so the backend can trigger the auto-link flow (see 3.2).

Currently, the autocomplete only stores the name string. The `id` from the search result needs to be captured and sent.

---

### 4.9 Bracket Display — Team Slots

**File:** `client/app.js` (bracket rendering functions)

**Change:** Wherever competitor name is rendered in a bracket slot, check for `slot.isTeam === true`. If so:

```html
<div class="bracket-competitor bracket-competitor--team">
  <span class="bracket-team-name">Dragon Dojo A</span>
  <span class="bracket-team-members">Ana G. · Carlos L. · Maria R.</span>
</div>
```

Individual bracket slots are unaffected (no `isTeam` flag → existing render path).

**Scoreboard:** Where competitor name appears on the scoreboard display, check `isTeam` and show `teamName` in the primary name field.

---

## Part 5 — Checkout Pipeline (End-to-End)

```
1. Competitor selects team event checkbox on registration page
   → Team panel appears (team name input + 2 teammate slots)

2. Competitor fills:
   - Team name (real-time uniqueness check via debounced GET to search endpoint)
   - Teammate 1: roster autocomplete search (GET /api/academies/:id/members/search)
                 or manual: first name + last name + email
   - Teammate 2: same as above

3. Cart renders:
   - Team event: single line "Dragon Dojo A — Team Kata  $50.00"
   - Any individual events: standard per-competitor lines
   - Total combines both

4. POST /api/registrations/checkout
   Body: { tournamentId, competitors: [{profileId, events}], teamData: {...}, discountCode }

5. Server validates (existing + new):
   - Team name unique (migration 053 index)
   - team_price set on event
   - members.length == team_size
   - Registrant in members list
   - Eligibility soft-checks (return warnings[], not errors[])

6. Server creates Stripe Checkout Session:
   - Individual line items (existing logic)
   - Team line item: "Dragon Dojo A — Team Kata" @ team_price, qty 1
   - Metadata: cartData + teamDataJson (separate key)

7. User completes Stripe payment

8. POST /api/registrations/confirm { sessionId }

9. Server: createRegistrationsFromCart()
   ┌─ TRANSACTION ─────────────────────────────────────┐
   │  a. Create individual registration rows (existing) │
   │  b. Detect cartData.teamData present               │
   │  c. Generate team_code (server-side)               │
   │  d. INSERT tournament_teams {                      │
   │       team_name, team_code, event_id,              │
   │       tournament_id, members JSONB,                │
   │       payment_status='paid',                       │
   │       registered_by=userId,                        │
   │       stripe_session_id                            │
   │     }                                              │
   │  e. UPDATE registrations SET team_id = team.id     │
   │     WHERE id = registrantRegistrationId            │
   └───────────────────────────────────────────────────┘

10. Post-commit side effects (async, non-blocking):
    - Send registration confirmation email (existing)
    - For each member with no profileId:
        sendTeamInviteEmail(email, tournament, teamName, addedByName, signupUrl)
    - For each member with profileId but different userId:
        sendTeamNotificationEmail(email, tournament, teamName, addedByName)

11. Redirect to confirmation page
    - Show team details: team name, members, what happens next (invite emails sent)
```

**Free team events (team_price = 0.00):** The existing path at `registrationController.js` lines 602–606 already handles `finalTotal === 0` by calling `createRegistrationsFromCart()` directly (bypassing Stripe). This works for free team events without modification.

---

## Part 6 — Bracket Generation Changes

### Current Individual Flow

```
Event → Divisions → Pull registrations by assigned_division →
Each registration → competitor profile object {id, firstName, lastName, ...} →
Placed in bracket slot as redCorner / blueCorner
```

### New Team Event Flow

**Detection:** Before generating bracket slots, check `tournament_events.event_type`. If `'team-kata'` or `'team-kumite'`: use team path.

**Data source query:**
```sql
SELECT id, team_code, team_name, members, payment_status
FROM tournament_teams
WHERE tournament_id = $1
  AND event_id = $2
  AND payment_status IN ('paid', 'cash', 'waived');
```

**Bracket slot structure for teams:**
```json
{
  "id": "TEAM-ABC123",
  "isTeam": true,
  "teamCode": "TEAM-ABC123",
  "teamName": "Dragon Dojo A",
  "members": [
    { "firstName": "Ana", "lastName": "Garcia", "profileId": "uuid" },
    { "firstName": "Carlos", "lastName": "Lopez" },
    { "firstName": "Maria", "lastName": "Ruiz" }
  ],
  "firstName": "Dragon Dojo A",
  "lastName": ""
}
```

The `firstName: teamName, lastName: ""` shim means any existing code that renders `slot.firstName + ' ' + slot.lastName` will display the team name correctly without modification. The `isTeam: true` flag enables the richer display (section 4.9).

**Division assignment:** Team events do NOT call `assignDivision()`. In Phase 1, teams for a given event are placed into a single default division. The director can manually arrange into sub-divisions from the bracket generation UI if needed. This avoids building team-aware criteria matching from scratch.

**Bracket JSONB:** No schema change. The `data` column stores team slot objects in `redCorner` / `blueCorner` fields. The `id` field uses `team_code` as the identifier (a unique string per tournament — same shape as competitor IDs in usage). Match advancement, scoring, and publishing work identically.

---

## Part 7 — Email Changes

### New: Team invite email

**New file:** `server/emails/teamInvite.js`

**Parameters:** `{ tournament: { name, date, location }, teamName, addedByName, createAccountUrl }`

**Subject:** `You've been invited to compete with ${teamName} at ${tournament.name}`

---

### New: Team notification email (existing account holders)

**New file:** `server/emails/teamNotification.js`

**Parameters:** `{ tournament: { name }, teamName, addedByName }`

**Subject:** `You've been added to ${teamName} — ${tournament.name}`

---

### New: Dojo member request notification

**New file:** `server/emails/dojoMemberRequest.js`

**Parameters:** `{ dojoName, competitorName, tournamentName, reviewUrl }`

**Subject:** `New member request for ${dojoName}`

Sent to the dojo head coach when a competitor auto-links to their dojo during tournament registration.

---

### New functions in `server/email.js`

```javascript
sendTeamInviteEmail(to, tournament, teamName, addedByName, createAccountUrl)
sendTeamNotificationEmail(to, tournament, teamName, addedByName)
sendDojoMemberRequestEmail(to, dojoName, competitorName, tournamentName, reviewUrl)
```

---

## Part 8 — Risk Assessment

### 🔴 Highest Risk

**`createRegistrationsFromCart()` modification**
All money flows pass through this function. The team code path is additive (inside `if (cartData.teamData)`), but if the team INSERT fails after the registration INSERT has already succeeded within the transaction, the whole transaction should roll back. Verify that the team creation is inside the same transaction client. Any logic error here = money with no team record, or team record with no registration — both are bad.

**Mitigation:** Team creation runs inside the existing transaction. Write explicit rollback tests. Test both success path and failure paths (duplicate team name, team INSERT error) before deploying to production.

---

### 🟠 High Risk

**Stripe metadata size**
Stripe limits metadata keys to 500 characters each. `teamDataJson` with 3 members (name, email, profileId × 3) is approximately 300–400 characters — close to the limit. If a tournament name is long or emails are long, it may overflow.

**Mitigation:** Before creating the Stripe session, measure the serialized `teamData` string length. If > 450 chars, store it server-side in a `pending_team_checkouts` temp table (or `tournament_teams` with `payment_status='pending'`) keyed by a lookup token stored in Stripe metadata instead of the full payload. Retrieve it at confirm time.

**`tournament_teams` sync overwrite (Path C vs. checkout teams)**
The director's `POST /:id/teams/sync` deletes teams not in the incoming array. If a director loads their localStorage-cached teams and syncs, checkout-created teams (not in localStorage) would be deleted.

**Mitigation:** Add a `source` VARCHAR column to `tournament_teams` (`'director'` | `'checkout'`). The sync endpoint only deletes/updates rows where `source = 'director'`. Rows with `source = 'checkout'` are never touched by the sync operation.

This also requires adding `source` column to Migration 051 (or a new migration). Add it alongside the payment tracking columns.

---

### 🟡 Medium Risk

**Profile save auto-link side effect**
Adding dojo auto-link logic to the profile save handler means every time a user updates their profile with a dojo ID, a membership request may be created. If a user changes their dojo repeatedly, they accumulate requests. Use `ON CONFLICT DO NOTHING` on the `academy_membership_requests` insert to prevent duplicates.

**Autocomplete ID capture in register.html**
The current autocomplete only stores the dojo name string, not the ID. If the ID capture code is written incorrectly (e.g., stores name as ID), the auto-link will silently fail. Test explicitly: select a dojo from autocomplete → save profile → verify `competitor_profiles.academy_id` is a valid UUID, not a string.

**Bracket team slot rehydration**
The bracket system "slims" competitor objects before storage (removes photo/clubLogo) and "rehydrates" them from the master competitors list when reading. Team slots do not exist in the competitors list — they have no photos. Verify that the rehydration logic does not fail or produce null slots when it can't find an entity with `id = "TEAM-ABC123"` in the competitors list. The fix is to detect `isTeam: true` and skip rehydration for those slots.

---

### 🟢 Lower Risk

**Invite email delivery failure**
Emails are sent post-commit. Registration is already confirmed. Email failure is non-blocking. Log failures and surface them in a director notification.

**CSV import format errors**
Row-level validation with per-row errors returned. Bad rows are skipped; valid rows are imported. No transaction rollback for partial failures — each row is independent.

**Dojo uniqueness for team building**
If a competitor's `academy_id` is NULL (they typed a freeform dojo name), the roster search for team building returns zero results — the UI falls back gracefully to manual entry only.

---

## Part 9 — Recommended Build Order

### Phase 0 — Prerequisite: Dojo Auto-Link (enables Path A)

**Step 0.1:** Run Migration 052 (`academy_members.account_claimed`).

**Step 0.2:** Modify the autocomplete handler in `register.html` to capture the academy `id` when a user selects from the dropdown. Store in hidden field. Send `academyId` in profile save payload.

**Step 0.3:** Modify profile save controller: if `academyId` is set, upsert `academy_membership_requests` row + send dojo notification email. Test: select a dojo, save profile, verify request row created and email sent.

**Step 0.4:** Add new email template `dojoMemberRequest.js` + `sendDojoMemberRequestEmail()`.

**Step 0.5:** Add "account claimed" badge to dojo member list in `account.html`.

**Checkpoint:** A competitor can link to a dojo and appear in the dojo manager's pending members list. The dojo's roster is now searchable for team building. **This is the prerequisite for Path A.**

---

### Phase 1 — Foundation: Schema + Event Pricing

**Step 1.1:** Run Migration 049 (`tournament_events.team_price`), Migration 050 (`registrations.team_id`), Migration 051 (`tournament_teams` payment columns + `source` column), Migration 053 (team name unique index).

**Step 1.2:** Extend `createEvent()` / `updateEvent()` to accept and store `teamPrice`.

**Step 1.3:** Add `team_price` field to wizard (`wizard.html`) and director event edit form (`app.js`).

**Step 1.4:** Test: create a team-kata event with a price in wizard → verify stored → load event in director edit → verify value loads back.

**Checkpoint:** Team events can now have a price. Nothing else has changed.

---

### Phase 2 — Server: Team Creation + Checkout

**Step 2.1:** Add `server/utils/teamCode.js` (team code generator, moved from client).

**Step 2.2:** Add `POST /api/tournaments/:id/teams` endpoint. Test in isolation with Postman: create team, verify row in `tournament_teams`.

**Step 2.3:** Modify `checkout()` to accept and validate `teamData`. Do NOT yet change `createRegistrationsFromCart()`. In this step: validate team data, build Stripe line item, store `teamDataJson` in metadata. Test: send checkout request with `teamData` → verify Stripe session has team line item.

**Step 2.4:** Modify `createRegistrationsFromCart()` — add team creation inside the transaction. Test thoroughly:
- Happy path: checkout + confirm → team row created, `registration.team_id` set
- Rollback path: if team INSERT fails (duplicate name), transaction rolls back, no registration created
- Individual path: checkout without `teamData` → zero change in behavior

**Step 2.5:** Modify `pay-later` same way.

**Checkpoint:** Full server pipeline works for team events. Individual checkout completely unaffected.

---

### Phase 3 — Public Registration UI

**Step 3.1:** Add `GET /api/academies/:id/members/search` endpoint.

**Step 3.2:** Build team panel UI component — team name input + 2 teammate slots (autocomplete + manual fallback). Wire show/hide to team event checkbox.

**Step 3.3:** Update cart display for team events.

**Step 3.4:** Wire checkout POST to include `teamData`.

**Step 3.5:** End-to-end test: register for team event → stripe → confirm → verify `tournament_teams` row + `registrations.team_id`.

**Checkpoint:** Path B works end-to-end.

---

### Phase 4 — Invite Emails

**Step 4.1:** Write `teamInvite.js` and `teamNotification.js` templates.

**Step 4.2:** Add `sendTeamInviteEmail()` and `sendTeamNotificationEmail()` to `server/email.js`.

**Step 4.3:** Add post-commit dispatch in `createRegistrationsFromCart()`.

**Step 4.4:** Implement account claim auto-link: on signup with invite token, match `teamCode + memberEmail`, update `members[n].profileId` in JSONB.

**Checkpoint:** Invites sent after checkout. Profile linked on signup.

---

### Phase 5 — Director Dashboard Team View + Path C

**Step 5.1:** Add `GET /api/tournaments/:id/teams/with-registrations`, `PUT /api/tournaments/:id/teams/:id/members`, `PATCH /api/tournaments/:id/teams/:id/payment` endpoints.

**Step 5.2:** Build team list view in `app.js` (table, badges, edit, mark-paid).

**Step 5.3:** Build walk-in team creation modal (Path C).

**Step 5.4:** Fix `syncTeams()` to skip `source='checkout'` rows.

**Checkpoint:** Path C works. Director can manage all teams.

---

### Phase 6 — Brackets

**Step 6.1:** Add team-aware bracket generation: detect team events → query `tournament_teams` → build team slot objects with `isTeam: true` shim.

**Step 6.2:** Update bracket slot rendering in `app.js`: `isTeam` → team name + members display.

**Step 6.3:** Update scoreboard to display `teamName`.

**Step 6.4:** Fix bracket rehydration to skip lookups for `isTeam` slots.

**Step 6.5:** End-to-end test: register 4+ teams → generate bracket → score a match → verify winner advances.

**Checkpoint:** Feature complete.

---

### Phase 7 — Dojo CSV Import (lower priority, independent)

Can be built in parallel with any phase above. No dependencies.

**Step 7.1:** Add CSV parsing utility (use `papaparse` or a simple row-split).

**Step 7.2:** Add `POST /api/academies/:id/import-roster` endpoint.

**Step 7.3:** Add import UI to `account.html`.

---

## Part 10 — What Will NOT Be Changed

| System | Files | Status |
|---|---|---|
| `tournament_teams` table schema | Migration 030 | Preserved; new columns added in migration 051 |
| `academies`, `academy_members`, `academy_membership_requests` tables | Migrations 002, 004 | Preserved; one column added to `academy_members` |
| Teams API (list, sync, public search) | `server/routes/teams.js`, `teamController.js` | Preserved; new endpoints added alongside |
| Director team sync UI | `app.js` `_syncTeamsToServer()` lines 926–942 | Preserved; sync made `source`-aware to not overwrite checkout teams |
| Dojo management UI (create, edit, members, transfer) | `client/account.html` lines 322–1264 | Preserved; claim badge and CSV import added to existing UI |
| Academy search autocomplete | `GET /api/academies/search`, `server/db/queries/academies.js` `searchByName()` | Preserved |
| Individual registration checkout flow | `registrationController.js` lines 329–681 | Preserved; `teamData` is optional and absent for all individual registrations |
| `createRegistrationsFromCart()` individual path | `registrationController.js` lines 1119–1202 | Preserved; team code path is additive inside `if (cartData.teamData)` |
| Division assignment service | `server/services/divisionAssignment.js` | Not called for team events; untouched |
| Bracket system (individual) | `tournament_brackets`, `server/db/queries/brackets.js` | Preserved; team path is a parallel branch |
| Criteria presets | `client/criteria-presets.js` | Untouched |
| All migrations 001–048 | `/migrations/` | Read-only references only |
| Email infrastructure | `server/email.js` existing functions | Preserved; new functions added |
| Stripe webhook handler | `server/routes/webhook.js` | Preserved |
| Guardian / minor registration flow | `registrationController.js` guardian paths | Preserved |
| Scoring system | Bracket scoring, judge vote logic | Preserved; team is scored as one unit same as individual |
