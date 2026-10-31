// Panelet til høyre: ressurser, mål, valgt sted og crewet.
import {
  DIFFICULTY, goalReachedText,
  canEndPhase, craftShortfall, LAGE_COST, nameList, dailyFood, daysLeft, LOW_DAYS, NEIGHBORS, endDayBlocker, dailyWater, GATE_STEPS, AREA, GATES, HEALTH_LABEL, PHASE_RES, phaseProgress, RES, RES_LABEL, SECTORS, sectorIntel,
  housing, mods, skillLevel, STAT_LABEL, STATS, TRAITS, previewTask, taskKey, taskOptions, ZONE_INFO, ZONES, sameTask,
  CARDS, crewLevel, isOnTokt, levelProgress, MAX_LEVEL, stat, toktAvailable, toktDays, toktDef, TOKTS,
  applyPlan, deletePlan, MAX_PLANS, repeatYesterday, savePlan, gateAlerts, GATE_STRAGGLERS,
  BUILT_PHASES, bussToktText, gateQuiet, COND_LABEL, dailyFoodIn, dailyHeat, moralHighText, moralLowText, MORAL_DESERT, MORAL_HIGH, MORAL_MID, FACILITIES, FACILITY_IDS, facilityIntel, HQ_SECTOR, ISTAND_STRAGGLERS, ISTAND_WORK, istandMaterials, isLocked, POST_IDS, postEffect, postHolder, POSTS,
} from '../engine';
import type { ResKey, TaskOption, TaskPreview, CrewMember, FacilityId, GameState, GateId, PostId, SectorId, SectorState, StatKey, Stats, Task, TaskType } from '../engine';
import { bindCards, slotsHtml, statAbbr } from './cards';
import { $, esc, game, HOME_GATE, KIND_ICON, KIND_LABEL, MAP, PANEL_TABS, setTab, ui } from './store';
import type { PanelTab } from './store';
import { avatar } from './avatar';
import { heartsHtml, icon, lineIcon } from './icons';
import { recallDays, summaryHtml } from './report';
import { vaguePreview } from './vague';
import type { VagueLine } from './vague';

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
  post: 'Fast post i HQ-et. Personen blir der fra dag til dag og gir en bonus etter ferdigheten sin, men gjør ikke annet.',
  istand: 'Sett i stand et anlegg i HQ-et. Mekk teller mest, og hver dag bruker metall og skrap.',
  reparere: 'Gi slitt utstyr full holdbarhet i verkstedhallen. Koster skrap per kort.',
};

/**
 * Fristen for fasen. Før målet er nådd gjelder fristen turnCap; etter målet får spilleren graceDays
 * til å farme og velger selv når fasen avsluttes, og når de har gått, tvinges man over.
 */
export function phaseDeadline(s: GameState): { label: string; days: number; goalReached: boolean; onExpiry: string } | null {
  if (s.over !== null) return null;
  const days = Math.max(0, mods(s).turnCap - (s.day - s.phaseStartDay));
  if (s.goalDay === null) return { label: 'Frist for fasemålet', days, goalReached: false, onExpiry: deadlineText(s) };
  const left = Math.min(days, Math.max(0, mods(s).graceDays - (s.day - s.goalDay)));
  return { label: s.phase < BUILT_PHASES ? `Fase ${s.phase + 1} om` : 'Fasen avsluttes om', days: left, goalReached: true, onExpiry: goalReachedText(s) };
}

/** Hva som skjer når fristen går ut uten at målet er nådd, for gradens pris (DIFFICULTY i phases.ts). */
export function deadlineText(s: Pick<GameState, 'difficulty'> & { phase?: GameState['phase'] }): string {
  const d = DIFFICULTY[s.difficulty].deadline;
  // den siste fasen som er bygd har ingen neste fase å tvinge spilleren over i
  if (!d || (s.phase ?? 1) >= BUILT_PHASES) return 'Når fristen går ut uten at målet er nådd, er runden tapt.';
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
  return `<div class="pv">${lines.map((l) => `<i class="${isBadChange(l) ? 'bad' : 'good'}">${lineIcon(l)}${esc(l)}</i>`).join('')}</div>`;
}

