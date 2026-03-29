import {
  User, Tournament, Team, TournamentPlayer, Bid, AuctionState,
  Match, TournamentMatchResult, Player, PlayerPoints,
} from './types';
import { calculatePlayerPoints, calculateTeamScore } from './scoring';
import { db } from './db';
import crypto from 'crypto';

// ── ID helpers ─────────────────────────────────────────────────────────────

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

// ── DB row → domain type mappers ──────────────────────────────────────────

function mapDbPlayer(p: {
  id: string; name: string; role: string; base_price: number;
  nationality: string; is_active: boolean;
}): Player {
  return {
    id: p.id,
    name: p.name,
    role: p.role as Player['role'],
    nationality: p.nationality as Player['nationality'],
    basePrice: p.base_price,
  };
}

// ── Tournament assembly ───────────────────────────────────────────────────

async function loadTournament(code: string): Promise<Tournament | null> {
  const { data: t } = await db
    .from('tournaments')
    .select('*')
    .eq('code', code)
    .single();
  if (!t) return null;

  const { data: teamsData } = await db
    .from('teams')
    .select('*')
    .eq('tournament_code', code);

  const teamIds = (teamsData ?? []).map((row: { team_id: string }) => row.team_id);

  const { data: tpData } = teamIds.length > 0
    ? await db.from('team_players').select('*').in('team_id', teamIds)
    : { data: [] };

  const { data: playersData } = await db
    .from('players')
    .select('*')
    .eq('is_active', true);

  // Build player lookup
  const playerById: Record<string, Player> = {};
  for (const p of playersData ?? []) {
    playerById[p.id] = mapDbPlayer(p);
  }

  // Build sold index
  const soldToTeam: Record<string, string> = {};
  const soldForPrice: Record<string, number> = {};
  for (const tp of tpData ?? []) {
    soldToTeam[tp.player_id] = tp.team_id;
    soldForPrice[tp.player_id] = tp.bought_at;
  }

  // Build teams Record
  const teams: Record<string, Team> = {};
  for (const team of teamsData ?? []) {
    const teamPlayerRows = (tpData ?? []).filter(
      (tp: { team_id: string }) => tp.team_id === team.team_id
    );
    const teamPlayers: TournamentPlayer[] = teamPlayerRows
      .filter((tp: { player_id: string }) => playerById[tp.player_id])
      .map((tp: { player_id: string; bought_at: number }) => ({
        ...playerById[tp.player_id],
        isSold: true,
        soldTo: team.team_id,
        soldFor: tp.bought_at,
      }));

    teams[team.team_id] = {
      id: team.team_id,
      teamName: team.name,
      userId: team.owner_id,
      tournamentCode: code,
      initialBudget: t.team_budget,
      remainingBudget: team.budget,
      players: teamPlayers,
      registeredAt: new Date(team.created_at ?? Date.now()),
    };
  }

  // Build players Record with sold status
  const players: Record<string, TournamentPlayer> = {};
  for (const p of playersData ?? []) {
    players[p.id] = {
      ...playerById[p.id],
      isSold: p.id in soldToTeam,
      soldTo: soldToTeam[p.id],
      soldFor: soldForPrice[p.id],
    };
  }

  return {
    id: t.tournament_id,
    code: t.code,
    name: t.name,
    createdBy: t.created_by,
    status: t.status,
    teamBudget: t.team_budget,
    maxTeams: t.max_teams,
    teams,
    players,
    auctionState: t.auction_state as AuctionState,
    createdAt: new Date(t.created_at),
    closed: t.closed,
    matchResults: (t.match_results ?? []) as TournamentMatchResult[],
  };
}

async function saveAuctionState(
  code: string,
  auctionState: AuctionState,
  status?: string,
  closed?: boolean,
  matchResults?: TournamentMatchResult[]
): Promise<void> {
  const update: Record<string, unknown> = { auction_state: auctionState };
  if (status !== undefined) update.status = status;
  if (closed !== undefined) update.closed = closed;
  if (matchResults !== undefined) update.match_results = matchResults;
  await db.from('tournaments').update(update).eq('code', code);
}

