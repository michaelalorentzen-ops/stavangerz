// Ikonsettet: små inline-SVG-er på et 24×24-rutenett, tegnet med strek i currentColor, så de følger fargen
// til teksten rundt. Ingen bilder lastes utenfra. Bare visning: ikonene sier ingenting om reglene.
import { RES, RES_LABEL } from '../engine';
import type { CardDef, ResKey, Slot, WeaponClass } from '../engine';

const P: Record<string, string> = {
  // ressurser
  mat: '<ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6"/><path d="M5 11.5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"/>',
  vann: '<path d="M12 3c3.5 4.5 6 8 6 11a6 6 0 0 1-12 0c0-3 2.5-6.5 6-11z"/><path d="M9.2 15a2.8 2.8 0 0 0 2.8 2.8"/>',
  medisin: '<rect x="3.5" y="6.5" width="17" height="13" rx="2"/><path d="M9 6.5v-2h6v2"/><path d="M12 10v6M9 13h6"/>',
  tre: '<ellipse cx="6.5" cy="12" rx="3" ry="4"/><circle cx="6.5" cy="12" r="1"/><path d="M6.5 8h11a3 4 0 0 1 0 8h-11"/><path d="M11 10.5h5"/>',
  skrap: '<path d="M12 3.5l7.4 4.25v8.5L12 20.5l-7.4-4.25v-8.5z"/><circle cx="12" cy="12" r="3"/>',
  metall: '<path d="M3 18.5h18l-2.5-5.5h-13z"/><path d="M6.5 13l2-4.5h7l2 4.5"/>',
  strom: '<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>',
  drivstoff: '<path d="M6 8l3.5-3.5H18a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z"/><path d="M9.5 11.5l5.5 5.5M15 11.5L9.5 17"/><path d="M13 4.5V3h3v1.5"/>',
  // våpenklasser
  slag: '<path d="M14 4l6 6-3 3-6-6z"/><path d="M12.5 8.5L4 17a1.4 1.4 0 0 0 0 2l1 1a1.4 1.4 0 0 0 2 0l8.5-8.5"/>',
  egg: '<path d="M20.5 3.5C14 5 9.5 9 7 14.5l2.5 2.5C15 14.5 19 10 20.5 3.5z"/><path d="M6.5 14l-3 3 3.5 3.5 3-3"/>',
  prosjektil: '<path d="M4.5 19.5L19 5"/><path d="M13.5 4.5H19.5V10.5"/><path d="M4 15.5v4.5h4.5"/><path d="M7.5 16.5L6 15"/>',
  skytevapen: '<path d="M3 7h18v4.5h-8.5l-1.2 2.3H9.5L8.3 20H4.2l1.6-8.5H3z"/><path d="M11.3 11.5v2.3"/><path d="M18 7V5.5"/>',
  brann: '<path d="M12 21a6 6 0 0 0 6-6c0-4-3-6.5-4.5-11-1.5 2.5-2 4-2 5.5C10.5 8.5 9.5 8 9 6.5 7 8.5 6 11.5 6 15a6 6 0 0 0 6 6z"/><path d="M12 21a2.5 2.5 0 0 1-2.5-2.5c0-1.5 1.2-2.6 2.5-4.2 1.3 1.6 2.5 2.7 2.5 4.2A2.5 2.5 0 0 1 12 21z"/>',
  motor: '<rect x="2.5" y="9" width="8" height="7" rx="1.5"/><path d="M10.5 10.5h9a2 2 0 0 1 0 4h-9"/><path d="M12.5 10.5l1-1.3 1 1.3 1-1.3 1 1.3 1-1.3 1 1.3M12.5 14.5l1 1.3 1-1.3 1 1.3 1-1.3 1 1.3 1-1.3"/><path d="M4.5 9V7h4.5"/>',
  // spor
  vapen: '<path d="M20.5 3.5l-.8 4.3-9.4 9.4-3.5-3.5 9.4-9.4z"/><path d="M5.5 12.5l6 6M3.5 20.5l3.2-3.2"/>',
  beskyttelse: '<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z"/><path d="M12 7v10"/>',
  verktoy: '<path d="M14.7 4.2a4.5 4.5 0 0 0-4.4 6L4 16.5 7.5 20l6.3-6.3a4.5 4.5 0 0 0 6-4.4l-2.7 2.7-3-.6-.6-3z"/>',
  // helse og folk
  hjerte: '<path d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.4 4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" fill="currentColor"/>',
  hjerteTomt: '<path d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.4 4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  skadet: '<rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-35 12 12)"/><path d="M10.6 10.6h.01M13.4 13.4h.01M13.4 10.6h.01M10.6 13.4h.01"/>',
  dod: '<path d="M12 3a7.5 7.5 0 0 0-7.5 7.5c0 2.5 1.2 4.3 3 5.4V19a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-3.1c1.8-1.1 3-2.9 3-5.4A7.5 7.5 0 0 0 12 3z"/><circle cx="9" cy="11" r="1.6" fill="currentColor"/><circle cx="15" cy="11" r="1.6" fill="currentColor"/><path d="M10.5 20v-2.5M13.5 20v-2.5"/>',
  nyPerson: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M19 8v6M16 11h6"/>',
  borte: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 11h6"/>',
  // byen og natta
  zombie: '<path d="M7.5 21v-5.5L5 12a1.2 1.2 0 0 1 2-1.3l1.5 1.8V5.5a1.2 1.2 0 0 1 2.4 0V10V4a1.2 1.2 0 0 1 2.4 0v6V5.2a1.2 1.2 0 0 1 2.4 0V11V7.6a1.2 1.2 0 0 1 2.4 0V15l-1.6 6"/><path d="M3 21h18"/>',
  drap: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5"/>',
  port: '<path d="M5 21V7.5l1.5-3 1.5 3V21M11 21V7.5l1.5-3 1.5 3V21M17 21V7.5l1.5-3 1.5 3V21"/><path d="M3 10.5h18M3 17h18"/>',
  utstyr: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 10h17M10 10v9M14 10v9"/>',
  moral: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14.5c1 1.3 2.2 2 3.5 2s2.5-.7 3.5-2"/><path d="M9 9.5v1M15 9.5v1"/>',
  natt: '<path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.5 6.5 0 0 0 10 10z"/>',
  advarsel: '<path d="M12 3.5L21.5 20h-19z"/><path d="M12 10v4.5M12 17.2h.01"/>',
  oppdrag: '<path d="M6 3.5h9l3.5 3.5v13.5H6z"/><path d="M9 11h6.5M9 14.5h6.5M9 8h3"/>',
  kontroll: '<path d="M5 21V4"/><path d="M5 4.5h12l-2.5 3.5 2.5 3.5H5"/>',
  speid: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  sok: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/>',
};

