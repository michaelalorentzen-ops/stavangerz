// Dialoger: tittelskjerm, oppstart, hendelseskort, dagsrapport og slutt.
import {
  DIFFICULTIES, DIFFICULTY,
  best, CARDS, checkOdds, continueAfterWin, describeEncounter, eventChoices, eventDef, previewChoice, queueIntro, canEndPhase, endDayBlocker, endPhase, isFinished, RES, RES_LABEL, toktDecision, toktDef, AREA, HEALTH_LABEL, LANDMARKS, phase2Teaser, winBanner, NEIGHBORS, newGame, resolveDay, resolveEncounter, resolveEvent, SECTORS, SELF_TRAITS, setLeader, START_NEIGHBORS,
  nameList, STAT_HINT, STAT_LABEL, STATS, sum, TRAITS, finaleText, HQ_SECTOR, mods, MUTATIONS, phase2Intro, PHASES,
} from '../engine';
import type { Difficulty, PendingEncounter, Stats, TraitId } from '../engine';
import { blockerLabel, changesHtml, previewHtml, statPips } from './panel';
import { TAG_LABEL } from './cards';
import { $, esc, game, load, save, ui, wipe } from './store';
import { bestDays, isUnlocked, loadRecords, logRun, parseSeed, recallCombo, rememberRun, seedCode, UNLOCKED_BY } from './records';
import type { RecordResult } from './records';

/** Rekordlisten: beste dager per fase og grad. */
function recordsHtml(): string {
  const r = loadRecords();
  const cell = (p: 1 | 2, d: Difficulty) => { const v = bestDays(r, p, d); return `<td>${v === null ? '–' : `${v} dager`}</td>`; };
  return `<div><p class="eyebrow">Rekorder · færrest dager</p><table class="records"><thead><tr><th></th><th>Fase 1</th><th>Fase 2</th></tr></thead><tbody>${
    DIFFICULTIES.map((d) => `<tr><th scope="row">${DIFFICULTY[d].name}</th>${cell(1, d)}${cell(2, d)}</tr>`).join('')}</tbody></table></div>`;
}

/** «Ny rekord!» og opplåsing etter en vunnet fase. */
function recordNote(res: RecordResult): string {
  const lines = [
    res.newBest ? `<span class="badge safe">Ny rekord!</span> ${res.previous === null ? 'Første seier på denne graden.' : `Forrige var ${res.previous} dager.`}` : '',
    res.newComboBest && !res.newBest ? '<span class="badge safe">Ny rekord for dette crewet</span>' : '',
    res.unlocked ? `<span class="badge clr">Låst opp</span> ${DIFFICULTY[res.unlocked].name} er nå åpen.` : '',
  ].filter(Boolean);
  return lines.length ? `<div class="card recnote">${lines.map((l) => `<p>${l}</p>`).join('')}</div>` : '';
}

/** Seed-koden så en runde kan deles og spilles om igjen. */
const seedHtml = (seed: number) => `<p class="hint">Seed: <code class="seedcode">${seedCode(seed)}</code> · del koden, og vennen din får samme by og samme uhell.</p>`;

/** HQ-sektoren, låst i fase 1 */
const LOCKED = SECTORS[HQ_SECTOR];

function modal(html: string, wide = false) {
  const sheet = $('sheet');
  sheet.className = 'sheet' + (wide ? ' wide' : '');
  sheet.innerHTML = html;
  $('modal').hidden = false;
  sheet.querySelector<HTMLElement>('button, input')?.focus({ preventScroll: true });
  $('modal').scrollTop = 0;
}
const closeModal = () => { $('modal').hidden = true; };
const on = (id: string, fn: () => void) => { const b = document.getElementById(id); if (b) b.onclick = fn; };

