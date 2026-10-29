// Stavanger Z – spillmotor.
// Ren logikk: all tilfeldighet går gjennom state.rng (seedet), så samme
// state + samme ordre gir alltid samme resultat. Det er grunnmuren for
// asynkron multiplayer senere: serveren kan kjøre resolveDay() selv.

const STATS = ['muskler', 'kondis', 'snoking', 'nerver', 'mekk', 'prat'];
const STAT_LABEL = { muskler: 'Muskler', kondis: 'Kondis', snoking: 'Snoking', nerver: 'Nerver', mekk: 'Mekk', prat: 'Prat' };
const STAT_HINT = {
  muskler: 'Slå hardt, bære mye',
  kondis: 'Løpe fra ting, unngå bitt',
  snoking: 'Finne ting, se kjellere',
  nerver: 'Holde hodet kaldt',
  mekk: 'Bygge, fikse, sveise',
  prat: 'Overtale, rekruttere, handle',
};
const RES = ['mat', 'vann', 'medisin', 'materialer', 'drivstoff'];
const RES_LABEL = { mat: 'Mat', vann: 'Vann', medisin: 'Medisin', materialer: 'Materialer', drivstoff: 'Drivstoff' };

const HEALTH_LABEL = ['Bitt', 'Ille ute', 'Skrapt opp', 'Frisk'];

const GEAR = [
  null,
  { name: 'Golfkøller og stekepanner', mult: 1.0 },
  { name: 'Brekkjern og spikerpistoler', mult: 1.25 },
  { name: 'Brekkjern, spikerpistoler og en hagle', mult: 1.45 },
];

const SECTORS = {
  hjem: {
    name: 'Hjemme', short: 'Hjemme',
    desc: 'Rekkehuset ditt ved motorveien. Kaffetrakteren virker fortsatt. Naboen gjør ikke det.',
    z: 4, hidden: 1,
    loot: { mat: 10, vann: 12, medisin: 1, materialer: 3, drivstoff: 0 },
    special: { text: 'Naboens fryseboks: 6 kilo elgkjøttdeig og en pose isbiter fra 2019.', res: { mat: 6 } },
  },
  tommerodden: {
    name: 'Tømmerodden', short: 'Tømmerodden',
    desc: 'SOTS sikkerhetssenter og Skoleskipet Gann. Folk her har kurs i å overleve. Kurset dekket ikke dette.',
    z: 9, hidden: 3,
    loot: { mat: 6, vann: 6, medisin: 7, materialer: 4, drivstoff: 3 },
    special: { text: 'Skoleskipet Gann ligger fortøyd med fulle tanker. Noter deg det til fase 2. Dere tar med førstehjelpsskapet.', res: { medisin: 4 }, flag: 'gann' },
  },
  obs: {
    name: 'Obs Bygg Buøy', short: 'Obs Bygg',
    desc: 'Ukens tilbud: alt. Gangene er fulle av spikerpistoler, presenning og zombier i arbeidsklær.',
    z: 11, hidden: 3,
    loot: { mat: 4, vann: 4, medisin: 0, materialer: 20, drivstoff: 2 },
    special: { text: 'Verktøyavdelingen er urørt. Crewet bytter golfkøllene mot brekkjern og spikerpistoler.', gear: 2 },
  },
  nordkrysset: {
    name: 'Nordkrysset', short: 'Nordkrysset',
    desc: 'Rundkjøringene mot Hundvåg. Rushtidskø fra helvete, bokstavelig talt. Mange biler med full tank.',
    z: 14, hidden: 3,
    loot: { mat: 6, vann: 6, medisin: 2, materialer: 3, drivstoff: 12 },
    special: { text: 'En politibil står i grøfta. Bagasjerommet har en hagle og en eske patroner. Betjenten trenger dem ikke lenger.', gear: 3 },
  },
  buoy_nord: {
    name: 'Buøy nord', short: 'Buøy nord',
    desc: 'Eneboliger, barnehage og trampoliner. Rolig nabolag. Var det.',
    z: 10, hidden: 3,
    loot: { mat: 20, vann: 16, medisin: 3, materialer: 4, drivstoff: 2 },
    special: { text: 'En garasje med aggregat og hele Biltema-katalogen. Befesting går raskere fra nå.', flag: 'aggregat' },
  },
  skolen: {
    name: 'Buøy skole', short: 'Skolen',
    desc: 'Det var foreldremøte i går kveld. Mange ble igjen. Kantina har frysevafler.',
    z: 16, hidden: 4,
    loot: { mat: 26, vann: 14, medisin: 3, materialer: 3, drivstoff: 0 },
    special: { text: 'Kantina: 300 frysevafler og en spann syltetøy. Moralen stiger merkbart.', res: { mat: 6 }, moral: 15 },
  },
  sorspissen: {
    name: 'Sørspissen', short: 'Sørspissen',
    desc: 'Rundkjøringen ved Bybrua. Herfra kommer alt som vil inn fra byen.',
    z: 12, hidden: 3,
    loot: { mat: 8, vann: 6, medisin: 1, materialer: 5, drivstoff: 6 },
    special: { text: 'En Kolumbus-buss står parkert med nøkkelen i. Rute 6, Hundvåg via sentrum. Transport til fase 2 er sikret.', flag: 'buss' },
  },
  rosenberg: {
    name: 'Rosenberg Verft', short: 'Rosenberg',
    desc: 'Kraner, stål og kaier. Perfekt HQ. Problemet er at hele morgenskiftet fortsatt er på jobb.',
    locked: true,
  },
};
const PLAYABLE = ['hjem', 'tommerodden', 'obs', 'nordkrysset', 'buoy_nord', 'skolen', 'sorspissen'];

