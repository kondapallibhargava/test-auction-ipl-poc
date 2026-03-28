# IPL Auction POC — Implementation Plan

## Context
Building a multi-user IPL-style auction web app where users register as teams and bid on cricket players in real-time. The app is a clone/inspiration of iplauction.co. The project was scaffolded with `create-next-app` at `/Users/bhargava/repos/ipl/ipl-auction-poc/` using Next.js 16.2.1, React 19, TypeScript, Tailwind CSS v4.

---

## Key Design Decisions

### Tournaments
- Any user can create a tournament (generates a short invite code, e.g. `IPL-4X9K`)
- A tournament has its own isolated auction state, player pool, and teams
- Multiple tournaments can run independently
- Tournament statuses: `lobby` → `active` → `completed`

### User Identity
- Username + password stored in-memory (plaintext for POC — clearly marked for replacement)
- Auth abstraction layer (`lib/auth.ts`) exposes `login()`, `register()`, `getSession()` with a comment block indicating where to swap in NextAuth.js / OAuth
- Session stored as `ipl-session` cookie (HttpOnly) containing `{ userId, username }`

### One Active Tournament Per User
- A user can only have one active team at a time (one tournament where status ≠ `completed`)
- "Slot" is freed when: (a) tournament reaches `completed`, or (b) user explicitly leaves the tournament
- Enforced on `POST /api/tournaments/[code]/join` — server checks user's existing active tournament

---

## User Flows

### Flow 0: Sign Up / Log In
1. User visits `localhost:3000` — sees a landing page with "Sign Up" and "Log In" options
2. **Sign Up**: enters username + password → `POST /api/auth/register` → sets `ipl-session` cookie → redirected to `/dashboard`
3. **Log In**: enters existing credentials → `POST /api/auth/login` → sets `ipl-session` cookie → redirected to `/dashboard`
4. Error cases: duplicate username (sign up), wrong password (log in)

### Flow 1: Creating a Tournament
1. Logged-in user visits `/dashboard` — sees their active tournament (if any) and a "Create Tournament" button
2. Fills in **Tournament Name** and optional settings (starting budget per team, player pool)
3. Submits → `POST /api/tournaments` → tournament created with auto-generated invite code (e.g. `IPL-4X9K`)
4. User is redirected to the tournament lobby `/tournament/[code]`
5. Invite code is prominently displayed — user shares it with friends

### Flow 1b: Team Registration (Joining a Tournament)
1. User visits `/dashboard` — sees a "Join Tournament" field
2. Enters invite code → `POST /api/tournaments/[code]/join` with `{ teamName }`
3. Server validates:
   - Valid invite code / tournament exists
   - Tournament in `lobby` or `active` status (not `completed`)
   - User does not already have an active team in another tournament
4. Team created and linked to user + tournament, user redirected to `/tournament/[code]`
5. Their team name appears in the lobby participants list

### Flow 2: Watching the Auction
1. User opens `/tournament/[code]` (must be logged in and have a team in this tournament)
2. Page loads with current auction state from the server
3. SSE connection established to `/api/tournaments/[code]/stream`
4. If tournament is in `lobby`: sees "Waiting for tournament to start..." + list of joined teams
5. Once the tournament creator starts the auction: banner updates, first player card appears in real-time
6. User sees: player name, role, nationality, stats, base price, current highest bid, bidding team

### Flow 3: Placing a Bid
1. Auction is in `player_up` state — a player is on the block
2. Bidder sees the **Bid Panel** with a pre-filled amount (current highest + ₹25L increment, or base price)
3. Bidder adjusts amount if desired (must be ≥ minimum increment)
4. Clicks **"Place Bid"** → `POST /api/tournaments/[code]/bid` with `{ amount }`
5. Server validates: correct status, sufficient budget, valid amount, user has a team in this tournament
6. On success: bid recorded, SSE broadcast sent to all connected clients in the tournament
7. All tabs immediately show updated highest bid, bidder name highlighted in team table
8. If another team outbids: original bidder sees the updated bid in real-time

### Flow 4: Tournament Creator Starting and Advancing the Auction
1. The user who **created** the tournament sees host controls (Start Auction, Mark Sold/Unsold)
2. Other participants do not see these controls
3. **Start Auction**: transitions tournament from `lobby` to `active`, puts first player on the block
4. **Mark as SOLD**:
   - Sets current player `isSold=true`, `soldTo`, `soldFor`
   - Deducts from winning team's `remainingBudget`
   - Sets status to `sold` (2-second display), then auto-advances
