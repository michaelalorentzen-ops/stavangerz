'use client';
import { useEffect, useId, useRef, useState } from 'react';
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
  const [confirm, setConfirm] = useState<{ text: string; action?: () => void; loadId?: number; preserveOption?: boolean } | null>(null);
  const [preserveCurrent, setPreserveCurrent] = useState(true);
  const preserveId = useId();
  const [names, setNames] = useState<Record<number, string>>({});
  const dialog = useRef<HTMLDialogElement>(null);
  const refresh = () => setSlots(listRegionSaves());
  const run = (action: () => void) => { try { action(); refresh(); setError(''); } catch (e) { setError((e as Error).message); } };
  useEffect(() => { const d = dialog.current; d?.showModal(); run(refresh); return () => d?.close(); }, []); // Storage is read only when mounted or changed by the player.
  const ask = (text: string, action: () => void) => setConfirm({ text, action });
  const askLoad = (slot: RegionSaveSlot) => {
    const sameRun = !!current && campaignFor(current).id === campaignFor(slot.state).id;
    const replacesCurrent = !!current && JSON.stringify(current) !== JSON.stringify(slot.state);
    const normalRewind = sameRun && replacesCurrent && !campaignFor(slot.state).hardcore;
    setPreserveCurrent(true);
    setConfirm({ loadId: slot.id, preserveOption: normalRewind,
      text: normalRewind
        ? `Last «${slot.name}» fra dag ${slot.state.day}? Nåværende fremgang fra dag ${current!.day} i denne gjennomspillingen blir erstattet. Uten en lagret kopi forsvinner dag ${current!.day}-fremgangen.`
        : `Last «${slot.name}» fra dag ${slot.state.day}?${replacesCurrent ? ' Den andre aktive gjennomspillingen bevares først på en ledig plass.' : ' Det aktive kontrollpunktet blir denne lagringen.'}` });
  };
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
          <button disabled={!slot} onClick={() => askLoad(slot!)}><FolderOpen size={16}/> Last</button>
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
    {confirm && <div className="campaign-library-confirm" role="alertdialog" aria-label="Bekreft lagringsendring" aria-modal="true"><p>{confirm.text}</p>{confirm.preserveOption && <label className="campaign-library-preserve" htmlFor={preserveId}><input id={preserveId} type="checkbox" checked={preserveCurrent} onChange={event => setPreserveCurrent(event.target.checked)}/><span>Lagre nåværende på ledig plass først<small>{slots.length < 3 ? 'Kopien og byttet lagres samlet.' : 'Alle plassene er fulle. Frigjør en plass først, eller velg uttrykkelig å laste uten kopi.'}</small></span></label>}{confirm.preserveOption && !preserveCurrent && <p className="campaign-library-discard" role="status">Nåværende fremgang blir erstattet uten å lage en ny kopi.</p>}<div><button autoFocus onClick={() => setConfirm(null)}>Avbryt</button><button onClick={() => {
      const pending = confirm; setConfirm(null);
      run(() => { if (pending.loadId !== undefined) { const state = loadRegionSlot(pending.loadId, undefined, { preserveCurrent: !!pending.preserveOption && preserveCurrent }); onLoad(state); onClose(); } else pending.action?.(); });
    }}>Bekreft</button></div></div>}
  </dialog>;
}
