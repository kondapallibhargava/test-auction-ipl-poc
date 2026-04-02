export interface User {
  id: string;
  username: string;
  passwordHash: string;
  email?: string;
  createdAt: Date;
  activeTournamentCode?: string;
  isAdmin: boolean;
}

export interface Player {
  id: string;
  name: string;
  role: 'Batsman' | 'Bowler' | 'All-Rounder' | 'Wicket-Keeper';
  nationality: 'Indian' | 'Overseas';
  basePrice: number; // in thousands (K)
  imageUrl?: string;
}

export interface TournamentPlayer extends Player {
  isSold: boolean;
  soldTo?: string; // teamId
  soldFor?: number; // in thousands (K)
}

export interface Team {
  id: string;
  teamName: string;
  userId: string;
  tournamentCode: string;
  initialBudget: number; // in millions (M)
  remainingBudget: number; // in millions (M)
  players: TournamentPlayer[];
  registeredAt: Date;
}

export interface Bid {
  id: string;
  teamId: string;
  teamName: string;
  userId: string;
  playerId: string;
  amount: number; // in thousands (K)
  timestamp: Date;
}

export type AuctionStatus = 'lobby' | 'player_up' | 'sold' | 'unsold' | 'completed';

export interface AuctionState {
  status: AuctionStatus;
  currentPlayerIndex: number;
  currentPlayer: TournamentPlayer | null;
  currentHighestBid: Bid | null;
  bidHistory: Bid[];
  playerQueue: string[]; // player ids in order
  auctionLog: string[];
}

export interface Tournament {
  id: string;
  code: string; // e.g. "IPL-4X9K"
  name: string;
  createdBy: string; // userId
  status: 'lobby' | 'active' | 'completed';
  teamBudget: number; // in millions (M), per team
  maxTeams: number;
  teams: Record<string, Team>; // teamId -> Team
  players: Record<string, TournamentPlayer>; // playerId -> TournamentPlayer
  auctionState: AuctionState;
  createdAt: Date;
  closed?: boolean;
  matchResults?: TournamentMatchResult[];
}

// ── Fantasy scoring types ─────────────────────────────────────────────────────

export interface BattingPerformance {
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  dismissed: boolean; // false = not out
}

export interface BowlingPerformance {
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
}

export interface FieldingPerformance {
  catches: number;
  stumpings: number;
  runOuts: number;
}

export interface PlayerMatchPerformance {
  playerName: string; // matched by name against tournament roster
  batting?: BattingPerformance;
  bowling?: BowlingPerformance;
  fielding?: FieldingPerformance;
}

export interface Match {
  id: string;
  title: string; // "MI vs CSK, IPL 2024, Match 1"
  date: string;
  venue?: string;
  sourceUrl?: string; // ESPN Cricinfo URL placeholder
  performances: PlayerMatchPerformance[];
}

export interface PlayerPoints {
  playerName: string;
  teamId?: string; // set if player was bought by a team
  batting: number;
  bowling: number;
  fielding: number;
  total: number;
  breakdown: string[]; // ["Runs: 73 → 73pts", "50+ bonus → 8pts", ...]
}

export interface TeamMatchScore {
  teamId: string;
  teamName: string;
  totalPoints: number;
  playerScores: PlayerPoints[];
}

export interface TournamentMatchResult {
  match: Match;
  teamScores: TeamMatchScore[]; // sorted by totalPoints desc
  importedAt: string;
}

export interface Session {
  userId: string;
  username: string;
  isAdmin: boolean;
}

export interface TournamentEvent {
  type: 'state_update' | 'auction_update' | 'bid_placed' | 'player_sold' | 'player_unsold' | 'auction_complete' | 'team_joined' | 'team_left';
  payload: {
    auctionState?: AuctionState;
    teams?: Record<string, Omit<Team, 'players'> & { players: TournamentPlayer[] }>;
    message?: string;
  };
  timestamp: string;
}
