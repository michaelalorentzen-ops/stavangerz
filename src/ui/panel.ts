// Panelet til høyre: ressurser, mål, valgt sted og crewet.
import {
  canEndPhase, dailyFood, dailyWater, GATE_STEPS, GATES, HEALTH_LABEL, PHASE_RES, phaseProgress, RES, RES_LABEL, SECTORS, sectorIntel,
  housing, mods, skillLevel, STAT_LABEL, STATS, TRAITS, taskKey, taskOptions, ZONE_INFO, sameTask,
  CARDS, isOnTokt, toktAvailable, toktDef, TOKTS,
} from '../engine';
import type { CrewMember, GameState, GateId, SectorId, SectorState, Stats, Task, TaskType } from '../engine';
import { bindCards, slotsHtml } from './cards';
import { $, esc, game, KIND_ICON, KIND_LABEL, MAP, ui } from './store';

export function renderTop() {
  const S = game();
  const food = dailyFood(S), water = dailyWater(S);
  const cell = (k: string, v: number, d = '', low = false) =>
    `<div class="r${low ? ' low' : ''}"><span class="k">${k}</span><span class="v">${v}</span><span class="d">${d}</span></div>`;
  $('day').textContent = `Dag ${S.day}`;
  const shown = RES.filter((k) => PHASE_RES[S.phase].includes(k) || S.res[k] > 0);
  const detail = (k: string) => (k === 'mat' ? [`−${food}/d`, S.res.mat < food * 2] : k === 'vann' ? [`−${water}/d`, S.res.vann < water * 2] : ['', false]) as [string, boolean];
  $('res').innerHTML =
    shown.map((k) => cell(RES_LABEL[k], S.res[k], ...detail(k))).join('') +
    `<div class="r moral"><span class="k">Moral ${S.moral}</span><span class="bar"><i style="width:${S.moral}%;${S.moral < 30 ? 'background:var(--red)' : ''}"></i></span></div>`;
}

export function renderGoals() {
  const S = game(), p = phaseProgress(S);
  const row = (txt: string, val: string, done: boolean) => `<div class="goal${done ? ' done' : ''}"><span>${done ? '✓ ' : ''}${txt}</span><b>${val}</b></div>`;
  $('goals').innerHTML = `<div class="goals">
    ${row('Gjør alle sektorer på Buøy trygge', `${p.safe}/${p.total}`, p.safe === p.total)}
    ${p.gates.map((g) => row(`${g.name} på nivå 2`, `${g.level}/2`, g.level >= 2)).join('')}
    ${S.over === null ? `<div class="goal"><span>Turer igjen i fasen</span><b>${Math.max(0, mods(S).turnCap - (S.day - S.phaseStartDay))}</b></div>` : ''}
    ${canEndPhase(S) && !S.over ? `<button class="btn small" id="endphase">Avslutt fase ${S.phase}</button>` : ''}
    <div class="hint">Utstyr på lager: ${S.stash.length} · Crew ${S.crew.length}/${housing(S)} senger</div>
  </div>`;
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
  return parts.join(', ') || 'ingenting';
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

function lootHint(sec: SectorState) {
  const tiers = Object.entries(sec.loot).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (!tiers.length) return 'Tømt for alt nyttig.';
  return 'Rykter om: ' + tiers.slice(0, 3).map(([k, v]) => `${v >= 10 ? 'mye ' : v >= 4 ? '' : 'litt '}${RES_LABEL[k as keyof typeof RES_LABEL].toLowerCase()}`).join(', ') + '.';
}

export function renderSel() {
  const S = game(), sel = ui.sel, box = $('sel');

  if (sel.kind === 'sector' && sel.id === 'rosenberg') {
    box.innerHTML = `<div class="card"><span class="badge lock">Horde · Fase 2</span><h2>Rosenberg Verft</h2><p>${SECTORS.rosenberg.desc}</p>
      <div class="metrics"><div class="metric"><div class="k">Horde</div><div class="v">60–120</div></div>
      <div class="metric"><div class="k">Kapasitet</div><div class="v">???</div></div><div class="metric"><div class="k">Forsvar</div><div class="v">???</div></div></div>
      <p class="hint">Dette er HQ-et ditt i fase 2. De ekte HQ-verdiene er skjulte. Hold Rosenberg-gjerdet oppe så horden blir der den er.</p></div>`;
    return;
  }

  if (sel.kind === 'zone') {
    const z = MAP.zones.find((z) => z.id === sel.id)!;
    box.innerHTML = `<div class="card"><span class="badge fog">Ukjent sone</span><h2>${esc(z.name)}</h2><p>${ZONE_INFO[z.id] ?? ''}</p><p class="hint">Utenfor rekkevidde i fase 1. Sikre Buøy først.</p></div>`;
    return;
  }

  if (sel.kind === 'gate') {
    const id = sel.id, gd = GATES[id], st = S.gates[id];
    const ready = S.sectors[gd.sector].z === 0;
    const next = GATE_STEPS[Math.min(3, st.level + 1)], prev = GATE_STEPS[st.level];
    const pct = st.level >= 3 ? 100 : Math.round(((st.work - prev) / (next - prev)) * 100);
    const gopts = taskOptions(S).filter((o) => 'target' in o && o.target === id);
    const gacts = gopts.map((o) => o.type);
    if (!gacts.includes(ui.selAction as never)) ui.selAction = gacts[0] ?? null;
    const gact = gopts.find((o) => o.type === ui.selAction);
    const gtask = gact ? bare(gact) : null;
    const mine = (c: CrewMember) => !!gtask && sameTask(c.task, gtask);
    box.innerHTML = `<div class="card"><span class="badge ${st.level ? 'clr' : 'inf'}">Sperring · nivå ${st.level}/3</span><h2>${gd.name}</h2><p>${gd.desc}</p>
      <div><div class="hint">${st.level >= 3 ? 'Fullt utbygd.' : `Fram til nivå ${st.level + 1}: ${pct}%`}</div><div class="prog"><i style="width:${pct}%"></i></div></div>
      <p class="hint">${ready ? 'Mekk teller mest. Hver arbeidsdag bruker tre og skrap.' : `Klarer ${SECTORS[gd.sector].short} før dere kan bygge her.`}</p>
      ${gacts.length > 1 ? `<div class="seg" role="group">${gacts.map((a) => `<button data-act="${a}" aria-pressed="${a === ui.selAction}">${ACT_LABEL[a]}</button>`).join('')}</div>` : ''}
      ${gtask ? `<p class="eyebrow" style="margin:0">Send til ${ACT_LABEL[gtask.type]!.toLowerCase()}</p>${crewChips(mine)}` : ''}</div>`;
    box.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) => b.addEventListener('click', () => { ui.selAction = b.dataset.act as TaskType; renderSel(); }));
    if (gtask) bindChips(box, mine, () => gtask);
    box.insertAdjacentHTML('beforeend', toktCards(S, id));
    bindToktCards(box, S);
    return;
  }

  const id = sel.id as SectorId; // Rosenberg er håndtert over
  const sec = S.sectors[id], intel = sectorIntel(S, id), def = SECTORS[id];
  const inf = sec.z > 0;
  const sopts = taskOptions(S).filter((o) => 'target' in o && o.target === id);
  const actions = sopts.map((o) => o.type);
  if (!actions.includes(ui.selAction as never)) ui.selAction = actions[0] ?? null;
  const act = ui.selAction;
  const actLabel = ACT_LABEL as Record<string, string>;
  const picked = sopts.find((o) => o.type === act);
  const task: Task | null = picked ? bare(picked) : null;
  const mine = (c: CrewMember) => !!task && sameTask(c.task, task);
  const bar = (cls: string, label: string, pct: number, val: string) =>
    `<div class="bar-row ${cls}"><span>${label}</span><span class="tr"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></span><b>${val}</b></div>`;
  const infPct = inf ? Math.min(100, (sec.z / Math.max(1, def.z)) * 100) : 0;
  const housingNote = def.capacity > 0 ? `Plass til ${def.capacity}${sec.settled ? ', bosatt' : ', når den er trygg'}.` : 'Ingen boliger her.';
  box.innerHTML = `<div class="card">
    <span class="badge ${intel.safe ? 'safe' : inf ? 'inf' : 'clr'}">${intel.safe ? 'Trygg' : inf ? 'Infisert' : 'Ryddet'}${id === 'hjem' ? ' · Du bor her' : ''}</span>
    <h2>${def.name}</h2><p>${def.desc}</p>
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
    ${act && task ? `<p class="eyebrow" style="margin:0">Send til ${actLabel[act].toLowerCase()}</p>${crewChips(mine)}` : '<p class="hint">Ingenting mer å gjøre her.</p>'}
  </div>`;
  box.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) => b.addEventListener('click', () => { ui.selAction = b.dataset.act as TaskType; renderSel(); }));
  if (task) bindChips(box, mine, () => task);
  box.insertAdjacentHTML('beforeend', toktCards(S, id));
  bindToktCards(box, S);
}

