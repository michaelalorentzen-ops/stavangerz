# Regionspillet v0.2: dybde

Status 11.11.2026, regler `region-0.2`. Bygger på [23_REGIONSPILL.md](23_REGIONSPILL.md). Alle tall er hypoteser i `packages/gameplay/src/region/systems.ts` og `rules.ts`.

## Kort fortalt

v0.2 gjør regionspillet om fra et ekspansjonsspill til et lederspill. Du styrer ikke bare fire overlevende. Du styrer et samfunn i unntakstilstand:
- Start hvor du vil, også steder som ikke går an å holde.
- Fem faser med egne mål.
- Arbeidsfordeling for befolkningen.
- Lover om rasjoner, straff og hvem som slippes inn.
- Et forskningstre som finner opp det som gikk tapt, med spesialisering etter HQ-type.
- Perimeter i fire trinn.
- Zombier som muterer.
- Grupper som lyver.
- Over hundre hendelser der valgene kommer tilbake.

## Inspirasjon

Disse mekanikkene er hentet fra andre spill og tilpasset:
- **Frostpunk:** lovboka, håp og uro, og barnearbeid.
- **This War of Mine:** moralske valg med etterslep.
- **State of Decay 2:** HQ-typen gir unike fasiliteter.
- **RimWorld:** plyndrere som skalerer med hvor rike dere er.
- **They Are Billions:** murtrinn.
- **Darkest Dungeon:** lojalitet som tæres.

Kjente zombieserier ga situasjonstyper, men ingen navn eller scener:
- gården med smittede slektninger i fjøset
- det gjestfrie fristedet med en mørk hemmelighet
- karantenesonen
- utfordreren som vil ta makta
- det bitte barnet
- beleiringen
- hordene som krysser en bru

## Start hvor du vil

- **Startkart:** Alle 663 L3-soner kan velges på et kart som er farget etter fare: Rolig, Middels, Krevende, Svært krevende og Nesten umulig. Faren regnes ut fra hvor mange som bodde i sonen og rundt den. Den er lik for alle og avhenger ikke av frøet.
- **Startsonen beholder 30 % av sine døde.** I tette sentre betyr det over hundre zombier på dag 0.
- **Den første natta:** Over fare 45 åpner spillet med hendelsen «Den første natta»:
  - bryt ut mot den roligste nabosonen
  - barrikader dere inne
  - ta en båt fra kaia, hvis sonen ligger ved sjøen
- **Flytt leiren hit:** Før dere eier noe, kan hele gruppen flytte inntil to soner. Det dere ikke kan bære, blir liggende igjen.

## Intro og faser

En kort intro på fire sider forteller hva som skjedde natt til 1. april, hvem crewet er, hvordan man spiller, og hva første mål er. Hver ny fase vises med en egen skjerm. Fra fase 3 muterer zombiene ved hvert faseskifte.

| Fase | Mål for å gå videre | Nytt |
|---|---|---|
| 1 Utbruddet | Ta over en sone, etabler HQ | |
| 2 Hovedkvarteret | 6 soner, 2 nye HQ-moduler, 12 personer | Lover, forskning, arbeidsfordeling, Gjengen og Fellesskapet |
| 3 Ekspansjon | Et helt L2-område, 30 personer, 6 forskningsprosjekter | Styreform, tokt mot grupper, mutasjon, mindre mat å finne |
| 4 Bydelen | 3 hele L2-områder, et nett, 50 personer | Brubygging, større horder, zombier råtner sakte |
| 5 Fraksjonene | Seier | Zombiene råtner raskere |

**Seier i fase 5:** 30 dager på rad med mat nok, håp over 50 og uro under 50. Eller vaksineforsøket. Eller alle gruppene som venner.

**Tap:**
- håpet når 0
- uroen når 100, og du blir avsatt
- hele crewet dør

## Folket: crew og befolkning

- **Crewet** er navngitte ledere, opptil 12. De får ordre som før. Hver har trekk (snill, hard, troende, mistenksom, forelder, einstøing) og lojalitet.
- **Befolkningen** telles: voksne, barn, eldre og syke. Den vokser med flyktninger, funn og hendelser. Den spiser, og barn og eldre spiser mindre.
- **Nye ledere:** Blir crewet for lite, trer nye ledere fram fra befolkningen.
- **Arbeidsfordeling:** De voksne fordeles på arbeid:
  - **jordbruk:** begrenset av jorda
  - **fiske:** begrenset av båter
  - **sanking:** i trygge soner i nærheten
  - **ryddelag:** dreper zombier i egne soner og de roligste naboene, og kan miste folk
  - **vakt**
  - **bygging og vedlikehold:** hjelper på alle prosjekter og reparerer sperringer
  - **forskning**
