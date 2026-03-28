# Re-run Unsold Auction + Fantasy Points Scoring

## Context

Two features to build on top of the existing IPL auction POC:

1. **Re-run auction for unsold players** — After all players are auctioned and the status goes to `'completed'`, let the host optionally re-queue every unsold player (those with `isSold === false`) for another bidding round. If a player still gets no bids, the host can mark them unsold again. Once done, the host can permanently close the auction.

2. **Fantasy points scoring** — After the auction, a host can import a cricket scorecard (sample hardcoded today, ESPN Cricinfo placeholder for later). Each player's batting/bowling/fielding performance is translated into fantasy points. Teams' total points are derived from their acquired players' scores and displayed on a leaderboard.

---

## Current state (relevant facts)

- `lib/store.ts`: `advanceToNextPlayer()` — when queue exhausts, sets `auctionState.status = 'completed'`, `tournament.status = 'completed'`, AND clears `activeTournamentCode` for every user. This cleanup must move to a separate `closeAuction()` call so re-runs remain possible.
- `TournamentRoom.tsx` polling stops when `auctionState.status === 'completed'`. This must continue until the tournament is **closed** to pick up re-run state changes.
- `serializeTournament()` spreads `...tournament`, so any new field added to `Tournament` (e.g. `closed`, `matchResults`) is automatically returned by `GET /api/tournaments/[code]`.
- All 20 seeded players are in `lib/seed.ts` (Virat Kohli, Rohit Sharma, Jasprit Bumrah … Faf du Plessis).

---

## Feature 1: Re-run Unsold Auction

### Data model change — `lib/types.ts`
- Add `closed?: boolean` to `Tournament` interface (default: undefined = false).
- No changes to `TournamentPlayer`, `AuctionState`, or `AuctionStatus` — unsold players are already identifiable as those with `isSold === false`.

### Store changes — `lib/store.ts`

**`advanceToNextPlayer()` (existing, lines 328–372)**
- Remove the `activeTournamentCode` clearing block (lines 344–348). Move it to `closeAuction`.

**New `rerunUnsoldAuction(code, userId)`**
```
- Auth: must be host (tournament.createdBy === userId)
- Guard: tournament.auctionState.status must be 'completed'
- Guard: tournament.closed must not be true
- Find unsold player IDs: filter tournament.players.values() where !p.isSold
- Throw if none: "No unsold players to re-run"
- Reset auctionState:
    playerQueue = unsoldPlayerIds
    currentPlayerIndex = 0
    currentPlayer = first unsold player
    currentHighestBid = null
    bidHistory = []
    status = 'player_up'
    auctionLog.push("Re-run started for N unsold players")
- Set tournament.status = 'active'
- Broadcast 'auction_update'
```

**New `closeAuction(code, userId)`**
```
- Auth: must be host
- Guard: auctionState.status must be 'completed'
- Set tournament.closed = true
- Clear activeTournamentCode for all users in tournament (moved from advanceToNextPlayer)
- Log "Auction closed by host"
- Broadcast 'state_update'
```

### API route — `app/api/tournaments/[code]/auction/route.ts`
Add two new cases to the existing switch:
```
case 'rerun': state = rerunUnsoldAuction(code, session.userId); break;
case 'close': state = closeAuction(code, session.userId); break;
```

### Page — `app/tournament/[code]/page.tsx`
Pass two new props to `TournamentRoom`:
```tsx
initialPlayers={Object.fromEntries(tournament.players)}
initialClosed={tournament.closed ?? false}
```

### TournamentRoom — `components/tournament/TournamentRoom.tsx`

**New props:** `initialPlayers: Record<string, TournamentPlayer>`, `initialClosed: boolean`

**New state:**
```typescript
const [players, setPlayers] = useState(initialPlayers);
const [isClosed, setIsClosed] = useState(initialClosed);
const closedRef = useRef(initialClosed);
closedRef.current = isClosed;
```

**Polling change** (line 54): replace `if (statusRef.current === 'completed') return;`
with `if (closedRef.current) return;`

Also update the polling block to set players and isClosed from API response:
```typescript
setPlayers(data.players);
setIsClosed(data.closed ?? false);
```

**Derive unsold players** (computed, not state):
```typescript
const soldIds = new Set(Object.values(teams).flatMap(t => t.players.map(p => p.id)));
const unsoldPlayers = auctionState.playerQueue
  .filter(id => !soldIds.has(id))
  .map(id => players[id])
  .filter(Boolean);
```