// ── Auth helpers ──────────────────────────────────────────────────────────

export async function registerUser(username: string, passwordHash: string): Promise<User> {
  const { data: existing } = await db
    .from('users')
    .select('user_id')
    .eq('username', username.toLowerCase())
    .single();
  if (existing) throw new Error('Username already taken');

  const userId = generateId();
  const { error } = await db.from('users').insert({
    user_id: userId,
    username,
    password_hash: passwordHash,
  });
  if (error) throw new Error(error.message);

  return {
    id: userId,
    username,
    passwordHash,
    createdAt: new Date(),
  };
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const { data } = await db
    .from('users')
    .select('*')
    .eq('username', username.toLowerCase())
    .single();
  if (!data) return null;
  return {
    id: data.user_id,
    username: data.username,
    passwordHash: data.password_hash,
    createdAt: new Date(data.created_at),
    activeTournamentCode: data.active_tournament_code ?? undefined,
  };
}

export async function getUserById(userId: string): Promise<User | undefined> {
  const { data } = await db
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (!data) return undefined;
  return {
    id: data.user_id,
    username: data.username,
    passwordHash: data.password_hash,
    createdAt: new Date(data.created_at),
    activeTournamentCode: data.active_tournament_code ?? undefined,
  };
}

// ── Player helpers ────────────────────────────────────────────────────────

export async function getPlayers(): Promise<TournamentPlayer[]> {
  const { data } = await db.from('players').select('*').eq('is_active', true);
  return (data ?? []).map((p) => ({ ...mapDbPlayer(p), isSold: false }));
}

// ── Tournament helpers ────────────────────────────────────────────────────

export async function createTournament(
  userId: string,
  name: string,
  teamBudget: number,
  maxTeams: number
): Promise<Tournament> {
  const user = await getUserById(userId);
  if (!user) throw new Error('User not found');
  if (user.activeTournamentCode) throw new Error('Already in an active tournament');

  const { data: playersData } = await db
    .from('players')
    .select('id')
    .eq('is_active', true);
  const playerQueue = (playersData ?? []).map((p: { id: string }) => p.id);

  // Generate unique code
  let code = generateTournamentCode();
  while (true) {
    const { data } = await db.from('tournaments').select('code').eq('code', code).single();
    if (!data) break;
    code = generateTournamentCode();
  }

  const tournamentId = generateId();
  const auctionState: AuctionState = {
    status: 'lobby',
    currentPlayerIndex: 0,
    currentPlayer: null,
    currentHighestBid: null,
    bidHistory: [],
    playerQueue,
    auctionLog: [],
  };

  const { error: tErr } = await db.from('tournaments').insert({
    code,
    tournament_id: tournamentId,
    name,
    created_by: userId,
    status: 'lobby',
    closed: false,
    team_budget: teamBudget,
    max_teams: maxTeams,
    auction_state: auctionState,
    match_results: [],
  });
  if (tErr) throw new Error(`DB insert failed (tournaments): ${tErr.message}`);

  const teamId = generateId();
  const { error: teamErr } = await db.from('teams').insert({
    team_id: teamId,
    tournament_code: code,
    owner_id: userId,
    name: `${user.username}'s Team`,
    initial_budget: teamBudget,
    budget: teamBudget,
  });
  if (teamErr) throw new Error(`DB insert failed (teams): ${teamErr.message}`);

  await db.from('users').update({ active_tournament_code: code }).eq('user_id', userId);

  const tournament = await loadTournament(code);
  if (!tournament) throw new Error('Tournament created but could not be loaded — check DB permissions');
  return tournament;
}

