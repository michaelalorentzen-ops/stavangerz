// En bot som spiller fase 1. Brukes av balansetesten og tools/sim.ts.
// Den følger en fast prioritetsliste og tenker ikke langt frem. En god spiller skal slå den.
import {
  canEndDay, canEndPhase, CARDS, dailyFood, dailyWater, delta, describeEncounter, endPhase, eventChoices, eventDef, equip, fightPower, GATE_IDS, GATES,
  isOnTokt, isSafe, LAGE_COST, newGame, toktDecision, toktDef, activeSectors, resolveDay, resolveEncounter, resolveEvent, runChoice, sameTask, searchPower, buildPower, SECTORS, setLeader,
  SLOTS, taskOptions, THREAT_KILL, canRecruit, sum, FACILITY_IDS, HQ_SECTOR, istandLeft, istandMaterials, POSTS, stat,
} from '../src/engine';
import type { ChoiceDef, CrewMember, Difficulty, GameState, ResKey, SectorId, SelfSetup, Task } from '../src/engine';

export const BOT_SELF: SelfSetup = { name: 'Bot', stats: { muskler: 3, kondis: 2, snoking: 3, nerver: 3, mekk: 2, prat: 2 }, trait: 'lokalkjent' };
export const BOT_NEIGHBORS = ['arild', 'mona', 'toregil'];
/** Fire kombinasjoner av tre fra START_NEIGHBORS, som til sammen bruker alle åtte. */
export const COMBOS: string[][] = [
  ['kjell', 'mona', 'arild'],
  ['sondre', 'ingrid', 'toregil'],
  ['leah', 'bjarne', 'kjell'],
  ['arild', 'sondre', 'bjarne'],
];

/** Valg for boten. `tokt` sender to på «Køen på Bybrua» når det er rolig nok. */
export interface BotOptions {
  tokt?: boolean; maxDays?: number; difficulty?: Difficulty;
  /** spill videre inn i fase 2 i stedet for å stoppe når fase 1 er over */
  fase2?: boolean;
  /** kalles når fase 2 starter og etter hver dag i fase 2, til målinger i balansetesten */
  onDay2?: (s: GameState) => void;
}

/** Toktet boten tar, og hvor mange den sender. */
const BOT_TOKT = 'bybrua', TOKT_TEAM = 2, TOKT_MIN_CREW = 4;
/** Boten snur etter så mange dager ute, med mindre toktet er ferdig. */
const TOKT_MAX_STAGES = 2;

/** Maks antall i en Rydde-gruppe. HQ-sektoren i fase 2 tar flere, siden horden er stor. */
const RYDDE_MAX = 3, RYDDE_MAX_HQ = 4, HQ_MIN_TEAM = 3;
/** Fase 2: boten leter etter overlevende til crewet er så stort. */
const RECRUIT_UNTIL = 6;
/** Fase 2: boten sanker mat før kamp når lageret er under så mange dagers forbruk. */
const FOOD_DAYS_2 = 5;
/** Fase 2: så mange zombier i den beste matsektoren ryddes før sankingen, i stedet for å sanke et dårligere sted. */
const FOOD_STRAGGLERS = 2;
/** Fase 2: crewet må være så stort før boten setter folk på hver post. */
const POST_MIN_CREW: Record<keyof typeof POSTS, number> = { bygg: 4, kokk: 5, sikkerhet: 6 };
/** Fase 2: så mange setter i stand samtidig. */
const ISTAND_TEAM = 3;
/** Forventet drap per kampkraft i Rydde, midt i spennet 0,35–0,60. */
const KILL_RATE = 0.47;

/** Steg 9: setter det beste kortet fra lageret i hvert spor. Kortet som lå der går tilbake. */
function botEquip(s: GameState) {
  // de sterkeste i kamp får våpnene først
  const order = [...s.crew].sort((a, b) => fightPower(s, b) - fightPower(s, a));
  for (const c of order) {
    for (const slot of SLOTS) {
      const have = c.gear[slot] ? CARDS[c.gear[slot]!.def].level : 0;
      const best = s.stash.filter((k) => CARDS[k.def].slot === slot && CARDS[k.def].level > have)
        .sort((a, b) => CARDS[b.def].level - CARDS[a.def].level || b.dur - a.dur)[0];
      if (best) equip(s, c.id, best.uid);
    }
  }
}