export function titleScreen() {
  const saved = load(), recs = loadRecords();
  if (!isUnlocked(recs, draft.difficulty)) draft.difficulty = 'normal';
  modal(`<div class="title" style="display:grid;gap:18px">
    <div class="kick">Et turbasert overlevelsesspill fra ${AREA.surroundings}</div>
    <h1>STAVANGER <b>Z</b></h1>
    <p>Utbruddet starter en tirsdag morgen. Du bor ${AREA.at}. ${LANDMARKS.bybrua} er stengt, ${LOCKED.short} er overkjørt, og det regner. Samle et crew blant naboene, rydd ${AREA.kind} sektor for sektor og bygg sperringer før natta tar dere.</p>
    <div class="coords">${AREA.coords} · ${AREA.name}, ${AREA.district} bydel</div>
    <div><p class="eyebrow">Vanskelighetsgrad</p><div class="picks">${DIFFICULTIES.map((d) => {
      const open = isUnlocked(recs, d), by = UNLOCKED_BY[d];
      return `<button class="pick${open ? '' : ' locked'}" data-d="${d}" aria-pressed="${draft.difficulty === d}"${open ? '' : ' disabled'}><span class="nm" style="font-size:17px">${DIFFICULTY[d].name}${open ? '' : ' <small>låst</small>'}</span><span class="role">${open ? DIFFICULTY[d].desc : `Låses opp ved å vinne fase 1 på ${DIFFICULTY[by!].name}.`}</span></button>`;
    }).join('')}</div></div>
    ${recordsHtml()}
    <details class="seedin"><summary>Spill en delt seed</summary><div class="field"><label for="seed">Seed-kode</label><input id="seed" maxlength="7" autocomplete="off" placeholder="Tom gir tilfeldig by" value="${esc(draft.seedText)}"></div></details>
    <div class="row" style="justify-content:flex-start">
      <button class="btn" id="new">Ny runde</button>
      ${saved && !isFinished(saved) ? `<button class="btn ghost" id="cont">Fortsett dag ${saved.day}</button>` : ''}
    </div></div>`);
  $('sheet').querySelectorAll<HTMLButtonElement>('[data-d]').forEach((b) => b.addEventListener('click', () => { draft.difficulty = b.dataset.d as Difficulty; titleScreen(); }));
  $<HTMLInputElement>('seed').addEventListener('input', (e) => { draft.seedText = (e.target as HTMLInputElement).value; });
  on('new', createSelf);
  on('cont', () => {
    ui.S = saved; closeModal(); ui.refresh();
    settle(() => { closeModal(); ui.refresh(); if (saved && isFinished(saved)) endScreen(); });
  });
}

const POOL = 15;
export const draft: { name: string; stats: Stats; trait: TraitId; picks: string[]; difficulty: Difficulty; seedText: string } = {
  difficulty: 'normal', name: '', stats: { muskler: 3, kondis: 2, snoking: 3, nerver: 3, mekk: 2, prat: 2 }, trait: 'lokalkjent', picks: [], seedText: '',
};

function createSelf() {
  const used = sum(Object.values(draft.stats));
  const pips = (n: number) => [1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('');
  modal(`<span class="eyebrow">Steg 1 av 2</span><h2>Hvem er du?</h2>
    <div class="field"><label for="nm">Navn</label><input id="nm" maxlength="18" placeholder="Du" value="${esc(draft.name)}"></div>
    <div><p class="eyebrow">Fordel ${POOL} poeng · ${POOL - used} igjen</p><div class="statedit">
    ${STATS.map((k) => `<div class="se"><div class="lbl">${STAT_LABEL[k]}<small>${STAT_HINT[k]}</small></div>
      <div class="pips">${pips(draft.stats[k])}</div>
      <div class="ctl"><button data-k="${k}" data-d="-1" aria-label="Mindre ${STAT_LABEL[k]}">−</button><button data-k="${k}" data-d="1" aria-label="Mer ${STAT_LABEL[k]}">+</button></div></div>`).join('')}
    </div></div>
    <div><p class="eyebrow">Egenskap</p><div class="picks">${SELF_TRAITS.map((t) => `<button class="pick" data-t="${t}" aria-pressed="${draft.trait === t}"><span class="nm" style="font-size:17px">${TRAITS[t].name}</span><span class="role">${TRAITS[t].desc}</span></button>`).join('')}</div></div>
    <div class="row"><button class="btn ghost" id="back">Tilbake</button><button class="btn" id="next" ${used !== POOL ? 'disabled' : ''}>Velg naboer</button></div>`, true);
  $<HTMLInputElement>('nm').addEventListener('input', (e) => { draft.name = (e.target as HTMLInputElement).value; });
  $('sheet').querySelectorAll<HTMLButtonElement>('[data-k]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.k as keyof Stats, d = Number(b.dataset.d), v = draft.stats[k] + d;
    if (v < 1 || v > 5 || used + d > POOL) return;
    draft.stats[k] = v;
    createSelf();
  }));
  $('sheet').querySelectorAll<HTMLButtonElement>('[data-t]').forEach((b) => b.addEventListener('click', () => { draft.trait = b.dataset.t as TraitId; createSelf(); }));
  on('back', titleScreen);
  on('next', pickNeighbors);
}

