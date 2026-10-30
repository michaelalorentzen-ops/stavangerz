// Encounterkort. Plassholderinnhold: mekanikken er det som gjelder.
// Belønning og straff skaleres med ctx.threat (1–5).
import { CARDS } from './cards';
import { newCard, rollCard } from '../../../engine/cards';
import { injure } from '../../../engine/crew';
import { SECTORS } from '../../../engine/data';
import { AREA, LANDMARKS, ZONES } from '../places';
import type { EncChoice, EncounterCtx, EncounterDef } from '../../../engine/encounters';
import { pick, rand } from '../../../engine/rng';
import { toktDef, toktSector } from './tokts';
import type { GameState } from '../../../engine/types';

/** Skaden en vanlig tilbaketrekning koster. */
const RETREAT_INJURY = 0.5, RETREAT_WEAR = 3;

/** «hjemme», «i Obs Bygg» eller «i byen» (på tokt). */
const at = (ctx: EncounterCtx) => (ctx.sector ? SECTORS[ctx.sector].at : 'i byen');
const who = (ctx: EncounterCtx) => ctx.crew.map((c) => c.name).join(' og ');

/** Gir en tilfeldig person ett skadetrinn og returnerer logglinjene som tekst. */
function hurt(s: GameState, ctx: EncounterCtx, why: string): string {
  const lines: string[] = [];
  // ordren kan ha blitt nullstilt etter dagen, så årsaken og stedet settes ut fra encounteret
  const at = ctx.sector ?? (ctx.toktId ? toktSector(toktDef(ctx.toktId)) : 'stash');
  injure(s, pick(s, ctx.crew), why, (t) => lines.push(t), ctx.toktId ? 'tokt' : 'kamp', at);
  return lines.join(' ');
}

/** Straff for å mislykkes: moralen faller, og høyere trussel gir større sjanse for skade. */
function setback(s: GameState, ctx: EncounterCtx, why: string): string {
  s.moral -= ctx.threat;
  return rand(s) < Math.min(0.7, 0.15 + 0.1 * ctx.threat) ? ` ${hurt(s, ctx, why)}` : '';
}

/** Gir et tilfeldig kort på lageret, opp til trusselnivået. */
function foundCard(s: GameState, ctx: EncounterCtx): string {
  const k = rollCard(s, ctx.threat);
  s.stash.push(k);
  return ` Dere tok med ${CARDS[k.def].name}.`;
}

/** Tilbaketrekning: halve gangen skades en person, ellers slites et utstyrt kort. Ingen belønning. */
const retreat = (label: string): EncChoice => ({
  label, retreat: true,
  run: (s, ctx) => {
    if (rand(s) < RETREAT_INJURY) return `Dere trekker dere ut i hui og hast. ${hurt(s, ctx, 'under tilbaketrekningen')}`;
    const geared = ctx.crew.flatMap((c) => Object.values(c.gear).map((k) => ({ c, k: k! })));
    if (!geared.length) return 'Dere trekker dere ut uten en skramme. Stoltheten tok mest skade.';
    const { c, k } = pick(s, geared);
    k.dur -= RETREAT_WEAR;
    if (k.dur <= 0) {
      for (const slot of Object.keys(c.gear) as (keyof typeof c.gear)[]) if (c.gear[slot] === k) delete c.gear[slot];
      return `Dere kommer unna, men ${CARDS[k.def].name} tilhørende ${c.name} ble igjen på bakken i biter.`;
    }
    return `Dere kommer unna, men ${CARDS[k.def].name} tilhørende ${c.name} tok støyten (-${RETREAT_WEAR} holdbarhet).`;
  },
});

/** Taper opptil n av en ressurs og returnerer det som faktisk gikk tapt. */
const drain = (s: GameState, k: keyof GameState['res'], n: number): number => { const l = Math.min(n, s.res[k]); s.res[k] -= l; return l; };
/** Kostnaden som tekst: «−3 mat». Er lageret tomt, står det ingenting å miste. */
const cost = (n: number, k: string) => (n > 0 ? `−${n} ${k}` : 'ingenting å miste');
/** Slitasje på et tilfeldig utstyrt kort i gruppa, eller moralen hvis ingen har utstyr. */
function wearOne(s: GameState, ctx: EncounterCtx, n: number): string {
  const geared = ctx.crew.flatMap((c) => Object.values(c.gear).map((k) => ({ c, k: k! })));
  if (!geared.length) { s.moral -= 2; return '(ingenting å slite på, −2 moral)'; }
  const { c, k } = pick(s, geared);
  k.dur -= n;
  if (k.dur <= 0) {
    for (const slot of Object.keys(c.gear) as (keyof typeof c.gear)[]) if (c.gear[slot] === k) delete c.gear[slot];
    return `(${CARDS[k.def].name} tilhørende ${c.name} gikk i stykker)`;
  }
  return `(${CARDS[k.def].name} tilhørende ${c.name}, −${n} holdbarhet)`;
}