/** En forhåndsvisningslinje som varsler om noe vondt, også uten minus: «kan gi skade», «kan slite utstyr». */
export const isBadPreview = (line: string): boolean => isBadChange(line) || /opptil\s*[−-]|skade|slit|døde|dør\b|borte for godt/i.test(line);

/** Hva et valg kan gi: ok-linjer grønne (røde om de varsler om skade eller tap), fail-linjer røde bak «Feiler:». */
export function previewHtml(p: { ok: string[]; fail: string[] | null }): string {
  if (!p.ok.length && !p.fail?.length) return '';
  return `<span class="pv">${p.ok.map((l) => `<i class="${isBadPreview(l) ? 'bad' : 'good'}">${lineIcon(l)}${esc(l)}</i>`).join('')}${p.fail?.length ? `<b class="pv-l">Feiler:</b>${p.fail.map((l) => `<i class="bad">${lineIcon(l)}${esc(l)}</i>`).join('')}` : ''}</span>`;
}

/** Forhåndsvisningen før et valg, uten tall («midt imellom»): retning og risiko, med ikon for ressursen. */
export function vaguePreviewHtml(p: { ok: string[]; fail: string[] | null }): string {
  const v = vaguePreview(p);
  if (!v.ok.length && !v.fail?.length) return '';
  const li = (l: VagueLine, bad = l.bad) => `<i class="${bad ? 'bad' : 'good'}">${l.res ? icon(l.res) : lineIcon(l.text)}${esc(l.text)}</i>`;
  return `<span class="pv">${v.ok.map((l) => li(l)).join('')}${v.fail?.length ? `<b class="pv-l">Feiler:</b>${v.fail.map((l) => li(l, true)).join('')}` : ''}</span>`;
}

export function renderTop() {
  const S = game();
  const food = dailyFood(S), water = dailyWater(S);
  const cell = (k: ResKey, v: number, d = '', low = false, why = '') =>
    `<div class="r r-${k}${low ? ' low' : ''}"${why ? ` title="${esc(why)}"` : ''}>${icon(k, 'ri')}<span class="k">${RES_LABEL[k]}${low ? ' <em class="lowtag">Lavt</em>' : ''}</span><span class="v">${v}</span><span class="d">${d}</span></div>`;
  $('day').textContent = `Dag ${S.day}${S.difficulty === 'normal' ? '' : ` · ${DIFFICULTY[S.difficulty].name}`}`;
  const shown = RES.filter((k) => PHASE_RES[S.phase].includes(k) || S.res[k] > 0);
  // forbruk per dag og hvor mange dager lageret holder; rødt under LOW_DAYS
  // ved til fyring (fra fase 2): forbruk per dag og hvor mange dager veden holder
  const heat = dailyHeat(S), heatDays = heat ? Math.floor(S.res.tre / heat) : 0;
  const hurt = S.crew.filter((c) => c.hp < 3).length;
  const detail = (k: ResKey) => (k === 'mat' || k === 'vann'
    ? [`−${k === 'mat' ? food : water}/d · ${daysLeft(S, k)} d`, daysLeft(S, k) < LOW_DAYS, daysLeft(S, k) < LOW_DAYS ? `${RES_LABEL[k]} holder bare ${daysText(daysLeft(S, k))} til.` : '']
    : k === 'tre' && heat ? [`−${heat}/d ved · ${heatDays} d`, heatDays < LOW_DAYS, heatDays < LOW_DAYS ? `Veden holder bare ${daysText(heatDays)} til.` : '']
    : k === 'medisin' && hurt && S.res.medisin === 0 ? [`${hurt} skadet`, true, 'Tomt for medisin, og noen er skadet.']
    : ['', false, '']) as [string, boolean, string];
  const moralNote = S.moral < MORAL_DESERT ? moralLowText : S.moral >= MORAL_HIGH ? moralHighText : S.moral < MORAL_MID ? 'Lav moral: alle jobber dårligere.' : '';
  $('res').innerHTML =
    shown.map((k) => cell(k, S.res[k], ...detail(k))).join('') +
    `<div class="r moral${S.moral < MORAL_MID ? ' low' : ''}"${moralNote ? ` title="${esc(moralNote)}"` : ''}>${icon('moral', 'ri')}<span class="k">Moral ${S.moral}${S.moral >= MORAL_HIGH ? ' ▲' : S.moral < MORAL_DESERT ? ' ▼' : ''}</span><span class="bar"><i style="width:${S.moral}%;${S.moral < 30 ? 'background:var(--red)' : ''}"></i></span></div>`;
}