export async function joinTournament(userId: string, code: string, teamName: string): Promise<Team> {
  const user = await getUserById(userId);
  if (!user) throw new Error('User not found');
  if (user.activeTournamentCode) throw new Error('Already in an active tournament');

  const tournament = await loadTournament(code);
  if (!tournament) throw new Error('Tournament not found');
  if (tournament.status !== 'lobby') throw new Error('Tournament already started');
  if (Object.keys(tournament.teams).length >= tournament.maxTeams) {
    throw new Error('Tournament is full');
  }
  const alreadyIn = Object.values(tournament.teams).some(t => t.userId === userId);
  if (alreadyIn) throw new Error('Already in this tournament');

  const teamId = generateId();
  await db.from('teams').insert({
    team_id: teamId,
    tournament_code: code,
    owner_id: userId,
    name: teamName,
    initial_budget: tournament.teamBudget,
    budget: tournament.teamBudget,
  });

  await db.from('users').update({ active_tournament_code: code }).eq('user_id', userId);

  return {
    id: teamId,
    teamName,
    userId,
    tournamentCode: code,
    initialBudget: tournament.teamBudget,
    remainingBudget: tournament.teamBudget,
    players: [],
    registeredAt: new Date(),
  };
}

export async function leaveTournament(userId: string, code: string): Promise<void> {
  const tournament = await loadTournament(code);
  if (!tournament) throw new Error('Tournament not found');
  if (tournament.status !== 'lobby') throw new Error('Cannot leave an active tournament');
  if (tournament.createdBy === userId) throw new Error('Host cannot leave the tournament');

  const team = Object.values(tournament.teams).find(t => t.userId === userId);
  if (!team) throw new Error('Not in this tournament');

  await db.from('teams').delete().eq('team_id', team.id);
  await db.from('users').update({ active_tournament_code: null }).eq('user_id', userId);
}

export async function getTournament(code: string): Promise<Tournament | null> {
  return loadTournament(code);
}

export async function listTournaments(): Promise<Tournament[]> {
  const { data } = await db
    .from('tournaments')
    .select('code')
    .order('created_at', { ascending: false });
  if (!data) return [];

  const tournaments = await Promise.all(
    data.map((row: { code: string }) => loadTournament(row.code))
  );
  return tournaments.filter((t): t is Tournament => t !== null);
}

// ── Auction helpers ───────────────────────────────────────────────────────

export async function startAuction(code: string, userId: string): Promise<AuctionState> {
  const tournament = await loadTournament(code);
  if (!tournament) throw new Error('Tournament not found');
  if (tournament.createdBy !== userId) throw new Error('Only the host can start the auction');
  if (tournament.auctionState.status !== 'lobby') throw new Error('Auction already started');
  if (Object.keys(tournament.teams).length < 2) throw new Error('Need at least 2 teams to start');

  const state = tournament.auctionState;
  const firstPlayerId = state.playerQueue[0];
  const firstPlayer = tournament.players[firstPlayerId] ?? null;

  state.status = 'player_up';
  state.currentPlayer = firstPlayer;
  state.currentPlayerIndex = 0;
  state.currentHighestBid = null;
  state.bidHistory = [];
  state.auctionLog.push(`Auction started! First player: ${firstPlayer?.name}`);

  await saveAuctionState(code, state, 'active');
  return state;
}

export async function markSold(code: string, userId: string): Promise<AuctionState> {
  const tournament = await loadTournament(code);
  if (!tournament) throw new Error('Tournament not found');
  if (tournament.createdBy !== userId) throw new Error('Only the host can mark sold');

  const state = tournament.auctionState;
  if (state.status !== 'player_up') throw new Error('No active player');
  if (!state.currentHighestBid) throw new Error('No bids placed');
  if (!state.currentPlayer) throw new Error('No current player');

  const { currentPlayer, currentHighestBid } = state;
  const winningTeam = tournament.teams[currentHighestBid.teamId];
  if (!winningTeam) throw new Error('Winning team not found');

  // Update team budget in DB
  const costInMillions = currentHighestBid.amount / 100;
  const newBudget = Math.round((winningTeam.remainingBudget - costInMillions) * 100) / 100;
  await db.from('teams').update({ budget: newBudget }).eq('team_id', winningTeam.id);

  // Record player as sold in team_players
  await db.from('team_players').insert({
    team_id: winningTeam.id,
    player_id: currentPlayer.id,
    bought_at: currentHighestBid.amount,
  });

  state.auctionLog.push(
    `${currentPlayer.name} SOLD to ${winningTeam.teamName} for $${currentHighestBid.amount}K`
  );

  // Advance to next player (returns true if auction completed)
  const completed = advanceState(state, tournament.players);
  await saveAuctionState(code, state, completed ? 'completed' : 'active');

  return state;
}

