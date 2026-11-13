import polygonClipping from 'polygon-clipping';
import type { MultiPolygon as ClipMultiPolygon, Polygon as ClipPolygon, Ring as ClipRing } from 'polygon-clipping';

// The package exposes its functions on the default export; named imports fail in the Next.js bundle.
const clipping = polygonClipping;
import type { AreaGeometry, Position, WorldDefinition, Zone } from './model';
import { geometryIssues, pointInArea } from './validate';

export const polygons = (area: AreaGeometry) => area.type === 'Polygon' ? [area.coordinates] : area.coordinates;
const clip = (area: AreaGeometry) => polygons(area).map(p => p.map(r => r.map(([x,y]): [number,number] => [x,y])));
export const areaGeometry = (coordinates: ClipMultiPolygon): AreaGeometry =>
  coordinates.length === 1 ? {type:'Polygon',coordinates:coordinates[0]} : {type:'MultiPolygon',coordinates};
export function joinAreas(a: AreaGeometry, b: AreaGeometry) {
  return areaGeometry(clipping.union(clip(a),clip(b)));
}
export function subtractArea(a: AreaGeometry, b: AreaGeometry) {
  const remaining = clipping.difference(clip(a),clip(b));
  if (!remaining.length) throw new Error('Distriktet må beholde noe areal.');
  return areaGeometry(remaining);
}
export function areasOverlap(a:AreaGeometry,b:AreaGeometry){
  return clipping.intersection(clip(a),clip(b)).length>0;
}
export function trimArea(a:AreaGeometry,b:AreaGeometry):AreaGeometry|null {
  const result=clipping.intersection(clip(a),clip(b));
  return result.length?areaGeometry(result):null;
}

/** A stroke is one edit, regardless of how many pointer events it contains. */
export function brushArea(points:readonly Position[],radius:number):AreaGeometry {
  const rings:ClipPolygon[]=[];
  const circle=(p:Position):ClipRing=>Array.from({length:13},(_,i)=>{
    const angle=(i%12)*Math.PI/6;
    return [p[0]+Math.cos(angle)*radius/.515,p[1]+Math.sin(angle)*radius];
  });
  points.forEach((p,i)=>{
    rings.push([circle(p)]);
    if(!i)return;
    const a=points[i-1],dx=(p[0]-a[0])*.515,dy=p[1]-a[1],length=Math.hypot(dx,dy);
    if(!length)return;
    const x=-dy/length*radius/.515,y=dx/length*radius;
    rings.push([[[a[0]+x,a[1]+y],[p[0]+x,p[1]+y],[p[0]-x,p[1]-y],[a[0]-x,a[1]-y],[a[0]+x,a[1]+y]]]);
  });
  return areaGeometry(clipping.union(rings[0],...rings.slice(1)));
}

/** Snap the painted perimeter, keeping the pointer path and brush width independent. */
export function snapBrushBoundary(
  area: AreaGeometry,
  step: number,
  snapPoint: (point: Position) => Position,
): AreaGeometry {
  let changed = false;
  const coordinates = polygons(area).map(polygon => polygon.map(ring => {
    const points: Position[] = [];
    for (let i = 1; i < ring.length; i++) {
      const a = ring[i - 1], b = ring[i];
      const count = Math.ceil(distance(a, b) / step);
      for (let j = 0; j < count; j++) {
        const fraction = j / count;
        const sample: Position = [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction];
        const point = snapPoint(sample);
        changed ||= distance(point, sample) > 1e-11;
        if (!points.length || distance(points.at(-1)!, point) > 1e-11) points.push(point);
      }
    }
    if (points.length > 1 && distance(points.at(-1)!, points[0]) <= 1e-11) points.pop();
    return [...points, points[0]];
  }));
  if (!changed) return area;
  const snapped: AreaGeometry = area.type === 'Polygon'
    ? {type: 'Polygon', coordinates: coordinates[0]}
    : {type: 'MultiPolygon', coordinates};
  if (coordinates.some(polygon => polygon.some(ring => ring.length < 4)) || geometryIssues('pensel', snapped).length) {
    throw new Error('Penselkanten krysser seg ved snapping. Prøv et kortere strøk eller velg én type festepunkt.');
  }
  return snapped;
}

/** Clip to the district before touching siblings. Reassigning land uses one
 * polygon operation for both sides, so there is no independent border to align. */
