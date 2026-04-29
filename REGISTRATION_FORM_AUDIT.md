# Registration Form Audit
_Generated: 2026-03-18 — pre-implementation sweep_

---

## Summary

8 distinct paths create or modify competitor/user records. They are inconsistent in fields, option sources, and validation. This document inventories all of them so every subsequent build step uses one consistent field source.

---

## Path 1 — Public Competitor Self-Registration

**Files:** `client/public.html` (lines 87–187), `client/public.js` (lines 444–547)
**Role:** Unauthenticated competitor or parent registering for a tournament
**API:** `POST /api/registrations/competitor`

### Fields
| Field | Type | Options Source | Issues |
|---|---|---|---|
| First name | text | — | OK |
| Last name | text | — | OK |
| Date of birth | date | — | OK |
| Guardian email | text | — | Shown if age < 18 (client-only, no server enforcement) |
| Email | email | — | OK |
| Phone | tel | — | OK |
| Gender | dropdown | **Hardcoded HTML** (Male, Female) | No other options |
| Rank/Belt | dropdown | **Hardcoded HTML** (White → 3rd Dan only, 3 Dans) | Inconsistent — manage.html goes to 10th Dan |
| Experience | number | — | Freeform number (years); no link to division experience-level options |
| Weight | number | — | Always shown; no tournament-level toggle |
| Dojo/Academy | two inputs | `pub-club` freeform + `pub-academySearch` autocomplete (server) | **TWO competing inputs** — both stored, unclear precedence |
| Photo | file | — | Uploaded as base64 in JSON |
| Events | checkboxes | Server (`/api/eventTypes`) | OK |

### Critical Issues
- Rank options cap at 3rd Dan — directors creating divisions for higher dans will get no-match
- Two dojo inputs create ambiguity in which value reaches the competitor profile
- Guardian email validation is client-only; server does not enforce
- Experience field is a freeform number (years), not linked to division experience-level names (Beginner/Intermediate/etc.)

---

## Path 2 — Director Dashboard — Add/Edit Competitor

**Files:** `client/manage.html` (lines 664–805), `client/app.js`
**Role:** Tournament director adding competitors manually or editing existing
**API:** `POST /api/tournaments/:id/competitors`, `PUT /api/tournaments/:id/competitors/:id`

### Fields
| Field | Type | Options Source | Issues |
|---|---|---|---|
| First name | text | — | OK |
| Last name | text | — | OK |
| Date of birth | date | — | OK |
| Gender | dropdown | **Hardcoded HTML** | OK range |
| Weight | number (0.1 step) | — | Always shown |
| Rank | dropdown | **Hardcoded HTML** (10th Kyu → 10th Dan, correct range) | Hardcoded, not division-driven |
| Experience | number (0.5 step) | — | Freeform number, not division-driven |
| Dojo | dropdown | DB (loaded from API) | OK |
| Events | checkboxes | Server | OK |
| Payment status | dropdown | **Hardcoded HTML** | OK for director use |
| Team event section | conditional | In-memory team store | `_selectedTeamData` never sent to checkout API |

### Critical Issues
- Rank dropdown hardcoded — shows all dans even if tournament only uses White/Yellow/Green
- Experience is a number in years, not the string categories divisions use (Beginner/Advanced)
- Team data gathered but silently discarded at checkout (the core team registration bug)

---

## Path 3 — Dojo Manager Add Student

**Files:** `client/manage.html` (lines 2512–2540), `client/app.js` (lines ~23642–23680)
**Role:** Dojo head coach adding a student to the roster
**API:** `POST /api/academies/:id/register-competitor`

### Fields
| Field | Type | Options Source | Issues |
|---|---|---|---|
| First name | text | — | OK |
| Last name | text | — | OK |
| Email | email | — | OK |
| Date of birth | date | — | Optional |
| Phone | tel | — | Optional |

### Critical Issues
- Creates a user account only — no rank, gender, weight, experience, or event selection
- Not connected to any tournament; competitor profile not created here
- Missing: CSV import for bulk students (Copa Murayama need)
- No account_claimed distinction — relies on password_hash IS NULL

---

## Path 4 — Public Instructor Registration

**Files:** `client/public.html` (lines 190–224), `client/public.js` (lines 550–586)
**API:** `POST /api/registrations/instructor`

