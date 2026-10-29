# Fase 1 med nye kjerneregler – byggeplan

> **For agenter:** PÅKREVD UNDERSKILL: Bruk superpowers:subagent-driven-development (anbefalt) eller superpowers:executing-plans for å gjennomføre planen oppgave for oppgave. Stegene bruker avkrysning (`- [ ]`).

**Mål:** Bygge om fase 1 etter `docs/spilldesign.md` kapittel 11. Det gjelder sektorer med tre verdier og forfall, utstyrskort, nye oppgaver, encounters, tokt og quest, faseslutt med turgrense, mutasjonsmatrisen og tutorial.

**Arkitektur:**
- Motoren i `src/engine/` deles i moduler etter ansvar.
- Innhold som kort, encounters, tokt og mutasjoner ligger i `src/engine/content/`. Innholdsagenter kan senere fylle det uten å røre logikken.
- `resolveDay()` forblir ett deterministisk steg. Valg som oppstår om dagen (encounters og tokt-beslutninger), lagres som ventende og løses med egne funksjoner før neste `resolveDay()`.
- UI-en leser bare tilstanden og kaller motorfunksjoner.

**Teknologi:** TypeScript 5.9, Vite 8, Vitest. Ingen nye avhengigheter.

**Spesifikasjon:** `docs/spilldesign.md`. Les den før hver oppgave. Ved konflikt vinner spesifikasjonen, og avviket meldes.

## Globale krav