export function reshapeZone(zones:readonly Zone[],district:Zone,target:Zone,mask:AreaGeometry,
  action:'expand'|'erase'|'create',locked:readonly string[]):readonly Zone[] {
  if(target.parentId!==district.id||target.level!==3||locked.includes(target.id))throw new Error('Velg en ulåst L3-sone i distriktet.');
  if(geometryIssues('markering',mask).length)throw new Error('Markeringen må ha et areal og kan ikke krysse seg selv.');
  const area=trimArea(mask,district.geometry);
  if(!area)throw new Error('Det markerte arealet ligger utenfor distriktet.');
  if(action==='erase'){
    if(!areasOverlap(area,target.geometry))throw new Error('Viskelæret traff ikke den valgte sonen.');
    return zones.map(z=>z.id===target.id?{...z,geometry:subtractArea(target.geometry,area)}:z);
  }
  const neighbors=zones.filter(z=>z.level===3&&z.parentId===district.id&&z.id!==target.id&&areasOverlap(z.geometry,area));
  const protectedZone=neighbors.find(z=>locked.includes(z.id));
  if(protectedZone)throw new Error(`${protectedZone.name} er låst. Lås opp sonen eller marker et mindre areal.`);
  const geometry=action==='create'?area:joinAreas(target.geometry,area);
  const updated=zones.map(z=>{
    if(z.id===target.id)return {...z,geometry};
    if(!neighbors.includes(z))return z;
    try{return {...z,geometry:subtractArea(z.geometry,area)};}
    catch{throw new Error(`Hele ${z.name} er markert. Bruk Slå sammen for å overta hele sonen.`);}
  });
  return action==='create'?[...updated,{...target,geometry}]:updated;
}

