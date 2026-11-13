'use client';
import { useEffect, useRef, useState } from 'react';
import { Archive, Download, FolderOpen, Save, Shield, Trash2, X } from 'lucide-react';
import type { RegionState } from '../../../packages/gameplay/src/region/types';
import { campaignFor } from '../../../packages/gameplay/src/region/campaign';
import { deleteRegionSlot, exportRegionSlot, listRegionSaves, loadRegionSlot, saveRegionSlot, type RegionSaveSlot } from './region-save';
import './campaign-library.css';
export interface CampaignLibraryProps {
  current?: RegionState | null;
  /** State is already persisted: set UI state directly, do not create a new campaign. */
  onLoad: (state: RegionState) => void;
  onClose: () => void;
}
export function CampaignLibrary({ current, onLoad, onClose }: CampaignLibraryProps) {
  const [slots, setSlots] = useState<RegionSaveSlot[]>([]), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState<{ text: string; action: () => void } | null>(null);
  const [names, setNames] = useState<Record<number, string>>({});
  const dialog = useRef<HTMLDialogElement>(null);
  const refresh = () => setSlots(listRegionSaves());
  const run = (action: () => void) => { try { action(); refresh(); setError(''); } catch (e) { setError((e as Error).message); } };
  useEffect(() => { const d = dialog.current; d?.showModal(); run(refresh); return () => d?.close(); }, []); // Storage is read only when mounted or changed by the player.
  const ask = (text: string, action: () => void) => setConfirm({ text, action });
  const download = (slot: RegionSaveSlot) => {
    const url = URL.createObjectURL(new Blob([exportRegionSlot(slot.id)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `stavangerz-${slot.name.replace(/[^\p{L}\p{N}-]/gu, '-')}-dag-${slot.state.day}.json`; a.click(); URL.revokeObjectURL(url);
    setNotice('Sikkerhetskopien er eksportert.');
  };
  return <dialog ref={dialog} className="campaign-library" aria-labelledby="campaign-library-title" onCancel={event => { if (confirm) { event.preventDefault(); setConfirm(null); } else onClose(); }}>
    <div inert={!!confirm}><header><div><Archive size={23}/><h2 id="campaign-library-title">Gjennomspillinger</h2></div><button aria-label="Lukk gjennomspillinger" onClick={onClose}><X/></button></header>
    <p className="campaign-library-help">Tre navngitte plasser. Aktiv gjennomspilling lagres automatisk ved hvert valg. Hardcore beholder alltid siste kontrollpunkt.</p>
    {error && <p className="campaign-library-error" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <div className="campaign-library-slots">{[0, 1, 2].map(id => {
      const slot = slots.find(s => s.id === id), c = slot && campaignFor(slot.state);
      return <article key={id} aria-label={`Lagringsplass ${id + 1}`}>
        <label htmlFor={`campaign-slot-${id}`}>PLASS {id + 1}{c?.hardcore && <span><Shield size={13}/> Hardcore</span>}</label>
        <input id={`campaign-slot-${id}`} maxLength={48} placeholder={`Gjennomspilling ${id + 1}`} value={names[id] ?? slot?.name ?? ''} onChange={e => setNames({ ...names, [id]: e.target.value })}/>
        <div className="campaign-library-meta">{slot ? <><strong>Dag {slot.state.day} · Fase {slot.state.phase}</strong><span>{c?.difficulty} · {new Date(slot.savedAt).toLocaleString('nb-NO')}</span></> : <span>Tom lagringsplass</span>}</div>
        <div className="campaign-library-actions">
          <button disabled={!slot} onClick={() => ask('Last denne lagringen? En annen aktiv gjennomspilling bevares på en ledig plass. Vanlig modus kan gå tilbake til denne dagen.', () => { const state = loadRegionSlot(id); onLoad(state); onClose(); })}><FolderOpen size={16}/> Last</button>
          <button disabled={!current} onClick={() => {
            const save = () => { saveRegionSlot(id, names[id] ?? slot?.name ?? `Gjennomspilling ${id + 1}`, current!, { replace: !!slot }); setNotice('Lagringsplassen er oppdatert.'); };
            if (slot) ask(`Erstatt «${slot.name}»? Den gamle lagringen på denne plassen forsvinner.`, save); else run(save);
          }}><Save size={16}/> Lagre</button>
          <button disabled={!slot} aria-label={`Eksporter plass ${id + 1}`} onClick={() => run(() => download(slot!))}><Download size={16}/></button>
          <button disabled={!slot} aria-label={`Slett plass ${id + 1}`} onClick={() => ask(`Slett «${slot?.name}»? Aktivt kontrollpunkt beholdes. Eksporter først om du vil ha en sikkerhetskopi.`, () => { deleteRegionSlot(id); setNotice('Lagringsplassen er slettet.'); })}><Trash2 size={16}/></button>
        </div>
      </article>;
    })}</div>
    </div>
    {confirm && <div className="campaign-library-confirm" role="alertdialog" aria-label="Bekreft lagringsendring" aria-modal="true"><p>{confirm.text}</p><div><button autoFocus onClick={() => setConfirm(null)}>Avbryt</button><button onClick={() => { const action = confirm.action; setConfirm(null); run(action); }}>Bekreft</button></div></div>}
  </dialog>;
}
