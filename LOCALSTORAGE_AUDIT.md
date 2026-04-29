# localStorage / Multi-Staff Tournament Readiness Audit

> Read-only investigation. No code changed.
> Tournament date: March 28 — 10 days away.
> Date of audit: 2026-03-18

---

## Executive Summary

**The good news:** The system does NOT use `localStorage` as a data store. All tournament operations data lives in `_msData` — a plain in-memory JavaScript object that is cleared on page reload. There is no stale localStorage data that persists between sessions or bleeds across tournaments.

**The real risk:** Because data lives in-memory per device and syncs to the server via debounced background calls, two devices operating simultaneously can **race and overwrite each other's changes**. The severity depends entirely on which device touches which data.

**The two issues that will break a multi-device tournament on March 28:**

1. **Bracket sync clobbers concurrent results** — if two mat operators are scoring at the same time, one will silently erase the other's match result
2. **Scoreboard displays on separate machines are frozen** — the display pages never poll the server; they only receive updates via BroadcastChannel, which is single-device-only

Everything else is manageable with operational workarounds.

---

## Storage Architecture (What's Actually Happening)

```
┌──────────────────────────────────────────────────────────────┐
│                      client/app.js                           │
│                                                              │
│  const _msData = Object.create(null);  // line 339           │
│                                                              │
│  _msSet(key, value) → _msData[key] = value                   │
│  _msGet(key)        → _msData[key]                           │
│  _msRemove(key)     → delete _msData[key]                    │
│                                                              │
│  All keys are tournament-scoped:                             │
│  _scopedKey('brackets') → "t_{tournamentId}_brackets"        │
└──────────────────────────────────────────────────────────────┘
         │ writes via debounced sync functions
         ▼
┌──────────────────────────────────────────────────────────────┐
│                     PostgreSQL (server)                      │
│  tournament_brackets, tournaments.scoreboard_state, etc.     │
└──────────────────────────────────────────────────────────────┘
```

`_msData` is cleared on tournament switch (line 1401–1406) and on page reload. It is **not** `localStorage`. On every fresh page load, data is re-fetched from the server.

---

## 🔴 CRITICAL — Blocks March 28 Multi-Staff Operation

---

### 🔴 CRITICAL #1 — Bracket sync overwrites concurrent match results

**File:** `client/app.js` — `_syncBracketsToServer()` lines 829–845
**Server:** `server/db/queries/brackets.js` — `bulkUpsert()` lines 42–56
**Server controller:** `server/controllers/bracketsController.js` lines 13–30

**What's stored:**
All tournament brackets — every division, every match, every score, every advancement. Stored in `_msData` under `t_{tournamentId}_brackets` as one large object containing all brackets.

**How sync works:**
When an operator records a match result:
1. The result is written into the in-memory bracket object
2. `_debouncedSync('brackets', _syncBracketsToServer, 2000)` queues a sync (line 262)
3. After 2 seconds of inactivity, `_syncBracketsToServer()` sends **the entire bracket object for the tournament** to `POST /api/tournaments/:id/brackets/sync`
4. The server calls `bulkUpsert()` which runs a per-bracket `INSERT ... ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data` — last write wins, no timestamp check

**What breaks with multiple staff:**

Device A (Mat 1 operator) and Device B (Mat 2 operator) both loaded the full bracket set when they opened the page. Each has a copy of **all** brackets in their `_msData`.

```
T=0:00  Both devices load from server. All brackets are pending.
T=0:30  Mat 1 operator (Device A) completes Match 1 in Bracket A.
        Device A writes result to _msData. Queues sync.
T=0:32  Device A syncs. Server now has Bracket A = completed.
T=0:45  Mat 2 operator (Device B) completes Match 1 in Bracket B.
        Device B writes result to _msData. Queues sync.
T=0:47  Device B syncs ALL brackets — including Bracket A.
        Device B's copy of Bracket A was loaded at T=0:00 (still pending).
        Server UPSERT replaces Bracket A.data with Device B's stale version.
        Match 1 in Bracket A is now ERASED. ← silent data loss
```

