// Id-ene i Stavanger-pakken. Id-ene står i lagrede spill, så de endres aldri. Navnene står i places.ts.
// Hver region må ha sektoren 'hjem', der crewet bor og der Hvile, Trene, Lage og Pleie skjer.

/** Sektorer crewet kan jobbe i i fase 1 */
export type SectorId = 'hjem' | 'tommerodden' | 'obs' | 'nordkrysset' | 'buoy_nord' | 'skolen' | 'sorspissen';
/** Sektorer på kartet, også de som er låst til en senere fase */
export type MapSectorId = SectorId | 'rosenberg';
export type GateId = 'nord' | 'sor' | 'ros';
/** Soner utenfor fase 1-området, vist i tåka */
export type ZoneId = 'hundvag' | 'engoy' | 'solyst' | 'grasholmen' | 'bjornoy' | 'roaldsoy' | 'ormoy' | 'steinsoy' | 'sentrum' | 'bjergsted';
/** Flagg som innholdet i denne regionen setter */
export type RegionFlag = 'gann' | 'aggregat' | 'buss' | 'katt' | 'svein';
