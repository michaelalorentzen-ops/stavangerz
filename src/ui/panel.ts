// Panelet til høyre: ressurser, mål, valgt sted og crewet.
import {
  DIFFICULTY,
  canEndPhase, craftShortfall, LAGE_COST, nameList, dailyFood, daysLeft, LOW_DAYS, NEIGHBORS, endDayBlocker, dailyWater, GATE_STEPS, AREA, GATES, HEALTH_LABEL, PHASE_RES, phaseProgress, RES, RES_LABEL, SECTORS, sectorIntel,
  housing, mods, skillLevel, STAT_LABEL, STATS, TRAITS, previewTask, taskKey, taskOptions, ZONE_INFO, ZONES, sameTask,
  CARDS, crewLevel, isOnTokt, levelProgress, MAX_LEVEL, stat, toktAvailable, toktDef, TOKTS,
} from '../engine';
import type { TaskOption, TaskPreview, CrewMember, GameState, GateId, SectorId, SectorState, StatKey, Stats, Task, TaskType } from '../engine';
import { bindCards, slotsHtml, statAbbr } from './cards';
import { $, esc, game, HOME_GATE, KIND_ICON, KIND_LABEL, MAP, PANEL_TABS, setTab, ui } from './store';
import type { PanelTab } from './store';

/** Kort forklaring på hver oppgavetype. Vises under nedtrekket og som tooltip. */
export const TASK_HELP: Record<TaskType, string> = {
  rydde: 'Drep zombier og let i kjellere og boder. Farligst, men det er sånn en sone blir trygg.',
  sanke: 'Samle mat, vann og materialer i en sone uten synlige zombier.',
  speide: 'Finn ut hvor mange zombier og hvor farlig en sone er, uten kamp.',
  vakt: 'Hold en port eller en sone. Gir kontroll og stopper inntrengere om natta.',
  befeste: 'Bygg på en sperring med tre og skrap. Høyere nivå gir færre gjennombrudd.',
  lage: 'Bruk 3 skrap og 1 tre på et makeshift-kort. Mekk avgjør om det går.',
  trene: 'Øv på én ferdighet hjemme. Trygt, men gir ikke noe annet.',
  pleie: 'Stell de som hviler, så de blir friske uten medisin.',
  overlevende: 'Bank på dører i en tom bolig. Prat avgjør om noen blir med. Kan vekke zombier.',
  hvile: 'Bli hjemme og kom deg. Skadde bruker medisin om det finnes.',
  tokt: 'Langt ut over flere dager. Stort bytte, stor risiko.',
};

/**
 * Fristen for fasen. Før målet er nådd taper man når den går ut; etter velger spilleren selv
 * når fasen avsluttes, og ved grensen tvinges man over.
 */
export function phaseDeadline(s: GameState): { label: string; days: number; goalReached: boolean; onExpiry: string } | null {
  if (s.over !== null) return null;
  const days = Math.max(0, mods(s).turnCap - (s.day - s.phaseStartDay));
  if (s.goalDay === null) return { label: 'Frist for fasemålet', days, goalReached: false, onExpiry: deadlineText(s) };
  return { label: s.phase < 5 ? `Fase ${s.phase + 1} tvinges om` : 'Fasen avsluttes om', days, goalReached: true, onExpiry: 'Målet er nådd. Fasen avsluttes selv ved fristen.' };
}

/** Hva som skjer når fristen går ut uten at målet er nådd, for gradens pris (DIFFICULTY i phases.ts). */
export function deadlineText(s: Pick<GameState, 'difficulty'>): string {
  const d = DIFFICULTY[s.difficulty].deadline;
  if (!d) return 'Når fristen går ut uten at målet er nådd, er runden tapt.';
  return `Når fristen går ut uten at målet er nådd, går dere videre likevel: sektorer som ikke er trygge faller, moralen synker ${d.moral}, og zombiene muterer ${d.mutations === 1 ? 'en gang ekstra' : `${d.mutations} ganger ekstra`}.`;
}

const daysText = (n: number) => `${n} ${n === 1 ? 'dag' : 'dager'}`;

/** En endringslinje fra motoren er negativ når den starter med minus eller handler om skade, død eller slitasje. */
export function isBadChange(line: string): boolean {
  return /^[−-]/.test(line.trim()) || /skadet|døde|slites|borte for godt|fikk ikke/i.test(line);
}

