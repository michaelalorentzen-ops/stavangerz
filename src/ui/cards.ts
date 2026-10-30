// Kortvisning: små brettspillkort, spor på crewkortet, velger og lager.
import { bestCopy, cardBonus, cardEffect, CARDS, equip, groupStash, isOnTokt, salvage, salvageCopy, salvageValue, SLOT_LABEL, SLOTS, STAT_LABEL, STATS, toggleFavorite, unequip } from '../engine';
import type { CardDef, CardInst, CrewMember, Slot, StatKey } from '../engine';
import { $, esc, game, ui } from './store';

const RARITY_LABEL = { vanlig: 'Vanlig', sjelden: 'Sjelden', episk: 'Episk', unik: 'Unik' };

/** Forkortelsen ferdighetsstolpene bruker: MUS, KON, SNO, NER, MEK, PRA. */
export const statAbbr = (k: StatKey): string => STAT_LABEL[k].slice(0, 3).toUpperCase();

/** Tekstsymboler (ikke emoji) for sporene. */
export const SLOT_ICON: Record<Slot, string> = { vapen: '⚔\uFE0E', beskyttelse: '◈\uFE0E', verktoy: '⚒\uFE0E' };

/** Hva kortet gir, som tekst: «+3 MUS +2 PRA · Kampkraft ×1,2». */
export function fxText(def: CardDef): string {
  const b = cardBonus(def);
  const pts = STATS.filter((k) => b[k]).map((k) => `+${b[k]} ${statAbbr(k)}`).join(' ');
  return [pts, cardEffect(def)].filter(Boolean).join(' · ');
}

/** Det samme som små chips. */
export function fxHtml(def: CardDef): string {
  const b = cardBonus(def);
  return `<span class="fx">${STATS.filter((k) => b[k]).map((k) => `<i class="up">+${b[k]} ${statAbbr(k)}</i>`).join('')}<i class="eff">${esc(cardEffect(def))}</i></span>`;
}

/** Hva det ville endret for personen å bytte til kortet, mot det som sitter i sporet nå. Bare visning. */
export function deltaHtml(c: CrewMember, def: CardDef): string {
  const cur = c.gear[def.slot], curDef = cur ? CARDS[cur.def] : null;
  if (cur && cur.def === def.id) return `<div class="delta">${esc(c.name)} har denne på</div>`;
  const nb = cardBonus(def), ob = curDef ? cardBonus(curDef) : {};
  const diff = STATS.map((k) => [k, (nb[k] ?? 0) - (ob[k] ?? 0)] as const).filter(([, d]) => d !== 0);
  const pts = diff.map(([k, d]) => `<i class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : '−'}${Math.abs(d)} ${statAbbr(k)}</i>`).join('');
  const eff = curDef ? `${esc(cardEffect(curDef))} → ${esc(cardEffect(def))}` : esc(cardEffect(def));
  return `<div class="delta"><span class="who">For ${esc(c.name)}:</span><span class="fx">${pts || '<i>ingen poeng</i>'}<i class="eff">${eff}</i></span></div>`;
}

const RANGE_LABEL = { naerkamp: 'Nærkamp', avstand: 'Avstand' };
const NOISE_LABEL = { stille: 'Stille', normal: 'Normal støy', brak: 'Bråk' };
export const TAG_LABEL = { gjennomslag: 'Gjennomslag', spredning: 'Spredning', rekkevidde: 'Rekkevidde' };
/** Små merker for våpen: nærkamp eller avstand, støy og taggene. */
export const weaponBadges = (d: (typeof CARDS)[string]): string => d.slot !== 'vapen' ? '' :
  `<div class="gc-tags">${d.range ? `<span class="tagchip">${RANGE_LABEL[d.range]}</span>` : ''}<span class="tagchip n-${d.noise ?? 'normal'}">${NOISE_LABEL[d.noise ?? 'normal']}</span>${(d.tags ?? []).map((t) => `<span class="tagchip t">${TAG_LABEL[t]}</span>`).join('')}</div>`;

