import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ATLAS_BBOX, HQ_TYPES, KEY_PLACE_TYPES, SECTOR_KINDS, SHOP_TYPES,
  type AtlasArea, type AtlasPlace,
} from '../src/regions/stavanger/atlas/atlas';

/** Alle regioner med atlas: src/regions/<region>/atlas/<område>.json */
const regions = readdirSync('src/regions').filter((r) => existsSync(join('src/regions', r, 'atlas')));
const areaFiles = regions.flatMap((r) => readdirSync(join('src/regions', r, 'atlas'))
  .filter((f) => f.endsWith('.json') && !f.endsWith('.config.json'))
  .map((f) => ({ region: r, file: f, path: join('src/regions', r, 'atlas', f) })));
const load = (p: string) => JSON.parse(readFileSync(p, 'utf8')) as AtlasArea;
/** Atlasoppsettet (atlas/atlas.config.json): bbox, dump og alle planlagte områder */
const config = (region: string) => JSON.parse(readFileSync(join('src/regions', region, 'atlas', 'atlas.config.json'), 'utf8'));
/** Områdene i oppsettet, så porter kan peke på områder som ikke er kurert ennå */
const configAreas = (region: string): Set<string> => new Set(Object.keys(config(region).areas ?? {}).filter((k) => !k.startsWith('_')));

const ID = /^[a-z][a-z0-9_]*$/;
const in15 = (n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 5;
const inBbox = (lat: unknown, lon: unknown) => typeof lat === 'number' && typeof lon === 'number'
  && lat >= ATLAS_BBOX[0] && lat <= ATLAS_BBOX[2] && lon >= ATLAS_BBOX[1] && lon <= ATLAS_BBOX[3];
const str = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

/** Feilene i ett sted (sektor, nøkkelsted eller HQ-kandidat) */
function placeErrors(p: AtlasPlace, where: string): string[] {
  const e: string[] = [];
  if (!ID.test(p.id ?? '')) e.push(`${where}: ugyldig id «${p.id}»`);
  for (const k of ['name', 'short', 'at', 'real', 'realAt', 'gives'] as const) if (!str(p[k])) e.push(`${where}: mangler ${k}`);
  if (!SECTOR_KINDS.includes(p.kind)) e.push(`${where}: ugyldig kind «${p.kind}»`);
  if (p.shopType !== undefined) {
    if (!SHOP_TYPES.includes(p.shopType)) e.push(`${where}: ugyldig shopType «${p.shopType}»`);
    else if (p.kind !== 'butikk' && p.kind !== 'industri') e.push(`${where}: shopType krever kind butikk eller industri`);
  }
  if (!in15(p.threat)) e.push(`${where}: threat må være 1–5`);
  if (!inBbox(p.lat, p.lon)) e.push(`${where}: koordinater utenfor atlaset`);
  if (str(p.at) && /^[A-ZÆØÅ]/.test(p.at)) e.push(`${where}: at skal starte med preposisjon («på …», «i …»)`);
  return e;
}

function areaErrors(a: AtlasArea, file: string, known: Set<string>): string[] {
  const e: string[] = [];
  if (a.id !== file.replace(/\.json$/, '')) e.push(`id «${a.id}» er ikke filnavnet`);
  if (!ID.test(a.id ?? '')) e.push(`ugyldig id «${a.id}»`);
  for (const k of ['name', 'at'] as const) if (!str(a[k])) e.push(`mangler ${k}`);
  if (![0, 1, 2, 3].includes(a.ring)) e.push('ring må være 0–3');
  if (!in15(a.phase)) e.push('phase må være 1–5');
  if (!in15(a.density)) e.push('density må være 1–5');
  if (!in15(a.baseThreat)) e.push('baseThreat må være 1–5');
  if (!Array.isArray(a.sectors) || a.sectors.length < 6 || a.sectors.length > 8) e.push(`må ha 6–8 sektorer (har ${a.sectors?.length})`);
  for (const s of a.sectors ?? []) e.push(...placeErrors(s, `sektor ${s.id}`));
  for (const [key, types] of [['keyPlace', KEY_PLACE_TYPES], ['hqCandidate', HQ_TYPES]] as const) {
    const p = a[key];
    if (p === undefined) continue;
    if (Array.isArray(p)) { e.push(`${key} skal være ett sted, ikke en liste`); continue; }
    e.push(...placeErrors(p, key));
    if (!(types as readonly string[]).includes(p.type)) e.push(`${key}: ugyldig type «${p.type}»`);
    if (p.threat < 4) e.push(`${key}: nøkkelsteder og HQ-kandidater har trussel 4–5`);
  }
  if (!Array.isArray(a.gates) || a.gates.length < 1) e.push('må ha minst én port');
  for (const g of a.gates ?? []) {
    if (!str(g.name) || !str(g.real)) e.push(`port ${g.name}: mangler name eller real`);
    if (!Array.isArray(g.between) || g.between.length !== 2 || !g.between.includes(a.id)) e.push(`port ${g.name}: between må være [dette området, et annet]`);
    else for (const b of g.between) if (!known.has(b)) e.push(`port ${g.name}: ukjent område «${b}» (finnes ikke i atlas.config.json)`);
    if (!inBbox(g.lat, g.lon)) e.push(`port ${g.name}: koordinater utenfor atlaset`);
  }
  if (!Array.isArray(a.pois)) e.push('mangler pois');
  for (const p of a.pois ?? []) {
    if (!str(p.name) || !str(p.type)) e.push(`poi ${p.osm}: mangler name eller type`);
    if (!/^(node|way|relation)\/\d+$/.test(p.osm ?? '')) e.push(`poi ${p.name}: osm må være «node/123», «way/123» eller «relation/123»`);
    if (!inBbox(p.lat, p.lon)) e.push(`poi ${p.name}: koordinater utenfor atlaset`);
  }
  if (!Array.isArray(a.sources) || a.sources.length === 0 || !a.sources.every(str)) e.push('mangler sources');
  return e;
}

describe('atlaset', () => {
  it('finnes, og har minst ett kurert område', () => {
    expect(areaFiles.length).toBeGreaterThan(0);
  });

  it.each(areaFiles.map((f) => [`${f.region}/${f.file}`, f] as const))('%s følger skjemaet', (_, f) => {
    expect(areaErrors(load(f.path), f.file, configAreas(f.region))).toEqual([]);
  });

  it('område- og sted-id-er er unike i hver region', () => {
    for (const r of regions) {
      const areas = areaFiles.filter((f) => f.region === r).map((f) => load(f.path));
      const ids = areas.flatMap((a) => [a.id, ...a.sectors.map((s) => s.id), a.keyPlace?.id, a.hqCandidate?.id].filter(Boolean));
      expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
    }
  });

  it('ATLAS_BBOX er den samme som i atlasoppsettet', () => {
    for (const r of regions) expect(config(r).bbox).toEqual([...ATLAS_BBOX]);
  });

  it('hvert kurert område er definert i atlasoppsettet med samme ring og fase', () => {
    for (const f of areaFiles) {
      const a = load(f.path);
      const cfg = config(f.region).areas[a.id];
      expect(cfg, a.id).toBeDefined();
      expect([cfg.ring, cfg.phase], a.id).toEqual([a.ring, a.phase]);
    }
  });
});
