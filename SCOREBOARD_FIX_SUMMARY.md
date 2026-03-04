# Scoreboard State Conflict Fix - Summary

## Problem
TV display showed kumite state ("AKA", "AO") instead of kata-flags competitor names when opening kata-flags operator.

## Root Cause
Multiple scoreboard operators (kumite, kata-flags, standalone) were all writing to the same `localStorage['scoreboard-state']` key without coordination:

1. Kata-flags operator would write correct state
2. Kumite timer (from previous match) kept running in background
3. `operatorStartTimer()` called `updateOperatorTVDisplay()` **every second**
4. Kumite update overwrote kata-flags state repeatedly
5. TV display received kumite state instead of kata-flags

## Solution Implemented

### 1. Active Scoreboard Type Tracker
Added global flag to track which scoreboard is currently active:

```javascript
let activeScoreboardType = null; // 'kumite', 'kata-flags', 'kata-points', 'standalone', null
```

### 2. Guarded All State Writers
Each update function now checks if it's the active type before writing:

**Kumite Operator** (`updateOperatorTVDisplay`):
```javascript
if (activeScoreboardType !== 'kumite') {
    console.log('Kumite not active, skipping update');
    return;
}
```

**Kata-Flags Operator** (`updateKataFlagsTVDisplay`):
```javascript
if (activeScoreboardType !== 'kata-flags') {
    console.log('Kata-flags not active, skipping update');
    return;
}
```

**Standalone Scoreboard** (`updateTVDisplay`):
```javascript
if (activeScoreboardType !== null && activeScoreboardType !== 'standalone') {
    console.log('Standalone not active, skipping update');
    return;
}
```

### 3. Set Active Type on Open
Each operator sets itself as active when opened:

**Kumite** (`openOperatorScoreboard`):
```javascript
activeScoreboardType = 'kumite';
```

**Kata-Flags** (`openKataFlagsHeadToHeadOperator`):
```javascript
activeScoreboardType = 'kata-flags';  // Set FIRST before clearing kumite state
```

### 4. Clear Active Type on Close
When operator closes, active type is cleared:

```javascript
function closeOperatorScoreboard() {
    operatorPauseTimer();
    activeScoreboardType = null;
    // ... rest of cleanup
}
```

### 5. Added scoreboardType to Kumite State
Kumite operator now explicitly sets its type in the state object:

```javascript
const state = {
    scoreboardType: 'kumite',  // Added
    matName: matName,
    // ... rest of state
};
```

### 6. Enhanced Cleanup in Kata-Flags
When kata-flags opens, it thoroughly cleans up kumite state:

```javascript
// Set active type FIRST
activeScoreboardType = 'kata-flags';

// Stop kumite timer
if (operatorTimerInterval) {
    clearInterval(operatorTimerInterval);
    operatorTimerInterval = null;
}

// Clear kumite state
operatorRedCompetitor = null;
operatorBlueCompetitor = null;
operatorRedScore = 0;
operatorBlueScore = 0;
operatorRedPenalties = 0;
operatorBluePenalties = 0;
currentOperatorMat = null;  // Prevent kumite from thinking it's active
```

## Files Modified

### app.js
- **Line 5820**: Added `activeScoreboardType` global variable
- **Line 6110**: Set `activeScoreboardType = 'kata-flags'` when kata-flags opens
- **Line 6125**: Clear `currentOperatorMat` to fully disable kumite
- **Line 6287**: Added guard to `updateKataFlagsTVDisplay()`
- **Line 6098**: Set `activeScoreboardType = 'kumite'` when kumite opens
- **Line 7052**: Added guard to `updateOperatorTVDisplay()`
- **Line 7093**: Added `scoreboardType: 'kumite'` to kumite state
- **Line 7040**: Clear `activeScoreboardType` when operator closes
- **Line 8047**: Added guard to standalone `updateTVDisplay()`
- **Line 8049**: Added `scoreboardType: 'kumite'` to standalone state

## Benefits

1. **Prevents State Conflicts**: Only one scoreboard can write state at a time
2. **Clean Transitions**: Opening new scoreboard deactivates previous one
3. **No Timing Issues**: Even if kumite timer is still running, it can't write
4. **Type Safety**: TV display can trust scoreboardType field
5. **Debuggable**: Console logs show which updates are being skipped

## Testing Checklist

- [ ] Open kata-flags operator → TV shows competitor names (not "AKA"/"AO")
- [ ] Vote with judges → TV updates flag counts correctly
- [ ] Declare winner → TV shows winner overlay
- [ ] Next match → TV updates with new competitors
- [ ] Open kumite operator → TV switches to kumite display
- [ ] Close operator → TV state preserved
- [ ] Switch between kata-flags and kumite → no conflicts

## Future Improvements

Consider these enhancements:

1. **State timestamp**: Add timestamp to detect stale state
2. **Event-based updates**: Use custom events instead of localStorage polling
3. **Operator registry**: Track all active operators/scoreboards
4. **Unified state manager**: Single module to manage all scoreboard state
