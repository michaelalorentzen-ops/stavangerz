import type { GameOrder, PlayState } from '../../../packages/gameplay/src/model';
import { ACTION_LABELS, PHASE_ONE_RULES_VERSION, validateSavedGame } from '../../../packages/gameplay/src/index';

export const SAVE_KEY = 'stavanger-z.phase1';
export const BACKUP_KEY = `${SAVE_KEY}.backup`;
export interface SaveEnvelope {
  format: typeof SAVE_KEY;
  revision: number;
  savedAt: string;
  game: PlayState;
  orders: GameOrder[];
  selectedZoneId: string;
}
export type SavePayload = Pick<SaveEnvelope, 'game' | 'orders' | 'selectedZoneId'>;
export type SaveStorage = Pick<Storage, 'getItem' | 'setItem'>;
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

function browserStorage(): SaveStorage {
  try { return window.localStorage; }
  catch { throw new Error('Nettleseren gir ikke tilgang til lokal lagring. Tillat lagring, eller bruk Eksporter lagring før du lukker spillet.'); }
}

/** Validate both envelope and gameplay before any overwrite. This adapter never
 * invents, upgrades or silently replaces an existing save.
 */
export function parseSave(json: string): SaveEnvelope {
  let value: unknown;
  try { value = JSON.parse(json); } catch { throw new Error('Lagringsfilen er ikke gyldig JSON. Eksisterende lagring er beholdt.'); }
  if (object(value) && value.format === 'stavanger-z.m3') {
    throw new Error('Denne filen tilhører M3. Åpne den i M3-utgaven av Stavanger Z.');
  }
  if (!object(value) || value.format !== SAVE_KEY || !integer(value.revision) || value.revision < 1 || typeof value.savedAt !== 'string' || !Number.isFinite(Date.parse(value.savedAt))) {
    throw new Error('Velg en gyldig lagringsfil fra Stavanger Z fase 1.');
  }
  if (!object(value.game) || value.game.gameRulesVersion !== PHASE_ONE_RULES_VERSION) {
    throw new Error('Lagringen bruker en annen regelversjon. Velg en lagring fra denne utgaven av fase 1.');
  }
  const domainErrors = validateSavedGame(value.game);
  if (domainErrors.length) throw new Error(`${domainErrors.join(' ')} Eksisterende lagring er beholdt.`);
  const game = value.game as unknown as PlayState;
  const zoneIds = new Set(game.worldSnapshot.zones.map(zone => zone.id));
  const personIds = new Set(game.survivors.map(person => person.id));
  if (!Array.isArray(value.orders) || typeof value.selectedZoneId !== 'string' || !zoneIds.has(value.selectedZoneId)) throw new Error('Lagringen har ugyldige planleggingsdata.');
  const orderIds = new Set<unknown>();
  for (const order of value.orders) {
    if (!object(order) || typeof order.id !== 'string' || !order.id || orderIds.has(order.id) || typeof order.type !== 'string' || !Object.hasOwn(ACTION_LABELS, order.type) ||
        typeof order.targetId !== 'string' || !zoneIds.has(order.targetId) || !Array.isArray(order.crewIds) || order.crewIds.some(id => typeof id !== 'string' || !personIds.has(id)) ||
        (order.poiId !== undefined && typeof order.poiId !== 'string') ||
        (order.mode !== undefined && order.mode !== 'together' && order.mode !== 'spread')) throw new Error('Lagringen inneholder ugyldige ordre.');
    orderIds.add(order.id);
  }
  return value as unknown as SaveEnvelope;
}

export function readSave(storage: SaveStorage = browserStorage()): SaveEnvelope | null {
  let json: string | null;
  try { json = storage.getItem(SAVE_KEY); }
  catch { throw new Error('Kunne ikke lese lokal lagring. Nettleseren kan ha blokkert lagring.'); }
  return json === null ? null : parseSave(json);
}

export function readBackupSave(storage: SaveStorage = browserStorage()): SaveEnvelope | null {
  const json = storage.getItem(BACKUP_KEY);
  return json === null ? null : parseSave(json);
}

/** Compare-and-swap prevents ordinary stale-tab overwrites. Call this inside
 * withSaveLock for cross-tab serialization in browsers supporting Web Locks.
 */
export function writeSave(payload: SavePayload, expectedRevision: number | null, storage: SaveStorage = browserStorage()): SaveEnvelope {
  let current: string | null;
  try { current = storage.getItem(SAVE_KEY); } catch { throw new Error('Kunne ikke kontrollere lokal lagring. Eksporter spillet for å beholde fremdriften.'); }
  const previous = current === null ? null : parseSave(current);
  if ((previous?.revision ?? null) !== expectedRevision) throw new Error('Spillet er endret i en annen fane. Last inn den nyeste lagringen før du fortsetter.');
  const envelope: SaveEnvelope = { format: SAVE_KEY, revision: (previous?.revision ?? 0) + 1, savedAt: new Date().toISOString(), ...payload };
  const json = JSON.stringify(envelope);
  parseSave(json);
  try {
    if (current !== null) storage.setItem(BACKUP_KEY, current);
    storage.setItem(SAVE_KEY, json);
  } catch { throw new Error('Lokal lagring feilet eller er full. Eksisterende lagring er beholdt. Bruk Eksporter lagring for den nye fremdriften.'); }
  return envelope;
}

export function exportSave(envelope: SaveEnvelope): string {
  parseSave(JSON.stringify(envelope));
  return JSON.stringify(envelope, null, 2);
}

/** Export also works when browser storage is unavailable or full. */
export function exportPayload(payload: SavePayload): string {
  return exportSave({ format: SAVE_KEY, revision: 1, savedAt: new Date().toISOString(), ...payload });
}

/** Explicit recovery only: archive unreadable data verbatim before replacing it.
 * Ordinary autosave must use writeSave, never this function.
 */
export function recoverSave(payload: SavePayload, storage: SaveStorage = browserStorage()): SaveEnvelope {
  const current = storage.getItem(SAVE_KEY);
  if (current !== null) {
    let unreadable = false;
    try { parseSave(current); } catch { unreadable = true; }
    if (!unreadable) throw new Error('Lagringen kan leses. Last den inn eller bruk vanlig lagring med riktig revisjon.');
  }
  const envelope: SaveEnvelope = { format: SAVE_KEY, revision: 1, savedAt: new Date().toISOString(), ...payload };
  const json = JSON.stringify(envelope);
  parseSave(json);
  try {
    if (current !== null) storage.setItem(`${SAVE_KEY}.unreadable`, current);
    storage.setItem(SAVE_KEY, json);
  } catch { throw new Error('Kunne ikke gjenopprette lokal lagring. Eksporter spillet til en fil.'); }
  return envelope;
}

export async function withSaveLock<T>(work: () => T | Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) return navigator.locks.request(SAVE_KEY, work);
  return work();
}