export async function markUnsold(code: string, userId: string): Promise<AuctionState> {
  const tournament = await loadTournament(code);
  if (!tournament) throw new Error('Tournament not found');
  if (tournament.createdBy !== userId) throw new Error('Only the host can mark unsold');

  const state = tournament.auctionState;
  if (state.status !== 'player_up') throw new Error('No active player');
  if (!state.currentPlayer) throw new Error('No current player');

  state.auctionLog.push(`${state.currentPlayer.name} went UNSOLD`);

  // Advance to next player (returns true if auction completed)
  const completed = advanceState(state, tournament.players);
  await saveAuctionState(code, state, completed ? 'completed' : 'active');

  return state;
}

// Internal: mutates state to advance to next player (or complete).
// Returns true if the auction is now completed.
function advanceState(state: AuctionState, players: Record<string, TournamentPlayer>): boolean {
  const nextIndex = state.currentPlayerIndex + 1;
  if (nextIndex >= state.playerQueue.length) {
    state.status = 'completed';
    state.currentPlayer = null;
    state.currentHighestBid = null;
    state.auctionLog.push('Auction completed!');
    return true;
  }
  state.currentPlayerIndex = nextIndex;
  const nextPlayerId = state.playerQueue[nextIndex];
  state.currentPlayer = players[nextPlayerId] ?? null;
  state.currentHighestBid = null;
  state.bidHistory = [];
  state.status = 'player_up';
  state.auctionLog.push(`Next player: ${state.currentPlayer?.name}`);
  return false;
}

export async function resetAuction(code: string, userId: string): Promise<AuctionState> {
  const tournament = await loadTournament(code);
  if (!tournament) throw new Error('Tournament not found');
  if (tournament.createdBy !== userId) throw new Error('Only the host can reset');

  // Delete all team_players for this tournament
  const teamIds = Object.keys(tournament.teams);
  if (teamIds.length > 0) {
    await db.from('team_players').delete().in('team_id', teamIds);
  }

  // Reset all team budgets
  for (const team of Object.values(tournament.teams)) {
    await db.from('teams').update({ budget: team.initialBudget }).eq('team_id', team.id);
  }

  const { data: playersData } = await db
    .from('players')
    .select('id')
    .eq('is_active', true);
  const playerQueue = (playersData ?? []).map((p: { id: string }) => p.id);

  const state: AuctionState = {
    status: 'lobby',
    currentPlayerIndex: 0,
    currentPlayer: null,
    currentHighestBid: null,
    bidHistory: [],
    playerQueue,
    auctionLog: ['Auction reset by host'],
  };

  await saveAuctionState(code, state, 'lobby');
  return state;
}

export async function rerunUnsoldAuction(code: string, userId: string): Promise<AuctionState> {
  const tournament = await loadTournament(code);
  if (!tournament) throw new Error('Tournament not found');
  if (tournament.createdBy !== userId) throw new Error('Only the host can re-run the auction');
  if (tournament.auctionState.status !== 'completed') throw new Error('Auction must be completed first');
  if (tournament.closed) throw new Error('Auction is already closed');

  const unsoldPlayerIds = Object.values(tournament.players)
    .filter(p => !p.isSold)
    .map(p => p.id);
  if (unsoldPlayerIds.length === 0) throw new Error('No unsold players to re-run');

  const firstPlayer = tournament.players[unsoldPlayerIds[0]] ?? null;
  const state = tournament.auctionState;
  state.playerQueue = unsoldPlayerIds;
  state.currentPlayerIndex = 0;
  state.currentPlayer = firstPlayer;
  state.currentHighestBid = null;
  state.bidHistory = [];
  state.status = 'player_up';
  state.auctionLog.push(`Re-run started for ${unsoldPlayerIds.length} unsold players`);

  await saveAuctionState(code, state, 'active');
  return state;
}

