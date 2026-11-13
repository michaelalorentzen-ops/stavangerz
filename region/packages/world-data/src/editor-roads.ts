import type { Position } from './model';
import { distance, nearestOnSegment } from './editor-geometry';

export function buildRoadNetwork(roads: readonly (readonly Position[])[]) {
  const vertices=new Map<string,{point:Position;links:Map<string,number>}>();
  const segments:{a:Position;b:Position;from:string;to:string;length:number}[]=[];
  const key=([x,y]:Position)=>x+','+y;
  for(const road of roads)for(let i=1;i<road.length;i++){
    const a=road[i-1],b=road[i],from=key(a),to=key(b),length=distance(a,b);
    if(!length)continue;
    if(!vertices.has(from))vertices.set(from,{point:a,links:new Map()});
    if(!vertices.has(to))vertices.set(to,{point:b,links:new Map()});
    vertices.get(from)!.links.set(to,length);
    vertices.get(to)!.links.set(from,length);
    segments.push({a,b,from,to,length});
  }
  function nearest(p:Position, tolerance:number){
    let found:{segment:typeof segments[number];point:Position}|undefined;
    for(const s of segments){
      if(p[0]<Math.min(s.a[0],s.b[0])-2*tolerance||p[0]>Math.max(s.a[0],s.b[0])+2*tolerance||
        p[1]<Math.min(s.a[1],s.b[1])-tolerance||p[1]>Math.max(s.a[1],s.b[1])+tolerance)continue;
      const point=nearestOnSegment(p,s.a,s.b),gap=distance(p,point);
      if(gap<tolerance){tolerance=gap;found={segment:s,point};}
    }
    return found;
  }
  return function follow(start:Position,end:Position,tolerance:number):Position[] {
    const a=nearest(start,tolerance),b=nearest(end,tolerance);
    if(!a||!b)throw new Error('Klikk nær den kartlagte linjen. Slå av linjefølging for fri tegning.');
    if(a.segment===b.segment)return [a.point,b.point];
    const direct=distance(a.point,b.point);
    const limit=Math.max(direct*3,tolerance*6);
    const scores=new Map<string,number>(), previous=new Map<string,string>();
    const pending=new Set<string>();
    for(const id of [a.segment.from,a.segment.to]){
      scores.set(id,distance(a.point,vertices.get(id)!.point));pending.add(id);
    }
    let best=Infinity, finish:string|undefined;
    while(pending.size){
      let next='',score=Infinity;
      for(const id of pending){const cost=scores.get(id)!;if(cost<score){next=id;score=cost;}}
      if(score>limit||score>=best)break;
      pending.delete(next);
      const vertex=vertices.get(next)!;
      if(next===b.segment.from||next===b.segment.to){
        const cost=score+distance(vertex.point,b.point);
        if(cost<best){finish=next;best=cost;}
      }
      for(const [id,length] of vertex.links){
        const cost=score+length;
        if(cost>limit||cost>=(scores.get(id)??Infinity))continue;
        scores.set(id,cost);previous.set(id,next);pending.add(id);
      }
    }
    if(!finish||best>limit)throw new Error('Fant ingen kort sammenhengende kartlinje. Klikk tettere langs linjen, eller slå av linjefølging.');
    const path:Position[]=[b.point];
    for(let id:string|undefined=finish;id;id=previous.get(id))path.push(vertices.get(id)!.point);
    path.push(a.point);
    return path.reverse();
  };
}

