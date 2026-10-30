// Balansesimulering av fase 1.
// Bruk: npm run sim -- [antall] [--neighbors a,b,c] [--combos] [--tokt] [--hard|--brutal]
//   --neighbors a,b,c  spiller med disse naboene i stedet for standardcrewet
//   --combos           kjører de fire faste kombinasjonene i COMBOS (tools/bot.ts)
//   --hard, --brutal   vanskelighetsgrad (standard er normal). Seier = målet nådd før fristen, uansett grad
//   --tokt             boten tar også «Køen på Bybrua» når det er rolig nok
import { phaseProgress } from '../src/engine';
import type { Difficulty, GameState } from '../src/engine';
import { BOT_NEIGHBORS, COMBOS, playGame, toktStats } from './bot';

const args = process.argv.slice(2);
const flag = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const n = Number(args.find((a) => /^\d+$/.test(a))) || 300;
const tokt = args.includes('--tokt');
const difficulty: Difficulty = args.includes('--brutal') ? 'brutal' : args.includes('--hard') ? 'hard' : 'normal';

const median = (xs: number[]) => { const a = [...xs].sort((x, y) => x - y); return a.length ? a[a.length >> 1] : NaN; };
const pct = (k: number, of: number) => `${Math.round((k / of) * 100)} %`;

function report(label: string, neighbors: string[]) {
  const games: GameState[] = Array.from({ length: n }, (_, i) => playGame(i + 1, neighbors, { tokt, difficulty }));
  const won = games.filter((s) => s.over === 'won');
  const dead = games.filter((s) => s.over === 'dead');
  const timeout = games.filter((s) => s.over === 'timeout');
  // normal og hard: fristen tvinger over til fase 2 med en pris i stedet for tap
  const forced = games.filter((s) => !s.over && s.phase > 1);
  const lost = games.filter((s) => s.over !== 'won');
  const days = won.map((s) => s.day - 1);
  const deaths = { kamp: 0, natt: 0, tokt: 0 };
  for (const s of games) for (const k of Object.keys(deaths) as (keyof typeof deaths)[]) deaths[k] += s.stats.deaths[k];
  console.log(`\n${label}${tokt ? ' med tokt' : ''} [${difficulty}] (${neighbors.join(', ')}), ${n} runder`);
  console.log(`  Vunnet: ${won.length} (${pct(won.length, n)}) · Døde: ${dead.length} · Timeout: ${timeout.length} (${pct(timeout.length, n)}) · Tvunget videre av fristen: ${forced.length} (${pct(forced.length, n)}) · Uavgjort: ${games.filter((s) => !s.over && s.phase === 1).length}`);
  if (days.length) console.log(`  Dager til seier: median ${median(days)}, min ${Math.min(...days)}, maks ${Math.max(...days)}`);
  console.log(`  Sultedager per runde: median ${median(games.map((s) => s.stats.starvedDays))}, snitt ${(games.reduce((a, s) => a + s.stats.starvedDays, 0) / n).toFixed(1)}${lost.length ? `, median i tapte runder ${median(lost.map((s) => s.stats.starvedDays))}` : ''}`);
  console.log(`  Døde crew: kamp ${deaths.kamp}, natt ${deaths.natt}, tokt ${deaths.tokt} (${(games.reduce((a, s) => a + s.stats.lost, 0) / n).toFixed(2)} per runde)`);
  if (tokt) {
    const st = games.map(toktStats);
    const avg = (k: 'done' | 'turned') => (st.reduce((a, x) => a + x[k], 0) / n).toFixed(2);
    console.log(`  Tokt per runde: fullført ${avg('done')}, snudd ${avg('turned')}`);
  }
  const stuck = timeout.slice(0, 3).map((s) => {
    const p = phaseProgress(s);
    return `trygge ${p.safe}/${p.total}, porter ${p.gates.map((g) => g.level).join('/')}, crew ${s.crew.length}`;
  });
  if (stuck.length) console.log(`  Eksempler på timeout: ${stuck.join(' · ')}`);
}

const custom = flag('--neighbors');
if (args.includes('--combos')) COMBOS.forEach((c, i) => report(`Kombinasjon ${i + 1}`, c));
else report(custom ? 'Valgte naboer' : 'Standardcrew', custom ? custom.split(',') : BOT_NEIGHBORS);