/** Ett kort, eller en stabel med identiske kort. Navn, spor, nivå, bonus, holdbarhet, demonteringsverdi og tekst i kursiv. */
export function cardHtml(k: CardInst, group: CardInst[] = [k], inStash = false, forCrew: CrewMember | null = null): string {
  const d = CARDS[k.def];
  const n = group.length;
  const dots = [1, 2, 3, 4, 5].map((i) => `<i class="${i <= d.level ? 'on' : ''}"></i>`).join('');
  const durs = group.map((c) => c.dur);
  const lo = Math.min(...durs), hi = Math.max(...durs);
  const pct = Math.round((hi / d.durability) * 100);
  const anyFav = group.some((c) => c.fav);
  const favIds = group.map((c) => c.uid).join(',');
  const sv = salvageValue(d).skrap ?? 0;
  const copies = n > 1 ? `<details class="copies"><summary>Kopier</summary>${[...group].sort((a, b) => b.dur - a.dur).map((c) =>
    `<div class="copy"><button class="fav${c.fav ? ' on' : ''}" data-fav="${c.uid}" aria-pressed="${!!c.fav}" aria-label="Favoritt" title="Favoritt">${c.fav ? '★' : '☆'}</button>${c.dur}/${d.durability}</div>`).join('')}</details>` : '';
  const give = forCrew && !isOnTokt(game(), forCrew) && forCrew.gear[d.slot]?.def !== d.id
    ? `<button class="btn small" data-equip="${bestCopy(group).uid}" data-crew="${forCrew.id}">Gi til ${esc(forCrew.name)}</button>` : '';
  const actions = inStash ? `<div class="gc-act">${give}
      <button class="btn ghost small" data-salvage="${favIds}" ${salvageCopy(group) ? '' : 'disabled'} title="Demonterer kopien med lavest holdbarhet, aldri en favoritt">Demonter +${sv} skrap</button></div>` : '';
  return `<div class="gc r-${d.rarity}" title="${RARITY_LABEL[d.rarity]} · ${d.family === 'makeshift' ? 'Makeshift' : 'Fra før'}">
    <div class="gc-top"><button class="fav${anyFav ? ' on' : ''}" data-fav="${n > 1 ? 'stack:' : ''}${favIds}" aria-pressed="${anyFav}" aria-label="Favoritt" title="Favoritt">${anyFav ? '★' : '☆'}</button><b>${esc(d.name)}${n > 1 ? ` ×${n}` : ''}</b><span class="dots">${dots}</span></div>
    <div class="gc-slot">${SLOT_ICON[d.slot]} ${SLOT_LABEL[d.slot]} · ${RARITY_LABEL[d.rarity]}</div>
    ${fxHtml(d)}
    ${forCrew ? deltaHtml(forCrew, d) : ''}
    ${weaponBadges(d)}
    <div class="gc-dur" title="Holdbarhet"><i style="width:${pct}%"></i></div>
    <div class="gc-slot">Holdbarhet ${lo === hi ? lo : `${lo}–${hi}`}/${d.durability} · Gir ${sv} skrap</div>
    <p><em>${esc(d.text)}</em></p>${copies}${actions}
  </div>`;
}

/** De tre sporene på crewraden. Klikk åpner velgeren. Utfoldet viser hvert spor hva kortet gir. */
export function slotsHtml(c: CrewMember, detailed = false): string {
  // lageret er hjemme: de som er på tokt kan ikke bytte utstyr
  const away = isOnTokt(game(), c);
  const open = !away && ui.picker?.crewId === c.id ? ui.picker.slot : null;
  const slots = SLOTS.map((slot) => {
    const k = c.gear[slot];
    const d = k && CARDS[k.def];
    const tip = away ? 'Ute på tokt' : d ? `${SLOT_LABEL[slot]}: ${d.name} · ${fxText(d)} · holdbarhet ${k!.dur}/${d.durability}` : `${SLOT_LABEL[slot]}: tomt`;
    return `<button class="slot${open === slot ? ' open' : ''}${k ? ' filled' : ''}" data-slot="${slot}" data-crew="${c.id}" aria-pressed="${open === slot}" title="${esc(tip)}"${away ? ' disabled' : ''}>
      <span class="sl"><b aria-hidden="true">${SLOT_ICON[slot]}</b><span class="sn">${d ? esc(d.name) : `<span class="empty">${SLOT_LABEL[slot]}</span>`}</span></span>${detailed && d ? fxHtml(d) : ''}${k && d ? `<span class="gc-dur"><i style="width:${Math.round((k.dur / d.durability) * 100)}%"></i></span>` : ''}</button>`;
  }).join('');
  return `<div class="slots${detailed ? ' detailed' : ''}">${slots}</div>${open ? pickerHtml(c, open) : ''}`;
}

function pickerHtml(c: CrewMember, slot: Slot): string {
  const fits = game().stash.filter((k) => CARDS[k.def].slot === slot);
  const cur = c.gear[slot];
  return `<div class="picker">
    ${cur ? `<div class="pk"><div class="gc-label">Utstyrt</div>${cardHtml(cur)}<button class="btn ghost small" data-unequip="${slot}" data-crew="${c.id}">Ta av</button></div>` : ''}
    ${groupStash(fits).map((g) => `<div class="pk">${cardHtml(g.cards[0], g.cards, false, c)}<button class="btn small" data-equip="${bestCopy(g.cards).uid}" data-crew="${c.id}">Ta på</button></div>`).join('')}
    ${!cur && !fits.length ? `<p class="hint">Ingen ${SLOT_LABEL[slot].toLowerCase()}-kort på lageret.</p>` : ''}
  </div>`;
}

