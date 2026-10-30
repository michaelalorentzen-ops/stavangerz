import { describe, expect, it } from 'vitest';
import { CARDS, mods, newGame } from '../src/engine';
import type { TaskType } from '../src/engine';
import { fxText } from '../src/ui/cards';
import { blockerLabel, changesHtml, infBar, isBadChange, phaseDeadline, previewHtml, statPips, TASK_HELP } from '../src/ui/panel';
import { BOT_SELF } from '../tools/bot';

const fresh = () => newGame(42, BOT_SELF, ['arild', 'mona', 'toregil']);

describe('panelet', () => {
  it('infeksjonsstolpen røper ikke det sanne tallet for usette sektorer', () => {
    expect(infBar({ z: 0, seen: false }, 10)).toBe(0);
    expect(infBar({ z: 3, seen: false }, 10)).toBeNull();
    expect(infBar({ z: 9, seen: false }, 10)).toBeNull();
    expect(infBar({ z: 5, seen: true }, 10)).toBe(50);
    expect(infBar({ z: 30, seen: true }, 10)).toBe(100);
  });

  it('Avslutt dag-knappen bruker samme ordlyd som dagsrapporten for det som venter', () => {
    const s = fresh();
    expect(blockerLabel(s)).toBeNull();
    s.needLeader = true;
    expect(blockerLabel(s)).toBe('Hvem tar over?');
    s.tokts.push({ id: 'bybrua', crew: ['meg'], stage: 1, haul: {}, cards: [], awaiting: true });
    expect(blockerLabel(s)).toBe('Toktet venter på deg');
    s.pending.push({ pid: 'p1', def: 'sprint', sector: 'obs', crew: ['arild'], threat: 2 });
    expect(blockerLabel(s)).toBe('Knipe venter');
    s.pending.push({ pid: 'p2', def: 'sprint', sector: 'obs', crew: ['mona'], threat: 2 });
    expect(blockerLabel(s)).toBe('2 kniper venter');
    s.over = 'dead';
    expect(blockerLabel(s)).toBeNull();
  });

  it('fristlinjen sier hva som skjer ved fristen for hver grad', () => {
    const t = (difficulty: 'normal' | 'hard' | 'brutal') => { const s = fresh(); s.difficulty = difficulty; return phaseDeadline(s)!.onExpiry; };
    expect(t('normal')).toContain('går dere videre likevel');
    expect(t('normal')).toContain('synker 15');
    expect(t('hard')).toContain('synker 30');
    expect(t('brutal')).toContain('er runden tapt');
  });

  it('fristen sier «Frist for fasemålet» før målet er nådd, og nedtellingen til neste fase etter', () => {
    const s = fresh(), cap = mods(s).turnCap;
    s.day = 11;
    expect(phaseDeadline(s)).toMatchObject({ label: 'Frist for fasemålet', days: cap - 10, goalReached: false });
    s.goalDay = 9;
    // graceDays fra målet ble nådd: 10 − (11 − 9)
    expect(phaseDeadline(s)).toMatchObject({ label: 'Fase 2 om', days: mods(s).graceDays - 2, goalReached: true });
    s.day = s.phaseStartDay + cap + 3;
    expect(phaseDeadline(s)?.days).toBe(0);
    s.over = 'won';
    expect(phaseDeadline(s)).toBeNull();
  });

  it('hver oppgavetype har en forklaring', () => {
    const types: TaskType[] = ['rydde', 'sanke', 'speide', 'vakt', 'befeste', 'lage', 'trene', 'pleie', 'overlevende', 'hvile', 'tokt'];
    for (const t of types) expect(TASK_HELP[t].length, t).toBeGreaterThan(20);
    expect(TASK_HELP.sanke).toContain('uten synlige zombier');
  });

  it('endringer med minus, skade, død eller slitasje er negative', () => {
    expect(isBadChange('−2 mat')).toBe(true);
    expect(isBadChange('Arild ble skadet')).toBe(true);
    expect(isBadChange('Mona døde')).toBe(true);
    expect(isBadChange('utstyret slites')).toBe(true);
    expect(isBadChange('+3 mat')).toBe(false);
    expect(changesHtml(['+3 mat', '−1 moral'])).toBe('<div class="pv"><i class="good">+3 mat</i><i class="bad">−1 moral</i></div>');
    expect(changesHtml([])).toBe('');
  });

  it('forhåndsvisningen viser «Feiler:» bare når det finnes en feil-gren', () => {
    expect(previewHtml({ ok: ['+3 mat'], fail: null })).not.toContain('Feiler');
    const both = previewHtml({ ok: ['+3 mat'], fail: ['opptil −4 mat', 'kan gi skade'] });
    expect(both).toContain('<i class="good">+3 mat</i>');
    expect(both).toContain('Feiler:</b><i class="bad">opptil −4 mat</i><i class="bad">kan gi skade</i>');
    // en ok-linje som varsler om skade er ikke grønn
    expect(previewHtml({ ok: ['kan gi skade'], fail: null })).toContain('class="bad"');
    expect(previewHtml({ ok: [], fail: null })).toBe('');
  });

  it('utstyr beskrives med ferdighetsforkortelser og effekt', () => {
    const weapon = Object.values(CARDS).find((d) => d.slot === 'vapen' && d.level === 2 && !d.bonus)!;
    expect(fxText(weapon)).toBe('+6 MUS +4 PRA · Kampkraft ×1,2');
  });

  it('ferdighetsstolpen viser bonusen som en grønn forlengelse med tallet i tooltipen', () => {
    const st = { muskler: 40, kondis: 30, snoking: 30, nerver: 30, mekk: 30, prat: 30 };
    expect(statPips(st)).not.toContain('plus');
    const html = statPips(st, { muskler: 6 });
    expect(html).toContain('class="plus" style="width:6%"');
    expect(html).toContain('40 + 6');
  });
});
