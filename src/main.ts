import './styles.css';
import { newGame } from './engine';
import type { GameState } from './engine';
import { animateView, buildStaticMap, renderMap, updateScale } from './ui/map';
import { draft, endDay, endScreen, titleScreen } from './ui/modals';
import { renderCrew, renderGoals, renderPlan, renderSel, renderTop } from './ui/panel';
import { $, MAP, save, ui } from './ui/store';
import type { Selection } from './ui/store';

function select(s: Selection) {
  ui.sel = s;
  ui.selAction = null;
  renderSel();
  renderMap(select);
  if (innerWidth <= 860) $('sel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

ui.refresh = () => {
  renderTop(); renderGoals(); renderSel(); renderCrew(); renderPlan(); renderMap(select);
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
  if (data.S) {
    ui.S = data.S;
    ui.refresh();
    if (ui.S.over === 'won' || ui.S.over === 'dead') endScreen();
    return;
  }
  // forhåndsvisning bak tittelskjermen, lagres ikke
  ui.previewing = true;
  ui.S = newGame(1234, { name: 'Deg', stats: draft.stats, trait: 'lokalkjent' }, ['mona', 'arild', 'toregil']);
  ui.refresh();
  ui.previewing = false;
  ui.S = null;
  titleScreen();
}

hot?.snapshot?.(() => ({ S: ui.S }));
if (hot?.ready) hot.ready(start);
else start(hot?.data ?? {});