function pickNeighbors() {
  modal(`<span class="eyebrow">Steg 2 av 2</span><h2>Velg tre naboer</h2>
    <p>Disse er i live og banker på døra di. Du har plass til tre. De andre må klare seg selv. Kanskje dukker de opp igjen.</p>
    <div class="picks">${START_NEIGHBORS.map((id) => {
      const n = NEIGHBORS.find((x) => x.id === id)!;
      return `<button class="pick" data-n="${id}" aria-pressed="${draft.picks.includes(id)}">
        <span class="nm">${n.name} <small style="font:400 14px var(--f-body);color:var(--muted)">${n.age}</small></span><span class="role">${n.role}</span>
        <span class="tr">${TRAITS[n.trait].name}: ${TRAITS[n.trait].desc}</span><span class="q">«${n.quip}»</span>
        <span class="statrow">${statPips(n.stats)}</span></button>`;
    }).join('')}</div>
    <div class="row"><span class="hint" style="margin-right:auto;align-self:center">${draft.picks.length}/3 valgt</span><button class="btn ghost" id="back">Tilbake</button><button class="btn" id="go" ${draft.picks.length !== 3 ? 'disabled' : ''}>Start utbruddet</button></div>`, true);
  $('sheet').querySelectorAll<HTMLButtonElement>('[data-n]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.n!, i = draft.picks.indexOf(id);
    if (i >= 0) draft.picks.splice(i, 1); else if (draft.picks.length < 3) draft.picks.push(id);
    pickNeighbors();
  }));
  on('back', createSelf);
  on('go', () => {
    // seeden er det eneste stedet tilfeldighet kommer utenfra
    const seed = parseSeed(draft.seedText) ?? (Date.now() ^ Math.floor(Math.random() * 1e9)) | 0;
    rememberRun(seed, [...draft.picks]);
    ui.S = newGame(seed, { name: draft.name.trim() || 'Du', stats: { ...draft.stats }, trait: draft.trait }, draft.picks, draft.difficulty);
    ui.sel = { kind: 'sector', id: 'hjem' };
    queueIntro(ui.S);
    ui.refresh();
    settle(() => { closeModal(); ui.refresh(); });
  });
}

/** Dagens ventende hendelse fra tilstanden, så den overlever en omlasting. */
function showEvent(done: () => void) {
  const S = game(), ev = eventDef(S.event!.id);
  const choices = eventChoices(S, ev);
  modal(`<div class="radio">${ev.channel ?? 'Samband · kanal 16'} · Dag ${S.day}</div><h2>${ev.title}</h2>
    <div class="transcript">${esc(ev.text(S))}</div>
    <div class="choices">${choices.map(({ ch: c, i }) => `<button class="choice" data-i="${i}"><span class="ch-top"><span>${c.label}</span>${c.check ? `<small>${STAT_LABEL[c.check]} · ${esc(best(S, c.check).name)} · ${Math.round(checkOdds(S, c.check) * 100)}%</small>` : ''}</span>${previewHtml(previewChoice(S, c))}</button>`).join('')}</div>`);
  $('sheet').querySelectorAll<HTMLButtonElement>('[data-i]').forEach((b) => b.addEventListener('click', () => {
    const i = Number(b.dataset.i), ch = ev.choices[i];
    const r = resolveEvent(S, i);
    save();
    const tag = ch.check ? `<div class="tag">${r.ok ? 'Lyktes' : 'Mislyktes'}</div>` : '';
    $('sheet').querySelector('.choices')!.outerHTML = `<div class="result ${ch.check ? (r.ok ? 'ok' : 'fail') : ''}">${tag}${esc(r.text)}${changesHtml(r.changes)}</div><div class="row"><button class="btn" id="ok">Videre</button></div>`;
    $('ok').focus();
    on('ok', done);
  }));
}

