import { Match } from './types';

export function getSampleScorecard(): Match {
  return {
    id: 'sample-stars-vs-legends-ipl2024-m1',
    title: 'Stars XI vs Legends XI, IPL 2024, Match 1',
    date: '2024-04-07',
    venue: 'Wankhede Stadium, Mumbai',
    performances: [
      // ── Stars XI batting ──────────────────────────────────────────────────
      {
        playerName: 'Virat Kohli',
        batting: { runs: 73, balls: 45, fours: 8, sixes: 2, dismissed: false },
      },
      {
        playerName: 'Rohit Sharma',
        batting: { runs: 45, balls: 32, fours: 5, sixes: 1, dismissed: false },
      },
      {
        playerName: 'Shubman Gill',
        batting: { runs: 28, balls: 20, fours: 3, sixes: 0, dismissed: false },
      },
      {
        playerName: 'Suryakumar Yadav',
        batting: { runs: 51, balls: 28, fours: 4, sixes: 3, dismissed: false },
      },
      {
        playerName: 'KL Rahul',
        batting: { runs: 12, balls: 10, fours: 1, sixes: 0, dismissed: true },
        fielding: { catches: 0, stumpings: 1, runOuts: 0 },
      },
      {
        playerName: 'Hardik Pandya',
        batting: { runs: 22, balls: 15, fours: 2, sixes: 1, dismissed: true },
        fielding: { catches: 1, stumpings: 0, runOuts: 0 },
      },
      {
        playerName: 'Glenn Maxwell',
        batting: { runs: 0, balls: 2, fours: 0, sixes: 0, dismissed: true },
      },
      {
        playerName: 'David Warner',
        batting: { runs: 38, balls: 25, fours: 4, sixes: 1, dismissed: false },
      },
      // ── Stars XI bowling ──────────────────────────────────────────────────
      {
        playerName: 'Jasprit Bumrah',
        bowling: { overs: 4, maidens: 0, runs: 22, wickets: 3 },
      },
      {
        playerName: 'Mohammed Siraj',
        bowling: { overs: 4, maidens: 0, runs: 38, wickets: 1 },
      },
      {
        playerName: 'Axar Patel',
        bowling: { overs: 4, maidens: 1, runs: 25, wickets: 2 },
      },
      {
        playerName: 'Yuzvendra Chahal',
        bowling: { overs: 4, maidens: 0, runs: 35, wickets: 2 },
      },
      // ── Legends XI batting ────────────────────────────────────────────────
      {
        playerName: 'Jos Buttler',
        batting: { runs: 82, balls: 50, fours: 7, sixes: 4, dismissed: false },
      },
      {
        playerName: 'Faf du Plessis',
        batting: { runs: 34, balls: 22, fours: 3, sixes: 1, dismissed: false },
      },
      {
        playerName: 'Nicholas Pooran',
        batting: { runs: 15, balls: 12, fours: 1, sixes: 1, dismissed: true },
      },
      {
        playerName: 'MS Dhoni',
        batting: { runs: 19, balls: 10, fours: 1, sixes: 1, dismissed: true },
        fielding: { catches: 2, stumpings: 1, runOuts: 0 },
      },
      {
        playerName: 'Pat Cummins',
        batting: { runs: 8, balls: 5, fours: 1, sixes: 0, dismissed: true },
        bowling: { overs: 4, maidens: 0, runs: 42, wickets: 2 },
      },
      // ── Legends XI bowling ────────────────────────────────────────────────
      {
        playerName: 'Rashid Khan',
        bowling: { overs: 4, maidens: 1, runs: 28, wickets: 3 },
      },
      {
        playerName: 'Mitchell Starc',
        bowling: { overs: 4, maidens: 0, runs: 48, wickets: 1 },
      },
      {
        playerName: 'Ravindra Jadeja',
        bowling: { overs: 4, maidens: 1, runs: 30, wickets: 1 },
        fielding: { catches: 0, stumpings: 0, runOuts: 1 },
      },
    ],
  };
}

export async function fetchFromESPNCricinfo(_url: string): Promise<Match> {
  throw new Error(
    'ESPN Cricinfo import is not yet implemented. Use the sample scorecard for now.'
  );
}
