import './styles.css';
import { AREA, migrate, newGame } from './engine';
import type { GameState } from './engine';
import { animateView, buildStaticMap, renderMap, updateScale } from './ui/map';
import { draft, endDay, endPhaseNow, resumePending, titleScreen } from './ui/modals';
import { renderStash } from './ui/cards';
import { renderTutorial } from './ui/tutorial';
import { renderCrew, renderGoals, renderLog, renderPlan, renderSel, renderTabs, renderTop, showTab } from './ui/panel';
import { $, MAP, PANEL_TABS, save, ui } from './ui/store';
import type { PanelTab, Selection } from './ui/store';

$('area-phase').textContent = `Fase 1 · ${AREA.name}`;
$('area-name').textContent = AREA.name;
$('area-all').textContent = AREA.surroundings[0].toUpperCase() + AREA.surroundings.slice(1);
$('map').parentElement!.setAttribute('aria-label', `Kart over ${AREA.name} og ${AREA.surroundings}`);

function select(s: Selection) {
  ui.sel = s;
  ui.selAction = null;
  showTab('sted'); // et klikk på kartet viser alltid stedet
  renderSel();
  renderMap(select);
  if (innerWidth <= 860) $('sel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

ui.refresh = () => {
  if (!ui.S) return; // ingen aktiv runde (tittelskjermen): ingenting å tegne
  renderTop(); renderTutorial(ui.S, ui.refresh); renderGoals(); renderTabs(); renderSel(); renderCrew(); renderStash(); renderLog(); renderPlan(); renderMap(select);
  save();
};

function setView(view: 'focus' | 'all') {
  $('v-focus').setAttribute('aria-pressed', String(view === 'focus'));
  $('v-all').setAttribute('aria-pressed', String(view === 'all'));
  animateView(view === 'focus' ? MAP.focus : MAP.view);
}
$('v-focus').onclick = () => setView('focus');
$('v-all').onclick = () => setView('all');
$('end').onclick = endDay;
$('goals').addEventListener('click', (e) => { if ((e.target as HTMLElement).id === 'endphase') endPhaseNow(); });
$('tabs').addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]')?.dataset.tab as PanelTab | undefined;
  if (t && PANEL_TABS.includes(t)) showTab(t);
});
addEventListener('resize', updateScale);

// Artifact-visningen kan bytte ut siden mens noen spiller; hot lar oss ta med tilstanden over.
interface Hot {
  snapshot?: (fn: () => unknown) => void;
  ready?: (fn: (data: { S?: GameState }) => void) => void;
  data?: { S?: GameState };
}
const hot = (window as unknown as { claude?: { hot?: Hot } }).claude?.hot;

function start(data: { S?: GameState } = {}) {
  buildStaticMap(select);
  // tilstanden fra forrige versjon av siden går gjennom samme migrering som en lagring
  const carried = data.S ? migrate(data.S) : null;
  if (carried) {
    ui.S = carried;
    ui.refresh();
    resumePending();
    return;
  }
  // forhåndsvisning bak tittelskjermen, lagres ikke
  ui.previewing = true;
  ui.S = newGame(1234, { name: 'Du', stats: draft.stats, trait: 'lokalkjent' }, ['mona', 'arild', 'toregil']);
  ui.refresh();
  ui.previewing = false;
  ui.S = null;
  renderTutorial(null, ui.refresh); // forhåndsvisningens tutorialkort skal ikke kunne klikkes uten runde
  titleScreen();
}

hot?.snapshot?.(() => ({ S: ui.S }));
if (hot?.ready) hot.ready(start);
else start(hot?.data ?? {});