5. **Mark as UNSOLD**: sets status to `unsold` (2-second display), then auto-advances
6. When all players done: tournament status → `completed`, all users' "active slot" is freed

### Flow 5: Auction Completion & Slot Release
1. Last player sold/unsold → tournament status `completed`
2. All connected clients see "Auction Complete!" banner with final leaderboard
3. Each user in the tournament can now register a team in a new tournament
4. The `/dashboard` no longer shows this tournament as "active"

### Flow 6: Leaving a Tournament (Manual Slot Release)
1. User on `/tournament/[code]` (tournament still in `lobby` or `active`)
2. Clicks "Leave Tournament"
3. `DELETE /api/tournaments/[code]/leave` — removes their team from the tournament
4. User is redirected to `/dashboard` and can now join a different tournament
5. Note: if tournament is `active` and user has the highest bid on a current player, their bid is removed

### Flow 7: Multiple Users Bidding Simultaneously
1. User A and User B both have `/tournament/[code]` open
2. User A places a bid → SSE broadcast → User B sees updated bid instantly
3. User B tries to place a lower bid → rejected with "Minimum bid is ₹X"
4. User B places a higher bid → SSE broadcast → User A sees they were outbid
5. Teams continue bidding until host marks SOLD

### Error States
- **Username taken**: sign-up form shows "Username already taken"
- **Wrong password**: log-in form shows "Invalid username or password"
- **Invalid invite code**: join form shows "Tournament not found"
- **Already in a tournament**: join form shows "You already have an active team in [Tournament Name]. Leave that tournament first."
- **Insufficient budget**: bid panel shows "You don't have enough budget for this bid"
- **Auction not active**: bid button disabled with "No player currently up for bidding"
- **SSE disconnected**: hook auto-reconnects with exponential backoff; shows "Reconnecting..." indicator

---

## Tech Stack Notes (Next.js 16 Breaking Changes)
- `params` and `searchParams` in pages/routes are now **Promises** — must be `await`ed
- All auction API routes need `export const dynamic = 'force-dynamic'` to disable caching
- Tailwind v4: use `@import "tailwindcss"` + `@theme inline {}` in CSS, no `tailwind.config.js`
- `RouteContext<'/path/[param]'>` available globally for typed route params

---

## File Structure

```
ipl-auction-poc/
├── app/
│   ├── page.tsx                               # Landing (sign up / log in)
│   ├── layout.tsx                             # Root layout, IPL theme, Header
│   ├── globals.css                            # Tailwind v4 @theme with IPL palette
│   ├── dashboard/
│   │   └── page.tsx                           # User dashboard: active tournament, create/join
│   ├── tournament/
│   │   └── [code]/
│   │       └── page.tsx                       # Tournament lobby + auction room
│   └── api/
│       ├── auth/
│       │   ├── register/route.ts              # POST: create user account
│       │   ├── login/route.ts                 # POST: log in, set session cookie
│       │   └── logout/route.ts                # POST: clear session cookie
│       ├── players/route.ts                   # GET: seeded player pool
│       └── tournaments/
│           ├── route.ts                       # GET: all tournaments, POST: create tournament
│           └── [code]/
│               ├── route.ts                   # GET: tournament detail
│               ├── join/route.ts              # POST: join tournament (register team)
│               ├── leave/route.ts             # DELETE: leave tournament
│               ├── auction/route.ts           # POST: host actions (start/sold/unsold/reset)
│               ├── bid/route.ts               # POST: place a bid
│               └── stream/route.ts            # GET: SSE stream for this tournament
│
├── lib/
│   ├── types.ts                               # All TypeScript interfaces
│   ├── seed.ts                                # 20 seeded IPL players
│   ├── store.ts                               # globalThis in-memory singleton
│   └── auth.ts                               # Auth abstraction (swap for NextAuth later)
│
├── components/
│   ├── layout/
│   │   └── Header.tsx
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   └── Badge.tsx
│   ├── auth/
│   │   ├── SignUpForm.tsx
│   │   └── LoginForm.tsx
│   ├── dashboard/
│   │   ├── TournamentCard.tsx
│   │   ├── CreateTournamentForm.tsx
│   │   └── JoinTournamentForm.tsx
│   └── tournament/
│       ├── TournamentRoom.tsx                 # Client component, uses useTournamentStream
│       ├── Lobby.tsx                          # Pre-auction participant list
│       ├── CurrentPlayerCard.tsx
│       ├── BidPanel.tsx
│       ├── BidHistory.tsx
│       ├── TeamBudgetTable.tsx
│       ├── AuctionStatusBanner.tsx
│       └── HostControls.tsx                  # Only shown to tournament creator
│
├── hooks/
│   └── useTournamentStream.ts                # EventSource → state, with polling fallback
│
└── documents/
    └── plan1.md                               # This file
```

