# Registration System Rework — Implementation Plan

## Overview
Replace the flat public registration form with an account-based, multi-profile, cart-driven registration flow with Stripe payment processing. This is broken into 8 phases, implemented sequentially.

---

## Critical Prerequisite: Tournament/Event Sync to Database

**Problem**: Tournaments and events currently live ONLY in localStorage (admin browser). Remote users visiting the public site on a different browser/device can't see them. The new registration flow needs tournament + event data in PostgreSQL.

**Solution**: Add admin API endpoints for tournament + event CRUD that write to the DB. The admin dashboard will call these endpoints when creating/editing tournaments and events, keeping both localStorage AND the database in sync.

### New API Endpoints (Admin)
- `POST /api/admin/tournaments` — Create tournament (writes to DB)
- `PUT /api/admin/tournaments/:id` — Update tournament
- `GET /api/admin/tournaments` — List all tournaments (public, for registration page)
- `GET /api/admin/tournaments/:id` — Get single tournament with events (public)
- `POST /api/admin/tournaments/:id/events` — Create event for tournament
- `PUT /api/admin/tournaments/:id/events/:eventId` — Update event
- `DELETE /api/admin/tournaments/:id/events/:eventId` — Delete event
- `POST /api/admin/tournaments/:id/sync` — Bulk sync all events for a tournament (admin pushes localStorage → DB)

### Admin Dashboard Changes
- When admin creates/saves a tournament in the modal form, also POST to the API
- When admin creates/edits events, also POST to the API
- Add a "Sync to Server" button that bulk-pushes current localStorage tournaments+events to DB
- This keeps the localStorage-first approach intact while ensuring DB has the data

---

## Phase 1: Database Migration (005-registration-rework.js)

### New Tables
1. **`competitor_profiles`** — Profiles for competitors (self or children)
   - id, user_id (FK), first_name, last_name, date_of_birth, gender, belt_rank, experience_level, weight, academy_name, academy_id (FK nullable), is_self (boolean), created_at, updated_at

2. **`discount_codes`** — Admin-created discount codes
   - id, code (unique), type (percentage/fixed), value, max_uses, times_used, expires_at, active, tournament_id (FK nullable), created_by (FK), created_at

3. **`payment_transactions`** — Stripe payment records
   - id, user_id (FK), tournament_id (FK), stripe_session_id (unique), amount_total (cents), discount_code_id (FK nullable), discount_amount (cents), status (pending/completed/failed/refunded), created_at, completed_at

### Modified Tables
- **`registrations`**: Add columns — `profile_id` (FK to competitor_profiles), `payment_transaction_id` (FK to payment_transactions), `stripe_session_id`
- **`users`**: Add column — `account_type` (competitor/guardian/both)

### Files Created/Modified
- `migrations/1709600000000_005-registration-rework.js` (NEW)

---

## Phase 2: Tournament/Event Admin API + Sync

### New Server Files
- `server/routes/tournaments.js` — Tournament + event CRUD routes
- `server/controllers/tournamentController.js` — Tournament + event logic
- `server/db/queries/tournaments.js` — Tournament + event DB queries

### Modified Files
- `server/index.js` — Add `app.use('/api/tournaments', ...)` route
- `server/routes/admin.js` — Add tournament management admin routes
- `client/app.js` — Hook tournament/event form submissions to also POST to API; add "Sync to Server" button

### Key Logic
- Tournament CRUD respects existing DB schema (tournaments + tournament_events tables)
- Public GET endpoints don't require auth (anyone can see available tournaments)
- Write endpoints require admin role
- Sync endpoint accepts array of events and upserts them all

---

## Phase 3: Signup Modifications + Profile CRUD

### Signup Changes
- Add `accountType` field to signup (competitor/guardian/both)
- Validate: if accountType includes 'competitor', user must be 18+ by DOB
- Store `account_type` on users table
- Assign roles: competitor → 'competitor' role, guardian → no specific role change (they manage profiles), both → 'competitor' role
- After signup, if accountType is 'competitor' or 'both', auto-create a `competitor_profiles` record with `is_self=true` pre-filled from account data

### Profile API
- `GET /api/profiles` — Get all profiles for logged-in user
- `POST /api/profiles` — Create child profile (user_id = current user, is_self=false)
- `PUT /api/profiles/:id` — Update profile (must own it)
- `DELETE /api/profiles/:id` — Delete profile (must own it, no active registrations)

### New Server Files
- `server/routes/profiles.js`
- `server/controllers/profileController.js`
- `server/db/queries/profiles.js`

### Modified Files
- `server/controllers/authController.js` — Add accountType to signup flow
- `server/routes/auth.js` — Add accountType validation to signup
- `server/db/queries/users.js` — Update create() to include account_type
- `server/index.js` — Add profiles route

---

## Phase 4: Event Eligibility API

### New Endpoint
- `GET /api/tournaments/:id/events/eligible/:profileId` — Returns filtered events for a profile

### Filtering Logic
1. Load profile (age, gender, belt_rank, experience_level)
2. Calculate age at tournament date
3. Filter tournament_events by:
   - age_min <= age <= age_max (if set)
   - gender matches or event is 'mixed'
   - rank_min <= belt_rank <= rank_max (if set, using ordered rank list)
   - experience_level matches (if event has experience filter)
4. Return eligible events with pricing info (base vs add-on based on selection count)

### Files
- Add to `server/controllers/tournamentController.js`
- Add to `server/db/queries/tournaments.js`

---

## Phase 5: Registration Page Frontend (register.html)