const GATES = {
  nord: { name: 'Nordporten', desc: 'Sperring mot Hundvåg. Alt som går, kjører eller sjangler fra nord kommer hit.', sector: 'nordkrysset', x: 1790, y: 1605, base: 0.35 },
  sor: { name: 'Bybrusperringen', desc: 'Sperring over Bybrua-avkjøringen. Byen er full av folk som ikke lenger er folk.', sector: 'sorspissen', x: 2245, y: 2492, base: 0.4 },
  ros: { name: 'Rosenberg-gjerdet', desc: 'Verftsgjerdet holder hordene på Rosenberg inne. Det er bygd for å stoppe tyver, ikke dette.', sector: 'hjem', x: 1985, y: 2265, base: 0.35 },
};
const GATE_STEPS = [0, 6, 14, 24];

const ZONE_INFO = {
  hundvag: 'Meny, Apotek 1, Jernia og Dolly Dimples. Rykter om mye mat, mange zombier og et borettslag som fortsatt holder årsmøte.',
  engoy: 'Engøy. Stille. For stille. Noen har skrevet «IKKE KOM» på et laken.',
  solyst: 'Sølyst. Båthavn og villaer. Noen fyrer opp grillen hver kveld klokka seks.',
  grasholmen: 'Grasholmen. Liten, men med utsikt over hele Vågen.',
  bjornoy: 'Bjørnøy. Ingen bjørner. Det er bekreftet.',
  roaldsoy: 'Roaldsøy. Skole og eneboliger. Lys i vinduene om natta.',
  ormoy: 'Ormøy. Smale veier, mange hager, kort vei til sjøen.',
  steinsoy: 'Steinsøy. Ferjekaien. Den som har båt har makt.',
  bjergsted: 'Bjergsted og fastlandet. Konserthuset spiller fortsatt Grieg på loop.',
};

const TRAITS = {
  lokalkjent: { name: 'Lokalkjent', desc: 'Vet hvor alt er på Buøy. +2 når du leter.' },
  filmnerd: { name: 'Har sett alle zombiefilmene', desc: '+1 Nerver. Sier «sikt mot hodet» ved enhver anledning.' },
  dugnad: { name: 'Fast inventar på dugnad', desc: '+2 når du befester. Har alltid med egen drill.' },
  hms: { name: 'HMS-ansvarlig', desc: 'Befestninger blir solide (+2), men fyller ut avviksskjema etter hver kamp.' },
  nattevakt: { name: 'Nattevakt på SUS', desc: 'Lapper sammen crewet. Hviledager helbreder alltid, og sparer ofte medisin.' },
  sveiser: { name: 'Sveiser på Rosenberg', desc: '+3 når du befester. Kjenner verftet ut og inn (fase 2).' },
  russ: { name: 'Russ 2026', desc: 'Løper fort og redd. Har ingen respekt for noe, inkludert zombier.' },
  regneark: { name: 'Regnearket', desc: 'Oljeingeniør. Viser den ekte sikkerhetsprosenten etter klarering.' },
  hv: { name: 'Heimevernet', desc: '+2 i kamp. Forteller om øvelse Cold Response hver kveld.' },
  buss: { name: 'Kolumbus-sjåfør', desc: 'Kan kjøre hva som helst gjennom hva som helst (fase 2). +1 Kondis på oppdrag.' },
  los: { name: 'Pensjonert los', desc: 'Kjenner hvert skjær. Ser ting andre overser: +0,1 til å finne skjulte zombier.' },
  kokk: { name: 'Kokk på Fisketorget', desc: 'Får mat til å strekke lenger. Crewet bruker 1 porsjon mindre mat per dag.' },
};
const SELF_TRAITS = ['lokalkjent', 'filmnerd', 'dugnad'];