const materials = (s: GameState) => s.res.tre + s.res.skrap;

export function botTurn(s: GameState, bot: BotOptions = {}) {
  botEquip(s);
  const opts = taskOptions(s);
  const can = (t: Task) => opts.some((o) => sameTask(o, t));
  const free = s.crew.filter((c) => !isOnTokt(s, c)); // de som er ute er låst til toktet
  const plan = new Map<CrewMember, Task>();
  const avail = () => free.filter((c) => !plan.has(c));
  const by = (f: (c: CrewMember) => number) => avail().sort((a, b) => f(b) - f(a));
  const planned = (pred: (t: Task) => boolean) => [...plan.values()].some(pred);
  const set = (c: CrewMember | undefined, t: Task) => { if (c && can(t)) { plan.set(c, t); return true; } return false; };

  // 1) Hvile med 1 i liv. Fase 2: ikke på tom mage, for da virker ikke hvilen. Da sanker de heller mat (steg 1d).
  const starving = s.phase >= 2 && (s.res.mat < dailyFood(s) || s.res.vann < dailyWater(s));
  for (const c of free) if (c.hp <= 1 && !starving) plan.set(c, { type: 'hvile' });
  // Fase 2, mens horden står i HQ-sektoren: de skrapte hviler når det er medisin, så neste angrep blir med flere friske
  if (s.phase >= 2 && s.sectors[HQ_SECTOR].z > 0) {
    let med = s.res.medisin;
    for (const c of free) if (c.hp === 2 && med > 0 && !plan.has(c)) { plan.set(c, { type: 'hvile' }); med--; }
  }

  // 1a) Fase 2: postene i HQ-et. Den beste på postens ferdighet, men ikke den sterkeste i kamp.
  //     Byggelederen trengs bare mens noe skal settes i stand.
  if (s.hq.taken) {
    const fighters = new Set([...free].sort((a, b) => fightPower(s, b) - fightPower(s, a)).slice(0, 2));
    const building = FACILITY_IDS.some((f) => !s.hq.facilities[f].ready) && s.res.metall + s.res.skrap > 0;
    for (const p of ['bygg', 'kokk', 'sikkerhet'] as const) {
      if (s.crew.length < POST_MIN_CREW[p] || (p === 'bygg' && !building)) continue;
      const k = POSTS[p].stat;
      const c = avail().filter((c) => !fighters.has(c) && c.hp >= 2).sort((a, b) => stat(b, k) - stat(a, k))[0];
      set(c, { type: 'post', target: p });
    }
  }

  // 1b) Tokt (bare med bot.tokt): to friske drar når crewet er stort nok og ingenting haster.
  //     Det haster når en sektor har zombier, noen har 1 i liv, eller mat eller vann er under tre dagers forbruk.
  //     (Med bare Hjemme som krav dro boten nesten hver dag og vant 19 %: to av fire borte hele tiden.)
  if (bot.tokt && s.crew.length >= TOKT_MIN_CREW && can({ type: 'tokt', target: BOT_TOKT })) {
    const urgent = activeSectors(s).some((id) => s.sectors[id].z > 0) || s.crew.some((c) => c.hp <= 1)
      || s.res.mat < 3 * dailyFood(s) || s.res.vann < 3 * dailyWater(s);
    const fit = avail().filter((c) => c.hp === 3).sort((a, b) => fightPower(s, b) - fightPower(s, a));
    if (!urgent && fit.length >= TOKT_TEAM) for (const c of fit.slice(0, TOKT_TEAM)) set(c, { type: 'tokt', target: BOT_TOKT });
  }

  // 1c) Apoteket: når medisinen er tom og noen er skadet, sender boten de to friskeste. Bare den trygge første turen.
  if (!s.toktsDone.includes('apotek') && s.res.medisin < 2 && s.crew.length >= 3 && s.crew.some((c) => c.hp < 3) && can({ type: 'tokt', target: 'apotek' })) {
    const fit = avail().filter((c) => c.hp === 3).sort((a, b) => fightPower(s, b) - fightPower(s, a));
    if (fit.length >= 2) for (const c of fit.slice(0, 2)) set(c, { type: 'tokt', target: 'apotek' });
  }

  // 1d) Fase 2: crewet er større og Buøy er tømt, så maten sankes før noen går i kamp, med to når det haster.
  //     Står det et par streifere i matsektoren, ryddes de først, i stedet for å sanke der det nesten ikke er mat.
  if (s.phase >= 2 && s.res.mat < FOOD_DAYS_2 * dailyFood(s)) {
    const food = activeSectors(s).filter((id) => (SECTORS[id].yield.mat ?? 0) > 0 && s.sectors[id].z <= FOOD_STRAGGLERS)
      .sort((a, b) => (SECTORS[b].yield.mat ?? 0) - (SECTORS[a].yield.mat ?? 0));
    const best = food[0];
    if (best && s.sectors[best].z > 0) set(by((c) => fightPower(s, c) - (c.hp < 3 ? 10 : 0))[0], { type: 'rydde', target: best });
    const id = food.find((id) => can({ type: 'sanke', target: id }));
    const n = s.res.mat < 2 * dailyFood(s) ? 2 : 1;
    if (id) for (let i = 0; i < n; i++) set(by((c) => searchPower(s, c) - (c.hp < 3 ? 0 : 3))[0], { type: 'sanke', target: id });
    // de som ikke kan hvile seg friske, sanker også
    if (id && starving) for (const c of avail().filter((c) => c.hp <= 1)) set(c, { type: 'sanke', target: id });
  }

  // 1e) Fase 2: er horden i verftet borte, gjennomsøkes det med en gang. Ellers bryter kjellerne ut om natta.
  const hqSec = s.sectors[HQ_SECTOR];
  if (s.phase >= 2 && hqSec.z === 0 && (hqSec.hidden > 0 || hqSec.searched < 100)) set(by((c) => searchPower(s, c))[0], { type: 'rydde', target: HQ_SECTOR });

  // 2) Rydde den minst infiserte sektoren med inntil 3, så mange som trengs.
  //    Fase 2: HQ-sektoren først når det er nok friske til et angrep, så den minst infiserte av resten.
  const rydd = (id: SectorId) => {
    const need = s.sectors[id].z;
    // HQ-sektoren (trussel 5) angripes bare med minst HQ_MIN_TEAM friske. Ellers venter boten og leger seg.
    const hq = id === HQ_SECTOR;
    // De friske først, så de skrapte. Er det bare noen få zombier igjen, holder færre.
    const team = hq
      ? [...by((c) => fightPower(s, c)).filter((c) => c.hp === 3), ...by((c) => fightPower(s, c)).filter((c) => c.hp === 2)].slice(0, RYDDE_MAX_HQ)
      : by((c) => fightPower(s, c)).slice(0, RYDDE_MAX);
    const enough = !hq || team.filter((c) => c.hp === 3).length >= HQ_MIN_TEAM
      || (team.length >= HQ_MIN_TEAM && team.some((c) => c.hp === 3))
      || sum(team.map((c) => fightPower(s, c))) * KILL_RATE * THREAT_KILL[SECTORS[id].threat] >= need * 1.5;
    if (!enough) return false;
    let power = 0;
    for (const c of team) {
      if (power * KILL_RATE * THREAT_KILL[SECTORS[id].threat] >= need) break;
      if (set(c, { type: 'rydde', target: id })) power += fightPower(s, c);
    }
    return power > 0;
  };
  const infected = activeSectors(s).filter((id) => s.sectors[id].z > 0).sort((a, b) => s.sectors[a].z - s.sectors[b].z);
  // Fase 2: en portsektor med zombier ryddes før resten av Buøy. Så lenge den har mer enn et par,
  // kan porten verken voktes eller befestes, og hvert gjennombrudd gjør den verre.
  const gateSectors = new Set(GATE_IDS.map((g) => GATES[g].sector));
  const rest = infected.filter((id) => id !== HQ_SECTOR)
    .sort((a, b) => s.phase >= 2 ? Number(gateSectors.has(b)) - Number(gateSectors.has(a)) : 0);
  if (s.phase >= 2 && infected.includes(HQ_SECTOR) && rydd(HQ_SECTOR)) {
    if (rest.length) rydd(rest[0]);
  } else if (s.phase >= 2 && rest.length) rydd(rest[0]);
  else if (infected.length) rydd(infected[0]);

  // 2b) Fase 2: let etter overlevende når det er senger og mat nok, så crewet vokser før horden
  if (s.phase >= 2 && canRecruit(s) && s.crew.length < RECRUIT_UNTIL && s.res.mat >= FOOD_DAYS_2 * dailyFood(s)) {
    const id = activeSectors(s).find((id) => can({ type: 'overlevende', target: id }));
    if (id) set(by((c) => stat(c, 'prat'))[0], { type: 'overlevende', target: id });
  }

  // 2c) Fase 2: sette i stand anlegget som er billigst å gjøre ferdig, når det finnes metall eller skrap
  if (s.hq.taken) {
    const f = FACILITY_IDS.filter((f) => can({ type: 'istand', target: f }))
      .sort((a, b) => istandLeft(s.hq.facilities[a]) - istandLeft(s.hq.facilities[b]))[0];
    if (f && s.res.metall + s.res.skrap > 0) for (let i = 0; i < ISTAND_TEAM; i++) set(by((c) => buildPower(s, c))[0], { type: 'istand', target: f });
    // metall fra verftet når lageret ikke rekker til resten av istandsettingen
    if (f && s.res.metall + s.res.skrap < istandMaterials(s.hq.facilities[f]) && can({ type: 'sanke', target: HQ_SECTOR })) set(by((c) => searchPower(s, c))[0], { type: 'sanke', target: HQ_SECTOR });
  }

  // 3) Vakt ved en port under nivå 2. En port kan bare voktes og bygges når sektoren bak er tom,
  //    så et åpent gjennombrudd ryddes i steg 2 først.
  // 4) Befeste porten i stedet når det er materialer, siden byggerne også holder vakt om natta.
  const weakGate = GATE_IDS.filter((g) => s.gates[g].level < 2 && can({ type: 'vakt', target: g }))
    .sort((a, b) => s.gates[a].level - s.gates[b].level || GATES[b].base - GATES[a].base)[0];
  if (weakGate) {
    const c = by((c) => buildPower(s, c))[0];
    if (!(materials(s) > 0 && set(c, { type: 'befeste', target: weakGate }))) set(c, { type: 'vakt', target: weakGate });
  }
  for (const g of GATE_IDS) {
    if (s.gates[g].level < 2 && materials(s) > 2 && !planned((t) => t.type === 'befeste' && t.target === g)) {
      set(by((c) => buildPower(s, c))[0], { type: 'befeste', target: g });
    }
  }

  // 5) Sanke når mat eller vann er under 3 dagers forbruk
  const short: ResKey[] = [];
  if (s.res.mat < 3 * dailyFood(s)) short.push('mat');
  if (s.res.vann < 3 * dailyWater(s)) short.push('vann');
  for (const r of short) {
    const id = activeSectors(s).filter((id) => (SECTORS[id].yield[r] ?? 0) > 0 && can({ type: 'sanke', target: id }))
      .sort((a, b) => (SECTORS[b].yield[r] ?? 0) - (SECTORS[a].yield[r] ?? 0))[0];
    if (id) set(by((c) => searchPower(s, c))[0], { type: 'sanke', target: id });
  }

  // 5b) Sanke skrap og tre når det mangler materialer til en port under nivå 2
  const gatesLeft = GATE_IDS.some((g) => s.gates[g].level < 2);
  if (gatesLeft && materials(s) < 3) {
    const id = activeSectors(s).filter((id) => can({ type: 'sanke', target: id }))
      .sort((a, b) => ((SECTORS[b].yield.skrap ?? 0) + (SECTORS[b].yield.tre ?? 0)) - ((SECTORS[a].yield.skrap ?? 0) + (SECTORS[a].yield.tre ?? 0)))[0];
    if (id && (SECTORS[id].yield.skrap || SECTORS[id].yield.tre)) set(by((c) => searchPower(s, c))[0], { type: 'sanke', target: id });
  }

  // 6) Rydde (gjennomsøke) tomme sektorer som ikke er trygge, til de er gjennomsøkt.
  // Én person per sektor, de med minst gjennomsøkt først.
  const unsearched = activeSectors(s).filter((id) => s.sectors[id].z === 0 && (s.sectors[id].searched < 100 || s.sectors[id].hidden > 0))
    .sort((a, b) => s.sectors[a].searched - s.sectors[b].searched);
  for (const id of unsearched) set(by((c) => searchPower(s, c))[0], { type: 'rydde', target: id });

  // 7) Vakt på sektoren med lavest kontroll som ikke er trygg, så lenge det er noen å sende
  const unsafe = () => activeSectors(s).filter((id) => s.sectors[id].z === 0 && !isSafe(s.sectors[id]) && !planned((t) => 'target' in t && t.target === id))
    .sort((a, b) => s.sectors[a].control - s.sectors[b].control);
  while (avail().length) {
    const id = unsafe()[0];
    if (!id || !set(by((c) => c.stats.nerver)[0], { type: 'vakt', target: id })) break;
  }

  // 8) Lage utstyr hvis noen mangler våpen
  const unarmed = s.crew.some((c) => !c.gear.vapen) && !s.stash.some((k) => CARDS[k.def].slot === 'vapen');
  if (unarmed && s.res.skrap >= LAGE_COST.skrap && s.res.tre >= LAGE_COST.tre) set(by((c) => c.stats.mekk)[0], { type: 'lage' });

  // Resten: bygg portene videre mot nivå 3, hold vakt ved portene, ellers hvil.
  // Materialene spares til portene under nivå 2 så lenge noen av dem mangler.
  for (const g of [...GATE_IDS].sort((a, b) => s.gates[a].level - s.gates[b].level)) {
    if (!avail().length) break;
    const c = by((c) => buildPower(s, c))[0];
    const build = s.gates[g].level < 3 && materials(s) > 0 && (s.gates[g].level < 2 || !gatesLeft || materials(s) > 8);
    if (!(build && set(c, { type: 'befeste', target: g }))) set(c, { type: 'vakt', target: g });
  }
  for (const c of free) c.task = plan.get(c) ?? { type: 'hvile' };
}