- All spilltekst er på norsk bokmål med tørr, lokal Stavanger-humor. Ikke slapstick.
- All tilfeldighet går gjennom `rand(s)`, `pick(s, …)` og `sround(s, …)`. Aldri `Math.random()` i `src/engine/`.
- Alle vanskelighetsknotter ligger i `PHASES[...].mods` i `src/engine/phases.ts` og leses via `mods(s)`. Hver ny knott får en verdi for alle fem faser.
- `src/ui/` endrer aldri tilstand direkte, unntatt `crew.task`. Alt annet går via eksporterte motorfunksjoner.
- Etter hver oppgave skal `npm test` og `npm run typecheck` være grønne. Balansetesten hoppes over fra Oppgave 1 til Oppgave 9 (se Oppgave 1, steg 6).
- Hver oppgave avsluttes med en commit på grenen `fase1-kjerneregler`. Commit-meldingene er på norsk og ender med `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- OpenStreetMap-krediteringen i `index.html` skal stå urørt.
- Plassholderinnhold er greit. Hver innholdsliste har likevel minst det antallet som er oppgitt, så mekanikkene kan testes.

## Fokus for gjennomgang

Det er her en vanlig spiller sannsynligvis treffer feil. Hver linje har en test i oppgaven som eier koden.

1. **Lagring fra prototypen (v1/v2) i nettleseren.** «Fortsett» skal ikke vises, og spillet skal ikke krasje. *(Oppgave 1)*
2. **Hovedpersonen dør mens andre lever.** Spilleren må velge ny leder før dagen kan avsluttes. Utstyret havner på lager eller i sektoren. *(Oppgave 4)*
3. **Hele crewet dør mens et encounter eller tokt venter.** Spillet slutter rent som `dead`, og ingenting ventende blir hengende. *(Oppgave 5)*
4. **En hendelse eller «Lete etter overlevende» prøver å legge til en person når det ikke er plass.** Personen avvises med tekst, og antallet overstiger aldri kapasiteten. *(Oppgave 2 og 8)*
5. **Utstyr som ligger igjen i en sektor som blir infisert igjen.** Kortene blir liggende og kan hentes med neste Rydde. *(Oppgave 3)*

---

## Filstruktur

| Fil | Ansvar |
|---|---|
| `src/engine/types.ts` | Alle typer, `GameState` v3 |
| `src/engine/data.ts` | Sektorer, porter, naboer, egenskaper, ressurser |
| `src/engine/skills.ts` **(ny)** | `stat`, `skillLevel`, `gainXp`, `toSkill` |
| `src/engine/crew.ts` **(ny)** | `injure`, død, ny leder, kapasitet, rekruttering |
| `src/engine/sectors.ts` **(ny)** | Rydde, Sanke, Speide, forfall, `isSafe`, `sectorIntel` |
| `src/engine/cards.ts` **(ny)** | Kortinstanser, `equip`/`unequip`, slitasje, funn, Lage utstyr |
| `src/engine/encounters.ts` **(ny)** | Ventende encounters, `resolveEncounter` |
| `src/engine/tokt.ts` **(ny)** | Tokt og quests |
| `src/engine/phases.ts` | Fasetabell, mutasjonsmatrise, `advancePhase`, `endPhase` |
| `src/engine/engine.ts` | `newGame`, `migrate`, `taskOptions`, `resolveDay` som setter sammen modulene, `phaseProgress`, `checkEnd` |
| `src/engine/events.ts` | Hendelseskort (oppdateres) |
| `src/engine/content/cards.ts` **(ny)** | Kortkatalogen |
| `src/engine/content/encounters.ts` **(ny)** | Encounterkort |
| `src/engine/content/tokts.ts` **(ny)** | Tokt og quests |
| `src/engine/content/mutations.ts` **(ny)** | Mutasjonskatalogen |
| `src/engine/index.ts` | Eksporterer alt over |
| `src/ui/*` | Panel, kart og dialoger (oppdateres). `src/ui/cards.ts` og `src/ui/tutorial.ts` er nye |
| `tools/bot.ts`, `tools/sim.ts` | Boten skrives om for nye regler |
| `tests/*.test.ts` | En testfil per motormodul |

---

### Oppgave 1: Tilstand v3, nye ressurser og ferdigheter 1–100

**Filer:**
- Endre: `src/engine/types.ts`, `src/engine/data.ts`, `src/engine/engine.ts`, `src/engine/events.ts`, `src/engine/index.ts`, `src/ui/panel.ts`, `src/ui/modals.ts`, `src/ui/store.ts`, `tools/bot.ts`
- Opprett: `src/engine/skills.ts`, `tests/skills.test.ts`
- Endre: `tests/engine.test.ts`, `tests/balance.test.ts`

**Grensesnitt:**
- Produserer:
  - `type ResKey = 'mat' | 'vann' | 'medisin' | 'tre' | 'skrap' | 'metall' | 'strom' | 'drivstoff'`
  - `RES: ResKey[]` i den rekkefølgen
  - `RES_LABEL` (Strøm, Drivstoff, …)
  - `PHASE_RES: Record<PhaseId, ResKey[]>`, der fase 1 er `['mat','vann','medisin','tre','skrap']`
  - `GameState.v: 3`
  - `toSkill(pips: number): number` → `8 + pips * 10`
  - `skillLevel(v: number): 'Elendig' | 'Grei' | 'God' | 'Rå'`, med grenser 0 / 25 / 45 / 70
  - `stat(c: CrewMember, k: StatKey): number` i `skills.ts`. Den gir 1–100 og legger til egenskapsbonuser ×10 (filmnerd +10 Nerver, buss +10 Kondis på oppdrag).
  - `gainXp(c: CrewMember, k: StatKey, amount: number): void` → `c.stats[k] = min(100, v + amount * (1 - v / 110))`
- Ferdigheter lagres som desimaltall. UI viser dem bare som stolpe og nivå.

- [ ] **Steg 1: Skriv feilende tester i `tests/skills.test.ts`**
  - `toSkill`: `toSkill(1) === 18` og `toSkill(5) === 58`.
  - `skillLevel`: `skillLevel(24) === 'Elendig'`, `skillLevel(25) === 'Grei'`, `skillLevel(45) === 'God'`, `skillLevel(70) === 'Rå'`.
  - `gainXp`: verdien øker, men mindre jo høyere den er. En gevinst fra 20 er større enn fra 80, og 2000 kall gir aldri over 100.
  - `stat` med filmnerd gir `stats.nerver + 10`.

  I `tests/engine.test.ts`:
  - Bytt `lagring` til `migrate({ v: 2 })` og `migrate({ v: 1 })`, som begge skal gi `null`.
  - `migrate(newGame(...))` skal gi samme tilstand tilbake.
  - `newGame` skal gi `res` `{ mat: 14, vann: 10, medisin: 2, tre: 3, skrap: 3, metall: 0, strom: 0, drivstoff: 0 }`.

- [ ] **Steg 2:** Kjør `npx vitest run tests/skills.test.ts tests/engine.test.ts`. Forventet resultat: FEIL.

- [ ] **Steg 3: Implementer**
  - Lag de nye typene, `skills.ts` og `migrate` (bare `v === 3` godtas).
  - Gjør om naboenes stats i `data.ts` med `toSkill`, og skriv tallene rett inn.
  - Rydd opp i `materialer` overalt:
    - Sektorbyttet deles i skrap `round(m * 0.6)` og resten i tre.
    - Porter koster `ceil(work / 3)` byggemateriale. Det tas fra den av skrap og tre som er størst, én om gangen.
    - I hendelser bytter du `materialer` til `tre` eller `skrap` etter hva teksten beskriver: sofa og hekk er tre, sykkelbod og bil er skrap.
  - Alle styrkeformler (`fightPower`, `detectChance`, `searchPower`, `buildPower`, `checkOdds`) bruker `stat(c, k) / 10` der de i dag bruker `stat(c, k)`. Da beholder de dagens styrke.
  - `SAVE_KEY` blir `'stavanger-z-v3'`.
  - Spilleroppretting holder på 1–5-prikker med 15 poeng. `SelfSetup.stats` regnes om med `toSkill` i `newGame`.
  - `statPips` blir stolper med nivånavn.
  - Toppfeltet viser ressursene i `PHASE_RES[phase]` pluss alle andre som er over 0.

- [ ] **Steg 4:** Kjør `npm test && npm run typecheck`. Forventet resultat: GRØNN, med balansetesten hoppet over.

- [ ] **Steg 5:** Kjør `npm run sim -- 300`. Notér vinnerandel og median i commit-meldingen. Ingen krav ennå.

- [ ] **Steg 6:** Sett `describe.skip` i `tests/balance.test.ts` med kommentaren `// av til Oppgave 9 i fase1-kjerneregler`.

- [ ] **Steg 7:** Lag grenen `fase1-kjerneregler` og commit: «Tilstand v3: nye ressurser og ferdigheter 1–100».

---

### Oppgave 2: Sektorer med tre verdier, Rydde og Sanke, forfall og kapasitet

**Filer:**
- Opprett: `src/engine/sectors.ts`, `src/engine/crew.ts`, `tests/sectors.test.ts`
- Endre: `types.ts`, `data.ts`, `engine.ts`, `phases.ts`, `events.ts`, `src/ui/panel.ts`, `src/ui/map.ts`, `src/styles.css`, `tools/bot.ts`, `tests/engine.test.ts`, `tests/events.test.ts`

**Grensesnitt:**
- Produserer, typer:
  - `type SectorKind = 'hjem' | 'butikk' | 'industri' | 'bolig' | 'natur' | 'kai' | 'offentlig'`
  - `SectorDef` får `kind`, `threat: 1|2|3|4|5`, `capacity: number` og `yield: Partial<Resources>`.
  - `SectorState = { z, hidden, searched /*0–100*/, control /*0–100*/, loot: Resources, lootMax, seen, scouted, settled, specialFound, dropped: CardInst[] }`. `miss`, `noise`, `cleared` og `special` fjernes.
  - `dropped` tas i bruk i Oppgave 3. Typen `CardInst` defineres allerede nå i `types.ts` som `{ uid: string; def: string; dur: number }`.
- Produserer, oppgaver: `Task` erstatter `klarere`, `lete` og `finsjekk` med `{ type: 'rydde' | 'sanke'; target: SectorId }`.
- Produserer, funksjoner:
  - `isSafe(sec: SectorState): boolean` → `z === 0 && hidden === 0 && searched >= 100 && control >= 50`
  - `housing(s: GameState): number`, summen av `capacity` for sektorer med `settled`
  - `canRecruit(s): boolean` → `s.crew.length < housing(s)`
  - `injure(s, c, why, log)` i `crew.ts`, flyttet fra `resolveDay`
  - `sectorIntel(s, id)` gir `{ estimate: string; searched: number; control: number; safe: boolean; threat: number | null }`. `threat` er `null` til sektoren er speidet.
- Produserer, fasetabell: nye knotter `controlDecay`, `searchedDecay`, `creepChance`, `encounterChance` og `turnCap`. Verdier for fase 1:

  | Knott | Fase 1 | Fase 2–5 |
  |---|---|---|
  | `controlDecay` | 5 | 6, 7, 8, 8 |
  | `searchedDecay` | 2 | 2, 3, 3, 3 |
  | `creepChance` | 0.12 | 0.15, 0.18, 0.2, 0.15 |
  | `encounterChance` | 0.18 | 0.2, 0.22, 0.24, 0.2 |
  | `turnCap` | 50 | 60, 70, 80, 90 |

  `encounterChance` brukes i Oppgave 5 og `turnCap` i Oppgave 7, men begge legges inn nå.

**Sektordata for Buøy:**

| id | kind | threat | capacity | yield |
|---|---|---|---|---|
| hjem | hjem | 1 | 6 | `{ vann: 2 }` |
| tommerodden | kai | 2 | 2 | `{ mat: 3 }` |
| obs | butikk | 2 | 0 | `{ skrap: 1 }` |
| nordkrysset | industri | 2 | 0 | `{ skrap: 2, drivstoff: 1 }` |
| buoy_nord | bolig | 1 | 6 | `{ mat: 1, vann: 1, tre: 1 }` |
| skolen | offentlig | 2 | 8 | `{ mat: 1, medisin: 1 }` |
| sorspissen | industri | 2 | 0 | `{ skrap: 2 }` |

Mat i sektorbyttet ganges med 1,3, rundet. `hjem` starter med `control: 60`, `settled: true`, `searched: 0` og `scouted: true`. Alle andre starter på 0 og `false`.

**Regler i `resolveDay`, i denne rekkefølgen:**

1. **Rydde, når `z > 0`:**
   - Drap regnes som i dag, ganget med `THREAT_KILL[threat]`, der `THREAT_KILL = [_, 1, 0.9, 0.78, 0.66, 0.55]`.
   - Skaderisikoen ganges med `THREAT_INJURY = [_, 1, 1.15, 1.35, 1.6, 1.9]`.
   - `searched` øker med 30 % av normal gevinst.
2. **Rydde, når `z === 0`:**
   - Gevinsten er `gain = clamp(sum(searchPower) * 4, 8, 45)`.
   - Skjulte zombier oppdages med `detectChance` som i dag.
   - Lageret tømmes med andelen `min(1, gain / max(1, 100 - searchedBefore))` av hver ressurs.
   - `searched` øker med `gain`, opp til 100.
   - Når `searched` når 100, blir alle gjenværende skjulte funnet og drept. Det gir ett skadekast «i den siste kjelleren».
   - `special` utløses når `searched` krysser 50.
3. **Sanke:** bare når `z === 0`. Hver ressurs gir `sround(yield[r] * (0.5 + 0.1 * searchPower))`. Gruppen summerer.
4. **Kontroll:**
   - Rydde og Sanke gir hver +10 per gruppe og dag.
   - Uten noen oppgave i sektoren går `control` ned med `controlDecay`, med mindre alle tre portene er på nivå 3.
   - Bosatte sektorer faller aldri under 50.
5. **Forfall:** når `control < 30`:
   - `searched` går ned med `searchedDecay`.
   - Med sjanse `creepChance * (1 - control / 30) * (1 - avgGateLevel / 3)` øker `z` med 1.
6. **Natt:** gjennombrudd og kjellerutbrudd som i dag, med to endringer:
   - Kjellerutbrudd skjer bare når `searched < 100`.
   - Begge gir `control -= 20`.
7. **Bosetting:** en sektor med `capacity > 0` blir `settled` første gang `isSafe` er sann.
7b. **Mat råtner:** hver 10. dag ganges `loot.mat` i alle sektorer med den nye knotten `foodRot` og rundes ned. Verdiene er fase 1: 0.85, fase 2: 0.8, fase 3: 0.75, fase 4: 0.75 og fase 5: 0.75. Dette er spesifikasjonens «mat blir vanskeligere å finne over tid».
8. **Fasemål:** `phaseProgress(s)` gir `{ safe, total, gates, done }`, der `done` betyr at alle i `PLAYABLE` er `isSafe` og alle porter er på nivå 2 eller mer.

Hendelser som kaller `addNeighbor`, sjekker `canRecruit(s)` først. Er det ikke plass, gir de tekst om at det er fullt.

**UI:**
- Sektorkortet viser type med ikon, trusselnivå («?» før speiding), tre stolper (infisering som anslag, gjennomsøkt og kontroll), «Trygg» som merke, og kapasitet og bosetting.
- Valgknappene er Rydde og Sanke.
- På kartet får sektorene et lite ikon for type. Fargen viser infisert, ryddet eller trygg.

- [ ] **Steg 1: Skriv feilende tester i `tests/sectors.test.ts`**
  - `isSafe`: krever alle fire betingelsene. Hver betingelse testes alene som usann.
  - `rydde på tom sektor øker searched og tømmer lager proporsjonalt`: med `searched` fra 0 til 100 over flere dager skal `lootLeft` ende på 0.
  - `searched 100 fjerner alle skjulte`
  - `kontroll forfaller uten folk`: etter én dag er `control` lik før minus 5.
  - `bosatt sektor faller ikke under 50`
  - `ingen forfall når alle porter er nivå 3`
  - `sanke gir sektorens ressurs`: Tømmerodden gir mat over 0.
  - `kapasitet`: `housing` er 6 ved start. `canRecruit` er usann ved 6 i crewet.
  - `mat i sektorlagre råtner hver 10. dag`: `loot.mat` på dag 11 er `floor(før * 0.85)`.
  - `forfall kan infisere en ryddet sektor igjen`: med control 0 og porter på 0 skal minst én av 50 seeds ha `z > 0` etter 10 dager.

  I `tests/events.test.ts`, i `valid()`: `s.crew.length <= housing(s)`.

- [ ] **Steg 2:** Kjør `npx vitest run tests/sectors.test.ts`. Forventet resultat: FEIL.
- [ ] **Steg 3:** Implementer reglene over i `sectors.ts` og `crew.ts`. Koble dem inn i `resolveDay`, oppdater `taskOptions` og `validateTasks`, og deretter UI og bot.
- [ ] **Steg 4:** Kjør `npm test && npm run typecheck`. Forventet resultat: GRØNN.
- [ ] **Steg 5:** Commit: «Sektorer med gjennomsøkt, kontroll og forfall. Rydde og Sanke».

---

### Oppgave 3: Utstyrskort

**Filer:**
- Opprett: `src/engine/cards.ts`, `src/engine/content/cards.ts`, `src/ui/cards.ts`, `tests/cards.test.ts`
- Endre: `types.ts`, `data.ts` (fjern `GEAR`), `engine.ts`, `sectors.ts`, `crew.ts`, `events.ts`, `src/ui/panel.ts`, `src/ui/modals.ts`, `src/styles.css`

**Grensesnitt:**
- Produserer, typer:
  - `type Slot = 'vapen' | 'beskyttelse' | 'verktoy'`
  - `type Family = 'makeshift' | 'for'`
  - `type Rarity = 'vanlig' | 'sjelden' | 'episk' | 'unik'`
  - `CardDef = { id; name; family; slot; level: 1|2|3|4|5; rarity; bonus?: Partial<Stats>; quiet?: boolean; durability: number; text: string; places?: SectorId[] }`. `places` gjelder bare unike kort.
  - `CrewMember.gear: Partial<Record<Slot, CardInst>>`
  - `GameState.stash: CardInst[]`
  - `GameState.uniques: Partial<Record<SectorId, string>>`, som seeden setter ved `newGame`
  - `GameState.nextUid: number`
  - `s.gear` fjernes.
- Produserer, funksjoner:
  - `CARDS: Record<string, CardDef>`
  - `newCard(s, defId): CardInst`
  - `equip(s, crewId, uid): boolean` henter fra `stash` og legger kortet som lå i sporet tilbake.
  - `unequip(s, crewId, slot): boolean`
  - `weaponMult(c)` gir `0.8` uten våpen, ellers `[_, 1.0, 1.2, 1.4, 1.6, 1.8][level]`.
  - `armorMult(c)` gir `1` uten beskyttelse, ellers `[_, 0.9, 0.8, 0.7, 0.6, 0.5][level]`. Den ganges med skaderisiko.
  - `toolMult(c)` gir `1` uten verktøy, ellers `[_, 1.1, 1.2, 1.3, 1.4, 1.5][level]`. Den ganges med `searchPower` og `buildPower`.
  - `wear(s, c, slot, log)` trekker 1 holdbarhet. På 0 ryker kortet og fjernes, og det skrives en logglinje.
  - `rollCard(s, maxLevel): CardInst`
  - `dropGear(s, c, where: SectorId | 'stash')`
- `stat` legger til `bonus` fra utstyret.

**Regler:**
- **Slitasje:** Våpen slites én gang per dag med Rydde når `z > 0`. Beskyttelse slites når personen tar skade. Verktøy slites per dag med Rydde, Sanke, Befeste eller Lage utstyr.
- **Funn:** Rydde på en sektor med `z === 0` gir kort med sjanse 0,25.
  - Kortnivå: `threat` med sjanse 50 %, ellers jevnt mellom 1 og `threat - 1`. Ingen kort over `threat`.
  - Familie: makeshift 75 %, fra før 25 %.
  - Sjeldenhet blant kandidatene vektes vanlig 6, sjelden 3, episk 1.
  - Unike kort trekkes aldri her.
- **Unike kort:** Ved `newGame` plasseres 2 av de unike kortene (seedet) i en sektor fra `places`. Et unikt kort kan ha nivå `threat + 1`. Det finnes når `searched` krysser 60.
- **Død:** `injure` kaller `dropGear` når en person dør. Med target `hjem`, eller uten target, havner utstyret i `stash`. Ellers havner det i `sectors[target].dropped`. Rydde eller Sanke i sektoren flytter alt fra `dropped` til `stash`, og det skrives en logglinje.
- **Lage utstyr:** ny oppgave `{ type: 'lage' }`.
  - Koster 3 skrap og 1 tre.
  - Lykkes med sjanse `clamp(0.3 + stat(mekk)/10 * 0.1, 0.3, 0.9)`.
  - Gir et makeshift-kort på nivå 1, eller nivå 2 hvis Mekk er God eller bedre.
  - Uten nok materialer skjer ingenting, og det skrives en logglinje.
- **Start:**
  - Spilleren får «20 mm K-rør» (makeshift, våpen, nivå 1) og «Baufil» (makeshift, verktøy, nivå 1).
  - Hver nabo får ett tilfeldig makeshift-kort på nivå 1.
  - Specials som før satte `gear`, gir nå et bestemt kort: Obs Bygg gir «Spikerpistol fra Obs», nivå 2. Politibilen i Nordkrysset gir «Hagle fra politibilen», nivå 2 og fra før.

**Katalog (plassholder):** minst 12 vanlige, sjeldne eller episke kort spredt over nivå 1–3 og alle tre spor, og 4 unike. Teksten skal være tørr og fra Stavanger.

**UI (`src/ui/cards.ts`):**
- Kortet vises som et lite brettspillkort med navn, spor, nivå som prikker, kantfarge etter sjeldenhet, holdbarhet som stolpe og tekst i kursiv.
- Crewkortet har tre spor. Et klikk åpner en velger med kortene på lageret som passer i sporet.
- Lageret vises som en egen liste i panelet.

- [ ] **Steg 1: Skriv feilende tester i `tests/cards.test.ts`**
  - `equip bytter og legger gammelt kort på lager`
  - `wear ødelegger kortet på 0 holdbarhet`
  - `rollCard overgår aldri maxLevel`, over 500 trekk for `maxLevel` 1, 2 og 3
  - `unike plasseres likt for samme seed og ulikt for ulike seeds`
  - `død ute legger utstyret i sektoren, død hjemme på lager`
  - `utstyr i sektoren overlever ny infisering og hentes med neste rydde`
  - `lage utstyr bruker 3 skrap og 1 tre og gir et makeshift-kort`
  - `ingen kort i katalogen har nivå over 5, og alle unike har places`
- [ ] **Steg 2:** Kjør `npx vitest run tests/cards.test.ts`. Forventet resultat: FEIL.
- [ ] **Steg 3:** Implementer motoren, katalogen og UI-en.
- [ ] **Steg 4:** Kjør `npm test && npm run typecheck`. Forventet resultat: GRØNN.
- [ ] **Steg 5:** Commit: «Utstyrskort med spor, holdbarhet, funn og unike kort».

---

### Oppgave 4: Vakt, Speide, Trene, Pleie, Lete etter overlevende, erfaring og ny leder

**Filer:**
- Endre: `types.ts`, `engine.ts`, `sectors.ts`, `crew.ts`, `skills.ts`, `src/ui/panel.ts`, `src/ui/modals.ts`, `tools/bot.ts`
- Opprett: `tests/tasks.test.ts`

**Grensesnitt:**
- Produserer `Task`-varianter:
  - `{ type: 'vakt'; target: GateId | SectorId }`
  - `{ type: 'speide' | 'overlevende'; target: SectorId }`
  - `{ type: 'trene'; stat: StatKey }`
  - `{ type: 'pleie' }`
- Produserer `GameState.needLeader: boolean` og `setLeader(s, crewId): boolean`.
- Produserer `canEndDay(s): boolean`. Den er usann når `needLeader` er sann. Oppgave 5 utvider den.

**Regler:**
- **Vakt på port:**
  - Teller som vakt om natta, som befeste gjør i dag.
  - Med port på nivå 3 og minst én vakt blir sjansen for gjennombrudd 0.
  - Befeste teller fortsatt som vakt. Rydde teller ikke lenger.
- **Vakt på sektor:** `control += 15 + stat(nerver)/10 * 3`.
- **Speide:**
  - Kan bare velges for sektorer som ikke er `scouted`.
  - Gir `scouted = true` og `seen = true`.
  - Gir logglinjen «Rykter om noe spesielt» hvis sektoren har et unikt kort.
  - Skaderisikoen er `0.03 * THREAT_INJURY[threat]`.
- **Trene:** `gainXp(c, stat, 5)`.
- **Pleie:** alle som hviler, får +1 liv uten å bruke medisin. Med egenskapen nattevakt kan pleieren også heale seg selv.
- **Lete etter overlevende:**
  - Bare i sektorer med `z === 0` og `kind` lik `bolig` eller `offentlig`.
  - Sjansen er `0.15 + stat(prat)/10 * 0.05`.
  - Lykkes det og `canRecruit` er sann, legges en tilfeldig nabo som ikke er med til (`addNeighbor`).
  - Er det fullt, skrives «Vi har ikke senger til flere», og ingen legges til.
  - Med sjanse 0,2 lager det bråk: `z += 1 + floor(rand*2)`.
- **Erfaring per dag:**
  - Rydde: Muskler 1,5 og Nerver 0,5.
  - Sanke: Snoking 1.
  - Speide: Snoking 1,5.
  - Befeste og Lage utstyr: Mekk 1,5.
  - Vakt: Nerver 1.
  - Overlevende: Prat 1,5.
  - Pleie: Prat 1.
- **Ny leder:**
  - Når personen med `me` dør og andre lever, settes `needLeader = true`.
  - `setLeader` setter `me` på en gjenlevende og nullstiller flagget.
  - UI viser en dialog etter dagsrapporten der spilleren velger blant de gjenlevende. Teksten er tørr.

- [ ] **Steg 1: Skriv feilende tester i `tests/tasks.test.ts`**
  - `vakt på port nivå 3 stopper alle gjennombrudd`: 100 netter med `day` 40, og ingen sektor får `z` fra porten.
  - `speide avslører trusselnivå`: `sectorIntel(...).threat` går fra `null` til et tall.
  - `trene øker valgt ferdighet`
  - `pleie heler uten medisin`
  - `overlevende overstiger aldri kapasiteten`: 200 dager med fullt crew, og `crew.length <= housing(s)` hele tiden.
  - `når lederen dør settes needLeader, og canEndDay er usann til setLeader`
  - `erfaring øker med oppgaven`
- [ ] **Steg 2:** Kjør `npx vitest run tests/tasks.test.ts`. Forventet resultat: FEIL.
- [ ] **Steg 3:** Implementer. UI-valgene i sektorkortet blir Rydde, Sanke, Speide, Vakt og Overlevende, og bare de gyldige vises. Trene, Pleie og Lage utstyr ligger i nedtrekkslisten på crewkortet.
- [ ] **Steg 4:** Kjør `npm test && npm run typecheck`. Forventet resultat: GRØNN.
- [ ] **Steg 5:** Commit: «Nye oppgaver, erfaring og ny leder når du dør».

---

### Oppgave 5: Encounters som venter til neste planlegging

**Filer:**
- Opprett: `src/engine/encounters.ts`, `src/engine/content/encounters.ts`, `tests/encounters.test.ts`
- Endre: `types.ts`, `engine.ts`, `crew.ts`, `src/ui/modals.ts`, `src/ui/panel.ts`, `src/main.ts`, `tools/bot.ts`

**Grensesnitt:**
- Produserer:
  - `EncounterCtx = { sector: SectorId | null; crew: CrewMember[]; threat: number; toktId?: string }`
  - `EncounterDef = { id; title; when?(s, ctx): boolean; text(s, ctx): string; choices: EncChoice[] }`
  - `EncChoice = { label; check?: StatKey; retreat?: true; run(s, ctx, ok): string }`
  - `PendingEncounter = { pid: string; def: string; sector: SectorId | null; crew: string[]; threat: number; toktId?: string }`
  - `GameState.pending: PendingEncounter[]`
  - `encounterOdds(s, p, choiceIdx): number`, som bruker `checkOdds` for gruppens beste
  - `resolveEncounter(s, pid, choiceIdx): { text: string; ok: boolean }`
  - `canEndDay(s)` er nå også usann når `pending.length > 0`.
- `resolveEncounter` fjerner det ventende kortet, kaller `checkEnd` og returnerer teksten.

**Regler:**
- Hver Rydde-gruppe utløser et encounter med sjanse `M.encounterChance * (0.7 + 0.3 * threat)`.
- Høyst ett per gruppe og høyst to per `resolveDay`.
- Kortet trekkes blant dem der `when` er sann, og det skrives en logglinje «… havnet i en knipe».
- Hvert `EncounterDef` har nøyaktig ett valg med `retreat: true`, og det står sist.
  - Når spilleren trekker seg ut, mister en tilfeldig person 1 liv via `injure` med sjanse 0,5. Ellers mister et tilfeldig utstyrt kort 3 holdbarhet.
  - Gruppen får ingen belønning.
- Ventende encounters der ingen i gruppa lever lenger, fjernes i `checkEnd`. Hvis crewet er tomt, settes `over = 'dead'` og `pending` tømmes.

**Innhold:** minst 6 plassholderkort, med minst ett for hver ferdighet. Belønning og straff skaleres med `ctx.threat`.

**UI:** Etter dagsrapporten og eventuelle hendelseskort vises hvert ventende encounter som en dialog. Dialogen har samme stil som `showEvent` og viser odds.

- [ ] **Steg 1: Skriv feilende tester i `tests/encounters.test.ts`**
  - `rydde kan gi ventende encounter, høyst to per dag`, testet over 200 seeds
  - `canEndDay er usann med ventende encounter`
  - `hvert kort har nøyaktig ett tilbaketrekk som siste valg`
  - `alle valg gir tekst og gyldig tilstand`, med samme `valid()` som i `events.test.ts`
  - `crewet dør mens noe venter: over blir dead og pending tom`
  - `samme seed gir samme encounter`
- [ ] **Steg 2:** Kjør `npx vitest run tests/encounters.test.ts`. Forventet resultat: FEIL.
- [ ] **Steg 3:** Implementer. Boten velger alltid det første valget som ikke er tilbaketrekk, men trekker seg ut hvis noen i gruppa har 1 i liv.
- [ ] **Steg 4:** Kjør `npm test && npm run typecheck`. Forventet resultat: GRØNN.
- [ ] **Steg 5:** Commit: «Encounters som løses ved neste planlegging».

---

### Oppgave 6: Tokt og første quest

**Filer:**
- Opprett: `src/engine/tokt.ts`, `src/engine/content/tokts.ts`, `tests/tokt.test.ts`
- Endre: `types.ts`, `engine.ts`, `events.ts`, `encounters.ts`, `src/ui/panel.ts`, `src/ui/modals.ts`, `src/ui/map.ts`, `tools/bot.ts`

**Grensesnitt:**
- Produserer:
  - `ToktDef = { id; name; desc; at: SectorId | GateId; days: number; threat: 1|2|3|4|5; quest?: string; reward: { cards?: string[]; res?: Partial<Resources>; flag?: Flag } }`
  - `QuestDef = { id; title; text; tokt: string; deadline: number }`
  - `ToktState = { id; crew: string[]; stage: number; haul: Partial<Resources>; cards: CardInst[]; awaiting: boolean }`
  - `GameState.tokts: ToktState[]`
  - `GameState.quests: { id: string; until: number; done: boolean }[]`
  - `Task { type: 'tokt'; target: string }`
  - `toktDecision(s, toktId, d: 'fortsett' | 'snu'): string`
  - `acceptQuest(s, questId): void`
  - `canEndDay` er nå også usann når et tokt har `awaiting`.

**Regler:**
- **Start:** Personer med `{ type: 'tokt', target }` når dagen løses, uten at toktet er aktivt, starter et `ToktState` med `stage: 0`. De er låst til toktet og kan ikke velge oppgave før de er hjemme. `taskOptions` viser tokt bare når det er tilgjengelig: fritt, eller med aktiv quest som ikke er utløpt.
- **Hver dag ute:**
  - `stage += 1`.
  - `haul` får `sround(rand * 2 * threat)` av 2 tilfeldige ressurser.
  - Kortfunn kommer som i Oppgave 3 med `maxLevel = threat`.
  - Det lages et ventende encounter med `toktId` og `threat`.
  - `awaiting = true`.
- **Etter encounteret** velger spilleren med `toktDecision`:
  - `snu`: crewet kommer hjem i natt, `haul` går til `res`, `cards` går til `stash` og oppgaven blir `hvile`.
  - `fortsett` når `stage >= days`: belønningen gis i tillegg, og crewet kommer hjem.
  - Ellers fortsetter toktet neste dag.
- **Død på tokt:** utstyret legges i `sectors[at].dropped` hvis `at` er en sektor. Er `at` en port, havner det i porten sin `sector`.
- **Quest:**
  - Et nytt hendelseskort «SOS fra kranføreren» (`when`: `day >= 6`) gir valget «Vi kommer» → `acceptQuest`, eller et avslag.
  - Questen utløper ved `until` med en logglinje. Belønningen gis bare hvis toktet er ferdig før det.
- **Innhold:**
  - Quest-tokt «Kranføreren på Rosenberg-gjerdet»: `at: 'ros'`, `days: 2`, `threat: 3`, belønning ett unikt kort pluss 4 skrap.
  - Fritt tokt «Køen på Bybrua»: `at: 'sor'`, `days: 2`, `threat: 3`, belønning `{ drivstoff: 4, skrap: 4 }`.

**UI:**
- Tokt vises som et merke på kartet ved `at`.
- Kortet i panelet viser varighet, trussel og belønning, og har knapper for crew.
- Etter et tokt-encounter kommer en dialog med «Fortsett» og «Snu», som viser hva gruppa bærer.

- [ ] **Steg 1: Skriv feilende tester i `tests/tokt.test.ts`**
  - `toktet starter, låser crew og lager ventende encounter`
  - `snu tar med haul og kort hjem`
  - `fullført tokt gir belønning og frigjør crew`
  - `quest-tokt er ikke tilgjengelig før questen er akseptert, og utløper ved until`
  - `død på tokt legger utstyret i målsektoren`
  - `canEndDay er usann mens et tokt venter på beslutning`
- [ ] **Steg 2:** Kjør `npx vitest run tests/tokt.test.ts`. Forventet resultat: FEIL.
- [ ] **Steg 3:** Implementer. Boten tar ikke tokt. Det skal være en spillervalgt risiko.
- [ ] **Steg 4:** Kjør `npm test && npm run typecheck`. Forventet resultat: GRØNN.
- [ ] **Steg 5:** Commit: «Tokt med fortsett eller snu, og første quest».

---

### Oppgave 7: Faseslutt, turgrense og mutasjonsmatrisen

**Filer:**
- Opprett: `src/engine/content/mutations.ts`
- Endre: `types.ts`, `phases.ts`, `engine.ts`, `src/ui/panel.ts`, `src/ui/modals.ts`, `tests/phases.test.ts`, `tools/bot.ts`, `tools/sim.ts`

**Grensesnitt:**
- Produserer, typer:
  - `type Branch = 'bevegelse' | 'sanser' | 'kropp' | 'atferd'`
  - `MutationDef = { id; branch; order: number; name; code: string; gene: string; desc: string; mult: Partial<Record<keyof PhaseModifiers, number>> }`
  - `GameState.mutations: string[]`, `knownMutations: string[]` og `branchWeights: Record<Branch, number>`, som settes ved `newGame` til `0.5 + rand` for hver gren
  - `GameState.goalDay: number | null` og `phaseStartDay: number`
  - `over` får verdien `'timeout'`.
  - `zombieTraits`, `ZOMBIE_TRAITS`, `traitPool` og `newTraits` fjernes.
  - `PhaseDef.mutationPoints: [min, max]` med verdiene 1: `[0,0]`, 2: `[1,2]`, 3: `[1,3]`, 4: `[2,3]`, 5: `[1,2]`.
- Produserer, funksjoner:
  - `mods(s)` ganger inn mutasjoner. Kjente mutasjoner gir faktoren `1 + (f - 1) * 0.5`.
  - `advancePhase(s): string[]` trekker poeng mellom min og maks. Hvert poeng velger en gren vektet med `branchWeights`, blant grener som har en neste mutasjon, og legger til den neste i rekkefølgen.
  - `canEndPhase(s)` → `goalDay !== null`
  - `endPhase(s)`: i fase 1 setter den `over = 'won'`, fordi fase 2 ikke finnes ennå. `advancePhase` kalles ikke.

**Regler:**
- `goalDay` settes første dag `phaseProgress(s).done` er sann. Spilleren kan avslutte fasen fra og med da, selv om sektorer senere faller.
- Når `day - phaseStartDay >= mods(s).turnCap`:
  - Hvis `goalDay` finnes, kalles `endPhase` automatisk.
  - Ellers blir `over = 'timeout'`.
- `checkEnd` setter ikke lenger `won` av seg selv.

**Mutasjonskatalogen (plassholder):**

| Gren | Mutasjoner i rekkefølge |
|---|---|
| Bevegelse | lopere `{ injuryMult: 1.25 }`, hoppere `{ nightLevelReduction: 0.85 }`, svommere `{}`, dykkere `{}` |
| Sanser | horsel `{ creepChance: 1.3 }`, lukt `{}` |
| Kropp | seige `{ killMult: 0.85 }`, pansret `{ killMult: 0.9 }`, giftig `{ injuryMult: 1.15 }` |
| Atferd | smarte `{ nightBase: 1.5, nightLevelReduction: 0.85 }`, flokk `{ breachDays: 0.75 }`, kjellergravere `{ hiddenRatio: 1.3, hiddenOutbreak: 1.4 }`, jegere `{}` |

Hver mutasjon har en pseudovitenskapelig `code` og `gene`, for eksempel `Z12-J1` og `OPH3S`.

**UI:**
- Målpanelet viser «Avslutt fase 1» når `canEndPhase` er sann, og antall turer igjen til grensen.
- Sluttskjermen viser dager brukt som poengsum. `'timeout'` får en egen tekst.

- [ ] **Steg 1: Skriv om `tests/phases.test.ts`**
  - `fase 1 gir ingen mutasjonspoeng`
  - `mutasjoner i en gren kommer i rekkefølge`: over 100 seeds med 4 `advancePhase` skal ingen ha `svommere` uten `hoppere`.
  - `samme seed gir samme mutasjoner`
  - `kjent mutasjon gir halv effekt`: med `seige` kjent er `killMult` lik `PHASES[2].mods.killMult * 0.925`.
  - `alle mutasjoner bruker knotter som finnes`
  - `turgrensen gir timeout uten mål, og seier med mål`
  - `endPhase krever goalDay`
- [ ] **Steg 2:** Kjør `npx vitest run tests/phases.test.ts`. Forventet resultat: FEIL.
- [ ] **Steg 3:** Implementer. Boten kaller `endPhase` samme dag som `canEndPhase` blir sann.
- [ ] **Steg 4:** Kjør `npm test && npm run typecheck`. Forventet resultat: GRØNN.
- [ ] **Steg 5:** Commit: «Faseslutt med turgrense og mutasjonsmatrise».

---

### Oppgave 8: Hendelser og tutorial

**Filer:**
- Endre: `src/engine/events.ts`, `tests/events.test.ts`, `src/ui/modals.ts`, `src/main.ts`, `src/styles.css`
- Opprett: `src/ui/tutorial.ts`

**Grensesnitt:**
- Hendelser bruker bare de nye feltene: tre og skrap, `searched`, `control`, kort via `newCard`, og `canRecruit` før `addNeighbor`.
- Hendelsen med fryseboks og elgkjøttdeig, og andre med mat, gir mat oftere. Minst 3 eksisterende kort skal kunne gi mat.
- `TUTORIAL: { day: 1 | 2 | 3; text: string; done(s): boolean }[]` i `src/ui/tutorial.ts`:
  - Dag 1: send minst to til Rydde på Hjemme.
  - Dag 2: sett noen på Befeste eller Vakt ved Rosenberg-gjerdet.
  - Dag 3: forklar Sanke og at kontroll forfaller.
- Tutorialen vises som et sambandskort øverst i panelet med «Skjønner» og «Hopp over tutorial». Valget lagres i `localStorage` under `'stavanger-z-tutorial-off'`, i try/catch.

- [ ] **Steg 1:** Utvid `tests/events.test.ts`: `valid()` sjekker også at `crew.length <= housing(s)` og at ingen ressurs er `NaN`. Kjør. Forventet resultat: FEIL, eller grønn hvis Oppgave 2–4 allerede dekket det. Notér hvilket.
- [ ] **Steg 2:** Oppdater alle hendelser, og lag tutorialen.
- [ ] **Steg 3:** Kjør `npm test && npm run typecheck`. Forventet resultat: GRØNN.
- [ ] **Steg 4:** Kjør `npm run dev` og spill dag 1–3 i nettleseren. Sjekk at tutorialen vises, kan hoppes over og ikke kommer tilbake etter ny innlasting.
- [ ] **Steg 5:** Commit: «Hendelser for nye regler og tutorial for de tre første dagene».

---

### Oppgave 9: Bot, balanse og dokumentasjon

**Filer:**
- Endre: `tools/bot.ts`, `tools/sim.ts`, `tests/balance.test.ts`, `src/engine/data.ts`, `src/engine/phases.ts`, `CLAUDE.md`, `README.md`

**Grensesnitt:**
- Produserer `GameState.stats.starvedDays: number`, som øker hver dag mat eller vann er tomt.
- Produserer `GameState.stats.deaths: Record<'kamp' | 'natt' | 'tokt', number>`, satt av `injure` ut fra hvor personen var.

**Boten skal gjøre følgende, i denne rekkefølgen:**
1. Hvile med 1 i liv.
2. Rydde den minst infiserte sektoren med inntil 3 personer.
3. Sette en person på vakt ved en port under nivå 2, eller med åpent gjennombrudd.
4. Befeste en port under nivå 2 hvis det er materialer.
5. Sanke når mat eller vann er under 3 dagers forbruk.
6. Rydde ryddede sektorer som ikke er trygge, til de er gjennomsøkt.
7. Vakt på sektoren med lavest kontroll som ikke er trygg.
8. Lage utstyr hvis noen mangler våpen.
9. Utstyre det beste fra lageret.

**Balansemål**, fra spesifikasjonen kapittel 11:
- Boten vinner minst 85 %.
- Median dager til seier er mellom 20 og 40. Det tilsvarer 20–30 dager for en god spiller.
- Median `starvedDays` per runde er 2 eller mindre.
- Sult er ikke den vanligste grunnen til at runder tapes. Testen ser på `deaths` og `starvedDays` i tapte runder.

Juster bare tall i `data.ts` og `phases.ts`, aldri regler. Hvis målene ikke nås etter 5 runder med justering, stopp og rapporter tallene.

- [ ] **Steg 1:** Skriv om `tests/balance.test.ts` med de fire målene, og fjern `.skip`. Kjør. Forventet resultat: sannsynligvis FEIL.
- [ ] **Steg 2:** Skriv om boten. Kjør `npm run sim -- 300`, som nå også skriver ut median `starvedDays`, dødsårsaker og andelen `timeout`.
- [ ] **Steg 3:** Juster tallene til `npm test` er grønn.
- [ ] **Steg 4:** Oppdater `CLAUDE.md`:
  - En lenke til `docs/spilldesign.md` som sannheten for spillregler.
  - Regelen om at innhold ligger i `src/engine/content/`.
  - Regelen om at valg om dagen lagres som ventende, ikke løses inne i `resolveDay`.

  Oppdater «Slik spiller du» i `README.md`.
- [ ] **Steg 5:** Kjør `npm test && npm run typecheck && npm run build`. Forventet resultat: GRØNN, og bygget lager `dist/`.
- [ ] **Steg 6:** Commit: «Bot og balanse for nye regler i fase 1».

---

## Etter planen

Når grenen er gjennomgått, kan disse kjøres parallelt som egne agenter. De rører bare `src/engine/content/` og tekst:

- **Utstyrskort:** etter spillerens eksempelkort.
- **Naboer og kallenavn:** etter spillerens retning.
- **Encounters og quests**
- **Visuelt:** kortillustrasjoner og ikoner.
