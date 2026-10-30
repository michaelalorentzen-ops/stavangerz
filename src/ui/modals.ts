// Dialoger: tittelskjerm, oppstart, hendelseskort, dagsrapport og slutt.
import {
  best, CARDS, checkOdds, continueAfterWin, describeEncounter, drawEvent, canEndPhase, endDayBlocker, endPhase, isFinished, RES, RES_LABEL, toktDecision, toktDef, INTRO, NEIGHBORS, newGame, resolveDay, resolveEncounter, runChoice, SELF_TRAITS, setLeader, START_NEIGHBORS,
  STAT_HINT, STAT_LABEL, STATS, sum, TRAITS,
} from '../engine';
import type { EventDef, PendingEncounter, Stats, TraitId } from '../engine';
import { blockerLabel, statPips } from './panel';
import { TAG_LABEL } from './cards';
import { $, esc, game, load, save, ui, wipe } from './store';

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
  const saved = load();
  modal(`<div class="title" style="display:grid;gap:18px">
    <div class="kick">Et turbasert overlevelsesspill fra byøyene</div>
    <h1>STAVANGER <b>Z</b></h1>
    <p>Utbruddet starter en tirsdag morgen. Du bor på Buøy. Bybrua er stengt, Rosenberg er overkjørt, og det regner. Samle et crew blant naboene, rydd øya sektor for sektor og bygg sperringer før natta tar dere.</p>
    <div class="coords">58°59′N 5°43′Ø · Buøy, Hundvåg bydel</div>
    <div class="row" style="justify-content:flex-start">
      <button class="btn" id="new">Ny runde</button>
      ${saved && !isFinished(saved) ? `<button class="btn ghost" id="cont">Fortsett dag ${saved.day}</button>` : ''}
    </div></div>`);
  on('new', createSelf);
  on('cont', () => {
    ui.S = saved; closeModal(); ui.refresh();
    settle(() => { closeModal(); ui.refresh(); if (saved && isFinished(saved)) endScreen(); });
  });
}

const POOL = 15;
export const draft: { name: string; stats: Stats; trait: TraitId; picks: string[] } = {
  name: '', stats: { muskler: 3, kondis: 2, snoking: 3, nerver: 3, mekk: 2, prat: 2 }, trait: 'lokalkjent', picks: [],
};

