// Kortvisning: små brettspillkort, spor på crewkortet, velger og lager.
import { bestCopy, CARDS, equip, groupStash, isOnTokt, salvage, salvageCopy, salvageValue, SLOT_LABEL, SLOTS, STAT_LABEL, toggleFavorite, unequip } from '../engine';
import type { CardInst, CrewMember, Slot } from '../engine';
import { $, esc, game, ui } from './store';

const RARITY_LABEL = { vanlig: 'Vanlig', sjelden: 'Sjelden', episk: 'Episk', unik: 'Unik' };

const bonusText = (d: (typeof CARDS)[string]) =>
  Object.entries(d.bonus ?? {}).map(([k, v]) => `+${v} ${STAT_LABEL[k as keyof typeof STAT_LABEL]}`).join(', ');

const RANGE_LABEL = { naerkamp: 'Nærkamp', avstand: 'Avstand' };
const NOISE_LABEL = { stille: 'Stille', normal: 'Normal støy', brak: 'Bråk' };
export const TAG_LABEL = { gjennomslag: 'Gjennomslag', spredning: 'Spredning', rekkevidde: 'Rekkevidde' };
/** Små merker for våpen: nærkamp eller avstand, støy og taggene. */
export const weaponBadges = (d: (typeof CARDS)[string]): string => d.slot !== 'vapen' ? '' :
  `<div class="gc-tags">${d.range ? `<span class="tagchip">${RANGE_LABEL[d.range]}</span>` : ''}<span class="tagchip n-${d.noise ?? 'normal'}">${NOISE_LABEL[d.noise ?? 'normal']}</span>${(d.tags ?? []).map((t) => `<span class="tagchip t">${TAG_LABEL[t]}</span>`).join('')}</div>`;

/** Ett kort, eller en stabel med identiske kort. Navn, spor, nivå, bonus, holdbarhet, demonteringsverdi og tekst i kursiv. */
export function cardHtml(k: CardInst, group: CardInst[] = [k], inStash = false): string {
  const d = CARDS[k.def];
  const n = group.length;
  const dots = [1, 2, 3, 4, 5].map((i) => `<i class="${i <= d.level ? 'on' : ''}"></i>`).join('');
  const durs = group.map((c) => c.dur);
  const lo = Math.min(...durs), hi = Math.max(...durs);
  const pct = Math.round((hi / d.durability) * 100);
  const anyFav = group.some((c) => c.fav);
  const favIds = group.map((c) => c.uid).join(',');
  const bonus = bonusText(d);
  const sv = salvageValue(d).skrap ?? 0;
  const copies = n > 1 ? `<details class="copies"><summary>Kopier</summary>${[...group].sort((a, b) => b.dur - a.dur).map((c) =>
    `<div class="copy"><button class="fav${c.fav ? ' on' : ''}" data-fav="${c.uid}" aria-pressed="${!!c.fav}" aria-label="Favoritt" title="Favoritt">${c.fav ? '★' : '☆'}</button>${c.dur}/${d.durability}</div>`).join('')}</details>` : '';
  const actions = inStash ? `<div class="gc-act">
      <button class="btn ghost small" data-salvage="${favIds}" ${salvageCopy(group) ? '' : 'disabled'} title="Demonterer kopien med lavest holdbarhet, aldri en favoritt">Demonter +${sv} skrap</button></div>` : '';
  return `<div class="gc r-${d.rarity}" title="${RARITY_LABEL[d.rarity]} · ${d.family === 'makeshift' ? 'Makeshift' : 'Fra før'}">
    <div class="gc-top"><button class="fav${anyFav ? ' on' : ''}" data-fav="${n > 1 ? 'stack:' : ''}${favIds}" aria-pressed="${anyFav}" aria-label="Favoritt" title="Favoritt">${anyFav ? '★' : '☆'}</button><b>${esc(d.name)}${n > 1 ? ` ×${n}` : ''}</b><span class="dots">${dots}</span></div>
    <div class="gc-slot">${SLOT_LABEL[d.slot]} · ${RARITY_LABEL[d.rarity]}${bonus ? ` · ${bonus}` : ''}</div>
    ${weaponBadges(d)}
    <div class="gc-dur" title="Holdbarhet"><i style="width:${pct}%"></i></div>
    <div class="gc-slot">Holdbarhet ${lo === hi ? lo : `${lo}–${hi}`}/${d.durability} · Gir ${sv} skrap</div>
    <p><em>${esc(d.text)}</em></p>${copies}${actions}
  </div>`;
}

/** De tre sporene på crewkortet. Klikk åpner velgeren. */
export function slotsHtml(c: CrewMember): string {
  // lageret er hjemme: de som er på tokt kan ikke bytte utstyr
  const away = isOnTokt(game(), c);
  const open = !away && ui.picker?.crewId === c.id ? ui.picker.slot : null;
  const slots = SLOTS.map((slot) => {
    const k = c.gear[slot];
    const d = k && CARDS[k.def];
    return `<button class="slot${open === slot ? ' open' : ''}${k ? ' filled' : ''}" data-slot="${slot}" data-crew="${c.id}" aria-pressed="${open === slot}"${away ? ' disabled title="Ute på tokt"' : ''}>
      <small>${SLOT_LABEL[slot]}</small><span>${d ? esc(d.name) : '—'}</span>${k && d ? `<span class="gc-dur"><i style="width:${Math.round((k.dur / d.durability) * 100)}%"></i></span>` : ''}</button>`;
  }).join('');
  return `<div class="slots">${slots}</div>${open ? pickerHtml(c, open) : ''}`;
}

function pickerHtml(c: CrewMember, slot: Slot): string {
  const fits = game().stash.filter((k) => CARDS[k.def].slot === slot);
  const cur = c.gear[slot];
  return `<div class="picker">
    ${cur ? `<div class="pk"><div class="gc-label">Utstyrt</div>${cardHtml(cur)}<button class="btn ghost small" data-unequip="${slot}" data-crew="${c.id}">Ta av</button></div>` : ''}
    ${groupStash(fits).map((g) => `<div class="pk">${cardHtml(g.cards[0], g.cards)}<button class="btn small" data-equip="${bestCopy(g.cards).uid}" data-crew="${c.id}">Ta på</button></div>`).join('')}
    ${!cur && !fits.length ? `<p class="hint">Ingen ${SLOT_LABEL[slot].toLowerCase()}-kort på lageret.</p>` : ''}
  </div>`;
}

/** Kobler spor, velger og lager. Endrer tilstand bare via motorfunksjonene. */
export function bindCards(root: HTMLElement) {
  root.querySelectorAll<HTMLButtonElement>('[data-slot]').forEach((b) => b.addEventListener('click', () => {
    const slot = b.dataset.slot as Slot, id = b.dataset.crew!;
    ui.picker = ui.picker?.crewId === id && ui.picker.slot === slot ? null : { crewId: id, slot };
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
  box.innerHTML = `<div class="seg" role="group" aria-label="Sorter lageret">${sorts}</div><div class="stash">${sortedStash(S.stash).map((g) => cardHtml(g.cards[0], g.cards, true)).join('')}</div>`;
  box.querySelectorAll<HTMLButtonElement>('[data-sort]').forEach((b) => b.addEventListener('click', () => { ui.stashSort = b.dataset.sort as typeof ui.stashSort; renderStash(); }));
  bindCards(box);
}