/** Hva boten synes om en endring: liv og helse teller mest, så mat og vann, så resten. */
function value(a: GameState, b: GameState): number {
  const d = delta(a, b);
  const res = (k: keyof GameState['res'], w: number) => (d.res[k] ?? 0) * w;
  return res('mat', 1.5) + res('vann', 1.2) + res('medisin', 2) + res('tre', 0.6) + res('skrap', 0.6) + res('drivstoff', 0.3)
    + d.moral * 0.3 + d.cards.length * 3 + d.joined.length * 12 - d.hurt.length * 6 - d.lost.length * 30 - d.gone.length * 4
    - Math.max(0, d.zombies) * 2 + Math.max(0, -d.zombies) + d.scouted + d.control * 0.05 + d.searched * 0.05
    + Object.values(d.gateWork).reduce((n, w) => n + (w ?? 0), 0) * 0.8;
}

/** Hendelsesvalget med best forventet verdi, prøvd ut på kopier slik en spiller ser forhåndsvisningen. */
export function botEventChoice(s: GameState, choices: ChoiceDef[]): ChoiceDef {
  let best = choices[0], bestV = -Infinity;
  for (const ch of choices) {
    let v = 0;
    for (let i = 0; i < 6; i++) {
      const copy = structuredClone(s);
      copy.rng = (s.rng ^ Math.imul(i + 1, 0x85ebca6b)) | 0;
      runChoice(copy, ch);
      v += value(s, copy);
    }
    if (v > bestV) { bestV = v; best = ch; }
  }
  return best;
}

