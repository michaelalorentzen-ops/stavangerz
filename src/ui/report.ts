// Dagsrapporten i tall: hva dagen og natta ga og tok, som ikoner med + i grønt og − i rødt.
// Regnes ut av tilstanden før og etter resolveDay (delta i motoren) og dagens logglinjer. Bare visning.
import { delta, gateAlerts, HEALTH_LABEL, RES, RES_LABEL } from '../engine';
import type { CrewMember, GameState, GateAlertLevel, LogLine, ResKey, TraitId } from '../engine';
import { avatar } from './avatar';
import { icon } from './icons';
import { esc } from './store';

export interface PersonRef { id: string; name: string; trait?: TraitId; hp: number; /** forlot crewet i stedet for å dø */ left?: boolean }

export interface DaySummary {
  res: Partial<Record<ResKey, number>>;
  moral: number;
  cards: string[];
  hurt: PersonRef[];
  healed: PersonRef[];
  lost: PersonRef[];
  joined: PersonRef[];
  kills: number;
  /** zombier som kom forbi en port om natta */
  breach: number;
  /** zombier som brøt ut av glemte kjellere */
  outbreak: number;
  /** varsler ved portene etter natta: alle røde, og gule som er nye siden i går */
  alerts?: { level: GateAlertLevel; text: string }[];
}

const ref = (c: CrewMember): PersonRef => ({ id: c.id, name: c.name, trait: c.trait, hp: c.hp });

/** Tallet foran «kom forbi» og «strømmer ut» i nattlinjene. */
function nightCount(lines: LogLine[], re: RegExp): number {
  return lines.reduce((n, l) => { const m = re.exec(l.t); return n + (m ? Number(m[1]) : 0); }, 0);
}

/** Sammendraget av en dag. `before` er en kopi tatt før resolveDay, `after` tilstanden etterpå. */
export function summarizeDay(before: GameState, after: GameState, lines: LogLine[]): DaySummary {
  const d = delta(before, after);
  const hurt: PersonRef[] = [], healed: PersonRef[] = [], lost: PersonRef[] = [];
  for (const c of before.crew) {
    const now = after.crew.find((x) => x.id === c.id);
    if (!now) lost.push({ ...ref(c), hp: 0, left: !d.lost.includes(c.name) });
    else if (now.hp < c.hp) hurt.push(ref(now));
    else if (now.hp > c.hp) healed.push(ref(now));
  }
  return {
    res: d.res, moral: d.moral, cards: d.cards, hurt, healed, lost,
    joined: after.crew.filter((c) => !before.crew.some((x) => x.id === c.id)).map(ref),
    kills: Math.max(0, after.stats.kills - before.stats.kills),
    breach: nightCount(lines, /^Natt: (\d+) zombier? kom forbi/),
    outbreak: nightCount(lines, /(\d+) zombier strømmer ut/),
    alerts: newGateAlerts(before, after),
  };
}

/**
 * Portvarslene etter natta. Røde vises hver dag. Gule bare når porten var i orden i går, så rapporten ikke gjentar
 * det samme hver morgen; de står uansett over «Avslutt dag» og på kartet.
 */
function newGateAlerts(before: GameState, after: GameState): { level: GateAlertLevel; text: string }[] {
  const was = gateAlerts(before);
  return gateAlerts(after).filter((a) => a.level === 'rød' || !was.some((b) => b.gate === a.gate)).map(({ level, text }) => ({ level, text }));
}

export const isQuiet = (s: DaySummary): boolean =>
  !s.alerts?.length && !Object.keys(s.res).length && !s.moral && !s.cards.length && !s.hurt.length && !s.healed.length && !s.lost.length && !s.joined.length && !s.kills && !s.breach && !s.outbreak;

const sgn = (n: number) => (n > 0 ? `+${n}` : `−${-n}`);