/** Endringene etter et valg som chips. */
export function changesHtml(lines: string[]): string {
  if (!lines.length) return '';
  return `<div class="pv">${lines.map((l) => `<i class="${isBadChange(l) ? 'bad' : 'good'}">${esc(l)}</i>`).join('')}</div>`;
}

/** En forhåndsvisningslinje som varsler om noe vondt, også uten minus: «kan gi skade», «kan slite utstyr». */
export const isBadPreview = (line: string): boolean => isBadChange(line) || /opptil\s*[−-]|skade|slit|døde|dør\b|borte for godt/i.test(line);

/** Hva et valg kan gi: ok-linjer grønne (røde om de varsler om skade eller tap), fail-linjer røde bak «Feiler:». */
export function previewHtml(p: { ok: string[]; fail: string[] | null }): string {
  if (!p.ok.length && !p.fail?.length) return '';
  return `<span class="pv">${p.ok.map((l) => `<i class="${isBadPreview(l) ? 'bad' : 'good'}">${esc(l)}</i>`).join('')}${p.fail?.length ? `<b class="pv-l">Feiler:</b>${p.fail.map((l) => `<i class="bad">${esc(l)}</i>`).join('')}` : ''}</span>`;
}

export function renderTop() {
  const S = game();
  const food = dailyFood(S), water = dailyWater(S);
  const cell = (k: string, v: number, d = '', low = false) =>
    `<div class="r${low ? ' low' : ''}"><span class="k">${k}</span><span class="v">${v}</span><span class="d">${d}</span></div>`;
  $('day').textContent = `Dag ${S.day}${S.difficulty === 'normal' ? '' : ` · ${DIFFICULTY[S.difficulty].name}`}`;
  const shown = RES.filter((k) => PHASE_RES[S.phase].includes(k) || S.res[k] > 0);
  // forbruk per dag og hvor mange dager lageret holder; rødt under LOW_DAYS
  const detail = (k: string) => (k === 'mat' || k === 'vann'
    ? [`−${k === 'mat' ? food : water}/d · ${daysLeft(S, k)} d`, daysLeft(S, k) < LOW_DAYS] : ['', false]) as [string, boolean];
  $('res').innerHTML =
    shown.map((k) => cell(RES_LABEL[k], S.res[k], ...detail(k))).join('') +
    `<div class="r moral"><span class="k">Moral ${S.moral}</span><span class="bar"><i style="width:${S.moral}%;${S.moral < 30 ? 'background:var(--red)' : ''}"></i></span></div>`;
}

export function renderGoals() {
  const S = game(), p = phaseProgress(S), dl = phaseDeadline(S);
  const row = (txt: string, val: string, done: boolean) => `<div class="goal${done ? ' done' : ''}"><span>${done ? '✓ ' : ''}${txt}</span><b>${val}</b></div>`;
  const tight = dl && dl.days <= 5;
  const deadline = !dl ? '' : dl.goalReached
    ? `<div class="goal deadline${tight ? ' tight' : ''}"><span>${dl.label} <b>${daysText(dl.days)}</b></span>
        <button class="btn small" id="endphase"${canEndPhase(S) ? '' : ' disabled title="Løs det som venter først"'}>Avslutt fase ${S.phase}</button></div>`
    : `<div class="goal deadline${tight ? ' tight' : ''}" title="${esc(dl.onExpiry)}"><span>${dl.label}</span><b>${daysText(dl.days)}</b></div>`;
  const gatesDone = p.gates.filter((g) => g.level >= 2).length;
  // Målene er foldet sammen til én linje, så fanene under får plass. Fristen står alltid synlig.
  $('goals').innerHTML = `<details class="goalbox"${goalsOpen() ? ' open' : ''}>
    <summary><span class="eyebrow">Mål for fase ${S.phase}</span><span class="goalsum">${p.safe}/${p.total} trygge · ${gatesDone}/${p.gates.length} porter</span></summary>
    <div class="goals">
      ${row(`Gjør alle sektorer ${AREA.at} trygge`, `${p.safe}/${p.total}`, p.safe === p.total)}
      ${p.gates.map((g) => row(`${g.name} på nivå 2`, `${g.level}/2`, g.level >= 2)).join('')}
      <div class="hint">Crew ${S.crew.length}/${housing(S)} senger</div>
    </div>
  </details>
  <div class="goals">${deadline}</div>`;
  $('goals').querySelector('details')!.addEventListener('toggle', (e) => setGoalsOpen((e.target as HTMLDetailsElement).open));
}

