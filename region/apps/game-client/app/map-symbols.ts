import type { IconName } from './tactical-icons';

/** Curated visual land-use labels, independent of combat, loot and save schemas. */
export const zoneSymbols: Record<string, { icon: IconName; label: string }> = {
  'cell-001': {icon:'residential',label:'Boligområde'},
  'cell-002': {icon:'sports',label:'Idrettsområde'},
  'cell-003': {icon:'residential',label:'Boligområde'},
  'cell-004': {icon:'residential',label:'Boligområde'},
  'cell-006': {icon:'industrial',label:'Industriområde'},
  'cell-007': {icon:'transport',label:'Gjennomfart'},
  'cell-008': {icon:'scavenge',label:'Næring og bolig'},
  'cell-009': {icon:'residential',label:'Boligområde'},
  'cell-010': {icon:'scavenge',label:'Handelsområde'},
  'cell-011': {icon:'school',label:'Skole og idrett'},
  'cell-012': {icon:'industrial',label:'Verftsområde'},
  'cell-013': {icon:'transport',label:'Bruforbindelse'},
  'cell-014': {icon:'industrial',label:'Kai og industri'},
};
export function zoneSymbol(id: string) { return zoneSymbols[id] ?? {icon:'area' as const,label:'Område'}; }
export function poiSymbol(kind: string): IconName {
  return ({medical:'medicine',supplies:'scavenge',industrial:'industrial',power:'power',school:'school',sports:'sports',transport:'transport',junction:'transport'} as Record<string,IconName>)[kind] ?? 'pin';
}
export function poiKindLabel(kind: string): string {
  return ({medical:'Apotek / medisin',supplies:'Forsyningslager',industrial:'Verft / verksted',power:'Teknisk anlegg',school:'Skole',sports:'Idrettsanlegg',transport:'Transportanlegg',junction:'Veikryss'} as Record<string,string>)[kind] ?? 'Forsyningssted';
}