Device B doesn't know it just erased Device A's result. There is no conflict detection, no timestamp comparison, no error message. The sync succeeds silently.

**Multi-staff impact:** Any two mat operators working simultaneously on the same tournament will race on bracket syncs. The longer the tournament runs without Device B refreshing, the more stale Device B's copy of Device A's brackets becomes, and the more likely a sync will clobber results.

**Fix difficulty:** Medium — 1–2 days of work. The server already does per-bracket upserts correctly. The problem is the client sending ALL brackets instead of only the ONE that changed. The fix is to change `_syncBracketsToServer` to accept a bracket ID and only send that bracket. Call sites that trigger the sync after match result entry need to pass the affected bracket ID.

**Blocks March 28:** **YES** — if any two mat operators are running simultaneously on different devices, this will cause silent data loss.

---

### 🔴 CRITICAL #2 — Scoreboard/display pages receive zero updates on a separate machine

**Files:**
- `client/tv-display.html` lines 94–108
- `client/mat-display.html` lines 138–159, 486
- `server/routes/scoreboardState.js` lines 9–13 (the unused server endpoint)

**What's stored:**
Live kumite match scores (per-point updates), current match state, competitor assignment to mats. Stored in `_msData` under `t_{tournamentId}_scoreboard-state`. The operator syncs to the server via `PUT /api/tournaments/:id/scoreboard-state` (debounced ~500ms). The server stores the state in `tournaments.scoreboard_state` JSONB.

**How display updates work:**
```javascript
// tv-display.html lines 94–108 and mat-display.html lines 138–159
const _bc = new BroadcastChannel('taikai-display');
_bc.onmessage = (e) => { /* update display */ };

// mat-display.html line 486
setInterval(updateDisplay, 100);  // polls _local cache_, not server
```

The 100ms interval in `mat-display.html` polls a **local cache** that was last updated by BroadcastChannel. It does NOT call the server. The `GET /api/tournaments/:id/scoreboard-state` server endpoint exists and returns the current state, but **no display page ever calls it**.

**BroadcastChannel only works within the same browser on the same device.** It is a browser API for cross-tab communication, not cross-device.

**What breaks with multiple staff:**

```
Operator device (laptop at scoring table):
  → Enters kumite points
  → Writes to _msData scoreboard-state
  → BroadcastChannel broadcasts to other tabs on THIS laptop
  → Syncs to server via PUT (500ms debounce)

Display device (projector laptop / TV computer / tablet):
  → Listening to BroadcastChannel — receives NOTHING from operator device
  → setInterval polls local cache — cache never updated (no BC messages)
  → GET /api/scoreboard-state — NEVER CALLED
  → Display is FROZEN at whatever state it had when the page last loaded
```

If the display laptop is the **same machine** as the operator laptop (running in a second browser tab), everything works. If it's a **different physical device**, the display shows nothing live.

**Multi-staff impact:** Any tournament setup where the scoreboard display is on a separate machine (projector, TV, judge tablet) will show a frozen, stale scoreboard. Judges and coaches watching the display won't see live scores.

**Fix difficulty:** Easy — 1 day of work. Add a `setInterval` to both `tv-display.html` and `mat-display.html` that polls `GET /api/tournaments/:id/scoreboard-state` every 500–1000ms and updates the display. The server endpoint already exists and returns the correct data. The operator already writes to it. Only the reading side is missing.

**Blocks March 28:** **YES** — if display screens are on any device other than the operator's machine, they will not show live scores.

---

## 🟡 PROBLEM — Causes Confusion or Data Conflicts

---

### 🟡 PROBLEM #1 — Manual division assignments never sync to server

**File:** `client/app.js` — `_syncDivisionsToServer()` lines 881–906
**Server:** `server/db/queries/divisions.js` line 14

**What's stored:**
Division assignments per event — which competitor goes into which division (e.g., "Kids Male Beginner"). The division object has two parts: `generated` (auto-assigned by the system) and `manual` (director overrides). Only `generated` is included in the sync payload (line 886: `if (allDivisions[eventId]?.generated)`). Manual assignments are silently excluded.

