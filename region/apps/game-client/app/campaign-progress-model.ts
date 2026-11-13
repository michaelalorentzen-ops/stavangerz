/** Read-only campaign presentation. Victory checks remain authoritative in progress.ts. */
import { controlled, goalMet, living, MILESTONES, PHASES, phaseDef, techBlocked, TECHS, totalPeople, type RegionState, type RegionWorld } from '../../../packages/gameplay/src/region';

export function campaignProgress(state: RegionState, world: RegionWorld) {
  const phase = phaseDef(state);
  const goals = phase.goals.map(goal => ({ ...goal, met: goalMet(state, world, goal.id) }));
  const next = PHASES.find(candidate => candidate.id === phase.id + 1);
  const rivals = state.factions.filter(faction => !faction.defeated);
  const allies = rivals.filter(faction => faction.relation >= 60 && !faction.hostile);
  const cure = TECHS.find(project => project.id === 'cure')!;
  const missingResearch = (cure.requires ?? []).filter(id => !state.research.done.includes(id)).map(id => TECHS.find(project => project.id === id)?.name ?? id);
  const stableDays = state.phase >= 5 ? Math.max(0, state.counters.stable ?? 0) : 0;
  return {
    phase, next, goals, completed: goals.filter(goal => goal.met).length,
    nextAction: goals.find(goal => !goal.met)?.text ?? (state.gameOver?.won ? 'Gjennomspillingen er vunnet.' : 'Kapasiteten er på plass. Neste døgn vurderer overgangen.'),
    cure: { done: state.research.done.includes('cure'), blocked: techBlocked(state, cure), missingResearch, current: state.research.current === 'cure', progress: state.research.current === 'cure' ? state.research.progress : 0 },
    alliance: { ready: allies.length === rivals.length, allies: allies.length, total: rivals.length, missing: rivals.filter(faction => !allies.includes(faction)).map(faction => ({ id: faction.id, name: faction.name, relation: faction.relation, hostile: faction.hostile })) },
    stable: { days: stableDays, moraleReady: state.morale >= 50, discontentReady: state.discontent < 50, crewReady: living(state).length > 0 },
  };
}

/** Current/final facts only. Never use this to reconstruct an archived daily report. */
export function campaignAchievements(state: RegionState) {
  return {
    phase: phaseDef(state), days: state.gameOver?.day ?? Math.max(0, state.day - 1),
    people: totalPeople(state), zones: controlled(state).length, research: state.research.done.length,
    milestones: MILESTONES.filter(milestone => state.milestones.includes(milestone.id)),
    discoveries: Object.keys(state.discoveries?.entries ?? {}).length,
    chapters: state.memory.filter(entry => /^Fase [2-5]:/.test(entry.text)),
  };
}