const GOALS_KEY = 'stavanger-z-goals';
function goalsOpen(): boolean {
  try { return sessionStorage.getItem(GOALS_KEY) === '1'; } catch { return false; }
}
function setGoalsOpen(open: boolean) {
  try { sessionStorage.setItem(GOALS_KEY, open ? '1' : '0'); } catch { /* lagring er bare en bekvemmelighet */ }
}

const TAB_LABEL: Record<PanelTab, string> = { sted: 'Sted', crew: 'Crew', lager: 'Lager', logg: 'Logg' };

/** Fanene i panelet. Bare valgt fane vises, de andre tegnes men skjules. */
export function renderTabs() {
  const S = game();
  const count: Partial<Record<PanelTab, number>> = { crew: S.crew.length, lager: S.stash.length };
  $('tabs').innerHTML = PANEL_TABS.map((t) => `<button role="tab" id="tab-${t}" data-tab="${t}" aria-selected="${ui.tab === t}" aria-controls="pane-${t}">${TAB_LABEL[t]}${count[t] !== undefined ? ` <small>${count[t]}</small>` : ''}</button>`).join('');
  for (const t of PANEL_TABS) $(`pane-${t}`).hidden = ui.tab !== t;
}

export function showTab(t: PanelTab) {
  setTab(t);
  renderTabs();
}

/** Loggen fra tidligere dager, nyest først. */
export function renderLog() {
  const S = game();
  $('log').innerHTML = S.log.length
    ? [...S.log].reverse().map((d) => `<div class="logday"><p class="eyebrow">Dag ${d.day}</p><div class="logl">${d.lines.map((l) => `<div class="${l.kind}">${esc(l.t)}</div>`).join('') || '<div>En stille dag.</div>'}</div></div>`).join('')
    : '<p class="hint">Ingenting å melde ennå. Vaktloggen fylles når dagen er over.</p>';
}

function taskShort(t: Task): string {
  if (t.type === 'hvile') return 'hviler';
  if (t.type === 'lage') return 'lager utstyr';
  if (t.type === 'pleie') return 'pleier';
  if (t.type === 'trene') return `trener ${STAT_LABEL[t.stat].toLowerCase()}`;
  if (t.type === 'befeste') return 'bygger';
  if (t.type === 'vakt') return `vakt ${t.target in GATES ? GATES[t.target as GateId].name : SECTORS[t.target as SectorId].short}`;
  if (t.type === 'tokt') return `på tokt: ${toktDef(t.target).name}`;
  const verb = { rydde: 'rydder', sanke: 'sanker', speide: 'speider', overlevende: 'leter etter overlevende' }[t.type];
  return `${verb} ${SECTORS[t.target].short}`;
}


/** Oppdragene i nedtrekksmenyen, gruppert slik at det vanligste står øverst. */
export function taskGroups(opts: TaskOption[]): { label: string; opts: TaskOption[] }[] {
  const groups: [string, (o: TaskOption) => boolean][] = [
    ['Hjemme', (o) => ['hvile', 'pleie', 'lage'].includes(o.type)],
    ['Rydde', (o) => o.type === 'rydde'],
    ['Sanke', (o) => o.type === 'sanke'],
    ['Speide, vakt og overlevende', (o) => ['speide', 'overlevende'].includes(o.type) || (o.type === 'vakt' && o.target in SECTORS)],
    ['Porter', (o) => o.type === 'befeste' || (o.type === 'vakt' && o.target in GATES)],
    ['Tokt', (o) => o.type === 'tokt'],
    ['Trene', (o) => o.type === 'trene'],
  ];
  return groups.map(([label, f]) => ({ label, opts: opts.filter(f) })).filter((g) => g.opts.length);
}

const pct = (x: number) => `${Math.round(x * 100)} %`;
const num = (x: number) => (Math.round(x * 10) / 10).toString().replace('.', ',');