### New Files
- `client/register.html` — Multi-step registration SPA
- `client/register.js` — Registration page logic (dashboard, profiles, events, cart)
- `client/register.css` — Registration-specific styles (extends public-styles.css)

### Page Sections (show/hide panels, hash-based routing)
1. **#info** — Tournament info + "Register Now" CTA → triggers auth if not logged in
2. **#dashboard** — Profile cards (self + children), "Register Myself" / "Add a Competitor" buttons
3. **#profile** — Add/edit profile form with all fields
4. **#events** — Event selection cards for a specific profile, filtered by eligibility. Click to toggle. Running subtotal. "Add to Cart" button.
5. **#cart** — All competitors + events, per-competitor subtotals, discount code field, grand total, "Pay Now" button
6. **#success** — Confirmation with registration summary

### Design
- Dark theme, glassmorphism, matching existing public-styles.css design system
- Mobile-first responsive (most competitors register from phones)
- Auth modal integrated (login/signup with accountType selector)
- Live pricing updates as events are added/removed
- Loading states, error states, empty states

### Modified Files
- `client/public.html` — Replace registration forms with "Register Now" link to register.html
- `server/index.js` — Add route alias for /register

---

## Phase 6: Stripe Checkout Integration

### New Dependencies
- `stripe` npm package

### New Server Files
- `server/config/stripe.js` — Stripe client initialization

### New API Endpoints
- `POST /api/registrations/checkout` — Validate cart, create Stripe Checkout Session, return session URL
- `POST /api/registrations/confirm` — Verify payment via session_id, create all registration records, send confirmation email
- `GET /api/registrations/my` — Get logged-in user's registrations (read-only)

### Checkout Flow
1. Client POSTs cart data to `/api/registrations/checkout`
2. Server validates: events exist, profile ownership, eligibility, pricing matches, discount code valid
3. Server creates Stripe Checkout Session with line items
4. Returns checkout URL → client redirects to Stripe
5. Stripe redirects to success URL with session_id
6. Client calls `/api/registrations/confirm` with session_id
7. Server verifies payment with Stripe API, creates registration + registration_events records in a transaction, snapshots pricing, sends confirmation email
8. Increments discount code times_used if applicable

### Environment Variables
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY` (for client)
- `STRIPE_WEBHOOK_SECRET` (optional, for reliability)

### Modified Files
- `server/index.js` — Add registration checkout routes
- `server/routes/registrations.js` — Add checkout/confirm/my endpoints
- `server/controllers/registrationController.js` — Add checkout/confirm logic
- `server/db/queries/registrations.js` — Add new query functions
- `client/register.js` — Cart checkout triggers Stripe redirect
- `server/config/email.js` — Add registration confirmation email template

---

## Phase 7: Discount Codes (Admin CRUD + Validation)

### New API Endpoints
- `POST /api/admin/discount-codes` — Create discount code
- `GET /api/admin/discount-codes` — List all discount codes
- `PUT /api/admin/discount-codes/:id` — Update
- `DELETE /api/admin/discount-codes/:id` — Delete
- `POST /api/registrations/validate-discount` — Validate code, return discount amount

### Admin Panel Changes
- Add "Discount Codes" nav button in sidebar (admin role only)
- CRUD table: code, type, value, max uses, used count, expiration, tournament, active toggle

### Files
- `server/controllers/discountController.js` (NEW)
- `server/db/queries/discounts.js` (NEW)
- Add routes to `server/routes/admin.js`
- Add routes to `server/routes/registrations.js`
- Add admin view in `client/index.html` + `client/app.js`
- Add cart discount field in `client/register.js`

---

## Phase 8: Confirmation Email + Polish

### Registration Confirmation Email
- Subject: "Registration Confirmed — [Tournament Name]"
- Body: Per-competitor event list, subtotals, discount, total paid, transaction ID, tournament details
- Uses existing Resend email pattern with console fallback

### My Registrations View
- Accessible from register.html after login
- Shows all registrations grouped by tournament
- Per-registration: competitor name, events, payment status, amount paid
- Read-only (contact admin for changes)

### Files
- `server/config/email.js` — Add `sendRegistrationConfirmationEmail()`
- `client/register.js` — Add #my-registrations section

---

## Implementation Order & Dependencies

```
Phase 1: Migration               (no deps, foundation for everything)
Phase 2: Tournament/Event API    (depends on Phase 1 for DB tables existing)
Phase 3: Signup + Profiles       (depends on Phase 1 for competitor_profiles table)
Phase 4: Event Eligibility       (depends on Phase 2 for tournament data in DB, Phase 3 for profiles)
Phase 5: Registration Frontend   (depends on Phases 2-4 for all APIs)
Phase 6: Stripe Checkout         (depends on Phase 5 for cart UI)
Phase 7: Discount Codes          (depends on Phase 6 for checkout flow)
Phase 8: Email + Polish          (depends on Phase 6 for payment confirmation)
```

## File Count Estimate
- **New files**: ~15 (migration, routes, controllers, queries, HTML, JS, CSS)
- **Modified files**: ~10 (index.js, auth routes/controller, user queries, registrations, app.js, public.html, email.js)
- **Total estimated LOC**: ~4,000-5,000

## What Is NOT Changed
- Admin localStorage operations (brackets, scoreboards, scheduling, divisions)
- Scoreboard HTML pages
- TV/mat display pages
- Cross-tab localStorage sync
- Admin manual competitor entry
- Coach academy bulk registration (existing separate flow)
- Existing auth endpoints (login, verify, reset)
