'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import seed from '../../../packages/world-data/data/editor-seed.json';
import osm from '../../../packages/world-data/data/editor-context.json';
import type { AreaGeometry, Poi, Position, WorldDefinition, Zone } from '../../../packages/world-data/src/model';
import { areasOverlap, assignAreaToZone, brushArea, distance, joinAreas, nearestOnSegment, polygons, reshapeZone, snapBrushBoundary, splitArea, subtractArea, syncReferences, trimArea } from '../../../packages/world-data/src/editor-geometry';
import { pointInArea, validateWorld } from '../../../packages/world-data/src/validate';
import { isMapExtract, mapLibraryStorage, parseOsmExtract, readParcelLines, validParcelLines, type EditorContext, type MapLibrary } from '../../../packages/world-data/src/editor-osm';
import { buildRoadNetwork } from '../../../packages/world-data/src/editor-roads';
import './editor.css';

const initial = seed as unknown as WorldDefinition;
const defaultContext = osm as unknown as EditorContext[];
const types = ['bolig','handel','industri','kai','skog','jordbruk','idrett','blandet','infrastruktur'];
const poiTypes = ['supplies','medical','power','transport','junction','school','sports','industrial'];
const key = 'stavanger-z.world-editor.v1';
type Draft = {world:WorldDefinition;locked:string[]};
type Bootstrap = Draft & {mapLibrary:MapLibrary};
type Mode = 'select'|'draw'|'draw-district'|'split'|'expand'|'erase'|'fill'|'poi'|'move-poi';
const project = ([x,y]:Position):Position => [(x-5.709)*57165,(59.014-y)*111000];
const unproject = ([x,y]:Position):Position => [5.709+x/57165,59.014-y/111000];
const line = (points:readonly Position[]) => points.map((p,i)=>`${i?'L':'M'}${project(p).map(x=>x.toFixed(3)).join(',')}`).join('');
const shape = (area:AreaGeometry) => polygons(area).flatMap(p=>p.map(r=>line(r)+'Z')).join('');
function frameFor(points:Position[]) {
  let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;
  for(const [px,py] of points){x=Math.min(x,px);y=Math.min(y,py);right=Math.max(right,px);bottom=Math.max(bottom,py);}
  const w=right-x,h=bottom-y;
  return {x:x-w*.09,y:y-h*.09,w:w*1.18,h:h*1.18};
}
const bounds = (zone:Zone) => frameFor(polygons(zone.geometry).flat(2).map(project));
const layers = (context:EditorContext[]) => Object.fromEntries(['land','building','road','major','coast'].map(kind=>[kind,context.filter(f=>kind==='major'?f.kind==='road'&&['trunk','primary','secondary','tertiary'].includes(f.tag):f.kind===kind).map(f=>line(f.coordinates)+(kind==='building'||kind==='land'?'Z':'')).join('')]));
const buildingStats = (context:EditorContext[]) => context.filter(f=>f.kind==='building').map(f=>{
  const ring=f.coordinates;
  const [ox,oy]=ring[0];
  let area=0,sx=0,sy=0;
  for(let i=1;i<ring.length;i++){
    const ax=ring[i-1][0]-ox,ay=ring[i-1][1]-oy,bx=ring[i][0]-ox,by=ring[i][1]-oy;
    const cross=ax*by-bx*ay; area+=cross;sx+=(ax+bx)*cross;sy+=(ay+by)*cross;
  }
  const center:Position=Math.abs(area)>1e-16?[ox+sx/(3*area),oy+sy/(3*area)]:ring[0];
  const hours=['house','detached'].includes(f.tag)?1:['terrace','semidetached_house'].includes(f.tag)?3:['apartments','dormitory'].includes(f.tag)?6:2;
  return {center,hours};
});
function download(name:string,data:unknown){
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function freshId(prefix:string){return `${prefix}-${globalThis.crypto?.randomUUID?.()??Math.random().toString(36).slice(2)}`;}

export default function WorldEditor({bootstrap,storageScope}:{bootstrap?:Bootstrap;storageScope?:string}={}) {
  const storageKey=storageScope?`${key}.${storageScope}`:key;
  const [draft,setDraft]=useState<Draft>(bootstrap?{world:bootstrap.world,locked:bootstrap.locked}:{world:initial,locked:[]});
  const [ready,setReady]=useState(false);
  const [history,setHistory]=useState<Draft[]>([]);
  const [districtId,setDistrict]=useState(bootstrap?'district-001':'district-004');
  const [selectedId,setSelected]=useState(bootstrap?'':'cell-019');
  const [poiId,setPoi]=useState('');
  const [mode,setMode]=useState<Mode>('select');
  const [paintMethod,setPaintMethod]=useState<'area'|'brush'>('area');
  const [brushWidth,setBrushWidth]=useState(35);
  const [stroke,setStroke]=useState<Position[]>([]);
  const brushStroke=useRef<Position[]>([]);
  const [path,setPath]=useState<Position[]>([]);
  const [pathStops,setPathStops]=useState<number[]>([]);
  const [newName,setNewName]=useState('');
  const [mergeId,setMergeId]=useState('');
  const [vertex,setVertex]=useState<{p:number;r:number;i:number}|null>(null);
  const [snap,setSnap]=useState(true);
  const [snapTarget,setSnapTarget]=useState<'all'|'road'|'parcel'|'border'|'water'>('all');
  const [labels,setLabels]=useState(true);
  const [followRoad,setFollowRoad]=useState(true);
  const [hoverBlock,setHoverBlock]=useState<number|null>(null);
  const [showBlocks,setShowBlocks]=useState(false);
  const [show,setShow]=useState({land:true,building:true,road:true});
  const [message,setMessage]=useState('');
  const [zoom,setZoom]=useState(1);
  const [pan,setPan]=useState<Position>([0,0]);
  const [focusId,setFocus]=useState('');
  const [library,setLibrary]=useState<MapLibrary>(bootstrap?.mapLibrary??{extracts:[],active:''});
  const [mapSaveError,setMapSaveError]=useState(false);
  const libraryEdited=useRef(false);
  const extract=library.extracts.find(map=>map.name===library.active);
  const [focusExtract,setFocusExtract]=useState(!!bootstrap);
  const svg=useRef<SVGSVGElement>(null);
  const dragging=useRef<{x:number;y:number;pan:Position;scale:number}|null>(null);
  const {world,locked}=draft;
  useEffect(()=>{
    try {const saved=localStorage.getItem(storageKey);if(saved){const parsed=JSON.parse(saved) as Draft;if(parsed.world?.status==='draft'&&Array.isArray(parsed.locked))setDraft(parsed);}}
    catch{setMessage('Kunne ikke åpne lokalt utkast. Du kan importere en sikkerhetskopi.');}
    setReady(true);
    void mapLibraryStorage(undefined,storageScope).then(saved=>{
      if(!saved||libraryEdited.current)return;
      setLibrary(saved);
      if(saved.active){setFocusExtract(true);setSelected('');}
    }).catch(()=>setMapSaveError(true));
  },[storageKey,storageScope]);
  useEffect(()=>{
    if(!ready)return;
    try{localStorage.setItem(storageKey,JSON.stringify(draft));}catch{setMessage('Lokal lagring er utilgjengelig. Last ned utkastet som sikkerhetskopi.');}
  },[draft,ready,storageKey]);
  const districts=world.zones.filter(z=>z.level===2);
  const district=districts.find(z=>z.id===districtId)??districts[0];
  const cells=world.zones.filter(z=>z.level===3&&z.parentId===district?.id);
  const zone=world.zones.find(z=>z.id===selectedId);
  const poi=world.pois.find(p=>p.id===poiId);
  const lockedZone=!!zone&&locked.includes(zone.id);
  const painting=mode==='expand'||mode==='erase';
  const brushing=painting&&paintMethod==='brush';
  const drawing=mode==='draw'||mode==='draw-district'||mode==='split'||(painting&&!brushing);
  const focus=world.zones.find(z=>z.id===focusId)??district??world.zones[0];
  const frame=focusExtract&&extract?frameFor(extract.extent.map(project)):bounds(focus);
  const context=extract?.features??defaultContext;
  const mapLayers=useMemo(()=>layers(context),[context]);
  const roads=useMemo(()=>context.filter(f=>f.kind==='road'),[context]);
  const followSource=useMemo(()=>{
    if(snapTarget==='parcel')return library.parcels??[];
    if(snapTarget==='water')return [
      ...context.filter(feature=>feature.kind==='coast').map(feature=>feature.coordinates),
      ...world.zones.filter(zone=>zone.level===1).flatMap(zone=>polygons(zone.geometry).flat()),
    ];
    if(snapTarget==='border')return [
      ...world.zones.filter(zone=>zone.parentId===district.id||zone.id===district.id)
        .flatMap(zone=>polygons(zone.geometry).flat()),
      ...context.filter(feature=>feature.kind==='coast').map(feature=>feature.coordinates),
    ];
    return roads.map(road=>road.coordinates);
  },[snapTarget,library.parcels,context,world.zones,district.id,roads]);
  const follow=useMemo(()=>followRoad?buildRoadNetwork(followSource):null,[followSource,followRoad]);
  const buildings=useMemo(()=>buildingStats(context),[context]);
  const statsCache=useMemo(()=>new WeakMap<AreaGeometry,{count:number;hours:number;x:number;y:number}>(),[buildings]);
  const w=frame.w/zoom,h=frame.h/zoom;
  const view=`${frame.x+(frame.w-w)/2+pan[0]} ${frame.y+(frame.h-h)/2+pan[1]} ${w} ${h}`;
  const zoneStats=useMemo(()=>world.zones.filter(z=>z.level===3&&z.parentId===district.id).map(z=>{
    const cached=statsCache.get(z.geometry);
    if(cached)return {id:z.id,name:z.name,...cached};
    const box=bounds(z);
    let count=0,hours=0;
    for(const b of buildings){
      const [x,y]=project(b.center);
      if(x<box.x||x>box.x+box.w||y<box.y||y>box.y+box.h)continue;
      if(pointInArea(b.center,z.geometry)){count++;hours+=b.hours;}
    }
    let x=box.x+box.w/2,y=box.y+box.h/2;
    if(!pointInArea(unproject([x,y]),z.geometry)){
      const candidates=[.5,.35,.65,.2,.8].flatMap(a=>[.5,.35,.65,.2,.8].map(b=>[box.x+box.w*a,box.y+box.h*b] as Position));
      [x,y]=candidates.find(p=>pointInArea(unproject(p),z.geometry))??project(polygons(z.geometry)[0][0][0]);
    }
    const values={count,hours,x,y};
    statsCache.set(z.geometry,values);
    return {id:z.id,name:z.name,...values};
  }),[world.zones,district.id,buildings,statsCache]);
  const stats=zoneStats.find(s=>s.id===zone?.id);
  const parcelLayer=useMemo(()=>library.parcels?.map(line).join('')??'',[library.parcels]);
  const mapBlocks=useMemo(()=>(extract?.blocks??[]).map(area=>{
    const points=polygons(area).flat(2);
    return {
      area,
      left:Math.min(...points.map(p=>p[0])),right:Math.max(...points.map(p=>p[0])),
      bottom:Math.min(...points.map(p=>p[1])),top:Math.max(...points.map(p=>p[1])),
    };
  }),[extract?.blocks]);
  const blockLayer=useMemo(()=>mapBlocks.map(block=>shape(block.area)).join(''),[mapBlocks]);
  const highlightedBlock=hoverBlock===null?undefined:mapBlocks[hoverBlock]?.area;
  const waterLayer=useMemo(()=>context.filter(f=>f.tag==='water'&&f.kind==='coast').map(f=>line(f.coordinates)+'Z').join(''),[context]);
  const brushPreview=stroke.length?getBrushPreview(stroke):null;
  const drawingBoundary=useMemo(()=>{
    if(!drawing||mode==='split'||path.length<3||distance(path[0],path.at(-1)!)<=1e-10){
      return {points:path,error:''};
    }
    if(!follow)return {points:[...path,path[0]],error:''};
    try{
      const tolerance=12/Math.abs(svg.current?.getScreenCTM()?.a??1)/111000;
      const closing=follow(path.at(-1)!,path[0],tolerance);
      return {points:[...path,...closing.slice(1)],error:''};
    }catch(error){
      return {points:path,error:`Siste side kan ikke følge kartlinjen. ${(error as Error).message}`};
    }
  },[drawing,mode,path,follow,w]);
  function getBrushPreview(points:readonly Position[]){
    try{return trimArea(makeBrushMask(points),mode==='erase'&&zone?zone.geometry:district.geometry);}
    catch{return null;}
  }
  function commit(next:Draft){
    setHistory(previous=>[...previous.slice(-24),draft]);setDraft(next);setMessage('');
  }
  function update(next:WorldDefinition){commit({...draft,world:next});}
  function geometryEdit(zones:readonly Zone[],allowRouteCleanup=false){
    const next=syncReferences(world,zones);
    const removed:string[]=[];
    if(allowRouteCleanup){
      const byId=new Map(zones.map(z=>[z.id,z]));
      const covers=(id:string,p:Position)=>{const z=byId.get(id);return !!z&&pointInArea(p,z.geometry);};
      const edges=next.edges.filter(edge=>{
        const coords=edge.geometry.coordinates;
        if(covers(edge.fromCellId,coords[0])&&covers(edge.toCellId,coords.at(-1)!))return true;
        if(locked.includes(edge.fromCellId)||locked.includes(edge.toCellId))throw new Error(`Forbindelsen «${edge.name}» går til en låst sone.`);
        removed.push(edge.name);return false;
      });
      const frontiers=next.frontiers?.filter(f=>{
        if(f.geometry.coordinates.every(p=>covers(f.cellId,p)))return true;
        removed.push(f.id);return false;
      });
      Object.assign(next,{edges,frontiers});
    }
    const issues=validateWorld(next,world);
    const blocking=issues.find(i=>['geometry','overlap','containment','hierarchy','poi-containment','poi-cell','edge-endpoint','frontier'].includes(i.code));
    if(blocking){
      if(blocking.code==='geometry'&&blocking.message.startsWith('Hole ')){
        throw new Error('Grensen lager et hull som krysser ytterkanten eller deler sonen. Tegn markeringen litt forbi den eksisterende grensen.');
      }
      const stranded=world.pois.find(p=>p.id===blocking.id);
      if(stranded)throw new Error(`«${stranded.name}» vil havne utenfor en sone. Flytt POI-et først, eller visk ut et mindre område.`);
      throw new Error(`${blocking.id}: ${blocking.message}`);
    }
    update(next);
    return removed.length;
  }
  function tryAction(action:()=>void){try{action();}catch(error){setMessage((error as Error).message);}}
  function changeMode(next:Mode){setMode(next);setPath([]);setPathStops([]);setNewName('');setVertex(null);setMessage('');setHoverBlock(null);brushStroke.current=[];setStroke([]);}
  function select(id:string){setSelected(id);setPoi('');setMergeId('');changeMode('select');}
  function focusOn(id:string){
    setFocusExtract(false);setFocus(id);setZoom(1);setPan([0,0]);
    const target=world.zones.find(z=>z.id===(id||district.id));
    if(!target||target.level===1)return;
    const frame=bounds(target),[x,y]=unproject([frame.x+frame.w/2,frame.y+frame.h/2]);
    const covers=(map:MapLibrary['extracts'][number])=>x>=map.extent[0][0]&&x<=map.extent[1][0]&&y>=map.extent[0][1]&&y<=map.extent[1][1];
    const best=extract&&covers(extract)?extract:library.extracts.find(covers);
    if((best?.name??'')!==library.active)saveLibrary({...library,active:best?.name??''});
  }
  function showExtract(){setFocusExtract(true);setZoom(1);setPan([0,0]);}
  function saveLibrary(next:MapLibrary){
    libraryEdited.current=true;
    setLibrary(next);
    void mapLibraryStorage(next,storageScope).then(()=>setMapSaveError(false)).catch(()=>setMapSaveError(true));
  }
  function chooseMap(name:string){
    saveLibrary({...library,active:name});
    select('');
    if(name)showExtract();else focusOn('');
  }
  function editZone(values:Partial<Zone>){if(zone&&!lockedZone)update({...world,zones:world.zones.map(z=>z.id===zone.id?{...z,...values}:z)});}
  function transfer(id:string){
    if(!zone||zone.level!==3||lockedZone||id===zone.parentId)return;
    const old=world.zones.find(z=>z.id===zone.parentId)!;
    const next=world.zones.find(z=>z.id===id)!;
    if(locked.includes(old.id)||locked.includes(next.id))throw new Error('Et av distriktene er låst.');
    geometryEdit(world.zones.map(z=>z.id===zone.id?{...z,parentId:id}:z.id===old.id?{...z,geometry:subtractArea(z.geometry,zone.geometry)}:z.id===next.id?{...z,geometry:joinAreas(z.geometry,zone.geometry)}:z));
    setDistrict(id);focusOn(id);
  }
  function snapLines(forBrush=false):readonly (readonly Position[])[]{
    const lines: (readonly Position[])[] = [];
    if(snapTarget==='all'||snapTarget==='border')for(const z of [...cells,district].filter(Boolean)){
      if((vertex||forBrush)&&zone?.id===z.id)continue;
      for(const polygon of polygons(z.geometry))lines.push(...polygon);
    }
    if(snapTarget==='all'||snapTarget==='road')lines.push(...roads.map(r=>r.coordinates));
    if(snapTarget==='all'||snapTarget==='border'||snapTarget==='water'){
      for(const f of context)if(f.kind==='coast')lines.push(f.coordinates);
      if(!extract)for(const region of world.zones.filter(z=>z.level===1)){
        for(const polygon of polygons(region.geometry))lines.push(...polygon);
      }
    }
    if(snapTarget==='all'||snapTarget==='parcel')lines.push(...library.parcels??[]);
    return lines;
  }
  function snapped(p:Position,limit:number,lines=snapLines()):Position{
    if(!snap)return p;
    let best=p,score=limit;
    const nearby=(a:Position,b:Position)=>Math.min(a[0],b[0])<=p[0]+limit*2&&Math.max(a[0],b[0])>=p[0]-limit*2&&Math.min(a[1],b[1])<=p[1]+limit&&Math.max(a[1],b[1])>=p[1]-limit;
    const inspect=(ring:readonly Position[])=>{
      for(let i=1;i<ring.length;i++){
        const a=ring[i-1],b=ring[i];if(!nearby(a,b))continue;
        const q=nearestOnSegment(p,a,b),d=distance(p,q);
        if(d<score){score=d;best=q;}
      }
    };
    for(const ring of lines)inspect(ring);
    return best;
  }
  function makeBrushMask(points:readonly Position[]):AreaGeometry{
    const radius=brushWidth/222000;
    let area=brushArea(points,radius);
    if(!snap)return area;
    const scale=Math.abs(svg.current?.getScreenCTM()?.a??1);
    const limit=Math.min(10/scale/111000,radius*.65);
    const strokeBounds=frameFor(polygons(area).flat(2));
    const lines=snapLines(true).flatMap(line=>{
      const segments: Position[][]=[];
      for(let i=1;i<line.length;i++){
        const a=line[i-1],b=line[i];
        if(Math.max(a[0],b[0])<strokeBounds.x-limit*2||Math.min(a[0],b[0])>strokeBounds.x+strokeBounds.w+limit*2||
           Math.max(a[1],b[1])<strokeBounds.y-limit||Math.min(a[1],b[1])>strokeBounds.y+strokeBounds.h+limit)continue;
        segments.push([a,b]);
      }
      return segments;
    });
    area=snapBrushBoundary(area,Math.max(2/111000,limit*.6),point=>snapped(point,limit,lines));
    for(const feature of context){
      if(feature.kind!=='coast'||feature.tag!=='water')continue;
      const water:AreaGeometry={type:'Polygon',coordinates:[feature.coordinates]};
      if(!areasOverlap(area,water))continue;
      try{area=subtractArea(area,water);}
      catch{throw new Error('Strøket traff bare vann. Mal fra landsiden.');}
    }
    return area;
  }
  function mapClick(event:MouseEvent<SVGSVGElement>){
    if(brushing)return;
    const matrix=svg.current?.getScreenCTM();if(!matrix)return;
    const pt=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
    const p=unproject([pt.x,pt.y]);
    const tolerance=12/Math.abs(matrix.a)/111000;
    tryAction(()=>{
      if(mode==='fill'&&zone?.level===3){
        const index=blockAt(p);
        if(index===null)throw new Error('Ingen kartflate her. Pek på en avgrenset flate på land.');
        const next=assignAreaToZone(world.zones,zone.id,mapBlocks[index].area,locked);
        if(next===world.zones){setMessage(`Kartflaten tilhører allerede ${zone.name}.`);return;}
        geometryEdit(next,true);
        setMessage(`Kartflaten er lagt til ${zone.name}. Nabosoner og berørte L2-grenser er oppdatert. Bruk Angre for å gå tilbake.`);
        return;
      }
      if(mode==='poi'||mode==='move-poi'){
        const cell=cells.find(z=>pointInArea(p,z.geometry));
        if(!cell)throw new Error('Velg et punkt inne i en L3-sone i distriktet.');
        if(locked.includes(cell.id)||(poi&&locked.includes(poi.cellId)))throw new Error('Sonens innhold er låst.');
        const target:Poi=mode==='move-poi'&&poi?{...poi,cellId:cell.id,geometry:{type:'Point',coordinates:p}}:{id:freshId('poi'),name:'Nytt sted',cellId:cell.id,kind:'supplies',sourceIds:['curation'],geometry:{type:'Point',coordinates:p}};
        const next=world.pois.some(x=>x.id===target.id)?world.pois.map(x=>x.id===target.id?target:x):[...world.pois,target];
        update(syncReferences({...world,pois:next},world.zones));setPoi(target.id);changeMode('select');return;
      }
      if(drawing){
        const last=path.at(-1);
        const q=follow?follow(p,p,tolerance)[0]:snapped(p,tolerance);
        const extension=last&&follow?follow(last,q,tolerance):null;
        const next=[...path,...(extension??[]),q].filter((point,i,all)=>!i||distance(point,all[i-1])>1e-10);
        setPathStops([...pathStops,path.length]);setPath(next);setMessage('');return;
      }
      const q=snapped(p,tolerance);
      if(vertex&&zone&&!lockedZone){
        const origin=polygons(zone.geometry)[vertex.p][vertex.r][vertex.i];
        const next=world.zones.map(z=>{
          let changed=false;
          const coords=polygons(z.geometry).map(polygon=>polygon.map(ring=>ring.map(position=>{
            if(distance(position,origin)>1e-11)return position;
            changed=true;return q;
          })));
          if(!changed)return z;
          if(locked.includes(z.id))throw new Error(`Hjørnet deles med den låste sonen ${z.name}.`);
          const geometry:AreaGeometry=z.geometry.type==='Polygon'?{type:'Polygon',coordinates:coords[0]}:{type:'MultiPolygon',coordinates:coords};
          return {...z,geometry};
        });
        geometryEdit(next);setVertex(null);
      }
    });
  }
  function blockAt(point:Position):number|null {
    const index=mapBlocks.findIndex(block=>point[0]>=block.left&&point[0]<=block.right&&
      point[1]>=block.bottom&&point[1]<=block.top&&pointInArea(point,block.area));
    return index<0?null:index;
  }
  function paint(mask:AreaGeometry){
    if(!zone||!painting)return;
    const removed=geometryEdit(reshapeZone(world.zones,district,zone,mask,mode==='expand'?'expand':'erase',locked),true);
    setPath([]);setPathStops([]);
    setMessage(`${zone.name} er oppdatert.${removed?` ${removed} forbindelser eller yttergrenser ble fjernet fordi de mistet et endepunkt.`:''} Bruk Angre for å gå tilbake.`);
  }
  function finish(){
    const name=newName.trim();
    if(drawingBoundary.error)throw new Error(drawingBoundary.error);
    const points=drawingBoundary.points;
    const closed=points.length>1&&distance(points[0],points.at(-1)!)<=1e-10;
    const ring=closed?points:[...points,points[0]];
    if((mode==='draw'||mode==='draw-district')&&!name)throw new Error('Gi sonen et navn før du fullfører.');
    if(painting&&path.length>=3){
      paint({type:'Polygon',coordinates:[closed?[...ring.slice(0,-1),ring[0]]:ring]});
    } else if(mode==='draw-district'&&path.length>=3){
      const region=world.zones.find(z=>z.id===district.parentId&&z.level===1);
      if(!region||locked.includes(region.id))throw new Error('Lås opp L1-regionen før du utvider den.');
      const geometry:AreaGeometry={type:'Polygon',coordinates:[closed?[...ring.slice(0,-1),ring[0]]:ring]};
      if(districts.some(d=>areasOverlap(d.geometry,geometry)))throw new Error('Et nytt distrikt kan ikke overlappe et eksisterende.');
      const next:Zone={id:freshId('district'),name,level:2,parentId:region.id,playable:true,geometry,rationale:'Manuelt kuratert i World Editor',sourceIds:['curation']};
      const zones=world.zones.map(z=>z.id===region.id?{...z,geometry:joinAreas(region.geometry,geometry)}:z);
      geometryEdit([...zones,next]);setDistrict(next.id);select(next.id);setFocusExtract(false);setFocus(next.id);setZoom(1);setPan([0,0]);
    } else if(mode==='draw'&&path.length>=3){
      const next:Zone={id:freshId('cell'),name,level:3,parentId:district.id,playable:true,primaryType:'bolig',geometry:{type:'Polygon',coordinates:[closed?[...ring.slice(0,-1),ring[0]]:ring]},rationale:'Manuelt kuratert i World Editor',sourceIds:['curation']};
      geometryEdit(reshapeZone(world.zones,district,next,next.geometry,'create',locked));select(next.id);
    } else if(mode==='split'&&zone&&!lockedZone){
      const matrix=svg.current?.getScreenCTM();
      const [a,b]=splitArea(zone.geometry,path,18/Math.abs(matrix?.a??1)/111000);
      const next={...zone,id:freshId('cell'),name:name||zone.name+' · ny del',geometry:b};
      geometryEdit([...world.zones.map(z=>z.id===zone.id?{...z,geometry:a}:z),next]);select(next.id);
    } else throw new Error('Sett flere punkter før du fullfører.');
  }
  function deletePoi(){
    if(!poi||locked.includes(poi.cellId))return;
    update(syncReferences({...world,pois:world.pois.filter(p=>p.id!==poi.id)},world.zones));
    setPoi('');changeMode('select');
    setMessage('POI slettet fra utkastet. Bruk Angre for å hente det tilbake.');
  }
  function startEmptyDistrict(){
    const ids=new Set(cells.map(cell=>cell.id));
    const pois=world.pois.filter(poi=>ids.has(poi.cellId));
    const edges=world.edges.filter(edge=>ids.has(edge.fromCellId)||ids.has(edge.toCellId));
    if(ids.size===0)return;
    if(locked.includes(district.id)||[...ids].some(id=>locked.includes(id))||
      edges.some(edge=>locked.includes(edge.fromCellId)||locked.includes(edge.toCellId))){
      throw new Error('Lås opp distriktet, sonene og eventuelle låste nabosoner med forbindelser hit først.');
    }
    if(!window.confirm(`Start med tomt L3-kart i ${district.name}? ${ids.size} soner, ${pois.length} POI-er og ${edges.length} forbindelser fjernes fra utkastet. En sikkerhetskopi lastes ned først.`))return;
    download('stavanger-z-editor-foer-nytegning.json',{...draft,mapLibrary:library});
    update({
      ...world,
      zones:world.zones.filter(zone=>!ids.has(zone.id)),
      pois:world.pois.filter(poi=>!ids.has(poi.cellId)),
      edges:world.edges.filter(edge=>!edges.includes(edge)),
      frontiers:world.frontiers?.filter(frontier=>!ids.has(frontier.cellId)),
    });
    select('');focusOn('');
    setMessage('Distriktet er klart for nytegning. Velg Tegn ny L3. Bruk Angre for å få tilbake de gamle sonene.');
  }
  function deleteZone(){
    if(!zone||lockedZone||zone.level===1)return;
    if(world.zones.some(z=>z.parentId===zone.id))throw new Error('Flytt eller slett L3-sonene i distriktet først.');
    if(zone.level===2&&districts.length===1)throw new Error('Regionen må ha minst ett distrikt.');
    if(world.pois.some(p=>p.cellId===zone.id))throw new Error('Flytt eller slett POI-ene i sonen først.');
    const edges=world.edges.filter(e=>e.fromCellId===zone.id||e.toCellId===zone.id);
    if(edges.some(e=>locked.includes(e.fromCellId)||locked.includes(e.toCellId)))throw new Error('Sonen har en forbindelse til en låst sone.');
    update({...world,zones:world.zones.filter(z=>z.id!==zone.id),edges:world.edges.filter(e=>!edges.includes(e)),frontiers:world.frontiers?.filter(f=>f.cellId!==zone.id)});
    select('');focusOn('');
    setMessage('Sone og tilhørende forbindelser slettet fra utkastet. Bruk Angre for å hente dem tilbake.');
  }
  function merge(){
    const other=cells.find(z=>z.id===mergeId);
    if(!zone||!other||lockedZone||locked.includes(other.id))return;
    const geometry=joinAreas(zone.geometry,other.geometry);
    if(geometry.type==='MultiPolygon')throw new Error('Sonene må dele en grense for å slås sammen.');
    const retained=zone;
    const removed=other;
    geometryEdit(world.zones.filter(z=>z.id!==removed.id).map(z=>z.id===retained.id?{...z,geometry}:z));select(retained.id);
  }
  function exportWorld(){
    const unnamed=[...world.zones,...world.pois].find(item=>!item.name.trim());
    if(unnamed){setMessage(`Gi ${unnamed.id} et navn før du eksporterer.`);return;}
    const output:WorldDefinition={...world,status:'draft',worldVersion:`editor-${new Date().toISOString().replace(/[:.]/g,'-')}`};
    const issues=validateWorld(output);
    if(issues.length){setMessage(issues.slice(0,5).map(i=>`${i.id}: ${i.message}`).join('\n'));return;}
    download(`world-${output.worldVersion}.json`,output);
    const linked=new Set(output.edges.filter(e=>e.status==='active').flatMap(e=>[e.fromCellId,e.toCellId]));
    const isolated=output.zones.filter(z=>z.level===3&&z.playable&&!linked.has(z.id)).length;
    setMessage(`Validert WorldDefinition eksportert som utkast.${isolated?` ${isolated} spillbare L3-soner mangler aktive forbindelser og må kobles til før bruk i spillet.`:''}`);
  }
  return <main className="we">
    <header><div><strong>STAVANGER Z <span>World Editor</span></strong><small>{world.worldVersion} · {world.zones.filter(z=>z.level===3).length} L3</small><small>{bootstrap?'Separat gjennomgangsutkast':'Lokalt utkast'} · © OpenStreetMap-bidragsytere (ODbL)</small></div><nav>
      <button onClick={()=>{const prev=history.at(-1);if(prev){setDraft(prev);setHistory(history.slice(0,-1));changeMode('select');}}} disabled={!history.length}>Angre</button>
      <button onClick={()=>download('stavanger-z-editor-utkast.json',{...draft,mapLibrary:library})}>Sikkerhetskopi</button>
      <label className="we-file">Legg til OSM-kart<input type="file" accept=".osm,.xml" multiple onChange={async event=>{
        const files=Array.from(event.currentTarget.files??[]);event.currentTarget.value='';if(!files.length)return;
        try{
          const maps=await Promise.all(files.map(async file=>parseOsmExtract(await file.text(),file.name)));
          const byName=new Map([...library.extracts,...maps].map(map=>[map.name,map]));
          saveLibrary({...library,extracts:[...byName.values()],active:maps.at(-1)!.name});
          select('');showExtract();setMessage('Kartutsnitt lagt til. Bruk Tegn nytt L2 for å avgrense et distrikt.');
        }
        catch(error){setMessage((error as Error).message);}
      }}/></label>
      <label className="we-file">Legg til tomtegrenser<input type="file" accept=".geojson,.json" onChange={async e=>{
        const file=e.currentTarget.files?.[0];e.currentTarget.value='';if(!file)return;
        try{
          const parcels=readParcelLines(JSON.parse(await file.text()));
          saveLibrary({...library,parcels:[...library.parcels??[],...parcels]});
          setSnap(true);setSnapTarget('parcel');setFollowRoad(true);setMessage('Tomtegrenser lagt til. Tegning følger nå tomtegrensene mellom klikk.');
        }catch(error){setMessage((error as Error).message);}
      }}/></label>
      <label className="we-file">Åpne utkast<input type="file" accept=".json" onChange={async e=>{
        const file=e.currentTarget.files?.[0];e.currentTarget.value='';if(!file)return;
        try{const parsed=JSON.parse(await file.text());const next:Draft=parsed.world?parsed:{world:parsed,locked:[]};
          if(next.world.status!=='draft'||!Array.isArray(next.locked))throw new Error('Velg et editorutkast eller en WorldDefinition med status draft.');
          const problems=validateWorld(next.world);if(problems.length)throw new Error(problems[0].message);
          const maps=parsed.mapLibrary as MapLibrary|undefined;
          if(maps&&(!Array.isArray(maps.extracts)||!maps.extracts.every(isMapExtract)||typeof maps.active!=='string'||(maps.active&&!maps.extracts.some(map=>map.name===maps.active))||(maps.parcels!==undefined&&!validParcelLines(maps.parcels))))throw new Error('Sikkerhetskopien har et ugyldig kartbibliotek.');
          commit({world:next.world,locked:next.locked});select('');focusOn('');
          if(maps){saveLibrary(maps);if(maps.active)showExtract();}
          setMessage('Utkast åpnet.');
        }catch(error){setMessage((error as Error).message);}
      }}/></label>
      <button className="we-accent" onClick={exportWorld}>Valider og eksporter verden</button>
    </nav></header>
    <div className="we-layout">
      <aside>
        <details className="we-panel" open><summary>Områder <small>L1 / L2</small></summary>
        <div className="we-buttons we-create">
          <button aria-pressed={mode==='draw-district'} onClick={()=>changeMode('draw-district')}>Tegn nytt L2</button>
        </div>
        <label>L2-distrikt<select value={district?.id} onChange={e=>{const id=e.target.value;setDistrict(id);select('');focusOn(id);}}>{districts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <div className="we-buttons"><button onClick={()=>{select(district.id);focusOn(district.id);}}>Velg L2</button><button onClick={()=>{const region=world.zones.find(z=>z.id===district.parentId);if(region){select(region.id);focusOn(region.id);}}}>Vis L1-region</button></div>
        <button disabled={!cells.length} onClick={()=>tryAction(startEmptyDistrict)}>Start på nytt i distriktet</button>
        </details>
        <details className="we-panel" open><summary>Soner <small>L3</small></summary>
        <div className="we-buttons we-create">
          <button aria-pressed={mode==='draw'} onClick={()=>changeMode('draw')}>Tegn ny L3</button>
          <button disabled={zone?.level!==3||lockedZone} aria-pressed={mode==='expand'} onClick={()=>changeMode('expand')}>Utvid sone</button>
          <button disabled={zone?.level!==3||lockedZone} aria-pressed={mode==='erase'} onClick={()=>changeMode('erase')}>Visk ut</button>
          <button title={mapBlocks.length?'Flytt en kartflate avgrenset av veier, kyst og arealgrenser.':'Åpne det nye kartutkastet med kartflater for å bruke dette verktøyet.'} disabled={zone?.level!==3||lockedZone||!mapBlocks.length} aria-pressed={mode==='fill'} onClick={()=>{changeMode('fill');setShowBlocks(true);}}>Fyll kartflate</button>
        </div>
        {painting&&<div className="we-paint-options">
          <label>Marker med<select value={paintMethod} onChange={e=>{changeMode(mode);setPaintMethod(e.target.value as 'area'|'brush');}}><option value="area">Tegn område med snapping</option><option value="brush">Dra med pensel</option></select></label>
          {brushing&&<label>Penselbredde · {brushWidth} m<input type="range" min="8" max="180" value={brushWidth} onChange={e=>setBrushWidth(+e.target.value)}/></label>}
        </div>}
        <label>L3-sone<select value={zone?.level===3?zone.id:''} onChange={e=>{select(e.target.value);focusOn(e.target.value);}}><option value="">Velg sone</option>{cells.map(z=><option key={z.id} value={z.id}>{z.name}{locked.includes(z.id)?' · låst':''}</option>)}</select></label>
        {zone&&<section>
          <label>Navn<input value={zone.name} key={zone.id} disabled={lockedZone} onChange={e=>editZone({name:e.target.value})}/></label>
          <p className="we-dim">{zone.id} · L{zone.level}{stats?` · ${stats.count} bygg · ${stats.hours} est. timer`:''}</p>
          {zone.level===3&&<>
            <label>Primær sonetype<select value={zone.primaryType??'bolig'} disabled={lockedZone} onChange={e=>editZone({primaryType:e.target.value})}>{types.map(t=><option key={t}>{t}</option>)}</select></label>
            <label>L2-tilhørighet<select value={zone.parentId} disabled={lockedZone} onChange={e=>tryAction(()=>transfer(e.target.value))}>{districts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          </>}
          <label className="we-check"><input type="checkbox" checked={lockedZone} onChange={()=>commit({...draft,locked:lockedZone?locked.filter(id=>id!==zone.id):[...locked,zone.id]})}/>Lås godkjent sone</label>
          {zone.level!==1&&<button disabled={lockedZone} onClick={()=>tryAction(deleteZone)}>Slett valgt sone</button>}
          {zone.level===3&&!lockedZone&&<div className="we-buttons">
            <button onClick={()=>changeMode('split')}>Del valgt sone</button>
            <select aria-label="Sone å slå sammen med" value={mergeId} onChange={e=>setMergeId(e.target.value)}><option value="">Slå sammen med …</option>{cells.filter(z=>z.id!==zone.id&&!locked.includes(z.id)).map(z=><option key={z.id} value={z.id}>{z.name}</option>)}</select>
            <button disabled={!mergeId} onClick={()=>tryAction(merge)}>Slå sammen</button>
          </div>}
        </section>}
        </details>
        <details className="we-panel" open><summary>Steder <small>POI / HQ</small></summary>
        <div className="we-buttons we-create"><button aria-pressed={mode==='poi'} onClick={()=>changeMode('poi')}>Plasser POI</button></div>
        <label>POI i distriktet<select value={poiId} onChange={e=>{setPoi(e.target.value);changeMode('select');}}><option value="">Velg sted</option>{world.pois.filter(p=>cells.some(c=>c.id===p.cellId)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        {poi&&<section>
          <label>Stedsnavn<input value={poi.name} disabled={locked.includes(poi.cellId)} onChange={e=>update({...world,pois:world.pois.map(p=>p.id===poi.id?{...p,name:e.target.value}:p)})}/></label>
          <label>Stedstype<input list="we-poi-types" value={poi.kind} disabled={locked.includes(poi.cellId)} onChange={e=>update({...world,pois:world.pois.map(p=>p.id===poi.id?{...p,kind:e.target.value}:p)})}/></label>
          <datalist id="we-poi-types">{poiTypes.map(kind=><option key={kind} value={kind}/>)}</datalist>
          <label className="we-check"><input type="checkbox" checked={!!poi.hqCandidate} disabled={locked.includes(poi.cellId)} onChange={e=>update({...world,pois:world.pois.map(p=>p.id===poi.id?{...p,hqCandidate:e.target.checked}:p)})}/>HQ-kandidat</label>
          <button disabled={locked.includes(poi.cellId)} onClick={()=>changeMode('move-poi')}>Flytt på kartet</button>
          <button disabled={locked.includes(poi.cellId)} onClick={()=>tryAction(deletePoi)}>Slett valgt POI</button>
        </section>}
        </details>
        {zone?.level===3&&<details className="we-panel"><summary>Forbindelser</summary>{world.edges.filter(e=>[e.fromCellId,e.toCellId].includes(zone.id)).map(edge=><label key={edge.id}>{edge.name}<select aria-label={`Status for ${edge.name}`} value={edge.status} disabled={lockedZone||locked.includes(edge.fromCellId)||locked.includes(edge.toCellId)} onChange={event=>{
          const status=event.target.value as typeof edge.status;
          update({...world,edges:world.edges.map(e=>e.id===edge.id?{...e,status}:e)});
        }}><option value="proposed">Forslag</option><option value="active" disabled={!world.zones.find(z=>z.id===edge.fromCellId)?.playable||!world.zones.find(z=>z.id===edge.toCellId)?.playable}>Aktiv</option><option value="future">Framtidig</option></select></label>)}</details>}
      </aside>
      <div className="we-map">
        <div className="we-tools">
          <label>Kartutsnitt <select value={library.active} onChange={e=>chooseMap(e.target.value)}>
            <option value="">Hundvåg og Byøyene</option>
            {library.extracts.map(map=><option key={map.name}>{map.name}</option>)}
          </select></label>
          {extract&&<button onClick={showExtract}>Vis hele utsnittet</button>}
          <button onClick={()=>setZoom(z=>Math.min(40,z*1.5))}>+</button><button onClick={()=>setZoom(z=>Math.max(.55,z/1.5))}>−</button>
          {([['←',-1,0],['→',1,0],['↑',0,-1],['↓',0,1]] as const).map(([label,x,y])=><button key={label} onClick={()=>setPan(p=>[p[0]+x*w*.2,p[1]+y*h*.2])}>{label}</button>)}
          <button onClick={()=>focusOn('')}>Distriktsutsnitt</button>
          <label><input type="checkbox" checked={snap} onChange={e=>setSnap(e.target.checked)}/> {brushing?'Fest penselkanten':'Fest punkter'}</label>
          <label>Fest til <select value={snapTarget} disabled={!snap} onChange={e=>setSnapTarget(e.target.value as typeof snapTarget)}><option value="all">Nærmeste</option><option value="road">Vei</option><option value="water">Kyst / vann</option><option value="border">Sonegrense / kyst</option><option value="parcel" disabled={!library.parcels?.length}>Tomt</option></select></label>
          <label title="Hele traseen følges mellom klikk og langs siste side. Manglende forbindelse stopper tegningen."><input type="checkbox" disabled={brushing} checked={followRoad} onChange={e=>setFollowRoad(e.target.checked)}/> {snapTarget==='parcel'?'Følg tomtegrense':snapTarget==='water'?'Følg kyst / vann':snapTarget==='border'?'Følg sonegrense':'Følg vei'} mellom klikk</label>
          {([['building','Bygg'],['road','Veier'],['land','Arealbruk']] as const).map(([k,label])=><label key={k}><input type="checkbox" checked={show[k]} onChange={e=>setShow({...show,[k]:e.target.checked})}/>{label}</label>)}
          <label><input type="checkbox" checked={labels} onChange={e=>setLabels(e.target.checked)}/> Soneetiketter</label>
          {mapBlocks.length>0&&<label><input type="checkbox" checked={showBlocks} onChange={e=>setShowBlocks(e.target.checked)}/> Kartflater</label>}
        </div>
        {(message||mapSaveError)&&<p className="we-message we-map-status" role="status">{message}{mapSaveError&&' Kartlageret er utilgjengelig. Ta en sikkerhetskopi for å beholde utsnittene.'}</p>}
        <div className="we-instruction">
          {mode==='fill'?<><strong>Fyll kartflate · {zone?.name}</strong> Pek for å se flaten. Klikk for å flytte hele flaten til valgt sone. Nabosonene oppdateres samtidig.</>:painting?<><strong>{mode==='expand'?'Utvid':'Visk ut'} · {zone?.name}</strong> {brushing?'Dra over kartet. Strøket lagres når du slipper.':'Marker området og trykk Bruk areal.'} {mode==='expand'?'Berørte nabosoner i distriktet avgir arealet.':'Arealet blir ledig til en annen sone.'}</>:mode==='select'?(vertex?'Klikk der hjørnet skal flyttes.':'Velg en sone eller et POI på kartet.'):mode==='draw'?'Tegn innenfor distriktet eller litt over kysten. Kartet klipper ved yttergrensen.':mode==='draw-district'?'Tegn yttergrensen for det nye distriktet.':mode==='split'?'Klikk fra yttergrense til yttergrense.':'Klikk der stedet skal ligge.'}
          {drawing&&<>{!painting&&<label>Navn på ny sone <input value={newName} onChange={event=>setNewName(event.target.value)} placeholder={mode==='split'?zone?.name+' · ny del':'Skriv navn'} onKeyDown={event=>{if(event.key==='Enter')tryAction(finish);}}/></label>}<button disabled={!pathStops.length} onClick={()=>{setPath(path.slice(0,pathStops.at(-1)));setPathStops(pathStops.slice(0,-1));}}>Angre siste klikk</button><button className="we-accent" disabled={!!drawingBoundary.error||path.length<(mode==='split'?2:3)||(!painting&&mode!=='split'&&!newName.trim())} onClick={()=>tryAction(finish)}>{painting?'Bruk areal':'Fullfør'}</button>{drawingBoundary.error&&<span role="alert">{drawingBoundary.error}</span>}</>}
          {(mode!=='select'||vertex)&&<button onClick={()=>changeMode('select')}>Avbryt</button>}
        </div>
        <svg ref={svg} viewBox={view} onClick={mapClick} aria-label="Redigerbart verdenskart" tabIndex={0} style={extract?{background:'#e5e5d8'}:undefined}
          onKeyDown={event=>{if(event.key==='Escape')changeMode('select');if(event.key==='Enter'&&drawing)tryAction(finish);}}
          onWheel={event=>{
            const matrix=svg.current?.getScreenCTM();if(!matrix)return;
            const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
            const next=Math.min(40,Math.max(.55,zoom*(event.deltaY<0?1.25:.8)));
            const dx=point.x-(frame.x+frame.w/2+pan[0]),dy=point.y-(frame.y+frame.h/2+pan[1]);
            setPan([pan[0]+dx*(1-zoom/next),pan[1]+dy*(1-zoom/next)]);setZoom(next);
          }}
          onPointerDown={event=>{
            if(brushing&&event.button===0){
              const matrix=svg.current?.getScreenCTM();if(!matrix)return;
              event.currentTarget.setPointerCapture(event.pointerId);
              const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
              brushStroke.current=[unproject([p.x,p.y])];setStroke(brushStroke.current);return;
            }
            if(event.button!==1)return;
            const scale=svg.current?.getScreenCTM()?.a;if(!scale)return;
            event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);
            dragging.current={x:event.clientX,y:event.clientY,pan,scale};
          }}
          onPointerMove={event=>{
            const drag=dragging.current;if(drag)setPan([drag.pan[0]-(event.clientX-drag.x)/drag.scale,drag.pan[1]-(event.clientY-drag.y)/drag.scale]);
            const matrix=svg.current?.getScreenCTM(),last=brushStroke.current.at(-1);
            if(mode==='fill'&&matrix&&!drag){
              const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
              setHoverBlock(blockAt(unproject([p.x,p.y])));
            }
            if(!matrix||!last)return;
            const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse()),next=unproject([p.x,p.y]);
            if(distance(last,next)*111000<Math.max(2,brushWidth/8))return;
            brushStroke.current=[...brushStroke.current,next];setStroke(brushStroke.current);
          }}
          onPointerUp={event=>{
            dragging.current=null;
            if(event.button!==0||!brushStroke.current.length)return;
            const points=brushStroke.current;brushStroke.current=[];setStroke([]);
            tryAction(()=>paint(makeBrushMask(points)));
          }} onPointerLeave={()=>setHoverBlock(null)} onLostPointerCapture={()=>{dragging.current=null;brushStroke.current=[];setStroke([]);}}>
          {world.zones.filter(z=>z.level===1).map(z=><path key={z.id} d={shape(z.geometry)} className="we-landmass" fillRule="evenodd"/>)}
          {show.land&&<path d={mapLayers.land} className="we-landuse"/>}
          <path d={waterLayer} fill="#a7cbd9" pointerEvents="none"/>
          <path d={mapLayers.coast} fill="none" stroke="#42748a" strokeWidth="1.4" pointerEvents="none"/>
          {world.zones.filter(z=>z.level===3).map(z=><path key={z.id} data-zone={z.id} d={shape(z.geometry)} fillRule="evenodd" className={`we-zone ${z.id===zone?.id?'we-selected':''} ${locked.includes(z.id)?'we-locked':''}`} onClick={event=>{if(mode==='select'&&!vertex){event.stopPropagation();if(z.parentId!==district.id)setDistrict(z.parentId!);select(z.id);}}}/>)}
          {showBlocks&&<path d={blockLayer} fill="none" stroke="#84765c" strokeWidth=".7" strokeDasharray="3 2" pointerEvents="none"/>}
          {world.zones.filter(z=>z.level===2).map(z=><path key={z.id} d={shape(z.geometry)} className={`we-border ${z.id===zone?.id?'we-highlight':''}`} />)}
          {show.building&&<path d={mapLayers.building} className="we-buildings"/>}
          {show.road&&<><path d={mapLayers.road} className="we-roads"/><path d={mapLayers.major} className="we-major"/></>}
          {parcelLayer&&<path d={parcelLayer} className="we-parcels"/>}
          {world.edges.map(e=><path key={e.id} d={line(e.geometry.coordinates)} className="we-edge"/>)}
          {labels&&zoneStats.map(s=><text key={s.id} x={s.x} y={s.y} textAnchor="middle" className="we-zone-label" fontSize={Math.min(w,h)*.017}><tspan x={s.x}>{s.name}</tspan><tspan x={s.x} dy="1.2em">{s.count} bygg · {s.hours} est. t</tspan></text>)}
          {world.pois.filter(p=>cells.some(c=>c.id===p.cellId)).map(p=>{
            const [x,y]=project(p.geometry.coordinates);
            return <circle key={p.id} cx={x} cy={y} r={w*(p.id===poiId ? .008 : .006)} className={`we-poi ${p.hqCandidate?'we-hq':''}`} onClick={event=>{if(mode==='select'&&!vertex){event.stopPropagation();setPoi(p.id);}}}><title>{p.name}</title></circle>;
          })}
          {zone&&!lockedZone&&mode==='select'&&polygons(zone.geometry).flatMap((polygon,p)=>polygon.flatMap((ring,r)=>ring.slice(0,-1).map((position,i)=>{
            const [x,y]=project(position);
            return <circle key={`${p}:${r}:${i}`} cx={x} cy={y} r={w*.0027} className={vertex?.p===p&&vertex.r===r&&vertex.i===i?'we-vertex active':'we-vertex'} onClick={e=>{e.stopPropagation();setVertex({p,r,i});}}/>;
          })))}
          {path.length>0&&<path d={line(drawingBoundary.points)} className={`we-drawing ${painting&&path.length>2&&!drawingBoundary.error?`we-mask we-${mode}`:''}`}/>}
          {brushPreview&&<path d={shape(brushPreview)} className={`we-mask we-${mode}`} fillRule="evenodd" pointerEvents="none"/>}
          {mode==='fill'&&highlightedBlock&&<path data-map-block="preview" d={shape(highlightedBlock)} fill="#35b68b55" stroke="#137359" strokeWidth="2.2" fillRule="evenodd" pointerEvents="none"/>}
          {path.map((p,i)=>{const [x,y]=project(p);return <circle key={i} cx={x} cy={y} r={w*.004} className="we-drawing-point"/>;})}
        </svg>
      </div>
    </div>
  </main>;
}

