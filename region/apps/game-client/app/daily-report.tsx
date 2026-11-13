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
type ProgressBeat = {
  key: string; kind: 'home' | 'territory' | 'discovery' | 'gear' | 'milestone' | 'search' | 'combat' | 'care' | 'production';
  icon: HudIconName; label: string; title: string; detail?: string; zoneId?: string; logIndex?: number;
  beforePercent?: number; afterPercent?: number; weight: number;
};
const count = (value: number) => value.toLocaleString('nb-NO', { maximumFractionDigits: 1 });
const signed = (value: number) => `${value > 0 ? '+' : ''}${count(value)}`;
const routine = (line: ReportLine) => !['bad', 'warn'].includes(line.tone) && /^(utstyr levert ved hjemkomst|utstyr tilbake|tilbake på lager|forsyninger levert|leveransen er fremme|lokalt depot fylt|laget er tilbake|hjemme igjen)/i.test(line.title);
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

/** Earned feedback comes only from this report, including when browsing the archive. */
export function reportProgress(report: RegionReport, world: RegionWorld): ProgressBeat[] {
  const beats = new Map<string, ProgressBeat>();
  const name = (zoneId?: string) => world.zones.find(zone => zone.id === zoneId)?.name;
  const finalControl = new Map<string, string>();
  for (const stage of report.replay ?? []) for (const change of stage.zoneChanges) finalControl.set(change.zoneId, change.after);
  report.lines.forEach((line, logIndex) => {
    if (routine(line) || ['bad', 'warn'].includes(line.tone)) return;
    const base = { key: `reward-${logIndex}`, title: line.title, zoneId: line.zoneId, logIndex };
    if (/^HQ etablert:/i.test(line.title)) {
      beats.set('home', { ...base, kind: 'home', icon: 'hq', label: 'Et fast tilhold', weight: 100 });
    } else if (/^(Fase \d+:|Milepæl:|Forskning ferdig:)/i.test(line.title)) {
      beats.set(line.title, { ...base, kind: 'milestone', icon: /^Forskning/i.test(line.title) ? 'research' : 'goals', label: /^Forskning/i.test(line.title) ? 'Kunnskap vunnet' : 'En milepæl nådd', weight: 95 });
    } else if (line.zoneId && /er deres$/i.test(line.title) && finalControl.get(line.zoneId) !== 'scouted' && finalControl.get(line.zoneId) !== 'unknown'
      && !report.lines.some(other => other.zoneId === line.zoneId && other.tone === 'bad' && /er tapt$/i.test(other.title))) {
      beats.set(`territory-${line.zoneId}`, { ...base, kind: 'territory', icon: 'claim', label: 'Territoriet vokser', title: name(line.zoneId) ?? line.title, detail: 'Nå under deres kontroll', weight: 90 });
    } else if (line.category === 'discovery' && /^(Feltnotat:|Avsluttet:)/i.test(line.title)) {
      beats.set(line.title, { ...base, kind: 'discovery', icon: 'compass', label: /^Avsluttet:/i.test(line.title) ? 'Et spor fullført' : 'Historien gikk videre', weight: 85 });
    } else if (/^Personlig utstyr funnet$/i.test(line.title)) {
      beats.set('gear', { ...base, kind: 'gear', icon: 'gear', label: 'Nytt utstyr funnet', title: line.text.replace(/\s+er (nå|fysisk) levert[\s\S]*$/i, '').replace(/\.$/, ''), weight: 80 });
    } else if (line.facts?.action === 'search' && line.zoneId) {
      const before = Number(line.facts.searchBefore), after = Number(line.facts.searchAfter), total = Number(line.facts.searchTotal);
      if (![before, after, total].every(Number.isFinite) || total <= 0 || after <= before) return;
      const key = `search-${line.zoneId}`, previous = beats.get(key);
      const beforePercent = Math.max(0, Math.min(100, Math.round(before / total * 1000) / 10));
      const afterPercent = Math.max(0, Math.min(100, Math.round(after / total * 1000) / 10));
      beats.set(key, { ...base, key, kind: 'search', icon: 'search', label: 'Søket rykker fram', title: name(line.zoneId) ?? line.title, beforePercent: Math.min(previous?.beforePercent ?? beforePercent, beforePercent), afterPercent: Math.max(previous?.afterPercent ?? afterPercent, afterPercent), weight: 70 });
    } else if (line.facts?.action === 'clear' && Number(line.facts.killed) > 0 && line.zoneId) {
      const remainingMin = Number(line.facts.remainingMin), remainingMax = Number(line.facts.remainingMax);
      beats.set(`combat-${logIndex}`, { ...base, kind: 'combat', icon: 'clear', label: 'Motstand slått tilbake', detail: Number.isFinite(remainingMin) && Number.isFinite(remainingMax) ? `${count(remainingMin)}–${count(remainingMax)} igjen, sist rapportert` : undefined, weight: 60 });
    } else if (/^Skadde behandlet$/i.test(line.title) && line.tone === 'good' && !/^Ingen i crewet fikk behandling\.$/i.test(line.text)) {
      beats.set('care', { ...base, kind: 'care', icon: 'heal', label: 'Omsorg ga resultater', detail: line.text, weight: 50 });
    }
  });
  // An ordinary productive day still has a real result. Never invent progress for an empty day.
  if (!beats.size && !report.lines.some(line => line.tone === 'bad' || line.tone === 'warn') && (report.food.produced > 0 || report.water.produced > 0)) {
    if (report.food.produced > 0) beats.set('food', { key: 'food', kind: 'production', icon: 'food', label: 'Dagens produksjon', title: `${count(report.food.produced)} mat produsert`, detail: `${count(report.food.eaten)} spist${report.food.spoiled ? ` · ${count(report.food.spoiled)} svinn` : ''}`, weight: 10 });
    if (report.water.produced > 0) beats.set('water', { key: 'water', kind: 'production', icon: 'water', label: 'Dagens forsyning', title: `${count(report.water.produced)} vann hentet`, detail: `${count(report.water.drunk)} drukket`, weight: 9 });
  }
  return [...beats.values()].sort((a, b) => b.weight - a.weight);
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
  const progress = reportProgress(report, world);
  const headline = !summary.some(line => line.tone === 'bad' || line.tone === 'warn') && progress.find(beat => ['home', 'territory', 'discovery', 'milestone', 'gear'].includes(beat.kind));
  const progressStrip = headline ? progress.filter(beat => beat.key !== headline.key) : progress;
  const shownProgress = progressStrip.slice(0, 2);
  const outcomeRows = summary.filter(line => {
    if(headline && line.originalIndex === headline.logIndex)return false;
    return !shownProgress.some(beat => beat.logIndex === line.originalIndex || (beat.kind === 'search' && beat.zoneId === line.zoneId && line.facts?.action === 'search'));
  });
  const summaryPages = Math.max(1, Math.ceil(outcomeRows.length / 3));
  const page = Math.min(summaryPage, summaryPages - 1);
  const selected = log[Math.min(logIndex, Math.max(0, log.length - 1))];
  const bodyPages = textPages(selected?.text ?? 'Ingen hendelser er registrert.');
  const bodyPage = Math.min(textPage, bodyPages.length - 1);
  const location = (line: ReportLine) => line.zoneId ? world.zones.find(zone => zone.id === line.zoneId)?.name ?? 'Registrert sted' : undefined;
  const openLog = (line: Outcome) => { setLogIndex(Math.max(0, log.findIndex(entry => entry.key === line.key))); setTextPage(0); setTab('log'); };
  const openProgress = (beat: ProgressBeat) => {
    if (beat.zoneId) { onZone(beat.zoneId); return; }
    if (beat.logIndex !== undefined) { setLogIndex(Math.max(0, log.findIndex(entry => entry.originalIndex === beat.logIndex))); setTextPage(0); setTab('log'); }
  };
  const tiles: { icon: HudIconName; label: string; value: string; detail: string; tone: string }[] = [
    { icon: 'food', label: 'Mat · drift', value: signed(report.food.produced - report.food.eaten - (report.food.spoiled ?? 0)), detail: `${count(report.food.produced)} produsert · ${count(report.food.eaten)} spist${report.food.spoiled ? ` · ${count(report.food.spoiled)} svinn` : ''}`, tone: 'food' },
    { icon: 'water', label: 'Vann · drift', value: signed(report.water.produced - report.water.drunk), detail: `${count(report.water.produced)} hentet · ${count(report.water.drunk)} drukket`, tone: 'water' },
    { icon: 'clear', label: 'Zombier drept', value: count(report.killed), detail: 'Registrerte dødsfall denne dagen', tone: 'combat' },
    { icon: 'claim', label: 'Soner', value: gained || lost ? `${gained ? `+${gained}` : ''}${gained && lost ? ' / ' : ''}${lost ? `−${lost}` : ''}` : '—', detail: `${gained} vunnet · ${lost} tapt`, tone: lost ? 'loss' : 'territory' },
  ];
  return <div className="rz-daily-report dr-report">
    <header className={`rz-report-hero dr-heading ${headline ? `dr-achievement-heading dr-achievement-${headline.kind}` : ''}`}><div><p className="rz-kicker">DAGSRAPPORT · DAG {report.day}</p><h2>{headline ? <button type="button" className="dr-achievement-open" onClick={() => openProgress(headline)}><HudIcon name={headline.icon} size={27}/><span>{headline.title}</span><HudIcon name={headline.zoneId ? 'location' : 'chevron'} size={17}/></button> : 'Dette endret seg'}</h2>{headline && <span className="dr-earned-label">{headline.label}</span>}</div>{onHelp && <button type="button" className="dr-help" onClick={() => onHelp('report')} aria-label="Håndbok om dagsrapporten"><HudIcon name="book" size={21} /></button>}</header>
    <div className="dr-stats" aria-label="Registrert dette døgnet">{tiles.map(tile => <div className={`dr-stat dr-stat-${tile.tone}`} key={tile.label} title={`${tile.label}: ${tile.detail}. Produksjon og forbruk er ikke full lagerendring.`}><HudIcon name={tile.icon} size={25}/><span><strong>{tile.value}</strong><small>{tile.label}</small></span></div>)}</div>
    <nav className="dr-tabs" aria-label="Rapportinnhold"><button type="button" aria-pressed={tab === 'summary'} onClick={() => setTab('summary')}>Viktigst</button><button type="button" aria-pressed={tab === 'log'} onClick={() => setTab('log')}>Hele loggen <span>{log.length}</span></button></nav>
    {tab === 'summary' && !!progressStrip.length && <section className="dr-progress" aria-label={progressStrip.every(beat => beat.kind === 'production') ? 'Dagens arbeid' : 'Dagens framgang'}><div className="dr-progress-label">{progressStrip.every(beat => beat.kind === 'production') ? 'Dagens arbeid' : 'Dagens framgang'}{progressStrip.length > 2 && <span> · {progressStrip.length - 2} flere i loggen</span>}</div><div className="dr-progress-beats">{progressStrip.slice(0, 2).map(beat => <button type="button" key={beat.key} className={`dr-progress-beat dr-progress-${beat.kind}`} disabled={!beat.zoneId && beat.logIndex === undefined} onClick={() => openProgress(beat)} title={beat.detail ?? beat.title}><HudIcon name={beat.icon} size={22}/><span className="dr-progress-copy"><small>{beat.label}</small><strong>{beat.title}</strong>{beat.afterPercent !== undefined ? <><span className="dr-progress-value">{count(beat.beforePercent ?? 0)} <span aria-hidden="true">→</span> {count(beat.afterPercent)} % gjennomsøkt</span><span className="dr-earned-track" aria-label={`${beat.beforePercent} til ${beat.afterPercent} prosent gjennomsøkt`}><i className="dr-earned-before" style={{ width: `${beat.beforePercent ?? 0}%` }}/><i className="dr-earned-today" style={{ left: `${beat.beforePercent ?? 0}%`, width: `${Math.max(0, beat.afterPercent - (beat.beforePercent ?? 0))}%` }}/></span></> : beat.detail && <span className="dr-progress-detail">{beat.detail}</span>}</span>{beat.zoneId && <HudIcon name="location" size={15}/>}</button>)}</div></section>}
    {tab === 'summary' ? <section className={`dr-outcomes ${headline && !outcomeRows.length ? 'is-promoted' : ''} ${progressStrip.length ? 'has-progress' : ''}`} aria-label="Viktige endringer">{outcomeRows.slice(page * 3, page * 3 + 3).map(line => <article className={`dr-outcome dr-${line.tone}`} key={line.key}><span className="dr-outcome-symbol"><HudIcon name={iconFor(line)} size={22}/></span><div className="dr-outcome-text"><h3>{line.title}</h3><p>{line.category === 'migration' || /er deres$/.test(line.title) ? '' : line.text}</p></div><div className="dr-outcome-actions">{line.zoneId && <button type="button" className="dr-place" onClick={() => onZone(line.zoneId!)} aria-label={`Vis ${location(line)} på kartet`}><HudIcon name="location" size={16}/><span>{location(line)}</span></button>}{line.originalIndex !== undefined && <button type="button" className="dr-read" onClick={() => openLog(line)} aria-label={`Les hele hendelsen: ${line.title}`}><HudIcon name="report" size={15}/><span>Detaljer</span></button>}</div></article>)}{!outcomeRows.length && !headline && <div className="dr-quiet"><HudIcon name="check" size={28}/><h3>Ingen viktige avvik meldt</h3><p>Rutiner og hjemkomst ligger i loggen.</p></div>}</section>
      : <section className="dr-log" aria-label="Full hendelseslogg"><div className={`dr-log-event dr-${selected?.tone ?? 'info'}`}><div className="dr-log-title"><HudIcon name={selected ? iconFor(selected) : 'report'} size={23}/><h3>{selected?.title ?? 'En stille dag'}</h3></div>{selected?.zoneId && <button type="button" className="dr-place" onClick={() => onZone(selected.zoneId!)}><HudIcon name="location" size={16}/>{location(selected)}</button>}<p className="dr-log-body">{bodyPages[bodyPage]}</p>{bodyPages.length > 1 && <div className="dr-text-pages"><button type="button" disabled={bodyPage === 0} onClick={() => setTextPage(bodyPage - 1)} aria-label="Forrige tekstdel">←</button><span>Tekst {bodyPage + 1}/{bodyPages.length}</span><button type="button" disabled={bodyPage === bodyPages.length - 1} onClick={() => setTextPage(bodyPage + 1)} aria-label="Neste tekstdel">→</button></div>}</div></section>}
    <footer className={`dr-pagination ${tab === 'summary' && summaryPages === 1 ? 'is-single-page' : ''}`} aria-label="Rapportsider">{tab === 'summary' ? <><span>{outcomeRows.length ? `${page * 3 + 1}–${Math.min(outcomeRows.length, page * 3 + 3)} av ${outcomeRows.length} ${headline ? 'øvrige' : 'viktige'} endringer` : 'Alle rutiner er tilgjengelige i loggen'}</span><div><button type="button" disabled={page === 0} onClick={() => setSummaryPage(page - 1)} aria-label="Forrige endringer">←</button><button type="button" disabled={page === summaryPages - 1} onClick={() => setSummaryPage(page + 1)} aria-label="Neste endringer">→</button></div></> : <><span>Hendelse {log.length ? Math.min(logIndex + 1, log.length) : 0} av {log.length}</span><div><button type="button" disabled={!log.length || logIndex === 0} onClick={() => { setLogIndex(logIndex - 1); setTextPage(0); }} aria-label="Forrige hendelse">←</button><button type="button" disabled={!log.length || logIndex >= log.length - 1} onClick={() => { setLogIndex(logIndex + 1); setTextPage(0); }} aria-label="Neste hendelse">→</button></div></>}</footer>
  </div>;
}
export default DailyReport;
