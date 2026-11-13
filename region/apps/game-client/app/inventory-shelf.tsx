'use client';

import { useId, useState } from 'react';
import {
  Apple, Droplets, HeartPulse, Fuel, Crosshair, Hammer, Anvil, Cog, CircuitBoard, Container,
  BatteryFull, Sun, Zap, Pill, CircleDot, Radio, Sailboat, Printer, TriangleAlert,
  Package, Shield, HardHat, Shirt, Wrench, Binoculars, Flashlight, BriefcaseMedical,
  Swords, LockKeyhole, Backpack, MapPin, ArrowLeft, ArrowRight, CircleHelp, Boxes,
  type LucideIcon,
} from 'lucide-react';
import type { RegionState, RegionWorld } from '../../../packages/gameplay/src/region/types';
import { GEAR_CATALOG, gearItemName, knownGearItems, type GearItem, type GearPlan } from '../../../packages/gameplay/src/region/gear';
import { resourceName } from '../../../packages/gameplay/src/region/engine';
import { CONTENT } from '../../../packages/world-data/src/content';
import './inventory-shelf.css';
import {ItemArt,hasItemArt} from './item-art';

export interface InventoryShelfProps {
  state: RegionState;
  world: RegionWorld;
  plan?: GearPlan;
  onHelp?: (topic: string) => void;
}
type Category = 'supplies' | 'materials' | 'equipment';
type ShelfEntry = { id: string; name: string; count: number; icon: LucideIcon; family: string; resource?: string; gear?: GearItem };
const PAGE_SIZE = 8;
const CATEGORIES = [ ['supplies', 'Forsyninger', Apple], ['materials', 'Materialer', Boxes], ['equipment', 'Utstyr', Backpack] ] as const;
const RESOURCE_ICONS: Record<string, LucideIcon> = {
  food: Apple, water: Droplets, medicine: HeartPulse, fuel: Fuel, ammo: Crosshair,
  building: Hammer, metal: Anvil, parts: Cog, electronics: CircuitBoard, salt: Container,
  batteries: BatteryFull, solar: Sun, generator: Zap, antibiotics: Pill, primers: CircleDot,
  radio: Radio, engine: Cog, boat: Sailboat, printer: Printer, explosives: TriangleAlert,
};
const GEAR_ICONS: Record<string, LucideIcon> = {
  melee: Swords, pistol: Crosshair, shotgun: Crosshair, rifle: Crosshair, workcoat: Shirt,
  helmet: HardHat, vest: Shield, crowbar: Wrench, binoculars: Binoculars, toolbox: Wrench,
  medkit: BriefcaseMedical, flashlight: Flashlight,
};
const PRIMARY = new Set(['food', 'water', 'medicine', 'fuel', 'ammo', 'building']);
const number = (n: number) => n.toLocaleString('nb-NO', { maximumFractionDigits: 1 });
const familyFor = (id: string) => id === 'food' || id === 'salt' ? 'food' : id === 'water' ? 'water'
  : ['medicine', 'antibiotics'].includes(id) ? 'medical' : ['ammo', 'primers', 'explosives'].includes(id) ? 'weapon'
    : ['fuel', 'batteries', 'solar', 'generator'].includes(id) ? 'energy' : ['building', 'metal', 'parts'].includes(id) ? 'material' : 'technical';

