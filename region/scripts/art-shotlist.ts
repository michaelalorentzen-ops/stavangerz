/**
 * Writes the shot list for the illustrator (Codex): every picture the game can show, with file name, size and motif,
 * taken from the game's own data so names and texts match. Output: docs/art/shotlist.json and docs/art/SHOTLIST.md.
 *   pnpm art:shotlist
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONTENT } from '../packages/world-data/src/content';
import { EVENT_IDS, MUTATIONS, PHASES, RECRUIT_POOL, START_CREW, WONDERS, botPlay, forceEvent, newRegionGame, type RegionState, type RegionWorld } from '../packages/gameplay/src/region/index';

const world = JSON.parse(readFileSync(resolve('apps/game-client/public/world/region-v1.json'), 'utf8')) as RegionWorld;
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
interface Shot { file: string; size: string; priority: 1 | 2 | 3; title: string; motif: string }
const shots: Shot[] = [];
const WIDE = '1600x700', PORTRAIT = '512x512', HERO = '1920x1080';

// The first events the player meets, and the ones the owner cares most about.
const KEY_EVENTS = new Set(['escape', 'refugees', 'kindergarten', 'horde', 'gangTribute', 'gangRaid', 'fellowshipGift', 'fellowshipStrike', 'mutiny', 'storm', 'harvest',
  'goodFishing', 'tunnelFlood', 'winter', 'cruiseShip', 'planeFound', 'sickBoat', 'sanctuaryBroadcast', 'quarantineZone', 'siege', 'herdCrossing', 'darkHospital',
  'cathedralPriest', 'supplyShip', 'bittenChild', 'farmBarn', 'storeTheft', 'insulin', 'eldersLeave', 'challenger', 'trawler', 'lyseHydro']);

shots.push({ file: 'intro/hero', size: HERO, priority: 1, title: 'Startskjerm', motif: 'Stavanger sett fra Vålandstårnet i skumringen etter utbruddet: Vågen, trehusene i Gamle Stavanger, Domkirken, et cruiseskip ved kaia, røyk over Hillevåg, regn. Ingen mennesker i forgrunnen, noen små skikkelser i gatene som ikke burde gå sånn.' });
const intro = [
  'Natt til 1. april: et lager på Forus med blålys, en nyhetssending på en mobilskjerm, regn på frontruta.',
  'Trappeoppgang i en blokk: fire mennesker med lommelykter, en jaktrifle, en sykepleieruniform, en verktøykasse. Utenfor vinduet: skikkelser i gata.',
  'Et taktisk kart over Stavanger på et kjøkkenbord, med tusj, kaffekopp og radio. Hender som planlegger.',
  'Daggry over en tom gate med barrikade av bildekk og paller. Første dag.',
];
intro.forEach((m, i) => shots.push({ file: `intro/${i + 1}`, size: WIDE, priority: 1, title: `Intro ${i + 1}`, motif: m }));
for (const p of PHASES) shots.push({ file: `phases/${p.id}`, size: WIDE, priority: 1, title: `Fase ${p.id}: ${p.name}`, motif: p.intro });
shots.push({ file: 'end/win', size: WIDE, priority: 2, title: 'Seier', motif: 'Et samfunn som har klart seg: drivhus, båter i havna, barn som leker innenfor et stålgjerde, røyk fra pipene, kveldssol over Byfjorden.' });
shots.push({ file: 'end/lose', size: WIDE, priority: 2, title: 'Slutt', motif: 'En forlatt leir i regnet: velta barrikade, slukket bål, en jakke på bakken. Ingen mennesker.' });
for (const c of [...START_CREW, ...RECRUIT_POOL]) shots.push({ file: `crew/${slug(c.name)}`, size: PORTRAIT, priority: START_CREW.some(s => s.name === c.name) ? 1 : 2, title: `${c.name}, ${c.role}`, motif: `Portrett, brystbilde. ${c.role}. ${c.about} Norsk, vanlige klær slitt etter uker i apokalypsen.` });
for (const t of CONTENT.hqTypes) shots.push({ file: `hq/${t.id}`, size: WIDE, priority: 2, title: `HQ: ${t.name}`, motif: `${t.name} i Stavanger-regionen gjort om til hovedkvarter: sperringer, vakter, lys i vinduene. Unik modul: ${CONTENT.modules.find(m => m.id === t.unique)?.name ?? t.unique}.` });
shots.push({ file: 'hq/camp', size: WIDE, priority: 2, title: 'HQ: Leir', motif: 'En enkel leir i et nabolag: presenninger, bålfat, paller, en gammel campingbil.' });
for (const w of WONDERS) shots.push({ file: `wonders/${w.id}`, size: WIDE, priority: 1, title: w.name, motif: `${w.about} ${w.levels.at(-1)!.name}: ${w.levels.at(-1)!.text}` });
for (const m of MUTATIONS) shots.push({ file: `mutations/${m.id}`, size: PORTRAIT, priority: 3, title: `Mutasjon: ${m.name}`, motif: `${m.text} Klinisk, nesten vitenskapelig illustrasjon, som fra en feltrapport.` });

// Events: built on real game states so the title and text match what the player reads.
const states: RegionState[] = [];
for (const [i, s] of world.starts.slice(0, 5).entries()) for (const d of [5, 40]) states.push({ ...botPlay(world, newRegionGame(world, s.zoneId, 11 + i), d), event: undefined });
const data = (s: RegionState) => ({ zone: s.homeZoneId, who: s.survivors.find(p => p.alive)?.id ?? '', link: world.links[0]?.id ?? '', target: s.homeZoneId, taken: 3, n: 4, size: 40 });
for (const id of EVENT_IDS) {
  const ev = states.map(s => forceEvent(s, world, id, data(s))).find(Boolean);
  shots.push({ file: `events/${id}`, size: WIDE, priority: KEY_EVENTS.has(id) ? 1 : 3, title: ev?.title ?? id, motif: (ev?.text ?? '').replace(/\s+/g, ' ').slice(0, 420) });
}

mkdirSync('docs/art', { recursive: true });
writeFileSync('docs/art/shotlist.json', JSON.stringify(shots, null, 1));
const md = ['# Bildeliste', '', `Generert av \`pnpm art:shotlist\`. ${shots.length} bilder, ${shots.filter(s => s.priority === 1).length} med prioritet 1. Legg filene i \`apps/game-client/public/art/<file>.webp\` og kjør \`pnpm art:manifest\`.`, '',
  '| Prioritet | Fil | Størrelse | Tittel | Motiv |', '|---|---|---|---|---|',
  ...shots.sort((a, b) => a.priority - b.priority || a.file.localeCompare(b.file)).map(s => `| ${s.priority} | \`${s.file}.webp\` | ${s.size} | ${s.title.replace(/\|/g, '/')} | ${s.motif.replace(/\|/g, '/')} |`)];
writeFileSync('docs/art/SHOTLIST.md', md.join('\n') + '\n');
console.log(`${shots.length} shots, ${shots.filter(s => s.priority === 1).length} priority 1 → docs/art/`);
