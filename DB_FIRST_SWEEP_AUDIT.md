# Database-First Sweep Audit

> Read-only investigation. No code changed.
> Date: 2026-03-18 | Tournament: March 28 (10 days)

---

## Executive Summary

The bracket and scoreboard fixes already shipped are the right architecture. The rest of the app is not. Competitors, divisions, officials, staff, schedule, and test data all follow a local-first pattern: load once into memory, operate on the local copy, push back to server via debounced bulk sync. Two directors working simultaneously will silently overwrite each other. Competitors added on one device are invisible on another device until a sync fires. Test data generated on one device doesn't exist on another.

The core issue is that `_inMemoryCompetitors` is the source of truth for the most critical data in the system — and it lives entirely in RAM.

---

## Part 1 — Audit

---

### 🔴 Finding 1 — "Refresh from Server" button (Competitors)

**File:** `client/manage.html` line 658
**Function:** `syncRegistrationsFromServer()` — `client/app.js` ~line 23680

**What it does:** Fetches registered competitors from `/api/registrations` and merges them into `_inMemoryCompetitors`. This is the mechanism by which a director sees competitors that registered online (via Stripe checkout). Without clicking this button, online registrations are invisible to the director.

**Current behavior:** The page operates on `_inMemoryCompetitors`. Online registrations accumulate on the server but are never pushed to the director's view. The director must click "Refresh from Server" to pull them in. After pulling, they live in memory only — if the page refreshes before the sendBeacon fires, the merged competitors are lost and must be re-imported.

**Database-first behavior should be:** The competitor list is always fetched from the server. New registrations appear automatically via WebSocket push. "Refresh from Server" button is removed because it's never needed.

**Multi-staff severity:** 🔴 BREAKS — Director 1 clicks Refresh, Director 2 has not. Director 2 adds test competitors locally. Director 2's sync fires and overwrites Director 1's merged registrations. Real paid registrations are silently lost from in-memory state.

---

### 🔴 Finding 2 — Competitors live entirely in RAM (`_inMemoryCompetitors`)

**File:** `client/app.js` line 143: `let _inMemoryCompetitors = [];`

**All read paths:**
- `db.load('competitors')` → returns `_inMemoryCompetitors` directly (line 427)
- Every competitor list render, division auto-assign, bracket generation, check-in view, export — all read from this array

**All write paths:**
- `db.save('competitors', data)` → sets `_inMemoryCompetitors = data` (line 417) — local only
- `saveCompetitorForm()` — adds/edits to `_inMemoryCompetitors`, queues debounced sync
- `syncRegistrationsFromServer()` — merges into `_inMemoryCompetitors`, then triggers sendBeacon path
- `clearAllCompetitors()` — sets to `[]`, no API call
- `clearTestData()` — filters array, no API call

**Server persistence path:** Only via `navigator.sendBeacon('/api/tournaments/:id/competitors/sync', ...)` on `beforeunload` (line 154). If the tab crashes, this does not fire. If the browser is force-quit, this does not fire. If the user navigates away without triggering unload (some mobile browsers), this does not fire.

**Database-first behavior should be:** Every add/edit/delete is an immediate `POST`/`PUT`/`DELETE` API call. The local array is a UI cache populated from the server response, not the source of truth.

**Multi-staff severity:** 🔴 CATASTROPHIC — Two directors have completely independent arrays. Competitors added by Director 1 are invisible to Director 2 until a sync fires. On tournament day with multiple devices at the registration desk, this means check-in lists, bracket seeding, and division assignments will differ between devices.

---

### 🔴 Finding 3 — Test data generated in memory, not in database

**File:** `client/manage.html` lines 659–660 (buttons), `client/app.js` ~line 4800+ (handler)

**Generate Test Data handler:**
1. Creates ~100 competitor objects with fake names, ages, ranks, weights
2. Appends to `_inMemoryCompetitors` via `db.save('competitors', ...)`
3. Calls `autoAssignToDivisions()` to sort them into divisions in memory
4. Queues debounced competitor sync (fires on next unload or after ~1s)
5. The generated data is flagged with `is_test: true` in the local array

**What other devices see:** Nothing. The test data exists only in the generating device's RAM until the sync fires. If the generating director wants to run a multi-device scoreboard test, the mat operators on other devices will see no competitors in their bracket views.

**Clear Test Data handler (`clearTestData()` ~line 4903):**
1. Filters `_inMemoryCompetitors` to remove entries where `is_test === true`
2. Clears generated divisions for non-default events
3. Clears brackets for those events
4. Runs `autoAssignToDivisions()` to rebuild for real competitors
5. **Does NOT call any API endpoint** — the deletion never reaches the server