**What breaks:**
- Director manually moves a competitor to a different division on Device A
- Page refreshes, or Director switches to Device B
- The manual assignment is gone — only the auto-generated assignment is restored from the server
- Also: division sync is full-replace (`UPDATE tournaments SET generated_divisions = $2`) — if two devices both run division generation simultaneously, last sync wins

**Multi-staff impact:** Any manual division corrections the director makes will be lost if the page is closed or a second device syncs. On tournament day, last-minute division adjustments are common.

**Fix difficulty:** Easy — include the `manual` key in the sync payload alongside `generated`. One-line change in the sync function. Server side already accepts and stores whatever is sent.

**Blocks March 28:** Not a hard blocker, but a significant operational risk. **Workaround: avoid manual division overrides.** Only use auto-generated divisions.

---

### 🟡 PROBLEM #2 — Check-in status has no auto-refresh (other devices are blind until manual reload)

**File:** `client/app.js` — `loadCheckinView()` lines 13610–13657

**What's stored:**
Which competitors have been physically checked in at the tournament venue. Check-in is NOT stored in `_msData` — it is written directly to the server via `POST /api/tournaments/:id/checkin` and read on demand. This is the correct architecture. The problem is the reading side.

**How check-in data is loaded:**
Three separate `fetch()` calls inside `loadCheckinView()` — called only when the user navigates to the check-in section. There is no `setInterval`. No automatic polling.

**What breaks with multiple staff:**
- Staff A checks in competitor #47 on Tablet A
- Tablet B's check-in view shows competitor #47 as NOT checked in (stale)
- Staff B tries to check in #47 again → duplicate check-in attempt

**Multi-staff impact:** Multiple check-in staff on different devices will have stale views of the check-in list. Competitors could be checked in twice. Staff will not know who else has already been processed.

**Fix difficulty:** Easy — add a `setInterval` (e.g., every 15–30 seconds) that re-fetches check-in data, or add a visible "Last updated X seconds ago" indicator with a manual refresh button.

**Blocks March 28:** Not a hard blocker if only one device runs check-in. **Workaround: designate one device as the check-in station.**

---

### 🟡 PROBLEM #3 — No data push to other devices when changes occur

**What's stored:** Competitors, clubs, divisions, teams, schedule — any data a director edits during the tournament.

**The pattern:** Every edit is written to `_msData` → debounced sync to server. But there is no mechanism to push those changes TO other devices. Other devices only receive new data when they reload the page or manually trigger a server load.

**What breaks:** If the director adds a walk-in competitor on the director's laptop, the mat operator's device won't show that competitor in the bracket builder until the operator refreshes their page. This applies to all data types.

**Multi-staff impact:** Stale data on non-primary devices throughout the event. Any "Refresh from Server" button relies on the operator knowing to press it.

**Fix difficulty:** Hard (proper fix) — requires server-sent events or WebSocket push. Easy workaround: add a prominent "Refresh Data from Server" button that operators can press, and add periodic polling (e.g., every 60 seconds) that pulls latest brackets/competitors from the server.

**Blocks March 28:** No. **Workaround: designate one device as the "source of truth" for data management. Operators on other devices should refresh before starting each match.**

---

### 🟡 PROBLEM #4 — Competitor data lost if operator tab crashes (not just closed)

**File:** `client/app.js` lines 143–156

**What's stored:** `_inMemoryCompetitors` — the full competitor list, loaded from server on init and updated as changes are made.

**How sync works:** `beforeunload` fires `navigator.sendBeacon()` to `POST /api/tournaments/:id/competitors/sync`. This works for normal tab close, navigation, and refresh. It does NOT fire if the browser crashes, the computer loses power, or the OS kills the process.

**Additionally:** `_competitorsSyncTimer` must be set for the beacon to fire (line 150). If no competitor edits were made, the beacon doesn't fire — which is fine since there's nothing to sync. The risk is only when a director has made unsaved changes.

**Multi-staff impact:** Low. Competitors are loaded fresh from server on every page load. The risk is only the ~1 second window of unsaved changes if the tab crashes at the exact moment of an edit.

