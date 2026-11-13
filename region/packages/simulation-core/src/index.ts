import { resolveResources, type ResourceLedger, type ResourceOrder, type Stocks } from './resources';
export type { ResourceLedger, ResourceOrder, Stocks } from './resources';
export const SIMULATION_RULES_VERSION = 'm2.2';

/** Geometry-free M2 experiment. Connections are explicitly bidirectional.
 * No area, polygon, React, persistence, combat or economic rules belong here.
 */
export interface Connection {
  readonly id: string;
  readonly fromId: string;
  readonly toId: string;
  readonly allowZombies: boolean;
  readonly capacityPerDirection: number;
}
export interface SimulationWorld {
  readonly zoneIds: readonly string[];
  readonly reservoirIds: readonly string[];
  readonly connections: readonly Connection[];
}
export interface BarrierState {
  readonly durability: number;
  readonly warnedDay?: number;
}
export interface SimulationState {
  readonly day: number;
  /** Includes external reservoirs. There is one ordinary cohort per location. */
  readonly population: Readonly<Record<string, number>>;
  readonly barriers: Readonly<Record<string, BarrierState>>;
  readonly stocks?: Stocks;
}
export interface NoiseOrder { readonly zoneId: string; readonly noise: number }
export interface SimulationConfig {
  readonly mobilityRate: number;
  readonly noiseWeight: number;
  readonly attemptsPerDurability: number;
}
export interface Movement { readonly connectionId: string; readonly fromId: string; readonly toId: string; readonly count: number }
export interface SimulationEvent {
  readonly type: 'barrier-pressure' | 'barrier-warning' | 'barrier-breached';
  readonly connectionId: string;
  readonly count: number;
}
export interface PopulationLedger {
  readonly zonesBefore: number;
  readonly zonesAfter: number;
  readonly reservoirsBefore: number;
  readonly reservoirsAfter: number;
  readonly immigration: number;
  readonly emigration: number;
  readonly totalBefore: number;
  readonly totalAfter: number;
}
export interface DayResult {
  readonly state: SimulationState;
  readonly movements: readonly Movement[];
  readonly events: readonly SimulationEvent[];
  readonly ledger: PopulationLedger;
  readonly resourceLedger: ResourceLedger;
  readonly report: {
    readonly rulesVersion: typeof SIMULATION_RULES_VERSION;
    readonly day: number;
    readonly daySeed: number;
    readonly config: SimulationConfig;
    readonly moved: number;
    readonly immigration: number;
    readonly emigration: number;
    readonly warnings: readonly string[];
    readonly breaches: readonly string[];
    readonly resourceOrders: readonly ResourceOrder[];
  };
}

const sorted = (ids: readonly string[]) => [...ids].sort();
const natural = (value: number, label: string) => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a nonnegative safe integer`);
};
function random(seed: number, day: number, id: string): () => number {
  let hash = 2166136261;
  for (const char of `${seed}|${day}|${id}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return () => { hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0; return hash / 4294967296; };
}
const sum = (ids: readonly string[], population: Readonly<Record<string, number>>) => ids.reduce((n, id) => n + population[id], 0);

/** H pipeline: validate → noise → snapshot migration proposals → blocked pressure/
 * erosion → simultaneous transfers → ledger. A breached barrier opens NEXT day.
 * Trusted noise/resource plans are not player-authorized commands. The application
 * must validate ownership/reach/work before passing them here. Resource reservation
 * uses opening stocks, so arrivals are available the following day (H).
 * Production and combat are deliberately absent; their relative phase is not locked.
 */
