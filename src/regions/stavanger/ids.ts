// Id-ene i Stavanger-pakken. Id-ene står i lagrede spill, så de endres aldri. Navnene står i places.ts.
// Hver region må ha sektoren 'hjem', der crewet bor og der Hvile, Trene, Lage og Pleie skjer.

/** Alle sektorer på kartet. Sektorer for senere faser har `opensInPhase` i places.ts og er låst til da. */
export type SectorId = 'hjem' | 'tommerodden' | 'obs' | 'nordkrysset' | 'buoy_nord' | 'skolen' | 'sorspissen' | 'rosenberg';
/** Gammelt navn fra da låste sektorer ikke var sektorer. Det samme som SectorId. */
export type MapSectorId = SectorId;
export type GateId = 'nord' | 'sor' | 'ros';
/** Soner utenfor fase 1-området, vist i tåka */
export type ZoneId = 'hundvag' | 'engoy' | 'solyst' | 'grasholmen' | 'bjornoy' | 'roaldsoy' | 'ormoy' | 'steinsoy' | 'sentrum' | 'bjergsted';
/** Flagg som innholdet i denne regionen setter */
export type RegionFlag = 'gann' | 'aggregat' | 'buss' | 'katt' | 'svein';