**Fix difficulty:** Easy — the 1-second debounce on competitor sync (`_syncCompetitorsToServer`) means changes are saved quickly. The crash window is small.

**Blocks March 28:** No.

---

## 🟢 ACCEPTABLE — Per-Device, No Sharing Needed

---

### 🟢 Scoreboard operator state (sides swapped, active match)

**Key:** `t_{tournamentId}_operatorSidesSwapped`
**What:** Whether the operator has manually swapped red/blue corners on their screen. Per-operator preference.
**Multi-staff:** Each mat operator has their own physical perspective. This is intentionally per-device.

---

### 🟢 Scoreboard configuration / display settings

**Keys:** `t_{tournamentId}_scoreboardConfig`, `t_{tournamentId}_scoreboardSettings`, `t_{tournamentId}_scoreboardConfigs`
**What:** Visual settings for scoreboard display (font size, colors, layout, timer settings).
**Multi-staff:** These sync to the server (`PUT /api/tournaments/:id/scoreboard-state` path) so can be shared. But in practice, each mat display has its own setup. Per-device is appropriate.

---

### 🟢 Certificate templates and configs

**Keys:** `t_{tournamentId}_certificateTemplate`, `t_{tournamentId}_certificateConfig`
**What:** Award certificate design and settings. Not a live tournament operation.
**Multi-staff:** Acceptable. Director edits on one device; certificates generated after the event.

---

### 🟢 Public site configuration

**Key:** `t_{tournamentId}_publicSiteConfig`
**What:** Public registration page branding (logo, colors, description). Already fixed to use server as source of truth (per recent commit).
**Multi-staff:** Acceptable. Rarely edited during live tournament.

---

### 🟢 Staging display settings

**Key:** `t_{tournamentId}_stagingSettings`
**What:** Configuration for the staging queue display. Syncs to server via `PUT /api/tournaments/:id/staging-settings`.
**Multi-staff:** Acceptable. One device manages staging.

---

### 🟢 Judge vote log (analytics)

**Key:** `t_{tournamentId}_judgeVoteLog`
**What:** Running log of judge scoring analytics. Cleared after sync.
**Multi-staff:** Acceptable. Analytics are aggregated; individual judge data is per-station.

---

### 🟢 Score edit log

**Key:** `t_{tournamentId}_scoreEditLog`
**What:** Audit trail of score corrections.
**Multi-staff:** Acceptable. Synced with bracket data.

---

## All Sync Endpoints (Complete List)

| Data | Client Function | Endpoint | Method | Debounce | Direction |
|---|---|---|---|---|---|
| Brackets | `_syncBracketsToServer()` app.js:829 | `/api/tournaments/:id/brackets/sync` | POST | 2000ms | Up only |
| Divisions | `_syncDivisionsToServer()` app.js:881 | `/api/tournaments/:id/divisions/sync` | POST | 2000ms | Up only |
| Teams | `_syncTeamsToServer()` app.js:926 | `/api/tournaments/:id/teams/sync` | POST | 2000ms | Up only |
| Schedule | `_syncScheduleToServer()` app.js:810 | `/api/tournaments/:id/schedule/sync` | POST | 1500ms | Up only |
| Competitors | `_syncCompetitorsToServer()` app.js:572 | `/api/tournaments/:id/competitors/sync` | POST | 1000ms | Up only |
| Clubs | (debounced) | `/api/tournaments/:id/clubs/sync` | POST | 1000ms | Up only |
| Scoreboard state | (debounced) | `/api/tournaments/:id/scoreboard-state` | PUT | ~500ms | Up only |
| Staging settings | `_syncStagingSettingsToServer()` | `/api/tournaments/:id/staging-settings` | PUT | — | Up only |
| Judge votes | `_syncJudgeVotesToServer()` | `/api/tournaments/:id/judge-votes/sync` | POST | — | Up only |
| Results | `syncResultsToServer()` | `/api/tournaments/:id/results/sync` | POST | 1000ms (auto on bracket complete) | Up only |
| Public site config | `_syncPublicSiteConfigToServer()` | `/api/tournaments/:id` | PUT | — | Up only |

