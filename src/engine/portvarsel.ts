// Varsel ved porten: når portens sektor er full av zombier, kan porten verken befestes eller voktes, og natteinnsiget
// vokser med dagene i fasen. Ren logikk med de samme formlene som natta. Rører aldri tilstanden eller rng.
import { GATES, SECTORS } from './data';
import { noiseProfile } from './encounters';
import { breachOdds, breachSpan, GATE_IDS, GATE_STRAGGLERS, gateQuiet, nightChance, nightDefense } from './engine';
import { postHolder, securityPower } from './hq';
import { mods, phaseDay } from './phases';
import { previewTask } from './preview';
import { clamp } from './rng';
import { avgGateLevel, creepOdds } from './sectors';
import { isOnTokt } from './tokt';
import type { CrewMember, GameState, GateId, SectorId } from './types';

/** Kontrollen en sektor får av én gruppe som rydder der (som i `updateControl`). */
const GROUP_CONTROL = 10;

export type GateAlertLevel = 'gul' | 'rød';
export interface GateAlert {
  gate: GateId;
  sector: SectorId;
  level: GateAlertLevel;
  text: string;
}

/** De som kan sendes ut i morgen: ikke på tokt og ikke hardt skadet. */
const ableCrew = (s: GameState): CrewMember[] => s.crew.filter((c) => !isOnTokt(s, c) && c.hp >= 2);

/**
 * Forventet antall zombier som kommer inn i `sector` i natt dersom `team` rydder der: gjennombrudd ved alle porter
 * som slipper inn hit (etter det `team` tar imot med halv styrke ved portene i sektoren), det som siver inn når
 * kontrollen er lav, og det bråket fra ryddingen trekker til seg. Samme formler som natta i `resolveDay()`.
 */
export function expectedInflow(s: GameState, sector: SectorId, team: CrewMember[]): number {
  const M = mods(s), pd = phaseDay(s);
  const holder = postHolder(s, 'sikkerhet');
  const chief = holder && team.includes(holder) ? 0 : securityPower(s);
  let total = 0;
  for (const id of GATE_IDS) {
    const g = GATES[id];
    if (gateQuiet(s, id)) continue;
    const share = g.spills?.length ? g.spills.filter((x) => x === sector).length / g.spills.length : g.sector === sector ? 1 : 0;
    if (!share) continue;
    const near = g.sector === sector ? team : [];
    const k = nightDefense(s, [], near, chief);
    // sround gir floor(k) eller floor(k) + 1, med brøkdelen som sjanse
    const f = Math.floor(k), up = k - f;
    const net = breachOdds(breachSpan(M, pd), s.gates[id].level)
      .reduce((a, { n, p }) => a + p * ((1 - up) * Math.max(0, n - f) + up * Math.max(0, n - f - 1)), 0);
    total += share * nightChance(s, id, M, pd) * net;
  }
  const sec = s.sectors[sector];
  const control = clamp(sec.control + (team.length ? GROUP_CONTROL : 0), sec.settled ? 50 : 0, 100);
  total += creepOdds(M, control, avgGateLevel(s));
  if (team.length && noiseProfile(team).loud) total += M.noiseAttract;
  return total;
}

/**
 * Varsler for porter som står åpne: gult når portens sektor har flere enn `GATE_STRAGGLERS` zombier (porten kan
 * verken befestes eller voktes), rødt når hele crewet til sammen ville ryddet færre der enn det som forventes å
 * komme inn i natt. Porter som ikke slipper inn noe lenger (`gateQuiet`), varsles ikke.
 */
export function gateAlerts(s: GameState): GateAlert[] {
  const out: GateAlert[] = [];
  for (const id of GATE_IDS) {
    const g = GATES[id], sector = g.sector, z = s.sectors[sector].z;
    if (gateQuiet(s, id) || z <= GATE_STRAGGLERS) continue;
    const place = SECTORS[sector].short;
    const team = ableCrew(s);
    const p = previewTask(s, { type: 'rydde', target: sector }, team);
    const kills = p?.kind === 'rydde' ? p.kills : 0;
    // klarer crewet hele sektoren på én dag, vokser den ikke fra dere
    const red = kills < z && kills < expectedInflow(s, sector, team);
    out.push(red
      ? { gate: id, sector, level: 'rød', text: `Horden ${SECTORS[sector].at} vokser fortere enn dere rydder. Samle alle der nå, ellers blir det verre.` }
      : { gate: id, sector, level: 'gul', text: `${g.name} står ubevoktet. Rydd ${place} ned til ${GATE_STRAGGLERS} for å kunne befeste. De som rydder der, tar også imot det som kommer om natta.` });
  }
  return out;
}
