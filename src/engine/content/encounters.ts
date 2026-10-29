// Encounterkort. Plassholderinnhold: mekanikken er det som gjelder.
// Belønning og straff skaleres med ctx.threat (1–5).
import { CARDS } from './cards';
import { newCard, rollCard } from '../cards';
import { injure } from '../crew';
import { SECTORS } from '../data';
import type { EncChoice, EncounterCtx, EncounterDef } from '../encounters';
import { pick, rand } from '../rng';
import type { GameState } from '../types';

/** Skaden en vanlig tilbaketrekning koster. */
const RETREAT_INJURY = 0.5, RETREAT_WEAR = 3;

const where = (ctx: EncounterCtx) => (ctx.sector ? SECTORS[ctx.sector].short : 'byen');
const who = (ctx: EncounterCtx) => ctx.crew.map((c) => c.name).join(' og ');

/** Gir en tilfeldig person ett skadetrinn og returnerer logglinjene som tekst. */
function hurt(s: GameState, ctx: EncounterCtx, why: string): string {
  const lines: string[] = [];
  // ordren kan ha blitt nullstilt etter dagen, så årsaken settes ut fra encounteret
  injure(s, pick(s, ctx.crew), why, (t) => lines.push(t), ctx.toktId ? 'tokt' : 'kamp');
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

export const ENCOUNTERS: EncounterDef[] = [
  {
    id: 'trappegang', title: 'Flokken i trappegangen',
    text: (_s, ctx) => `${who(ctx)} åpner en dør i ${where(ctx)} og står ansikt til ansikt med en hel trappegang. Noen av dem har fortsatt innesko på.`,
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
    id: 'sprint', title: 'Hundvåg-sprinten',
    text: (_s, ctx) => `Et dusin zombier i treningstøy får øye på ${who(ctx)} i ${where(ctx)}. Ingen av dem har varmet opp, og alle løper uansett.`,
    choices: [
      { label: 'Spurt til nærmeste kai', check: 'kondis', run: (s, ctx, ok) => {
        if (!ok) { s.res.mat = Math.max(0, s.res.mat - ctx.threat); return `Dere kommer unna, men mister sekker på veien (-${ctx.threat} mat).${setback(s, ctx, 'på sprinten')}`; }
        s.res.medisin += 1;
        return 'Dere vinner med flere lengder. På kaia ligger en førstehjelpsveske etter en som ikke var like rask (+1 medisin).';
      } },
      retreat('Gi opp og gå hjem'),
    ],
  },
  {
    id: 'kiosk', title: 'Kiosken som holdt stengt',
    text: (_s, ctx) => `Bak en nedrullet kioskluke i ${where(ctx)} ligger det et lager. Foran luka står det noe som ikke har sluttet å stå.`,
    choices: [
      { label: 'Spei etter en annen vei inn', check: 'snoking', run: (s, ctx, ok) => {
        if (!ok) return `Den andre veien var den samme veien. Dere rømmer.${setback(s, ctx, 'ved kiosken')}`;
        s.res.skrap += ctx.threat;
        return `Bakdøra stod åpen siden 2. juledag. Dere tar ut det som var verdt det (+${ctx.threat} skrap).${foundCard(s, ctx)}`;
      } },
      { label: 'Ta det ut på avstand først', check: 'nerver', tag: 'rekkevidde', run: (s, ctx, ok) => {
        if (!ok) { s.sectors[ctx.sector ?? 'hjem'].z += 1; return `Skuddet bommer og lager lyd. Én til dukker opp.${setback(s, ctx, 'ved kiosken')}`; }
        s.res.mat += 2; s.res.skrap += ctx.threat;
        return `Ett rolig skudd, og luka er åpen. Ingen bråk (+${ctx.threat} skrap, +2 mat).`;
      } },
      retreat('Dropp kiosken'),
    ],
  },
  {
    id: 'heis', title: 'Heisen som stoppet',
    text: (_s, ctx) => `${who(ctx)} sitter fast i heisen i ${where(ctx)}. Mellom etasjene skrapes det på taket. Heisen har ikke fått service siden 2019.`,
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
    id: 'varebil', title: 'Varebilen med nøkkelen i',
    text: (_s, ctx) => `En varebil fra Kjell Hansen Rør står med motoren varm i ${where(ctx)}. Bak den: noe tyngre, noe som tråkker.`,
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
    id: 'vaktselskap', title: 'Naboen med hagle',
    text: (_s, ctx) => `Et par overlevende har barrikadert seg i ${where(ctx)}. De har ikke sett dere ennå, men de har sett noe annet, og de er nervøse.`,
    choices: [
      { label: 'Snakk dem ned', check: 'prat', run: (s, ctx, ok) => {
        if (!ok) { s.moral -= ctx.threat; return 'De skyter ikke, men de lukker døra. «Dette er et borettslag.» Samtalen er over.'; }
        s.res.mat += ctx.threat; s.res.vann += ctx.threat; s.moral += 2;
        return `De åpner døra og deler det de har (+${ctx.threat} mat, +${ctx.threat} vann). Dere bytter ryktene fra Sandnes.`;
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
    id: 'depot', title: 'Depotet med tykk dør',
    when: (_s, ctx) => ctx.threat >= 2,
    text: (_s, ctx) => `Et kommunalt depot i ${where(ctx)} har en stålplatedør og en lås som ikke blir med på det som har skjedd. Det kan være mye der inne.`,
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
];