- **Plass under tak:** Det kommer fra HQ, boliger og husene i sonene dere eier. Er det trangt, synker håpet og flere blir syke.

## Lover (unntakstilstand)

Lovene vedtas fra fase 2, med fem dager mellom hver endring. Styreformen endrer ventetiden: Råd gir 9 dager og Sterk leder 2.

| Gruppe | Valg |
|---|---|
| Rasjonering | Reduserte rasjoner, Arbeidere først, Halve rasjoner |
| Arbeid | Lange skift, Fast hviledag |
| Barna | Barnearbeid, Skole (krever forskning) |
| Straff | Straffearbeid, Forvisning, Gapestokk, Dødsstraff (fase 3) |
| De bitte | Karantene, Barmhjertig avliving |
| De døde | Likbrenning, Gravlegging |
| Porten | Åpen port, Bare nyttige, Stengt port |
| Ro og orden | Portforbud, Kveldsmøter |
| Styreform (fase 3) | Råd, Sterk leder, Menighet, Vernepliktig milits |

Lovene endrer tall som håp, uro, matforbruk og arbeid. De endrer også hvilke valg hendelsene gir. Et eksempel: «Døm etter loven» finnes bare når det er en straffelov. Uten lov må lederen improvisere, og det gir mer uro.

## Håp og uro

- **Håp** er langtidsdrivstoffet. Det trekker mot et nivå fra:
  - strøm, kjøkken og HQ
  - antall soner og milepæler
  - lovene
  - minus skadde, nylige dødsfall, trangboddhet, sult og syke
- **Uro** er den korte lunta. Den stiger med:
  - harde lover
  - størrelse og trangboddhet
  - sult
  - lavt håp
- **Mytteri:** Over 80 kommer hendelsen «Mytteri brygger». Valgene er å oppheve lover, holde et festmåltid, slå ned på det, eller vente.

## Lojalitet og stemmer

Hvert valg i en hendelse har merkelapper: grusom, barmhjertig, hard, veldedig, barn, tro, svik og hensynsløs. Crewet reagerer etter trekkene sine. Hendelsesvinduet sier på forhånd hvem som ikke kommer til å tilgi et valg. Faller lojaliteten under 15, vil personen gå. Spilleren kan da la dem gå, snakke med dem eller stoppe dem.

## Forskning

38 prosjekter er fordelt på seks greiner: Forsvar, Mat, Medisin, Teknikk, Samfunn og Våpen. Hvert prosjekt har en fase, poeng og materialkostnad, og noen krever andre prosjekter, moduler eller strømnett. Poengene kommer fra forskere i befolkningen og fra crew som forsker i HQ. Klasserom og laboratorium gir mer.

**Spesialisering etter HQ-type:** Én grein blir 40 % billigere og kommer en fase tidligere.

| HQ-type | Grein |
|---|---|
| Militærbase | Våpen |
| Fengsel, Industri og verft (Rosenberg) | Forsvar |
| Flyplass | Teknikk |
| Sykehus | Medisin |
| Skole, Kirke | Samfunn |
| Kystgård, Kjøpesenter | Mat |

Kjøpesenteret gir i tillegg bedre handel.

**Perimeterlinjen:**

| Trinn | Hva | Holder om lag | Krever |
|---|---|---|---|
| 1 | Planker og piggtråd | 10 angrep | |
| 2 | Bilvrak | 22 angrep | forskning |
| 3 | Containere | 45 angrep | forskning |
| 4 | Dobbelt stålgjerde | 90 angrep, og ekstra forsvar | forskning |

«Sperr grensene» bygger det beste trinnet dere kan, eller oppgraderer eldre sperringer. Spisse påler gjør at sperrede grenser dreper litt hver natt.

## Mutasjoner

Fra fase 3 får zombiene én tilfeldig mutasjon per faseskifte:
- Løpere
- Skarp hørsel
- Seig hud
- Klatrere
- Flokkdyr
- Gravere

En ukjent mutasjon virker fullt, og spilleren får bare vite at «noe er annerledes». Zombiestudier, som koster prøver fra døde zombier, avslører mutasjonene og halverer virkningen.

## Mat: overflod, så krise

- **Tidlig:** Det er mye å finne. Fra fase 3 gir funn av mat og medisin mindre: 75 % i fase 3, og ned til 50 % i fase 5.
- **Svinn:** Fersk mat over 40 råtner, mest om sommeren. Salting, jordkjeller og lager reduserer svinnet til omtrent en tredel. Bare kjølelager på strøm stopper det nesten.
- **Patruljer:** Hver grense mot en sone dere ikke eier, koster 0,2 mat per dag.
- **Tallene i toppen:** Mat og vann viser lager, netto per dag og antall dager igjen.
- **Tallene per sone:** Hver sone viser netto mat, og det samme for L2- og L1-området. Kartet har en egen visning, «Netto mat», som viser hvilke soner som gir og hvilke som koster.