### Fields
| Field | Type | Options Source | Issues |
|---|---|---|---|
| First name, Last name | text | — | OK |
| Rank | **freeform text** | None | Should be a constrained dropdown |
| Dojo | text | — | Freeform |
| Email, Phone | standard | — | OK |

---

## Path 5 — Public Dojo Registration

**Files:** `client/public.html` (lines 227–253), `client/public.js` (lines 589–623)
**API:** `POST /api/registrations/club`

### Fields: Dojo name, Country, City, Email — all freeform. Out of scope for this build.

---

## Path 6 — Test Data Generator (Server-Side)

**Files:** `server/controllers/testDataController.js`
**API:** `POST /api/tournaments/:id/generate-test-data`

### Notes
- Uses hardcoded name arrays; rank values are color names ("White", "Yellow") that rely on `normalizeRank()` conversion
- Experience calculated as `min(age-5, random 0-15)` — a number in years, not a division category string
- All generated competitors tagged `is_test: true`

---

## Path 7 — register.html Multi-Step Self-Service Flow

**Files:** `client/register.html`
**Role:** Authenticated competitor updating own profile and selecting events
**API:** Various profile and registration endpoints

### Notes
- Profile fields conditional on tournament's `registration_settings` (requirePhoto, requireWeight, etc.)
- Most complete approach architecturally — already reads from tournament settings
- Experience and rank still from hardcoded options in the UI, not division-driven

---

## Path 8 — Server-Side Direct Creation

**Files:** `server/controllers/directorCompetitorsController.js`
**API:** `POST /api/tournaments/:id/competitors`

- Accepts any fields; minimal validation
- Division assignment runs server-side in `divisionAssignment.js`

---

## Cross-Cutting Issues

### 1. Rank Inconsistency
- Public form: White → 3rd Dan (hardcoded)
- Director form: 10th Kyu → 10th Dan (hardcoded)
- Division assignment expects kyu/dan format; public form sends color names → relies on `normalizeRank()`
- **Fix:** All forms pull rank options from the `registration-fields` endpoint, which returns only ranks referenced in division criteria

### 2. Experience Mismatch
- Forms collect experience as a **number in years**
- Division criteria use **string categories** (Beginner, Novice, Intermediate, Advanced)
- The two are never linked; division auto-assign can't map "3 years" to "Intermediate"
- **Fix:** If divisions use experience categories, show a category dropdown. If divisions use numeric experience, show a number input. The `registration-fields` endpoint determines which

### 3. Two Dojo Inputs (Path 1)
- `pub-club` (freeform text) and `pub-academySearch` (autocomplete) coexist
- **Fix:** Collapse to single field: autocomplete-first, freeform fallback if no match

### 4. Hardcoded Everywhere
- Every form has its own hardcoded dropdown options
- **Fix:** All forms call `GET /api/tournaments/:id/registration-fields` and render options from server response

### 5. Weight Always Shown
- Weight field shown on every form regardless of tournament config
- **Fix:** `showWeight` flag from `registration-fields` endpoint (driven by `require_weight_at_registration` tournament setting)

### 6. Team Data Silently Discarded (Path 2)
- `_selectedTeamData` never included in checkout payload
- **Fix:** Part of team checkout fix (Step 5 in build order)

---

## Data Model Gaps

| Column | Table | Status |
|---|---|---|
| `team_price` | `tournament_events` | **MISSING** |
| `team_id` | `registrations` | **MISSING** |
| `payment_status` | `tournament_teams` | **MISSING** |
| `registered_by` | `tournament_teams` | **MISSING** |
| `stripe_session_id` | `tournament_teams` | **MISSING** |
| `account_claimed` | `users` | **MISSING** (password_hash IS NULL is current proxy) |
| `require_weight_at_registration` | `tournaments` | **MISSING** |
| unique index on `lower(team_name)` per tournament | `tournament_teams` | **MISSING** |

---

## Build Order (confirmed from audit)

1. **Migrations** — add all missing columns and indexes
2. **`GET /api/tournaments/:id/registration-fields`** — single source of truth for all form options
3. **Apply to all forms** — every form calls this endpoint; remove all hardcoded option lists
4. **Dojo roster management** — CSV import, account_claimed, invites
5. **Dojo auto-link on registration** — autocomplete select → direct insert (not approval flow)
6. **Team checkout fix** — team_id through cart → Stripe → registration record
7. **Path A + B team creation flows**
8. **Path C (director) wire-up**
9. **Post-checkout invite emails (Resend)**
10. **Director team visibility dashboard**