/** Ferdigheter som stolpe og nivånavn. Tallene vises aldri. */
export function statPips(st: Stats) {
  return STATS.map((k) => `<div class="st" title="${STAT_LABEL[k]}: ${skillLevel(st[k])}">${STAT_LABEL[k].slice(0, 3)}<div class="sbar"><i style="width:${Math.round(st[k])}%"></i></div><small>${skillLevel(st[k])}</small></div>`).join('');
}

export function renderCrew() {
  const S = game(), opts = taskOptions(S);
  $('crew').innerHTML = S.crew.map((c) => `<div class="cm${c.task.type !== 'hvile' ? ' busy' : ''}">
      <div class="nm">${esc(c.name)}<small>${esc(c.role)}</small></div>
      <div class="hp h${c.hp}" title="${HEALTH_LABEL[c.hp]}">${[1, 2, 3].map((i) => `<i class="${i <= c.hp ? 'on' : ''}"></i>`).join('')}</div>
      <div class="tr"><b>${TRAITS[c.trait].name}.</b> ${TRAITS[c.trait].desc}</div>
      <div class="statrow">${statPips(c.stats)}</div>
      ${slotsHtml(c)}
      ${isOnTokt(S, c) ? `<select data-crew="${c.id}" disabled aria-label="Oppdrag for ${esc(c.name)}"><option>${esc(taskShort(c.task))}</option></select>` : `<select data-crew="${c.id}" aria-label="Oppdrag for ${esc(c.name)}">${opts.map((o) => `<option value="${taskKey(o)}"${sameTask(o, c.task) ? ' selected' : ''}>${o.label}</option>`).join('')}</select>`}
    </div>`).join('');
  bindCards($('crew'));
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
  $('plan').textContent = Object.entries(groups).map(([k, v]) => `${v.join(', ')} ${k}`).join(' · ');
  $('end').textContent = S.pending.length ? `${S.pending.length} encounter${S.pending.length === 1 ? '' : 's'} venter` : `Avslutt dag ${S.day}`;
  // knappen åpner encounters og ledervalg selv, så den er aldri sperret av dem
  $<HTMLButtonElement>('end').disabled = false;
}
