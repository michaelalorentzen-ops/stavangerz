// Tutorial for de tre første dagene: et sambandskort øverst i panelet.
// done() er ren og leser bare tilstanden, så den kan testes uten DOM.
import { GATES } from '../engine';
import type { GameState } from '../engine';

export interface TutorialStep { day: 1 | 2 | 3; text: string; done(s: GameState): boolean }

export const TUTORIAL: TutorialStep[] = [
  {
    day: 1,
    text: 'Samband: Velg Hjemme på kartet, velg Rydde og send minst to av dere dit. To rydder tryggere enn én, og det er sjelden noen som angrer på å ha med seg nabo. Trykk «Avslutt dag» når ordrene er lagt.',
    done: (s) => s.crew.filter((c) => c.task.type === 'rydde' && c.task.target === 'hjem').length >= 2,
  },
  {
    day: 2,
    text: `Samband: Natta er lang og ${GATES.ros.name} er tynt. Velg det på kartet og sett noen på Befeste eller Vakt. Befeste koster tre og skrap, Vakt holder kontrollen oppe.`,
    done: (s) => s.crew.some((c) => (c.task.type === 'befeste' || c.task.type === 'vakt') && c.task.target === 'ros'),
  },
  {
    day: 3,
    text: 'Samband: Sanke henter ressurser fra sektorer dere har ryddet. Pass på kontrollen: den forfaller hver dag ingen er der, og da siver zombiene inn igjen. Hold noen på vakt, eller rydd en gang til.',
    done: (s) => s.crew.some((c) => c.task.type === 'sanke'),
  },
];

const OFF_KEY = 'stavanger-z-tutorial-off';

export function tutorialOff(): boolean {
  try { return localStorage.getItem(OFF_KEY) === '1'; } catch { return false; }
}
export function setTutorialOff() {
  try { localStorage.setItem(OFF_KEY, '1'); } catch { /* valget gjelder da bare denne økta */ }
}

/** Trinnet som hører til dagen, eller null etter dag 3 og i senere faser. */
export const stepFor = (s: GameState): TutorialStep | null => (s.phase === 1 && !s.over ? TUTORIAL.find((t) => t.day === s.day) ?? null : null);

/** Nøkkel for «Skjønner»: per runde (seed) og per dag. */
export const dismissKey = (s: Pick<GameState, 'seed' | 'day'>) => `stavanger-z-tutorial-ok-${s.seed}-${s.day}`;
const isDismissed = (s: GameState): boolean => { try { return sessionStorage.getItem(dismissKey(s)) === '1'; } catch { return false; } };
const dismiss = (s: GameState) => { try { sessionStorage.setItem(dismissKey(s), '1'); } catch { /* kortet kommer da tilbake ved neste tegning */ } };
let offThisSession = false; // dekker tilfellet der localStorage ikke virker

/** Tegner kortet i #tutorial. Kalles fra refresh. */
export function renderTutorial(S: GameState | null, onChange: () => void) {
  const box = document.getElementById('tutorial');
  if (!box) return;
  const step = S && !offThisSession && !tutorialOff() ? stepFor(S) : null;
  if (!S || !step || isDismissed(S)) { box.innerHTML = ''; return; }
  const done = step.done(S);
  box.innerHTML = `<div class="card tut"><span class="badge inf">Samband · dag ${step.day} av 3</span><p>${step.text}</p>
    ${done ? '<p class="hint">✓ Ordren er lagt.</p>' : ''}
    <div class="row"><button class="btn small" id="tut-ok">Skjønner</button><button class="btn small ghost" id="tut-skip">Hopp over tutorial</button></div></div>`;
  document.getElementById('tut-ok')!.onclick = () => { dismiss(S); onChange(); };
  document.getElementById('tut-skip')!.onclick = () => { offThisSession = true; setTutorialOff(); onChange(); };
}