export const ENCOUNTERS: EncounterDef[] = [
  {
    id: 'trappegang', title: 'Flokken i trappegangen', places: ['butikk', 'offentlig', 'tokt'],
    text: (_s, ctx) => `${who(ctx)} åpner en dør ${at(ctx)} og står ansikt til ansikt med en hel trappegang. Noen av dem har fortsatt innesko på.`,
    choices: [
      { label: 'Kjemp dere gjennom', check: 'muskler', tag: 'spredning', run: (s, ctx, ok) => {
        if (!ok) return `Trappegangen vinner på poeng.${setback(s, ctx, 'i trappegangen')}`;
        s.res.mat += ctx.threat + 1;
        return `Det er trangt, men det går. Bak siste dør står et skap med hermetikk (+${ctx.threat + 1} mat).`;
      } },
      { label: 'Lås døra og la dem stå', run: (s) => { s.moral -= 1; return 'Døra holder. Naboene på etasjen under får bare en dårlig natt, igjen.'; } },
      retreat('Trekk dere ut'),
    ],
  },
  {
    id: 'sprint', title: `${ZONES.hundvag.name}-sprinten`, places: ['hjem', 'bolig', 'kai', 'industri', 'natur', 'tokt'],
    text: (_s, ctx) => `Et dusin zombier i treningstøy får øye på ${who(ctx)} ${at(ctx)}. Ingen av dem har varmet opp, og alle løper uansett.`,
    choices: [
      { label: 'Spurt til nærmeste kai', check: 'kondis', run: (s, ctx, ok) => {
        if (!ok) { s.res.mat = Math.max(0, s.res.mat - ctx.threat); return `Dere kommer unna, men mister sekker på veien (-${ctx.threat} mat).${setback(s, ctx, 'på sprinten')}`; }
        s.res.medisin += 1;
        return 'Dere vinner med flere lengder. På kaia ligger en førstehjelpsveske etter en som ikke var like rask (+1 medisin).';
      } },
      retreat('Gi opp og trekk dere unna'),
    ],
  },
  {
    id: 'kiosk', title: 'Kiosken som holdt stengt', places: ['butikk', 'industri', 'kai', 'tokt'],
    text: (_s, ctx) => `Bak en nedrullet kioskluke ${at(ctx)} ligger det et lager. Foran luka står det noe som ikke har sluttet å stå.`,
    choices: [
      { label: 'Spei etter en annen vei inn', check: 'snoking', run: (s, ctx, ok) => {
        if (!ok) return `Den andre veien var den samme veien. Dere rømmer.${setback(s, ctx, 'ved kiosken')}`;
        s.res.skrap += ctx.threat;
        return `Bakdøra stod åpen siden 2. juledag. Dere tar ut det som var verdt det (+${ctx.threat} skrap).${foundCard(s, ctx)}`;
      } },
      { label: 'Ta det ut på avstand først', check: 'nerver', tag: 'rekkevidde', run: (s, ctx, ok) => {
        if (!ok) { if (ctx.sector) s.sectors[ctx.sector].z += 1; return `Skuddet bommer og lager lyd. Én til dukker opp.${setback(s, ctx, 'ved kiosken')}`; }
        s.res.mat += 2; s.res.skrap += ctx.threat;
        return `Ett rolig skudd, og luka er åpen. Ingen bråk (+${ctx.threat} skrap, +2 mat).`;
      } },
      retreat('Dropp kiosken'),
    ],
  },
  {
    id: 'heis', title: 'Heisen som stoppet', places: ['offentlig', 'kai', 'tokt'],
    text: (_s, ctx) => `${who(ctx)} sitter fast i heisen ${at(ctx)}. Mellom etasjene skrapes det på taket. Heisen har ikke fått service siden 2019.`,
    choices: [
      { label: 'Hold hodet kaldt og vent', check: 'nerver', run: (s, ctx, ok) => {
        if (!ok) return `Noen trykker på alle knappene. Det hjelper ikke.${setback(s, ctx, 'i heisen')}`;
        s.moral += 3;
        return 'Heisen setter seg i gang av seg selv, akkurat når dere har sluttet å hate den. Moralen stiger.';
      } },
      { label: 'Vri løs hatten i taket', check: 'muskler', tag: 'gjennomslag', run: (s, ctx, ok) => {
        if (!ok) return `Luka sitter som støpt.${setback(s, ctx, 'i heisen')}`;
        s.res.metall += ctx.threat;
        return `Luka gir etter. På taket ligger en pose med bolter og en gammel vaktmesternøkkel (+${ctx.threat} metall).`;
      } },
      retreat('Brekk dere ut'),
    ],
  },
  {
    id: 'varebil', title: 'Varebilen med nøkkelen i', places: ['hjem', 'bolig', 'butikk', 'industri', 'tokt'],
    text: (_s, ctx) => `En varebil fra Kjell Hansen Rør står med motoren varm ${at(ctx)}. Bak den: noe tyngre, noe som tråkker.`,
    choices: [
      { label: 'Få den i gang og ta lasten', check: 'mekk', run: (s, ctx, ok) => {
        if (!ok) { const id = ctx.sector; if (id) s.sectors[id].z += 1; return `Startmotoren hyler som en dårlig tenor. Noe svarer fra baksiden.${setback(s, ctx, 'ved varebilen')}`; }
        s.res.drivstoff += ctx.threat + 1; s.res.skrap += 2;
        return `Motoren tar. Dere tapper tanken og tar med verktøyet (+${ctx.threat + 1} drivstoff, +2 skrap).`;
      } },
      retreat('La bilen stå'),
    ],
  },
  {
    id: 'vaktselskap', title: 'Naboen med hagle', places: ['bolig', 'offentlig', 'tokt'],
    text: (_s, ctx) => `Et par overlevende har barrikadert seg ${at(ctx)}. De har ikke sett dere ennå, men de har sett noe annet, og de er nervøse.`,
    choices: [
      { label: 'Snakk dem ned', check: 'prat', run: (s, ctx, ok) => {
        if (!ok) { s.moral -= ctx.threat; return 'De skyter ikke, men de lukker døra. «Dette er et borettslag.» Samtalen er over.'; }
        s.res.mat += ctx.threat; s.res.vann += ctx.threat; s.moral += 2;
        return `De åpner døra og deler det de har (+${ctx.threat} mat, +${ctx.threat} vann). Dere bytter ryktene fra ${LANDMARKS.sandnes}.`;
      } },
      { label: 'Ta det de har med makt', check: 'muskler', run: (s, ctx, ok) => {
        s.moral -= 4;
        if (!ok) return `De var bedre forberedt enn dere trodde.${setback(s, ctx, 'hos naboene')}`;
        s.res.metall += ctx.threat;
        return `Det går fort, og ingen snakker om det etterpå (+${ctx.threat} metall).${foundCard(s, ctx)}`;
      } },
      retreat('Gå stille bort'),
    ],
  },
  {
    id: 'depot', title: 'Depotet med tykk dør', places: ['industri', 'butikk', 'kai', 'offentlig', 'tokt'],
    when: (_s, ctx) => ctx.threat >= 2,
    text: (_s, ctx) => `Et kommunalt depot ${at(ctx)} har en stålplatedør og en lås som ikke blir med på det som har skjedd. Det kan være mye der inne.`,
    choices: [
      { label: 'Brekk opp døra', check: 'muskler', tag: 'gjennomslag', run: (s, ctx, ok) => {
        if (!ok) return `Døra sitter. Det gjør ikke dere.${setback(s, ctx, 'ved depotet')}`;
        s.res.metall += ctx.threat; s.res.skrap += ctx.threat;
        return `Til slutt gir hengslene seg (+${ctx.threat} metall, +${ctx.threat} skrap).${foundCard(s, ctx)}`;
      } },
      { label: 'Plukk låsen med verktøy', check: 'mekk', run: (s, ctx, ok) => {
        if (!ok) return `Låsen vinner. Dere har ikke kommet langt, og det vet dere.${setback(s, ctx, 'ved depotet')}`;
        s.res.skrap += ctx.threat + 1;
        const k = newCard(s, pick(s, ['baufil', 'tommestokk', 'lommekniv']));
        s.stash.push(k);
        return `Klikk. Det lå verktøy i hylla bak døra (+${ctx.threat + 1} skrap, ${CARDS[k.def].name}).`;
      } },
      retreat('Gi opp depotet'),
    ],
  },
  {
    id: 'garasje', title: 'Naboens garasje', places: ['hjem', 'bolig'],
    text: (_s, ctx) => `Det rasler i en garasje ${at(ctx)}. Porten står halvveis oppe, og på en Bauhaus-hylle innenfor henger en lapp: «Pent brukt, kom med bud».`,
    choices: [
      { label: 'Snik dere inn langs veggen', check: 'snoking', run: (s, ctx, ok) => {
        if (!ok) return `Dere tråkker på en rake. Klassikeren.${setback(s, ctx, 'i garasjen')}`;
        s.res.tre += ctx.threat + 1; s.res.skrap += ctx.threat;
        return `Det som rasler, er en rotte i en pose med pant. Hyllene er fulle (+${ctx.threat + 1} tre, +${ctx.threat} skrap).`;
      } },
      { label: 'Rygg unna og dra opp porten med et smell', check: 'muskler', tag: 'spredning', run: (s, ctx, ok) => {
        if (!ok) { if (ctx.sector) s.sectors[ctx.sector].z += 1; return `Porten går opp. Det gjør ikke inntrykk på det som står bak den.${setback(s, ctx, 'ved garasjen')}`; }
        s.stats.kills += 2; s.res.skrap += 2; s.moral += 2;
        return 'To zombier i joggedress kommer ut én etter én. Ingen av dem kommer langt (+2 skrap).';
      } },
      retreat('La garasjen være'),
    ],
  },
  {
    id: 'kjellerbod', title: 'Boden med navnelapp', places: ['hjem', 'bolig', 'offentlig'],
    text: (_s, ctx) => `I kjelleren ${at(ctx)} er det en bod med navnelapp: «Fam. Tjelta – IKKE RØR». Hengelåsen er borte, og døra er stengt fra innsiden.`,
    choices: [
      { label: 'Lytt ved døra og vent', check: 'nerver', run: (s, ctx, ok) => {
        if (!ok) return `Døra går opp før dere er klare.${setback(s, ctx, 'i kjellerboden')}`;
        const sec = ctx.sector ? s.sectors[ctx.sector] : null;
        const found = sec && sec.hidden > 0;
        if (found) { sec.hidden--; s.stats.kills++; }
        s.res.mat += ctx.threat + 1;
        return `${found ? 'Det var noen der. Nå er det ikke det. ' : 'Det var ingen der, bare en vifte som går. '}Familien Tjelta hadde bunkret hermetikk (+${ctx.threat + 1} mat).`;
      } },
      { label: 'Bryt opp døra', check: 'muskler', tag: 'gjennomslag', run: (s, ctx, ok) => {
        if (!ok) return `Døra er laget av noe som ikke er sponplate.${setback(s, ctx, 'i kjellerboden')}`;
        s.res.mat += ctx.threat; s.res.skrap += 1;
        return `Døra gir etter. Hermetikk, en sykkelpumpe og tre bokser med julepynt (+${ctx.threat} mat, +1 skrap).`;
      } },
      retreat('Gå videre'),
    ],
  },
  {
    id: 'dugnad', title: 'Dugnadslappen', places: ['hjem', 'bolig'],
    text: (_s, ctx) => `På postkassene ${at(ctx)} henger en fersk lapp: «Vårdugnad lørdag kl. 10. Styret stiller med pølser. Fravær faktureres med 500,-.» Ved bossdunkene står en zombie med rive og venter på de andre.`,
    choices: [
      { label: 'Stå dugnaden ut', check: 'kondis', run: (s, ctx, ok) => {
        if (!ok) return `Dugnaden tar lengre tid enn dere har kondis til. Det gjør den alltid.${setback(s, ctx, 'på dugnaden')}`;
        s.res.tre += ctx.threat + 1; s.stats.kills += 1; s.moral += 2;
        return `Raking, hekkeklipp og én zombie i containeren for hageavfall. Styret hadde rett, det var hyggelig (+${ctx.threat + 1} tre).`;
      } },
      { label: 'Forhandle med styreleder', check: 'prat', run: (s, ctx, ok) => {
        if (!ok) { s.moral -= ctx.threat; s.res.mat = Math.max(0, s.res.mat - 1); return 'Styreleder viser til vedtektene, paragraf 7. Dere betaler fraværsgebyret i hermetikk (-1 mat).'; }
        s.res.mat += ctx.threat; s.res.skrap += 1;
        return `Dere får fritak mot å ta neste dugnad, når nå den blir. Styreleder spanderer pølsene som ble til overs (+${ctx.threat} mat, +1 skrap).`;
      } },
      retreat('Late som dere ikke så lappen'),
    ],
  },
  {
    id: 'finn', title: 'Pent brukt, hentes', places: ['hjem', 'bolig', 'tokt'],
    text: (_s, ctx) => `Noen ${at(ctx)} har teipet en utskrift av en Finn-annonse på døra: «Trampoline, 4 m, pent brukt, én eier. Kun seriøse henvendelser.» Selgeren titter ut av vinduet. Bak dere i gata begynner noe å røre på seg.`,
    choices: [
      { label: 'Prut, raskt', check: 'prat', run: (s, ctx, ok) => {
        if (!ok) { s.moral -= ctx.threat; return '«Da får jeg vente på en annen kjøper.» Han trekker for gardinene. Det er ingen andre kjøpere, og det vet dere begge.'; }
        s.res.mat = Math.max(0, s.res.mat - 1); s.res.metall += ctx.threat + 1; s.res.tre += 1;
        return `Én boks makrell i tomat, og trampolinen er deres. Han hjelper til og med med å bære (-1 mat, +${ctx.threat + 1} metall, +1 tre).`;
      } },
      { label: 'Betal det han ber om', run: (s, ctx) => {
        s.res.mat = Math.max(0, s.res.mat - 2); s.res.metall += ctx.threat;
        return `Han ville ha to bokser. Dere betaler uten å prute, og selgeren ser skuffet ut (-2 mat, +${ctx.threat} metall).`;
      } },
      retreat('Si at dere skal tenke på det'),
    ],
  },
  {
    id: 'parkeringsvakt', title: 'Parkeringsvakten', places: ['kai', 'butikk', 'industri', 'tokt'],
    text: (_s, ctx) => `En zombie i uniform fra ${AREA.city} Parkering går fra bil til bil ${at(ctx)} og legger lapper under vindusviskerne. Håndterminalen piper fortsatt. Ingen av bilene har betalt siden mars.`,
    choices: [
      { label: 'Ta ham fra avstand', check: 'nerver', tag: 'rekkevidde', run: (s, ctx, ok) => {
        if (!ok) { if (ctx.sector) s.sectors[ctx.sector].z += 1; return `Dere bommer. Han snur seg sakte og skriver ut en lapp til dere også. Lyden lokker til seg en til.${setback(s, ctx, 'ved parkeringsvakten')}`; }
        s.stats.kills += 1; s.res.skrap += ctx.threat + 1;
        return `Én treff, og vakta er over. Terminalen har batteri og ledninger dere kan bruke (+${ctx.threat + 1} skrap).`;
      } },
      { label: 'Tapp bilene mens han skriver', check: 'mekk', run: (s, ctx, ok) => {
        if (!ok) return `Den første bilen har alarm. Det har han også oppdaget.${setback(s, ctx, 'ved parkeringsvakten')}`;
        s.res.drivstoff += ctx.threat;
        return `Dere jobber dere nedover rekka like raskt som han. Han ilegger gebyr, dere tapper tanken (+${ctx.threat} drivstoff).`;
      } },
      retreat('Flytt dere før dere får gebyr'),
    ],
  },
  {
    id: 'kolumbus', title: 'Bussen som holder ruta', places: ['industri', 'tokt'],
    text: (_s, ctx) => `En Kolumbus-buss går rundt og rundt i rundkjøringen ${at(ctx)}. Sjåføren har vært død en stund, men holder fortsatt fartsgrensen. På skiltet står det «Ikke i rute».`,
    choices: [
      { label: 'Hopp på i farta', check: 'kondis', run: (s, ctx, ok) => {
        if (!ok) return `Dere rakk ikke bussen. Som vanlig.${setback(s, ctx, 'ved bussen')}`;
        s.res.mat += ctx.threat; s.res.medisin += 1;
        return `Dere kommer dere inn bakdøra. Hittegodshylla er full av matpakker og en førstehjelpsveske (+${ctx.threat} mat, +1 medisin).`;
      } },
      { label: 'Stopp den ved neste holdeplass', check: 'mekk', run: (s, ctx, ok) => {
        if (!ok) { if (ctx.sector) s.sectors[ctx.sector].z += 1; return `Nødstoppen virker ikke, men dørene åpner seg. Passasjerene går av.${setback(s, ctx, 'ved bussen')}`; }
        s.stats.kills += 1; s.res.drivstoff += ctx.threat + 1;
        return `Dere kutter tenningen fra luka bak. Sjåføren tar det profesjonelt (+${ctx.threat + 1} drivstoff).`;
      } },
      retreat('Vent på neste avgang'),
    ],
  },
  {
    id: 'viking', title: 'Bortekamp', places: ['industri', 'offentlig', 'tokt'],
    text: (_s, ctx) => `En flokk zombier i mørkeblå Viking-skjerf trekker forbi ${at(ctx)}. De stønner i takt, og de er på vei mot Jåttåvågen. Kampen er avlyst, men det har ingen fortalt dem.`,
    choices: [
      { label: 'Stem i og led dem bort', check: 'prat', run: (s, ctx, ok) => {
        if (!ok) { if (ctx.sector) s.sectors[ctx.sector].z += 1; return `Dere kan ikke teksten. Det hører de.${setback(s, ctx, 'blant supporterne')}`; }
        s.moral += 3; s.res.mat += ctx.threat + 1;
        return `«Heia Viking!» De følger dere inn i et gjerdet område og blir der. Pølsekiosken de gikk fra står urørt (+${ctx.threat + 1} mat).`;
      } },
      { label: 'Ta dem i flanken', check: 'muskler', tag: 'spredning', run: (s, ctx, ok) => {
        if (!ok) return `De er flere enn dere, og de har stått på Nedre B i tjue år.${setback(s, ctx, 'blant supporterne')}`;
        s.stats.kills += ctx.threat + 1; s.res.skrap += ctx.threat;
        return `Det blir et bortetap for dem. Igjen. Dere samler opp det de mistet (+${ctx.threat} skrap).`;
      } },
      retreat('Gå motsatt vei, som etter et tap'),
    ],
  },
  {
    id: 'turnus', title: 'Hjem fra turnus', places: ['hjem', 'bolig', 'tokt'],
    text: (_s, ctx) => `En kar i oransje kjeledress og med bag fra Equinor stopper ${who(ctx)} ${at(ctx)}. Han kom i land i går etter fjorten dager på Sverdrup og lurer på hvorfor ingen svarer på Teams. Lenger nede i gata er det noen som har begynt å gå mot dere.`,
    choices: [
      { label: 'Forklar situasjonen skånsomt', check: 'prat', run: (s, ctx, ok) => {
        if (!ok) { s.moral -= ctx.threat; return `«Dette er sikkert noe ${LANDMARKS.sandnes} har funnet på.» Han går hjem for å sove ut, og tar bagen med seg.`; }
        s.res.mat += ctx.threat; s.res.medisin += 1; s.moral += 2;
        return `Han tar det med fatning. Han skal til hytta i Sirdal og gir dere taxfree-posen og førstehjelpsskrinet fra riggen (+${ctx.threat} mat, +1 medisin).`;
      } },
      { label: 'Si at det er streik', run: (s) => {
        s.moral -= 2; s.res.skrap += 2;
        return 'Han nikker. Det har han vært med på før. Han gir dere verktøyet han ikke får bruk for før neste tur, og går for å finne et åpent bakeri (+2 skrap).';
      } },
      retreat('Gå før han spør mer'),
    ],
  },
  {
    id: 'syttende', title: 'Toget går', places: ['bolig', 'offentlig', 'tokt'],
    text: (_s, ctx) => `Et skolekorps marsjerer ${at(ctx)}, i uniform og i takt. Ingen av dem har pust lenger, så musikken er stort sett tromme. Bak dem bærer en rektor i bunad fanen, fortsatt rak i ryggen.`,
    choices: [
      { label: 'Gå med i toget og snik dere forbi', check: 'snoking', run: (s, ctx, ok) => {
        if (!ok) return `Dere går i utakt. På 17. mai er det uakseptabelt.${setback(s, ctx, 'i toget')}`;
        s.res.mat += ctx.threat + 1; s.res.vann += 1;
        return `Dere følger halen av toget helt fram til en forlatt pølsebod med is i fryseren (+${ctx.threat + 1} mat, +1 vann).`;
      } },
      { label: 'Ta tubaen', check: 'muskler', tag: 'gjennomslag', run: (s, ctx, ok) => {
        if (!ok) { if (ctx.sector) s.sectors[ctx.sector].z += 1; return `Tubaen gir fra seg en lyd som høres helt til ${ZONES.hundvag.name}.${setback(s, ctx, 'i toget')}`; }
        s.stats.kills += 1; s.res.metall += ctx.threat + 1;
        return `Tubaisten slipper til slutt. Det er mye messing i en tuba (+${ctx.threat + 1} metall).`;
      } },
      retreat('Vik til side for toget'),
    ],
  },
  {
    id: 'rommegrot', title: 'Rømmegrøten', places: ['hjem', 'bolig', 'offentlig'],
    text: (_s, ctx) => `Noen har satt på en gryte rømmegrøt på et gassblus ${at(ctx)} og gått fra den. Den lukter nøyaktig som hos bestemor. Det har også naboene merket, og de er ikke levende.`,
    choices: [
      { label: 'Spis nå, tenk etterpå', run: (s, ctx) => {
        s.res.mat += 2; s.moral += 3;
        if (ctx.sector) s.sectors[ctx.sector].z += 1;
        return 'Med sukker, kanel og smørøye. Dere spiser opp før den første kommer til vinduet (+2 mat, men lukta har lokket til seg én til).';
      } },
      { label: 'Skru av og ta med gassflaska', check: 'mekk', run: (s, ctx, ok) => {
        if (!ok) return `Kranen sitter fast, flammen gjør det ikke.${setback(s, ctx, 'ved gassblusset')}`;
        s.res.drivstoff += ctx.threat; s.res.mat += 1;
        return `Dere får flaska løs og grøten i en termos (+${ctx.threat} drivstoff, +1 mat).`;
      } },
      retreat('La grøten stå'),
    ],
  },
  {
    id: 'maker', title: 'Måkene har tatt taket', places: ['hjem', 'kai', 'butikk', 'industri'],
    text: (_s, ctx) => `En koloni måker har tatt over taket ${at(ctx)}. Midt i reiret ligger en hel handlepose de har stjålet fra noen. De ser på dere som om dere er neste pose.`,
    choices: [
      { label: 'Spurt opp og grip posen', check: 'kondis', run: (s, ctx, ok) => {
        if (!ok) return `Måkene vinner. Det gjør de alltid.${setback(s, ctx, 'under måkeangrepet')}`;
        s.res.mat += ctx.threat; s.res.medisin += 1;
        return `Dere er nede igjen før de har bestemt seg. Posen inneholdt brød, Paracet og en kvittering fra Kiwi (+${ctx.threat} mat, +1 medisin).`;
      } },
      { label: 'Skrem dem med et smell', check: 'muskler', tag: 'spredning', run: (s, ctx, ok) => {
        if (ctx.sector) s.sectors[ctx.sector].z += 1;
        if (!ok) return `Måkene blir. Det gjør ikke tålmodigheten deres. Smellet hørtes dessuten lang vei.${setback(s, ctx, 'under måkeangrepet')}`;
        s.res.mat += ctx.threat + 1;
        return `Himmelen blir hvit av vinger, og posen er deres. Smellet hørtes lang vei, og noe er på vei for å se (+${ctx.threat + 1} mat).`;
      } },
      retreat('La måkene få det'),
    ],
  },
  {
    id: 'sots', title: 'Kurset på sikkerhetssenteret', places: ['kai'],
    text: (_s, ctx) => `I øvingsbassenget ${at(ctx)} ligger fem zombier i overlevelsesdrakter og duver. Helikoptersimulatoren henger opp ned over dem. Førstehjelpsskapet står på bunnen.`,
    choices: [
      { label: 'Dykk etter skapet', check: 'kondis', run: (s, ctx, ok) => {
        if (!ok) return `Draktene flyter, det gjør ikke dere. Dere kommer opp med vann i lungene og en hånd i hettegenseren.${setback(s, ctx, 'i bassenget')}`;
        const med = ctx.threat >= 3 ? 2 : 1;
        s.res.medisin += med; s.res.vann += ctx.threat;
        return `Ned, opp, og skapet er deres. Dere er med det sertifisert for nok et år (+${med} medisin, +${ctx.threat} vann).`;
      } },
      { label: 'Tapp bassenget', check: 'mekk', run: (s, ctx, ok) => {
        if (!ok) return `Dere åpner feil ventil, og simulatoren dunker ned i vannet.${setback(s, ctx, 'i bassenget')}`;
        s.stats.kills += ctx.threat; s.res.vann += ctx.threat + 1;
        return `Vannet renner ut, og draktene blir liggende på bunnen. Dere tar med det rene vannet i tankene (+${ctx.threat + 1} vann).`;
      } },
      retreat('Stryk på kurset'),
    ],
  },
  {
    id: 'gann', title: 'Vakt på Gann', places: ['kai'],
    text: (_s, ctx) => `Skoleskipet Gann ligger fortøyd ${at(ctx)}. En zombie i matrosuniform går fortsatt vakt og slår glass hver halvtime. Klokka høres over hele kaia.`,
    choices: [
      { label: 'Ta vakten fra kaia', check: 'nerver', tag: 'rekkevidde', run: (s, ctx, ok) => {
        if (!ok) { if (ctx.sector) s.sectors[ctx.sector].z += 1; return `Bom. Han slår glass i protest, og noen kommer for å se.${setback(s, ctx, 'ved Gann')}`; }
        s.stats.kills += 1; s.moral += 2; s.res.mat += ctx.threat + 1;
        return `Vakten er avløst. Byssa om bord er full av tørrfisk og knekkebrød (+${ctx.threat + 1} mat).`;
      } },
      { label: 'Bord skipet', check: 'muskler', tag: 'gjennomslag', run: (s, ctx, ok) => {
        if (!ok) return `Landgangen er heist, og dere er ikke laget for klatring.${setback(s, ctx, 'ved Gann')}`;
        s.stats.kills += 1; s.res.metall += ctx.threat; s.res.skrap += ctx.threat;
        return `Om bord er det messing, tauverk og en verktøykiste med navnet til en kadett fra 1987 (+${ctx.threat} metall, +${ctx.threat} skrap).`;
      } },
      retreat('La skipet ligge'),
    ],
  },
  {
    id: 'snekke', title: 'Snekka ved brygga', places: ['kai', 'tokt'],
    text: (_s, ctx) => `En pensjonist i Helly Hansen sitter i en snekke ved ei brygge ${at(ctx)} og drar i startsnora. «Den har alltid vært litt sta», sier han. Bak dere fylles brygga sakte opp.`,
    choices: [
      { label: 'Fiks påhengsmotoren', check: 'mekk', run: (s, ctx, ok) => {
        if (!ok) return `Motoren hoster én gang og dør. Det samme kan ikke sies om dem på brygga.${setback(s, ctx, 'på brygga')}`;
        s.res.drivstoff += ctx.threat; s.res.mat += 2;
        return `Tennpluggen var full av sot. Han takker med reservekanna og to makreller fra bøtta (+${ctx.threat} drivstoff, +2 mat).`;
      } },
      { label: 'Ro ham ut og tilbake', check: 'kondis', run: (s, ctx, ok) => {
        if (!ok) return `Dere ror i ring. Brygga kommer nærmere, ikke lenger unna.${setback(s, ctx, 'på brygga')}`;
        s.res.mat += ctx.threat + 1; s.moral += 2;
        return `Ute på fjorden er det stille. Han viser dere garnet sitt og deler fangsten (+${ctx.threat + 1} mat).`;
      } },
      retreat('Bli på land'),
    ],
  },
  {
    id: 'selvbetjent', title: 'Uventet vare i posen', places: ['butikk'],
    text: (_s, ctx) => `Den selvbetjente kassa ${at(ctx)} går fortsatt på nødstrøm. Ved siden av står en kassebetjent som ikke lenger hjelper noen, men som reagerer på pipelyder.`,
    choices: [
      { label: 'Skann alt pent og rolig', check: 'nerver', run: (s, ctx, ok) => {
        if (!ok) { if (ctx.sector) s.sectors[ctx.sector].z += 1; return `«Uventet vare i posen.» Kassebetjenten kommer for å hjelpe, og hun tar med seg en kollega.${setback(s, ctx, 'ved kassa')}`; }
        s.res.skrap += ctx.threat + 1; s.res.tre += ctx.threat;
        return `Pip, pip, pip. «Takk for handelen.» Ingen spør etter kvittering (+${ctx.threat + 1} skrap, +${ctx.threat} tre).`;
      } },
      { label: 'Hopp over sperra', check: 'kondis', run: (s, ctx, ok) => {
        if (!ok) return `Sperra er høyere enn den ser ut. Det er kassebetjenten også.${setback(s, ctx, 'ved kassa')}`;
        s.res.tre += ctx.threat; s.res.metall += 1;
        return `Dere er ute med det dere klarte å bære i én armfull (+${ctx.threat} tre, +1 metall).`;
      } },
      retreat('Legg varene tilbake'),
    ],
  },
  {
    id: 'hagesenter', title: 'Hagesenteret', places: ['butikk'],
    text: (_s, ctx) => `I hageavdelingen ${at(ctx)} står en zombie viklet inn i en hageslange, midt mellom settepotetene og regnvannstønnene. Han har kommet seg fire meter på to uker.`,
    choices: [
      { label: 'Bær ut settepoteter og frø', check: 'muskler', run: (s, ctx, ok) => {
        if (!ok) return `Sekkene er tyngre enn dere, og slangen er ikke så stram som dere trodde.${setback(s, ctx, 'i hagesenteret')}`;
        s.res.mat += ctx.threat; s.res.tre += 2;
        return `Dere bærer ut så mye som tralla tåler. Det blir poteter til jul, om dere når dit (+${ctx.threat} mat, +2 tre).`;
      } },
      { label: 'Kople tønnene og fyll dunker', check: 'mekk', run: (s, ctx, ok) => {
        if (!ok) return `Overgangen passer ikke. Det gjør den aldri på Obs.${setback(s, ctx, 'i hagesenteret')}`;
        s.res.vann += ctx.threat + 1;
        return `Med riktig overgang renner regnvannet rett i dunkene. Takk, ${AREA.city} (+${ctx.threat + 1} vann).`;
      } },
      retreat('Gå ut via plenklipperne'),
    ],
  },
  {
    id: 'sandnesgauk', title: `Pickupen fra ${LANDMARKS.sandnes}`, places: ['bolig', 'industri', 'tokt'],
    text: (_s, ctx) => `En pickup med ${LANDMARKS.sandnes}-skilt stopper ${at(ctx)}. Tre overlevende i Ulf-jakker vil bytte. «Hos oss gikk det mye ryddigere», sier de, før noen har spurt. Motoren står og går.`,
    choices: [
      { label: 'Bytt rykter og drivstoff', check: 'prat', run: (s, ctx, ok) => {
        if (!ok) { s.moral -= ctx.threat; s.res.mat = Math.max(0, s.res.mat - 1); return 'Samtalen sporer av til hvilken by som har best kjøpesenter. Ingen vinner, og de tar med seg en boks på vei ut (-1 mat).'; }
        s.res.drivstoff += ctx.threat; s.moral += 2;
        return `De gir dere en kanne for å slippe å høre mer om ${AREA.city}. Dere er enige om å være uenige (+${ctx.threat} drivstoff).`;
      } },
      { label: 'Ta pickupen mens de prater', check: 'mekk', run: (s, ctx, ok) => {
        s.moral -= 4;
        if (!ok) return `De hadde ikke tenkt til å gå fra den. De er tross alt fra ${LANDMARKS.sandnes}.${setback(s, ctx, 'ved pickupen')}`;
        s.res.drivstoff += ctx.threat + 2; s.res.skrap += 2;
        return `Dere er borte før de har fullført setningen. Det hjelper litt på samvittigheten at de var fra ${LANDMARKS.sandnes} (+${ctx.threat + 2} drivstoff, +2 skrap).`;
      } },
      retreat('La dem kjøre videre'),
    ],
  },
  {
    id: 'generalforsamling', title: 'Generalforsamlingen', places: ['bolig', 'offentlig', 'tokt'],
    text: (_s, ctx) => `Borettslaget ${at(ctx)} holder ekstraordinær generalforsamling. Halvparten av de fremmøtte er døde, men det er fortsatt vedtaksført. Sak 4: Felles innkjøp av barrikader.`,
    choices: [
      { label: 'Fremm forslag om å flytte ut', check: 'prat', run: (s, ctx, ok) => {
        if (!ok) { s.moral -= ctx.threat; return 'Forslaget kom ikke inn innen fristen. Saken utsettes til neste ordinære generalforsamling.'; }
        s.res.mat += ctx.threat; s.res.medisin += 1; s.moral += 2;
        return `Forslaget vedtas mot tre stemmer, alle døde. De levende drar og lar fellesbodene stå åpne (+${ctx.threat} mat, +1 medisin).`;
      } },
      { label: 'Ta ordet med makt', check: 'muskler', tag: 'spredning', run: (s, ctx, ok) => {
        if (!ok) return `Møtelederen ber dere vente på tur. De døde tar ordet i stedet.${setback(s, ctx, 'på generalforsamlingen')}`;
        s.stats.kills += ctx.threat; s.res.skrap += ctx.threat;
        return `Etter dette er det ikke lenger vedtaksført. Protokollen kan godkjennes uten innsigelser (+${ctx.threat} skrap).`;
      } },
      retreat('Meld forfall'),
    ],
  },
  {
    id: 'trampoline', title: 'Han som hopper', places: ['hjem', 'bolig'],
    text: (_s, ctx) => `Over hekken ${at(ctx)} hopper en zombie på en trampoline med sikkerhetsnett. Han kommer seg ikke ut, men han gir seg ikke heller. Fjærene knirker hver gang.`,
    choices: [
      { label: 'Kapp nettet og ta rammen', check: 'mekk', run: (s, ctx, ok) => {
        if (!ok) return `Dere kapper feil side av nettet. Han kommer ut den veien.${setback(s, ctx, 'ved trampolinen')}`;
        s.stats.kills += 1; s.res.metall += ctx.threat + 1;
        return `Nettet faller, og han med det. Rammen er god, galvanisert stål (+${ctx.threat + 1} metall).`;
      } },
      { label: 'Ta ham mens han er i lufta', check: 'nerver', tag: 'rekkevidde', run: (s, ctx, ok) => {
        if (!ok) return `Dere bommer fire ganger. Han treffer ikke trampolinen femte gang.${setback(s, ctx, 'ved trampolinen')}`;
        s.stats.kills += 1; s.moral += 3; s.res.tre += 1;
        return 'Det krever timing. Etterpå er det stille i nabolaget for første gang på flere uker (+1 tre).';
      } },
      retreat('La ham hoppe'),
    ],
  },
  {
    id: 'sidelengs', title: 'Sidelengs regn', places: ['hjem', 'kai', 'industri', 'tokt'],
    text: (_s, ctx) => `Regnet kommer vannrett inn ${at(ctx)}. Sikten er ti meter, og selv zombiene står med ryggen mot vinden. En lokal ville kalt det en grei dag.`,
    choices: [
      { label: 'Bruk regnet som dekke', check: 'snoking', run: (s, ctx, ok) => {
        if (!ok) return `Dere går rett inn i en av dem. Begge blir like overrasket, men bare én av dere biter.${setback(s, ctx, 'i regnet')}`;
        s.res.skrap += ctx.threat + 1; s.res.drivstoff += 1;
        return `Ingen hører dere. Dere går gjennom et skur og en bil før det letter (+${ctx.threat + 1} skrap, +1 drivstoff).`;
      } },
      { label: 'Vent det over', run: (s, ctx) => {
        s.moral -= 2; s.res.vann += ctx.threat;
        return `Det går ikke over. Dette er ${AREA.city}. Dere får i det minste fylt dunkene (+${ctx.threat} vann).`;
      } },
      retreat('Søk ly'),
    ],
  },
  {
    id: 'brakkerigg', title: 'Brakkeriggen', places: ['industri', 'tokt'],
    text: (_s, ctx) => `En brakkerigg fra et veiprosjekt står igjen ${at(ctx)}. På døra henger HMS-tavla: «0 dager uten skade». Inne går kaffeautomaten fortsatt på aggregat.`,
    choices: [
      { label: 'Åpne automaten', check: 'mekk', run: (s, ctx, ok) => {
        if (!ok) return `Automaten svarer med feilkode E4 og et kraftig smell. Det var ikke bare dere som hørte det.${setback(s, ctx, 'i brakkeriggen')}`;
        s.res.mat += ctx.threat; s.moral += 2;
        return `Kaffe, kjeks og sjokolade til et helt arbeidslag. Moralen stiger merkbart (+${ctx.threat} mat).`;
      } },
      { label: 'Gå gjennom skapene', check: 'snoking', run: (s, ctx, ok) => {
        if (!ok) return `Det ene skapet var ikke tomt. Det hadde vernesko.${setback(s, ctx, 'i brakkeriggen')}`;
        s.res.skrap += 1;
        return `Dere finner arbeidstøy, gamle VG-er og noe brukbart (+1 skrap).${foundCard(s, ctx)}`;
      } },
      retreat('Hold HMS-tallet på null'),
    ],
  },
  {
    id: 'bomstasjon', title: 'Køen ved bommen', places: ['industri', 'tokt'],
    text: (_s, ctx) => `Ved en bomstasjon ${at(ctx)} står en bilkø som ikke har rørt seg siden utbruddet. AutoPASS-lampa blinker grønt for hver bil. Noen av førerne sitter fortsatt på.`,
    choices: [
      { label: 'Tapp tankene langs køen', check: 'mekk', run: (s, ctx, ok) => {
        if (!ok) { if (ctx.sector) s.sectors[ctx.sector].z += 1; return `En bilalarm går, så tre til. Førerne går ut for å se hva som skjer.${setback(s, ctx, 'i bilkøen')}`; }
        s.res.drivstoff += ctx.threat + 1;
        return `Bil for bil, stille og effektivt. Bompengene får de kreve inn senere (+${ctx.threat + 1} drivstoff).`;
      } },
      { label: 'Løp mellom bilene og rask med dere', check: 'kondis', run: (s, ctx, ok) => {
        if (!ok) return `En dør går opp foran dere. Den var ikke låst.${setback(s, ctx, 'i bilkøen')}`;
        s.res.skrap += ctx.threat; s.res.mat += 1;
        return `Hanskerom etter hanskerom: ladekabler, solbriller og en pose Smash (+${ctx.threat} skrap, +1 mat).`;
      } },
      retreat('Snu før bommen'),
    ],
  },
  {
    id: 'varmepumpe', title: 'Varmepumpa', places: ['hjem', 'bolig'],
    text: (_s, ctx) => `Varmepumpa på husveggen ${at(ctx)} har sluttet å gå, og det skrangler bak den. Noen har gått seg fast mellom pumpa og tujahekken.`,
    choices: [
      { label: 'Få pumpa i gang igjen', check: 'mekk', run: (s, ctx, ok) => {
        if (!ok) return `Viften starter, han løsner.${setback(s, ctx, 'ved varmepumpa')}`;
        s.stats.kills += 1; s.moral += 4; s.res.skrap += 1;
        return 'Gjesten bak pumpa blir fjernet, og innendørs blir det varmt for første gang på flere uker. Ingen klager over strømprisen (+1 skrap).';
      } },
      { label: 'Dra ham ut av hekken', check: 'muskler', run: (s, ctx, ok) => {
        if (!ok) return `Tujaen holder på ham. Den holder ikke på dere.${setback(s, ctx, 'ved hekken')}`;
        s.stats.kills += 1; s.res.tre += ctx.threat + 1;
        return `Han kommer ut, og halve hekken følger med. Den skulle uansett ha vært klippet (+${ctx.threat + 1} tre).`;
      } },
      retreat('La hekken ta ham'),
    ],
  },
  {
    id: 'lane_sukker', title: 'Naboen som skal låne', places: ['hjem', 'bolig'],
    text: (_s, ctx) => `Det banker på ${at(ctx)}. Det er naboen, og han lurer på om han kan låne litt sukker, som vanlig. Over skulderen hans ser dere at gata er mindre tom enn den var i går.`,
    choices: [
      { label: 'Snu på det og be om noe tilbake', check: 'prat', run: (s, ctx, ok) => {
        if (!ok) { s.moral -= 1; s.res.mat = Math.max(0, s.res.mat - ctx.threat); return `Han låner sukker, mel og et par bokser til. Han skal levere tilbake, sier han (-${ctx.threat} mat).`; }
        s.res.medisin += 1; s.res.mat += ctx.threat;
        return `Han ser flau ut, går hjem og kommer tilbake med det han har lånt siden 2021 (+${ctx.threat} mat, +1 medisin).`;
      } },
      { label: 'Gi ham sukkeret', run: (s) => {
        s.res.mat = Math.max(0, s.res.mat - 1); s.moral += 3;
        return 'Han blir glad. Noen ting skal være som før, også nå (-1 mat).';
      } },
      retreat('Late som ingen er der'),
    ],
  },
  // ---- Dårlige valg: alle veier koster noe
  {
    id: 'kjellerflom', title: 'Kjelleren som fyller seg', places: ['hjem', 'bolig', 'offentlig', 'butikk'],
    text: (_s, ctx) => `${who(ctx)} står i kjelleren ${at(ctx)} da et rør brister over dem. Vannet står til anklene, så til knærne. Dørstokken er i andre enden av rommet.`,
    choices: [
      { label: 'Vad ut med det dere rakk å ta', check: 'kondis', run: (s, ctx, ok) => {
        if (!ok) { const m = drain(s, 'mat', ctx.threat + 1); return `Dere kommer ut, men posene ble igjen i vannet (${cost(m, 'mat')}).${setback(s, ctx, 'i kjelleren')}`; }
        const m = drain(s, 'mat', 1); s.moral -= 1;
        return `Dere kommer ut våte til skinnet. Ingen sier noe, og det er verst (${cost(m, 'mat')}, −1 moral).`;
      } },
      { label: 'Stopp røret med det dere har', check: 'mekk', run: (s, ctx, ok) => {
        if (!ok) { const t = drain(s, 'tre', ctx.threat + 1); return `Røret gir etter for godt. Brettene flyter ut sammen med dere (${cost(t, 'tre')}).${setback(s, ctx, 'i kjelleren')}`; }
        const t = drain(s, 'tre', 2); s.moral -= 1;
        return `Vannet stopper med to planker og mye banning. Planker som sitter fast i et rør er ikke til å bruke igjen (${cost(t, 'tre')}, −1 moral).`;
      } },
      retreat('Svøm ut'),
    ],
  },
  {
    id: 'rekvirert', title: 'Alt er rekvirert', places: ['butikk', 'industri', 'offentlig', 'tokt'],
    text: (_s, ctx) => `En mann i Sivilforsvaret-jakke står i døra ${at(ctx)} med en liste og en hagle. «Alt her er rekvirert», sier han. Han virker overraskende fornøyd med det. Han kan ikke vise noen papirer.`,
    choices: [
      { label: 'Gi ham det han vil ha', run: (s, ctx) => {
        const m = drain(s, 'mat', ctx.threat + 1), sk = drain(s, 'skrap', 2); s.moral -= 2;
        return `Han krysser av på lista, og dere bærer det ut selv (${cost(m, 'mat')}, ${cost(sk, 'skrap')}, −2 moral).`;
      } },
      { label: 'Snakk ham ned', check: 'prat', run: (s, ctx, ok) => {
        if (!ok) { const m = drain(s, 'mat', 2 * ctx.threat + 1); return `Han hører ikke på. Han nikker bare og skriver noe ned. Dere går derfra uten både mat og argumenter (${cost(m, 'mat')}).${setback(s, ctx, 'ved sperringen')}`; }
        const m = drain(s, 'mat', 1); s.moral -= 1;
        return `Han lar dere beholde det meste mot en skriftlig forsikring om at dere «støtter innsatsen» (${cost(m, 'mat')}, −1 moral).`;
      } },
      retreat('Trekk dere ut'),
    ],
  },
  {
    id: 'gulv', title: 'Gulvet gir etter', places: ['bolig', 'offentlig', 'butikk', 'industri', 'kai'],
    text: (_s, ctx) => `Gulvet ${at(ctx)} har råtnet langt mer enn noen har sagt. Det knaker, og i neste åndedrag har ${who(ctx)} et hull i veien. Underveis ser det ut som det står noe nede i kjelleren og ser opp.`,
    choices: [
      { label: 'Hopp over hullet', check: 'kondis', run: (s, ctx, ok) => {
        if (!ok) { if (ctx.sector) s.sectors[ctx.sector].z += 1; return `Dere kommer for kort. Landingen er ikke pen, og noen i kjelleren har hørt den.${setback(s, ctx, 'i gulvet')}`; }
        const sk = drain(s, 'skrap', ctx.threat);
        return `Dere kommer over, men sekken ble hengende på kanten og røk nedi (${cost(sk, 'skrap')}).`;
      } },
      { label: 'Bygg bro av dørene', check: 'mekk', run: (s, ctx, ok) => {
        if (!ok) { const t = drain(s, 'tre', 3); return `Døra bøyer seg, så knekker den. Alt dere hadde med seg som kunne brukes til noe mer, ryker med den (${cost(t, 'tre')}).${setback(s, ctx, 'i gulvet')}`; }
        const t = drain(s, 'tre', 2);
        return `Broa holder. Dørene gjør ikke det etterpå (${cost(t, 'tre')}, ${wearOne(s, ctx, 2)}).`;
      } },
      retreat('Gå ut samme vei'),
    ],
  },
  {
    id: 'ropet', title: 'Ropet fra tredje etasje', places: ['bolig', 'offentlig', 'butikk', 'industri', 'tokt'],
    text: (_s, ctx) => `«Hjelp! Vi sitter fast!» Stemmen kommer fra tredje etasje ${at(ctx)}. Den gjentar seg, ord for ord, med samme tonefall. Noen har lagt igjen en opptaker. Den som la den igjen, ventet på noe.`,
    choices: [
      { label: 'Gå opp og sjekk', check: 'nerver', run: (s, ctx, ok) => {
        if (ctx.sector) s.sectors[ctx.sector].z += ok ? 1 : ctx.threat + 1;
        if (!ok) return `Opptakeren, ja, men også tre beboere som har ventet på besøk. Dere kommer ned igjen raskere enn dere gikk opp (+${ctx.threat + 1} zombier).${setback(s, ctx, 'i trappa')}`;
        const sk = drain(s, 'skrap', 2); s.moral -= 1;
        return `Bare opptakeren, og en som lurer på hvorfor dere kom. Dere rydder på vei ut for at ingen skal merke at dere var der (${cost(sk, 'skrap')}, +1 zombie, −1 moral).`;
      } },
      { label: 'Rop tilbake', check: 'prat', run: (s, ctx, ok) => {
        if (ctx.sector) s.sectors[ctx.sector].z += ok ? 1 : 2;
        if (!ok) return `Alt svarer. Svarene kommer fra alle kanter (+2 zombier).${setback(s, ctx, 'i trappa')}`;
        s.moral -= 1;
        return 'Opptakeren svarer ikke. Det gjør to andre, og dere trekker dere unna før de finner ut hvem dere er (+1 zombie, −1 moral).';
      } },
      retreat('Gå videre'),
    ],
  },
];