/** Forhåndsvisningen som kort tekst: «~3 drap · skaderisiko 12 % · knipe 30 %». */
export function previewText(p: TaskPreview): string {
  if (p.kind === 'sanke') {
    const got = RES.filter((r) => p.yield[r]).map((r) => `${num(p.yield[r]!)} ${RES_LABEL[r].toLowerCase()}`);
    return `~${got.join(', ') || 'ingenting'}`;
  }
  const knipe = `knipe ${pct(p.encounter)}`;
  if (p.kind === 'rydde-tom') return `~${Math.round(p.searchGain)} % mer gjennomsøkt · ${knipe}`;
  const lo = Math.min(...p.risk.map((r) => r.risk)), hi = Math.max(...p.risk.map((r) => r.risk));
  const risk = Math.round(lo * 100) === Math.round(hi * 100) ? pct(hi) : `${Math.round(lo * 100)}–${Math.round(hi * 100)} %`;
  return `~${num(p.kills)} av ${p.zombies} drap · skaderisiko ${risk} · ${knipe}`;
}

/** Tooltip med skaderisiko per person. */
const riskTitle = (p: TaskPreview): string => (p.kind === 'rydde' ? `Skaderisiko: ${p.risk.map((r) => `${r.name} ${pct(r.risk)}`).join(', ')}` : '');

/** Ordren uten visningsteksten. */
const bare = (o: Task & { label?: string }): Task => { const { label: _label, ...t } = o; return t as Task; };
const ACT_LABEL: Partial<Record<TaskType, string>> = { rydde: 'Rydde', sanke: 'Sanke', speide: 'Speide', vakt: 'Vakt', overlevende: 'Overlevende', befeste: 'Befeste', tokt: 'Tokt' };

function crewChips(isMine: (c: CrewMember) => boolean) {
  return `<div class="chips">${game().crew.map((c) => {
    const on = isMine(c);
    const cur = c.task.type === 'hvile' ? 'hviler' : on ? '' : taskShort(c.task);
    return `<button class="chip" data-crew="${c.id}" aria-pressed="${on}">${esc(c.name)}${cur ? `<small>${cur}</small>` : ''}</button>`;
  }).join('')}</div>`;
}

/** Kobler crew-knappene i kortet til en ordre som slås av og på. */
function bindChips(box: HTMLElement, isMine: (c: CrewMember) => boolean, task: () => Task) {
  box.querySelectorAll<HTMLButtonElement>('[data-crew]').forEach((b) => b.addEventListener('click', () => {
    const c = game().crew.find((x) => x.id === b.dataset.crew)!;
    if (isOnTokt(game(), c)) return; // de som er ute er låst til toktet
    c.task = isMine(c) ? { type: 'hvile' } : task();
    ui.refresh();
  }));
}

/** Belønningen for et tokt, som tekst. Unike kort navngis ikke. */
function rewardText(id: string): string {
  const r = toktDef(id).reward, parts: string[] = [];
  for (const [k, n] of Object.entries(r.res ?? {})) parts.push(`${n} ${RES_LABEL[k as keyof typeof RES_LABEL].toLowerCase()}`);
  for (const c of r.cards ?? []) parts.push(CARDS[c].rarity === 'unik' ? 'et unikt kort' : CARDS[c].name);
  const d = toktDef(id), S = game();
  if (d.reward.joins) parts.push(`${NEIGHBORS.find((n) => n.id === d.reward.joins)?.name ?? 'en overlevende'} blir med`);
  const notes: string[] = [];
  if (S.toktsDone.includes(id) && d.repeat) notes.push(`stedet er delvis tømt, så belønningen er ${Math.round(d.repeat * 100)} % av første gang`);
  else if (d.safeFirst) notes.push('første tur er trygg: ingen knipe og ingen skader');
  if (d.recruit) notes.push(`underveis kan dere finne overlevende (${Math.round(d.recruit * 100)} % per dag)`);
  return (parts.join(', ') || 'ingenting') + (notes.length ? `. ${notes.map((n) => n[0].toUpperCase() + n.slice(1)).join('. ')}` : '');
}