export async function closeAuction(code: string, userId: string): Promise<AuctionState> {
  const tournament = await loadTournament(code);
  if (!tournament) throw new Error('Tournament not found');
  if (tournament.createdBy !== userId) throw new Error('Only the host can close the auction');
  if (tournament.auctionState.status !== 'completed') throw new Error('Auction must be completed first');

  await db.from('tournaments').update({ closed: true }).eq('code', code);

  // Clear activeTournamentCode for all participants
  const ownerIds = Object.values(tournament.teams).map(t => t.userId);
  if (ownerIds.length > 0) {
    await db.from('users').update({ active_tournament_code: null }).in('user_id', ownerIds);
  }

  tournament.auctionState.auctionLog.push('Auction closed by host');
  await saveAuctionState(code, tournament.auctionState);

  return tournament.auctionState;
}

// ── Match scoring ─────────────────────────────────────────────────────────

export async function importMatch(
  code: string,
  userId: string,
  match: Match
): Promise<TournamentMatchResult> {
  const tournament = await loadTournament(code);
  if (!tournament) throw new Error('Tournament not found');
  if (tournament.createdBy !== userId) throw new Error('Only the host can import match results');
  if (tournament.status !== 'completed') throw new Error('Tournament must be completed first');
  if ((tournament.matchResults ?? []).some(r => r.match.id === match.id)) {
    throw new Error('This match has already been imported');
  }

  // Build name→teamId lookup
  const playerTeamMap = new Map<string, string>();
  for (const team of Object.values(tournament.teams)) {
    for (const p of team.players) {
      playerTeamMap.set(p.name.toLowerCase(), team.id);
    }
  }

  const teamPerformances = new Map<string, typeof match.performances>();
  for (const team of Object.values(tournament.teams)) {
    teamPerformances.set(team.id, []);
  }

  const unownedScores: PlayerPoints[] = [];
  for (const perf of match.performances) {
    const teamId = playerTeamMap.get(perf.playerName.toLowerCase());
    if (teamId) {
      teamPerformances.get(teamId)!.push(perf);
    } else {
      unownedScores.push(calculatePlayerPoints(perf));
    }
  }

  const teamScores = Object.values(tournament.teams).map(team => {
    const perfs = teamPerformances.get(team.id) ?? [];
    return calculateTeamScore(team, perfs);
  });
  teamScores.sort((a, b) => b.totalPoints - a.totalPoints);

  const result: TournamentMatchResult = {
    match,
    teamScores,
    importedAt: new Date().toISOString(),
  };

  const matchResults = [...(tournament.matchResults ?? []), result];
  await saveAuctionState(code, tournament.auctionState, undefined, undefined, matchResults);

  return result;
}

// ── Bid helpers ───────────────────────────────────────────────────────────

export async function placeBid(code: string, userId: string, amount: number): Promise<Bid> {
  const tournament = await loadTournament(code);
  if (!tournament) throw new Error('Tournament not found');

  const state = tournament.auctionState;
  if (state.status !== 'player_up') throw new Error('No active auction');
  if (!state.currentPlayer) throw new Error('No current player');

  const team = Object.values(tournament.teams).find(t => t.userId === userId);
  if (!team) throw new Error('Not a participant in this tournament');

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

  await saveAuctionState(code, state);
  return bid;
}

// ── Serialization helpers ─────────────────────────────────────────────────

export function serializeTournament(tournament: Tournament) {
  return {
    ...tournament,
    teams: tournament.teams,
    players: tournament.players,
    createdAt: tournament.createdAt instanceof Date
      ? tournament.createdAt.toISOString()
      : tournament.createdAt,
  };
}