**Completed view additions** (lines 140–168):
- Show unsold players panel if `unsoldPlayers.length > 0`:
  ```
  Unsold Players (N)
  • Player Name    $BaseK
  ```
- Show host-only action bar (inline, not via HostControls):
  ```
  [Re-run Auction (N unsold)]   [Close Auction]
  ```
  Buttons call `POST /auction` with `action: 'rerun'` or `action: 'close'`; disable re-run if `unsoldPlayers.length === 0` or `isClosed`; hide both when `isClosed`.

---

## Feature 2: Fantasy Points Scoring

### New types — `lib/types.ts`

```typescript
export interface BattingPerformance {
  runs: number; balls: number; fours: number; sixes: number;
  dismissed: boolean; // false = not out
}

export interface BowlingPerformance {
  overs: number; maidens: number; runs: number; wickets: number;
}

export interface FieldingPerformance {
  catches: number; stumpings: number; runOuts: number;
}

export interface PlayerMatchPerformance {
  playerName: string;   // matched by name against tournament roster
  batting?: BattingPerformance;
  bowling?: BowlingPerformance;
  fielding?: FieldingPerformance;
}

export interface Match {
  id: string;
  title: string;       // "MI vs CSK, IPL 2024, Match 1"
  date: string;
  venue?: string;
  sourceUrl?: string;  // ESPN Cricinfo URL placeholder
  performances: PlayerMatchPerformance[];
}

export interface PlayerPoints {
  playerName: string;
  teamId?: string;      // set if player was bought by a team
  batting: number; bowling: number; fielding: number;
  total: number;
  breakdown: string[];  // ["Runs: 73 → 73pts", "50+ bonus → 8pts", ...]
}

export interface TeamMatchScore {
  teamId: string; teamName: string;
  totalPoints: number;
  playerScores: PlayerPoints[];
}

export interface TournamentMatchResult {
  match: Match;
  teamScores: TeamMatchScore[];  // sorted by totalPoints desc
  importedAt: string;
}
```

Add to `Tournament`:
```typescript
matchResults?: TournamentMatchResult[];
```

### Scoring logic — `lib/scoring.ts` (new file)

```
calculatePlayerPoints(perf: PlayerMatchPerformance): PlayerPoints

Points rules:
  Batting:
    +1 per run
    +1 per four
    +2 per six
    +4 if runs >= 30
    +8 if runs >= 50 (cumulative with 30 bonus)
    +16 if runs >= 100 (cumulative with 50 bonus)
    -2 if dismissed && runs === 0  (duck)
  Bowling:
    +25 per wicket
    +4 per maiden over
    +8 bonus if wickets >= 2
    +16 bonus if wickets >= 3
  Fielding:
    +8 per catch
    +12 per stumping
    +12 per run-out

calculateTeamScore(team: Team, performances: PlayerMatchPerformance[]): TeamMatchScore
  - For each player in team.players, find matching performance by name (case-insensitive)
  - Sum all player points
  - Return TeamMatchScore sorted by player total desc
```

### Sample scorecard — `lib/scorecard.ts` (new file)

Two exports:
1. `getSampleScorecard(): Match` — hardcoded realistic IPL match using the 20 seeded player names.
   Match title: **"Stars XI vs Legends XI — Sample IPL Match"**
2. `fetchFromESPNCricinfo(_url: string): Promise<Match>` — throws
   `Error('ESPN Cricinfo import is not yet implemented. Use the sample scorecard for now.')`

**Stars XI batting:** Virat Kohli 73(45, 8×4, 2×6), Rohit Sharma 45(32, 5×4, 1×6), Shubman Gill 28(20, 3×4, not out), Suryakumar Yadav 51(28, 4×4, 3×6), KL Rahul 12(10, 1×4, dismissed), Hardik Pandya 22(15, 2×4, 1×6, dismissed), Glenn Maxwell 0(2, dismissed=duck), David Warner 38(25, 4×4, 1×6)

**Stars XI bowling:** Jasprit Bumrah 4-0-22-3, Mohammed Siraj 4-0-38-1, Axar Patel 4-1-25-2 (1 maiden), Yuzvendra Chahal 4-0-35-2

