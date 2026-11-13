'use client';

import { HudIcon } from './hud-icons';
import { indexWorld, assigned, workforce, prepareGearPlan, resourceName, type RegionOrder, type RegionState, type RegionWorld, type Flows } from '../../../packages/gameplay/src/region';
import { crewPositionFor } from '../../../packages/gameplay/src/region/location';
import { commandOrderPreview } from './order-composer';

const n = (value:number) => value.toLocaleString('nb-NO',{maximumFractionDigits:1});
export function CrewDock({state,world,orders,onPerson}:{state:RegionState;world:RegionWorld;orders:RegionOrder[];onPerson:(id:string)=>void}) {
  const index=indexWorld(world);
  return <div className="sz-crew-dock" aria-label="Mannskapets status">{state.survivors.filter(p=>p.alive&&!p.left).map(p=>{
    const position=crewPositionFor(state,p.id), planned=orders.find(o=>o.survivorIds.includes(p.id));
    const active=Object.values(state.crewMissions??{}).find(m=>!['complete','failed'].includes(m.status)&&m.survivorIds.includes(p.id));
    const place=position?.kind==='zone'?index.byId.get(position.zoneId)?.name:position?.kind==='transit'?`Mot ${index.byId.get(position.toZoneId)?.name??'målet'}`:position?.kind==='area-duty'?'Områdevakt':'Ukjent posisjon';
    const status=active?'På oppdrag':planned?'Planlagt':position?.kind==='zone'&&position.zoneId===state.homeZoneId?'Hjemme':position?.kind==='zone'?'I felt':position?.kind==='transit'?'På reise':position?.kind==='area-duty'?'Vakt':'Ukjent';
    return <button key={p.id} className={`sz-dock-person ${planned?'is-planned':''} ${p.health<45?'is-injured':''}`} onClick={()=>onPerson(p.id)} title={`${p.name} · ${status} · ${place}${p.health<45?' · Skadet':''}`} aria-label={`${p.name}: ${status}. ${place}. Åpne persondetaljer`}><img src={`/art/crew/${p.name.toLocaleLowerCase('nb-NO')}.webp`} alt="" onError={e=>{e.currentTarget.style.visibility='hidden';}}/><span><strong>{p.name}</strong><small>{p.health<45?'Skadet':status}</small></span>{planned&&<HudIcon name="plan" size={14}/>}</button>;
  })}</div>;
}

export function TerritoryOverview({state,world,onZone}:{state:RegionState;world:RegionWorld;onZone:(id:string)=>void}) {
  const index=indexWorld(world),owned=index.l3.filter(z=>state.zones[z.id]?.status==='controlled');
  return <div className="sz-territory-overview"><p className="sz-eyebrow">DETTE KONTROLLERER DERE</p><h2>{owned.length} {owned.length===1?'sone':'soner'}</h2><p className="sz-context-tip">Den lyse mintgrensen på kartet viser territoriet. Kontroll betyr ikke at området er uten fare.</p>{!owned.length&&<p>Leiren er ennå ikke sikret. Velg et område på kartet for å undersøke mulighetene.</p>}<div className="sz-owned-list">{owned.map(z=>{return <button key={z.id} onClick={()=>onZone(z.id)} data-owned-zone={z.id}><HudIcon name={z.id===state.homeZoneId?'hq':'claim'}/><span><strong>{z.name}</strong><small>{z.id===state.homeZoneId?(state.hq?'Hovedkvarter':'Leiren'):index.byId.get(z.parentId??'')?.name}</small></span><HudIcon name="chevron"/></button>;})}</div></div>;
}

/** Canonical reservations, followed by the existing daily flow; no forecast loot. */
export function ResourceFocus({state,world,orders,resource,onSearch,onWork}:{state:RegionState;world:RegionWorld;orders:RegionOrder[];resource:string;onSearch:()=>void;onWork?:()=>void}) {
  const plan=prepareGearPlan(state,world,orders);let reserved=0;
  for(const order of orders){const p=commandOrderPreview(state,world,orders,order,plan);if(p.preview.valid&&p.movement.valid&&!plan.orders.find(x=>x.orderId===order.id)?.errors.length&&p.movement.originZoneId===state.homeZoneId)reserved+=p.reservations[resource]??0;}
  const value=state.stock[resource]??0;
  return <section className="sz-resource-focus"><p className="sz-eyebrow">LEIRENS FORSYNINGER</p><h2>{resourceName(resource)}</h2><div className="sz-resource-equation"><span><strong>{n(value)}</strong>Lager</span><b>−</b><span><strong>{n(reserved)}</strong>Til dagsplanen</span><b>=</b><span><strong>{n(Math.max(0,value-reserved))}</strong>Tilgjengelig</span></div>{onWork&&workforce(state)>assigned(state)&&<button className="sz-wide-action sz-assign-workers" onClick={onWork}><HudIcon name="people"/>{workforce(state)-assigned(state)} arbeidsføre uten oppgave · fordel arbeid<HudIcon name="arrow"/></button>}{['food','water'].includes(resource)&&<button className="sz-wide-action" onClick={onSearch}><HudIcon name="search"/>Planlegg et forsyningssøk<HudIcon name="arrow"/></button>}</section>;
}

export function DailyResourceFlow({flows,resource}:{flows:Flows;resource:string}) {
  if(resource!=='food'&&resource!=='water')return null;
  const f=resource==='food'?flows.food:flows.water;
  const rows: [string,number][] = resource==='food'?[['Produksjon',flows.food.produced],['Forbruk',-flows.food.eaten],['Svinn',-flows.food.spoiled],['Vedlikehold',-flows.food.upkeep]]:[['Produksjon',flows.water.produced],['Forbruk',-flows.water.drunk]];
  return <section className="sz-resource-flow"><h3>Vanlig døgn uten nye oppdrag</h3><dl>{rows.filter(([,v])=>v!==0).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value>0?'+':''}{n(value)}</dd></div>)}<div className="sz-flow-total"><dt>Netto per døgn</dt><dd>{f.net>0?'+':''}{n(f.net)}</dd></div></dl><p>{f.daysLeft===null?'Produksjonen dekker dagens vanlige forbruk.':`Lageret rekker omtrent ${n(f.daysLeft)} døgn med dette forbruket.`} Oppdrag kommer i tillegg; funn på tur er ikke regnet inn.</p></section>;
}
