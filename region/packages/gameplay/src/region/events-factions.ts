/**
 * The other living: the gang that demands tribute, the fellowship that smiles until it strikes,
 * and groups that grow tired of you.
 */
import type { RegionFaction, RegionState } from './types';
import { indexWorld, living } from './engine';
import {
  addPeople, amount, event, moveZombies, hurtPerson, give, hasTech, hope, killPerson, need, pay, pickCrew, remember, schedule, setFlag, takeShare, totalPeople, unrest, zoneName,
  type EventDef,
} from './kit';

const gang = (s: RegionState) => s.factions.find(f => f.id === 'gang' && !f.defeated);
const fellowship = (s: RegionState) => s.factions.find(f => f.id === 'fellowship' && !f.defeated);
/** What the gang thinks you are worth. RimWorld-style: wealth draws raiders. */
const wealth = (s: RegionState) => amount(s, 'food') + amount(s, 'ammo') * .5 + amount(s, 'medicine') * 3 + amount(s, 'fuel') + totalPeople(s) * 4;
/** Your strength at home tonight: crew, guards and walls. */
function homeStrength(s: RegionState) {
  const crew = living(s).filter(p => !(p.awayUntil && p.awayUntil > s.day)).reduce((n, p) => n + p.skills.combat * 3, 0);
  const guards = (s.work.guard ?? 0) * 2.5;
  const walls = (s.hq?.modules.includes('walls') ? 12 : 0) + (s.hq?.modules.includes('gate') ? 6 : 0) + (s.hq?.modules.includes('watchtower') ? 5 : 0);
  return crew + guards + walls + (amount(s, 'ammo') > 40 ? 10 : 0);
}