/** Et ventende encounter: samme stil som hendelseskort, med odds og våpentagg. */
function showEncounter(p: PendingEncounter, done: () => void) {
  const S = game(), v = describeEncounter(S, p);
  const odds = (c: (typeof v.choices)[number]) => c.check
    ? `<small>${STAT_LABEL[c.check]} · ${esc(c.best ?? '')} · ${Math.round(c.odds * 100)}%${c.tag ? ` · <b>${TAG_LABEL[c.tag].toLowerCase()}${c.tagBonus ? ' +20 %' : ''}</b>` : ''}</small>` : '';
  modal(`<div class="radio">Samband · ${esc(nameList(v.crew))} · Dag ${S.day}</div><h2>${esc(v.title)}</h2>
    <div class="transcript">${esc(v.text)}</div>
    <div class="choices">${v.choices.map((c, i) => `<button class="choice${c.retreat ? ' retreat' : ''}" data-i="${i}"><span class="ch-top"><span>${esc(c.label)}</span>${odds(c)}</span>${(c.preview ? previewHtml(c.preview) : "")}</button>`).join('')}</div>`);
  $('sheet').querySelectorAll<HTMLButtonElement>('[data-i]').forEach((b) => b.addEventListener('click', () => {
    const i = Number(b.dataset.i), c = v.choices[i];
    const r = resolveEncounter(S, p.pid, i);
    save();
    const tag = c.check ? `<div class="tag">${r.ok ? 'Lyktes' : 'Mislyktes'}</div>` : '';
    $('sheet').querySelector('.choices')!.outerHTML = `<div class="result ${c.check ? (r.ok ? 'ok' : 'fail') : ''}">${tag}${esc(r.text)}${changesHtml(r.changes)}</div><div class="row"><button class="btn" id="ok">Videre</button></div>`;
    $('ok').focus();
    on('ok', done);
  }));
}

/** Etter et tokt-encounter: Fortsett eller Snu. Viser hva gruppa bærer. */
function showToktDecision(toktId: string, done: () => void) {
  const S = game(), t = S.tokts.find((x) => x.id === toktId)!, def = toktDef(toktId);
  const carried = [
    ...RES.filter((k) => (t.haul[k] ?? 0) > 0).map((k) => `${t.haul[k]} ${RES_LABEL[k].toLowerCase()}`),
    ...t.cards.map((k) => CARDS[k.def].name),
  ];
  const last = t.stage >= def.days;
  modal(`<div class="radio">Samband · tokt · Dag ${S.day}</div><h2>${esc(def.name)}</h2>
    <div class="transcript">${esc(`Dag ${t.stage} av ${def.days}. ${last ? 'Dere er framme. Gjør oppdraget ferdig, eller snu med det dere har.' : 'Dere kan gå videre, eller snu og komme hjem i natt.'}`)}</div>
    <p class="hint">Gruppa bærer: ${carried.length ? esc(carried.join(', ')) : 'ingenting ennå'}.</p>
    <p class="hint">Helse: ${S.crew.filter((c) => t.crew.includes(c.id)).map((c) => `${esc(c.name)} ${HEALTH_LABEL[c.hp].toLowerCase()}`).join(', ')}.</p>
    <div class="choices">
      <button class="choice" data-d="fortsett"><span class="ch-top"><span>Fortsett</span><small>${last ? 'Fullfør og få belønningen' : 'Mer bytte, mer risiko'}</small></span></button>
      <button class="choice retreat" data-d="snu"><span class="ch-top"><span>Snu</span><small>Hjem i natt med det dere bærer</small></span></button></div>`);
  $('sheet').querySelectorAll<HTMLButtonElement>('[data-d]').forEach((b) => b.addEventListener('click', () => {
    const text = toktDecision(S, toktId, b.dataset.d as 'fortsett' | 'snu');
    save();
    $('sheet').querySelector('.choices')!.outerHTML = `<div class="result">${esc(text)}</div><div class="row"><button class="btn" id="ok">Videre</button></div>`;
    $('ok').focus();
    on('ok', done);
  }));
}

/** Løser alt som hindrer at dagen avsluttes: dagens hendelse, encounters, så tokt-valg, så ny leder. Gjentas fordi et encounter kan drepe lederen. */
function settle(done: () => void) {
  const S = game(), b = endDayBlocker(S);
  if (b === 'event') showEvent(() => settle(done));
  else if (b === 'pending') showEncounter(S.pending[0], () => settle(done));
  else if (b === 'tokt') showToktDecision(S.tokts.find((t) => t.awaiting)!.id, () => settle(done));
  else if (b === 'leader') chooseLeader(() => settle(done));
  else done();
}

