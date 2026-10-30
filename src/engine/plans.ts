import type { CrewMember, GameState, Task } from './types';
import { isOnTokt } from './tokt';
import { postHolder } from './hq';
import { sameTask, taskOptions } from './engine';

/** Høyst så mange lagrede planer, og navnene kuttes: planene følger lagringen. */
export const MAX_PLANS = 6;
const MAX_PLAN_NAME = 20;

/**
 * Den naturlige neste oppgaven i samme sektor etter at speiding eller rydding er ferdig, eller null.
 * Speide: Rydde hvis det er zombier, ellers Sanke. Rydde ferdig: Sanke, ellers Holde vakt.
 * Bare ordre som er gyldige nå (`valid`, fra taskOptions) kommer på tvers. Ingen tilfeldighet.
 */
export function nextTask(s: GameState, done: Task, valid: Task[]): Task | null {
  if (done.type !== 'speide' && done.type !== 'rydde') return null;
  const t = done.target;
  const order: Task[] = done.type === 'speide'
    ? [...(s.sectors[t].z > 0 ? [{ type: 'rydde', target: t } as Task] : []), { type: 'sanke', target: t }, { type: 'vakt', target: t }]
    : [{ type: 'sanke', target: t }, { type: 'vakt', target: t }];
  return order.find((o) => valid.some((v) => sameTask(v, o))) ?? null;
}

/** Husker dagens ordre før dagen løses, så «Som i går» kan sette dem tilbake. Kalles fra resolveDay. */
export function rememberTasks(s: GameState): void {
  s.lastTasks = Object.fromEntries(s.crew.map((c) => [c.id, { ...c.task } as Task]));
}

/** Setter ordrene fra `tasks` (crew-id til ordre). Bare gyldige ordre settes; returnerer hvem som ble satt og hvem som ble hoppet over. */
export function applyTasks(s: GameState, tasks: Record<string, Task>): { set: string[]; skipped: string[] } {
  const valid = taskOptions(s);
  const set: string[] = [], skipped: string[] = [];
  for (const c of s.crew as CrewMember[]) {
    const t = tasks[c.id];
    if (!t || isOnTokt(s, c)) continue;
    const holder = t.type === 'post' ? postHolder(s, t.target) : undefined;
    if (valid.some((o) => sameTask(o, t)) && (!holder || holder === c)) { c.task = { ...t }; set.push(c.id); } else skipped.push(c.id);
  }
  return { set, skipped };
}

/** Lagrer dagens fordeling som en navngitt plan. Samme navn overskriver. Returnerer false hvis navnet mangler eller det er fullt. */
export function savePlan(s: GameState, name: string): boolean {
  const n = name.trim().slice(0, MAX_PLAN_NAME);
  if (!n) return false;
  const tasks = Object.fromEntries(s.crew.filter((c) => !isOnTokt(s, c)).map((c) => [c.id, { ...c.task } as Task]));
  const i = s.plans.findIndex((p) => p.name === n);
  if (i >= 0) s.plans[i] = { name: n, tasks };
  else if (s.plans.length < MAX_PLANS) s.plans.push({ name: n, tasks });
  else return false;
  return true;
}

export const deletePlan = (s: GameState, name: string): void => { s.plans = s.plans.filter((p) => p.name !== name); };

export function applyPlan(s: GameState, name: string) {
  const p = s.plans.find((x) => x.name === name);
  return p ? applyTasks(s, p.tasks) : { set: [], skipped: [] };
}

/** «Som i går»: oppdragene fra forrige dag, der de fortsatt er gyldige. */
export const repeatYesterday = (s: GameState) => applyTasks(s, s.lastTasks);