const NEIGHBORS = [
  { id: 'kjell', name: 'Kjell', age: 64, role: 'Styreleder i borettslaget', trait: 'hms', stats: { muskler: 1, kondis: 1, snoking: 3, nerver: 3, mekk: 3, prat: 5 }, quip: 'Har allerede kalt inn til ekstraordinært årsmøte.' },
  { id: 'mona', name: 'Mona', age: 41, role: 'Sykepleier', trait: 'nattevakt', stats: { muskler: 2, kondis: 3, snoking: 3, nerver: 5, mekk: 1, prat: 3 }, quip: 'Har sett verre på legevakta en lørdag.' },
  { id: 'arild', name: 'Arild', age: 52, role: 'Sveiser', trait: 'sveiser', stats: { muskler: 4, kondis: 2, snoking: 2, nerver: 3, mekk: 5, prat: 1 }, quip: 'Sier ingenting. Sveiser bare.' },
  { id: 'sondre', name: 'Sondre', age: 19, role: 'Russ', trait: 'russ', stats: { muskler: 3, kondis: 5, snoking: 2, nerver: 2, mekk: 1, prat: 3 }, quip: 'Russebussen het «Apokalypse 2026». Ironisk nok.' },
  { id: 'ingrid', name: 'Ingrid', age: 33, role: 'Oljeingeniør', trait: 'regneark', stats: { muskler: 2, kondis: 3, snoking: 4, nerver: 3, mekk: 4, prat: 2 }, quip: 'Har laget et regneark over overlevelsessannsynlighet. Det er ikke oppmuntrende.' },
  { id: 'toregil', name: 'Tor-Egil', age: 47, role: 'Heimevernet', trait: 'hv', stats: { muskler: 4, kondis: 3, snoking: 2, nerver: 4, mekk: 2, prat: 1 }, quip: 'Har ventet på denne dagen i 25 år.' },
  { id: 'leah', name: 'Leah', age: 28, role: 'Bussjåfør', trait: 'buss', stats: { muskler: 3, kondis: 3, snoking: 3, nerver: 4, mekk: 3, prat: 2 }, quip: 'Har kjørt nattbussen fra Skagen. Dette er bare en vanlig fredag.' },
  { id: 'bjarne', name: 'Bjarne', age: 71, role: 'Los', trait: 'los', stats: { muskler: 1, kondis: 1, snoking: 5, nerver: 5, mekk: 3, prat: 3 }, quip: 'Kaller zombiene «turistene».' },
  { id: 'gunn', name: 'Gunn', age: 58, role: 'Kokk', trait: 'kokk', stats: { muskler: 3, kondis: 2, snoking: 3, nerver: 3, mekk: 2, prat: 4 }, quip: 'Kan lage fiskesuppe av ingenting. Har gjort det før.' },
];
const START_NEIGHBORS = ['kjell', 'mona', 'arild', 'sondre', 'ingrid', 'toregil', 'leah', 'bjarne'];