/** Tokt-kort for et mål: utgjør både ledige tokt (med crew-knapper) og de som er ute. */
function toktCards(S: GameState, at: string): string {
  return TOKTS.filter((d) => d.at === at).map((d) => {
    const active = S.tokts.find((t) => t.id === d.id);
    if (!active && !toktAvailable(S, d)) return '';
    const mine = (c: CrewMember) => c.task.type === 'tokt' && c.task.target === d.id;
    const metrics = `<div class="metrics"><div class="metric"><div class="k">Varighet</div><div class="v">${d.days}<small> dager</small></div></div>
      <div class="metric"><div class="k">Trussel</div><div class="v">${d.threat}<small>/5</small></div></div></div>`;
    const body = active
      ? `<p class="hint">Gruppa er ute: dag ${active.stage} av ${d.days}${active.awaiting ? ', venter på beslutning' : ''}.</p>`
      : `<p class="eyebrow" style="margin:0">Send på tokt</p>${crewChips(mine)}`;
    return `<div class="card tokt" data-tokt="${d.id}"><span class="badge ${d.quest ? 'inf' : 'clr'}">${d.quest ? 'Quest' : 'Tokt'}</span><h2>${esc(d.name)}</h2><p>${esc(d.desc)}</p>
      ${metrics}<p class="hint">Belønning: ${rewardText(d.id)}. Alt som finnes underveis kommer med hjem om dere snur.</p>${body}</div>`;
  }).join('');
}

function bindToktCards(box: HTMLElement, S: GameState) {
  box.querySelectorAll<HTMLElement>('[data-tokt]').forEach((card) => {
    const d = TOKTS.find((x) => x.id === card.dataset.tokt)!;
    if (S.tokts.some((t) => t.id === d.id)) return;
    bindChips(card, (c) => c.task.type === 'tokt' && c.task.target === d.id, () => ({ type: 'tokt', target: d.id }));
  });
}

/**
 * Lengden på infeksjonsstolpen i prosent. Null betyr ukjent: for en sektor dere ikke har sett,
 * vises en ubestemt stolpe, siden den sanne mengden ellers ville lekket ut.
 */
export function infBar(sec: Pick<SectorState, 'z' | 'seen'>, startZ: number): number | null {
  if (sec.z <= 0) return 0;
  if (!sec.seen) return null;
  return Math.min(100, (sec.z / Math.max(1, startZ)) * 100);
}

/** Teksten på knappen når noe hindrer at dagen avsluttes. Samme ordlyd i panelet og i dagsrapporten. */
export function blockerLabel(s: GameState): string | null {
  const b = endDayBlocker(s);
  if (b === 'event') return 'Samband: ny melding';
  if (b === 'pending') return s.pending.length > 1 ? `${s.pending.length} kniper venter` : 'Knipe venter';
  if (b === 'tokt') return 'Toktet venter på deg';
  if (b === 'leader') return 'Hvem tar over?';
  return null;
}

function lootHint(sec: SectorState) {
  const tiers = Object.entries(sec.loot).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (!tiers.length) return 'Tømt for alt nyttig.';
  return 'Rykter om: ' + tiers.slice(0, 3).map(([k, v]) => `${v >= 10 ? 'mye ' : v >= 4 ? '' : 'litt '}${RES_LABEL[k as keyof typeof RES_LABEL].toLowerCase()}`).join(', ') + '.';
}