## Grupper

- **Fredelige grupper** handler som før. De kan bli fiender hvis forholdet faller under −60, eller hvis dere angriper dem.
- **Gjengen** krever «beskyttelse» omtrent hver tolvte dag, og kravet vokser med hvor rike dere er. Dere kan betale, nekte (og få et angrep noen dager etter) eller skyte først. Gjengens styrke vokser over tid.
- **Fellesskapet** kommer med gaver og ber om å få en utsending inn. Senere vil de ha «felles forsvar». I 70 % av spillene planlegger de å ta alt. Speiding, mistenksomme crewmedlemmer og forskningen Etterretning kan avsløre dem. Gjør ingenting avslører dem, åpner de porten fra innsiden, stjeler og tar barn. Det fører videre til en redningskjede. I 30 % av spillene mente de det, og det ender med en allianse.
- **Angrep på en gruppe:** Ordren «Angrip gruppen» lar dere ta basen til en gruppe. Mot fredelige grupper er det mulig fra fase 3, og det koster forholdet til alle de andre.

## Hendelser

111 hendelser, kjedene medregnet:
- 46 om livet i leiren (`events-people.ts`)
- 33 om verden utenfor (`events-world.ts`)
- 11 om grupper (`events-factions.ts`)
- 21 kjernehendelser (`events.ts`)

Kjedene planlegges med `schedule`, og spillet husker valgene i `state.flags`. Krøniken (`state.memory`) viser de store valgene.

Noen eksempler:
- Barnehagen i bomberommet: 3 voksne og 20 barn.
- Tyveri fra lageret, der sannheten kommer senere.
- Overgrep anmeldt mot en populær vakt.
- Det bitte barnet.
- Fjøset med smittede slektninger.
- Insulin uten kjølekjede.
- Predikanten som får tilhengere.
- Utfordreren som vil ta makta.
- De gamle som vil gå så barna kan spise.
- Spionen.
- Sykebåten fra Ryfylke.
- Fristaden på Kvitsøy.
- Karantenesonen og motstandsbevegelsen.
- Beleiringen.
- Hordene over brua.
- Det mørke sykehuset.
- Forsyningsskipet fra oljen.
- Stemmen klokka sju.
- Lyse-ekspedisjonen.
- Trålen med sild.
- Leiren på Sola.

## For QA

Kommandoene kjøres fra `region/`.

```bash
pnpm install
pnpm dev                       # http://127.0.0.1:3000
pnpm region:bot 150 3 8        # dager, frø per start, antall ekstra tette startsoner
pnpm region:events             # bygger alle hendelser på ekte spilltilstander og prøver hvert valg
```

- **`window.__szRegion`** gir `{ state, world, orders, selected, flows }`, og kan bare leses. `flows` er prognosen for mat og vann per dag, og per sone.
- **Test-id-er:**
  - `start-game`
  - `intro-next`
  - `end-day`
  - `open-society`
  - `open-research`
  - `auto-work`
- **Lagring:** `localStorage` under `stavanger-z.region.v2`. Lagringer fra v0.1 lastes ikke inn.
- **Determinisme:** Samme frø og samme valg gir samme spill. Det er sjekket med to like bot-runder.

### Bot-runde 11.11.2026 (220 dager, 1 frø, 17 forslag og 3 tette soner)

| | |
|---|---|
| Runder | 20 |
| Lever etter 220 dager | 17 (1 seier på dag 201) |
| Fase ved slutt | 2: 7, 3: 4, 4: 6, 5: 3 |
| Etter fare | Middels: fase 4,3 i snitt · Krevende: 3,7 · Svært krevende: 2,8, og 2 av 8 døde · Nesten umulig: 2,0, og 1 av 2 døde |
| Sultedager i snitt | 14 |
| Forskningsprosjekter i snitt | 22 |

Hva QA bør se spesielt på:
- **Krisen i fase 3–4:** Gjør starter på landet krisen for svak, når store matlagre bygger seg opp?
- **Dødelige starter:** Er tette starter for dødelige for mennesker, som i motsetning til boten vet at de bør flykte?
- **Gruppene:** Kommer Gjengen og Fellesskapet for sjelden eller for ofte?
- **Valgene:** Føles valgene som valg, eller er ett svar alltid best?
- **Lovene:** Er det noen lover ingen vil vedta?

## Kjente mangler

- **Grupper:** NPC-grupper flytter ikke og utvider seg ikke på kartet.
- **Crewet:** Ingen relasjoner mellom crewmedlemmer, bare mellom dem og deg.
- **Mobil:** Skjermbildet er laget for PC.
- **Gamle lagringer:** Lagringer fra v0.1 (`stavanger-z.region.v1`) blir ikke flyttet over.
