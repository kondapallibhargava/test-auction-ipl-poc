import { User, Tournament, Team, TournamentPlayer, Bid, AuctionState, TournamentEvent, Match, TournamentMatchResult, PlayerPoints } from './types';
import { calculatePlayerPoints, calculateTeamScore } from './scoring';
import { SEEDED_PLAYERS } from './seed';
import crypto from 'crypto';

interface StoreShape {
  users: Map<string, User>; // userId -> User
  usersByUsername: Map<string, string>; // username -> userId
  tournaments: Map<string, Tournament>; // code -> Tournament
}

declare global {
  // eslint-disable-next-line no-var
  var __store: StoreShape | undefined;
  // eslint-disable-next-line no-var
  var __sseClients: Map<string, Set<ReadableStreamDefaultController>> | undefined;
}

function initStore(): StoreShape {
  return {
    users: new Map(),
    usersByUsername: new Map(),
    tournaments: new Map(),
  };
}

export function getStore(): StoreShape {
  if (!globalThis.__store) {
    globalThis.__store = initStore();
  }
  return globalThis.__store;
}

export function getSseClients(): Map<string, Set<ReadableStreamDefaultController>> {
  if (!globalThis.__sseClients) {
    globalThis.__sseClients = new Map();
  }
  return globalThis.__sseClients;
}

function generateId(): string {
  return crypto.randomUUID();
}

function generateTournamentCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'IPL-';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

export function registerUser(username: string, passwordHash: string): User {
  const store = getStore();
  if (store.usersByUsername.has(username.toLowerCase())) {
    throw new Error('Username already taken');
  }
  const user: User = {
    id: generateId(),
    username,
    passwordHash,
    createdAt: new Date(),
  };
  store.users.set(user.id, user);
  store.usersByUsername.set(username.toLowerCase(), user.id);
  return user;
}

export function loginUser(username: string, password: string): User | null {
  const store = getStore();
  const userId = store.usersByUsername.get(username.toLowerCase());
  if (!userId) return null;
  const user = store.users.get(userId);
  if (!user) return null;
  if (user.passwordHash !== password) return null;
  return user;
}

export function getUserById(userId: string): User | undefined {
  return getStore().users.get(userId);
}

// ── Tournament helpers ────────────────────────────────────────────────────────

export function createTournament(
  userId: string,
  name: string,
  teamBudget: number,
  maxTeams: number
): Tournament {
  const store = getStore();
  const user = store.users.get(userId);
  if (!user) throw new Error('User not found');
  if (user.activeTournamentCode) throw new Error('Already in an active tournament');

  let code = generateTournamentCode();
  while (store.tournaments.has(code)) {
    code = generateTournamentCode();
  }

  // Build player pool
  const players = new Map<string, TournamentPlayer>();
  for (const p of SEEDED_PLAYERS) {
    players.set(p.id, { ...p, isSold: false });
  }

  const playerQueue = SEEDED_PLAYERS.map((p) => p.id);

  const auctionState: AuctionState = {
    status: 'lobby',
    currentPlayerIndex: 0,
    currentPlayer: null,
    currentHighestBid: null,
    bidHistory: [],
    playerQueue,
    auctionLog: [],
  };

  const tournament: Tournament = {
    id: generateId(),
    code,
    name,
    createdBy: userId,
    status: 'lobby',
    teamBudget,
    maxTeams,
    teams: new Map(),
    players,
    auctionState,
    createdAt: new Date(),
    matchResults: [],
  };

  // Create host's team
  const hostTeam: Team = {
    id: generateId(),
    teamName: `${user.username}'s Team`,
    userId,
    tournamentCode: code,
    initialBudget: teamBudget,
    remainingBudget: teamBudget,
    players: [],
    registeredAt: new Date(),
  };
  tournament.teams.set(hostTeam.id, hostTeam);

  store.tournaments.set(code, tournament);
  user.activeTournamentCode = code;

  return tournament;
}

