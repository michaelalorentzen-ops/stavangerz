/**
 * Things that happen: about once a week, plus small surprises. What can happen depends on what you hold:
 * coast brings storms and good fishing, farmland brings harvests and pests, tunnels need power for their pumps.
 */
import type { PendingEvent, RegionState, RegionWorld, ReportLine, Stock } from './types';
import { controlled, has, indexWorld, living, random, recruit, resourceName, season } from './engine';
import { R } from './rules';

interface EventDef {
  id: string; weight: number; good?: boolean;
  when: (s: RegionState, w: RegionWorld) => boolean;
  make: (s: RegionState, w: RegionWorld, rng: () => number) => Omit<PendingEvent, 'id'> | null;
  resolve: (s: RegionState, w: RegionWorld, choice: string, rng: () => number, lines: ReportLine[]) => void;
}

const amount = (stock: Stock, id: string) => stock[id] ?? 0;
const give = (s: RegionState, id: string, n: number) => { s.stock[id] = Math.max(0, Math.round(((s.stock[id] ?? 0) + n) * 10) / 10); };
const coastalOwned = (s: RegionState, w: RegionWorld) => controlled(s).filter(id => indexWorld(w).coastal.has(id));
const ownedFarm = (s: RegionState, w: RegionWorld) => controlled(s).filter(id => (indexWorld(w).byId.get(id)?.measures?.farm ?? 0) > 1e4);
const borderZones = (s: RegionState, w: RegionWorld) => {
  const index = indexWorld(w);
  const owned = new Set(controlled(s));
  return [...new Set([...owned].flatMap(id => (index.adjacent.get(id) ?? []).map(a => a.to)).filter(id => !owned.has(id) && !s.zones[id].owner))];
};
const zoneName = (w: RegionWorld, id?: string) => (id && indexWorld(w).byId.get(id)?.name) || 'området';
const need = (s: RegionState, cost: Stock) => has(s.stock, cost) ? undefined : `Dere har ikke ${Object.entries(cost).map(([id, n]) => `${n} ${resourceName(id).toLowerCase()}`).join(' og ')}.`;

