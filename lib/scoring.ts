import {
  PlayerMatchPerformance,
  PlayerPoints,
  TeamMatchScore,
  Team,
} from './types';

export function calculatePlayerPoints(perf: PlayerMatchPerformance): PlayerPoints {
  const breakdown: string[] = [];
  let batting = 0;
  let bowling = 0;
  let fielding = 0;

  if (perf.batting) {
    const b = perf.batting;
    const runsPoints = b.runs;
    batting += runsPoints;
    if (runsPoints > 0) breakdown.push(`Runs: ${b.runs} → ${runsPoints}pts`);

    const foursPoints = b.fours;
    batting += foursPoints;
    if (foursPoints > 0) breakdown.push(`Fours: ${b.fours} → ${foursPoints}pts`);

    const sixesPoints = b.sixes * 2;
    batting += sixesPoints;
    if (sixesPoints > 0) breakdown.push(`Sixes: ${b.sixes} → ${sixesPoints}pts`);

    if (b.runs >= 30) {
      batting += 4;
      breakdown.push('30+ bonus → 4pts');
    }
    if (b.runs >= 50) {
      batting += 8;
      breakdown.push('50+ bonus → 8pts');
    }
    if (b.runs >= 100) {
      batting += 16;
      breakdown.push('100+ bonus → 16pts');
    }
    if (b.dismissed && b.runs === 0) {
      batting -= 2;
      breakdown.push('Duck → -2pts');
    }
  }

  if (perf.bowling) {
    const b = perf.bowling;
    const wicketPoints = b.wickets * 25;
    bowling += wicketPoints;
    if (wicketPoints > 0) breakdown.push(`Wickets: ${b.wickets} → ${wicketPoints}pts`);

    const maidenPoints = b.maidens * 4;
    bowling += maidenPoints;
    if (maidenPoints > 0) breakdown.push(`Maidens: ${b.maidens} → ${maidenPoints}pts`);

    if (b.wickets >= 2) {
      bowling += 8;
      breakdown.push('2+ wickets bonus → 8pts');
    }
    if (b.wickets >= 3) {
      bowling += 16;
      breakdown.push('3+ wickets bonus → 16pts');
    }
  }

  if (perf.fielding) {
    const f = perf.fielding;
    const catchPoints = f.catches * 8;
    fielding += catchPoints;
    if (catchPoints > 0) breakdown.push(`Catches: ${f.catches} → ${catchPoints}pts`);

    const stumpingPoints = f.stumpings * 12;
    fielding += stumpingPoints;
    if (stumpingPoints > 0) breakdown.push(`Stumpings: ${f.stumpings} → ${stumpingPoints}pts`);

    const runOutPoints = f.runOuts * 12;
    fielding += runOutPoints;
    if (runOutPoints > 0) breakdown.push(`Run-outs: ${f.runOuts} → ${runOutPoints}pts`);
  }

  return {
    playerName: perf.playerName,
    batting,
    bowling,
    fielding,
    total: batting + bowling + fielding,
    breakdown,
  };
}

export function calculateTeamScore(
  team: Team,
  performances: PlayerMatchPerformance[]
): TeamMatchScore {
  const playerScores: PlayerPoints[] = [];

  for (const player of team.players) {
    const perf = performances.find(
      (p) => p.playerName.toLowerCase() === player.name.toLowerCase()
    );
    if (perf) {
      const points = calculatePlayerPoints(perf);
      points.teamId = team.id;
      playerScores.push(points);
    }
  }

  playerScores.sort((a, b) => b.total - a.total);

  return {
    teamId: team.id,
    teamName: team.teamName,
    totalPoints: playerScores.reduce((sum, p) => sum + p.total, 0),
    playerScores,
  };
}
