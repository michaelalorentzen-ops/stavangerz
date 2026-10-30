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
 * Én forhåndsvisningslinje uten tall. «+1 medisin» blir «kan gi medisin», «opptil −2 mat» blir «kan koste mat»,
 * «−2 til +3 moral» blir «kan gi eller koste moral». Linjer uten tall («kan gi skade», «nytt utstyr») står som før.
 */
export function vagueLine(line: string): VagueLine {
  const t = line.trim();
  // «+3 mat», «opptil −4 mat», «+1–3 mat», «−3–1 mat», «−2 til +3 mat»
  const m = /^(?:opptil\s+)?([+−-])\d+(?:–\d+)?(?:\s+til\s+([+−-])\d+)?\s+(.+)$/.exec(t);
  if (!m) return { text: t, bad: /^[−-]|skade|slit|døde|dør\b|borte for godt|koste|fikk ikke/i.test(t) };
  const [, s1, s2, label] = m;
  const res = RES_BY_LABEL.get(label);
  const neg = s1 !== '+';
  const name = label.replace(/^zombie$/, 'zombier');
  if (s2 && (s2 === '+') === neg) return { text: `kan gi eller koste ${name}`, bad: true, res };
  if (MORE_IS_WORSE.test(label)) return neg ? { text: 'kan fjerne zombier', bad: false } : { text: 'kan trekke til zombier', bad: true };
  return neg ? { text: `kan koste ${name}`, bad: true, res } : { text: `kan gi ${name}`, bad: false, res };
}

/** Hele forhåndsvisningen uten tall. Like linjer slås sammen, så «+1 mat» og «+2 mat» ikke står to ganger. */
export function vaguePreview(p: { ok: string[]; fail: string[] | null }): { ok: VagueLine[]; fail: VagueLine[] | null } {
  const conv = (ls: string[]) => {
    const seen = new Set<string>();
    return ls.map(vagueLine).filter((l) => (seen.has(l.text) ? false : (seen.add(l.text), true)));
  };
  return { ok: conv(p.ok), fail: p.fail ? conv(p.fail) : null };
}