export function renderGoals() {
  const S = game(), p = phaseProgress(S), dl = phaseDeadline(S);
  const row = (txt: string, val: string, done: boolean) => `<div class="goal${done ? ' done' : ''}"><span>${done ? '✓ ' : ''}${txt}</span><b>${val}</b></div>`;
  const tight = dl && dl.days <= 5;
  const deadline = !dl ? '' : dl.goalReached
    ? `<div class="goal deadline${tight ? ' tight' : ''}" title="${esc(dl.onExpiry)}"><span>${dl.label} <b>${daysText(dl.days)}</b></span>
        <button class="btn small" id="endphase"${canEndPhase(S) ? '' : ' disabled title="Løs det som venter først"'}>Avslutt fase ${S.phase}</button></div>`
    : `<div class="goal deadline${tight ? ' tight' : ''}" title="${esc(dl.onExpiry)}"><span>${dl.label}</span><b>${daysText(dl.days)}</b></div>`;
  // Målene er foldet sammen til én linje, så fanene under får plass. Fristen står alltid synlig.
  $('goals').innerHTML = `<details class="goalbox"${goalsOpen() ? ' open' : ''}>
    <summary><span class="eyebrow">Mål for fase ${S.phase}</span><span class="goalsum">${esc(p.summary)}</span></summary>
    <div class="goals">
      ${p.rows.map((r) => row(r.label, r.value, r.done)).join('')}
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
  const S = game(), sums = recallDays(S.seed);
  $('log').innerHTML = S.log.length
    ? [...S.log].reverse().map((d) => `<div class="logday"><p class="eyebrow dayhead">Dag ${d.day}</p>${sums[d.day] ? summaryHtml(sums[d.day]) : ''}<div class="logl">${d.lines.map((l) => `<div class="${l.kind}">${esc(l.t)}</div>`).join('') || '<div>En stille dag.</div>'}</div></div>`).join('')
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
  if (t.type === 'post') return `post: ${POSTS[t.target].name.toLowerCase()}`;
  if (t.type === 'istand') return `setter i stand ${FACILITIES[t.target].short}`;
  if (t.type === 'reparere') return 'reparerer utstyr';
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
    ['HQ', (o) => o.type === 'post' || o.type === 'istand' || o.type === 'reparere'],
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
    return `<button class="chip${c.hp <= 1 ? ' h1' : c.hp === 2 ? ' h2' : ''}" data-crew="${c.id}" aria-pressed="${on}"${c.hp < 3 ? ` title="${esc(`${c.name}: ${hpWord(c.hp)}`)}"` : ''}>${avatar(c, 20)}${esc(c.name)}${cur ? `<small>${cur}</small>` : ''}</button>`;
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
    const metrics = `<div class="metrics"><div class="metric"><div class="k">Varighet</div><div class="v">${toktDays(S, d)}<small> dager</small></div></div>
      <div class="metric"><div class="k">Trussel</div><div class="v">${d.threat}<small>/5</small></div></div></div>`;
    const body = active
      ? `<p class="hint">Gruppa er ute: dag ${active.stage} av ${toktDays(S, d)}${active.awaiting ? ', venter på beslutning' : ''}.</p>`
      : `<p class="eyebrow" style="margin:0">Send på tokt</p>${crewChips(mine)}`;
    return `<div class="card tokt" data-tokt="${d.id}"><span class="badge ${d.quest ? 'inf' : 'clr'}">${d.quest ? 'Quest' : 'Tokt'}</span><h2>${esc(d.name)}</h2><p>${esc(d.desc)}</p>
      ${metrics}${toktDays(S, d) < d.days ? `<p class="hint">${esc(bussToktText)}</p>` : ''}<p class="hint">Belønning: ${rewardText(d.id)}. Alt som finnes underveis kommer med hjem om dere snur.</p>${body}</div>`;
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

  if (sel.kind === 'sector' && isLocked(S, sel.id)) {
    const ld = SECTORS[sel.id];
    box.innerHTML = `<div class="card"><span class="badge lock">Horde · Fase ${ld.opensInPhase}</span><h2>${ld.name}</h2><p>${ld.desc}</p>
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
      ${gateAlerts(S).filter((a) => a.gate === id).map((a) => `<p class="gatealert ${a.level === 'rød' ? 'rod' : 'gul'}">${icon('port')}<span>${esc(a.text)}</span></p>`).join('')}
      ${gateQuiet(S, id) ? `<p class="hint">${esc(SECTORS[gd.holds!].short)} er deres. Det kommer ikke noe over gjerdet om natta lenger.</p>` : ''}
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
  if (id === HQ_SECTOR) { box.insertAdjacentHTML('beforeend', hqCard(S)); bindHqCard(box, S); }
  box.insertAdjacentHTML('beforeend', toktCards(S, id));
  bindToktCards(box, S);
}

