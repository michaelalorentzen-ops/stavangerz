import { describe, expect, it } from 'vitest';
import { CARDS, mods, newGame } from '../src/engine';
import type { TaskType } from '../src/engine';
import { fxText } from '../src/ui/cards';
import { blockerLabel, changesHtml, infBar, isBadChange, phaseDeadline, previewHtml, statPips, TASK_HELP, vaguePreviewHtml } from '../src/ui/panel';
import { oddsWord, vagueLine, vaguePreview } from '../src/ui/vague';
import { summarizeDay, summaryHtml } from '../src/ui/report';
import { avatar } from '../src/ui/avatar';
import { BOT_SELF } from '../tools/bot';

const fresh = () => newGame(42, BOT_SELF, ['arild', 'mona', 'toregil']);
/** Fjerner ikonene, så testene kan sammenligne teksten i chipsene. */
const noIc = (h: string) => h.replace(/<svg[\s\S]*?<\/svg>/g, '');

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
    expect(noIc(changesHtml(['+3 mat', '−1 moral']))).toBe('<div class="pv"><i class="good">+3 mat</i><i class="bad">−1 moral</i></div>');
    expect(changesHtml([])).toBe('');
  });

  it('forhåndsvisningen viser «Feiler:» bare når det finnes en feil-gren', () => {
    expect(previewHtml({ ok: ['+3 mat'], fail: null })).not.toContain('Feiler');
    const both = noIc(previewHtml({ ok: ['+3 mat'], fail: ['opptil −4 mat', 'kan gi skade'] }));
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

describe('midt imellom: forhåndsvisning uten tall', () => {
  it('sjansen står i ord', () => {
    expect(oddsWord(0.85)).toBe('god sjanse');
    expect(oddsWord(0.7)).toBe('god sjanse');
    expect(oddsWord(0.55)).toBe('usikkert');
    expect(oddsWord(0.4)).toBe('usikkert');
    expect(oddsWord(0.39)).toBe('dårlig sjanse');
  });

  it('sikre utfall sier hva som skjer, uten «kan»', () => {
    expect(vagueLine('+1 medisin')).toEqual({ text: 'gir medisin', bad: false, res: 'medisin', sure: true, dir: 'up', icon: 'medisin' });
    expect(vagueLine('+1–3 skrap')).toMatchObject({ text: 'gir skrap', bad: false });
    expect(vagueLine('−2 mat')).toEqual({ text: 'koster mat', bad: true, res: 'mat', sure: true, dir: 'down', icon: 'mat' });
    expect(vagueLine('−1–3 vann')).toMatchObject({ text: 'koster vann', bad: true });
    expect(vagueLine('+2 zombier')).toMatchObject({ text: 'trekker til zombier', bad: true });
    expect(vagueLine('+1 zombie')).toMatchObject({ text: 'trekker til zombier', bad: true });
    expect(vagueLine('−3 zombier')).toMatchObject({ text: 'fjerner zombier', bad: false });
    expect(vagueLine('+4 kontroll')).toMatchObject({ text: 'gir kontroll', bad: false });
    expect(vagueLine('+1 sektor speidet')).toMatchObject({ text: 'speider en sektor', bad: false });
    expect(vagueLine('skade')).toMatchObject({ text: 'noen blir skadet', bad: true });
    expect(vagueLine('noen dør')).toMatchObject({ text: 'noen dør', bad: true });
    expect(vagueLine('ny i crewet')).toMatchObject({ text: 'noen blir med', bad: false });
    expect(vagueLine('nytt utstyr')).toMatchObject({ text: 'gir utstyr', bad: false });
    expect(vagueLine('utstyret slites')).toMatchObject({ bad: true });
  });

  it('«kan» står bare der utfallet er usikkert innenfor grenen', () => {
    expect(vagueLine('opptil −2 mat')).toEqual({ text: 'kan koste mat', bad: true, res: 'mat', sure: false, dir: 'down', icon: 'mat' });
    expect(vagueLine('opptil +3 skrap')).toMatchObject({ text: 'kan gi skrap', bad: false });
    expect(vagueLine('opptil +2 zombier')).toMatchObject({ text: 'kan trekke til zombier', bad: true });
    expect(vagueLine('opptil −2 zombier')).toMatchObject({ text: 'kan fjerne zombier', bad: false });
    expect(vagueLine('−2 til +3 moral')).toMatchObject({ text: 'kan gi eller koste moral', bad: true, sure: false, dir: 'mix', icon: 'moral' });
    expect(vagueLine('kan gi skade')).toMatchObject({ text: 'kan gi skade', bad: true });
    expect(vagueLine('kan koste et liv')).toMatchObject({ text: 'kan koste et liv', bad: true });
    expect(vagueLine('kan slite utstyr')).toMatchObject({ bad: true });
  });

  it('ingen tall slipper gjennom, og like linjer slås sammen', () => {
    const v = vaguePreview({ ok: ['+1 mat', '+2 mat', '+4 kontroll'], fail: ['opptil −4 mat', 'kan gi skade'] });
    expect(v.ok.map((l) => l.text)).toEqual(['gir mat', 'gir kontroll']);
    expect(v.fail!.map((l) => l.text)).toEqual(['kan koste mat', 'kan gi skade']);
    const html = vaguePreviewHtml({ ok: ['+3 mat', '−1 moral'], fail: ['opptil −4 vann'] });
    expect(noIc(html)).not.toMatch(/\d/);
    expect(html).toContain('ic-mat');
  });

  it('alt som kan dukke opp har et ikon', () => {
    const lines = ['+1 mat', '+2 moral', 'skade', 'kan gi skade', 'noen dør', 'kan koste et liv', '+2 zombier', '−1 zombier', 'nytt utstyr',
      'kan gi utstyr', 'utstyret slites', 'ny i crewet', 'kan gi ny i crewet', 'noen er borte for godt', '+1 sektor speidet', '+2 gjennomsøkt',
      '+3 kontroll', 'nytt oppdrag'];
    for (const l of lines) expect(vagueLine(l).icon, l).not.toBe('');
    expect(vagueLine('kan gi skade')).toMatchObject({ icon: 'skadet', sure: false, dir: 'down' });
    expect(vagueLine('+1 sektor speidet')).toMatchObject({ icon: 'speid', sure: true, dir: 'up' });
  });

  it('kortet viser ikoner med retning, ordene bare i title og aria-label', () => {
    const html = vaguePreviewHtml({ ok: ['+3 mat', 'opptil −2 vann'], fail: null });
    expect(html).toContain('aria-label="gir mat"');
    expect(html).toContain('title="kan koste vann"');
    expect(html).toContain('▲');
    expect(html).toContain('▼');
    // ordene står ikke som synlig tekst, bare i attributter
    expect(html.replace(/<[^>]*>/g, '')).not.toMatch(/gir|kan|mat|vann/);
    // det usikre er stiplet og har «?», det sikre ikke
    expect(html).toMatch(/class="pvi up"[^>]*aria-label="gir mat"/);
    expect(html).toMatch(/class="pvi down maybe"[^>]*aria-label="kan koste vann"/);
    expect(html).not.toContain('pv-k');
  });

  it('med sjekk deles raden i lykkes og feiler', () => {
    const html = vaguePreviewHtml({ ok: ['+3 mat'], fail: ['−1 moral'] });
    expect(html).toMatch(/pv-g ok.*✓.*gir mat.*pv-g fail.*✗.*koster moral/s);
    expect(html).toContain('aria-label="Lykkes:"');
    expect(html).toContain('aria-label="Feiler:"');
    // en tom gren står som «ingenting», så ✗ aldri står alene
    const empty = vaguePreviewHtml({ ok: [], fail: ['−4 mat'] });
    expect(empty).toMatch(/pv-g ok.*✓.*ingenting.*pv-g fail.*✗.*koster mat/s);
  });

  it('fritekst uten ikon vises som kort tekst', () => {
    const html = vaguePreviewHtml({ ok: ['noe helt annet'], fail: null });
    expect(html).toContain('class="pvi up txt"');
    expect(html.replace(/<[^>]*>/g, '')).toContain('noe helt annet');
  });
});

describe('dagsrapporten i ikoner', () => {
  it('regner ut gevinst, tap og folk fra tilstanden før og etter', () => {
    const a = fresh(), b = structuredClone(a);
    b.res.mat -= 3; b.res.vann += 2; b.stats.kills += 4;
    b.crew[1].hp = 1;
    b.crew = b.crew.filter((c) => c.id !== a.crew[2].id);
    const lines = [{ t: 'Natt: 2 zombier kom forbi porten og står nå et sted.', kind: 'bad' as const }];
    const s = summarizeDay(a, b, lines);
    expect(s.res).toEqual({ mat: -3, vann: 2 });
    expect(s.kills).toBe(4);
    expect(s.breach).toBe(2);
    expect(s.hurt.map((p) => p.id)).toEqual([a.crew[1].id]);
    expect(s.lost.map((p) => p.id)).toEqual([a.crew[2].id]);
    const html = summaryHtml(s);
    expect(html).toContain('class="sx down"');
    expect(html).toContain('−3');
    expect(html).toContain('hardt skadet');
    expect(summaryHtml(summarizeDay(a, structuredClone(a), []))).toBe('');
  });

  it('portrettene er faste for samme person', () => {
    expect(avatar({ id: 'mona', name: 'Mona' })).toBe(avatar({ id: 'mona', name: 'Mona' }));
    expect(avatar({ id: 'mona', name: 'Mona' })).not.toBe(avatar({ id: 'arild', name: 'Arild' }));
    expect(avatar({ id: 'mona', name: 'Mona', hp: 1 })).toContain('av-h1');
  });
});
