import { Match, PlayerMatchPerformance, BattingPerformance, FieldingPerformance } from './types';

// Strip role/captain/keeper markers and normalise whitespace
function normaliseName(raw: string): string {
  return raw
    .replace(/\(c\)/g, '')
    .replace(/†/g, '')
    .replace(/\*/g, '')
    .trim();
}

// Lines we should always skip when walking a batting or bowling section
const SKIP_PATTERN =
  /^(Batting|Bowling|Extras|Total|Fall of wickets|DRS|Did not bat|Fan rating|\d+-\d+\s*\()/i;

function isSkip(line: string): boolean {
  return SKIP_PATTERN.test(line.trim());
}

// Detect the start of a new innings block: e.g. "Sunrisers Hyderabad  (20 ovs maximum)"
function isInningsHeader(line: string): boolean {
  return /\(.*ovs/i.test(line);
}

// Detect the "Batting  R  B  4s  6s  SR" column-header row
function isBattingHeader(line: string): boolean {
  return /^Batting\s/.test(line);
}

// Detect the "Bowling  O  M  R  W  ECON" column-header row
function isBowlingHeader(line: string): boolean {
  return /^Bowling\s/.test(line);
}

// Returns true if a line looks like a tab-separated stat row (starts with a digit)
function isStatLine(line: string): boolean {
  return /^\d/.test(line.trim());
}

// Looks like a pure integer (standalone wicket count line)
function isWicketLine(line: string): boolean {
  return /^\d+$/.test(line.trim());
}

// Extract fielding credit from a dismissal string.
// Returns { catches, stumpings } increments for the *fielder* named.
function parseFielding(
  dismissal: string,
  fieldingMap: Map<string, FieldingPerformance>
): void {
  const d = dismissal.trim();

  // "c †Fielder b Bowler" or "c Fielder b Bowler"
  const catchMatch = d.match(/^c\s+[†]?([^b]+?)\s+b\s+/i);
  if (catchMatch) {
    const fielder = normaliseName(catchMatch[1]);
    if (fielder) {
      const existing = fieldingMap.get(fielder.toLowerCase()) ?? { catches: 0, stumpings: 0, runOuts: 0 };
      fieldingMap.set(fielder.toLowerCase(), { ...existing, catches: existing.catches + 1, _name: fielder } as FieldingPerformance & { _name: string });
    }
    return;
  }

  // "st †Fielder b Bowler" or "st Fielder b Bowler"
  const stumpMatch = d.match(/^st\s+[†]?([^b]+?)\s+b\s+/i);
  if (stumpMatch) {
    const fielder = normaliseName(stumpMatch[1]);
    if (fielder) {
      const existing = fieldingMap.get(fielder.toLowerCase()) ?? { catches: 0, stumpings: 0, runOuts: 0 };
      fieldingMap.set(fielder.toLowerCase(), { ...existing, stumpings: existing.stumpings + 1, _name: fielder } as FieldingPerformance & { _name: string });
    }
  }
  // run out: skip — fielder name is too ambiguous to extract reliably
}

interface InningsBlock {
  battingLines: string[];
  bowlingLines: string[];
}

function splitInnings(lines: string[]): InningsBlock[] {
  const innings: InningsBlock[] = [];
  let current: InningsBlock | null = null;
  let inBatting = false;
  let inBowling = false;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) continue;

    if (isInningsHeader(line)) {
      if (current) innings.push(current);
      current = { battingLines: [], bowlingLines: [] };
      inBatting = false;
      inBowling = false;
      continue;
    }

    if (!current) continue;

    if (isBattingHeader(line)) { inBatting = true; inBowling = false; continue; }
    if (isBowlingHeader(line)) { inBowling = true; inBatting = false; continue; }

    if (inBatting) current.battingLines.push(line);
    else if (inBowling) current.bowlingLines.push(line);
  }

  if (current) innings.push(current);
  return innings;
}