const COND_CLASS = { god: 'safe', middels: 'clr', odelagt: 'inf' } as const;

/** HQ-kortet under HQ-sektoren: anleggene med rykter eller sann tilstand, og istandsetting når HQ-et er tatt. */
function hqCard(S: GameState): string {
  const opts = taskOptions(S);
  const rows = FACILITY_IDS.map((f) => {
    const st = S.hq.facilities[f], intel = facilityIntel(S, f), def = FACILITIES[f];
    const badge = st.ready ? '<span class="badge safe">I stand</span>'
      : intel.cond ? `<span class="badge ${COND_CLASS[intel.cond]}">${intel.known ? '' : 'Rykte: '}${COND_LABEL[intel.cond]}</span>`
      : '<span class="badge fog">Ukjent</span>';
    const t: Task = { type: 'istand', target: f };
    const canDo = opts.some((o) => sameTask(o, t));
    const pct = Math.round((st.work / ISTAND_WORK[st.cond]) * 100);
    const work = S.hq.taken && !st.ready
      ? `<div class="hint">Sette i stand: ${pct} % ferdig, trenger ca. ${istandMaterials(st)} metall eller skrap til.</div><div class="prog"><i style="width:${pct}%"></i></div>
         ${canDo ? `<p class="eyebrow" style="margin:0">Send til istandsetting</p>${S.sectors[HQ_SECTOR].z > 0 ? `<p class="hint">${S.sectors[HQ_SECTOR].z} ${S.sectors[HQ_SECTOR].z === 1 ? 'streifer' : 'streifere'} på verftet. Gruppa tar dem først.</p>` : ''}${crewChips((c) => sameTask(c.task, t))}` : `<p class="hint">Rydd ${SECTORS[HQ_SECTOR].short} først. Høyst ${ISTAND_STRAGGLERS} streifere kan stå igjen.</p>`}`
      : '';
    return `<div class="fac" data-fac="${f}"><div class="fac-top"><b>${def.name}</b>${badge}</div>
      <p class="hint">${esc(intel.text)}</p><p class="hint"><i>${st.ready ? '' : 'I stand: '}${def.effect}</i></p>${work}</div>`;
  }).join('');
  const head = S.hq.taken
    ? 'HQ-et er tatt. Sett i stand minst ett anlegg. Et anlegg i god stand er billigst.'
    : `Anleggene er skjulte. Speiding og gjennomsøking ${SECTORS[HQ_SECTOR].at} gir rykter, og rykter kan ta feil. Den sanne tilstanden ser dere når sektoren er trygg.`;
  return `<div class="card hq"><span class="badge ${S.hq.taken ? 'safe' : 'fog'}">${S.hq.taken ? 'HQ' : 'HQ · ikke tatt'}</span><h2>Anlegg</h2><p class="hint">${head}</p>${rows}</div>`;
}

