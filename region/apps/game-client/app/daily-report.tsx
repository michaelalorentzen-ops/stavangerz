'use client';

import { useState } from 'react';
import type { Flows, RegionReport, RegionState, RegionWorld, ReportLine } from '../../../packages/gameplay/src/region';
import { HudIcon, type HudIconName } from './hud-icons';
import './daily-report.css';

export interface DailyReportProps {
  report: RegionReport; state: RegionState; world: RegionWorld; flows: Flows;
  onZone: (zoneId: string) => void; onHelp?: (topic: string) => void;
}
type Outcome = ReportLine & { key: string; originalIndex?: number };
const count = (value: number) => value.toLocaleString('nb-NO', { maximumFractionDigits: 1 });
const signed = (value: number) => `${value > 0 ? '+' : ''}${count(value)}`;
const routine = (line: ReportLine) => !['bad', 'warn'].includes(line.tone) && /^(utstyr levert ved hjemkomst|utstyr tilbake|tilbake på lager|forsyninger levert|laget er tilbake|hjemme igjen)/i.test(line.title);
function priority(line: ReportLine) {
  let result = { bad: 1000, warn: 500, good: 180, info: 50 }[line.tone] + (line.priority ?? 0);
  if (/er død|mistet|gikk tapt|kom ikke|skadet|bitt|mislyktes|sult|tørst/i.test(line.title)) result += 180;
  if (line.category === 'migration') result += 100;
  if (/er deres|hq etablert|fase|ferdig|ble med/i.test(line.title)) result += 80;
  return result;
}
function iconFor(line: ReportLine): HudIconName {
  if (line.category === 'migration') return 'warning';
  if (/skad|bitt|behandl|død/i.test(line.title)) return 'heal';
  if (/er deres|overta|mistet.*sone/i.test(line.title)) return 'claim';
  if (/søk|fant|utstyr/i.test(line.title)) return 'stock';
  if (/speid/i.test(line.title)) return 'scout';
  if (/drept|kamp|angrep|tokt/i.test(line.title)) return 'clear';
  return line.tone === 'bad' || line.tone === 'warn' ? 'warning' : 'check';
}

/** Only historical report snapshots establish historical ownership. Never use today's save. */
export function reportOutcomes(report: RegionReport, world: RegionWorld): { summary: Outcome[]; log: Outcome[]; gained: number; lost: number } {
  const resolved = new Set(report.lines.filter(line => line.text.startsWith('Dere valgte: ')).map(line => line.title));
  const log = report.lines.flatMap((line, index) => line.text === 'En hendelse krever et valg.' && resolved.has(line.title) ? [] : [{ ...line, key: `line-${index}`, originalIndex: index }]);
  const transitions = new Map<string, { before: string; after: string }>();
  for (const stage of report.replay ?? []) for (const change of stage.zoneChanges) {
    const previous = transitions.get(change.zoneId);
    transitions.set(change.zoneId, { before: previous?.before ?? change.before, after: change.after });
  }
  const gained = [...transitions.values()].filter(change => change.before !== 'controlled' && change.after === 'controlled').length;
  const lost = [...transitions.values()].filter(change => change.before === 'controlled' && change.after !== 'controlled').length;
  const hasLocatedMigration = log.some(line => line.category === 'migration' && line.zoneId);
  const oldAggregate = log.find(line => /zombier kom inn i områdene deres/i.test(line.title));
  const additions: Outcome[] = [];
  if (oldAggregate && !hasLocatedMigration) {
    const beforeNight = report.replay?.find(stage => stage.phase === 'operations')?.mapSnapshot;
    const destinations = new Map<string, number>();
    if (beforeNight) for (const movement of report.moves ?? []) {
      if (beforeNight.zones[movement.to]?.status === 'controlled') destinations.set(movement.to, (destinations.get(movement.to) ?? 0) + movement.n);
    }
    for (const [zoneId, amount] of destinations) {
      additions.push({ key: `legacy-move-${zoneId}`, tone: 'warn', category: 'migration', zoneId, title: `${count(amount)} zombier kom inn i ${world.zones.find(zone => zone.id === zoneId)?.name ?? 'et registrert område'}`, text: 'Registrert bevegelse fra denne nattens rapport.', facts: { count: amount } });
    }
    // The movement journal is bounded. Its examples cannot explain the entire old aggregate.
    additions.push({ ...oldAggregate, key: 'legacy-migration-note', title: oldAggregate.title, text: 'Eldre rapport: samlet varsel uten fullstendige stedsopplysninger.', zoneId: undefined });
  }
  const summary = [...log.filter(line => !routine(line) && !(oldAggregate && line.key === oldAggregate.key)), ...additions]
    .sort((a, b) => priority(b) - priority(a));
  return { summary, log, gained, lost };
}