const EVENTS: EventDef[] = [
  {
    id: 'refugees', weight: 4, good: true, when: s => !!controlled(s).length,
    make: (s, _w, rng) => {
      const n = 1 + Math.floor(rng() * 2);
      return { title: 'Folk ved sperringen', text: `${n === 1 ? 'En utslitt person' : 'To utslitte personer'} står ved sperringen og ber om å få komme inn. De har ingenting med seg.`,
        data: { n }, choices: [
          { id: 'admit', label: 'Ta dem inn', detail: 'Flere hender, men flere munner å mette.' },
          { id: 'help', label: 'Gi dem mat og vann', detail: '5 mat og 5 vann, så går de videre.', disabled: need(s, { food: 5, water: 5 }) },
          { id: 'refuse', label: 'Avvis dem', detail: 'Dere sparer forsyninger. Noen i gruppen vil ikke like det.' }] };
    },
    resolve: (s, _w, c, rng, lines) => {
      const n = Number(s.event?.data?.n ?? 1);
      if (c === 'admit') for (let i = 0; i < n; i++) recruit(s, lines, 'De slapp inn ved sperringen.', rng);
      if (c === 'help') { give(s, 'food', -5); give(s, 'water', -5); s.morale += 2; }
      if (c === 'refuse') s.morale -= 4;
    },
  },
  {
    id: 'cache', weight: 3, good: true, when: () => true,
    make: (_s, _w, rng) => {
      const kinds: [string, number][] = [['food', 25], ['medicine', 8], ['ammo', 40], ['fuel', 20], ['building', 25], ['batteries', 8]];
      const [id, n] = kinds[Math.floor(rng() * kinds.length)];
      return { title: 'Et skjult lager', text: `Noen har tegnet et kart på en vegg. Det viser et lager med ${resourceName(id).toLowerCase()}. Det kan være en felle.`,
        data: { id, n }, choices: [
          { id: 'go', label: 'Hent det', detail: 'En liten risiko for skader.' },
          { id: 'skip', label: 'La det ligge', detail: 'Ingen risiko.' }] };
    },
    resolve: (s, _w, c, rng, lines) => {
      if (c !== 'go') return;
      const id = String(s.event?.data?.id), n = Number(s.event?.data?.n);
      give(s, id, n);
      if (rng() < .3) { const v = living(s)[Math.floor(rng() * living(s).length)]; v.health -= 15; lines.push({ tone: 'bad', title: `${v.name} ble skadet`, text: 'Lageret var ikke tomt for zombier.' }); }
    },
  },
  {
    id: 'storm', weight: 3, when: (s, w) => coastalOwned(s, w).length > 0 && ['Høst', 'Vinter'].includes(season(s.day).name),
    make: s => ({ title: 'Storm fra havet', text: 'Vinden river i alt som er løst. Sperringene ved sjøen og båtene er utsatt.',
      choices: [
        { id: 'secure', label: 'Sikre båter og sperringer', detail: '6 byggemateriale, ingen skade.', disabled: need(s, { building: 6 }) },
        { id: 'ride', label: 'Vent den ut', detail: 'Sperringer svekkes, og en båt kan gå tapt.' }] }),
    resolve: (s, _w, c, rng) => {
      if (c === 'secure') { give(s, 'building', -6); return; }
      for (const id of Object.keys(s.barricades)) s.barricades[id] = Math.max(0, s.barricades[id] - 4);
      if (amount(s.stock, 'boat') >= 1 && rng() < .5) give(s, 'boat', -1);
    },
  },
  {
    id: 'horde', weight: 4, when: (s, w) => borderZones(s, w).length > 0,
    make: (s, w, rng) => {
      const near = borderZones(s, w);
      const target = near[Math.floor(rng() * near.length)];
      const size = 25 + Math.floor(rng() * 40) + s.day;
      return { title: 'En horde på vandring', text: `Om lag ${size} zombier driver mot ${zoneName(w, target)}, rett ved grensen deres.`, zoneId: target,
        data: { target, size }, choices: [
          { id: 'lure', label: 'Lokk dem bort med støy', detail: '6 drivstoff til en bil med alarm som kjøres langt bort.', disabled: need(s, { fuel: 6 }) },
          { id: 'brace', label: 'Forbered dere', detail: 'Hordene kommer. Sperringene får forsterkning for 6 byggemateriale.', disabled: need(s, { building: 6 }) },
          { id: 'ignore', label: 'Gjør ingenting', detail: 'Håp at de går forbi.' }] };
    },
    resolve: (s, _w, c) => {
      const target = String(s.event?.data?.target), size = Number(s.event?.data?.size);
      if (c === 'lure') { give(s, 'fuel', -6); s.zones[target].zombies += Math.round(size * .2); return; }
      s.zones[target].zombies += size;
      if (c === 'brace') { give(s, 'building', -6); for (const id of Object.keys(s.barricades)) s.barricades[id] += 6; }
    },
  },
  {
    id: 'sickness', weight: 2, when: s => living(s).length >= 3 && !Object.values(s.networks).some(n => n.includes('water')),
    make: (s, _w, rng) => {
      const v = living(s)[Math.floor(rng() * living(s).length)];
      return { title: `${v.name} er syk`, text: `Feber og frysninger. Leila tror det kommer fra vannet. Uten behandling kan det bli alvorlig.`,
        data: { who: v.id }, choices: [
          { id: 'antibiotics', label: 'Gi antibiotika', detail: 'Sikker bedring.', disabled: need(s, { antibiotics: 1 }) },
          { id: 'medicine', label: 'Gi medisin og hvile', detail: '4 medisin. Trolig bra.', disabled: need(s, { medicine: 4 }) },
          { id: 'wait', label: 'Vent og se', detail: 'Kan gå bra. Kan gå svært galt.' }] };
    },
    resolve: (s, _w, c, rng, lines) => {
      const v = s.survivors.find(x => x.id === s.event?.data?.who);
      if (!v) return;
      if (c === 'antibiotics') { give(s, 'antibiotics', -1); return; }
      if (c === 'medicine') { give(s, 'medicine', -4); v.health -= rng() < .2 ? 20 : 5; return; }
      const harm = rng() < .35 ? 70 : 25;
      v.health -= harm;
      lines.push({ tone: 'bad', title: `${v.name} ble verre`, text: 'Feberen tok hardt.' });
    },
  },
  {
    id: 'tunnelFlood', weight: 3, when: (s, w) => w.links.some(l => l.kind === 'tunnel' && l.lengthM > 2500 && s.chokepoints[l.id] !== 'flooded' && s.chokepoints[l.id] !== 'blown'),
    make: (s, w, rng) => {
      const options = w.links.filter(l => l.kind === 'tunnel' && l.lengthM > 2500 && !['flooded', 'blown'].includes(s.chokepoints[l.id]));
      const link = options[Math.floor(rng() * options.length)];
      const index = indexWorld(w);
      const powered = [link.a, link.b].some(id => (s.networks[index.byId.get(id)?.parentId ?? ''] ?? []).includes('power'));
      if (powered) return null;
      return { title: `${link.name} tar inn vann`, text: 'Uten strøm går pumpene i undersjøiske tunneler tom for drivstoff. Snart står tunnelen under vann for godt.',
        data: { link: link.id }, choices: [
          { id: 'pump', label: 'Kjør pumpene på aggregat', detail: 'Et aggregat og 12 drivstoff holder den åpen en stund.', disabled: need(s, { generator: 1, fuel: 12 }) },
          { id: 'let', label: 'La den gå', detail: 'Tunnelen er stengt for alle, også zombier.' }] };
    },
    resolve: (s, _w, c) => {
      const link = String(s.event?.data?.link);
      if (c === 'pump') { give(s, 'fuel', -12); return; }
      s.chokepoints[link] = 'flooded';
      delete s.barricades[link];
    },
  },
  {
    id: 'harvest', weight: 3, good: true, when: (s, w) => ownedFarm(s, w).length > 0 && season(s.day).name === 'Høst',
    make: () => ({ title: 'Kornet står modent', text: 'Jordene dere eier gir mer enn ventet. Men det må tas inn før regnet.',
      choices: [
        { id: 'all', label: 'Alle mann på jordet', detail: 'Mye mat, men alle blir slitne.' },
        { id: 'some', label: 'Ta det som går', detail: 'Litt mat, ingen utmattelse.' }] }),
    resolve: (s, w, c) => {
      const ha = ownedFarm(s, w).reduce((n, id) => n + (indexWorld(w).byId.get(id)?.measures?.farm ?? 0) / 1e4, 0);
      if (c === 'all') { give(s, 'food', Math.round(Math.min(160, ha * 12))); for (const v of living(s)) v.fatigue = Math.min(100, v.fatigue + 40); }
      else give(s, 'food', Math.round(Math.min(50, ha * 4)));
    },
  },
  {
    id: 'raiders', weight: 3, when: s => s.day > 10 && controlled(s).length > 0,
    make: (s, _w, rng) => {
      const demand: Stock = { food: 15 + Math.floor(rng() * 15), ammo: 10 };
      return { title: 'Plyndrere ved grensen', text: 'En bevæpnet gjeng vil ha forsyninger. «Gi oss det vi ber om, så går vi.»',
        data: { food: demand.food, ammo: demand.ammo }, choices: [
          { id: 'pay', label: 'Betal', detail: `${demand.food} mat og ${demand.ammo} patroner.`, disabled: need(s, demand) },
          { id: 'fight', label: 'Kjemp', detail: 'Dere kan vinne, men folk kan bli skadet. Det bråker.' },
          { id: 'hide', label: 'Gjem forsyningene', detail: 'De tar noe av det de finner.' }] };
    },
    resolve: (s, w, c, rng, lines) => {
      const food = Number(s.event?.data?.food), ammo = Number(s.event?.data?.ammo);
      if (c === 'pay') { give(s, 'food', -food); give(s, 'ammo', -ammo); return; }
      if (c === 'hide') { give(s, 'food', -Math.round(amount(s.stock, 'food') * .25)); give(s, 'fuel', -Math.round(amount(s.stock, 'fuel') * .25)); return; }
      const power = living(s).reduce((n, v) => n + v.skills.combat, 0) + (amount(s.stock, 'ammo') > 20 ? 8 : 0);
      give(s, 'ammo', -Math.min(20, amount(s.stock, 'ammo')));
      s.zones[s.homeZoneId].zombies += 0;
      if (power + rng() * 10 > 22) { s.morale += 5; give(s, 'ammo', 15); give(s, 'fuel', 10); lines.push({ tone: 'good', title: 'Plyndrerne flyktet', text: 'De etterlot våpen og drivstoff.' }); }
      else { for (const v of living(s).slice(0, 2)) v.health -= 25; give(s, 'food', -Math.round(amount(s.stock, 'food') * .3)); lines.push({ tone: 'bad', title: 'Kampen gikk dårlig', text: 'To ble skadet, og plyndrerne tok mat.' }); }
      void w;
    },
  },
  {
    id: 'traderVisit', weight: 3, good: true, when: s => s.factions.some(f => f.known && f.relation > -20),
    make: (s, _w, rng) => {
      const f = s.factions.filter(x => x.known && x.relation > -20)[Math.floor(rng() * s.factions.filter(x => x.known && x.relation > -20).length)];
      const item = f.offers[Math.floor(rng() * f.offers.length)];
      const want = f.wants[Math.floor(rng() * f.wants.length)];
      return { title: `Bud fra ${f.name}`, text: `De tilbyr ${resourceName(item).toLowerCase()} for ${resourceName(want).toLowerCase()} på gode vilkår, bare i dag.`,
        factionId: f.id, data: { item, want }, choices: [
          { id: 'deal', label: 'Ta imot tilbudet', detail: `10 ${resourceName(want).toLowerCase()} for ${item === 'food' ? 20 : 8} ${resourceName(item).toLowerCase()}.`, disabled: need(s, { [want]: 10 }) },
          { id: 'no', label: 'Takk, nei', detail: 'Ingen endring.' }] };
    },
    resolve: (s, _w, c) => {
      if (c !== 'deal') return;
      const item = String(s.event?.data?.item), want = String(s.event?.data?.want);
      give(s, want, -10); give(s, item, item === 'food' ? 20 : 8);
      const f = s.factions.find(x => x.id === s.event?.factionId);
      if (f) f.relation += 5;
      s.counters.trades = (s.counters.trades ?? 0) + 1;
    },
  },
  {
    id: 'plea', weight: 2, when: s => s.factions.some(f => f.known),
    make: (s, _w, rng) => {
      const known = s.factions.filter(x => x.known);
      const f = known[Math.floor(rng() * known.length)];
      const want = f.wants[0];
      return { title: `${f.name} ber om hjelp`, text: `De er i trøbbel og trenger ${resourceName(want).toLowerCase()}. De lover å huske det.`,
        factionId: f.id, data: { want }, choices: [
          { id: 'help', label: 'Send hjelp', detail: `12 ${resourceName(want).toLowerCase()}. Bedre forhold til dem.`, disabled: need(s, { [want]: 12 }) },
          { id: 'no', label: 'Si nei', detail: 'Forholdet blir dårligere.' }] };
    },
    resolve: (s, _w, c) => {
      const f = s.factions.find(x => x.id === s.event?.factionId);
      if (!f) return;
      if (c === 'help') { give(s, String(s.event?.data?.want), -12); f.relation += 20; s.morale += 2; } else f.relation -= 15;
    },
  },
  {
    id: 'goodFishing', weight: 2, good: true, when: (s, w) => coastalOwned(s, w).length > 0 && amount(s.stock, 'boat') >= 1 && season(s.day).name !== 'Vinter',
    make: () => ({ title: 'Makrellen er her', text: 'Fjorden koker av fisk. Én dag med båten kan gi mye.', choices: [
      { id: 'go', label: 'Ut med båten', detail: 'Mye fisk. Salt gjør at den holder.' }, { id: 'no', label: 'Ikke nå', detail: '' }] }),
    resolve: (s, _w, c) => { if (c === 'go') give(s, 'food', amount(s.stock, 'salt') >= 3 ? 50 : 30); },
  },
  {
    id: 'car', weight: 2, good: true, when: () => true,
    make: () => ({ title: 'En bil med full tank', text: 'Noen har parkert en bil med full tank og verktøy i bagasjerommet ved grensen.', choices: [
      { id: 'take', label: 'Tapp den og ta verktøyet', detail: '15 drivstoff og 3 deler.' }, { id: 'no', label: 'La den stå', detail: '' }] }),
    resolve: (s, _w, c) => { if (c === 'take') { give(s, 'fuel', 15); give(s, 'parts', 3); } },
  },
  {
    id: 'fire', weight: 2, when: s => !!s.hq && season(s.day).name === 'Sommer',
    make: s => ({ title: 'Brann i lageret', text: 'En glo fra kokeplassen har tent på kartonger. Det brenner.', choices: [
      { id: 'water', label: 'Slukk med vann', detail: '15 vann.', disabled: need(s, { water: 15 }) },
      { id: 'save', label: 'Redd det dere kan', detail: 'Byggemateriale og mat går tapt.' }] }),
    resolve: (s, _w, c) => {
      if (c === 'water') { give(s, 'water', -15); return; }
      give(s, 'building', -Math.round(amount(s.stock, 'building') * .4)); give(s, 'food', -Math.round(amount(s.stock, 'food') * .2));
    },
  },
  {
    id: 'quarrel', weight: 2, when: s => s.morale < 45 && living(s).length >= 3,
    make: () => ({ title: 'Krangel i gruppen', text: 'Noen mener dere tar for store sjanser. Andre mener dere er for forsiktige.', choices: [
      { id: 'feast', label: 'Felles middag', detail: '10 mat. Moralen bedres.' }, { id: 'rest', label: 'En fridag', detail: 'Alle hviler. Moralen bedres litt.' }, { id: 'ignore', label: 'La det gå over', detail: 'Moralen synker.' }] }),
    resolve: (s, _w, c) => {
      if (c === 'feast' && amount(s.stock, 'food') >= 10) { give(s, 'food', -10); s.morale += 10; }
      else if (c === 'rest') { for (const v of living(s)) v.fatigue = 0; s.morale += 4; }
      else s.morale -= 6;
    },
  },
  {
    id: 'rats', weight: 2, when: s => amount(s.stock, 'food') > 80 && !s.hq?.modules.includes('depot'),
    make: () => ({ title: 'Rotter i maten', text: 'Lageret er fullt av spor. Uten et skikkelig lager forsvinner maten.', choices: [
      { id: 'clean', label: 'Rydd og tett lageret', detail: '4 byggemateriale. Lite tap.' }, { id: 'accept', label: 'Godta tapet', detail: 'En del av maten er ødelagt.' }] }),
    resolve: (s, _w, c) => {
      if (c === 'clean' && amount(s.stock, 'building') >= 4) { give(s, 'building', -4); give(s, 'food', -5); }
      else give(s, 'food', -Math.round(amount(s.stock, 'food') * .2));
    },
  },
  {
    id: 'radio', weight: 2, good: true, when: s => s.factions.some(f => !f.known),
    make: (s, _w, rng) => {
      const unknown = s.factions.filter(f => !f.known);
      const f = unknown[Math.floor(rng() * unknown.length)];
      return { title: 'Stemmer på radioen', text: `En gammel radio knitrer. Noen kaller seg ${f.name} og leter etter andre.`, factionId: f.id,
        choices: [{ id: 'answer', label: 'Svar', detail: 'Dere får kontakt.' }, { id: 'silent', label: 'Hold dere skjult', detail: 'Ingen vet hvor dere er.' }] };
    },
    resolve: (s, _w, c) => { const f = s.factions.find(x => x.id === s.event?.factionId); if (f && c === 'answer') f.known = true; },
  },
  {
    id: 'winter', weight: 3, when: s => season(s.day).name === 'Vinter' && amount(s.stock, 'fuel') < living(s).length * 5,
    make: () => ({ title: 'Kulda biter', text: 'Det er minusgrader om natta. Uten varme blir folk syke.', choices: [
      { id: 'burn', label: 'Brenn møbler og materialer', detail: '10 byggemateriale gir varme en stund.' }, { id: 'endure', label: 'Hold ut', detail: 'Helse og moral synker.' }] }),
    resolve: (s, _w, c) => {
      if (c === 'burn' && amount(s.stock, 'building') >= 10) { give(s, 'building', -10); give(s, 'fuel', 6); return; }
      for (const v of living(s)) v.health -= 8; s.morale -= 5;
    },
  },
  {
    id: 'quiet', weight: 2, good: true, when: s => s.morale < 80,
    make: () => ({ title: 'En stille kveld', text: 'Ingen lyder fra gata. Noen finner en gitar.', choices: [{ id: 'ok', label: 'Nyt det', detail: 'Moralen bedres.' }] }),
    resolve: s => { s.morale += 6; },
  },
];

