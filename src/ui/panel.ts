// Panelet til høyre: ressurser, mål, valgt sted og crewet.
import {
  dailyFood, dailyWater, GATE_STEPS, GATES, GEAR, HEALTH_LABEL, PHASE_RES, phaseProgress, RES, RES_LABEL, SECTORS, sectorIntel,
  skillLevel, STAT_LABEL, STATS, TRAITS, taskOptions, ZONE_INFO, sameTask,
} from '../engine';
import type { CrewMember, SectorId, SectorState, Stats, Task, TaskType } from '../engine';
import { $, esc, game, MAP, ui } from './store';

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
    ${row('Klarer alle sektorer på Buøy', `${p.cleared}/${p.total}`, p.cleared === p.total)}
    ${p.gates.map((g) => row(`${g.name} på nivå 2`, `${g.level}/2`, g.level >= 2)).join('')}
    <div class="hint">Utstyr: ${GEAR[S.gear].name}</div>
  </div>`;
}

function taskShort(t: Task): string {
  if (t.type === 'hvile') return 'hviler';
  if (t.type === 'befeste') return 'bygger';
  const verb = { klarere: 'klarerer', lete: 'leter', finsjekk: 'sjekker' }[t.type];
  return `${verb} ${SECTORS[t.target].short}`;
}

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
    c.task = isMine(c) ? { type: 'hvile' } : task();
    ui.refresh();
  }));
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
    const mine = (c: CrewMember) => c.task.type === 'befeste' && c.task.target === id;
    box.innerHTML = `<div class="card"><span class="badge ${st.level ? 'clr' : 'inf'}">Sperring · nivå ${st.level}/3</span><h2>${gd.name}</h2><p>${gd.desc}</p>
      <div><div class="hint">${st.level >= 3 ? 'Fullt utbygd.' : `Fram til nivå ${st.level + 1}: ${pct}%`}</div><div class="prog"><i style="width:${pct}%"></i></div></div>
      <p class="hint">${ready ? 'Mekk teller mest. Hver arbeidsdag bruker tre og skrap.' : `Klarer ${SECTORS[gd.sector].short} før dere kan bygge her.`}</p>
      ${ready && st.level < 3 ? `<p class="eyebrow" style="margin:0">Send til befesting</p>${crewChips(mine)}` : ''}</div>`;
    bindChips(box, mine, () => ({ type: 'befeste', target: id }));
    return;
  }

  const id = sel.id as SectorId; // Rosenberg er håndtert over
  const sec = S.sectors[id], intel = sectorIntel(S, id);
  const inf = intel.status === 'infisert';
  const actions: ('klarere' | 'lete' | 'finsjekk')[] = inf ? ['klarere'] : [...(intel.searched < 100 ? ['lete' as const] : []), 'finsjekk'];
  if (!actions.includes(ui.selAction as never)) ui.selAction = actions[0];
  const act = ui.selAction as (typeof actions)[number];
  const actLabel: Record<TaskType, string> = { klarere: 'Klarere', lete: 'Lete', finsjekk: 'Finsjekke', befeste: 'Befeste', hvile: 'Hvile' };
  const task: Task = { type: act, target: id };
  const mine = (c: CrewMember) => sameTask(c.task, task);
  box.innerHTML = `<div class="card">
    <span class="badge ${inf ? 'inf' : 'clr'}">${inf ? 'Infisert' : 'Klarert'}${id === 'hjem' ? ' · Du bor her' : ''}</span>
    <h2>${SECTORS[id].name}</h2><p>${SECTORS[id].desc}</p>
    <div class="metrics">
      <div class="metric"><div class="k">Zombier</div><div class="v">${intel.estimate}${!sec.seen && inf ? ' <small>anslag</small>' : ''}</div></div>
      <div class="metric"><div class="k">Sikkerhet</div><div class="v">${inf ? '–' : `${intel.conf}% <small>${intel.confExact ? 'regneark' : 'magefølelse'}</small>`}</div></div>
      <div class="metric"><div class="k">Gjennomsøkt</div><div class="v">${intel.searched}%</div></div>
    </div>
    <p class="hint">${inf ? 'Muskler og Nerver dreper zombier. Snoking finner dem som gjemmer seg i kjellere. Send flere sammen for å unngå skader.' : `${lootHint(sec)} Lav sikkerhet betyr at noe kan ligge igjen i en kjeller.`}</p>
    ${actions.length > 1 ? `<div class="seg" role="group">${actions.map((a) => `<button data-act="${a}" aria-pressed="${a === act}">${actLabel[a]}</button>`).join('')}</div>` : ''}
    <p class="eyebrow" style="margin:0">Send til ${actLabel[act].toLowerCase()}</p>
    ${crewChips(mine)}
  </div>`;
  box.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) => b.addEventListener('click', () => { ui.selAction = b.dataset.act as TaskType; renderSel(); }));
  bindChips(box, mine, () => task);
}

/** Ferdigheter som stolpe og nivånavn. Tallene vises aldri. */
export function statPips(st: Stats) {
  return STATS.map((k) => `<div class="st" title="${STAT_LABEL[k]}: ${skillLevel(st[k])}">${STAT_LABEL[k].slice(0, 3)}<div class="sbar"><i style="width:${Math.round(st[k])}%"></i></div><small>${skillLevel(st[k])}</small></div>`).join('');
}

const taskKey = (t: Task) => `${t.type}:${'target' in t ? t.target : ''}`;

export function renderCrew() {
  const S = game(), opts = taskOptions(S);
  $('crew').innerHTML = S.crew.map((c) => `<div class="cm${c.task.type !== 'hvile' ? ' busy' : ''}">
      <div class="nm">${esc(c.name)}<small>${esc(c.role)}</small></div>
      <div class="hp h${c.hp}" title="${HEALTH_LABEL[c.hp]}">${[1, 2, 3].map((i) => `<i class="${i <= c.hp ? 'on' : ''}"></i>`).join('')}</div>
      <div class="tr"><b>${TRAITS[c.trait].name}.</b> ${TRAITS[c.trait].desc}</div>
      <div class="statrow">${statPips(c.stats)}</div>
      <select data-crew="${c.id}" aria-label="Oppdrag for ${esc(c.name)}">${opts.map((o) => `<option value="${taskKey(o)}"${sameTask(o, c.task) ? ' selected' : ''}>${o.label}</option>`).join('')}</select>
    </div>`).join('');
  $('crew').querySelectorAll<HTMLSelectElement>('select').forEach((s) => s.addEventListener('change', () => {
    const c = S.crew.find((x) => x.id === s.dataset.crew)!;
    const o = opts.find((o) => taskKey(o) === s.value);
    if (o) { const { label: _label, ...task } = o; c.task = task as Task; }
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
  $('end').textContent = `Avslutt dag ${S.day}`;
}