/** Word-boundary pages preserve the whole event; long log entries never force a desktop scroll. */
function textPages(text: string, size = 480): string[] {
  const words = text.match(/\S+\s*/g) ?? ['']; const pages: string[] = []; let current = '';
  for (const word of words) {
    if (current && current.length + word.length > size) { pages.push(current.trim()); current = ''; }
    if (word.length > size) { if (current) { pages.push(current.trim()); current = ''; } for (let i = 0; i < word.length; i += size) pages.push(word.slice(i, i + size).trim()); }
    else current += word;
  }
  if (current || !pages.length) pages.push(current.trim()); return pages;
}

export function DailyReport({ report, world, onZone, onHelp }: DailyReportProps) {
  const [tab, setTab] = useState<'summary' | 'log'>('summary');
  const [summaryPage, setSummaryPage] = useState(0), [logIndex, setLogIndex] = useState(0), [textPage, setTextPage] = useState(0);
  const { summary, log, gained, lost } = reportOutcomes(report, world);
  const summaryPages = Math.max(1, Math.ceil(summary.length / 3));
  const page = Math.min(summaryPage, summaryPages - 1);
  const selected = log[Math.min(logIndex, Math.max(0, log.length - 1))];
  const bodyPages = textPages(selected?.text ?? 'Ingen hendelser er registrert.');
  const bodyPage = Math.min(textPage, bodyPages.length - 1);
  const location = (line: ReportLine) => line.zoneId ? world.zones.find(zone => zone.id === line.zoneId)?.name ?? 'Registrert sted' : undefined;
  const openLog = (line: Outcome) => { setLogIndex(Math.max(0, log.findIndex(entry => entry.key === line.key))); setTextPage(0); setTab('log'); };
  const tiles: { icon: HudIconName; label: string; value: string; detail: string; tone: string }[] = [
    { icon: 'food', label: 'Mat · drift', value: signed(report.food.produced - report.food.eaten - (report.food.spoiled ?? 0)), detail: `${count(report.food.produced)} produsert · ${count(report.food.eaten)} spist${report.food.spoiled ? ` · ${count(report.food.spoiled)} svinn` : ''}`, tone: 'food' },
    { icon: 'water', label: 'Vann · drift', value: signed(report.water.produced - report.water.drunk), detail: `${count(report.water.produced)} hentet · ${count(report.water.drunk)} drukket`, tone: 'water' },
    { icon: 'clear', label: 'Zombier drept', value: count(report.killed), detail: 'Registrerte dødsfall denne dagen', tone: 'combat' },
    { icon: 'claim', label: 'Soner', value: gained || lost ? `${gained ? `+${gained}` : ''}${gained && lost ? ' / ' : ''}${lost ? `−${lost}` : ''}` : '—', detail: `${gained} vunnet · ${lost} tapt`, tone: lost ? 'loss' : 'territory' },
  ];
  return <div className="rz-daily-report dr-report">
    <header className="rz-report-hero dr-heading"><div><p className="rz-kicker">DAGSRAPPORT · DAG {report.day}</p><h2>Dette endret seg</h2></div>{onHelp && <button type="button" className="dr-help" onClick={() => onHelp('report')} aria-label="Håndbok om dagsrapporten"><HudIcon name="book" size={21} /></button>}</header>
    <div className="dr-stats" aria-label="Registrert dette døgnet">{tiles.map(tile => <div className={`dr-stat dr-stat-${tile.tone}`} key={tile.label} title={`${tile.label}: ${tile.detail}. Produksjon og forbruk er ikke full lagerendring.`}><HudIcon name={tile.icon} size={25}/><span><strong>{tile.value}</strong><small>{tile.label}</small></span></div>)}</div>
    <nav className="dr-tabs" aria-label="Rapportinnhold"><button type="button" aria-pressed={tab === 'summary'} onClick={() => setTab('summary')}>Viktigst <span>{summary.length}</span></button><button type="button" aria-pressed={tab === 'log'} onClick={() => setTab('log')}>Hele loggen <span>{log.length}</span></button></nav>
    {tab === 'summary' ? <section className="dr-outcomes" aria-label="Viktige endringer">{summary.slice(page * 3, page * 3 + 3).map(line => <article className={`dr-outcome dr-${line.tone}`} key={line.key}><span className="dr-outcome-symbol"><HudIcon name={iconFor(line)} size={22}/></span><div className="dr-outcome-text"><h3>{line.title}</h3><p>{line.category === 'migration' || /er deres$/.test(line.title) ? '' : line.text}</p></div><div className="dr-outcome-actions">{line.zoneId && <button type="button" className="dr-place" onClick={() => onZone(line.zoneId!)} aria-label={`Vis ${location(line)} på kartet`}><HudIcon name="location" size={16}/><span>{location(line)}</span></button>}{line.originalIndex !== undefined && <button type="button" className="dr-read" onClick={() => openLog(line)} aria-label={`Les hele hendelsen: ${line.title}`}><HudIcon name="report" size={15}/><span>Detaljer</span></button>}</div></article>)}{!summary.length && <div className="dr-quiet"><HudIcon name="check" size={28}/><h3>Ingen viktige avvik meldt</h3><p>Rutiner og hjemkomst ligger i loggen.</p></div>}</section>
      : <section className="dr-log" aria-label="Full hendelseslogg"><div className={`dr-log-event dr-${selected?.tone ?? 'info'}`}><div className="dr-log-title"><HudIcon name={selected ? iconFor(selected) : 'report'} size={23}/><h3>{selected?.title ?? 'En stille dag'}</h3></div>{selected?.zoneId && <button type="button" className="dr-place" onClick={() => onZone(selected.zoneId!)}><HudIcon name="location" size={16}/>{location(selected)}</button>}<p className="dr-log-body">{bodyPages[bodyPage]}</p>{bodyPages.length > 1 && <div className="dr-text-pages"><button type="button" disabled={bodyPage === 0} onClick={() => setTextPage(bodyPage - 1)} aria-label="Forrige tekstdel">←</button><span>Tekst {bodyPage + 1}/{bodyPages.length}</span><button type="button" disabled={bodyPage === bodyPages.length - 1} onClick={() => setTextPage(bodyPage + 1)} aria-label="Neste tekstdel">→</button></div>}</div></section>}
    <footer className={`dr-pagination ${tab === 'summary' && summaryPages === 1 ? 'is-single-page' : ''}`} aria-label="Rapportsider">{tab === 'summary' ? <><span>{summary.length ? `${page * 3 + 1}–${Math.min(summary.length, page * 3 + 3)} av ${summary.length} viktige endringer` : 'Alle rutiner er tilgjengelige i loggen'}</span><div><button type="button" disabled={page === 0} onClick={() => setSummaryPage(page - 1)} aria-label="Forrige endringer">←</button><button type="button" disabled={page === summaryPages - 1} onClick={() => setSummaryPage(page + 1)} aria-label="Neste endringer">→</button></div></> : <><span>Hendelse {log.length ? Math.min(logIndex + 1, log.length) : 0} av {log.length}</span><div><button type="button" disabled={!log.length || logIndex === 0} onClick={() => { setLogIndex(logIndex - 1); setTextPage(0); }} aria-label="Forrige hendelse">←</button><button type="button" disabled={!log.length || logIndex >= log.length - 1} onClick={() => { setLogIndex(logIndex + 1); setTextPage(0); }} aria-label="Neste hendelse">→</button></div></>}</footer>
  </div>;
}
export default DailyReport;