export function pickEvent(state: RegionState, world: RegionWorld, rng: () => number): PendingEvent | undefined {
  const weekly = state.day > 0 && state.day % R.eventEveryDays === 0;
  if (!weekly && rng() > R.minorEventChance) return undefined;
  const eligible = EVENTS.filter(e => e.when(state, world) && (weekly || e.good));
  for (let tries = 0; tries < 6 && eligible.length; tries++) {
    const total = eligible.reduce((n, e) => n + e.weight, 0);
    let roll = rng() * total;
    const pick = eligible.find(e => (roll -= e.weight) < 0) ?? eligible[0];
    const made = pick.make(state, world, rng);
    if (made) return { id: pick.id, ...made };
    eligible.splice(eligible.indexOf(pick), 1);
  }
  return undefined;
}

export function resolveEvent(state0: RegionState, world: RegionWorld, choiceId: string): { state: RegionState; lines: ReportLine[] } {
  const state = JSON.parse(JSON.stringify(state0)) as RegionState;
  const event = state.event;
  if (!event) throw new Error('Ingen hendelse venter.');
  const choice = event.choices.find(c => c.id === choiceId);
  if (!choice) throw new Error('Ukjent valg.');
  if (choice.disabled) throw new Error(choice.disabled);
  const def = EVENTS.find(e => e.id === event.id)!;
  const lines: ReportLine[] = [];
  def.resolve(state, world, choiceId, random(state.seed, state.day, `choice:${event.id}`), lines);
  state.morale = Math.max(0, Math.min(100, state.morale));
  for (const s of state.survivors) if (s.alive && s.health <= 0) { s.alive = false; s.health = 0; state.morale = Math.max(0, state.morale - 14); lines.push({ tone: 'bad', title: `${s.name} er død`, text: '' }); }
  lines.unshift({ tone: 'info', title: event.title, text: `Dere valgte: ${choice.label}.` });
  delete state.event;
  state.counters.events = (state.counters.events ?? 0) + 1;
  const last = state.reports.at(-1);
  if (last) last.lines.push(...lines);
  return { state, lines };
}
