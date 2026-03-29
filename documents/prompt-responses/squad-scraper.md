# ESPN Cricinfo Squad Scraper

## Goal
Extract player data (name, role, nationality) from ESPN Cricinfo squad pages for IPL 2026.

**Target URL:** `https://www.espncricinfo.com/series/ipl-2026-1510719/gujarat-titans-squad-1511094/series-squads`

**Nationality rule:** If the player has an `icon-airplanemode_active-filled` icon, set `nationality = "Overseas"`, otherwise `"Indian"`.

---

## Setup

```bash
npm install --save-dev playwright
npx playwright install chromium
```

Create a `scripts/` folder at the project root and add `scrape-squad.ts` (see below).

---

## Script: `scripts/scrape-squad.ts`

```typescript
import { chromium } from 'playwright';
import * as fs from 'fs';

type Role = 'Batsman' | 'Bowler' | 'All-Rounder' | 'Wicket-Keeper';
type Nationality = 'Indian' | 'Overseas';

interface ScrapedPlayer {
  name: string;
  role: Role;
  nationality: Nationality;
}

function mapRole(raw: string): Role {
  const r = raw.toLowerCase();
  if (r.includes('all-round') || r.includes('allround')) return 'All-Rounder';
  if (r.includes('wicket') || r.includes('keeper')) return 'Wicket-Keeper';
  if (r.includes('bowl')) return 'Bowler';
  return 'Batsman'; // default for "Batting", "Batter", etc.
}

async function scrapeSquad(url: string): Promise<ScrapedPlayer[]> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Set a realistic user agent to avoid bot detection
  await page.setExtraHTTPHeaders({
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

  // Wait for player cards to render
  await page.waitForSelector('.ds-text-tight-l', { timeout: 15000 });

  const players = await page.evaluate((): ScrapedPlayer[] => {
    const results: ScrapedPlayer[] = [];

    // Each player is in an anchor wrapping a card
    // The structure is: <a> > div (card) containing name, role, and optionally airplane icon
    const playerLinks = document.querySelectorAll(
      'a[href*="/cricketers/"]'
    );

    const seen = new Set<string>();

    playerLinks.forEach((link) => {
      // Name: largest text element inside the card
      const nameEl = link.querySelector('.ds-text-tight-l, h3, [class*="name"]');
      if (!nameEl) return;

      const name = nameEl.textContent?.trim() ?? '';
      if (!name || seen.has(name)) return;
      seen.add(name);

      // Role: smaller text below the name
      const roleEl = link.querySelector('.ds-text-tight-s, .ds-text-compact-s, p');
      const rawRole = roleEl?.textContent?.trim() ?? 'Batting';

      // Overseas: airplane icon present
      const hasAirplane =
        link.querySelector('.icon-airplanemode_active-filled') !== null ||
        link.innerHTML.includes('icon-airplanemode_active-filled');

      const nationality: Nationality = hasAirplane ? 'Overseas' : 'Indian';

      // Map role string → typed role
      const r = rawRole.toLowerCase();
      let role: Role = 'Batsman';
      if (r.includes('all-round') || r.includes('allround')) role = 'All-Rounder';
      else if (r.includes('wicket') || r.includes('keeper')) role = 'Wicket-Keeper';
      else if (r.includes('bowl')) role = 'Bowler';

      results.push({ name, role, nationality });
    });

    return results;
  });

  await browser.close();
  return players;
}

(async () => {
  const url =
    'https://www.espncricinfo.com/series/ipl-2026-1510719/chennai-super-kings-squad-1511148/series-squads';

  console.log('Scraping:', url);
  const players = await scrapeSquad(url);

  if (players.length === 0) {
    console.error('No players found — selectors may need updating.');
    process.exit(1);
  }

  console.log(`\nFound ${players.length} players:\n`);
  console.log(JSON.stringify(players, null, 2));

  // Write to file
  const outPath = 'scripts/csk-squad.json';
  fs.writeFileSync(outPath, JSON.stringify(players, null, 2));
  console.log(`\nSaved to ${outPath}`);
})();
```

---

## Running the Script

```bash
npx tsx scripts/scrape-squad.ts
```

---

## Expected Output Format

```json
[
  { "name": "MS Dhoni", "role": "Wicket-Keeper", "nationality": "Indian" },
  { "name": "Ruturaj Gaikwad", "role": "Batsman", "nationality": "Indian" },
  { "name": "Devon Conway", "role": "Batsman", "nationality": "Overseas" }
]
```

---

## Troubleshooting

If the script returns 0 players, the ESPN Cricinfo DOM selectors have changed. Open the browser non-headlessly to inspect:

```typescript
const browser = await chromium.launch({ headless: false });
```

Then inspect the player card markup in DevTools and update the selectors in `page.evaluate()`.

---

## Role Mapping

| ESPN Cricinfo label | Mapped role |
|---|---|
| Batting / Batter | `Batsman` |
| Bowling / Bowler | `Bowler` |
| All-Rounder | `All-Rounder` |
| Wicket Keeper / Wicketkeeper-Batsman | `Wicket-Keeper` |