---

## Data Models (`lib/types.ts`)

```typescript
type PlayerRole = 'Batsman' | 'Bowler' | 'All-Rounder' | 'Wicket-Keeper';
type PlayerNationality = 'Indian' | 'Overseas';
type AuctionStatus = 'lobby' | 'player_up' | 'sold' | 'unsold' | 'completed';

// Global player pool (seeded, shared across tournaments — each tournament gets its own copies)
interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  nationality: PlayerNationality;
  country: string;
  age: number;
  basePrice: number;        // In lakhs (e.g., 200 = ₹2 crore)
  stats: {
    matches?: number;
    runs?: number;
    wickets?: number;
    average?: number;
    economy?: number;
    strikeRate?: number;
  };
}

// Per-tournament player state (copy of Player + auction outcome)
interface TournamentPlayer extends Player {
  isSold: boolean;
  soldTo?: string;          // teamId
  soldFor?: number;         // Final price in lakhs
}

interface User {
  id: string;
  username: string;
  passwordHash: string;     // Plaintext for POC — clearly marked TODO: replace with bcrypt
  createdAt: number;
  activeTournamentCode?: string;  // null when slot is free
}

interface Tournament {
  id: string;
  code: string;             // Short invite code, e.g. "IPL-4X9K"
  name: string;
  createdBy: string;        // userId of creator (also the host with auction controls)
  createdAt: number;
  status: AuctionStatus;
  teamBudget: number;       // Starting budget per team in crores (default: 100)
  teams: Map<string, Team>; // teamId → Team
  players: Map<string, TournamentPlayer>; // playerId → TournamentPlayer (copies from seed)
  auctionState: AuctionState;
}

interface Team {
  id: string;
  teamName: string;
  userId: string;           // Owner's user ID
  tournamentCode: string;
  initialBudget: number;    // In crores
  remainingBudget: number;  // In crores
  players: string[];        // Array of player IDs won
  registeredAt: number;
}

interface Bid {
  id: string;
  teamId: string;
  teamName: string;
  userId: string;
  playerId: string;
  amount: number;           // In lakhs
  timestamp: number;
}

interface AuctionState {
  status: AuctionStatus;
  currentPlayerIndex: number;
  currentPlayer: TournamentPlayer | null;
  currentHighestBid: Bid | null;
  bidHistory: Bid[];        // Bids for current player only
  playerQueue: string[];    // Ordered player IDs for this tournament
  auctionLog: AuctionLogEntry[];
}

interface AuctionLogEntry {
  type: 'bid' | 'sold' | 'unsold' | 'started' | 'next_player';
  message: string;
  timestamp: number;
}

// SSE event envelope (scoped per tournament)
interface TournamentEvent {
  type: 'state_update' | 'bid_placed' | 'player_sold' | 'player_unsold' | 'auction_started' | 'auction_completed' | 'team_joined' | 'team_left';
  payload: { auctionState: AuctionState; teams: Team[] };
  timestamp: number;
}

// Session cookie payload
interface Session {
  userId: string;
  username: string;
}
```

---

## In-Memory Store Pattern (`lib/store.ts`)

Uses `globalThis` to survive Next.js hot-reload during development:

```typescript
declare global {
  var __store: StoreShape | undefined;
  var __sseClients: Map<string, Set<ReadableStreamDefaultController>> | undefined;
  // Map<tournamentCode, Set<controllers>>
}

interface StoreShape {
  users: Map<string, User>;                   // userId → User
  usersByUsername: Map<string, string>;       // username → userId (for login lookup)
  tournaments: Map<string, Tournament>;       // tournamentCode → Tournament
  seedPlayers: Player[];                      // Immutable seed pool
}

function getStore(): StoreShape { ... }
```