export function joinTournament(userId: string, code: string, teamName: string): Team {
  const store = getStore();
  const user = store.users.get(userId);
  if (!user) throw new Error('User not found');
  if (user.activeTournamentCode) throw new Error('Already in an active tournament');

  const tournament = store.tournaments.get(code);
  if (!tournament) throw new Error('Tournament not found');
  if (tournament.status !== 'lobby') throw new Error('Tournament already started');
  if (tournament.teams.size >= tournament.maxTeams) throw new Error('Tournament is full');

  // Check user not already in tournament
  for (const team of tournament.teams.values()) {
    if (team.userId === userId) throw new Error('Already in this tournament');
  }

  const team: Team = {
    id: generateId(),
    teamName,
    userId,
    tournamentCode: code,
    initialBudget: tournament.teamBudget,
    remainingBudget: tournament.teamBudget,
    players: [],
    registeredAt: new Date(),
  };

  tournament.teams.set(team.id, team);
  user.activeTournamentCode = code;

  broadcastTournamentEvent(code, {
    type: 'team_joined',
    payload: { message: `${teamName} has joined the tournament`, teams: serializeTeams(tournament) },
    timestamp: new Date().toISOString(),
  });

  return team;
}

export function leaveTournament(userId: string, code: string): void {
  const store = getStore();
  const user = store.users.get(userId);
  if (!user) throw new Error('User not found');

  const tournament = store.tournaments.get(code);
  if (!tournament) throw new Error('Tournament not found');
  if (tournament.status !== 'lobby') throw new Error('Cannot leave an active tournament');
  if (tournament.createdBy === userId) throw new Error('Host cannot leave the tournament');

  let teamId: string | undefined;
  for (const [id, team] of tournament.teams) {
    if (team.userId === userId) {
      teamId = id;
      break;
    }
  }
  if (!teamId) throw new Error('Not in this tournament');

  tournament.teams.delete(teamId);
  user.activeTournamentCode = undefined;

  broadcastTournamentEvent(code, {
    type: 'team_left',
    payload: { message: 'A team has left the tournament', teams: serializeTeams(tournament) },
    timestamp: new Date().toISOString(),
  });
}

export function getTournament(code: string): Tournament | undefined {
  return getStore().tournaments.get(code);
}

export function listTournaments(): Tournament[] {
  return Array.from(getStore().tournaments.values());
}

// ── Auction helpers ───────────────────────────────────────────────────────────

export function startAuction(code: string, userId: string): AuctionState {
  const tournament = getTournament(code);
  if (!tournament) throw new Error('Tournament not found');
  if (tournament.createdBy !== userId) throw new Error('Only the host can start the auction');
  if (tournament.auctionState.status !== 'lobby') throw new Error('Auction already started');
  if (tournament.teams.size < 2) throw new Error('Need at least 2 teams to start');

  const state = tournament.auctionState;
  const firstPlayerId = state.playerQueue[0];
  const firstPlayer = tournament.players.get(firstPlayerId) ?? null;

  state.status = 'player_up';
  state.currentPlayer = firstPlayer;
  state.currentPlayerIndex = 0;
  state.currentHighestBid = null;
  state.bidHistory = [];
  state.auctionLog.push(`Auction started! First player: ${firstPlayer?.name}`);
  tournament.status = 'active';

  broadcastTournamentEvent(code, {
    type: 'auction_update',
    payload: { auctionState: state, teams: serializeTeams(tournament) },
    timestamp: new Date().toISOString(),
  });

  return state;
}