export function renderSel() {
  const S = game(), sel = ui.sel, box = $('sel');

  if (sel.kind === 'sector' && SECTORS[sel.id].locked) {
    const ld = SECTORS[sel.id];
    box.innerHTML = `<div class="card"><span class="badge lock">Horde · Fase 2</span><h2>${ld.name}</h2><p>${ld.desc}</p>
      <div class="metrics"><div class="metric"><div class="k">Horde</div><div class="v">60–120</div></div>
      <div class="metric"><div class="k">Kapasitet</div><div class="v">???</div></div><div class="metric"><div class="k">Forsvar</div><div class="v">???</div></div></div>
      <p class="hint">Dette er HQ-et ditt i fase 2. De ekte HQ-verdiene er skjulte. Hold ${GATES[HOME_GATE].name} oppe så horden blir der den er.</p></div>`;
    return;
  }

  if (sel.kind === 'zone') {
    const z = MAP.zones.find((z) => z.id === sel.id)!;
    box.innerHTML = `<div class="card"><span class="badge fog">Ukjent sone</span><h2>${esc(ZONES[z.id].name)}</h2><p>${ZONE_INFO[z.id] ?? ''}</p><p class="hint">Utenfor rekkevidde i fase 1. Sikre ${AREA.name} først.</p></div>`;
    return;
  }

  if (sel.kind === 'gate') {
    const id = sel.id, gd = GATES[id], st = S.gates[id];
    const ready = S.sectors[gd.sector].z === 0;
    const next = GATE_STEPS[Math.min(3, st.level + 1)], prev = GATE_STEPS[st.level];
    const pct = st.level >= 3 ? 100 : Math.round(((st.work - prev) / (next - prev)) * 100);
    const gopts = taskOptions(S).filter((o) => 'target' in o && o.target === id);
    const gacts = gopts.map((o) => o.type);
    // uten eget valg står knappen på det laget allerede er satt til
    if (!gacts.includes(ui.selAction as never)) ui.selAction = gopts.find((o) => S.crew.some((c) => sameTask(c.task, bare(o))))?.type ?? gacts[0] ?? null;
    const gact = gopts.find((o) => o.type === ui.selAction);
    const gtask = gact ? bare(gact) : null;
    const mine = (c: CrewMember) => !!gtask && sameTask(c.task, gtask);
    box.innerHTML = `<div class="card"><span class="badge ${st.level ? 'clr' : 'inf'}">Sperring · nivå ${st.level}/3</span><h2>${gd.name}</h2><p>${gd.desc}</p>
      <div><div class="hint">${st.level >= 3 ? 'Fullt utbygd.' : `Fram til nivå ${st.level + 1}: ${pct}%`}</div><div class="prog"><i style="width:${pct}%"></i></div></div>
      <p class="hint">${ready ? 'Mekk teller mest. Hver arbeidsdag bruker tre og skrap.' : `Rydd ${SECTORS[gd.sector].short} før dere kan bygge her.`}</p>
      ${gacts.length > 1 ? `<div class="seg" role="group">${gacts.map((a) => `<button data-act="${a}" aria-pressed="${a === ui.selAction}">${ACT_LABEL[a]}</button>`).join('')}</div>` : ''}
      ${gtask ? `<p class="eyebrow" style="margin:0">Send til ${ACT_LABEL[gtask.type]!.toLowerCase()}</p>${crewChips(mine)}` : ''}</div>`;
    box.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) => b.addEventListener('click', () => { ui.selAction = b.dataset.act as TaskType; renderSel(); }));
    if (gtask) bindChips(box, mine, () => gtask);
    box.insertAdjacentHTML('beforeend', toktCards(S, id));
    bindToktCards(box, S);
    return;
  }

  const id = sel.id as SectorId; // låste sektorer er håndtert over
  const sec = S.sectors[id], intel = sectorIntel(S, id), def = SECTORS[id];
  const inf = sec.z > 0;
  const sopts = taskOptions(S).filter((o) => 'target' in o && o.target === id);
  const actions = sopts.map((o) => o.type);
  if (!actions.includes(ui.selAction as never)) ui.selAction = sopts.find((o) => S.crew.some((c) => sameTask(c.task, bare(o))))?.type ?? actions[0] ?? null;
  const act = ui.selAction;
  const actLabel = ACT_LABEL as Record<string, string>;
  const picked = sopts.find((o) => o.type === act);
  const task: Task | null = picked ? bare(picked) : null;
  const mine = (c: CrewMember) => !!task && sameTask(c.task, task);
  const bar = (cls: string, label: string, pct: number | null, val: string) =>
    `<div class="bar-row ${cls}${pct === null ? ' unknown' : ''}"><span>${label}</span><span class="tr"><i style="width:${pct === null ? 100 : Math.max(0, Math.min(100, pct))}%"></i></span><b>${val}</b></div>`;
  const infPct = infBar(sec, def.z);
  const team = task ? S.crew.filter(mine) : [];
  const pv = task ? previewTask(S, task, team) : null;
  const previewLine = !task || !['rydde', 'sanke'].includes(task.type) ? ''
    : pv ? `<p class="preview" title="${esc(riskTitle(pv))}"><b>${team.length > 1 ? 'Forventet for gruppa' : 'Forventet'}:</b> ${esc(previewText(pv))}</p>`
    : `<p class="hint">Velg hvem som går, så ser du hva det kan gi.</p>`;
  const housingNote = def.capacity > 0 ? `Plass til ${def.capacity}${sec.settled ? ', bosatt' : ', når den er trygg'}.` : 'Ingen boliger her.';
  box.innerHTML = `<div class="card">
    <span class="badge ${intel.safe ? 'safe' : inf ? 'inf' : 'clr'}">${intel.safe ? 'Trygg' : inf ? 'Infisert' : 'Ryddet'}${id === 'hjem' ? ' · Du bor her' : ''}</span>
    <h2>${def.name}</h2>${def.real !== def.name ? `<p class="real">${def.real}</p>` : ""}<p>${def.desc}</p>
    <div class="metrics">
      <div class="metric"><div class="k">Type</div><div class="v">${KIND_ICON[def.kind]} <small>${KIND_LABEL[def.kind]}</small></div></div>
      <div class="metric"><div class="k">Trussel</div><div class="v">${intel.threat ?? '?'}<small>/5</small></div></div>
      <div class="metric"><div class="k">Bolig</div><div class="v">${def.capacity}${sec.settled && def.capacity ? ' <small>bosatt</small>' : ''}</div></div>
    </div>
    <div class="bars">
      ${bar('inf', 'Infisert', infPct, `${intel.estimate}${!sec.seen && inf ? ' ?' : ''}`)}
      ${bar('', 'Gjennomsøkt', intel.searched, `${intel.searched}%`)}
      ${bar('ctl', 'Kontroll', intel.control, `${intel.control}%`)}
    </div>
    ${intel.hidden !== null ? `<p class="hint">Regnearket: ${intel.hidden} gjemt i kjellere og boder.</p>` : ''}
    <p class="hint">${inf ? 'Muskler og Nerver dreper zombier. Rydd flere sammen for å unngå skader.' : `${lootHint(sec)} ${intel.safe ? '' : 'Rydd til sektoren er gjennomsøkt, og hold kontrollen oppe, ellers siver de inn igjen.'}`} ${housingNote}</p>
    ${actions.length > 1 ? `<div class="seg" role="group">${actions.map((a) => `<button data-act="${a}" aria-pressed="${a === act}">${actLabel[a]}</button>`).join('')}</div>` : ''}
    ${act && task ? `<p class="eyebrow" style="margin:0">Send til ${actLabel[act].toLowerCase()}</p>${crewChips(mine)}${previewLine}` : '<p class="hint">Ingenting mer å gjøre her.</p>'}
  </div>`;
  box.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) => b.addEventListener('click', () => { ui.selAction = b.dataset.act as TaskType; renderSel(); }));
  if (task) bindChips(box, mine, () => task);
  box.insertAdjacentHTML('beforeend', toktCards(S, id));
  bindToktCards(box, S);
}