/** Lederen er død: spilleren velger blant de gjenlevende. */
function chooseLeader(done: () => void) {
  const S = game();
  modal(`<div class="radio">Vaktlogg · ${AREA.name}</div><h2>Hvem tar over?</h2>
    <p>Lederen er borte, og crewet har fortsatt ikke blitt enige om hvem som skal skrive vaktlista. Noen må ta ansvar. Helst noen som ikke har meldt seg frivillig.</p>
    <div class="picks">${S.crew.map((c) => `<button class="pick" data-l="${c.id}"><span class="nm">${esc(c.name)}</span><span class="role">${esc(c.role)}</span>
      <span class="tr">${TRAITS[c.trait].name}: ${TRAITS[c.trait].desc}</span><span class="statrow">${statPips(c.stats)}</span></button>`).join('')}</div>`, true);
  $('sheet').querySelectorAll<HTMLButtonElement>('[data-l]').forEach((b) => b.addEventListener('click', () => {
    setLeader(S, b.dataset.l!);
    save();
    done();
  }));
}

/** Spilleren avslutter fasen fra målpanelet. */
export function endPhaseNow() {
  const S = game(), phase = S.phase, start = S.phaseStartDay;
  if (!canEndPhase(S)) return;
  endPhase(S);
  save();
  ui.refresh();
  if (isFinished(S)) endScreen();
  else if (S.phase !== phase) phaseScreen(phase, start, () => { closeModal(); ui.refresh(); });
}

/**
 * Overgangen til en ny fase: hvordan forrige fase endte, mutasjonene og det som er åpnet.
 * `from` og `fromStart` er fasen som nettopp ble avsluttet og dagen den startet.
 */
export function phaseScreen(from: number, fromStart: number, done: () => void) {
  const S = game(), forced = S.log.at(-1)?.lines.some((l) => l.t.startsWith('Fristen gikk ut'));
  const muts = S.mutations.map((id) => MUTATIONS[id]).filter(Boolean);
  const hq = SECTORS[HQ_SECTOR];
  const rec = forced ? null : logRun({ phase: from as 1 | 2, difficulty: S.difficulty, days: S.day - fromStart, combo: recallCombo(S.seed) });
  modal(`<div class="radio">Samband · alle stasjoner · Dag ${S.day}</div>
    <span class="badge ${forced ? 'inf' : 'safe'}">Fase ${from} ${forced ? 'tvunget avsluttet' : 'fullført'}</span>
    <h2>Fase ${S.phase}: ${PHASES[S.phase].name}</h2>
    <p>${forced ? `Fristen gikk ut før ${AREA.name} var sikret, og det kostet.` : `Fase ${from} tok ${S.day - fromStart} dager, og ${winBanner()}.`} ${phase2Teaser(S)}</p>
    ${rec ? recordNote(rec) : ''}
    <div class="card"><span class="badge lock">Zombiene har mutert</span>
      ${muts.length ? `<ul class="mutlist">${muts.map((m) => `<li><b>${m.name}</b> <small>${m.code}</small><br>${esc(m.desc)}</li>`).join('')}</ul>` : '<p>Ingen nye mutasjoner. Denne gangen.</p>'}</div>
    <div class="card"><span class="badge clr">${hq.short} er åpent</span><h2>${hq.name}</h2><p>${esc(phase2Intro())}</p>
      <ul class="mutlist">
        <li>Rydd og gjennomsøk ${hq.short}. Trusselnivå ${hq.threat}: gå mange sammen, og hvil de skadde.</li>
        <li>Anleggene er skjulte. Speiding og gjennomsøking gir rykter.</li>
        <li>Når ${hq.short} er trygg, er HQ-et tatt: senger, poster i crew-fanen og istandsetting.</li>
        <li>${AREA.name} holder seg trygg en stund, men kontrollen forfaller sakte. Portene må fortsatt holdes om natta.</li>
      </ul></div>
    <p class="hint">Mål: gjør ${hq.short} trygg og sett i stand minst ett anlegg. Fristen er ${mods(S).turnCap} dager.</p>
    <div class="row"><button class="btn" id="go2">Til ${hq.short}</button></div>`, true);
  on('go2', () => { ui.sel = { kind: 'sector', id: HQ_SECTOR }; ui.selAction = null; done(); });
}

