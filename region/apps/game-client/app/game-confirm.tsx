'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Archive, AlertTriangle } from 'lucide-react';
import './game-confirm.css';

export interface GameConfirmProps {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'normal' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}
/** Mount only while a decision is pending. The native top layer keeps focus in the game. */
export function GameConfirm({ title, message, confirmLabel = 'Fortsett', cancelLabel = 'Avbryt', tone = 'normal', onConfirm, onCancel }: GameConfirmProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId(), messageId = useId();
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  const Icon = tone === 'warning' ? AlertTriangle : Archive;
  return <dialog ref={dialog} className={`game-confirm game-confirm-${tone}`} aria-labelledby={titleId} aria-describedby={messageId}
    onCancel={event => { event.preventDefault(); onCancel(); }}>
    <div className="game-confirm-heading"><Icon size={26} aria-hidden="true"/><span>GJENNOMSPILLING</span></div>
    <h2 id={titleId}>{title}</h2>
    <div id={messageId} className="game-confirm-message">{message}</div>
    <div className="game-confirm-actions"><button type="button" autoFocus onClick={onCancel}>{cancelLabel}</button><button type="button" className="game-confirm-primary" onClick={onConfirm}>{confirmLabel}</button></div>
  </dialog>;
}