Key exported functions:
- `getStore()` — initializes on first call with seed players
- `registerUser(username, password)` — validates uniqueness, creates User
- `loginUser(username, password)` — returns User or null
- `createTournament(name, createdBy, teamBudget)` — generates invite code, creates Tournament
- `joinTournament(code, userId, teamName)` — validates slot constraint, registers team
- `leaveTournament(code, userId)` — removes team, clears `user.activeTournamentCode`
- `placeBid(code, userId, amount)` — validates and records bid, broadcasts event
- `advanceAuction(code, action)` — state machine transition (sold/unsold/next)
- `broadcastTournamentEvent(code, event)` — iterates SSE clients for this tournament, prunes dead ones

## Auth Abstraction (`lib/auth.ts`)

```typescript
// TODO: Replace this entire module with NextAuth.js + OAuth when going live.
// Current implementation: plain username/password, stored in memory, session in signed cookie.

export async function register(username: string, password: string): Promise<User>
export async function login(username: string, password: string): Promise<User | null>
export function getSession(cookieValue: string): Session | null
export function createSessionCookie(user: User): string  // Returns cookie value to set
export function clearSessionCookie(): string             // Returns expired cookie value
```

Session token: base64-encoded JSON `{ userId, username }` — no real signing for POC (mark as TODO for HMAC/JWT).

---

## API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/auth/register` | Create user, set `ipl-session` cookie |
| POST | `/api/auth/login` | Authenticate, set `ipl-session` cookie |
| POST | `/api/auth/logout` | Clear session cookie |
| GET | `/api/players` | Full seeded player pool |
| GET | `/api/tournaments` | List all tournaments |
| POST | `/api/tournaments` | Create tournament (auth required) |
| GET | `/api/tournaments/[code]` | Tournament detail + teams + auction state |
| POST | `/api/tournaments/[code]/join` | Join tournament with team name (auth required, slot check) |
| DELETE | `/api/tournaments/[code]/leave` | Leave tournament (frees user's active slot) |
| POST | `/api/tournaments/[code]/auction` | Host actions: `{ action: 'start' \| 'sold' \| 'unsold' \| 'reset' }` |
| POST | `/api/tournaments/[code]/bid` | Place a bid: `{ amount }` (teamId from session) |
| GET | `/api/tournaments/[code]/stream` | SSE stream for this tournament (force-dynamic) |

All routes under `/api/tournaments/[code]/*` require an authenticated session (read from `ipl-session` cookie).

### SSE Route Pattern
```typescript
export const dynamic = 'force-dynamic';

export function GET() {
  let controller: ReadableStreamDefaultController;
  const stream = new ReadableStream({
    start(c) {
      controller = c;
      addSSEClient(c);
      // Send immediate current state
      c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(buildStateEvent())}\n\n`));
    },
    cancel() {
      removeSSEClient(controller);
    }
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    }
  });
}
```

---

## Auction Flow State Machine

```
not_started ──[admin: start]──► player_up
player_up   ──[admin: sold]───► sold ──[auto 2s]──► player_up (next player)
player_up   ──[admin: unsold]─► unsold ──[auto 2s]─► player_up (next player)
                                                       └─ OR completed (last player)
```

---

## Bid Validation Rules
- `status` must be `'player_up'`
- First bid: `amount >= player.basePrice`
- Subsequent bids: `amount >= currentHighestBid.amount + 25` (min increment: 25 lakhs)
- `amount <= team.remainingBudget * 100` (convert crores → lakhs)

---

## Identity / Session
- `POST /api/teams` sets `Set-Cookie: ipl-team-id=<id>; Path=/; SameSite=Lax`
- Server pages read via `cookies()` from `next/headers`
- Client components receive `currentTeamId` as prop from server parent

---

## 20 Seeded Players

### Indian Players (12)
| Name | Role | Base Price |
|------|------|-----------|
| Virat Kohli | Batsman | ₹2 Cr |
| Rohit Sharma | Batsman | ₹2 Cr |
| Jasprit Bumrah | Bowler | ₹2 Cr |
| Ravindra Jadeja | All-Rounder | ₹2 Cr |
| MS Dhoni | Wicket-Keeper | ₹2 Cr |
| KL Rahul | Wicket-Keeper | ₹1.5 Cr |
| Shubman Gill | Batsman | ₹1.5 Cr |
| Mohammed Siraj | Bowler | ₹1 Cr |
| Hardik Pandya | All-Rounder | ₹2 Cr |
| Suryakumar Yadav | Batsman | ₹2 Cr |
| Axar Patel | All-Rounder | ₹1 Cr |
| Yuzvendra Chahal | Bowler | ₹75 L |

### Overseas Players (8)
| Name | Role | Country | Base Price |
|------|------|---------|-----------|
| Pat Cummins | Bowler | Australia | ₹2 Cr |
| Jos Buttler | Wicket-Keeper | England | ₹2 Cr |
| David Warner | Batsman | Australia | ₹1.5 Cr |
| Rashid Khan | Bowler | Afghanistan | ₹2 Cr |
| Glenn Maxwell | All-Rounder | Australia | ₹1.5 Cr |
| Nicholas Pooran | Wicket-Keeper | West Indies | ₹1 Cr |
| Mitchell Starc | Bowler | Australia | ₹2 Cr |
| Faf du Plessis | Batsman | South Africa | ₹1 Cr |

---

## IPL Theme (`app/globals.css`)

```css
@import "tailwindcss";