/** Transfer one source-bounded map block, keeping both L3 and provisional L2 borders consistent. */
export function assignAreaToZone(
  zones: readonly Zone[],
  targetId: string,
  mask: AreaGeometry,
  locked: readonly string[],
): readonly Zone[] {
  const target = zones.find(zone => zone.id === targetId && zone.level === 3);
  const parent = zones.find(zone => zone.id === target?.parentId);
  const region = zones.find(zone => zone.id === parent?.parentId);
  if (!target || !parent || !region) throw new Error('Velg en L3-sone først.');
  if (locked.includes(target.id)) throw new Error('Lås opp den valgte sonen først.');
  if (geometryIssues('kartflate', mask).length) throw new Error('Kartflaten har ugyldig geometri.');
  const area = trimArea(mask, region.geometry);
  if (!area) throw new Error('Kartflaten ligger utenfor regionen.');
  if (!clipping.difference(clip(area), clip(target.geometry)).length) return zones;
  const neighbors = zones.filter(zone => zone.level === 3 && zone.id !== target.id
    && areasOverlap(area, zone.geometry));
  const protectedZone = neighbors.find(zone => locked.includes(zone.id));
  if (protectedZone) throw new Error(`${protectedZone.name} er låst. Lås opp sonen før du flytter grensen.`);
  const affected = [target, ...neighbors];
  const affectedIds = new Set(affected.map(zone => zone.id));
  const expanded = joinAreas(target.geometry, area);
  if (polygons(expanded).length > polygons(target.geometry).length) {
    throw new Error('Kartflaten må dele en grense med den valgte sonen.');
  }
  const updated = zones.map(zone => {
    if (zone.id === target.id) return {...zone, geometry: expanded};
    if (!affectedIds.has(zone.id)) return zone;
    const remainder = clipping.difference(clip(zone.geometry), clip(area));
    if (!remainder.length) {
      throw new Error(`Kartflaten dekker hele ${zone.name}. Bruk Slå sammen for å fjerne hele sonen.`);
    }
    return {...zone, geometry: areaGeometry(remainder)};
  });
  const parents = new Set(affected.map(zone => zone.parentId));
  if (parents.size === 1) return updated;
  return updated.map(zone => {
    if (zone.level !== 2 || !parents.has(zone.id)) return zone;
    if (locked.includes(zone.id)) throw new Error(`L2-distriktet ${zone.name} er låst.`);
    const oldChildren = affected.filter(child => child.parentId === zone.id);
    const newChildren = updated.filter(child => affectedIds.has(child.id) && child.parentId === zone.id);
    const remainder = clipping.difference(clip(zone.geometry), ...oldChildren.map(child => clip(child.geometry)));
    const geometry = areaGeometry(clipping.union(clip(newChildren[0].geometry), remainder,
      ...newChildren.slice(1).map(child => clip(child.geometry))));
    return {...zone, geometry};
  });
}
export function nearestOnSegment(p:Position,a:Position,b:Position):Position {
  const x=(b[0]-a[0])*.515,y=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((p[0]-a[0])*.515*x+(p[1]-a[1])*y)/(x*x+y*y||1)));
  return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
}
export const distance = (a:Position,b:Position) => Math.hypot((a[0]-b[0])*.515,a[1]-b[1]);
function boundaryPoint(p: Position, ring: readonly Position[]) {
  let best={i:0,p:ring[0],d:Infinity};
  for(let i=0;i<ring.length-1;i++){
    const q=nearestOnSegment(p,ring[i],ring[i+1]),d=distance(p,q);
    if(d<best.d)best={i,p:q,d};
  }
  return best;
}
export function splitArea(area: AreaGeometry, path: Position[], tolerance: number): [AreaGeometry,AreaGeometry] {
  if(area.type!=='Polygon'||area.coordinates.length!==1)throw new Error('Deling krever én sammenhengende flate uten hull.');
  if(path.length<2)throw new Error('Velg start og slutt på sonegrensen.');
  const ring=area.coordinates[0],a=boundaryPoint(path[0],ring),b=boundaryPoint(path.at(-1)!,ring);
  if(a.d>tolerance||b.d>tolerance||distance(a.p,b.p)<1e-9||a.i===b.i)throw new Error('Start og slutt må ligge på ulike segmenter av sonegrensen.');
  if(a.i>b.i)return splitArea(area,[...path].reverse(),tolerance);
  const middle=path.slice(1,-1);
  const make=(points:Position[]):AreaGeometry=>{
    const unique=points.filter((p,i)=>i===0||distance(p,points[i-1])>1e-11);
    if(distance(unique[0],unique.at(-1)!)<=1e-11)unique.pop();
    return {type:'Polygon',coordinates:[[...unique,unique[0]]]};
  };
  const pieces:[AreaGeometry,AreaGeometry]=[
    make([a.p,...ring.slice(a.i+1,b.i+1),b.p,...middle.slice().reverse()]),
    make([b.p,...ring.slice(b.i+1,-1),...ring.slice(0,a.i+1),a.p,...middle]),
  ];
  const [left,right]=pieces.map(clip);
  if(clipping.intersection(left,right).length||clipping.xor(clip(area),clipping.union(left,right)).some(poly=>{
    const [ox,oy]=poly[0][0];
    return Math.abs(poly[0].slice(1).reduce((sum,[x,y],i)=>sum+(poly[0][i][0]-ox)*(y-oy)-(poly[0][i][1]-oy)*(x-ox),0))>1e-12;
  }))throw new Error('Delelinjen må gå inne i sonen uten å krysse seg selv.');
  return pieces;
}
export function syncReferences(world:WorldDefinition,zones:readonly Zone[]):WorldDefinition {
  const byId=new Map(zones.map(z=>[z.id,z]));
  const cells=zones.filter(z=>z.level===3);
  const locate=(point:Position,previous:string) => {
    const old=byId.get(previous);
    return old?.level===3&&pointInArea(point,old.geometry)?old:cells.find(z=>pointInArea(point,z.geometry));
  };
  const pois=world.pois.map(p=>({...p,cellId:locate(p.geometry.coordinates,p.cellId)?.id??p.cellId}));
  const edges=world.edges.flatMap(edge=>{
    const line=edge.geometry.coordinates;
    const from=locate(line[0],edge.fromCellId),to=locate(line.at(-1)!,edge.toCellId);
    if(from&&to&&from.id===to.id)return [];
    if(!from||!to)return [edge];
    return [{...edge,fromCellId:from.id,toCellId:to.id,
      viaPoiIds:edge.viaPoiIds?.filter(id=>pois.some(p=>p.id===id&&[from.id,to.id].includes(p.cellId))),
      status:edge.status==='active'&&(!from.playable||!to.playable)?'future' as const:edge.status}];
  });
  const frontiers=world.frontiers?.map(f=>({...f,cellId:locate(f.geometry.coordinates[0],f.cellId)?.id??f.cellId}));
  return {...world,zones,pois,edges,frontiers};
}

