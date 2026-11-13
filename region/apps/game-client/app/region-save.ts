/** Active checkpoint, three library slots and Hardcore receipts share one atomic localStorage write.
 * Optional library data extends region-save-1; raw region-2 and old envelopes remain readable.
 * Slots survive leaving a campaign. Hardcore receipts survive slot deletion (ordinary UI protection,
 * not anti-cheat). Export is a backup only; importing arbitrary states is deliberately unsupported.
 */
import type { RegionState } from '../../../packages/gameplay/src/region/types';
import { SAVE_KEY_REGION } from '../../../packages/gameplay/src/region/rules';
import { campaignFingerprint, campaignFor } from '../../../packages/gameplay/src/region/campaign';
export type RegionSaveStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Receipt = { campaignId: string; sequence: number; fingerprint: string; stateHash: string; difficulty?: string };
export interface RegionSaveSlot { id: number; name: string; savedAt: string; state: RegionState }
type Library = { slots: RegionSaveSlot[]; hardcore: Receipt[] };
interface SaveEnvelope { schema: 'region-save-1'; state: RegionState | null; highWater: Receipt | null; library?: Library }
export class RegionSaveError extends Error {
  constructor(message: string, public code: 'unavailable' | 'invalid' | 'rewind' | 'write' | 'full' | 'confirm') { super(message); this.name = 'RegionSaveError'; }
}
function browserStorage(): RegionSaveStorage {
  try { if (!globalThis.localStorage) throw new Error(); return globalThis.localStorage; }
  catch { throw new RegionSaveError('Nettleseren tillater ikke lokal lagring.', 'unavailable'); }
}
function hash(state: RegionState) { return campaignFingerprint(JSON.stringify(state)); }
function validState(value: unknown): value is RegionState {
  if (!value || typeof value !== 'object') return false;
  const s = value as Partial<RegionState>;
  if (s.schema !== 'region-2' || !Array.isArray(s.survivors) || !s.flags || !s.zones || !Number.isInteger(s.day)) return false;
  const c = s.campaign;
  return !c || (typeof c.id === 'string' && ['story', 'survival', 'realistic'].includes(c.difficulty) && typeof c.hardcore === 'boolean' && Number.isInteger(c.sequence) && c.sequence >= 0 && Array.isArray(c.history) && c.history.length === c.sequence + 1 && c.history.every(item => typeof item === 'string') && c.history[c.sequence] === c.fingerprint);
}
function receipt(state: RegionState): Receipt { const c = campaignFor(state); return { campaignId: c.id, sequence: c.sequence, fingerprint: c.fingerprint, stateHash: hash(state), difficulty: c.difficulty }; }
function matches(state: RegionState, r: Receipt) { const c = campaignFor(state); return r.campaignId === c.id && r.sequence === c.sequence && r.fingerprint === c.fingerprint && r.stateHash === hash(state); }
function empty(): SaveEnvelope { return { schema: 'region-save-1', state: null, highWater: null, library: { slots: [], hardcore: [] } }; }
function invalid(): never { throw new RegionSaveError('Lagringen er skadet eller har ukjent format. Den er ikke overskrevet. Ta vare på nettleserdataene før gjenoppretting.', 'invalid'); }
function read(storage: RegionSaveStorage): SaveEnvelope {
  let raw: string | null;
  try { raw = storage.getItem(SAVE_KEY_REGION); } catch { throw new RegionSaveError('Lagringen kunne ikke leses.', 'unavailable'); }
  if (!raw) return empty();
  let value: unknown; try { value = JSON.parse(raw); } catch { return invalid(); }
  if (validState(value)) { const e = { ...empty(), state: value, highWater: receipt(value) }; remember(value, e); return e; }
  const e = value as SaveEnvelope | null;
  if (!e || e.schema !== 'region-save-1' || (e.state !== null && (!validState(e.state) || !e.highWater || !matches(e.state, e.highWater)))) return invalid();
  const library = e.library ?? { slots: [], hardcore: [] };
  if (!Array.isArray(library.slots) || library.slots.length > 3 || !Array.isArray(library.hardcore) || new Set(library.slots.map(s => s?.id)).size !== library.slots.length) return invalid();
  if (library.slots.some(s => !s || !Number.isInteger(s.id) || s.id < 0 || s.id > 2 || typeof s.name !== 'string' || typeof s.savedAt !== 'string' || !validState(s.state))) return invalid();
  if (library.hardcore.some(r => !r || typeof r.campaignId !== 'string' || !Number.isInteger(r.sequence) || r.sequence < 0 || typeof r.fingerprint !== 'string' || typeof r.stateHash !== 'string')) return invalid();
  e.library = library;
  if (e.state && campaignFor(e.state).hardcore && !library.hardcore.some(r => r.campaignId === campaignFor(e.state!).id)) library.hardcore.push(receipt(e.state));
  for (const slot of library.slots) checkHardcore(slot.state, e);
  return e;
}
function write(e: SaveEnvelope, storage: RegionSaveStorage) {
  try { storage.setItem(SAVE_KEY_REGION, JSON.stringify(e)); }
  catch { throw new RegionSaveError('Lagringen mislyktes. Nettleseren kan være full eller blokkere lagring. Forrige kontrollpunkt og alle lagringsplasser er beholdt.', 'write'); }
}
function checkHardcore(state: RegionState, e: SaveEnvelope) {
  const c = campaignFor(state), before = e.library!.hardcore.find(r => r.campaignId === c.id);
  if (before && (!c.hardcore || (before.difficulty && before.difficulty !== c.difficulty) || c.sequence < before.sequence || c.history[before.sequence] !== before.fingerprint || (c.sequence === before.sequence && hash(state) !== before.stateHash))) throw new RegionSaveError('Hardcore tillater bare siste kontrollpunkt, uten omvalg eller endring av vanskelighetsgrad.', 'rewind');
}
function remember(state: RegionState, e: SaveEnvelope) {
  if (!campaignFor(state).hardcore) return;
  const list = e.library!.hardcore, index = list.findIndex(r => r.campaignId === campaignFor(state).id);
  if (index < 0) list.push(receipt(state)); else list[index] = receipt(state);
  for (const slot of e.library!.slots) if (campaignFor(slot.state).id === campaignFor(state).id) { slot.state = state; slot.savedAt = new Date().toISOString(); }
}
function archive(state: RegionState, e: SaveEnvelope) {
  const slots = e.library!.slots, c = campaignFor(state);
  const existing = slots.find(s => c.hardcore ? campaignFor(s.state).id === c.id : hash(s.state) === hash(state));
  if (existing) { existing.state = state; existing.savedAt = new Date().toISOString(); return; }
  const id = [0, 1, 2].find(i => !slots.some(s => s.id === i));
  if (id === undefined) throw new RegionSaveError('Alle tre lagringsplasser er fulle. Eksporter eller slett en plass i Gjennomspillinger før du bytter eller starter på nytt.', 'full');
  slots.push({ id, name: `Gjennomspilling ${id + 1}`, savedAt: new Date().toISOString(), state });
}
export function loadRegionSave(storage: RegionSaveStorage = browserStorage()): RegionState | null { return read(storage).state; }
/** Persist before accepting UI state. replace authorizes switching, never bypasses a run's HC receipt. */
export function saveRegionState(state: RegionState, options: { replace?: boolean; storage?: RegionSaveStorage } = {}) {
  const storage = options.storage ?? browserStorage(), e = read(storage);
  if (!validState(state)) throw new RegionSaveError('Spilltilstanden kan ikke lagres.', 'invalid');
  checkHardcore(state, e);
  if (e.state && campaignFor(e.state).id !== campaignFor(state).id) {
    if (!options.replace && campaignFor(e.state).hardcore) throw new RegionSaveError('Hardcore krever et eksplisitt bytte av gjennomspilling.', 'rewind');
    archive(e.state, e);
  }
  remember(state, e); e.state = state; e.highWater = receipt(state); write(e, storage);
}
/** Leaving the active campaign archives it atomically. Corrupt data requires explicit recovery elsewhere. */
export function clearRegionSave(storage: RegionSaveStorage = browserStorage()) {
  const e = read(storage); if (e.state) archive(e.state, e);
  e.state = null; e.highWater = null; write(e, storage);
}
export function listRegionSaves(storage: RegionSaveStorage = browserStorage()): RegionSaveSlot[] { return read(storage).library!.slots.sort((a, b) => a.id - b.id); }
export function saveRegionSlot(id: number, name: string, state: RegionState, options: { replace?: boolean; storage?: RegionSaveStorage } = {}) {
  const storage = options.storage ?? browserStorage(), e = read(storage);
  if (![0, 1, 2].includes(id) || !validState(state) || !name.trim()) throw new RegionSaveError('Velg en gyldig plass og et navn.', 'invalid');
  checkHardcore(state, e);
  const slots = e.library!.slots, index = slots.findIndex(s => s.id === id);
  if (index >= 0 && !options.replace) throw new RegionSaveError('Bekreft at den valgte lagringen skal erstattes.', 'confirm');
  if (campaignFor(state).hardcore && slots.some(s => s.id !== id && campaignFor(s.state).id === campaignFor(state).id)) throw new RegionSaveError('Hardcore har bare én plass per gjennomspilling. Bruk den eksisterende plassen.', 'rewind');
  if (campaignFor(state).hardcore && (!e.state || hash(e.state) !== hash(state))) throw new RegionSaveError('Lagre Hardcore fra det aktive, siste kontrollpunktet.', 'rewind');
  remember(state, e);
  const slot = { id, name: name.trim().slice(0, 48), savedAt: new Date().toISOString(), state };
  if (index < 0) slots.push(slot); else slots[index] = slot;
  write(e, storage);
}
/** Switch only after successful atomic persistence; caller then accepts returned state without re-saving. */
export function loadRegionSlot(id: number, storage: RegionSaveStorage = browserStorage()): RegionState {
  const e = read(storage), slot = e.library!.slots.find(s => s.id === id);
  if (!slot) throw new RegionSaveError('Lagringsplassen er tom.', 'invalid');
  const state = slot.state; checkHardcore(state, e);
  if (e.state && hash(e.state) !== hash(state)) {
    // Same-run normal snapshots deliberately rewind; another run must first be preserved.
    if (campaignFor(e.state).id !== campaignFor(state).id) archive(e.state, e);
  }
  e.state = state; e.highWater = receipt(state); write(e, storage); return state;
}
export function deleteRegionSlot(id: number, storage: RegionSaveStorage = browserStorage()) {
  const e = read(storage); e.library!.slots = e.library!.slots.filter(s => s.id !== id); write(e, storage);
}
export function exportRegionSlot(id: number, storage: RegionSaveStorage = browserStorage()): string {
  const s = read(storage).library!.slots.find(slot => slot.id === id);
  if (!s) throw new RegionSaveError('Lagringsplassen er tom.', 'invalid');
  return JSON.stringify(s.state, null, 2);
}