**Observation:** Every single sync is unidirectional (client → server). There is no server push to other devices. All device-to-device coordination goes through the server as an intermediary, but the receiving device only gets new data if it proactively requests it.

---

## March 28 Action Plan

Only the 🔴 CRITICAL items. Ranked by impact.

---

### Fix #1 — Bracket sync: send only the changed bracket (not all brackets)

**Why it's #1:** This is the only issue that causes **silent, permanent data loss** in normal tournament operation. Two mat operators working simultaneously will erase each other's match results. If you run more than one mat, this WILL happen.

**The fix:** In `_syncBracketsToServer()` (app.js line 829), change the function to accept a specific `bracketId` parameter. Instead of sending `{ brackets: allBrackets }`, send only `{ brackets: { [bracketId]: oneBracket } }`. The server's `bulkUpsert` already handles per-bracket upserts correctly — no server change needed. The fix is entirely on the client.

Every call site that triggers a bracket sync after a match result (primarily `operatorDeclareWinner()` at line 17932) needs to pass the bracket ID of the bracket that was just modified.

**Work estimate:** 1–2 days. Risk is medium — the bracket sync function is called from many places. Each call site needs to be updated. The alternative quick fix (lower risk) is to change only the `operatorDeclareWinner()` path to send a single-bracket sync, and leave the "save all" sync for non-live operations (bracket generation, initial setup). That version is a 4-hour fix.

**What to test:** Two devices both open the same tournament. Device A scores a match. Device B scores a different match 3 seconds later. Verify Device A's result is still present on the server.

---

### Fix #2 — Add server polling to display pages

**Why it's #2:** Without this, any display screen on a separate machine (projector, judge monitor, TV) will show a frozen scoreboard. The operator's score inputs vanish into the void from the audience's perspective.

**The fix:** In both `client/tv-display.html` (around line 94) and `client/mat-display.html` (around line 486), add:

```javascript
// Poll server for scoreboard state every 750ms
setInterval(async () => {
    const tid = getTournamentId(); // however the page gets the tournament ID
    const res = await fetch(`/api/tournaments/${tid}/scoreboard-state`, { credentials: 'include' });
    if (res.ok) {
        const { state } = await res.json();
        // update display with state — same code path as BroadcastChannel handler
    }
}, 750);
```

The server endpoint already exists (`GET /api/tournaments/:id/scoreboard-state`), already stores the right data (operator syncs to it via PUT on every score update), and already returns the correct format. Only the reading side is missing from the display pages.

**Work estimate:** 2–4 hours. Very low risk — additive change to display pages only. The BroadcastChannel path still works for same-device tab communication; polling adds cross-device support alongside it.

**What to test:** Open the operator page on Laptop A. Open the display page on Laptop B (or phone). Enter kumite points on Laptop A. Verify Laptop B display updates within 1 second.

---

### Operational workarounds if fixes aren't deployed in time

If either fix doesn't make it in before March 28:

**For Fix #1 (Bracket clobbering):**
- Assign one mat per operator and instruct operators to **never** score on another mat's division
- Before each match, the operator clicks "Refresh from Server" (if this button exists) or reloads the page
- Keep a paper backup of all match results as they happen
- Have one person designated as the "bracket reconciler" who checks server state after each round

**For Fix #2 (Display freezing):**
- Run the scoreboard display in a tab on the **same machine** as the operator (laptop, then mirror to projector via HDMI)
- If separate display machines are required, reload the display page after each match result is entered by the operator

---

### What does NOT need fixing before March 28

- Check-in: **Use one device as the dedicated check-in station.** Check-in staff don't need to see each other's real-time activity.
- Manual divisions: **Don't use them.** Generate all divisions automatically. This eliminates the sync gap entirely.
- Data refresh across devices: **Operators should press Refresh before starting each round**, not between individual matches. Round-to-round refresh is sufficient.
- `beforeunload` crash risk: **Don't close the browser during active scoring.** The 1-second competitor sync window is negligible.
