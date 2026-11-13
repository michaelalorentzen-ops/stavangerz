/** Static, versioned geography. IDs are opaque; names and array positions are not keys. */
export type Position = readonly [number, number];
export interface Point { readonly type: 'Point'; readonly coordinates: Position }
export interface LineString { readonly type: 'LineString'; readonly coordinates: readonly Position[] }
export interface Polygon { readonly type: 'Polygon'; readonly coordinates: readonly (readonly Position[])[] }
export interface MultiPolygon { readonly type: 'MultiPolygon'; readonly coordinates: readonly Polygon['coordinates'][] }
export type AreaGeometry = Polygon | MultiPolygon;

export interface Source {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly license: string;
  readonly retrievedAt: string;
  readonly note?: string;
}
export interface Zone {
  readonly id: string;
  readonly name: string;
  readonly level: 1 | 2 | 3;
  readonly parentId?: string;
  readonly playable: boolean;
  readonly primaryType?: string;
  /** Authoring data from the zone editor. 0–3 per land use (bolig, dyrking, skog, industri, transport, forsvar). */
  readonly potential?: Readonly<Record<string, number>>;
  /** Older exports: strategic resources marked for the zone. Replaced by finds and produces. */
  readonly resources?: readonly string[];
  /** Resource ids that can be found here once (finite loot). See content-catalog.json. */
  readonly finds?: readonly string[];
  /** Resource and capacity ids the zone can produce again and again (farming, fishing, timber). */
  readonly produces?: readonly string[];
  /** Measured land use from the zone editor; see content.ts for what it is worth. */
  readonly measures?: ZoneMeasures;
  readonly geometry: AreaGeometry;
  readonly rationale: string;
  readonly sourceIds: readonly string[];
}
/** Measured from OpenStreetMap and Matrikkelen in the zone editor. Areas in m², lengths in m. */
export interface ZoneMeasures {
  readonly m2: number;
  /** Shoreline against sea or lake, and boundary against other land zones. */
  readonly coastM: number;
  readonly landEdgeM: number;
  readonly buildings: number;
  /** Estimated residential floor area, and number of homes. */
  readonly floor: number;
  readonly homes: number;
  readonly farm: number;
  readonly forest: number;
  /** Parks, lawns, pitches and heath that can be cultivated. */
  readonly open: number;
  readonly industry: number;
  readonly retail: number;
  readonly greenhouse: number;
  /** From NIBIO AR5 where available: infield pasture, bog, open rock and built-up land. Farm and forest also come from AR5 then. */
  readonly pasture?: number;
  readonly bog?: number;
  readonly rock?: number;
  readonly built?: number;
}
export interface Poi {
  readonly id: string;
  readonly name: string;
  readonly cellId: string;
  readonly kind: string;
  readonly geometry: Point;
  readonly hqCandidate?: boolean;
  /** HQ, outpost, strategic facility or resource site, as distinguished in the locked design. */
  readonly role?: 'hq' | 'outpost' | 'facility' | 'resource';
  readonly hqProfile?: string;
  /** Catalog ids: HQ type for hq and outpost, facility type for facility, site type for resource. */
  readonly hqType?: string;
  readonly facilityType?: string;
  readonly siteType?: string;
  /** Bridges and tunnels: length in metres. The connection itself is a TransportEdge through this place. */
  readonly lengthM?: number;
  readonly resources?: readonly string[];
  readonly notes?: string;
  readonly sourceIds: readonly string[];
}
export type TransportMode = 'walk' | 'cycle' | 'vehicle' | 'boat';
export interface TransportEdge {
  readonly id: string;
  readonly name: string;
  readonly fromCellId: string;
  readonly toCellId: string;
  readonly kind: 'road' | 'footpath' | 'bridge' | 'tunnel' | 'boat';
  readonly modes: readonly TransportMode[];
  readonly status: 'active' | 'proposed' | 'future';
  readonly geometry: LineString;
  readonly sourceIds: readonly string[];
  readonly rationale?: string;
  readonly viaPoiIds?: readonly string[];
}
export interface Barrier {
  readonly id: string;
  readonly name: string;
  readonly kind: 'water' | 'coast' | 'terrain';
  readonly geometry: AreaGeometry | LineString;
  readonly sourceIds: readonly string[];
}
/** Open authoring extent on land; never a physical wall or an unlimited spawn source. */
export interface UnmodeledLandBoundary {
  readonly id: string;
  readonly cellId: string;
  readonly externalAreaId: string;
  readonly kind: 'unmodeled-land';
  readonly geometry: LineString;
  readonly sourceIds: readonly string[];
}
export interface WorldDefinition {
  readonly schemaVersion: 1;
  readonly worldId: string;
  readonly worldVersion: string;
  readonly status: 'draft' | 'approved';
  readonly sources: readonly Source[];
  readonly zones: readonly Zone[];
  readonly pois: readonly Poi[];
  readonly edges: readonly TransportEdge[];
  readonly barriers: readonly Barrier[];
  readonly frontiers?: readonly UnmodeledLandBoundary[];
}

/** Minimal M1 dynamic projection, deliberately separate from immutable geography. */
export interface GameState {
  readonly schemaVersion: 1;
  readonly worldId: string;
  readonly worldVersion: string;
  readonly day: number;
  readonly zoneStates: Readonly<Record<string, {
    readonly knowledge: 'unknown' | 'explored';
    readonly observedDay?: number;
    readonly controlled: boolean;
  }>>;
  readonly poiStates: Readonly<Record<string, { readonly discovered: boolean }>>;
  readonly edgeStates: Readonly<Record<string, { readonly blocked: boolean }>>;
}