@theme inline {
  --color-ipl-blue: #003366;
  --color-ipl-gold: #FFD700;
  --color-ipl-green: #1a7a1a;
  --color-ipl-dark: #0a0f1e;       /* body background */
  --color-ipl-card: #0d1b3e;       /* card background */
  --color-ipl-accent: #FF6B00;
  --color-ipl-text: #e8e8e8;
}

body {
  background: var(--color-ipl-dark);
  color: var(--color-ipl-text);
}
```

**Role badge colors:** Batsman=blue, Bowler=red, All-Rounder=purple, Wicket-Keeper=gold

**Auction room layout (desktop):** 3 columns — Team Budgets | Current Player + Bid Panel | Bid History

---

## Implementation Sequence

**Phase 1 — Foundation**
1. `lib/types.ts` — All interfaces (User, Tournament, Team, Player, TournamentPlayer, Bid, AuctionState, Session, etc.)
2. `lib/seed.ts` — 20 player seed data
3. `lib/store.ts` — globalThis store, all mutation helpers, per-tournament SSE client map, broadcastTournamentEvent
4. `lib/auth.ts` — Auth abstraction with TODO comments for NextAuth replacement

**Phase 2 — API Routes**
5. `app/api/auth/register/route.ts`
6. `app/api/auth/login/route.ts`
7. `app/api/auth/logout/route.ts`
8. `app/api/players/route.ts`
9. `app/api/tournaments/route.ts` (GET list, POST create)
10. `app/api/tournaments/[code]/route.ts` (GET detail)
11. `app/api/tournaments/[code]/join/route.ts`
12. `app/api/tournaments/[code]/leave/route.ts`
13. `app/api/tournaments/[code]/auction/route.ts` (host controls)
14. `app/api/tournaments/[code]/bid/route.ts`
15. `app/api/tournaments/[code]/stream/route.ts` (SSE)

**Phase 3 — Styles & Layout**
16. `app/globals.css` — IPL @theme colors
17. `app/layout.tsx` + `components/layout/Header.tsx`

**Phase 4 — UI Components**
18. `components/ui/` — Button, Card, Badge
19. `components/auth/` — SignUpForm, LoginForm
20. `components/dashboard/` — TournamentCard, CreateTournamentForm, JoinTournamentForm
21. `components/tournament/` — all tournament components + HostControls

**Phase 5 — Pages & Hook**
22. `hooks/useTournamentStream.ts` — EventSource + polling fallback, reconnect logic
23. `app/page.tsx` — Landing (sign up / log in forms)
24. `app/dashboard/page.tsx` — User dashboard
25. `app/tournament/[code]/page.tsx` — Tournament room (lobby + auction)

---

## Verification
1. `cd ipl-auction-poc && npm run dev`
2. Open `localhost:3000` → sign up as user1, user2, user3 in separate browser tabs
3. As user1: create a tournament "IPL 2025" → get invite code
4. As user2, user3: paste invite code in "Join Tournament" on dashboard, register team names
5. As user1 (host): click "Start Auction" — all 3 tabs see first player appear via SSE
6. Place bids from user2 and user3 tabs — all tabs update in real-time
7. user1 (host) clicks "Mark SOLD" — winning team's budget deducts, player assigned
8. Try: have user2 attempt to join a second tournament — should be blocked with "already in active tournament"
9. After tournament completes → user2 can now join a new tournament
10. Advance through all players → tournament reaches `completed` state across all tabs
