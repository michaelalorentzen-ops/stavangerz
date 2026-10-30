// Portretter: små SVG-fjes laget av id-en, så samme person alltid ser lik ut, på alle maskiner.
// Egenskapen gir et hint i hodeplagget (sydvest til den lokalkjente, hjelm til HMS-folk). Ingen bilder utenfra.
import { NEIGHBORS } from '../engine';
import type { TraitId } from '../engine';

/** FNV-1a: et lite, stabilt tall fra en streng. Bare til utseende, aldri til spillet. */
export function hashStr(t: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

const BG = ['#24394a', '#3a2c44', '#2b4232', '#463626', '#40282e', '#23404a', '#3b3a24'];
const SKIN = ['#f1c9a5', '#e2b08a', '#c98f62', '#a06c45', '#6f4a31', '#f3d8c2'];
const HAIR = ['#2b1d14', '#5a3a22', '#8a5a2b', '#c9a466', '#9b3a1e', '#151515'];
const JACKET = ['#3d5a73', '#6b4a2a', '#4f6b3a', '#7a2f33', '#55506b', '#2f6260', '#8a6a2a'];
const GREY = '#cfcac0';

export interface AvatarPerson { id: string; name: string; trait?: TraitId; hp?: number }

/** Hodeplagg og briller etter egenskap. Tegnes over håret. */
function headwear(trait: TraitId | undefined): string {
  switch (trait) {
    case 'lokalkjent': // sydvest: det regner
      return '<path d="M10 15.5c0-5 4.4-8 10-8s10 3 10 8z" fill="#e3b22e"/><path d="M6 15.5h28l-3.5 3H9.5z" fill="#c9971c"/>';
    case 'hms': // hjelm
      return '<path d="M10.5 16c0-5.5 4.2-8.5 9.5-8.5s9.5 3 9.5 8.5z" fill="#f08a24"/><path d="M8 16h24v2.2H8z" fill="#d06f12"/><path d="M20 7.5v8.5" stroke="#d06f12" stroke-width="1.4"/>';
    case 'los': case 'buss': // skyggelue
      return '<path d="M11 15c0-5 4-7.5 9-7.5s9 2.5 9 7.5z" fill="#26364d"/><path d="M11 15h14.5l4.5 2H11z" fill="#141e2c"/><rect x="18" y="10" width="4" height="2" rx=".5" fill="#c9a466"/>';
    case 'kokk':
      return '<path d="M12 15V11a4 4 0 0 1 3-6 4.5 4.5 0 0 1 10 0 4 4 0 0 1 3 6v4z" fill="#f2efe8"/><path d="M12 15h16" stroke="#cfcac0" stroke-width="1.4"/>';
    case 'hv': // alpelue
      return '<path d="M9.5 14.5c0-4.5 5-7 11.5-6.5 4.5.4 8 2.5 8 5.5z" fill="#3f5a2c"/><circle cx="25" cy="10.5" r="1.4" fill="#c9a466"/>';
    case 'russ': // russelue med dusk
      return '<path d="M11 14.5c0-4.5 4-7 9-7s9 2.5 9 7z" fill="#c8242d"/><path d="M11 14.5h18v1.8H11z" fill="#141414"/><path d="M28 10c3 1 4 4 3.5 7" stroke="#141414" stroke-width="1" fill="none"/><circle cx="31.5" cy="17.5" r="1.3" fill="#141414"/>';
    case 'nattevakt': // lue
      return '<path d="M10.5 16c0-5.5 4.2-9 9.5-9s9.5 3.5 9.5 9z" fill="#2c3440"/><path d="M10.5 14.5h19v2.5h-19z" fill="#3b4656"/>';
    case 'sveiser': // sveisebriller på panna
      return '<path d="M10.5 15h19" stroke="#141414" stroke-width="2"/><circle cx="16" cy="15" r="2.6" fill="#2f4a3a" stroke="#141414" stroke-width="1.2"/><circle cx="24" cy="15" r="2.6" fill="#2f4a3a" stroke="#141414" stroke-width="1.2"/>';
    case 'filmnerd': case 'regneark': // briller
      return `<g fill="none" stroke="#141414" stroke-width="1.2"><rect x="13.2" y="19.2" width="5.6" height="4" rx="1.4"/><rect x="21.2" y="19.2" width="5.6" height="4" rx="1.4"/><path d="M18.8 21h2.4"/></g>`;
    case 'dugnad': // pannebånd
      return '<path d="M10.8 15.5c3-1.5 6-2 9.2-2s6.2.5 9.2 2v2c-3-1.5-6-2-9.2-2s-6.2.5-9.2 2z" fill="#2f7a5a"/>';
    default:
      return '';
  }
}

/** Hår bak ansiktet (langt hår) og over (luggen). */
function hairShapes(style: number, color: string): { back: string; front: string } {
  switch (style) {
    case 0: return { back: '', front: `<path d="M10.5 19c0-6 4-9.5 9.5-9.5s9.5 3.5 9.5 9.5c-1.5-3-4-4.5-9.5-4.5s-8 1.5-9.5 4.5z" fill="${color}"/>` };
    case 1: return { back: `<path d="M9 20c0-7 4.5-11 11-11s11 4 11 11v11h-4.5V20h-13v11H9z" fill="${color}"/>`, front: `<path d="M10.5 18.5c0-5.5 4-9 9.5-9s9.5 3.5 9.5 9c-3-2.5-6.5-3.5-10-3.5-3 0-6 1.2-9 3.5z" fill="${color}"/>` };
    case 2: return { back: '', front: `<path d="M10.6 21c-.6-2.5-.3-4.5.8-5.8M29.4 21c.6-2.5.3-4.5-.8-5.8" stroke="${color}" stroke-width="2.4" fill="none" stroke-linecap="round"/>` };
    case 3: return { back: '', front: `<circle cx="20" cy="8" r="3.4" fill="${color}"/><path d="M10.5 19c0-6 4-9.5 9.5-9.5s9.5 3.5 9.5 9.5c-2-2.5-5-3.8-9.5-3.8s-7.5 1.3-9.5 3.8z" fill="${color}"/>` };
    case 4: return { back: '', front: `<g fill="${color}"><circle cx="13" cy="14" r="3.2"/><circle cx="17" cy="11" r="3.4"/><circle cx="22" cy="10.6" r="3.4"/><circle cx="26.5" cy="13" r="3.2"/><circle cx="28.8" cy="17" r="2.4"/><circle cx="11.2" cy="17.5" r="2.4"/></g>` };
    default: return { back: '', front: `<path d="M10.5 19.5c0-6.5 4-10 9.5-10s9.5 3.5 9.5 9c-4-1-8-3-11-5.5-2 2.5-4.5 4.5-8 6.5z" fill="${color}"/>` };
  }
}

/**
 * Et portrett som inline-SVG. `size` i px. Skadde får plaster (skrapt opp) eller bandasje rundt hodet (ille ute),
 * så det synes på bildet også.
 */
export function avatar(p: AvatarPerson, size = 36, cls = ''): string {
  const h = hashStr(p.id || p.name);
  const pick = <T,>(arr: T[], shift: number) => arr[(h >>> shift) % arr.length];
  const age = NEIGHBORS.find((n) => n.id === p.id)?.age ?? 35;
  const bg = pick(BG, 0), skin = pick(SKIN, 3), jacket = pick(JACKET, 9);
  const hair = age >= 60 ? GREY : pick(HAIR, 6);
  const style = (h >>> 12) % 6, rx = 8.6 + ((h >>> 15) % 3) * 0.6, ry = 10.4 + ((h >>> 17) % 3) * 0.5;
  const mouth = (h >>> 19) % 3;
  const { back, front } = hairShapes(style, hair);
  const hp = p.hp ?? 3;
  const mouthPath = hp <= 1 ? 'M17 28.2c1.8-1 4.2-1 6 0' : mouth === 0 ? 'M17 27.3c1.8 1.2 4.2 1.2 6 0' : mouth === 1 ? 'M17.2 27.6h5.6' : 'M17.5 27.2c1.5.8 3.5.8 5 0';
  const hurt = hp === 2
    ? '<rect x="23.5" y="23" width="5" height="2.2" rx=".6" transform="rotate(-25 26 24)" fill="#f0dcb8" stroke="#b49a6c" stroke-width=".5"/>'
    : hp <= 1
      ? '<path d="M10.5 16.5c3-1.4 6-2 9.5-2s6.5.6 9.5 2v3.2c-3-1.4-6-2-9.5-2s-6.5.6-9.5 2z" fill="#f4f1ea"/><circle cx="25.5" cy="17" r="1.6" fill="#d23a3f"/>'
      : '';
  const ageLines = age >= 60 ? `<path d="M13.5 24.5c.8.6 1.6.8 2.4.6M26.5 24.5c-.8.6-1.6.8-2.4.6" stroke="#00000055" stroke-width=".7" fill="none"/>` : '';
  return `<svg class="av${hp <= 1 ? ' av-h1' : hp === 2 ? ' av-h2' : ''}${cls ? ` ${cls}` : ''}" width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
<g><rect width="40" height="40" fill="${bg}"/>${back}
<path d="M5 41c0-7.5 6.5-10.5 15-10.5S35 33.5 35 41z" fill="${jacket}"/><rect x="17" y="28" width="6" height="4.5" fill="${skin}"/>
<ellipse cx="20" cy="21" rx="${rx}" ry="${ry}" fill="${skin}"/>${front}
<circle cx="16.5" cy="21.2" r="1.15" fill="#1b1410"/><circle cx="23.5" cy="21.2" r="1.15" fill="#1b1410"/>
<path d="M15 18.6h3M22 18.6h3" stroke="${hair}" stroke-width="1" stroke-linecap="round"/>
<path d="${mouthPath}" stroke="#5a2e22" stroke-width="1.1" fill="none" stroke-linecap="round"/>${ageLines}${headwear(p.trait)}${hurt}</g></svg>`;
}