export function endDay() {
  const S = game(), day = S.day, phase = S.phase, start = S.phaseStartDay;
  if (isFinished(S)) { endScreen(); return; }
  const finish = () => {
    closeModal(); ui.refresh();
    if (isFinished(S)) endScreen();
    // fristen kan tvinge en ny fase i natt
    else if (S.phase !== phase) phaseScreen(phase, start, () => { closeModal(); ui.refresh(); });
  };
  if (endDayBlocker(S)) { settle(finish); return; }
  const lines = resolveDay(S);
  save();
  modal(`<div class="radio">Vaktlogg · ${AREA.name}</div><h2>Dag ${day} er over</h2>
    <div class="logl">${lines.map((l) => `<div class="${l.kind}">${esc(l.t)}</div>`).join('') || '<div>En stille dag. Mistenkelig stille.</div>'}</div>
    <div class="row"><button class="btn" id="ok">${blockerLabel(S) ?? (isFinished(S) ? 'Se oppsummeringen' : `Start dag ${S.day}`)}</button></div>`);
  const after = () => settle(finish);
  on('ok', after);
}

/** Etter at siden er byttet ut: viser det som venter på et valg (hendelse, encounter, tokt, leder). */
export function resumePending() {
  const S = game();
  if (isFinished(S)) { endScreen(); return; }
  settle(() => { closeModal(); ui.refresh(); });
}

export function endScreen() {
  const S = game(), st = S.stats;
  const rec = S.over === 'won' && S.phase <= 2 ? logRun({ phase: S.phase as 1 | 2, difficulty: S.difficulty, days: S.day - S.phaseStartDay, combo: recallCombo(S.seed) }) : null;
  const metric = (k: string, v: number) => `<div class="metric"><div class="k">${k}</div><div class="v">${v}</div></div>`;
  if (S.over === 'won') {
    modal(`<div class="radio">Samband · alle stasjoner</div><h2>${LOCKED.short} er HQ-et</h2>
      <p>${finaleText(S)}</p>
      <div class="metrics">${metric('Dager totalt', S.day - 1)}${metric(`Dager i fase ${S.phase}`, S.day - S.phaseStartDay)}${metric('Zombier ryddet', st.kills)}${metric('Crew mistet', st.lost)}</div>
      ${rec ? recordNote(rec) : ''}${seedHtml(S.seed)}
      <div class="card"><span class="badge lock">Fase 3: ${PHASES[3].name}</span><h2>Fortsettelse følger</h2>
      <p>${PHASES[3].focus} Det er ikke bygd ennå. Dere kan spille videre i sandkassa så lenge dere vil.</p></div>
      <div class="row"><button class="btn ghost" id="newr">Ny runde</button><button class="btn" id="cont">Spill videre</button></div>`);
    on('cont', () => { continueAfterWin(S); closeModal(); ui.refresh(); });
  } else if (S.over === 'timeout') {
    modal(`<div class="radio">Samband · tiden er ute</div><h2>Fristen gikk ut</h2>
      <p>Etter ${S.day - S.phaseStartDay} dager er ${S.phase === 1 ? AREA.name : LOCKED.short} fortsatt ikke sikret. Kommunen har sluttet å ringe, og ${LANDMARKS.sandnes} har begynt å skrive om «den skjebnesvangre ${AREA.district}-avgjørelsen» i festskriftet sitt.</p>
      <div class="metrics">${metric('Dager brukt', S.day - S.phaseStartDay)}${metric('Zombier ryddet', st.kills)}${metric('Crew mistet', st.lost)}</div>
      ${seedHtml(S.seed)}<div class="row"><button class="btn" id="newr">Prøv igjen</button></div>`);
  } else {
    modal(`<div class="radio">Samband · ingen svar</div><h2>${AREA.name} har falt</h2>
      <p>Crewet er borte. Kaffetrakteren står fortsatt på. Kjell ville ha skrevet et avviksskjema.</p>
      <div class="metrics">${metric('Dager', S.day - 1)}${metric('Zombier ryddet', st.kills)}${metric('Ressurser funnet', st.found)}</div>
      ${seedHtml(S.seed)}<div class="row"><button class="btn" id="newr">Prøv igjen</button></div>`);
  }
  on('newr', () => { wipe(); draft.picks = []; titleScreen(); });
}