/** Sammendraget som en rad med ikonbrikker. Gevinster først, så tap, så folk. */
export function summaryHtml(s: DaySummary): string {
  if (isQuiet(s)) return '';
  const chip = (cls: string, ic: string, val: string, title: string) =>
    `<span class="sx ${cls}" title="${esc(title)}">${ic}<b>${esc(val)}</b></span>`;
  const resChips = RES.filter((k) => s.res[k]).map((k) => {
    const n = s.res[k]!;
    return chip(n > 0 ? 'up' : 'down', icon(k), sgn(n), `${RES_LABEL[k]} ${sgn(n)}`);
  });
  const stuff = [
    ...resChips,
    s.cards.length ? chip('up', icon('utstyr'), `+${s.cards.length}`, `Nytt utstyr: ${s.cards.join(', ')}`) : '',
    s.kills ? chip('up', icon('drap'), `${s.kills} drept`, `${s.kills} ${s.kills === 1 ? 'zombie' : 'zombier'} drept`) : '',
    s.moral ? chip(s.moral > 0 ? 'up' : 'down', icon('moral'), sgn(s.moral), `Moral ${sgn(s.moral)}`) : '',
    s.breach ? chip('down', icon('port'), `${s.breach} inn`, `${s.breach} kom forbi sperringene i natt`) : '',
    s.outbreak ? chip('down', icon('zombie'), `${s.outbreak} ut`, `${s.outbreak} brøt ut av en glemt kjeller`) : '',
  ].filter(Boolean);
  const person = (p: PersonRef, cls: string, ic: string, what: string) =>
    `<span class="sp ${cls}" title="${esc(`${p.name}: ${what}`)}">${avatar({ ...p, hp: Math.max(1, p.hp) }, 26)}${icon(ic)}<b>${esc(p.name)}</b><small>${esc(what)}</small></span>`;
  const people = [
    ...s.lost.map((p) => (p.left ? person(p, 'dead', 'borte', 'dro sin vei') : person(p, 'dead', 'dod', 'død'))),
    ...s.hurt.map((p) => person(p, p.hp <= 1 ? 'h1' : 'h2', 'skadet', p.hp <= 1 ? 'hardt skadet' : HEALTH_LABEL[p.hp].toLowerCase())),
    ...s.joined.map((p) => person(p, 'join', 'nyPerson', 'ny i crewet')),
    ...s.healed.map((p) => person(p, 'heal', 'hjerte', p.hp >= 3 ? 'frisk' : 'bedre')),
  ];
  const alerts = (s.alerts ?? []).map((a) =>
    `<div class="gatealert ${a.level === 'rød' ? 'rod' : 'gul'}">${icon('port')}<b>${a.level === 'rød' ? 'Vokser fra dere' : 'Porten står ubevoktet'}</b><span>${esc(a.text)}</span></div>`);
  return `<div class="sumx">${alerts.join('')}${stuff.length ? `<div class="sx-row">${stuff.join('')}</div>` : ''}${people.length ? `<div class="sp-row">${people.join('')}</div>` : ''}</div>`;
}

/** Sammendragene lagres per seed og dag, så loggfanen kan vise dem igjen. Bare en bekvemmelighet. */
const KEY = (seed: number) => `stavanger-z-dager-${seed}`;
const MAX_DAYS = 40;

function readAll(seed: number): Record<string, DaySummary> {
  try { const t = localStorage.getItem(KEY(seed)); return t ? JSON.parse(t) as Record<string, DaySummary> : {}; } catch { return {}; }
}

export function rememberDay(seed: number, day: number, s: DaySummary) {
  try {
    const all = readAll(seed);
    all[day] = s;
    const days = Object.keys(all).map(Number).sort((a, b) => a - b);
    for (const d of days.slice(0, Math.max(0, days.length - MAX_DAYS))) delete all[d];
    localStorage.setItem(KEY(seed), JSON.stringify(all));
  } catch { /* uten lagring vises sammendraget bare i dagsrapporten */ }
}

export function recallDays(seed: number): Record<string, DaySummary> {
  return readAll(seed);
}