export function resolveDay(world: SimulationWorld, state: SimulationState, orders: readonly NoiseOrder[], daySeed: number, config: SimulationConfig, resourceOrders: readonly ResourceOrder[] = []): DayResult {
  natural(state.day, 'day'); natural(daySeed, 'daySeed');
  const resources = resolveResources(state.stocks ?? {}, resourceOrders);
  if (!Number.isFinite(config.mobilityRate) || config.mobilityRate < 0 || config.mobilityRate > 1) throw new Error('mobilityRate must be in [0,1]');
  if (!Number.isFinite(config.noiseWeight) || config.noiseWeight < 0) throw new Error('noiseWeight must be nonnegative');
  natural(config.attemptsPerDurability, 'attemptsPerDurability');
  if (config.attemptsPerDurability === 0) throw new Error('attemptsPerDurability must be positive');
  const ids = sorted([...world.zoneIds, ...world.reservoirIds]);
  const zones = new Set(world.zoneIds);
  if (new Set(ids).size !== ids.length || ids.some(id => !id)) throw new Error('Location IDs must be unique and nonempty');
  if (Object.keys(state.population).length !== ids.length) throw new Error('Population must account for every location, including reservoirs');
  for (const id of ids) natural(state.population[id], `population ${id}`);
  natural(sum(ids, state.population), 'total population');
  const connections = [...world.connections].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  if (new Set(connections.map(c => c.id)).size !== connections.length) throw new Error('Duplicate connection ID');
  const connectionIds = new Set(connections.map(c => c.id));
  for (const c of connections) {
    if (!c.id || c.fromId === c.toId || !ids.includes(c.fromId) || !ids.includes(c.toId)) throw new Error(`Invalid connection ${c.id}`);
    natural(c.capacityPerDirection, `capacity ${c.id}`);
  }
  for (const [id, barrier] of Object.entries(state.barriers)) {
    if (!connectionIds.has(id)) throw new Error(`Unknown barrier connection ${id}`);
    natural(barrier.durability, `barrier ${id}`);
    if (barrier.warnedDay !== undefined) {
      natural(barrier.warnedDay, `warning ${id}`);
      if (barrier.warnedDay > state.day) throw new Error('Barrier warning cannot come from the future');
    }
  }
  const noise: Record<string, number> = {};
  for (const order of orders) {
    if (!zones.has(order.zoneId) || Object.hasOwn(noise, order.zoneId)) throw new Error('Noise orders require unique modeled zones');
    natural(order.noise, `noise ${order.zoneId}`);
    noise[order.zoneId] = order.noise;
  }
  const movements: Movement[] = [];
  const pressure: Record<string, number> = {};
  for (const id of ids) {
    const rng = random(daySeed, state.day, id);
    const rawMobile = state.population[id] * config.mobilityRate * (.5 + .5 * rng());
    // Seeded stochastic rounding keeps small cohorts mobile without exceeding
    // the opening population or introducing a deterministic singleton trap.
    const wholeMobile = Math.floor(rawMobile);
    const mobile = Math.min(state.population[id], wholeMobile + (rng() < rawMobile - wholeMobile ? 1 : 0));
    const candidates = connections.filter(c => c.allowZombies && c.capacityPerDirection > 0 && (c.fromId === id || c.toId === id)).map(c => {
      const target = c.fromId === id ? c.toId : c.fromId;
      const weight = (1 + (noise[target] ?? 0) * config.noiseWeight) * (.75 + .5 * rng());
      if (!Number.isFinite(weight)) throw new Error('Noise attraction overflow');
      return { c, target, weight, count: 0, remainder: 0 };
    });
    const totalWeight = candidates.reduce((n, c) => n + c.weight, 0);
    if (!Number.isFinite(totalWeight)) throw new Error('Attraction overflow');
    for (const c of candidates) {
      const allocation = mobile * (c.weight / totalWeight);
      c.count = Math.floor(allocation); c.remainder = allocation - c.count;
    }
    // Largest remainders allocate only the original source budget; capacity excess stays.
    let extra = mobile - candidates.reduce((n, c) => n + c.count, 0);
    for (const c of [...candidates].sort((a, b) => b.remainder - a.remainder || (a.c.id < b.c.id ? -1 : 1))) {
      if (extra-- > 0) c.count++;
    }
    for (const { c, target, count } of candidates) {
      const attempt = Math.min(count, c.capacityPerDirection);
      if (!attempt) continue;
      if ((state.barriers[c.id]?.durability ?? 0) > 0) pressure[c.id] = (pressure[c.id] ?? 0) + attempt;
      else movements.push({ connectionId: c.id, fromId: id, toId: target, count: attempt });
    }
  }
  const population: Record<string, number> = Object.fromEntries(ids.map(id => [id, state.population[id]]));
  for (const move of movements) { population[move.fromId] -= move.count; population[move.toId] += move.count; }
  const barriers: Record<string, BarrierState> = {};
  const events: SimulationEvent[] = [];
  for (const id of sorted(Object.keys(state.barriers))) {
    const old = state.barriers[id];
    const attempts = pressure[id] ?? 0;
    if (!attempts) { barriers[id] = { ...old }; continue; }
    events.push({ type: 'barrier-pressure', connectionId: id, count: attempts });
    const wear = Math.ceil(attempts / config.attemptsPerDurability);
    if (wear >= old.durability && old.warnedDay === undefined) {
      barriers[id] = { durability: 1, warnedDay: state.day + 1 };
      events.push({ type: 'barrier-warning', connectionId: id, count: attempts });
    } else {
      const durability = Math.max(0, old.durability - wear);
      barriers[id] = { ...old, durability };
      if (!durability) events.push({ type: 'barrier-breached', connectionId: id, count: attempts });
    }
  }
  const immigration = movements.filter(m => !zones.has(m.fromId) && zones.has(m.toId)).reduce((n, m) => n + m.count, 0);
  const emigration = movements.filter(m => zones.has(m.fromId) && !zones.has(m.toId)).reduce((n, m) => n + m.count, 0);
  const zonesBefore = sum(world.zoneIds, state.population), zonesAfter = sum(world.zoneIds, population);
  const reservoirsBefore = sum(world.reservoirIds, state.population), reservoirsAfter = sum(world.reservoirIds, population);
  const ledger = { zonesBefore, zonesAfter, reservoirsBefore, reservoirsAfter, immigration, emigration, totalBefore: zonesBefore + reservoirsBefore, totalAfter: zonesAfter + reservoirsAfter };
  for (const id of ids) natural(population[id], `resolved population ${id}`);
  if (ledger.totalBefore !== ledger.totalAfter || zonesAfter !== zonesBefore + immigration - emigration) throw new Error('Population ledger failed');
  natural(state.day + 1, 'next day');
  return { state: { day: state.day + 1, population, barriers, stocks: resources.stocks }, movements, events, ledger,
    resourceLedger: resources.ledger,
    report: { rulesVersion: SIMULATION_RULES_VERSION, day: state.day + 1, daySeed, config: { ...config },
      moved: movements.reduce((total, movement) => total + movement.count, 0), immigration, emigration,
      warnings: events.filter(event => event.type === 'barrier-warning').map(event => event.connectionId),
      breaches: events.filter(event => event.type === 'barrier-breached').map(event => event.connectionId),
      resourceOrders: resources.orders },
  };
}