// Parse one innings' batting lines into performances + populate fieldingMap
function parseBatting(
  lines: string[],
  fieldingMap: Map<string, FieldingPerformance & { _name?: string }>
): PlayerMatchPerformance[] {
  const perfs: PlayerMatchPerformance[] = [];
  // Walk lines in 3-line chunks: name / stats / dismissal
  let i = 0;
  while (i < lines.length) {
    const nameLine = lines[i].trim();
    if (!nameLine || isSkip(nameLine) || isStatLine(nameLine)) { i++; continue; }

    const name = normaliseName(nameLine);
    if (!name) { i++; continue; }

    // Look ahead for the stats line
    let statsLine = '';
    let dismissalLine = '';
    let consumed = 1;

    if (i + 1 < lines.length && isStatLine(lines[i + 1])) {
      statsLine = lines[i + 1].trim();
      consumed = 2;
      if (i + 2 < lines.length && !isStatLine(lines[i + 2]) && !isSkip(lines[i + 2])) {
        // next non-stat, non-skip line is the dismissal
        const peek = lines[i + 2].trim();
        if (!isInningsHeader(peek)) {
          dismissalLine = peek;
          consumed = 3;
        }
      }
    } else {
      // Might be a "Did not bat" straggler name — skip
      i++;
      continue;
    }

    // Parse stats: R\tB\t4s\t6s\tSR
    const parts = statsLine.split('\t');
    const runs = parseInt(parts[0], 10);
    const balls = parseInt(parts[1], 10);
    const fours = parseInt(parts[2], 10);
    const sixes = parseInt(parts[3], 10);

    if (isNaN(runs)) { i += consumed; continue; }

    const dismissed = !/not out/i.test(dismissalLine);

    const batting: BattingPerformance = { runs, balls: isNaN(balls) ? 0 : balls, fours: isNaN(fours) ? 0 : fours, sixes: isNaN(sixes) ? 0 : sixes, dismissed };

    perfs.push({ playerName: name, batting });

    if (dismissalLine) {
      parseFielding(dismissalLine, fieldingMap);
    }

    i += consumed;
  }
  return perfs;
}

// Parse one innings' bowling lines into performances
function parseBowling(lines: string[]): PlayerMatchPerformance[] {
  const perfs: PlayerMatchPerformance[] = [];
  let i = 0;

  while (i < lines.length) {
    const nameLine = lines[i].trim();
    if (!nameLine || isSkip(nameLine) || isStatLine(nameLine) || isWicketLine(nameLine)) { i++; continue; }

    const name = normaliseName(nameLine);
    if (!name) { i++; continue; }

    if (i + 1 >= lines.length) { i++; continue; }

    const statsLine = lines[i + 1].trim();
    if (!isStatLine(statsLine)) { i++; continue; }

    const parts = statsLine.split('\t').map(p => p.trim());
    // 0-wicket line: O M R 0 ECON WD NB  (6+ parts, part[3] is '0')
    // 1+-wicket line: O M R [trailing tab → empty part]  then next line is W, then ECON...
    const overs = parseFloat(parts[0]);
    const maidens = parseInt(parts[1], 10);
    const runs = parseInt(parts[2], 10);

    if (isNaN(overs) || isNaN(runs)) { i++; continue; }

    let wickets = 0;
    let consumed = 2;

    const part3 = parts[3] ?? '';
    if (part3 === '' || part3 === undefined) {
      // Wickets on the next line
      if (i + 2 < lines.length && isWicketLine(lines[i + 2])) {
        wickets = parseInt(lines[i + 2].trim(), 10);
        consumed = 3; // name + stats + wicket line (economy line after is not consumed)
        // skip the economy line too
        if (i + 3 < lines.length && /^\d+\.\d+/.test(lines[i + 3].trim())) {
          consumed = 4;
        }
      }
    } else {
      wickets = parseInt(part3, 10);
      if (isNaN(wickets)) wickets = 0;
    }

    perfs.push({ playerName: name, bowling: { overs, maidens: isNaN(maidens) ? 0 : maidens, runs, wickets } });
    i += consumed;
  }

  return perfs;
}

export function parseESPNScorecardText(
  text: string,
  meta: { id: string; title: string; date: string; venue?: string }
): Match {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const innings = splitInnings(lines);

  // fieldingMap: lowercaseName → { catches, stumpings, runOuts, _name (original casing) }
  const fieldingMap = new Map<string, FieldingPerformance & { _name?: string }>();

  // Collect all batting and bowling performances across innings
  const allPerfs: PlayerMatchPerformance[] = [];

  for (const inn of innings) {
    const battingPerfs = parseBatting(inn.battingLines, fieldingMap);
    const bowlingPerfs = parseBowling(inn.bowlingLines);
    allPerfs.push(...battingPerfs, ...bowlingPerfs);
  }

  // Merge by player name (case-insensitive): one player can bat in one innings and bowl in another
  const merged = new Map<string, PlayerMatchPerformance>();

  for (const p of allPerfs) {
    const key = p.playerName.toLowerCase();
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...p });
    } else {
      if (p.batting) existing.batting = p.batting;
      if (p.bowling) existing.bowling = p.bowling;
    }
  }

  // Apply fielding credits
  for (const [key, f] of fieldingMap) {
    const existing = merged.get(key);
    const name = (f as FieldingPerformance & { _name?: string })._name ?? key;
    const fielding: FieldingPerformance = { catches: f.catches, stumpings: f.stumpings, runOuts: f.runOuts };
    if (existing) {
      existing.fielding = fielding;
    } else {
      // Fielder appeared only as a catcher, not as batter/bowler in the data — still record them
      merged.set(key, { playerName: name, fielding });
    }
  }

  return {
    id: meta.id,
    title: meta.title,
    date: meta.date,
    venue: meta.venue,
    performances: Array.from(merged.values()),
  };
}