export type IconName = keyof typeof P;

/** Et ikon som inline-SVG. `cls` legges til klassen `ic`, og `title` gir et navn for skjermlesere. */
export function icon(name: string, cls = '', title = ''): string {
  const body = P[name] ?? P.utstyr;
  const label = title ? ` role="img" aria-label="${title.replace(/"/g, '&quot;')}"` : ' aria-hidden="true"';
  return `<svg class="ic ic-${name}${cls ? ` ${cls}` : ''}" viewBox="0 0 24 24"${label} focusable="false">${body}</svg>`;
}

export const resIcon = (k: ResKey, cls = ''): string => icon(k, cls);
export const classIcon = (c: WeaponClass, cls = ''): string => icon(c, cls);
export const slotIcon = (s: Slot, cls = ''): string => icon(s, cls);

/** Ikonet et kort tegnes med: våpenklassen for våpen, ellers sporet. */
export const cardIconName = (d: Pick<CardDef, 'slot' | 'weaponClass'>): string => (d.slot === 'vapen' && d.weaponClass ? d.weaponClass : d.slot);

/** Helse som hjerter: fylte for det personen har igjen, tomme for det som mangler. */
export function heartsHtml(hp: number, max = 3): string {
  return Array.from({ length: max }, (_, i) => icon(i < hp ? 'hjerte' : 'hjerteTomt', i < hp ? 'on' : 'off')).join('');
}

/** Navnet på ikonet til en endrings- eller forhåndsvisningslinje: ressursen den nevner, ellers hva den handler om. Tom streng uten treff. */
export function lineIconName(line: string): string {
  const t = line.toLowerCase();
  for (const k of RES) if (new RegExp(`(^|\\s)${RES_LABEL[k].toLowerCase()}($|[\\s,.])`).test(t)) return k;
  const rules: [RegExp, string][] = [
    [/døde|dør\b|liv\b/, 'dod'],
    [/borte for godt/, 'borte'],
    [/skade/, 'skadet'],
    [/blir med|ny i crewet/, 'nyPerson'],
    [/slit|utstyr/, 'utstyr'],
    [/zombie/, 'zombie'],
    [/moral/, 'moral'],
    [/portarbeid|nivå /, 'port'],
    [/oppdrag/, 'oppdrag'],
    [/kontroll/, 'kontroll'],
    [/speid/, 'speid'],
    [/gjennomsøkt|søker? gjennom/, 'sok'],
  ];
  return rules.find(([re]) => re.test(t))?.[1] ?? '';
}

/** Ikonet til en endrings- eller forhåndsvisningslinje som inline-SVG. Tom streng uten treff. */
export function lineIcon(line: string): string {
  const name = lineIconName(line);
  return name ? icon(name) : '';
}