function createSelf() {
  const used = sum(Object.values(draft.stats));
  const pips = (n: number) => [1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('');
  modal(`<span class="eyebrow">Steg 1 av 2</span><h2>Hvem er du?</h2>
    <div class="field"><label for="nm">Navn</label><input id="nm" maxlength="18" placeholder="Deg" value="${esc(draft.name)}"></div>
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
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) | 0;
    ui.S = newGame(seed, { name: draft.name.trim() || 'Deg', stats: { ...draft.stats }, trait: draft.trait }, draft.picks);
    ui.sel = { kind: 'sector', id: 'hjem' };
    ui.refresh();
    showEvent(INTRO, () => { closeModal(); ui.refresh(); });
  });
}

function showEvent(ev: EventDef, done: () => void) {
  const S = game();
  const choices = ev.choices.filter((c) => !c.when || c.when(S));
  modal(`<div class="radio">${ev.channel ?? 'Samband · kanal 16'} · Dag ${S.day}</div><h2>${ev.title}</h2>
    <div class="transcript">${esc(ev.text(S))}</div>
    <div class="choices">${choices.map((c, i) => `<button class="choice" data-i="${i}"><span>${c.label}</span>${c.check ? `<small>${STAT_LABEL[c.check]} · ${esc(best(S, c.check).name)} · ${Math.round(checkOdds(S, c.check) * 100)}%</small>` : ''}</button>`).join('')}</div>`);
  $('sheet').querySelectorAll<HTMLButtonElement>('[data-i]').forEach((b) => b.addEventListener('click', () => {
    const ch = choices[Number(b.dataset.i)];
    const r = runChoice(S, ch);
    save();
    const tag = ch.check ? `<div class="tag">${r.ok ? 'Lyktes' : 'Mislyktes'}</div>` : '';
    $('sheet').querySelector('.choices')!.outerHTML = `<div class="result ${ch.check ? (r.ok ? 'ok' : 'fail') : ''}">${tag}${esc(r.text)}</div><div class="row"><button class="btn" id="ok">Videre</button></div>`;
    $('ok').focus();
    on('ok', done);
  }));
}

/** Et ventende encounter: samme stil som hendelseskort, med odds og våpentagg. */
function showEncounter(p: PendingEncounter, done: () => void) {
  const S = game(), v = describeEncounter(S, p);
  const odds = (c: (typeof v.choices)[number]) => c.check
    ? `<small>${STAT_LABEL[c.check]} · ${esc(c.best ?? '')} · ${Math.round(c.odds * 100)}%${c.tag ? ` · <b>${TAG_LABEL[c.tag].toLowerCase()}${c.tagBonus ? ' +20 %' : ''}</b>` : ''}</small>` : '';
  modal(`<div class="radio">Samband · ${esc(v.crew.join(' og '))} · Dag ${S.day}</div><h2>${esc(v.title)}</h2>
    <div class="transcript">${esc(v.text)}</div>
    <div class="choices">${v.choices.map((c, i) => `<button class="choice${c.retreat ? ' retreat' : ''}" data-i="${i}"><span>${esc(c.label)}</span>${odds(c)}</button>`).join('')}</div>`);
  $('sheet').querySelectorAll<HTMLButtonElement>('[data-i]').forEach((b) => b.addEventListener('click', () => {
    const i = Number(b.dataset.i), c = v.choices[i];
    const r = resolveEncounter(S, p.pid, i);
    save();
    const tag = c.check ? `<div class="tag">${r.ok ? 'Lyktes' : 'Mislyktes'}</div>` : '';
    $('sheet').querySelector('.choices')!.outerHTML = `<div class="result ${c.check ? (r.ok ? 'ok' : 'fail') : ''}">${tag}${esc(r.text)}</div><div class="row"><button class="btn" id="ok">Videre</button></div>`;
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
    <div class="choices">
      <button class="choice" data-d="fortsett"><span>Fortsett</span><small>${last ? 'Fullfør og få belønningen' : 'Mer bytte, mer risiko'}</small></button>
      <button class="choice retreat" data-d="snu"><span>Snu</span><small>Hjem i natt med det dere bærer</small></button></div>`);
  $('sheet').querySelectorAll<HTMLButtonElement>('[data-d]').forEach((b) => b.addEventListener('click', () => {
    const text = toktDecision(S, toktId, b.dataset.d as 'fortsett' | 'snu');
    save();
    $('sheet').querySelector('.choices')!.outerHTML = `<div class="result">${esc(text)}</div><div class="row"><button class="btn" id="ok">Videre</button></div>`;
    $('ok').focus();
    on('ok', done);
  }));
}

/** Løser alt som hindrer at dagen avsluttes: encounters, så tokt-valg, så ny leder. Gjentas fordi et encounter kan drepe lederen. */
function settle(done: () => void) {
  const S = game(), b = endDayBlocker(S);
  if (b === 'pending') showEncounter(S.pending[0], () => settle(done));
  else if (b === 'tokt') showToktDecision(S.tokts.find((t) => t.awaiting)!.id, () => settle(done));
  else if (b === 'leader') chooseLeader(() => settle(done));
  else done();
}

/** Lederen er død: spilleren velger blant de gjenlevende. */
function chooseLeader(done: () => void) {
  const S = game();
  modal(`<div class="radio">Vaktlogg · Buøy</div><h2>Hvem tar over?</h2>
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
  const S = game();
  if (!canEndPhase(S)) return;
  endPhase(S);
  save();
  ui.refresh();
  if (isFinished(S)) endScreen();
}

export function endDay() {
  const S = game(), day = S.day;
  if (isFinished(S)) { endScreen(); return; }
  const finish = () => { closeModal(); ui.refresh(); if (isFinished(S)) endScreen(); };
  if (endDayBlocker(S)) { settle(finish); return; }
  const lines = resolveDay(S);
  const ev = S.over ? null : drawEvent(S);
  save();
  modal(`<div class="radio">Vaktlogg · Buøy</div><h2>Dag ${day} er over</h2>
    <div class="logl">${lines.map((l) => `<div class="${l.kind}">${esc(l.t)}</div>`).join('') || '<div>En stille dag. Mistenkelig stille.</div>'}</div>
    <div class="row"><button class="btn" id="ok">${ev ? 'Samband: ny melding' : blockerLabel(S) ?? (isFinished(S) ? 'Se oppsummeringen' : `Start dag ${S.day}`)}</button></div>`);
  const after = () => settle(finish);
  on('ok', () => (ev ? showEvent(ev, after) : after()));
}

export function endScreen() {
  const S = game(), st = S.stats;
  const metric = (k: string, v: number) => `<div class="metric"><div class="k">${k}</div><div class="v">${v}</div></div>`;
  if (S.over === 'won') {
    modal(`<div class="radio">Samband · alle stasjoner</div><h2>Buøy er sikret</h2>
      <p>Fase 1 er fullført på ${S.day - S.phaseStartDay} dager, og færre er bedre. Sperringene holder, kjellerne er (antakelig) tomme, og noen har hengt opp et banner på Obs Bygg: «BUØY: 1 – APOKALYPSEN: 0».</p>
      <div class="metrics">${metric('Zombier ryddet', st.kills)}${metric('Ressurser funnet', st.found)}${metric('Crew mistet', st.lost)}</div>
      <div class="card"><span class="badge lock">Neste: Fase 2</span><h2>Rosenberg Verft</h2>
      <p>Horden på verftet venter. ${S.flags.gann ? 'Skoleskipet Gann ligger klart ved Tømmerodden.' : 'Dere har ingen båt ennå.'} ${S.flags.buss ? 'Kolumbus-bussen på Sørspissen har full tank.' : 'Dere har ikke funnet transport ennå.'}</p></div>
      <div class="row"><button class="btn ghost" id="newr">Ny runde</button><button class="btn" id="cont">Fortsett på Buøy</button></div>`);
    on('cont', () => { continueAfterWin(S); closeModal(); ui.refresh(); });
  } else if (S.over === 'timeout') {
    modal(`<div class="radio">Samband · tiden er ute</div><h2>Fristen gikk ut</h2>
      <p>Etter ${S.day - S.phaseStartDay} dager er Buøy fortsatt ikke sikret. Kommunen har sluttet å ringe, og Sandnes har begynt å skrive om «den skjebnesvangre Hundvåg-avgjørelsen» i festskriftet sitt.</p>
      <div class="metrics">${metric('Dager brukt', S.day - S.phaseStartDay)}${metric('Zombier ryddet', st.kills)}${metric('Crew mistet', st.lost)}</div>
      <div class="row"><button class="btn" id="newr">Prøv igjen</button></div>`);
  } else {
    modal(`<div class="radio">Samband · ingen svar</div><h2>Buøy har falt</h2>
      <p>Crewet er borte. Kaffetrakteren står fortsatt på. Kjell ville ha skrevet et avviksskjema.</p>
      <div class="metrics">${metric('Dager', S.day - 1)}${metric('Zombier ryddet', st.kills)}${metric('Ressurser funnet', st.found)}</div>
      <div class="row"><button class="btn" id="newr">Prøv igjen</button></div>`);
  }
  on('newr', () => { wipe(); draft.picks = []; titleScreen(); });
}