/**
 * Ferdigheter som stolpe og nivånavn. Grunnverdien er den lyse stolpen, `bonus` (utstyr, nivå og egenskap)
 * en grønn forlengelse. Tallene står bare i tooltipen.
 */
export function statPips(st: Stats, bonus: Partial<Stats> = {}) {
  return STATS.map((k) => {
    const base = Math.round(st[k]), extra = Math.max(0, Math.round(bonus[k] ?? 0)), total = Math.min(100, base + extra);
    const tip = extra ? `${STAT_LABEL[k]}: ${skillLevel(total)} · ${base} + ${extra} fra utstyr, nivå og egenskap = ${total}` : `${STAT_LABEL[k]}: ${skillLevel(base)} · ${base}`;
    return `<div class="st" title="${tip}">${statAbbr(k)}<div class="sbar"><i style="width:${base}%"></i>${extra ? `<i class="plus" style="width:${total - base}%"></i>` : ''}</div><small>${skillLevel(total)}</small></div>`;
  }).join('');
}

/** Det personen får i tillegg til grunnverdien: utstyr, nivå og egenskap, som motoren regner det. */
export const statBonus = (c: CrewMember): Partial<Stats> =>
  Object.fromEntries(STATS.map((k: StatKey) => [k, stat(c, k) - c.stats[k]]));

const hpHtml = (c: CrewMember) => `<span class="hp h${c.hp}" title="${HEALTH_LABEL[c.hp]}">${[1, 2, 3].map((i) => `<i class="${i <= c.hp ? 'on' : ''}"></i>`).join('')}</span>`;