/** Inventory is a projection: selecting a tile never equips, moves or reserves anything. */
export function InventoryShelf({ state, world, plan, onHelp }: InventoryShelfProps) {
  const [category, setCategory] = useState<Category>('supplies');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string>();
  const detailId = useId();
  const resources = CONTENT.resources.filter(r => r.layer !== 'capacity' && (PRIMARY.has(r.id) || (state.stock[r.id] ?? 0) > 0));
  const entries: ShelfEntry[] = resources.filter(r => category === 'supplies' ? r.layer === 'consumable'
    : category === 'materials' ? r.layer === 'material' : r.layer === 'component').map(r => ({
      id: `resource:${r.id}`, resource: r.id, name: resourceName(r.id), count: state.stock[r.id] ?? 0,
      icon: RESOURCE_ICONS[r.id] ?? Package, family: familyFor(r.id),
    }));
  if (category === 'equipment') for (const item of knownGearItems(state)) {
    const slot = GEAR_CATALOG[item.kind]?.slot;
    entries.push({ id: `gear:${item.id}`, gear: item, name: gearItemName(item), count: item.location.kind === 'lost' ? 0 : 1,
      icon: GEAR_ICONS[item.kind] ?? Package, family: slot === 'weapon' ? 'weapon' : slot === 'protection' ? 'protection' : 'technical' });
  }
  const pages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const shown = entries.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const selected = shown.find(item => item.id === selectedId) ?? shown[0];
  const zoneName = (id: string) => world.zones.find(z => z.id === id)?.name ?? 'Ukjent område';
  const personName = (id: string) => state.survivors.find(p => p.id === id)?.name ?? 'Ukjent person';
  const reservation = (item: GearItem) => plan?.reservations[item.id];
  const locks = (item: GearItem) => {
    const holders = new Set<string>();
    for (const [personId, preference] of Object.entries(state.gear?.preferences ?? {})) {
      if (Object.values(preference.locks ?? {}).includes(item.id)) holders.add(personId);
    }
    const plannedPeople = (plan?.orders ?? []).flatMap(order => order.crew);
    for (const person of plannedPeople) holders.delete(person.survivorId);
    for (const person of plannedPeople) {
      if (Object.values(person.preference.locks ?? {}).includes(item.id)) holders.add(person.survivorId);
    }
    return [...holders];
  };
  const resource = CONTENT.resources.find(r => r.id === selected?.resource);
  const item = selected?.gear;
  const location = item?.location;
  const held = item ? reservation(item) : undefined;
  const lockedBy = item ? locks(item) : [];
  const SelectedIcon = selected?.icon ?? Package;
  const changeCategory = (value: Category) => { setCategory(value); setPage(0); setSelectedId(undefined); };
  return <section className="ishelf" aria-label="Lager og utstyr">
    <header className="ishelf-header"><div><p className="ishelf-eyebrow">FORSYNINGER / INVENTAR</p><h2>Alt dere har å bygge på</h2></div><span className="ishelf-readonly">Lageroversikt</span></header>
    <div className="ishelf-categories" role="group" aria-label="Lagerkategori">{CATEGORIES.map(([key, label, Icon]) => <button type="button" key={key} aria-pressed={category === key} onClick={() => changeCategory(key)}><Icon aria-hidden="true" />{label}</button>)}</div>
    <div className="ishelf-layout"><div className="ishelf-rack"><div className={`ishelf-grid ${shown.length>0&&shown.length<=6?'ishelf-small-batch':''}`} aria-label={CATEGORIES.find(c => c[0] === category)?.[1]}>{shown.map(entry => {
      const Icon = entry.icon;
      const held = entry.gear ? reservation(entry.gear) : undefined;
      const locked = entry.gear ? locks(entry.gear).length > 0 : false;
      const carried = entry.gear?.location.kind === 'carried';
      const lost = entry.gear?.location.kind === 'lost';
      return <button type="button" key={entry.id} className={`ishelf-tile ishelf-${entry.family}${lost ? ' ishelf-lost' : ''}`} aria-pressed={selected?.id === entry.id} aria-controls={detailId} aria-label={`${entry.name}, ${number(entry.count)}${lost ? ', tapt' : held ? ', reservert' : carried ? ', båret' : ''}${locked ? ', manuelt låst' : ''}`} title={entry.name} onClick={() => setSelectedId(entry.id)}>
        <span className="ishelf-item-icon">{hasItemArt(entry.resource??entry.gear?.kind)?<ItemArt id={(entry.resource??entry.gear?.kind)!}/>:<Icon aria-hidden="true" />}</span><strong>{number(entry.count)}</strong><span className="ishelf-item-name">{entry.name}</span>
        <span className="ishelf-markers">{held && <span title="Reservert i dagsplanen"><CircleDot aria-hidden="true" /></span>}{carried && <span title="Båret av person"><Backpack aria-hidden="true" /></span>}{locked && <span title="Manuelt låst"><LockKeyhole aria-hidden="true" /></span>}{lost && <span>Tapt</span>}</span>
      </button>;
    })}</div>{!entries.length && <p className="ishelf-empty">Ingen kjente gjenstander i denne kategorien ennå.</p>}
      {pages>1&&<nav className="ishelf-pager" aria-label="Lagersider"><button type="button" aria-label="Forrige lagerside" disabled={currentPage === 0} onClick={() => { setPage(currentPage - 1); setSelectedId(undefined); }}><ArrowLeft aria-hidden="true" /></button><span aria-live="polite">Side {currentPage + 1} / {pages}<small>{entries.length} varetyper og gjenstander</small></span><button type="button" aria-label="Neste lagerside" disabled={currentPage + 1 >= pages} onClick={() => { setPage(currentPage + 1); setSelectedId(undefined); }}><ArrowRight aria-hidden="true" /></button></nav>}
      {shown.some(entry=>entry.gear)&&<p className="ishelf-legend"><Backpack aria-hidden="true" /> Båret <CircleDot aria-hidden="true" /> Reservert <LockKeyhole aria-hidden="true" /> Låst valg</p>}
    </div>
    <aside id={detailId} className={`ishelf-detail ishelf-${selected?.family ?? 'technical'}`} aria-label="Valgt gjenstand" aria-live="polite">{selected ? <><div className="ishelf-detail-top"><span className="ishelf-detail-icon">{hasItemArt(selected.resource??selected.gear?.kind)?<ItemArt id={(selected.resource??selected.gear?.kind)!}/>:<SelectedIcon aria-hidden="true" />}</span><span className="ishelf-eyebrow">{item ? 'PERSONLIG UTSTYR' : category === 'equipment' ? 'FELLES UTSTYR' : 'SENTRALLAGER'}</span></div><h3>{selected.name}</h3><p className="ishelf-quantity">{number(selected.count)} <small>{location?.kind === 'lost' ? 'tilgjengelig · tapt gjenstand' : item ? 'gjenstand' : 'på lager'}</small></p>
      <p className="ishelf-description">{item ? GEAR_CATALOG[item.kind]?.description ?? 'Utstyr registrert fra en tidligere lagring.' : resource?.help ?? resource?.decays ?? (category === 'supplies' ? 'Forbruksvare til gruppen og planlagte oppdrag.' : category === 'materials' ? 'Brukes til bygging, reparasjon og utvikling.' : 'Felles utstyr til transport, drift og planlagte oppdrag.')}</p>
      {location && <div className="ishelf-facts"><p><MapPin aria-hidden="true" /><span>{location.kind === 'stored' ? `Lagret i ${zoneName(location.zoneId)}` : location.kind === 'carried' ? `Bæres av ${personName(location.survivorId)}` : `Tapt dag ${location.day}${location.zoneId ? ` ved ${zoneName(location.zoneId)}` : ''}`}</span></p>
        {location.kind === 'carried' && <>{location.atZoneId && <p>Registrert ved {zoneName(location.atZoneId)}</p>}{location.missionId && <p>Bundet til pågående oppdrag{location.targetZoneId ? ` mot ${zoneName(location.targetZoneId)}` : ''}.</p>}{location.returnDay !== undefined && <p>Forventet retur dag {location.returnDay}{location.returnToZoneId ? ` til ${zoneName(location.returnToZoneId)}` : ''}.</p>}</>}
        {held && <p><CircleDot aria-hidden="true" /><span>Reservert i dagsplanen til {personName(held.survivorId)}.</span></p>}{lockedBy.length > 0 && <p><LockKeyhole aria-hidden="true" /><span>Manuelt låst for {lockedBy.map(personName).join(', ')}.</span></p>}
        {location.kind === 'stored' && !held && <p>På lager. Kan brukes av crew som faktisk har tilgang til stedet.</p>}
      </div>}
      {onHelp && <button type="button" className="ishelf-help" onClick={() => onHelp(selected.resource ? `resource:${selected.resource}` : 'gear')}><CircleHelp aria-hidden="true" />Les i håndboka</button>}
    </> : <><Package aria-hidden="true" /><h3>Plass til nye funn</h3><p className="ishelf-description">Rapportert utstyr vises her når gruppen finner det.</p></>}</aside></div>
  </section>;
}
export default InventoryShelf;