export function markSold(code: string, userId: string): AuctionState {
  const tournament = getTournament(code);
  if (!tournament) throw new Error('Tournament not found');
  if (tournament.createdBy !== userId) throw new Error('Only the host can mark sold');

  const state = tournament.auctionState;
  if (state.status !== 'player_up') throw new Error('No active player');
  if (!state.currentHighestBid) throw new Error('No bids placed');

  const { currentPlayer, currentHighestBid } = state;
  if (!currentPlayer) throw new Error('No current player');

  // Deduct budget from winning team
  const winningTeam = tournament.teams.get(currentHighestBid.teamId);
  if (!winningTeam) throw new Error('Winning team not found');

  const costInMillions = currentHighestBid.amount / 100;
  winningTeam.remainingBudget = Math.round((winningTeam.remainingBudget - costInMillions) * 100) / 100;

  // Mark player as sold
  currentPlayer.isSold = true;
  currentPlayer.soldTo = currentHighestBid.teamId;
  currentPlayer.soldFor = currentHighestBid.amount;
  winningTeam.players.push({ ...currentPlayer });

  state.status = 'sold';
  state.auctionLog.push(
    `${currentPlayer.name} SOLD to ${winningTeam.teamName} for $${currentHighestBid.amount}K`
  );

  broadcastTournamentEvent(code, {
    type: 'player_sold',
    payload: { auctionState: state, teams: serializeTeams(tournament) },
    timestamp: new Date().toISOString(),
  });

  // Auto-advance after 2s
  setTimeout(() => advanceToNextPlayer(code), 2000);

  return state;
}

export function markUnsold(code: string, userId: string): AuctionState {
  const tournament = getTournament(code);
  if (!tournament) throw new Error('Tournament not found');
  if (tournament.createdBy !== userId) throw new Error('Only the host can mark unsold');

  const state = tournament.auctionState;
  if (state.status !== 'player_up') throw new Error('No active player');

  const { currentPlayer } = state;
  if (!currentPlayer) throw new Error('No current player');

  state.status = 'unsold';
  state.auctionLog.push(`${currentPlayer.name} went UNSOLD`);

  broadcastTournamentEvent(code, {
    type: 'player_unsold',
    payload: { auctionState: state, teams: serializeTeams(tournament) },
    timestamp: new Date().toISOString(),
  });

  // Auto-advance after 2s
  setTimeout(() => advanceToNextPlayer(code), 2000);

  return state;
}