function bindHqCard(box: HTMLElement, S: GameState) {
  box.querySelectorAll<HTMLElement>('[data-fac]').forEach((el) => {
    const f = el.dataset.fac as FacilityId, t: Task = { type: 'istand', target: f };
    if (!taskOptions(S).some((o) => sameTask(o, t))) return;
    bindChips(el, (c) => sameTask(c.task, t), () => t);
  });
}

/** Postene i HQ-et, øverst i crew-fanen når HQ-et er tatt. Hver post har en nedtrekksmeny med crewet. */
function postsHtml(S: GameState): string {
  if (!S.hq.taken) return '';
  const free = S.crew.filter((c) => !isOnTokt(S, c));
  return `<div class="card posts"><span class="eyebrow" style="margin:0">Poster i HQ-et</span>${POST_IDS.map((p: PostId) => {
    const h = postHolder(S, p);
    return `<div class="post"><div><b>${POSTS[p].name}</b> <small>${STAT_LABEL[POSTS[p].stat]}</small><div class="hint">${h ? esc(postEffect(S, p)) : POSTS[p].desc}</div></div>
      <select data-post="${p}" aria-label="${POSTS[p].name}"><option value="">Ingen</option>${free.map((c) => `<option value="${c.id}"${h === c ? ' selected' : ''}>${esc(c.name)} · ${skillLevel(stat(c, POSTS[p].stat))}</option>`).join('')}</select></div>`;
  }).join('')}<p class="hint">En person på post gjør ikke dagsoppdrag. Mat fra kantina og kaia: ${dailyFoodIn(S)} per dag.</p></div>`;
}

/** Faste planer og «Som i går». Planene ligger i spilltilstanden (S.plans), så de følger lagringen. De setter bare crew.task. */
function plansHtml(S: GameState): string {
  const yest = S.day > 1 && Object.keys(S.lastTasks).length > 0;
  return `<div class="card plans"><span class="eyebrow" style="margin:0">Planer</span>
    <div class="plan-row">${yest ? '<button class="btn" data-plan-yest title="Sett alle tilbake til oppdragene fra i går, der de fortsatt går an">Som i går</button>' : ''}${S.plans.map((p) => `<span class="plan-chip"><button class="btn" data-plan="${esc(p.name)}" title="Bruk planen «${esc(p.name)}»">${esc(p.name)}</button><button class="btn plan-x" data-plan-del="${esc(p.name)}" aria-label="Slett planen ${esc(p.name)}" title="Slett planen">×</button></span>`).join('')}</div>
    <form class="plan-save" data-plan-form><input name="name" maxlength="20" placeholder="Navn, f.eks. Morgen" aria-label="Navn på planen" autocomplete="off"><button class="btn" type="submit" title="Lagre dagens fordeling som en plan"${S.plans.length >= MAX_PLANS ? ' disabled' : ''}>Lagre fordeling</button></form>
    ${ui.planNote ? `<p class="hint" role="status">${esc(ui.planNote)}</p>` : ''}</div>`;
}

