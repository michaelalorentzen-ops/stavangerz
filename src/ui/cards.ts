// Kortvisning: små brettspillkort, spor på crewkortet, velger og lager.
import { CARDS, equip, SLOT_LABEL, SLOTS, unequip } from '../engine';
import type { CardInst, CrewMember, Slot } from '../engine';
import { $, esc, game, ui } from './store';

const RARITY_LABEL = { vanlig: 'Vanlig', sjelden: 'Sjelden', episk: 'Episk', unik: 'Unik' };

/** Ett kort: navn, spor, nivå som prikker, holdbarhet som stolpe og tekst i kursiv. */
export function cardHtml(k: CardInst): string {
  const d = CARDS[k.def];
  const dots = [1, 2, 3, 4, 5].map((i) => `<i class="${i <= d.level ? 'on' : ''}"></i>`).join('');
  const pct = Math.round((k.dur / d.durability) * 100);
  return `<div class="gc r-${d.rarity}" title="${RARITY_LABEL[d.rarity]} · ${d.family === 'makeshift' ? 'Makeshift' : 'Fra før'}">
    <div class="gc-top"><b>${esc(d.name)}</b><span class="dots">${dots}</span></div>
    <div class="gc-slot">${SLOT_LABEL[d.slot]}${d.quiet ? ' · stille' : ''}</div>
    <div class="gc-dur" title="Holdbarhet ${k.dur}/${d.durability}"><i style="width:${pct}%"></i></div>
    <p><em>${esc(d.text)}</em></p>
  </div>`;
}

/** De tre sporene på crewkortet. Klikk åpner velgeren. */
export function slotsHtml(c: CrewMember): string {
  const open = ui.picker?.crewId === c.id ? ui.picker.slot : null;
  const slots = SLOTS.map((slot) => {
    const k = c.gear[slot];
    const d = k && CARDS[k.def];
    return `<button class="slot${open === slot ? ' open' : ''}${k ? ' filled' : ''}" data-slot="${slot}" data-crew="${c.id}" aria-pressed="${open === slot}">
      <small>${SLOT_LABEL[slot]}</small><span>${d ? esc(d.name) : '—'}</span>${k && d ? `<span class="gc-dur"><i style="width:${Math.round((k.dur / d.durability) * 100)}%"></i></span>` : ''}</button>`;
  }).join('');
  return `<div class="slots">${slots}</div>${open ? pickerHtml(c, open) : ''}`;
}

function pickerHtml(c: CrewMember, slot: Slot): string {
  const fits = game().stash.filter((k) => CARDS[k.def].slot === slot);
  const cur = c.gear[slot];
  return `<div class="picker">
    ${cur ? `<div class="pk"><div class="gc-label">Utstyrt</div>${cardHtml(cur)}<button class="btn ghost small" data-unequip="${slot}" data-crew="${c.id}">Ta av</button></div>` : ''}
    ${fits.map((k) => `<div class="pk">${cardHtml(k)}<button class="btn small" data-equip="${k.uid}" data-crew="${c.id}">Ta på</button></div>`).join('')}
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
  root.querySelectorAll<HTMLButtonElement>('[data-equip]').forEach((b) => b.addEventListener('click', () => {
    equip(game(), b.dataset.crew!, b.dataset.equip!);
    ui.refresh();
  }));
  root.querySelectorAll<HTMLButtonElement>('[data-unequip]').forEach((b) => b.addEventListener('click', () => {
    unequip(game(), b.dataset.crew!, b.dataset.unequip as Slot);
    ui.refresh();
  }));
}

export function renderStash() {
  const S = game(), box = $('stash');
  box.innerHTML = S.stash.length
    ? `<div class="stash">${S.stash.map(cardHtml).join('')}</div>`
    : '<p class="hint">Lageret er tomt. Rydd tomme sektorer for å finne utstyr.</p>';
}