/** Kobler spor, velger og lager. Endrer tilstand bare via motorfunksjonene. */
export function bindCards(root: HTMLElement) {
  root.querySelectorAll<HTMLButtonElement>('[data-slot]').forEach((b) => b.addEventListener('click', () => {
    const slot = b.dataset.slot as Slot, id = b.dataset.crew!;
    ui.picker = ui.picker?.crewId === id && ui.picker.slot === slot ? null : { crewId: id, slot };
    if (ui.picker) ui.openCrew = id; // velgeren hører til den utfoldede raden
    ui.refresh();
  }));
  root.querySelectorAll<HTMLButtonElement>('[data-fav]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.fav!;
    if (id.startsWith('stack:')) {
      // Stabel: har noen kopi favoritt fjernes alle, ellers merkes kopien med mest holdbarhet
      const cards = id.slice(6).split(',').map((u) => game().stash.find((k) => k.uid === u)).filter((k): k is CardInst => !!k);
      if (cards.some((k) => k.fav)) cards.filter((k) => k.fav).forEach((k) => toggleFavorite(game(), k.uid));
      else if (cards.length) toggleFavorite(game(), bestCopy(cards).uid);
    } else toggleFavorite(game(), id);
    ui.refresh();
  }));
  root.querySelectorAll<HTMLButtonElement>('[data-salvage]').forEach((b) => b.addEventListener('click', () => {
    const cards = b.dataset.salvage!.split(',').map((u) => game().stash.find((k) => k.uid === u)).filter((k): k is CardInst => !!k);
    const k = salvageCopy(cards);
    if (!k) return;
    const d = CARDS[k.def];
    if (d.rarity === 'unik') {
      // unike kort finnes bare ett av, så demontering må bekreftes
      if (!confirm(`${d.name} er unik. Det finnes ikke flere av den i Stavanger. Demontere likevel for ${salvageValue(d).skrap} skrap?`)) return;
      salvage(game(), k.uid, { allowUnique: true });
    } else salvage(game(), k.uid);
    ui.refresh();
  }));
  root.querySelectorAll<HTMLButtonElement>('[data-equip]').forEach((b) => b.addEventListener('click', () => {
    equip(game(), b.dataset.crew!, b.dataset.equip!);
    ui.refresh();
  }));
  root.querySelectorAll<HTMLButtonElement>('[data-unequip]').forEach((b) => b.addEventListener('click', () => {
    unequip(game(), b.dataset.crew!, b.dataset.unequip as Slot);
    ui.refresh();
  }));
}

const SORTS = { spor: 'Spor', nivå: 'Nivå', sjeldenhet: 'Sjeldenhet', holdbarhet: 'Holdbarhet' } as const;
const RARITY_ORDER = { unik: 0, episk: 1, sjelden: 2, vanlig: 3 };

/** Stabler med favoritter først, så valgt sortering (UI-visning, endrer ikke lageret). */
function sortedStash(cards: CardInst[]) {
  const key = (g: { def: string; cards: CardInst[] }): number => {
    const d = CARDS[g.def];
    switch (ui.stashSort) {
      case 'spor': return SLOTS.indexOf(d.slot);
      case 'nivå': return -d.level;
      case 'sjeldenhet': return RARITY_ORDER[d.rarity];
      case 'holdbarhet': return Math.max(...g.cards.map((k) => k.dur)) / d.durability;
    }
  };
  const fav = (g: { cards: CardInst[] }) => Number(g.cards.some((k) => k.fav));
  return groupStash(cards).sort((a, b) => fav(b) - fav(a) || key(a) - key(b) || CARDS[b.def].level - CARDS[a.def].level || a.def.localeCompare(b.def));
}

export function renderStash() {
  const S = game(), box = $('stash');
  if (!S.stash.length) { box.innerHTML = '<p class="hint">Lageret er tomt. Rydd tomme sektorer for å finne utstyr.</p>'; return; }
  const sorts = (Object.keys(SORTS) as (keyof typeof SORTS)[]).map((k) => `<button data-sort="${k}" aria-pressed="${ui.stashSort === k}">${SORTS[k]}</button>`).join('');
  // sammenlign mot den som er foldet ut i crew-fanen, eller den som sist ble valgt her
  const cmp = ui.compareCrew === '' ? null : S.crew.find((c) => c.id === ui.compareCrew) ?? S.crew.find((c) => c.id === ui.openCrew) ?? null;
  const who = `<label class="cmp">Sammenlign for <select id="cmp-crew"><option value="">ingen</option>${S.crew.map((c) => `<option value="${c.id}"${cmp?.id === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>`;
  box.innerHTML = `<div class="seg" role="group" aria-label="Sorter lageret">${sorts}</div>${who}<div class="stash">${sortedStash(S.stash).map((g) => cardHtml(g.cards[0], g.cards, true, cmp)).join('')}</div>`;
  box.querySelectorAll<HTMLButtonElement>('[data-sort]').forEach((b) => b.addEventListener('click', () => { ui.stashSort = b.dataset.sort as typeof ui.stashSort; renderStash(); }));
  $<HTMLSelectElement>('cmp-crew').addEventListener('change', (e) => { ui.compareCrew = (e.target as HTMLSelectElement).value || ''; renderStash(); });
  bindCards(box);
}
