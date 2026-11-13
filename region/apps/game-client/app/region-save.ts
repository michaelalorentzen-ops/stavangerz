/** One atomic local save: state and its Hardcore high-water receipt cannot tear apart. */
import type { RegionState } from '../../../packages/gameplay/src/region/types';
import { SAVE_KEY_REGION } from '../../../packages/gameplay/src/region/rules';
import { campaignFingerprint, campaignFor } from '../../../packages/gameplay/src/region/campaign';

export type RegionSaveStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
interface SaveEnvelope {
  schema: 'region-save-1'; state: RegionState;
  highWater: { campaignId: string; sequence: number; fingerprint: string; stateHash: string };
}
export class RegionSaveError extends Error {
  constructor(message: string, public code: 'unavailable' | 'invalid' | 'rewind' | 'write') { super(message); this.name = 'RegionSaveError'; }
}
function browserStorage(): RegionSaveStorage {
  try { return globalThis.localStorage; } catch { throw new RegionSaveError('Nettleseren tillater ikke lokal lagring. Gjennomspillingen er ikke lagret.', 'unavailable'); }
}
function stateHash(state: RegionState) { return campaignFingerprint(JSON.stringify(state)); }
function validState(value: unknown): value is RegionState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<RegionState>;
  return state.schema === 'region-2' && Array.isArray(state.survivors) && !!state.flags && !!state.zones && Number.isInteger(state.day);
}
function read(storage: RegionSaveStorage): { state: RegionState; envelope?: SaveEnvelope } | null {
  let raw: string | null;
  try { raw = storage.getItem(SAVE_KEY_REGION); } catch { throw new RegionSaveError('Lagringen kunne ikke leses fra nettleseren.', 'unavailable'); }
  if (!raw) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new RegionSaveError('Den lokale lagringen er skadet. Den er ikke overskrevet.', 'invalid'); }
  // Existing region-2 saves retain Survival/normal semantics without a migration.
  if (validState(value)) return { state: value };
  const envelope = value as Partial<SaveEnvelope> | null;
  if (envelope?.schema !== 'region-save-1' || !validState(envelope.state) || !envelope.highWater) throw new RegionSaveError('Ukjent lagringsformat. Den lokale lagringen er ikke overskrevet.', 'invalid');
  const campaign = campaignFor(envelope.state);
  const receipt = envelope.highWater;
  if (receipt.campaignId !== campaign.id || receipt.sequence !== campaign.sequence || receipt.fingerprint !== campaign.fingerprint || receipt.stateHash !== stateHash(envelope.state)) {
    throw new RegionSaveError('Lagringen og kontrollpunktet stemmer ikke overens. Ingen tidligere tilstand er lastet.', 'invalid');
  }
  return { state: envelope.state, envelope: envelope as SaveEnvelope };
}
export function loadRegionSave(storage: RegionSaveStorage = browserStorage()): RegionState | null {
  return read(storage)?.state ?? null;
}
/** Save BEFORE accepting a UI transition. A rejected/quota-failed write leaves the old save intact. */
export function saveRegionState(state: RegionState, options: { replace?: boolean; storage?: RegionSaveStorage } = {}): void {
  const storage = options.storage ?? browserStorage();
  if (!validState(state)) throw new RegionSaveError('Spilltilstanden kan ikke lagres.', 'invalid');
  const campaign = campaignFor(state);
  if (campaign.history.length !== campaign.sequence + 1 || campaign.history[campaign.sequence] !== campaign.fingerprint) throw new RegionSaveError('Kampanjens valghistorikk er ugyldig.', 'invalid');
  const previous = options.replace ? null : read(storage);
  if (previous && campaignFor(previous.state).hardcore) {
    const before = campaignFor(previous.state);
    if (campaign.id !== before.id || !campaign.hardcore || campaign.difficulty !== before.difficulty) throw new RegionSaveError('En Hardcore-gjennomspilling kan bare erstattes ved å starte en ny gjennomspilling eksplisitt.', 'rewind');
    if (campaign.sequence < before.sequence || campaign.history[before.sequence] !== before.fingerprint
      || (campaign.sequence === before.sequence && stateHash(state) !== stateHash(previous.state))) {
      throw new RegionSaveError('Hardcore tillater ikke å gå tilbake til et tidligere eller annet valg. Det siste lagrede kontrollpunktet beholdes.', 'rewind');
    }
  }
  const envelope: SaveEnvelope = { schema: 'region-save-1', state,
    highWater: { campaignId: campaign.id, sequence: campaign.sequence, fingerprint: campaign.fingerprint, stateHash: stateHash(state) } };
  try { storage.setItem(SAVE_KEY_REGION, JSON.stringify(envelope)); }
  catch { throw new RegionSaveError('Kontrollpunktet kunne ikke lagres. Frigjør lagringsplass eller tillat lokal lagring før du fortsetter.', 'write'); }
}
/** Explicitly abandoning a run, after the UI's confirmation, also abandons its high-water mark. */
export function clearRegionSave(storage: RegionSaveStorage = browserStorage()): void {
  try { storage.removeItem(SAVE_KEY_REGION); } catch { throw new RegionSaveError('Den lokale lagringen kunne ikke slettes.', 'write'); }
}