/** Løser dagens ventende hendelse med valget som har best forventet verdi. */
export function botEvent(s: GameState) {
  if (!s.event || s.over) return;
  const e = eventDef(s.event.id), ch = botEventChoice(s, eventChoices(s, e).map((x) => x.ch));
  resolveEvent(s, e.choices.indexOf(ch));
}

/** Løser ventende encounters: det valget med best odds, men tilbaketrekk om noen i gruppa har 1 i liv. */
export function botEncounters(s: GameState) {
  while (s.pending.length && !s.over) {
    const p = s.pending[0], v = describeEncounter(s, p, { preview: false });
    const weak = s.crew.some((c) => p.crew.includes(c.id) && c.hp === 1);
    let idx = v.choices.findIndex((c) => c.retreat);
    if (!weak) {
      const best = v.choices.map((c, i) => ({ c, i })).filter((x) => !x.c.retreat).sort((a, b) => b.c.odds - a.c.odds)[0];
      if (best) idx = best.i;
    }
    resolveEncounter(s, p.pid, idx);
  }
}

/**
 * Tokt-valg: fortsett til toktet er ferdig, men snu når noen i gruppa har 1 i liv eller gruppa har vært ute
 * i TOKT_MAX_STAGES dager uten å bli ferdig. På siste dag betyr «fortsett» å fullføre og få belønningen.
 */