export const EVENTS_FACTIONS: EventDef[] = [
  // ------------------------------------------------------------------ the gang
  {
    id: 'gangTribute', weight: 1, chainOnly: true, when: s => !!gang(s),
    make: (s, w) => {
      const g = gang(s)!;
      const demand = { food: Math.max(10, Math.round(wealth(s) * .1)), ammo: Math.max(5, Math.round(amount(s, 'ammo') * .15)) };
      const paidBefore = Number(s.flags.gangPaid ?? 0);
      return event(paidBefore ? 'Gjengen er tilbake' : 'Beskyttelse', `${paidBefore ? `For ${paidBefore === 1 ? 'andre' : 'n-te'} gang` : 'En pickup med fire bevæpnede'} stopper ved sperringen i ${zoneName(w, s.homeZoneId)}. ${g.name.split(' (')[0]} vil ha ${demand.food} mat og ${demand.ammo} patroner. «Så ingenting skjer med dere. Det er jo farlige tider.»`, [
        { id: 'pay', label: 'Betal', detail: `${demand.food} mat og ${demand.ammo} patroner. De kommer igjen, og de vil ha mer.`, disabled: need(s, demand) },
        { id: 'refuse', label: 'Nekt', detail: 'De drar. De kommer tilbake med flere.', tags: ['reckless'] },
        { id: 'ambush', label: 'Skyt først', detail: 'Fire mann ved porten nå er fire færre senere. Det blir krig.', tags: ['harsh'] },
      ], { factionId: g.id, data: { food: demand.food, ammo: demand.ammo } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const g = gang(s)!;
      g.known = true;
      setFlag(s, 'gangLast', s.day);
      const d = s.event!.data!;
      if (c === 'pay') { pay(s, { food: Number(d.food), ammo: Number(d.ammo) }); setFlag(s, 'gangPaid', Number(s.flags.gangPaid ?? 0) + 1); unrest(s, 4); hope(s, -2); g.strength = (g.strength ?? 30) + 2; schedule(s, 12, 'gangTribute'); }
      if (c === 'refuse') schedule(s, 3 + Math.floor(rng() * 3), 'gangRaid');
      if (c === 'ambush') {
        if (homeStrength(s) + rng() * 15 > 18) { g.strength = Math.max(5, (g.strength ?? 30) - 8); give(s, 'ammo', 20); give(s, 'fuel', 15); lines.push({ tone: 'good', title: 'Fire færre', text: 'Pickupen står igjen ved porten, med diesel på tanken.' }); }
        else { const p = pickCrew(s, rng); if (p) { p.health -= 30; lines.push({ tone: 'bad', title: `${p.name} ble skutt`, text: 'De var raskere enn dere trodde.' }); } }
        g.relation = -100;
        schedule(s, 4 + Math.floor(rng() * 4), 'gangRaid');
        remember(s, 'Dere åpnet ild mot Gjengen ved porten.');
      }
    },
  },
  {
    id: 'gangRaid', weight: 1, chainOnly: true, when: s => !!gang(s),
    make: (s, w) => {
      const g = gang(s)!;
      // They send what they think it takes: more as the region gets meaner.
      const theirs = Math.round((g.strength ?? 30) * [0, .6, .75, 1, 1.2, 1.3][Math.min(5, s.phase)]);
      const ours = Math.round(homeStrength(s));
      return event('Angrep ved daggry', `Billykter i ${zoneName(w, s.homeZoneId)}. ${g.name.split(' (')[0]} kommer med om lag ${Math.round(theirs / 3)} mann. Dere har en styrke på ${ours} mot deres ${theirs}.`, [
        { id: 'fight', label: 'Forsvar leiren', detail: 'Alle til murene. Det blir døde på begge sider.' },
        { id: 'hide', label: 'Gjem det viktigste og la dem ta resten', detail: 'Ingen kamp. En stor del av lageret går.' },
        { id: 'deal', label: 'Forhandle', detail: 'Gi dem dobbelt av det de krevde sist. Ingen blir drept i dag.', disabled: need(s, { food: 40, ammo: 20 }) },
      ], { factionId: g.id, data: { theirs, ours } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const g = gang(s)!;
      const { theirs, ours } = s.event!.data! as { theirs: number; ours: number };
      schedule(s, 12, 'gangTribute');
      if (c === 'hide') { for (const id of ['food', 'ammo', 'fuel', 'medicine']) takeShare(s, id, .35); hope(s, -6); unrest(s, 6); return; }
      if (c === 'deal') { pay(s, { food: 40, ammo: 20 }); unrest(s, 5); setFlag(s, 'gangLast', s.day); return; }
      const win = ours * (.7 + rng() * .6) > theirs * (.7 + rng() * .6);
      const dead = win ? Math.floor(rng() * 2) : 1 + Math.floor(rng() * 3);
      for (let i = 0; i < dead; i++) { if (s.population.adults > 0 && rng() < .8) s.population.adults -= 1; else { const p = pickCrew(s, rng); if (p && rng() < .5) killPerson(s, p, lines, 'Falt i forsvaret av leiren.'); else if (p) hurtPerson(s, p, 30, lines, 'Skutt i forsvaret av leiren.'); } }
      if (win) { g.strength = Math.max(5, (g.strength ?? 30) * .6); give(s, 'ammo', 30); hope(s, 8); lines.push({ tone: 'good', title: 'Angrepet er slått tilbake', text: `De lot våpen og døde ligge igjen.${dead ? ` Dere mistet ${dead}.` : ''}` }); remember(s, 'Dere slo tilbake Gjengen.'); }
      else { for (const id of ['food', 'ammo', 'fuel', 'medicine']) takeShare(s, id, .5); hope(s, -10); unrest(s, 8); lines.push({ tone: 'bad', title: 'Leiren ble plyndret', text: `De tok halve lageret. Dere mistet ${dead}.` }); }
      setFlag(s, 'gangLast', s.day);
    },
  },
  {
    id: 'gangDefector', weight: 2, phase: [3, 5], once: true, when: s => !!gang(s) && Number(s.flags.gangPaid ?? 0) + (s.flags.gangLast !== undefined ? 1 : 0) >= 1,
    make: (s, w) => event('En fra Gjengen', `En ung mann fra ${gang(s)!.name.split(' (')[0]} står med hendene over hodet ved sperringen. Han vil bytte: tegninger av basen deres mot en plass hos dere. Han har et tatovert tall på hånden og tørt blod under neglene.`, [
      { id: 'take', label: 'Ta ham inn', detail: 'Basen deres blir lettere å angripe. Folk liker ikke at han er her.', tags: ['charity'] },
      { id: 'pump', label: 'Ta tegningene, send ham bort', detail: 'Han går. Hvor vet ingen.', tags: ['harsh'] },
      { id: 'hand', label: 'Lever ham tilbake til Gjengen', detail: 'De betaler. De husker det.', tags: ['betrayal', 'cruel'] },
    ], { zoneId: s.homeZoneId, factionId: gang(s)!.id, data: { home: zoneName(w, s.homeZoneId) } }),
    resolve: (s, _w, c) => {
      const g = gang(s)!;
      if (c === 'take') { addPeople(s, { adults: 1 }); g.strength = Math.round((g.strength ?? 30) * .75); unrest(s, 4); setFlag(s, 'gangPlans', 1); }
      if (c === 'pump') { g.strength = Math.round((g.strength ?? 30) * .85); }
      if (c === 'hand') { give(s, 'ammo', 40); give(s, 'fuel', 20); setFlag(s, 'gangLast', s.day); hope(s, -6); remember(s, 'Dere leverte en avhopper tilbake til Gjengen.'); }
    },
  },

  // ------------------------------------------------------------------ the fellowship: kind until it is not
  {
    id: 'fellowshipGift', weight: 4, once: true, phase: [2, 4], when: s => !!fellowship(s) && s.day >= 10,
    make: s => {
      const f = fellowship(s)!;
      return event('Gaver fra Fellesskapet', `To kvinner i rene, hvite jakker kommer gående med en tralle: mat, medisin og hjemmebakt brød. De er fra ${f.name}. «Vi tror på å hjelpe hverandre. Kanskje vi kan bli venner?»`, [
        { id: 'friends', label: 'Ta imot, og inviter dem tilbake', detail: '20 mat og 8 medisin. Kontakt og samarbeid.', tags: ['charity'] },
        { id: 'gifts', label: 'Ta imot gavene, men hold avstand', detail: 'Høflig og forsiktig.' },
        { id: 'refuse', label: 'Avvis dem', detail: 'Ingen gratis lunsj. Noen synes du er paranoid.', tags: ['harsh'] },
      ], { factionId: f.id });
    },
    resolve: (s, _w, c, rng) => {
      const f = fellowship(s)!;
      f.known = true;
      if (c !== 'refuse') { give(s, 'food', 20); give(s, 'medicine', 8); hope(s, 4); }
      if (c === 'friends') { f.relation += 25; schedule(s, 5 + Math.floor(rng() * 3), 'fellowshipEnvoy'); }
      if (c === 'gifts') { f.relation += 10; schedule(s, 10, 'fellowshipEnvoy'); }
      if (c === 'refuse') { f.relation -= 10; unrest(s, 2); if (f.intent === 'betray') schedule(s, 20, 'fellowshipStrike', { soft: 1 }); }
    },
  },
  {
    id: 'fellowshipEnvoy', weight: 1, chainOnly: true, when: s => !!fellowship(s),
    make: s => {
      const f = fellowship(s)!;
      const doubter = living(s).find(p => p.traits?.includes('suspicious'));
      return event('En utsending', `${f.name.split(' (')[0]} spør om én av dem kan bo hos dere. «Tobias er sykepleier og snekker. Han hjelper der det trengs, og holder kontakten mellom oss.» Tobias smiler mye.${doubter ? ` ${doubter.name} ser lenge på ham.` : ''}`, [
        { id: 'accept', label: 'Ta imot Tobias', detail: 'En dyktig mann i leiren. Bedre forhold.', tags: ['charity'] },
        { id: 'trade', label: 'Nei, men la oss handle', detail: 'Handelsavtale uten folk innenfor porten.' },
        { id: 'check', label: 'Send noen for å se på leiren deres først', detail: hasTech(s, 'intel') ? 'Etterretningen kan bekrefte det dere ser.' : 'Det kan avsløre noe, eller såre dem.' },
      ], { factionId: f.id });
    },
    resolve: (s, w, c, rng, lines) => {
      const f = fellowship(s)!;
      if (c === 'accept') { addPeople(s, { adults: 1 }); setFlag(s, 'envoy', 1); f.relation += 15; schedule(s, 7, 'fellowshipAsk'); }
      if (c === 'trade') { f.relation += 5; schedule(s, 9, 'fellowshipAsk'); }
      if (c === 'check') {
        const sharp = living(s).some(p => p.traits?.includes('suspicious')) ? .3 : 0;
        if (f.intent === 'betray' && (hasTech(s, 'intel') || rng() < .45 + sharp)) {
          f.revealed = true;
          lines.push({ tone: 'warn', title: 'Det dere så', text: `I ${zoneName(w, f.zoneId)} står bilene til folk som skulle være «videresendt». I en kjeller er det lenker. De rene jakkene er vasket ofte.` });
          schedule(s, 3, 'fellowshipAsk');
        } else {
          lines.push({ tone: 'info', title: 'Ingenting å se', text: f.intent === 'honest' ? 'Grønnsakshager, en skole og folk som virker glade.' : 'Alt ser ryddig ut. Kanskje litt for ryddig.' });
          f.relation -= 5;
          schedule(s, 7, 'fellowshipAsk');
        }
      }
    },
  },
  {
    id: 'fellowshipAsk', weight: 1, chainOnly: true, when: s => !!fellowship(s),
    make: s => {
      const f = fellowship(s)!;
      const known = f.revealed;
      return event(known ? 'De ber om nøklene' : 'Felles forsvar', known
        ? `${f.name.split(' (')[0]} foreslår «felles forsvar»: deres folk skal ha vakt ved porten deres om natta, og tilgang til våpenlageret. Dere vet hva de har i kjelleren.`
        : `${f.name.split(' (')[0]} foreslår felles forsvar mot Gjengen og hordene. Deres folk tar nattevakt ved porten deres, og dere deler våpenlager. «Sammen er vi sterkere.»`, [
        { id: 'agree', label: 'Godta', detail: 'Flere vakter om natta. Deres folk innenfor.', tags: ['charity'] },
        { id: 'decline', label: 'Avslå høflig', detail: 'Dere holder deres egen port.' },
        ...(known ? [{ id: 'strike', label: 'Slå til først', detail: 'Arrester utsendingen og angrip mens de tror dere er venner.', tags: ['harsh' as const, 'betrayal' as const] }] : []),
      ], { factionId: f.id });
    },
    resolve: (s, _w, c, rng, lines) => {
      const f = fellowship(s)!;
      if (c === 'agree') {
        setFlag(s, 'fellowshipKeys', 1);
        if (f.intent === 'betray') schedule(s, 4 + Math.floor(rng() * 5), 'fellowshipStrike');
        else { f.relation += 30; schedule(s, 12, 'fellowshipAlliance'); }
      }
      if (c === 'decline') { f.relation -= 5; if (f.intent === 'betray') schedule(s, 10 + Math.floor(rng() * 6), 'fellowshipStrike', { soft: 1 }); else schedule(s, 15, 'fellowshipAlliance'); }
      if (c === 'strike') {
        if (s.flags.envoy) { s.flags.envoy = 0; if (s.population.adults) s.population.adults -= 1; }
        f.strength = Math.round((f.strength ?? 30) * .6);
        f.hostile = true; f.relation = -100;
        give(s, 'food', 30); give(s, 'medicine', 10);
        lines.push({ tone: 'warn', title: 'Dere slo til først', text: 'Utsendingen er arrestert. Lageret de hadde sendt over som «gaver», er beslaglagt. De er svekket, og nå vet de at dere vet.' });
        remember(s, 'Dere slo til mot Fellesskapet før de rakk å slå til mot dere.');
      }
    },
  },
  {
    id: 'fellowshipStrike', weight: 1, chainOnly: true, when: s => !!fellowship(s) && fellowship(s)!.intent === 'betray',
    make: (s, _w, _rng, data) => {
      const f = fellowship(s)!;
      const inside = !!s.flags.fellowshipKeys || !!s.flags.envoy;
      return event('Natten de kom', inside
        ? `Klokka tre om natta åpner noen porten fra innsiden. ${f.name.split(' (')[0]} kommer inn med lister over hva dere har, og hvor det står.`
        : `${f.name.split(' (')[0]} angriper i mørket. De vet nøyaktig hvor vaktene står${data?.soft ? ', og de er sinte for at dere ikke ville være venner' : ''}.`, [
        { id: 'fight', label: 'Slåss', detail: inside ? 'De er allerede innenfor. Det blir stygt.' : 'Til murene.' },
        { id: 'flee', label: 'Redd folk, ikke ting', detail: 'Folk kommer seg unna. Lageret går.' },
      ], { factionId: f.id, data: { inside: inside ? 1 : 0 } });
    },
    resolve: (s, w, c, rng, lines) => {
      const f = fellowship(s)!;
      const inside = Number(s.event!.data!.inside) === 1;
      f.hostile = true; f.revealed = true; f.relation = -100;
      if (s.flags.envoy) { s.flags.envoy = 0; if (s.population.adults) s.population.adults -= 1; }
      if (c === 'flee') { for (const id of ['food', 'ammo', 'medicine', 'fuel', 'antibiotics']) takeShare(s, id, .6); hope(s, -10); }
      else {
        const ours = homeStrength(s) * (inside ? .6 : 1);
        if (ours * (.6 + rng() * .8) > (f.strength ?? 30)) { f.strength = Math.round((f.strength ?? 30) * .5); hope(s, 6); lines.push({ tone: 'good', title: 'De ble slått tilbake', text: 'Det ble stille i hvite jakker.' }); }
        else {
          for (const id of ['food', 'ammo', 'medicine', 'fuel']) takeShare(s, id, .4);
          const p = pickCrew(s, rng); if (p) killPerson(s, p, lines, `Drept av ${f.name.split(' (')[0]} i sin egen seng.`);
          const taken = Math.min(s.population.children, 2 + Math.floor(rng() * 4));
          if (taken) { s.population.children -= taken; lines.push({ tone: 'bad', title: `${taken} barn er borte`, text: 'De tok dem med seg.' }); setFlag(s, 'childrenTaken', taken); schedule(s, 6, 'fellowshipRescue', { taken }); }
          hope(s, -14);
        }
      }
      // Opening the gate lets the dead in too.
      if (inside) moveZombies(s, w, s.homeZoneId, 6 + Math.floor(rng() * 8));
      remember(s, `${f.name} forrådte dere.`);
      void w;
    },
  },
  {
    id: 'fellowshipRescue', weight: 1, chainOnly: true, when: s => !!fellowship(s),
    make: (s, w, _rng, data) => event('Barna er i live', `En flyktning fra ${fellowship(s)!.name.split(' (')[0]} sier at barna er i kjelleren i ${zoneName(w, fellowship(s)!.zoneId)}. De skal «oppdras riktig». Toktet er farlig, men det er nå eller aldri.`, [
      { id: 'raid', label: 'Gå inn og hent dem', detail: 'De beste dere har. Det koster ammunisjon og kanskje liv.', tags: ['merciful', 'children'] },
      { id: 'trade', label: 'Kjøp dem fri', detail: '60 mat, 30 drivstoff og 20 medisin.', disabled: need(s, { food: 60, fuel: 30, medicine: 20 }), tags: ['merciful'] },
      { id: 'let', label: 'Dere har ikke styrke til det', detail: 'Ingen glemmer dette.', tags: ['children'] },
    ], { data: { taken: Number(data?.taken ?? 0) } }),
    resolve: (s, _w, c, rng, lines) => {
      const taken = Number(s.event!.data!.taken);
      const f = fellowship(s)!;
      if (c === 'raid') {
        give(s, 'ammo', -Math.min(amount(s, 'ammo'), 40));
        if (homeStrength(s) * (.6 + rng() * .8) > (f.strength ?? 30) * .8) { addPeople(s, { children: taken }); hope(s, 14); f.strength = Math.round((f.strength ?? 30) * .6); lines.push({ tone: 'good', title: 'Barna er hjemme', text: 'Alle sammen.' }); remember(s, 'Dere hentet barna tilbake fra Fellesskapet.'); }
        else { const p = pickCrew(s, rng); if (p) killPerson(s, p, lines, 'Falt i kjelleren hos Fellesskapet.'); hope(s, -6); }
      }
      if (c === 'trade') { pay(s, { food: 60, fuel: 30, medicine: 20 }); addPeople(s, { children: taken }); hope(s, 8); }
      if (c === 'let') { hope(s, -12); unrest(s, 10); }
    },
  },
  {
    id: 'fellowshipAlliance', weight: 1, chainOnly: true, when: s => !!fellowship(s) && fellowship(s)!.intent === 'honest',
    make: s => event('De mente det', `${fellowship(s)!.name.split(' (')[0]} var akkurat det de sa de var. De tilbyr en fast avtale: mat og medisin hver uke mot hjelp til forsvar.`, [
      { id: 'ally', label: 'Allianse', detail: 'Faste leveranser. Dere må stille når de trenger hjelp.', tags: ['charity'] },
      { id: 'no', label: 'Takk, men vi klarer oss', detail: 'Vennlig avstand.' },
    ]),
    resolve: (s, _w, c) => {
      const f = fellowship(s)!;
      if (c === 'ally') { f.relation = Math.max(f.relation, 70); setFlag(s, 'ally:fellowship', 1); hope(s, 6); remember(s, 'Allianse med Fellesskapet.'); }
    },
  },
  {
    id: 'allyDelivery', weight: 3, good: true, when: s => s.factions.some(f => !f.defeated && !f.hostile && f.relation >= 60),
    make: (s, _w, rng) => {
      const friends = s.factions.filter(f => !f.defeated && !f.hostile && f.relation >= 60);
      const f = friends[Math.floor(rng() * friends.length)];
      return event(`Leveranse fra ${f.name.split(' (')[0]}`, 'Vennene deres sender det de kan avse. «Til neste gang dere trenger det.»', [{ id: 'ok', label: 'Takk', detail: 'Mat og noe fra lageret deres.' }], { factionId: f.id });
    },
    resolve: (s) => {
      const f = s.factions.find(x => x.id === s.event!.factionId) as RegionFaction | undefined;
      give(s, 'food', 15);
      if (f) for (const id of f.offers.slice(0, 2)) give(s, id, 5);
    },
  },

  // ------------------------------------------------------------------ peaceful groups that turn
  {
    id: 'groupDemand', weight: 2, phase: [3, 5], when: s => s.factions.some(f => !f.defeated && !f.hostile && f.known && f.relation < -20),
    make: (s, w, rng) => {
      const angry = s.factions.filter(f => !f.defeated && !f.hostile && f.known && f.relation < -20);
      const f = angry[Math.floor(rng() * angry.length)];
      const want = f.wants[0];
      const n = 20;
      return event(`${f.name.split(' (')[0]} krever erstatning`, `De mener dere har tatt det som var deres i ${zoneName(w, f.zoneId)}s nabolag. «${n} ${want === 'food' ? 'mat' : 'av det dere har'}, eller vi tar det.»`, [
        { id: 'pay', label: 'Betal', detail: `${n} av det de vil ha.`, disabled: need(s, { [want]: n }) },
        { id: 'refuse', label: 'Nekt', detail: 'De blir fiender.', tags: ['harsh'] },
      ], { factionId: f.id, data: { want, n } });
    },
    resolve: (s, _w, c) => {
      const f = s.factions.find(x => x.id === s.event!.factionId)!;
      if (c === 'pay') { give(s, String(s.event!.data!.want), -Number(s.event!.data!.n)); f.relation += 30; }
      else { f.relation = -70; f.hostile = true; }
    },
  },
];
void indexWorld;
