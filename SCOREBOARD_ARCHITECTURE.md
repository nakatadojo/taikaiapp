# Scoreboard Architecture Analysis

## Problem Summary
The TV display shows kumite state ("AKA", "AO") instead of kata-flags state with competitor names. Multiple functions write to `localStorage['scoreboard-state']` causing conflicts.

## State Writers (5 total)

### 1. `updateKataFlagsTVDisplay()` - Line 6340
**Purpose**: Kata-flags operator TV sync
**Called by**:
- `openKataFlagsHeadToHeadOperator()` (line 6245) - when operator opens
- `kataFlagsVote()` (line 6270) - when judge votes

**State structure**:
```javascript
{
    scoreboardType: 'kata-flags',
    matName: `MAT ${kataFlagsMatId}`,
    divisionName: kataFlagsDivisionName,
    matchInfo: `Round X - Match Y`,
    redName: "Blake Williams",  // Full name
    blueName: "Cameron Williams", // Full name
    redFlags: 0,
    blueFlags: 0,
    corner1Name: "Red" / "Shiro",
    corner2Name: "Blue" / "White",
    corner1Color: "#ff3b30",
    corner2Color: "#ffffff",
    judges: 5
}
```

### 2. `updateKataFlagsTVDisplayWinner()` - Line 6495
**Purpose**: Show winner overlay for kata-flags
**Called by**:
- `kataFlagsDeclareWinner()` (line 6477)

**State structure**: Same as #1 + `winner: "BLAKE WILLIAMS"`

### 3. `updateOperatorTVDisplay()` - Line 7111 ⚠️ **CONFLICT SOURCE**
**Purpose**: Kumite operator TV sync
**Called by**:
- `selectOperatorCompetitor()` (line 6529) - when competitor selected
- `operatorAddScore()` (line 6540) - when score changes
- `operatorAddPenalty()` (line 6551) - when penalty added
- `operatorStartTimer()` (line 6564) - **EVERY SECOND while timer runs** ⚠️
- `operatorResetTimer()` (line 6583) - when timer reset
- `operatorResetMatch()` (line 6600) - when match reset
- `openTVDisplayFromOperator()` (line 7046) - when TV display opened

**State structure**:
```javascript
{
    matName: "Tatami 1",
    divisionName: "U5 | Male | Intermediate",
    matchInfo: "Round 2 - Match 3",
    corner1Name: "AKA",  // From scoreboardSettings
    corner2Name: "AO",   // From scoreboardSettings
    corner1Color: "#ff453a",
    corner2Color: "#0a84ff",
    redName: operatorRedCompetitor ? "FULL NAME" : corner1Name,  // Falls back to "AKA"!
    blueName: operatorBlueCompetitor ? "FULL NAME" : corner2Name, // Falls back to "AO"!
    redScore: 0,
    bluePenalties: 0,
    timer: "2:00",
    scoringType: "wkf"
}
```

**KEY ISSUE**: Uses `localStorage['scoreboardSettings']` instead of scoreboard config!

### 4. `updateTVDisplay()` - Line 8034
**Purpose**: Standalone scoreboard (non-operator)
**Called by**:
- `selectCompetitor()` (line 7953)
- `resetScoreboard()` (line 7989)
- `openTVDisplay()` (line 7996)
- `addScore()` (line 8034)
- `addPenalty()` (line 8059)
- `updateTimer()` (line 8103)
- `declareWinner()` (line 8142)

**State structure**: Similar to kumite operator but uses global `redCompetitor`, `blueCompetitor`

### 5. `declareWinner()` - Line 8139
**Purpose**: Standalone scoreboard winner
**Called by**: User clicking winner buttons in standalone scoreboard

## Root Cause Analysis

### Why TV Display Shows "AKA" and "AO"

1. **Kata-flags operator opens** → calls `updateKataFlagsTVDisplay()` → writes correct state
2. **BUT kumite timer is still running** from previous match!
3. **`operatorStartTimer()` calls `updateOperatorTVDisplay()` every second** (line 6564)
4. **`operatorRedCompetitor` is null** (we cleared it in kata-flags)
5. **Falls back to `corner1Name`** which comes from `localStorage['scoreboardSettings']`
6. **`scoreboardSettings.corner1Name` = "AKA"** (from previous kumite scoreboard setup)
7. **Result**: kumite state overwrites kata-flags state every second!

### Additional Issues

1. **`updateOperatorTVDisplay()` uses wrong config source**:
   - Should use scoreboard config passed to operator
   - Currently uses `localStorage['scoreboardSettings']` (legacy global settings)

2. **No scoreboardType in kumite state**:
   - Kumite operator doesn't set `scoreboardType: 'kumite'`
   - TV display defaults to 'kumite' when missing

3. **Timer runs independently**:
   - `operatorTimerInterval` keeps running even when modal closed
   - We clear it in kata-flags, but it may have already queued updates

4. **Multiple scoreboards can be "active"**:
   - No mechanism to deactivate one when another opens
   - All write to same localStorage key

## Global Variables Used

### Kumite Operator Globals
```javascript
operatorRedCompetitor
operatorBlueCompetitor
operatorRedScore
operatorBlueScore
operatorRedPenalties
operatorBluePenalties
operatorTimeRemaining
operatorTimerInterval  // setInterval reference
currentOperatorMat
currentOperatorDivision
currentOperatorEventId
```

### Kata-Flags Operator Globals
```javascript
kataFlagsJudgeVotes
kataFlagsCurrentMatch
kataFlagsScoreboardConfig
kataFlagsMatId
kataFlagsDivisionName
kataFlagsEventId
```

### Shared Globals
```javascript
window.currentMatchId
window.currentBracketId
```

## Solution Requirements

1. **Stop kumite updates when kata-flags opens** ✓ Partially done
   - Clear `operatorTimerInterval` ✓
   - Clear kumite competitor globals ✓
   - **Missing**: Need to clear `currentOperatorMat` to prevent other kumite calls

2. **Add scoreboardType to kumite state**
   - `updateOperatorTVDisplay()` should set `scoreboardType: 'kumite'`

3. **Use consistent config source**
   - Kumite operator receives `scoreboardConfig` parameter
   - Should use it instead of `localStorage['scoreboardSettings']`

4. **Prevent multiple active scoreboards**
   - Set active scoreboard type global flag
   - Guard all update functions to only write if their type is active

5. **TV display should ignore stale state**
   - Add timestamp to state
   - Ignore updates older than X seconds