**Consequence:** If the page is refreshed after clicking "Clear Test Data" but before the next sync, the test competitors reappear (because they were still in the server's last sync). Meanwhile, Director 2 still has the test competitors in their memory because they never received a deletion event.

**Database-first behavior should be:** "Generate Test Data" calls a server endpoint that creates real `competitor_profiles` and `registrations` rows tagged `is_test = true`. "Clear Test Data" calls a server endpoint that deletes all rows with `is_test = true`. All connected devices receive a WebSocket push and re-render the competitor list.

**Multi-staff severity:** 🔴 BREAKS — Cannot meaningfully test a multi-device tournament setup when test data only exists on one device.

---

### 🔴 Finding 4 — Division auto-assign is local-only with race condition

**File:** `client/app.js` — `autoAssignToDivisions()` ~line 3592–3651

**Trigger points:**
- After `saveCompetitorForm()` succeeds (every competitor add/edit)
- After `syncRegistrationsFromServer()` imports competitors
- After test data generation

**What it does:**
1. Reads ALL competitors from `_inMemoryCompetitors`
2. Reads all event templates from local `_msData`
3. Regenerates the complete `generated` divisions object from scratch
4. Writes result to `_msData` via `_msSet(_scopedKey('divisions'), ...)`
5. Queues a 2-second debounced sync to `/api/tournaments/:id/divisions/sync`

**Race condition:**
- Director 1 adds Competitor A → `autoAssignToDivisions()` runs → queues sync (2s delay)
- Director 2 adds Competitor B 1 second later → `autoAssignToDivisions()` runs → queues sync
- Director 1's sync fires: sends divisions containing only Director 1's competitors (Director 2's competitor isn't in Director 1's `_inMemoryCompetitors`)
- Director 2's sync fires: sends divisions with only Director 2's competitors
- Server now has Director 2's version. Director 1's competitor is not in any division.

**Database-first behavior should be:** Division generation is triggered server-side after a competitor is added/edited. Or the client generates divisions and immediately POSTs (no debounce) with a server-side merge that adds the new competitor's division without replacing the whole object.

**Multi-staff severity:** 🔴 BREAKS — Concurrent competitor additions will corrupt division assignments. Competitors fall out of divisions silently.

---

### 🔴 Finding 5 — Officials and staff: full-array overwrite on sync

**File:** `client/app.js` — officials sync ~line 706–724, staff sync ~line 726–744

**Pattern:**
1. Director adds/edits/deletes an official in the UI
2. Change is written to `_msData` via `db.add/update/delete('officials', ...)`
3. `_queueOfficialsSync()` queues a 3-second debounced call to `/api/tournaments/:id/officials/sync`
4. The sync payload is the **entire officials array** from local memory

**Race condition:** Director 1 adds Judge Tanaka. Director 2 adds Judge Yamamoto. Both queue syncs. Director 1's sync fires with `[Tanaka]`. Director 2's sync fires with `[Yamamoto]`. Server now has `[Yamamoto]` only. Judge Tanaka is gone.

**Database-first behavior should be:** Each add/edit/delete is its own API call (`POST /officials`, `PUT /officials/:id`, `DELETE /officials/:id`). No sync, no array overwrite.

**Multi-staff severity:** 🔴 BREAKS — Officials list will silently drop entries whenever two directors edit it simultaneously.

---

### 🔴 Finding 6 — Schedule: last write wins

**File:** `client/app.js` — `saveMatScheduleData()` ~line 12688, `_syncScheduleToServer()` ~line 810

**Pattern:**
- Director assigns divisions to mat slots
- Writes to `_msData` (in-memory `matSchedule` object)
- Queues 1.5-second debounced sync to `/api/tournaments/:id/schedule/sync`
- Sync sends the complete schedule object (full replacement)

**Race condition:** Director 1 assigns Kata to Mat 1. Director 2 assigns Kumite to Mat 2 simultaneously. Both have only their own change in their local schedule object (they haven't seen each other's). Whoever syncs last overwrites the other. One mat assignment disappears.

**Database-first behavior should be:** Each mat slot assignment is a separate API call. The schedule object is fetched from server on page open. WebSocket push when another director changes the schedule.

**Multi-staff severity:** 🔴 BREAKS — Schedule built collaboratively by multiple staff will have silent data loss.

---

### 🟡 Finding 7 — Check-in list has no auto-refresh (writes are fine)

**File:** `client/app.js` — `loadCheckinView()` ~line 13732, `performCheckin()` ~line 13994

**Writes (correct):** Check-in actions call `POST /api/tournaments/:id/checkin` immediately. Server records the check-in. This is already database-first.

**Reads (problem):** The check-in list is fetched once when the director navigates to the check-in view (`loadCheckinView()`). It is not polled or pushed to. If Director A checks in Competitor X, Director B's check-in list still shows X as not checked in until Director B navigates away and back, or manually calls `loadCheckinView()` again.

No "Refresh" button exists — the only way to see another device's check-ins is to navigate away and back.

**Database-first behavior should be:** Check-in list subscribes to a WebSocket room (`tournament:{id}:checkin`) and updates in real-time when any device checks in a competitor.

**Multi-staff severity:** 🟡 CAUSES CONFUSION — Two check-in staff can check in the same competitor twice. Staff don't know the current status without refreshing.

---

### 🟡 Finding 8 — Results sync is manual-only except on bracket completion

**File:** `client/app.js` — `syncResultsToServer()`, `_autoSyncIfBracketComplete()` ~line 270

**Auto-sync:** Fires only when an entire bracket is 100% complete. Sends results to `/api/tournaments/:id/results/sync`.

**Manual sync:** "Sync Results from Scoreboard" button in manage.html line 1754.

**Problem:** During a bracket, partial results (1st round done, 2nd round in progress) don't sync until the bracket is fully complete. If a director wants to display live results mid-bracket on a secondary screen, they must click the manual sync button.

**Database-first behavior should be:** Results are derived from brackets. Since brackets now write to the DB immediately (per the fix already shipped), results can be computed server-side from bracket state. No separate results sync needed.

**Multi-staff severity:** 🟡 CAUSES CONFUSION — Results page on secondary screens shows stale data during active brackets.

---

### 🟢 Finding 9 — BroadcastChannel still used in app.js (display pages, same-device)

**File:** `client/app.js` lines 347–370
**Channel:** `'taikai-display'`

**Tables broadcast:** `scoreboard-state`, `stagingSettings`, `mats`, `matSchedule`, `brackets`, `matScoreboards`, `scoreboardSettings`, `scoreboardConfig`, `competitors`

**Assessment:** BroadcastChannel is used to push state to display pages (scoreboard views, staging display) that are open in other tabs on the same machine. This works correctly for same-device multi-tab setups (e.g., operator laptop has manage tab + scoreboard tab open simultaneously). TV displays on other machines use the WebSocket path added in the recent fix.

**Database-first behavior:** For same-device display tabs, BroadcastChannel is an acceptable performance optimization (avoids a round-trip to the server for display-only updates). It should remain as a secondary channel alongside WebSocket — not the primary cross-device mechanism.

**Multi-staff severity:** 🟢 COSMETIC — Functions correctly for its intended use case.

---

### 🟢 Finding 10 — "Clear All" buttons do not write deletions to server

**File:** `client/app.js`

| Function | Line | Clears | Server call? |
|---|---|---|---|
| `clearAllCompetitors()` | ~5474 | All competitors, divisions, brackets | No |
| `clearAllClubs()` | ~5775 | All clubs | No |
| `clearAllInstructors()` | ~5916 | All instructors | No |
| `clearAllSchedules()` | ~15174 | Schedule | Yes (via saveMatScheduleData) |

**Assessment:** "Clear All" buttons are intended for the director to reset before real data. They're not multi-staff operations — a director wouldn't use "Clear All" while staff are operating. The bigger risk is that the clear happens in memory only and is lost on crash. This is lower priority than the multi-staff writes.

**Multi-staff severity:** 🟢 COSMETIC for March 28 — These buttons would only be used in pre-tournament setup, not during live operations.

---

## Part 2 — Fix Plan

---

### Architecture Principles

1. **Every write is an immediate API call.** No debounced bulk sync for any operation. The server is always authoritative.
2. **Every page load reads from the server.** No cold-start from in-memory state.
3. **WebSocket push for pages where multiple staff operate.** Use the existing `socket.io` rooms pattern. New rooms: `tournament:{id}:competitors`, `tournament:{id}:divisions`, `tournament:{id}:officials`, `tournament:{id}:schedule`, `tournament:{id}:checkin`.
4. **Test data is real data.** Generate via server endpoint, delete via server endpoint, tagged with `is_test = true` for clean removal.
5. **Remove all "Refresh from Server" buttons.** If WebSocket push is working, they're not needed.
6. **Do not touch the bracket per-write API + WebSocket or the per-ring scoreboard WebSocket.** Those are working and tested.

---

### Fix A — Competitors: Immediate API writes + WebSocket push

**Priority:** 🔴 Must fix before March 28

**Server changes:**

Verify or add these endpoints in `server/routes/tournaments.js` (or a new `server/routes/competitors.js`):

- `POST /api/tournaments/:id/competitors` — create one competitor, return created record
- `PUT /api/tournaments/:id/competitors/:competitorId` — update one competitor
- `DELETE /api/tournaments/:id/competitors/:competitorId` — delete one competitor
- `GET /api/tournaments/:id/competitors` — list all (already exists, used by `_loadCompetitorsFromServer`)

After each write, broadcast via WebSocket:
```javascript
io.to(`tournament:${id}:competitors`).emit('competitors:updated', { action: 'add'|'update'|'delete', competitor });
```

**Client changes in `app.js`:**

Replace `saveCompetitorForm()` write path:
- **Before:** `db.save('competitors', updatedArray)` → sendBeacon on unload
- **After:** `await fetch(POST /api/tournaments/:id/competitors, ...)` → on success, update local cache

Replace `deleteCompetitor()`:
- **Before:** `db.delete('competitors', id)` → sendBeacon
- **After:** `await fetch(DELETE /api/tournaments/:id/competitors/:id, ...)`

Add WebSocket subscription on tournament load:
```javascript
_socket.emit('subscribe:competitors', { tournamentId: currentTournamentId });
_socket.on('competitors:updated', ({ action, competitor }) => {
    // Update local _inMemoryCompetitors cache
    // Re-render competitor list
});
```

Remove `navigator.sendBeacon` competitor sync from `beforeunload`. Remove `syncRegistrationsFromServer` button — online registrations will appear via WebSocket push when they're created by the checkout flow (or on page load from the server).

**Keep `_inMemoryCompetitors` as a read cache** — populated from the server on tournament load and kept current via WebSocket push. It should never be the write target.

---

### Fix B — Test Data: Server-side generation and deletion

**Priority:** 🔴 Must fix before March 28 (needed for multi-device testing)

**New server endpoint: `POST /api/tournaments/:id/test-data/generate`**

Logic:
1. Check that the calling user owns this tournament
2. Load the tournament's existing events (to know what divisions exist)
3. Generate 20–30 realistic competitor profiles with varied ages, genders, belt ranks, weights, and dojo names — spread across 3–4 fake dojos
4. Each competitor's profile should naturally match at least one of the tournament's existing events (use the tournament's `age_min/max`, `rank_min/max`, `gender` criteria to generate profiles that will slot into real divisions)
5. Insert into `competitor_profiles` with `is_test = true` column (add this column if not present — `ALTER TABLE competitor_profiles ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE`)
6. Insert corresponding `registrations` rows tagged `is_test = true` with `payment_status = 'waived'`
7. After insert, broadcast via WebSocket to `tournament:{id}:competitors` so all connected devices see the new test competitors immediately
8. Return the list of created competitors

**New server endpoint: `DELETE /api/tournaments/:id/test-data`**

Logic:
1. Check tournament ownership
2. `DELETE FROM registrations WHERE tournament_id = $1 AND is_test = TRUE`
3. Broadcast deletion event via WebSocket
4. Return count of deleted records

**Client changes:**

Replace the "Generate Test Data" button handler:
- Call `POST /api/tournaments/:id/test-data/generate`
- Show a loading spinner
- On success, do nothing — the WebSocket push will update the competitor list on all devices

Replace the "Clear Test Data" button handler:
- Call `DELETE /api/tournaments/:id/test-data`
- On success, do nothing — WebSocket push updates all devices

Remove all local test data generation logic from `app.js`. The server handles it entirely.

---

### Fix C — Division assignment: immediate server write

**Priority:** 🔴 Must fix before March 28

The race condition is in `autoAssignToDivisions()` — it generates divisions locally and debounces the sync. The fix depends on where division assignment is triggered.

**Approach: Trigger division assignment server-side after competitor changes**

After a competitor is added/edited (Fix A), the server — having just written the competitor to the DB — triggers division assignment for that competitor's events. This runs against the full authoritative list in the DB, not a local snapshot.

**Server changes:**

In the competitor write handlers (POST/PUT competitor):
1. After inserting the competitor, call the division assignment service with the tournament's templates
2. Update `tournament.generated_divisions` JSONB
3. Include the updated divisions in the WebSocket broadcast:
```javascript
io.to(`tournament:${id}:competitors`).emit('competitors:updated', {
    action, competitor, divisions: updatedDivisions
});
```

**Client changes:**

When the `competitors:updated` WebSocket event arrives with `divisions` payload, update local division cache. No local re-running of `autoAssignToDivisions()` at all — the server sends the computed result.

Remove `autoAssignToDivisions()` from all client-side trigger points. It can remain as a utility for the director to manually re-run from the UI (calling a server endpoint), but it should not run automatically after every competitor change on the client.

**New endpoint: `POST /api/tournaments/:id/divisions/regenerate`**
- Runs division assignment for all competitors in the tournament
- Updates DB
- Returns updated divisions
- Broadcasts via WebSocket

---

### Fix D — Officials and Staff: Per-record API calls

**Priority:** 🟡 Important but manageable for March 28

**Server changes:**

Add per-record endpoints (check if they exist, add if not):
- `POST /api/tournaments/:id/officials` — add one official
- `PUT /api/tournaments/:id/officials/:id` — update one
- `DELETE /api/tournaments/:id/officials/:id` — delete one
- Same three for staff members

After each write, broadcast:
```javascript
io.to(`tournament:${id}:officials`).emit('officials:updated', { action, official });
```

**Client changes:**

Replace `saveOfficial()` write path:
- **Before:** `db.add('officials', data)` → debounced array sync
- **After:** `await fetch(POST /api/tournaments/:id/officials, ...)`

Remove `_queueOfficialsSync()` and `_queueStaffSync()` debounce patterns. Remove `officials/sync` and `staff/sync` bulk endpoints (or keep them read-only for initial hydration).

---

### Fix E — Schedule: Per-slot API calls

**Priority:** 🟡 Important for multi-staff scheduling sessions

**Server changes:**

Instead of a full schedule replacement, add:
- `PUT /api/tournaments/:id/schedule/slot` — update one mat/time slot assignment
- `DELETE /api/tournaments/:id/schedule/slot` — clear one slot
- `GET /api/tournaments/:id/schedule` — fetch full schedule (already exists)

After each write, broadcast:
```javascript
io.to(`tournament:${id}:schedule`).emit('schedule:updated', { mat, time, division });
```

**Client changes:**

When the director assigns a division to a mat slot, call `PUT /api/tournaments/:id/schedule/slot` immediately. Remove debounced `_syncScheduleToServer`. Other devices receive the slot update via WebSocket and re-render only that slot.

---

### Fix F — Check-in: WebSocket push

**Priority:** 🟡 Straightforward addition

**Server changes:**

In the `POST /api/tournaments/:id/checkin` handler, after recording the check-in, broadcast:
```javascript
io.to(`tournament:${id}:checkin`).emit('checkin:updated', { registrationId, checkedInAt });
```

**Client changes:**

Subscribe to checkin room on tournament load:
```javascript
_socket.emit('subscribe:checkin', { tournamentId: currentTournamentId });
_socket.on('checkin:updated', ({ registrationId, checkedInAt }) => {
    // Find competitor in _checkinData by registrationId
    // Update their status in the rendered list without re-fetching
});
```

No "Refresh" button needed. Real-time across all check-in devices.

---

### Fix G — Remove "Refresh from Server" button

**File:** `client/manage.html` line 658

Once Fix A is implemented (competitors push via WebSocket), this button is redundant. Remove it. Online registrations will appear automatically on all connected devices when they're created by the checkout flow.

---

### Recommended Build Order

| Step | Fix | Estimated effort | Blocks March 28? |
|---|---|---|---|
| 1 | Fix B — Test data server-side generate/delete | 1 day | Yes — needed for pre-event testing |
| 2 | Fix A — Competitor per-record API + WebSocket | 1–2 days | Yes — core multi-staff data |
| 3 | Fix C — Division assignment server-side | 1 day | Yes — race condition corrupts brackets |
| 4 | Fix G — Remove "Refresh from Server" button | 30 min | After Fix A |
| 5 | Fix F — Check-in WebSocket push | 2 hours | No — workaround: one check-in device |
| 6 | Fix D — Officials per-record API | 2–3 hours | No — officials set up before event |
| 7 | Fix E — Schedule per-slot API | 3–4 hours | No — schedule set up before event |

Steps 1–4 are the March 28 critical path. Steps 5–7 can follow after the tournament if time is short.

---

### What Will NOT Change

- `PUT /api/tournaments/:id/brackets/:bracketId` — already per-record, already WebSocket-push ✓
- `GET /api/tournaments/:id/brackets/:bracketId` — already polling correctly ✓
- Per-ring scoreboard WebSocket — already working ✓
- `POST /api/tournaments/:id/checkin` — already server-first ✓
- BroadcastChannel in `app.js` — acceptable for same-device display tabs, kept as secondary path ✓
- All account, dojo, registration, and payment flows — single-user, no multi-staff concern ✓
