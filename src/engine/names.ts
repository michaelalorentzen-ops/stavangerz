// Navn på crewet i tekstene. Spilleren uten eget navn heter «Du» og bøyes etter plassen i setningen.
import type { CrewMember } from './types';

/** «Du», «Du og Mona», «Du, Mona og Tor-Egil»: komma mellom, «og» bare før siste. */
export function nameList(names: string[]): string {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} og ${names[names.length - 1]}`;
}
/** Navnet spilleren får uten å skrive inn et selv. Da er spilleren «du» i tekstene. */
export const YOU = 'Du';
/**
 * Hvor i setningen navnet står: 'start' først i en setning, 'mid' som subjekt midt i en setning
 * («alt du gjør»), 'obj' som objekt eller etter preposisjon («får øye på deg», «tilhørende deg»).
 */
export type NameForm = 'start' | 'mid' | 'obj';
/** Navnet i riktig form. Bare spilleren uten navn bøyes: «Du», «du», «deg». */
export const nameAs = (c: Pick<CrewMember, 'name'>, form: NameForm = 'start'): string =>
  c.name !== YOU ? c.name : form === 'start' ? YOU : form === 'mid' ? 'du' : 'deg';
/** Navnene på en gruppe crewmedlemmer som en leselig liste. Med 'start' står bare det første navnet først i setningen. */
export const names = (cs: Pick<CrewMember, 'name'>[], form: NameForm = 'start'): string =>
  nameList(cs.map((c, i) => nameAs(c, i === 0 ? form : form === 'obj' ? 'obj' : 'mid')));