function bindPlans(S: GameState) {
  const root = $('crew');
  const report = (r: { set: string[]; skipped: string[] }, what: string) => {
    const names = r.skipped.map((id) => S.crew.find((c) => c.id === id)?.name).filter(Boolean) as string[];
    ui.planNote = `${what}: ${r.set.length} satt${names.length ? `, ${nameList(names)} fikk ikke oppdraget (ikke gyldig nå)` : ''}.`;
    ui.refresh();
  };
  root.querySelector('[data-plan-yest]')?.addEventListener('click', () => report(repeatYesterday(S), 'Som i går'));
  root.querySelectorAll<HTMLElement>('[data-plan]').forEach((b) => b.addEventListener('click', () => report(applyPlan(S, b.dataset.plan!), `Planen «${b.dataset.plan}»`)));
  root.querySelectorAll<HTMLElement>('[data-plan-del]').forEach((b) => b.addEventListener('click', () => { deletePlan(S, b.dataset.planDel!); ui.planNote = ''; ui.refresh(); }));
  root.querySelector<HTMLFormElement>('[data-plan-form]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = (root.querySelector<HTMLInputElement>('[data-plan-form] input')!).value;
    ui.planNote = savePlan(S, name) ? `Planen «${name.trim().slice(0, 20)}» er lagret.` : 'Gi planen et navn (høyst seks planer).';
    ui.refresh();
  });
}

function bindPosts(S: GameState) {
  $('crew').querySelectorAll<HTMLSelectElement>('[data-post]').forEach((sel) => sel.addEventListener('change', () => {
    const p = sel.dataset.post as PostId;
    // den som hadde posten går tilbake til å hvile, og den nye flyttes hit
    for (const c of S.crew) if (c.task.type === 'post' && c.task.target === p) c.task = { type: 'hvile' };
    const c = S.crew.find((x) => x.id === sel.value);
    if (c) c.task = { type: 'post', target: p };
    ui.refresh();
  }));
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

/** Helsa i ord. «Ille ute» kalles «hardt skadet» i panelet, så det ikke kan misforstås. */
export const hpWord = (hp: number): string => (hp <= 1 ? 'Hardt skadet' : HEALTH_LABEL[hp]);
const hpHtml = (c: CrewMember) => `<span class="hp h${c.hp}" role="img" aria-label="Helse ${c.hp} av 3: ${hpWord(c.hp)}" title="${hpWord(c.hp)}">${heartsHtml(c.hp)}</span>`;
/** Merket på crewraden: rødt og tydelig for hardt skadet, dempet for skrapt opp. */
const hurtBadge = (c: CrewMember) => (c.hp <= 1 ? `<span class="hurtbadge h1">${icon('skadet')}Hardt skadet</span>` : c.hp === 2 ? `<span class="hurtbadge h2">${icon('skadet')}Skrapt opp</span>` : '');
/** Oppgaver som holder personen hjemme. Bare til teksten under merket. */
const HOME_TASKS: TaskType[] = ['hvile', 'pleie', 'trene', 'lage', 'post'];

export function renderCrew() {
  const S = game(), opts = taskOptions(S), short = craftShortfall(S);
  if (ui.openCrew && !S.crew.some((c) => c.id === ui.openCrew)) ui.openCrew = null;
  $('crew').innerHTML = plansHtml(S) + postsHtml(S) + S.crew.map((c) => {
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
    const badge = hurtBadge(c);
    const note = c.hp > 1 ? '' : HOME_TASKS.includes(c.task.type) ? 'Blir hjemme. Medisin eller pleie hjelper.' : 'Skal ut selv om hen knapt står. Vurder Hvile.';
    return `<div class="cm${c.task.type !== 'hvile' ? ' busy' : ''}${open ? ' open' : ''}${c.hp <= 1 ? ' hurt1' : c.hp === 2 ? ' hurt2' : ''}" data-row="${c.id}">
      <button class="cm-tog" data-toggle="${c.id}" aria-expanded="${open}" title="${open ? 'Fold sammen' : 'Vis ferdigheter og utstyr'}">
        ${avatar(c, 36)}<span class="cm-id"><span class="nm">${esc(c.name)}</span><span class="cm-sub"><span class="lvl" title="Nivå ${lvl}">Nv ${lvl}</span>${hpHtml(c)}</span></span><span class="chev" aria-hidden="true">${open ? '▴' : '▾'}</span></button>
      ${select}
      ${badge ? `<div class="cm-hurt">${badge}${note ? `<span class="hurtnote">${note}</span>` : ''}</div>` : ''}
      ${noMats ? `<p class="task-help low" style="grid-column:1/-1">Mangler materialer: ${LAGE_COST.skrap} skrap og ${LAGE_COST.tre} tre per forsøk.</p>` : ''}
      ${slotsHtml(c, open)}
      ${more}
    </div>`;
  }).join('');
  bindCards($('crew'));
  bindPosts(S);
  bindPlans(S);
  const toggle = (id: string) => { ui.openCrew = ui.openCrew === id ? null : id; if (ui.openCrew !== id && ui.picker?.crewId === id) ui.picker = null; renderCrew(); };
  $('crew').querySelectorAll<HTMLElement>('[data-row]').forEach((row) => row.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    // knapper, nedtrekk og velgeren har egne handlinger; resten av raden folder ut
    if (t.closest('select, .slots, .picker, .cm-more, a, input') || (t.closest('button') && !t.closest('[data-toggle]'))) return;
    toggle(row.dataset.row!);
  }));
  $('crew').querySelectorAll<HTMLSelectElement>('select[data-crew]').forEach((s) => s.addEventListener('change', () => {
    const c = S.crew.find((x) => x.id === s.dataset.crew)!;
    const o = opts.find((o) => taskKey(o) === s.value);
    if (o) c.task = bare(o);
    ui.refresh();
  }));
}