function advanceToNextPlayer(code: string): void {
  const tournament = getTournament(code);
  if (!tournament) return;

  const state = tournament.auctionState;
  const nextIndex = state.currentPlayerIndex + 1;

  if (nextIndex >= state.playerQueue.length) {
    // Auction complete
    state.status = 'completed';
    state.currentPlayer = null;
    state.currentHighestBid = null;
    state.auctionLog.push('Auction completed!');
    tournament.status = 'completed';

    broadcastTournamentEvent(code, {
      type: 'auction_complete',
      payload: { auctionState: state, teams: serializeTeams(tournament) },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  state.currentPlayerIndex = nextIndex;
  const nextPlayerId = state.playerQueue[nextIndex];
  const nextPlayer = tournament.players.get(nextPlayerId) ?? null;
  state.currentPlayer = nextPlayer;
  state.currentHighestBid = null;
  state.bidHistory = [];
  state.status = 'player_up';
  state.auctionLog.push(`Next player: ${nextPlayer?.name}`);

  broadcastTournamentEvent(code, {
    type: 'auction_update',
    payload: { auctionState: state, teams: serializeTeams(tournament) },
    timestamp: new Date().toISOString(),
  });
}

export function resetAuction(code: string, userId: string): AuctionState {
  const tournament = getTournament(code);
  if (!tournament) throw new Error('Tournament not found');
  if (tournament.createdBy !== userId) throw new Error('Only the host can reset');

  // Reset all players
  for (const player of tournament.players.values()) {
    player.isSold = false;
    player.soldTo = undefined;
    player.soldFor = undefined;
  }

  // Reset all team budgets and players
  for (const team of tournament.teams.values()) {
    team.remainingBudget = team.initialBudget;
    team.players = [];
  }

  const playerQueue = SEEDED_PLAYERS.map((p) => p.id);
  const state: AuctionState = {
    status: 'lobby',
    currentPlayerIndex: 0,
    currentPlayer: null,
    currentHighestBid: null,
    bidHistory: [],
    playerQueue,
    auctionLog: ['Auction reset by host'],
  };

  tournament.auctionState = state;
  tournament.status = 'lobby';

  broadcastTournamentEvent(code, {
    type: 'state_update',
    payload: { auctionState: state, teams: serializeTeams(tournament) },
    timestamp: new Date().toISOString(),
  });

  return state;
}

export function rerunUnsoldAuction(code: string, userId: string): AuctionState {
  const tournament = getTournament(code);
  if (!tournament) throw new Error('Tournament not found');
  if (tournament.createdBy !== userId) throw new Error('Only the host can re-run the auction');
  if (tournament.auctionState.status !== 'completed') throw new Error('Auction must be completed first');
  if (tournament.closed) throw new Error('Auction is already closed');

  const unsoldPlayerIds = Array.from(tournament.players.values())
    .filter((p) => !p.isSold)
    .map((p) => p.id);

  if (unsoldPlayerIds.length === 0) throw new Error('No unsold players to re-run');

  const state = tournament.auctionState;
  const firstPlayer = tournament.players.get(unsoldPlayerIds[0]) ?? null;

  state.playerQueue = unsoldPlayerIds;
  state.currentPlayerIndex = 0;
  state.currentPlayer = firstPlayer;
  state.currentHighestBid = null;
  state.bidHistory = [];
  state.status = 'player_up';
  state.auctionLog.push(`Re-run started for ${unsoldPlayerIds.length} unsold players`);
  tournament.status = 'active';

  broadcastTournamentEvent(code, {
    type: 'auction_update',
    payload: { auctionState: state, teams: serializeTeams(tournament) },
    timestamp: new Date().toISOString(),
  });

  return state;
}

export function closeAuction(code: string, userId: string): AuctionState {
  const tournament = getTournament(code);
  if (!tournament) throw new Error('Tournament not found');
  if (tournament.createdBy !== userId) throw new Error('Only the host can close the auction');
  if (tournament.auctionState.status !== 'completed') throw new Error('Auction must be completed first');

  tournament.closed = true;

  // Clear activeTournamentCode for all teams
  const store = getStore();
  for (const team of tournament.teams.values()) {
    const user = store.users.get(team.userId);
    if (user) user.activeTournamentCode = undefined;
  }

  tournament.auctionState.auctionLog.push('Auction closed by host');

  broadcastTournamentEvent(code, {
    type: 'state_update',
    payload: { auctionState: tournament.auctionState, teams: serializeTeams(tournament) },
    timestamp: new Date().toISOString(),
  });

  return tournament.auctionState;
}

export function importMatch(code: string, userId: string, match: Match): TournamentMatchResult {
  const tournament = getTournament(code);
  if (!tournament) throw new Error('Tournament not found');
  if (tournament.createdBy !== userId) throw new Error('Only the host can import match results');
  if (tournament.status !== 'completed') throw new Error('Tournament must be completed first');

  // Build a name→teamId lookup
  const playerTeamMap = new Map<string, string>(); // playerName.lower → teamId
  for (const team of tournament.teams.values()) {
    for (const p of team.players) {
      playerTeamMap.set(p.name.toLowerCase(), team.id);
    }
  }

  // Build per-team performance lists
  const teamPerformances = new Map<string, typeof match.performances>();
  for (const team of tournament.teams.values()) {
    teamPerformances.set(team.id, []);
  }

  // Unowned player scores (teamId undefined)
  const unownedScores: PlayerPoints[] = [];

  for (const perf of match.performances) {
    const teamId = playerTeamMap.get(perf.playerName.toLowerCase());
    if (teamId) {
      teamPerformances.get(teamId)!.push(perf);
    } else {
      const points = calculatePlayerPoints(perf);
      unownedScores.push(points);
    }
  }

  const teamScores = Array.from(tournament.teams.values()).map((team) => {
    const perfs = teamPerformances.get(team.id) ?? [];
    return calculateTeamScore(team, perfs);
  });

  teamScores.sort((a, b) => b.totalPoints - a.totalPoints);

  const result: TournamentMatchResult = {
    match,
    teamScores,
    importedAt: new Date().toISOString(),
  };

  if (!tournament.matchResults) tournament.matchResults = [];
  tournament.matchResults.push(result);

  broadcastTournamentEvent(code, {
    type: 'state_update',
    payload: { auctionState: tournament.auctionState, teams: serializeTeams(tournament) },
    timestamp: new Date().toISOString(),
  });

  return result;
}

// ── Bid helpers ───────────────────────────────────────────────────────────────

export function placeBid(code: string, userId: string, amount: number): Bid {
  const tournament = getTournament(code);
  if (!tournament) throw new Error('Tournament not found');

  const state = tournament.auctionState;
  if (state.status !== 'player_up') throw new Error('No active auction');
  if (!state.currentPlayer) throw new Error('No current player');

  // Find team for this user
  let team: Team | undefined;
  for (const t of tournament.teams.values()) {
    if (t.userId === userId) {
      team = t;
      break;
    }
  }
  if (!team) throw new Error('Not a participant in this tournament');

  // Validate bid amount
  if (!state.currentHighestBid) {
    if (amount < state.currentPlayer.basePrice) {
      throw new Error(`Minimum bid is $${state.currentPlayer.basePrice}K`);
    }
  } else {
    const minBid = state.currentHighestBid.amount + 25;
    if (amount < minBid) {
      throw new Error(`Minimum increment is $25K. Minimum bid: $${minBid}K`);
    }
    if (state.currentHighestBid.userId === userId) {
      throw new Error('You already have the highest bid');
    }
  }

  // Check budget (amount is in thousands/K, budget is in millions/M)
  const amountInMillions = amount / 100;
  if (amountInMillions > team.remainingBudget) {
    throw new Error(`Insufficient budget. You have $${team.remainingBudget}M remaining`);
  }

  const bid: Bid = {
    id: generateId(),
    teamId: team.id,
    teamName: team.teamName,
    userId,
    playerId: state.currentPlayer.id,
    amount,
    timestamp: new Date(),
  };

  state.currentHighestBid = bid;
  state.bidHistory.push(bid);
  state.auctionLog.push(`${team.teamName} bid $${amount}K for ${state.currentPlayer.name}`);

  broadcastTournamentEvent(code, {
    type: 'bid_placed',
    payload: { auctionState: state, teams: serializeTeams(tournament) },
    timestamp: new Date().toISOString(),
  });

  return bid;
}

// ── SSE broadcasting ──────────────────────────────────────────────────────────

export function broadcastTournamentEvent(code: string, event: TournamentEvent): void {
  const clients = getSseClients().get(code);
  if (!clients || clients.size === 0) return;

  const data = `data: ${JSON.stringify(event)}\n\n`;
  const deadClients: ReadableStreamDefaultController[] = [];

  for (const controller of clients) {
    try {
      controller.enqueue(new TextEncoder().encode(data));
    } catch {
      deadClients.push(controller);
    }
  }

  for (const dead of deadClients) {
    clients.delete(dead);
  }
}

// ── Serialization helpers ─────────────────────────────────────────────────────

export function serializeTeams(tournament: Tournament): Record<string, Omit<Team, 'players'> & { players: TournamentPlayer[] }> {
  const result: Record<string, Omit<Team, 'players'> & { players: TournamentPlayer[] }> = {};
  for (const [id, team] of tournament.teams) {
    result[id] = { ...team, players: team.players };
  }
  return result;
}

export function serializeTournament(tournament: Tournament) {
  return {
    ...tournament,
    teams: serializeTeams(tournament),
    players: Object.fromEntries(tournament.players),
  };
}