**Legends XI batting:** Jos Buttler 82(50, 7×4, 4×6), Faf du Plessis 34(22, 3×4, 1×6), Nicholas Pooran 15(12, 1×4, 1×6, dismissed), MS Dhoni 19(10, 1×4, 1×6, dismissed), Pat Cummins 8(5, 1×4, dismissed)

**Legends XI bowling:** Pat Cummins 4-0-42-2, Rashid Khan 4-1-28-3 (1 maiden), Mitchell Starc 4-0-48-1, Ravindra Jadeja 4-1-30-1 (1 maiden)

**Fielding:** MS Dhoni 2 catches + 1 stumping; KL Rahul 1 stumping; Hardik Pandya 1 catch; Ravindra Jadeja 1 run-out

### Store additions — `lib/store.ts`

**New `importMatch(code, userId, match)`**
```
- Auth: must be host
- Guard: tournament.status must be 'completed'
- For each performance in match.performances:
    find playerId by matching name case-insensitively in tournament.players
    find teamId by checking which team.players contains that playerId
- Calculate PlayerPoints for each performance using calculatePlayerPoints()
- Attach teamId to PlayerPoints where matched
- Build TeamMatchScore for each team: sum points for owned players
- Sort TeamMatchScore[] by totalPoints desc
- Push TournamentMatchResult to tournament.matchResults
- Broadcast 'state_update' with updated auctionState
```

Initialize `matchResults: []` in `createTournament()`.

### API route — `app/api/tournaments/[code]/score/route.ts` (new file)

```
GET  → returns { matchResults: tournament.matchResults }
POST → body: { source: 'sample' | 'url', url?: string }
       source='sample': calls getSampleScorecard(), then importMatch()
       source='url':    calls fetchFromESPNCricinfo(url) [will throw], then importMatch()
       returns { matchResult: TournamentMatchResult }
```

### UI — `components/tournament/ScoringPanel.tsx` (new file)

Props: `{ code: string, isHost: boolean }`

Behavior:
- On mount: fetch `GET /api/tournaments/{code}/score`; show leaderboard if results exist
- Host section: "Import Sample Scorecard" button + greyed-out URL input (placeholder "ESPN Cricinfo URL — coming soon") with a lock icon
- Leaderboard: ranked list of teams with total points; expandable per-player breakdown

### TournamentRoom — completed view

Add `<ScoringPanel code={code} isHost={isHost} />` below the squad cards in the completed view.

---

## Files to create/modify

| File | Change |
|------|--------|
| `lib/types.ts` | Add `Tournament.closed`, match/scoring types |
| `lib/store.ts` | Modify `advanceToNextPlayer`; add `rerunUnsoldAuction`, `closeAuction`, `importMatch`; init `matchResults` |
| `lib/scoring.ts` | **New** — `calculatePlayerPoints`, `calculateTeamScore` |
| `lib/scorecard.ts` | **New** — `getSampleScorecard`, `fetchFromESPNCricinfo` |
| `app/api/tournaments/[code]/auction/route.ts` | Add `rerun`, `close` cases |
| `app/api/tournaments/[code]/score/route.ts` | **New** — GET + POST |
| `app/tournament/[code]/page.tsx` | Pass `initialPlayers`, `initialClosed` |
| `components/tournament/TournamentRoom.tsx` | Players/closed state, polling fix, re-run UI, ScoringPanel |
| `components/tournament/ScoringPanel.tsx` | **New** — leaderboard + import controls |

---

## Verification

### Re-run auction
1. `npm run dev` — sign up host + two other users in same tournament
2. Run full auction; mark some players unsold via "Mark UNSOLD"
3. When auction completes: confirm unsold players panel appears in completed view
4. Host clicks "Re-run Auction (N unsold)" → auction resumes with only those players
5. Let some sell, pass one → mark UNSOLD again
6. When re-run completes: confirm remaining unsold shown; "Re-run" and "Close" buttons visible
7. Host clicks "Close Auction" → buttons disappear, polling stops, users released from tournament

### Fantasy scoring
1. From completed tournament view, host clicks "Import Sample Scorecard"
2. Confirm leaderboard appears with teams ranked by total points
3. Expand a team to see per-player breakdown (batting/bowling/fielding points)
4. Verify players not owned by any team do not appear in the leaderboard
5. Click the ESPN URL input → confirm it's greyed out with "coming soon" tooltip