export function renderCrew() {
  const S = game(), opts = taskOptions(S), short = craftShortfall(S);
  if (ui.openCrew && !S.crew.some((c) => c.id === ui.openCrew)) ui.openCrew = null;
  $('crew').innerHTML = S.crew.map((c) => {
    const open = ui.openCrew === c.id, away = isOnTokt(S, c);
    const xp = c.xp ?? 0, lvl = crewLevel(xp), prog = Math.round(levelProgress(xp) * 100);
    const help = TASK_HELP[c.task.type];
    const noMats = c.task.type === 'lage' && short.has(c.id);
    const select = away
      ? `<select data-crew="${c.id}" disabled aria-label="Oppdrag for ${esc(c.name)}" title="${esc(help)}"><option>${esc(taskShort(c.task))}</option></select>`
      : `<select data-crew="${c.id}" aria-label="Oppdrag for ${esc(c.name)}" title="${esc(help)}">${taskGroups(opts).map((g) => `<optgroup label="${g.label}">${g.opts.map((o) => `<option value="${taskKey(o)}"${sameTask(o, c.task) ? ' selected' : ''}>${o.type === 'tokt' ? o.label.replace(/^Tokt: /, '') : o.label}</option>`).join('')}</optgroup>`).join('')}</select>`;
    const more = open ? `<div class="cm-more">
        <p class="task-help">${esc(help)}</p>
        <div class="tr">${esc(c.role)}. <b>${TRAITS[c.trait].name}:</b> ${TRAITS[c.trait].desc}</div>
        <div class="lvlrow" title="${lvl >= MAX_LEVEL ? 'Høyeste nivå' : `${prog} % mot Nv ${lvl + 1}`}"><span>Nv ${lvl}</span><span class="prog"><i style="width:${prog}%"></i></span><span>${lvl >= MAX_LEVEL ? 'maks' : `Nv ${lvl + 1}`}</span></div>
        <div class="statrow">${statPips(c.stats, statBonus(c))}</div>
      </div>` : '';
    return `<div class="cm${c.task.type !== 'hvile' ? ' busy' : ''}${open ? ' open' : ''}" data-row="${c.id}">
      <button class="cm-tog" data-toggle="${c.id}" aria-expanded="${open}" title="${open ? 'Fold sammen' : 'Vis ferdigheter og utstyr'}">
        <span class="nm">${esc(c.name)}</span><span class="lvl" title="Nivå ${lvl}">Nv ${lvl}</span>${hpHtml(c)}<span class="chev" aria-hidden="true">${open ? '▴' : '▾'}</span></button>
      ${select}
      ${noMats ? `<p class="task-help low" style="grid-column:1/-1">Mangler materialer: ${LAGE_COST.skrap} skrap og ${LAGE_COST.tre} tre per forsøk.</p>` : ''}
      ${slotsHtml(c, open)}
      ${more}
    </div>`;
  }).join('');
  bindCards($('crew'));
  const toggle = (id: string) => { ui.openCrew = ui.openCrew === id ? null : id; if (ui.openCrew !== id && ui.picker?.crewId === id) ui.picker = null; renderCrew(); };
  $('crew').querySelectorAll<HTMLElement>('[data-row]').forEach((row) => row.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    // knapper, nedtrekk og velgeren har egne handlinger; resten av raden folder ut
    if (t.closest('select, .slots, .picker, .cm-more, a, input') || (t.closest('button') && !t.closest('[data-toggle]'))) return;
    toggle(row.dataset.row!);
  }));
  $('crew').querySelectorAll<HTMLSelectElement>('select').forEach((s) => s.addEventListener('change', () => {
    const c = S.crew.find((x) => x.id === s.dataset.crew)!;
    const o = opts.find((o) => taskKey(o) === s.value);
    if (o) c.task = bare(o);
    ui.refresh();
  }));
}

export function renderPlan() {
  const S = game(), groups: Record<string, string[]> = {};
  for (const c of S.crew) {
    const k = c.task.type === 'befeste' ? `bygger ${GATES[c.task.target].name}` : taskShort(c.task);
    (groups[k] ??= []).push(c.name);
  }
  const noMats = [...craftShortfall(S)].map((id) => S.crew.find((c) => c.id === id)!.name);
  $('plan').textContent = Object.entries(groups).map(([k, v]) => `${nameList(v)} ${k}`).join(' · ') + (noMats.length ? ` · Mangler materialer til å lage utstyr (${nameList(noMats)})` : '');
  $('end').textContent = blockerLabel(S) ?? `Avslutt dag ${S.day}`;
  // knappen åpner encounters og ledervalg selv, så den er aldri sperret av dem
  $<HTMLButtonElement>('end').disabled = false;
}
