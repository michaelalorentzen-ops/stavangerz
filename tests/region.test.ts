import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { AREA, GATES, LANDMARKS, SECTORS, ZONES } from '../src/engine';

/** Filene der stedsnavn hører hjemme. Alt annet skal slå opp navnet via id. */
const OWNERS = [/src\/regions\/[^/]+\/places\.ts$/];
/** Navn som også er vanlige ord, og som derfor ikke kan søkes etter */
const COMMON = new Set(['Hjemme', 'Skolen', 'Sentrum']);

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : /\.(ts|html|json)$/.test(p) ? [p] : []; });
/** Fjerner kommentarer, så forklaringer i koden kan nevne steder, og spillnavnet «Stavanger Z», som er et produktnavn */
const code = (t: string) => t.replace(/Stavanger Z\b/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, '');

describe('regionpakken er eneste kilde for stedsnavn', () => {
  const names = [
    ...Object.values(SECTORS).flatMap((d) => [d.name, d.short, d.real]),
    ...Object.values(GATES).map((g) => g.name),
    ...Object.values(ZONES).map((z) => z.name),
    AREA.name, AREA.city, AREA.district,
    ...Object.values(LANDMARKS),
  ].filter((n) => !COMMON.has(n));

  it('ingen fil utenfor places.ts skriver et stedsnavn direkte', () => {
    const hits: string[] = [];
    for (const f of [...files('src'), 'index.html'].filter((f) => !OWNERS.some((r) => r.test(f)))) {
      const t = code(readFileSync(f, 'utf8'));
      for (const n of new Set(names)) if (t.includes(n)) hits.push(`${f}: ${n}`);
    }
    expect(hits).toEqual([]);
  });

  it('ingen vanlig streng inneholder ${…}, som bare virker i `backticks`', () => {
    const hits: string[] = [];
    for (const f of files('src').filter((f) => f.endsWith('.ts'))) {
      const sf = ts.createSourceFile(f, readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true);
      const walk = (n: ts.Node): void => {
        if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && n.text.includes('${')) hits.push(`${f}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`);
        ts.forEachChild(n, walk);
      };
      walk(sf);
    }
    expect(hits).toEqual([]);
  });

  it('hver port peker på en sektor som finnes, og hver region har sektoren hjem', () => {
    expect(SECTORS.hjem).toBeDefined();
    for (const g of Object.values(GATES)) {
      expect(SECTORS[g.sector]).toBeDefined();
      for (const id of g.spills ?? []) expect(SECTORS[id]).toBeDefined();
    }
  });
});
