import type { AreaGeometry, Position } from './model';
import { geometryIssues } from './validate';

export type EditorContext = {kind:'road'|'building'|'land'|'coast';tag:string;coordinates:Position[]};
export type MapExtract = {name:string; features:EditorContext[]; extent:[Position,Position]; blocks?:AreaGeometry[]};

function isMapBlock(value:unknown):value is AreaGeometry {
  if(!value||typeof value!=='object')return false;
  const area=value as Partial<AreaGeometry>;
  const polygons=area.type==='Polygon'?[area.coordinates]:area.type==='MultiPolygon'?area.coordinates:null;
  if(!Array.isArray(polygons))return false;
  const valid=polygons.every(polygon=>Array.isArray(polygon)&&polygon.every(ring=>
    Array.isArray(ring)&&ring.length>=4&&ring.every(point=>Array.isArray(point)&&point.length===2&&point.every(Number.isFinite))));
  return valid&&geometryIssues('kartflate',area as AreaGeometry).length===0;
}

export function isMapExtract(value:unknown):value is MapExtract {
  if(!value||typeof value!=='object')return false;
  const extract=value as Partial<MapExtract>;
  const point=(p:unknown):p is Position=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);
  return typeof extract.name==='string'&&Array.isArray(extract.extent)&&extract.extent.length===2&&
    extract.extent.every(point)&&extract.extent[0][0]<extract.extent[1][0]&&extract.extent[0][1]<extract.extent[1][1]&&
    Array.isArray(extract.features)&&extract.features.every(f=>f&&['road','building','land','coast'].includes(f.kind)&&
      typeof f.tag==='string'&&Array.isArray(f.coordinates)&&f.coordinates.length>=2&&f.coordinates.every(point))&&
    (extract.blocks===undefined||(Array.isArray(extract.blocks)&&extract.blocks.every(isMapBlock)));
}

export type MapLibrary = {extracts:MapExtract[]; active:string; parcels?:Position[][]};
export function readParcelLines(data:unknown):Position[][] {
  type Geometry = {type?:string;coordinates?:unknown};
  const input=data as (Geometry & {features?:{geometry?:Geometry}[];geometry?:Geometry})|null;
  const geometries=input?.type==='FeatureCollection'&&Array.isArray(input.features)?input.features.map(f=>f?.geometry):
    input?.type==='Feature'?[input.geometry]:[input];
  const lines:unknown[]=[];
  for(const g of geometries??[]){
    if(!g||!Array.isArray(g.coordinates))continue;
    if(g.type==='LineString')lines.push(g.coordinates);
    if(g.type==='Polygon'||g.type==='MultiLineString')lines.push(...g.coordinates);
    if(g.type==='MultiPolygon')for(const polygon of g.coordinates)if(Array.isArray(polygon))lines.push(...polygon);
  }
  if(!lines.length||!validParcelLines(lines))throw new Error('Velg GeoJSON med tomtegrenser i WGS84 (lengdegrad, breddegrad).');
  return lines;
}
export function validParcelLines(lines:unknown):lines is Position[][]{
  return Array.isArray(lines)&&lines.every(r=>Array.isArray(r)&&r.length>=2&&r.every(p=>
    Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90));
}
export function mapLibraryStorage(library?:undefined,scope?:string):Promise<MapLibrary|undefined>;
export function mapLibraryStorage(library:MapLibrary,scope?:string):Promise<undefined>;
export function mapLibraryStorage(library?:MapLibrary,scope='library'):Promise<MapLibrary|undefined>{
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('stavanger-z.editor-maps',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('maps');
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(new Error('Kartlageret er blokkert.'));
    request.onsuccess=()=>{
      const db=request.result;
      const transaction=db.transaction('maps',library?'readwrite':'readonly');
      const store=transaction.objectStore('maps');
      const read=library?undefined:store.get(scope);
      if(library)store.put(library,scope);
      transaction.oncomplete=()=>{db.close();resolve(read?.result);};
      transaction.onabort=()=>{db.close();reject(transaction.error);};
    };
  });
}

export function parseOsmExtract(xml:string,name:string):MapExtract {
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.documentElement.localName!=='osm'||doc.querySelector('parsererror'))throw new Error('Velg en gyldig OSM XML-fil.');
  const nodes=new Map<string,Position>();
  for(const node of doc.querySelectorAll('osm > node')){
    const lon=node.getAttribute('lon'),lat=node.getAttribute('lat'),id=node.getAttribute('id');
    if(id&&lon!==null&&lat!==null&&Number.isFinite(+lon)&&Number.isFinite(+lat))nodes.set(id,[+lon,+lat]);
  }
  const features:EditorContext[]=[];
  for(const way of doc.querySelectorAll('osm > way')){
    const tags=new Map(Array.from(way.querySelectorAll('tag'),tag=>[tag.getAttribute('k'),tag.getAttribute('v')??'']));
    const refs=Array.from(way.querySelectorAll('nd'),node=>node.getAttribute('ref')??'');
    if(refs.length<2||refs.some(id=>!nodes.has(id)))continue;
    const coordinates=refs.map(id=>nodes.get(id)!);
    const closed=refs.length>=4&&refs[0]===refs.at(-1);
    const building=tags.get('building'), highway=tags.get('highway'), land=tags.get('landuse')??tags.get('leisure');
    if(tags.get('natural')==='coastline')features.push({kind:'coast',tag:'coastline',coordinates});
    else if(closed&&(tags.get('natural')==='water'||tags.get('waterway')==='riverbank'||tags.get('landuse')==='reservoir'))features.push({kind:'coast',tag:'water',coordinates});
    else if(highway&&tags.get('tunnel')!=='yes')features.push({kind:'road',tag:highway,coordinates});
    else if(closed&&building&&building!=='roof')features.push({kind:'building',tag:building,coordinates});
    else if(closed&&land)features.push({kind:'land',tag:land,coordinates});
  }
  if(!features.length)throw new Error('Kartfilen inneholder ingen komplette veier, bygninger eller arealflater.');
  const bounds=doc.querySelector('osm > bounds');
  if(bounds){
    const values=['minlon','minlat','maxlon','maxlat'].map(key=>Number(bounds.getAttribute(key)??NaN));
    const [a,b,c,d]=values;
    if(values.every(Number.isFinite)&&a<c&&b<d)return {name,features,extent:[[a,b],[c,d]]};
  }
  let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;
  for(const feature of features)for(const [x,y] of feature.coordinates){a=Math.min(a,x);b=Math.min(b,y);c=Math.max(c,x);d=Math.max(d,y);}
  if(!(a<c&&b<d))throw new Error('Kartfilen mangler et todimensjonalt utsnitt.');
  return {name,features,extent:[[a,b],[c,d]]};
}

