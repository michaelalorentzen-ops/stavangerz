// Balansesimulering av fase 1. Bruk: npm run sim -- [antall]
import { phaseProgress } from '../src/engine';
import { playGame } from './bot';

const n = Number(process.argv[2]) || 300;
const games = Array.from({ length: n }, (_, i) => playGame(i + 1));
const won = games.filter((s) => s.over === 'won');
const days = won.map((s) => s.day - 1).sort((a, b) => a - b);
const pct = (k: number) => `${Math.round((k / n) * 100)} %`;
console.log(`Runder: ${n}`);
console.log(`Vunnet: ${won.length} (${pct(won.length)}) · Døde: ${games.filter((s) => s.over === 'dead').length} · Uavgjort: ${games.filter((s) => !s.over).length}`);
if (days.length) console.log(`Dager til seier: median ${days[days.length >> 1]}, min ${days[0]}, maks ${days.at(-1)}`);
console.log(`Crew mistet per runde: ${(games.reduce((a, s) => a + s.stats.lost, 0) / n).toFixed(2)}`);
const stuck = games.filter((s) => !s.over).slice(0, 3).map((s) => ({ ...phaseProgress(s), gates: s.gates }));
if (stuck.length) console.log('Eksempler på runder som stoppet opp:', JSON.stringify(stuck));
