import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE_PRICE = 200;

// Pass one or more URLs as CLI args, e.g.:
//   npx tsx scripts/scrape-squad.ts <url1> <url2> ...
// Falls back to the list below if none provided.
const urls: string[] =
  process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : [
        'https://www.espncricinfo.com/series/ipl-2026-1510719/chennai-super-kings-squad-1511148/series-squads',
        'https://www.espncricinfo.com/series/ipl-2026-1510719/delhi-capitals-squad-1511107/series-squads',
        'https://www.espncricinfo.com/series/ipl-2026-1510719/kolkata-knight-riders-squad-1511092/series-squads',
        'https://www.espncricinfo.com/series/ipl-2026-1510719/gujarat-titans-squad-1511094/series-squads',
        'https://www.espncricinfo.com/series/ipl-2026-1510719/lucknow-super-giants-squad-1511235/series-squads',
        'https://www.espncricinfo.com/series/ipl-2026-1510719/mumbai-indians-squad-1511109/series-squads',
        'https://www.espncricinfo.com/series/ipl-2026-1510719/punjab-kings-squad-1511082/series-squads',
        'https://www.espncricinfo.com/series/ipl-2026-1510719/rajasthan-royals-squad-1511089/series-squads',
        'https://www.espncricinfo.com/series/ipl-2026-1510719/royal-challengers-bengaluru-squad-1511134/series-squads',
        'https://www.espncricinfo.com/series/ipl-2026-1510719/sunrisers-hyderabad-squad-1511114/series-squads',
      ];

const outDir = path.resolve(__dirname, '../documents/prompt-responses');

type Role = 'Batsman' | 'Bowler' | 'All-Rounder' | 'Wicket-Keeper';
type Nationality = 'Indian' | 'Overseas';

interface Player {
  name: string;
  role: Role;
  nationality: Nationality;
  base_price: number;
}

function teamSlugFromUrl(url: string): string {
  return url.match(/\/([a-z-]+-squad-\d+)\//)?.[1]?.replace(/-squad-\d+$/, '') ?? 'squad';
}

async function scrapeSquad(url: string): Promise<Player[]> {
  // Headless mode is blocked by Akamai on espncricinfo.com — must use headless: false
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-US',
    viewport: { width: 1280, height: 800 },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const page = await context.newPage();

  console.log(`  Navigating to ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('h1', { timeout: 15000 });
  await page.waitForTimeout(3000);

  const raw = await page.evaluate(() => {
    // eslint-disable-next-line no-new-func
    const mapRole = new Function('raw', `
      const r = raw.toLowerCase();
      if (r.includes('wicket') || r.includes('keeper')) return 'Wicket-Keeper';
      if (r.includes('allrounder') || r.includes('all-rounder')) return 'All-Rounder';
      if (r.includes('bowl') && !r.includes('allrounder')) return 'Bowler';
      return 'Batsman';
    `) as (raw: string) => string;

    const allH1s = [...document.querySelectorAll('h1')];
    const squadH1 = allH1s.find((h) => h.textContent?.includes('Squad'));
    if (!squadH1) return [];

    let squadContainer: Element | null = squadH1;
    while (squadContainer && !squadContainer.classList.contains('ds-rounded-xl')) {
      squadContainer = squadContainer.parentElement;
    }
    if (!squadContainer) return [];

    const results: { name: string; role: string; nationality: string }[] = [];

    squadContainer.querySelectorAll<HTMLAnchorElement>('a[href*="/cricketers/"][title]').forEach((a) => {
      const name = a.title.trim();
      if (!name) return;

      const rawRole = a.closest('.ds-flex-1')?.querySelector('p.ds-text-tight-s')?.textContent?.trim() ?? 'Batter';
      const hasAirplane = a.closest('.ds-justify-between')?.querySelector('.icon-airplanemode_active-filled') !== null;

      results.push({ name, role: mapRole(rawRole), nationality: hasAirplane ? 'Overseas' : 'Indian' });
    });

    return results;
  });

  await browser.close();

  return raw.map((p) => ({ ...p, base_price: BASE_PRICE }) as Player);
}

function buildSql(players: Player[]): string {
  const rows = players
    .map((p) => `  (gen_random_uuid(), '${p.name.replace(/'/g, "''")}', '${p.role}', ${p.base_price}, '${p.nationality}')`)
    .join(',\n');
  return `INSERT INTO players (id, name, role, base_price, country)\nVALUES\n${rows};`;
}

(async () => {
  console.log(`Scraping ${urls.length} team(s)...`);
  console.log('Note: A browser window will open briefly per team.\n');

  for (const url of urls) {
    const slug = teamSlugFromUrl(url);
    console.log(`\n[${slug}]`);

    let players: Player[];
    try {
      players = await scrapeSquad(url);
    } catch (err) {
      console.error(`  Failed: ${err}`);
      continue;
    }

    if (players.length === 0) {
      console.error('  No players found, skipping.');
      continue;
    }

    const sql = buildSql(players);
    const jsonPath = path.join(outDir, `${slug}-squad.json`);
    const sqlPath = path.join(outDir, `${slug}-insert.sql`);

    fs.writeFileSync(jsonPath, JSON.stringify(players, null, 2));
    fs.writeFileSync(sqlPath, sql);

    console.log(`  ${players.length} players found`);
    console.log(`  JSON → ${jsonPath}`);
    console.log(`  SQL  → ${sqlPath}`);
  }

  console.log('\nDone.');
})();