/**
 * Portvarslene over «Avslutt dag»: røde med hele teksten, gule samlet på én linje når flere porter står ubevoktet.
 * Teksten kommer fra `gateAlerts` i motoren.
 */
function gateAlertHtml(S: GameState): string {
  const all = gateAlerts(S), red = all.filter((a) => a.level === 'rød'), yellow = all.filter((a) => a.level === 'gul');
  const line = (cls: string, text: string, title = text) => `<span class="planwarn gatewarn ${cls}" title="${esc(title)}">${icon('port')}${esc(text)}</span> `;
  const gul = yellow.length === 1 ? line('gul', yellow[0].text)
    : yellow.length ? line('gul', `${nameList(yellow.map((a) => GATES[a.gate].name))} står ubevoktet. Rydd sektorene ned til ${GATE_STRAGGLERS} for å kunne befeste. De som rydder der, tar også imot det som kommer om natta.`, yellow.map((a) => a.text).join('\n'))
    : '';
  return red.map((a) => line('rod', a.text)).join('') + gul;
}

export function renderPlan() {
  const S = game(), groups: Record<string, string[]> = {};
  for (const c of S.crew) {
    const k = c.task.type === 'befeste' ? `bygger ${GATES[c.task.target].name}` : taskShort(c.task);
    (groups[k] ??= []).push(c.name);
  }
  const noMats = [...craftShortfall(S)].map((id) => S.crew.find((c) => c.id === id)!.name);
  const badly = S.crew.filter((c) => c.hp <= 1).map((c) => c.name);
  $('plan').innerHTML = gateAlertHtml(S) + (badly.length ? `<span class="planwarn">${icon('skadet')}${esc(nameList(badly))} er hardt skadet</span> ` : '') +
    esc(Object.entries(groups).map(([k, v]) => `${nameList(v)} ${k}`).join(' · ') + (noMats.length ? ` · Mangler materialer til å lage utstyr (${nameList(noMats)})` : ''));
  $('end').textContent = blockerLabel(S) ?? `Avslutt dag ${S.day}`;
  // knappen åpner encounters og ledervalg selv, så den er aldri sperret av dem
  $<HTMLButtonElement>('end').disabled = false;
}
