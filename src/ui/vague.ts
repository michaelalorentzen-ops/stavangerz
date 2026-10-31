// «Midt imellom»: før et valg ser spilleren retning og risiko, ikke tallene. Motoren regner fortsatt nøyaktig
// (previewChoice, checkOdds, og boten bruker tallene). Her gjøres bare visningen om til ord. Etter valget vises
// de nøyaktige endringene som før (changesHtml).
import { RES, RES_LABEL } from '../engine';
import type { ResKey } from '../engine';

/** Sjansen i ord: «god sjanse» fra 70 %, «usikkert» fra 40 %, ellers «dårlig sjanse». */
export function oddsWord(p: number): string {
  if (p >= 0.7) return 'god sjanse';
  if (p >= 0.4) return 'usikkert';
  return 'dårlig sjanse';
}

/** Klassen sjansen får i visningen, så fargen følger ordet. */
export const oddsClass = (p: number): 'ok' | 'mid' | 'bad' => (p >= 0.7 ? 'ok' : p >= 0.4 ? 'mid' : 'bad');

export interface VagueLine {
  text: string;
  bad: boolean;
  /** ressursen linja handler om, for ikonet */
  res?: ResKey;
}

const RES_BY_LABEL = new Map<string, ResKey>(RES.map((k) => [RES_LABEL[k].toLowerCase(), k]));
/** Ting der mer er verre: flere zombier er ikke en gevinst. */
const MORE_IS_WORSE = /^zombier?$/;

/**
 * Linjer motoren skriver uten tall når alle prøvekjøringene ga det samme (summarize i outcome.ts). De er sikre
 * innenfor grenen, så de får et ord som sier hva som skjer. «kan …»-linjene fra motoren står som de er.
 */
const SURE_WORDS: Record<string, string> = {
  'skade': 'noen blir skadet',
  'noen dør': 'noen dør',
  'utstyret slites': 'utstyret slites',
  'ny i crewet': 'noen blir med',
  'noen er borte for godt': 'noen er borte for godt',
  'nytt utstyr': 'gir utstyr',
  'nytt oppdrag': 'gir nytt oppdrag',
};

/** Ord for ting som ikke er en ressurs: [sikkert, usikkert]. Resten blir «gir X» og «kan gi X». */
const GAIN_WORDS: Record<string, [string, string]> = {
  'sektor speidet': ['speider en sektor', 'kan speide en sektor'],
  'sektorer speidet': ['speider sektorer', 'kan speide sektorer'],
  'gjennomsøkt': ['søker gjennom mer', 'kan søke gjennom mer'],
};

/**
 * Én forhåndsvisningslinje uten tall. Sikre utfall sier hva som skjer: «+3 mat» og «+1–3 mat» blir «gir mat»,
 * «−2 mat» blir «koster mat». «kan» står bare der utfallet er usikkert innenfor grenen: «opptil −2 mat» blir
 * «kan koste mat», «−2 til +3 moral» blir «kan gi eller koste moral», og motorens egne «kan gi skade» står som før.
 */
export function vagueLine(line: string): VagueLine {
  const t = line.trim();
  // «+3 mat», «opptil −4 mat», «+1–3 mat», «−3–1 mat», «−2 til +3 mat»
  const m = /^(opptil\s+)?([+−-])\d+(?:–\d+)?(?:\s+til\s+([+−-])\d+)?\s+(.+)$/.exec(t);
  if (!m) {
    const text = SURE_WORDS[t] ?? t;
    return { text, bad: /^[−-]|skade|slit|døde|dør\b|borte for godt|koste|fikk ikke/i.test(text) };
  }
  const [, upTo, s1, s2, label] = m;
  const res = RES_BY_LABEL.get(label);
  const neg = s1 !== '+';
  const name = label.replace(/^zombie$/, 'zombier');
  if (s2 && (s2 === '+') === neg) return { text: `kan gi eller koste ${name}`, bad: true, res };
  const sure = !upTo;
  if (MORE_IS_WORSE.test(label)) {
    return neg ? { text: sure ? 'fjerner zombier' : 'kan fjerne zombier', bad: false } : { text: sure ? 'trekker til zombier' : 'kan trekke til zombier', bad: true };
  }
  if (neg) return { text: sure ? `koster ${name}` : `kan koste ${name}`, bad: true, res };
  const words = GAIN_WORDS[label];
  return { text: words ? words[sure ? 0 : 1] : sure ? `gir ${name}` : `kan gi ${name}`, bad: false, res };
}

/** Hele forhåndsvisningen uten tall. Like linjer slås sammen, så «+1 mat» og «+2 mat» ikke står to ganger. */
export function vaguePreview(p: { ok: string[]; fail: string[] | null }): { ok: VagueLine[]; fail: VagueLine[] | null } {
  const conv = (ls: string[]) => {
    const seen = new Set<string>();
    return ls.map(vagueLine).filter((l) => (seen.has(l.text) ? false : (seen.add(l.text), true)));
  };
  return { ok: conv(p.ok), fail: p.fail ? conv(p.fail) : null };
}
