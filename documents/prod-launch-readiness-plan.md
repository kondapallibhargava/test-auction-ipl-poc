# Prod Launch Readiness — IPL Auction

## Supabase Setup (one-time manual steps)

1. Create account at supabase.com → New Project
2. Note: `Project URL`, `anon key` (public), and `service_role key` (secret)
3. Run the SQL schema below in the Supabase SQL Editor
4. Add env vars to Vercel: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`

---

## Database Schema

```sql
-- Players (extensible roster)
create table players (
  id          text primary key,
  name        text not null,
  role        text not null,             -- 'Batsman'|'Bowler'|'All-Rounder'|'Wicket-Keeper'
  base_price  integer not null,          -- in thousands (e.g. 200 = ₹200k)
  nationality text,                      -- 'Indian'|'Overseas'
  is_active   boolean default true
);

-- Users
create table users (
  user_id                text primary key,
  username               text unique not null,
  password_hash          text not null,
  active_tournament_code text,
  created_at             timestamptz default now()
);

-- Tournaments
create table tournaments (
  code            text primary key,
  tournament_id   text not null,
  name            text not null,
  created_by      text references users(user_id),
  status          text not null default 'lobby',   -- 'lobby'|'active'|'completed'
  closed          boolean default false,
  team_budget     integer not null,                -- per-team budget in millions
  max_teams       integer not null default 8,
  auction_state   jsonb not null,                  -- full AuctionState object
  match_results   jsonb not null default '[]',     -- TournamentMatchResult[]
  created_at      timestamptz default now()
);

-- Teams (one per participant per tournament)
create table teams (
  team_id         text primary key,
  tournament_code text references tournaments(code),
  owner_id        text references users(user_id),
  name            text not null,
  initial_budget  integer not null,
  budget          integer not null,                -- remaining budget in millions
  created_at      timestamptz default now()
);

-- Players bought by teams
create table team_players (
  team_id    text references teams(team_id),
  player_id  text references players(id),
  bought_at  integer not null,                     -- price paid in thousands
  primary key (team_id, player_id)
);
```

---

## Seed Players

```sql
insert into players (id, name, role, base_price, nationality) values
  ('p1',  'Virat Kohli',       'Batsman',        200, 'Indian'),
  ('p2',  'Rohit Sharma',      'Batsman',        200, 'Indian'),
  ('p3',  'Jasprit Bumrah',    'Bowler',         200, 'Indian'),
  ('p4',  'Ravindra Jadeja',   'All-Rounder',    150, 'Indian'),
  ('p5',  'MS Dhoni',          'Wicket-Keeper',  200, 'Indian'),
  ('p6',  'KL Rahul',          'Wicket-Keeper',  150, 'Indian'),
  ('p7',  'Shubman Gill',      'Batsman',        100, 'Indian'),
  ('p8',  'Mohammed Siraj',    'Bowler',         100, 'Indian'),
  ('p9',  'Hardik Pandya',     'All-Rounder',    150, 'Indian'),
  ('p10', 'Suryakumar Yadav',  'Batsman',        150, 'Indian'),
  ('p11', 'Axar Patel',        'All-Rounder',     75, 'Indian'),
  ('p12', 'Yuzvendra Chahal',  'Bowler',          75, 'Indian'),
  ('p13', 'Pat Cummins',       'Bowler',         200, 'Overseas'),
  ('p14', 'Jos Buttler',       'Wicket-Keeper',  200, 'Overseas'),
  ('p15', 'David Warner',      'Batsman',        150, 'Overseas'),
  ('p16', 'Rashid Khan',       'Bowler',         200, 'Overseas'),
  ('p17', 'Glenn Maxwell',     'All-Rounder',    150, 'Overseas'),
  ('p18', 'Nicholas Pooran',   'Wicket-Keeper',  100, 'Overseas'),
  ('p19', 'Mitchell Starc',    'Bowler',         200, 'Overseas'),
  ('p20', 'Faf du Plessis',    'Batsman',        100, 'Overseas');
```

---

## Environment Variables

`.env.local` (gitignored — fill in after Supabase project is created):
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SESSION_SECRET=<64-char hex: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
```

Vercel: Project → Settings → Environment Variables → add the same three.

---

## Verification Checklist

1. **Persistence**: Create tournament → restart dev server → reload page → tournament still exists
2. **Auth security**: Edit session cookie in DevTools → server returns 401
3. **Multi-user**: Two browser tabs as different users → bids appear within 2s (polling)
4. **Player roster**: Add new row in Supabase players table → appears in next tournament's pool
5. **Scorecard import**: Paste match JSON → leaderboard updates → re-import same match → error "already imported"
6. **Deploy**: Push to main → Vercel builds green → friends can sign up and play

---

## What Changed vs POC

| Area | Before | After |
|------|--------|-------|
| Storage | `globalThis.__store` (lost on restart) | Supabase PostgreSQL |
| Auth | Plaintext passwords, unsigned base64 cookies | bcrypt hashing, HMAC-SHA256 signed cookies |
| Real-time | SSE + polling | Polling only (2s interval) |
| Player pool | Hardcoded in `lib/seed.ts` | `players` table (add rows to expand pool) |
| Types | `Map<string, Team>` | `Record<string, Team>` |

---

## Adding New Players

Just insert a row in Supabase:
```sql
insert into players (id, name, role, base_price, nationality)
values ('new-player-slug', 'Player Name', 'Batsman', 100, 'Indian');
```

The player appears in the pool for all new tournaments automatically.

---

## Scorecard JSON Format

When pasting match JSON in the UI, use this shape:

```json
{
  "id": "unique-match-id",
  "title": "Team A vs Team B, IPL 2025, Match 1",
  "date": "2025-04-07",
  "venue": "Optional venue name",
  "performances": [
    {
      "playerName": "Virat Kohli",
      "batting": { "runs": 73, "balls": 45, "fours": 8, "sixes": 2, "dismissed": false }
    },
    {
      "playerName": "Jasprit Bumrah",
      "bowling": { "overs": 4, "maidens": 0, "runs": 22, "wickets": 3 }
    }
  ]
}
```

Player names must match exactly (case-insensitive) the names in the players table.
