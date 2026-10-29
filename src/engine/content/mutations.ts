// Mutasjonskatalogen (plassholder). Hver gren har en fast rekkefølge:
// neste mutasjon i grenen kan først trekkes når den forrige er på plass.
import type { Branch, MutationDef } from '../types';

export const BRANCHES: Branch[] = ['bevegelse', 'sanser', 'kropp', 'atferd'];

export const BRANCH_LABEL: Record<Branch, string> = { bevegelse: 'Bevegelse', sanser: 'Sanser', kropp: 'Kropp', atferd: 'Atferd' };

const list: MutationDef[] = [
  { id: 'lopere', branch: 'bevegelse', order: 1, name: 'Løpere', code: 'Z12-J1', gene: 'OPH3S', desc: 'Noen av dem har begynt å jogge. Flere skader i kamp.', mult: { injuryMult: 1.25 } },
  { id: 'hoppere', branch: 'bevegelse', order: 2, name: 'Hoppere', code: 'Z12-J2', gene: 'MYO7K', desc: 'De tar gjerdene i ett byks. Sperringene gjør mindre nytte.', mult: { nightLevelReduction: 0.85 } },
  { id: 'svommere', branch: 'bevegelse', order: 3, name: 'Svømmere', code: 'Z14-S1', gene: 'AQP9X', desc: 'Sundet er ikke lenger en grense. Det er mest en ulempe.', mult: {} },
  { id: 'dykkere', branch: 'bevegelse', order: 4, name: 'Dykkere', code: 'Z14-S2', gene: 'HBB-DV', desc: 'De går under vann og kommer opp der ingen venter dem.', mult: {} },
  { id: 'horsel', branch: 'sanser', order: 1, name: 'Hørsel', code: 'Z21-H1', gene: 'TMC1R', desc: 'De hører hver spade i hagen. Sektorer uten folk fylles raskere.', mult: { creepChance: 1.3 } },
  { id: 'lukt', branch: 'sanser', order: 2, name: 'Luktesans', code: 'Z21-H2', gene: 'OR5A2', desc: 'De finner matlageret på lukt. Vi kan ikke si at det er uventet.', mult: {} },
  { id: 'seige', branch: 'kropp', order: 1, name: 'Seige', code: 'Z33-K1', gene: 'COL1A9', desc: 'De tåler mer juling enn før.', mult: { killMult: 0.85 } },
  { id: 'pansret', branch: 'kropp', order: 2, name: 'Pansret hud', code: 'Z33-K2', gene: 'KRT14X', desc: 'Huden har blitt som regntøy fra Helly Hansen, bare verre.', mult: { killMult: 0.9 } },
  { id: 'giftig', branch: 'kropp', order: 3, name: 'Giftige', code: 'Z35-K3', gene: 'TTX-B7', desc: 'Bitt og riper gjør mer skade enn de burde.', mult: { injuryMult: 1.15 } },
  { id: 'smarte', branch: 'atferd', order: 1, name: 'Smarte', code: 'Z47-A1', gene: 'FOXP2Z', desc: 'De tester sperringene om natta, igjen og igjen.', mult: { nightBase: 1.5, nightLevelReduction: 0.85 } },
  { id: 'flokk', branch: 'atferd', order: 2, name: 'Flokk', code: 'Z47-A2', gene: 'OXTR-Q', desc: 'De kommer i grupper. Gjennombrudd blir større.', mult: { breachDays: 0.75 } },
  { id: 'kjellergravere', branch: 'atferd', order: 3, name: 'Kjellergravere', code: 'Z48-A3', gene: 'DIG4L', desc: 'De har lært seg å gjemme seg. Flere kjellere bryter ut.', mult: { hiddenRatio: 1.3, hiddenOutbreak: 1.4 } },
  { id: 'jegere', branch: 'atferd', order: 4, name: 'Jegere', code: 'Z48-A4', gene: 'DRD4-H', desc: 'De oppsøker crew som er ute, ikke bare dem som er hjemme.', mult: {} },
];

export const MUTATIONS: Record<string, MutationDef> = Object.fromEntries(list.map((m) => [m.id, m]));

/** Mutasjonene i en gren, i rekkefølge. */
export const branchMutations = (b: Branch): MutationDef[] => list.filter((m) => m.branch === b).sort((x, y) => x.order - y.order);