export function botTokts(s: GameState) {
  for (const t of [...s.tokts]) {
    if (!t.awaiting || s.over || s.pending.some((p) => p.toktId === t.id)) continue;
    const done = t.stage >= toktDef(t.id).days;
    const weak = s.crew.some((c) => t.crew.includes(c.id) && c.hp <= 1);
    const d = done ? 'fortsett' : weak || t.stage >= TOKT_MAX_STAGES ? 'snu' : 'fortsett';
    toktDecision(s, t.id, d);
    const st = toktStats(s);
    if (done) st.done++; else if (d === 'snu') st.turned++;
  }
}

/** Telling av bot-tokt per runde, til simuleringen. Ligger utenfor spilltilstanden. */
const TOKT_STATS = new WeakMap<GameState, { done: number; turned: number }>();
export const toktStats = (s: GameState) => {
  let st = TOKT_STATS.get(s);
  if (!st) TOKT_STATS.set(s, (st = { done: 0, turned: 0 }));
  return st;
};

export function playGame(seed: number, neighbors: string[] = BOT_NEIGHBORS, opts: BotOptions = {}): GameState {
  const s = newGame(seed, BOT_SELF, neighbors, opts.difficulty);
  const maxDays = opts.maxDays ?? 80;
  // Uten fase2 spiller boten bare fase 1: en frist som tvinger oss over til fase 2 (normal og hard) avslutter runden.
  while (!s.over && s.phase === 1 && s.day < maxDays) playDay(s, opts);
  if (!opts.fase2) {
    // Fase 1 er vunnet når målet ble nådd og fasen avsluttet (av boten, eller av fristen etter at målet var nådd).
    // Runden merkes som seier, slik balansen i fase 1 alltid er målt.
    if (!s.over && s.phase > 1 && s.forcedPhases === 0) s.over = 'won';
    return s;
  }
  const maxDays2 = s.day + (opts.maxDays ?? 80);
  opts.onDay2?.(s);
  while (!s.over && s.day < maxDays2) { playDay(s, opts); opts.onDay2?.(s); }
  return s;
}

/** Én dag for boten: ordre, dagsoppgjør, og alt som venter på et valg. */
function playDay(s: GameState, opts: BotOptions) {
  botTurn(s, opts);
  resolveDay(s);
  botEvent(s);
  // som i spillet: encounters først (de kan drepe lederen), så ny leder
  botEncounters(s);
  botTokts(s);
  if (!canEndDay(s) && s.crew.length) setLeader(s, s.crew[0].id);
  // avslutter fasen samme dag målet er nådd, når ingenting venter lenger
  if (canEndPhase(s)) endPhase(s);
}