// ---------- RNG ----------
function rand(s) {
  // mulberry32
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (s, arr) => arr[Math.floor(rand(s) * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sround = (s, v) => Math.floor(v) + (rand(s) < v - Math.floor(v) ? 1 : 0);

// ---------- Oppsett ----------
function newGame(seed, self, neighborIds) {
  const s = {
    v: 1, seed, rng: seed | 0, day: 1, phase: 1, moral: 70, gear: 1,
    res: { mat: 12, vann: 10, medisin: 2, materialer: 4, drivstoff: 0 },
    flags: {}, crew: [], sectors: {}, gates: {}, seenEvents: [], log: [], over: null,
    stats: { kills: 0, found: 0, lost: 0 },
  };
  s.crew.push({ id: 'meg', name: self.name || 'Deg', role: 'Deg', trait: self.trait, stats: { ...self.stats }, hp: 3, task: { type: 'hvile' }, kills: 0, me: true });
  for (const id of neighborIds) addNeighbor(s, id);
  for (const id of PLAYABLE) {
    const d = SECTORS[id];
    s.sectors[id] = { z: d.z, hidden: d.hidden, loot: { ...d.loot }, lootMax: sum(Object.values(d.loot)), miss: null, noise: 0, seen: id === 'hjem', special: false, cleared: false };
  }
  for (const id in GATES) s.gates[id] = { work: 0, level: 0 };
  return s;
}
function addNeighbor(s, id) {
  const n = NEIGHBORS.find((x) => x.id === id);
  s.crew.push({ id: n.id, name: n.name, role: n.role, trait: n.trait, stats: { ...n.stats }, hp: 3, task: { type: 'hvile' }, kills: 0 });
}
const sum = (a) => a.reduce((x, y) => x + y, 0);

// ---------- Avledede verdier ----------
function stat(c, k) {
  let v = c.stats[k];
  if (k === 'nerver' && c.trait === 'filmnerd') v += 1;
  if (k === 'kondis' && c.trait === 'buss' && c.task.type !== 'hvile') v += 1;
  return v;
}
function moralMult(s) { return s.moral < 25 ? 0.75 : s.moral < 50 ? 0.9 : 1; }
function hpMult(c) { return c.hp >= 3 ? 1 : c.hp === 2 ? 0.85 : 0.55; }
function fightPower(s, c) {
  let p = stat(c, 'muskler') * 1.0 + stat(c, 'nerver') * 0.5 + stat(c, 'kondis') * 0.3;
  if (c.trait === 'hv') p += 2;
  return p * GEAR[s.gear].mult * moralMult(s) * hpMult(c);
}
function detectChance(team) {
  if (!team.length) return 0;
  const avg = sum(team.map((c) => stat(c, 'snoking'))) / team.length;
  let p = 0.1 + 0.05 * avg + (team.some((c) => c.trait === 'los') ? 0.1 : 0);
  return clamp(p, 0.05, 0.6);
}
function searchPower(s, c) {
  let p = stat(c, 'snoking') + stat(c, 'kondis') * 0.3;
  if (c.trait === 'lokalkjent') p += 2;
  return p * moralMult(s) * hpMult(c);
}
function buildPower(s, c) {
  let p = stat(c, 'mekk') + stat(c, 'muskler') * 0.4;
  if (c.trait === 'sveiser') p += 3;
  if (c.trait === 'hms' || c.trait === 'dugnad') p += 2;
  if (s.flags.aggregat) p *= 1.3;
  return p * moralMult(s) * hpMult(c);
}
function hasTrait(s, t) { return s.crew.some((c) => c.trait === t); }
function dailyFood(s) { return Math.max(1, Math.ceil(s.crew.length * 0.6) - (hasTrait(s, 'kokk') ? 1 : 0)); }
function dailyWater(s) { return Math.max(1, Math.ceil(s.crew.length * 0.5)); }

// Hva crewet tror om en sektor. Ekte tall bare der det er rimelig.
function sectorIntel(s, id) {
  const sec = s.sectors[id];
  const out = { status: sec.z > 0 ? 'infisert' : 'klarert' };
  if (!sec.seen) {
    const lo = Math.max(1, Math.round(sec.z * 0.6)), hi = Math.round(sec.z * 1.4) + 1;
    out.estimate = `${lo}–${hi}`;
  } else out.estimate = sec.z > 0 ? `${sec.z}` : '0';
  if (sec.z === 0) {
    const real = 1 - (sec.miss ?? 1);
    if (hasTrait(s, 'regneark')) { out.conf = Math.round(real * 100); out.confExact = true; }
    else out.conf = clamp(Math.round((real + sec.noise) * 100), 5, 99);
  }
  out.searched = Math.round((1 - sum(Object.values(sec.loot)) / Math.max(1, sec.lootMax)) * 100);
  return out;
}

// ---------- Ordre ----------
function taskOptions(s) {
  const opts = [{ type: 'hvile', label: 'Hvile hjemme' }];
  for (const id of PLAYABLE) {
    const sec = s.sectors[id], n = SECTORS[id].short;
    if (sec.z > 0) opts.push({ type: 'klarere', target: id, label: `Klarere ${n}` });
    else {
      if (sum(Object.values(sec.loot)) > 0) opts.push({ type: 'lete', target: id, label: `Lete i ${n}` });
      opts.push({ type: 'finsjekk', target: id, label: `Finsjekke ${n}` });
    }
  }
  for (const id in GATES) {
    const g = GATES[id], st = s.gates[id];
    if (st.level < 3 && s.sectors[g.sector].z === 0) opts.push({ type: 'befeste', target: id, label: `Befeste ${g.name}` });
  }
  return opts;
}
function defaultTaskFor(s, sectorId) {
  const sec = s.sectors[sectorId];
  if (sec.z > 0) return { type: 'klarere', target: sectorId };
  if (sum(Object.values(sec.loot)) > 0) return { type: 'lete', target: sectorId };
  return { type: 'finsjekk', target: sectorId };
}
function validateTasks(s) {
  for (const id of PLAYABLE) {
    const sec = s.sectors[id];
    if (sec.z > 0 && sec.cleared) { sec.cleared = false; sec.miss = null; }
    if (sec.z === 0 && !sec.cleared) { sec.cleared = true; sec.miss = sec.miss ?? 0.7; sec.noise = 0; }
  }
  const valid = taskOptions(s);
  for (const c of s.crew) {
    if (!valid.some((o) => o.type === c.task.type && o.target === c.task.target)) c.task = { type: 'hvile' };
  }
}

// ---------- Dagsoppgjør ----------
function resolveDay(s) {
  const L = [];
  const log = (t, kind = '') => L.push({ t, kind });
  const team = (type, target) => s.crew.filter((c) => c.task.type === type && c.task.target === target);
  const injure = (c, why) => {
    c.hp -= 1;
    if (c.hp <= 0) {
      log(`${c.name} ble bitt ${why}. ${pick(s, EULOGY)(c)}`, 'bad');
      s.moral -= 15; s.stats.lost++;
      s.crew = s.crew.filter((x) => x !== c);
    } else log(`${c.name} ble skadet ${why} (${HEALTH_LABEL[c.hp].toLowerCase()}).`, 'warn');
  };

  // 1) Klarering og finsjekk
  for (const id of PLAYABLE) {
    const sec = s.sectors[id];
    const clr = team('klarere', id), fin = team('finsjekk', id);
    const all = [...clr, ...fin];
    if (!all.length) continue;
    sec.seen = true;
    if (clr.length && sec.z > 0) {
      const power = sum(clr.map((c) => fightPower(s, c)));
      const before = sec.z;
      let kills = Math.min(sec.z, sround(s, power * (0.35 + rand(s) * 0.25)));
      sec.z -= kills; s.stats.kills += kills;
      // fordel drap for statistikk
      for (let i = 0; i < kills; i++) pick(s, clr).kills++;
      const names = clr.map((c) => c.name).join(' og ');
      log(`${names} ryddet ${kills} zombie${kills === 1 ? '' : 'r'} i ${SECTORS[id].short}.${sec.z > 0 ? ` ${sec.z} igjen.` : ''}`);
      for (const c of clr) {
        const risk = clamp(0.04 + 0.22 * (before / (power * 1.5 + 1)) - stat(c, 'kondis') * 0.02, 0.02, 0.4);
        if (rand(s) < risk) injure(c, `i ${SECTORS[id].short}`);
      }
      if (clr.some((c) => c.trait === 'hv') && rand(s) < 0.3) log('Tor-Egil sammenlignet det med øvelse Cold Response. Igjen.', 'fun');
      if (clr.some((c) => c.trait === 'russ') && rand(s) < 0.25) log('Sondre filmet alt til en TikTok ingen kommer til å se.', 'fun');
    }
    // Leting etter skjulte (kjellere, boder, garasjer)
    const checkers = sec.z === 0 ? all : fin;
    if (checkers.length && sec.hidden > 0) {
      const p = detectChance(checkers) + (fin.length ? 0.1 : 0);
      let found = 0;
      for (let i = 0; i < sec.hidden; i++) if (rand(s) < p) found++;
      if (found) {
        sec.hidden -= found; s.stats.kills += found;
        log(`Fant ${found} zombie${found === 1 ? '' : 'r'} gjemt i kjellerboder i ${SECTORS[id].short}. Tatt hånd om.`, 'good');
        if (rand(s) < 0.15) injure(pick(s, checkers), 'i en kjellerbod');
      }
    }
    if (sec.z === 0 && checkers.length) {
      const p = detectChance(checkers) + (fin.length ? 0.1 : 0);
      sec.miss = (sec.miss ?? 1) * (1 - p);
    }
    if (sec.z === 0 && !sec.cleared) {
      sec.cleared = true;
      if (sec.miss == null) sec.miss = 1 - detectChance(all);
      sec.noise = (rand(s) - 0.3) * 0.35;
      log(`${SECTORS[id].name} er klarert.`, 'good');
      if (hasTrait(s, 'hms')) log('Kjell har fylt ut avviksskjema for klareringen. I tre eksemplarer.', 'fun');
    }
  }

  // 2) Leting
  for (const id of PLAYABLE) {
    const sec = s.sectors[id];
    const tm = team('lete', id);
    if (!tm.length) continue;
    const power = sum(tm.map((c) => searchPower(s, c)));
    const frac = 1 - Math.exp(-power * 0.09);
    const got = [];
    for (const r of RES) {
      const n = Math.min(sec.loot[r], sround(s, sec.loot[r] * frac));
      if (n > 0) { sec.loot[r] -= n; s.res[r] += n; s.stats.found += n; got.push(`${n} ${RES_LABEL[r].toLowerCase()}`); }
    }
    log(`${tm.map((c) => c.name).join(' og ')} lette i ${SECTORS[id].short}: ${got.length ? got.join(', ') : 'ingenting av verdi, bare IKEA-møbler'}.`);
    const left = sum(Object.values(sec.loot)) / sec.lootMax;
    if (!sec.special && left <= 0.5) {
      sec.special = true;
      const sp = SECTORS[id].special;
      log(sp.text, 'find');
      if (sp.res) for (const r in sp.res) s.res[r] += sp.res[r];
      if (sp.gear) s.gear = Math.max(s.gear, sp.gear);
      if (sp.flag) s.flags[sp.flag] = true;
      if (sp.moral) s.moral += sp.moral;
    }
    if (sec.hidden > 0 && rand(s) < 0.15 * sec.hidden) {
      sec.hidden -= 1; s.stats.kills++;
      const c = pick(s, tm);
      log(`En zombie lå gjemt i en bod i ${SECTORS[id].short}. ${c.name} fikk overraskelsen.`, 'warn');
      if (rand(s) < 0.35 - stat(c, 'kondis') * 0.04) injure(c, 'av en bodzombie');
    }
  }

  // 3) Befesting
  for (const id in GATES) {
    const tm = team('befeste', id);
    if (!tm.length) continue;
    const g = s.gates[id];
    let work = sum(tm.map((c) => buildPower(s, c)));
    const need = Math.ceil(work / 3);
    const used = Math.min(need, s.res.materialer);
    if (used < need) work *= used / need * 0.7 + 0.3;
    s.res.materialer -= used;
    g.work += work;
    const before = g.level;
    while (g.level < 3 && g.work >= GATE_STEPS[g.level + 1]) g.level++;
    log(`${tm.map((c) => c.name).join(' og ')} befestet ${GATES[id].name} (${used} materialer).${g.level > before ? ` Nå nivå ${g.level}.` : ''}${used < need ? ' Mangler materialer.' : ''}`, g.level > before ? 'good' : '');
  }

  // 4) Hvile
  for (const c of s.crew.filter((c) => c.task.type === 'hvile')) {
    if (c.hp >= 3) continue;
    const nurse = hasTrait(s, 'nattevakt');
    if (s.res.medisin > 0 && !(nurse && rand(s) < 0.5)) { s.res.medisin--; c.hp++; log(`${c.name} ble plastret med medisin.`); }
    else if (nurse || rand(s) < 0.35) { c.hp++; log(`${c.name} kom seg etter en dag på sofaen${nurse ? ' (og Monas strenge regime)' : ''}.`); }
  }

  // 5) Forbruk
  const eat = dailyFood(s), drink = dailyWater(s);
  s.res.mat -= eat; s.res.vann -= drink;
  if (s.res.mat < 0) { s.res.mat = 0; s.moral -= 10; log('Det er tomt for mat. Noen foreslo å spise måkene. Ingen lo.', 'bad'); }
  if (s.res.vann < 0) { s.res.vann = 0; s.moral -= 12; log('Tomt for vann. I Stavanger. Det er nesten imponerende.', 'bad'); }
  if (rand(s) < 0.4) { const n = 3 + Math.floor(rand(s) * 4); s.res.vann += n; log(`Det regnet. Selvfølgelig. +${n} vann.`, 'fun'); }

  // 6) Natt: press mot sperringene. Crew som jobber ved porten tar vakta.
  for (const id in GATES) {
    const g = GATES[id], st = s.gates[id];
    const chance = clamp(g.base - st.level * 0.15 + s.day * 0.004, 0.02, 0.9);
    if (rand(s) >= chance) continue;
    let n = Math.max(1, 1 + Math.floor(rand(s) * (1 + s.day / 6)) - st.level);
    const guards = s.crew.filter((c) => (c.task.type === 'befeste' && c.task.target === id) || (['klarere', 'finsjekk'].includes(c.task.type) && c.task.target === g.sector));
    if (guards.length) {
      const k = Math.min(n, sround(s, sum(guards.map((c) => fightPower(s, c))) * 0.35));
      n -= k; s.stats.kills += k;
      if (!n) { log(`Natt: ${k} zombie${k === 1 ? '' : 'r'} prøvde seg ved ${g.name}. ${guards.map((c) => c.name).join(' og ')} holdt vakt.`, 'good'); continue; }
    }
    const target = id === 'ros' ? pick(s, ['hjem', 'obs', 'tommerodden', 'sorspissen']) : g.sector;
    const sec = s.sectors[target];
    const wasClear = sec.z === 0;
    sec.z += n;
    if (wasClear) { sec.cleared = false; sec.miss = null; s.moral -= 4; }
    log(`Natt: ${n} zombie${n === 1 ? '' : 'r'} kom forbi ${g.name} og inn i ${SECTORS[target].short}.${wasClear ? ' Sektoren er infisert igjen.' : ''}`, wasClear ? 'bad' : 'warn');
  }
  // 7) Natt: glemte kjellere
  for (const id of PLAYABLE) {
    const sec = s.sectors[id];
    if (sec.z === 0 && sec.hidden > 0 && rand(s) < 0.1 * sec.hidden) {
      const n = sec.hidden + Math.floor(rand(s) * 3);
      sec.z = n; sec.hidden = 0; sec.cleared = false; sec.miss = null;
      s.moral -= 8;
      log(`Natt: Noen glemte å sjekke kjelleren i ${SECTORS[id].short}. ${n} zombier strømmer ut. Sektoren er infisert igjen.`, 'bad');
    }
  }

  s.moral = clamp(s.moral + 2, 0, 100);
  s.day++;
  validateTasks(s);
  checkEnd(s);
  s.log.push({ day: s.day - 1, lines: L });
  if (s.log.length > 40) s.log.shift();
  return L;
}

function phaseProgress(s) {
  const cleared = PLAYABLE.filter((id) => s.sectors[id].z === 0).length;
  const gates = Object.keys(GATES).map((id) => ({ id, name: GATES[id].name, level: s.gates[id].level }));
  return { cleared, total: PLAYABLE.length, gates, done: cleared === PLAYABLE.length && gates.every((g) => g.level >= 2) };
}
function checkEnd(s) {
  if (s.over) return;
  if (!s.crew.length) s.over = 'dead';
  else if (phaseProgress(s).done) s.over = 'won';
}

const EULOGY = [
  (c) => `Hvil i fred, ${c.name}. Vi tar vare på kaffekoppen din.`,
  (c) => `${c.name} er ikke lenger med oss. Teknisk sett er ${c.name} fortsatt med oss, bare ikke på vår side.`,
  (c) => `Crewet holder ett minutts stillhet. Det blir avbrutt av stønning fra Bybrua.`,
];
