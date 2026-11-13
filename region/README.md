# Regionspillet v0.3 (QA)

> **v0.4 klar for spilltest:** Kartbasert HUD, animerte kartfigurer, personlig utstyr, fysisk logistikk og regional styring er implementert. Siste arbeid: [QA29-rettelser og spillerkontroller](docs/38_V04_QA29_FIXES.md), etter [UX-revisjonen](docs/36_V04_PLAYTEST_UX_REVISION.md). Tidligere [leveranse og testbevis](docs/35_V04_HUD_AND_QA.md). Tallbalansering og menneskelig langspilltest gjenstår. [Master spec](docs/27_V04_MASTER_SPEC.md), [beslutningslogg](docs/28_V04_DECISIONS.md) og [implementeringsplan](docs/29_V04_IMPLEMENTATION.md) beskriver den godkjente rammen.

Dette er regionspillet: hele Stavanger-regionen med 663 soner. Det er en egen kodebase ved siden av Buøy-spillet i rotmappen.
- **Start:** du kan starte hvor du vil, også steder som er nesten umulige å holde.
- **Faser:** fem faser med egne mål.
- **Samfunnet:** befolkningen får arbeid, og du styrer med lover i unntakstilstand. Håp og uro, lojalitet i crewet og mytteri følger av valgene.
- **Forskning og forsvar:** et forskningstre med spesialisering etter HQ-type, perimeter i fire trinn og zombier som muterer.
- **Grupper:** Gjengen krever beskyttelse, og Fellesskapet smiler til det forråder dere.
- **Hendelser:** 115 hendelser og kjeder som husker valgene dine.
- **Nytt i v0.3:**
  - seks unike steder: cruiseskipet, Utstein, Ullandhaugtårnet, flyet på Sola, Domkirken og Arenaen
  - eget mørkt 3D-kart med tåke og zombiebevegelser
  - plass til bilder fra Codex
  - rettelser etter QA-runde 1 og 2

```bash
cd region
pnpm install
pnpm dev                  # http://127.0.0.1:3000
pnpm region:bot 150 3 8   # boten spiller fra mange startområder, JSON-oppsummering til slutt
pnpm region:events        # prøver alle hendelser og alle valg
```

- **Design, tall, bot-runde og hva QA bør se etter:** [docs/26_V03.md](docs/26_V03.md) og [docs/24_V02_DESIGN.md](docs/24_V02_DESIGN.md). Bildebestillingen til Codex står i [docs/25_ART_BRIEF.md](docs/25_ART_BRIEF.md). Grunnreglene står i [docs/23_REGIONSPILL.md](docs/23_REGIONSPILL.md).
- **Balansetall:** `packages/gameplay/src/region/systems.ts` og `rules.ts`.
- **Soneeditoren** (`pnpm zones`) virker ikke fra repoet. Cellene og Python-verktøyene ligger bare lokalt, og spillet trenger dem ikke. Det leser `apps/game-client/public/world/region-v1.json`.

---

# Stavanger Z – Codex handoff v0.1

Oppdatert 02.11.2026 med [låste designbeslutninger](docs/15_LOCKED_DESIGN_2026-11-02.md) og ny lokal prøveslice for fase 1.

## Oppdrag

Bygg et nytt, turbasert, geografisk zombieapokalypsespill med Hundvåg/Buøy i Stavanger som første testverden. Bruk eksisterende spill som inspirasjon og læring, men ikke som bindende kodearkitektur. Spillet skal føles som en postapokalyptisk kommandosentral og utvikle seg fra fire overlevende på dag 0 til styring av større samfunn og regioner.

**Første målstrek** er en spillbar fase 1 med begrensede ressurser, vedvarende letearbeid, rekrutteringsvalg og forsvar. Spilltesten undersøker de første 10–15 dagene og veien fra ly til operasjonsbase. Permanent HQ og effektiv kontroll av et L2-område definerer overgangen til fase 2.

## Start her for Codex

1. Les `AGENTS.md` (bindende arbeidsregler).
2. Les `docs/01_GAME_DESIGN.md` til `docs/08_OPEN_DECISIONS.md`.
3. Bruk `docs/09_PLAYTHROUGH_AND_VALIDATION.md` som minimal akseptanse.
4. Se `assets/command-center-concept.png` som visuell retning, ikke som eksakt kart/UI-spesifikasjon.
5. Presenter en kort plan og de reelt blokkerende spørsmålene før større implementasjon. Beskytt eksisterende brukerarbeid.

## Besluttet, foreslått og åpent

**Besluttet (B)** omfatter én dag per tur, geografiske ordrenivåer, ekte kart og POI-er, individuelle overlevende, permanent mulig tap og gjenoppbygging. Alle egnede overlevende kan lede. Veikartet beholder PvE-samarbeid, forskning, samfunn, zombieutvikling og to seiersretninger gjennom kur eller varig regional stabilitet.

**Arbeidshypotese (H):** Browser-first med React/Next.js, kartmotor, TypeScript-simulering og PostgreSQL/PostGIS; serverautoritativ turbehandling; Hundvåg som begrenset vertikal slice.

**Åpent (Å):** Presise sonegrenser, kampformel, ressursrater, antall crew, faseoverganger, HQ-bygninger, mutation traits, poengregler og de endelige seierstersklene. De skal ikke hardkodes som ubegrunnede sannheter.

## Dokumentoversikt

| Fil | Hensikt |
| --- | --- |
| `AGENTS.md` | Orkestreringskontrakt, scope og arbeidsregler |
| `docs/01_GAME_DESIGN.md` | Visjon, faser, kjerneløkke og seier |
| `docs/02_WORLD_MODEL.md` | L1/L2/L3, soner, POI-er, veier og grenser |
| `docs/03_TURN_SIMULATION.md` | Daglig løsning, zombier, kamp og determinisme |
| `docs/04_GAME_SYSTEMS.md` | Crew, økonomi, utstyr, HQ, forskning, diplomati |
| `docs/05_TECH_ARCHITECTURE.md` | Teknisk struktur, data, sikkerhet, kart |
| `docs/06_UI_UX_DIRECTION.md` | UI-retning og informasjonsarkitektur |
| `docs/07_DELIVERY_PLAN.md` | Prioriteringer, milepæler og scope-kontroll |
| `docs/08_OPEN_DECISIONS.md` | Uavklarte valg og anbefalte utgangspunkter |
| `docs/09_PLAYTHROUGH_AND_VALIDATION.md` | Små, konkrete verifikasjoner og spilletest |
| `docs/15_LOCKED_DESIGN_2026-11-02.md` | Eierens låste designbeslutninger |
| `docs/16_PHASE1_SLICE.md` | Første 15 dager, forgreningsvalg og vannkjede |
| `docs/20_ZONE_EDITOR.md` | Soneeditor: mal celler til L1/L2/L3 og bygg ut kartet |
| `docs/23_REGIONSPILL.md` | Regionspillet: start, regler, hendelser, handel og QA |

## Bevisst utelatt fra MVP

Hele Rogaland, fase 3–5 i implementasjon, omfattende craftingtre, detaljert bekledning, reell PvP, dynamisk genetikksimulering, visuell 3D, mobil-native app, avanserte AI-agenter og global høyscore-tjeneste.

Spillet kan planlegges for dette, men koden skal først bevise at dag 0 til HQ er interessant.

## Lokal M1-gjennomgang

Geografisk utkast er implementert, men grensene er ikke låst. Se `docs/10_M1_GEOGRAPHY_REVIEW.md` for soner, ruter, begrensninger og godkjenningspunkt. Kilder og uttrekk er dokumentert i `packages/world-data/data/SOURCES.md`.

Kjør `pnpm install --frozen-lockfile` og `pnpm dev` fra denne mappen, og åpne http://127.0.0.1:3000 . Smale kontroller: `pnpm validate:world` og `pnpm typecheck`. For produksjonsvisning: stopp dev, kjør `pnpm build`, deretter `pnpm start`.

Kartet bruker lokalt OSM-uttrekk uten eksterne fliser. M1 er godkjent og M2 er ferdig som separat, ren headless motor. Geografivisningen er bevart på `/kart`.

## Publisert M3 og lokal fase 1-forhåndsvisning

Spillet startes med `Stavanger Z.cmd`, som starter både spillet og soneeditoren. Se [regionspillet](docs/23_REGIONSPILL.md). Sonegrenser lages i [soneeditoren](docs/20_ZONE_EDITOR.md): dobbeltklikk `Soneeditor.cmd`. Der setter du også sonetype, ressurser og steder med HQ-rolle. World Editor brukes foreløpig bare til forbindelser. Den åpnes lokalt på `/world-editor`. Kjør `node scripts/build-portable.mjs --editor` for å lage en selvstendig HTML-fil som kan åpnes direkte i nettleseren. Begge starter med Hundvåg nord og viser samme redigerbare utkast. Bruk **Sikkerhetskopi** for å ta vare på redigeringer og låser, og **Valider og eksporter verden** for å lage en versjonert WorldDefinition. Se [arbeidsflyten for World Editor](docs/19_WORLD_EDITOR.md).

Produktretningen etter spilltesten til dag 15 ligger i [fase 1-revisjonen](docs/17_PHASE1_DESIGN_REVISION.md). Den har forrang der eldre designnotater beskriver andre regler. Se [gjennomgangen av forskjellene](docs/18_PHASE1_REFINEMENT.md) for avgrensning og rekkefølge.

Spill på nett: **https://stavangerz2.vercel.app/** (Vercel, Lorentzen Smart Labs). Publisert 02.11.2026. Fremdrift lagres lokalt i nettleseren; en tidligere lokal gjennomspilling kan flyttes med eksport/import under Lagring.

Publisert M3 starter et solospill med fire forskjellige overlevende, dagsplan, kamp, forsyningsoppdrag og lokal lagring. Første mål er et lite anneks ved Buøy idrettsanlegg. Rosenberg er et senere strategisk mål.

Den lokale fase 1-forhåndsvisningen har eget lagringsnavnerom. Spilltilstand og eksportfiler fra de to regelsettene håndteres separat. Produksjonsutrullingen på Vercel står på M3 mens forhåndsvisningen prøves lokalt.

`pnpm build:portable` lager `dist/stavanger-z-phase1.html`: én selvstendig HTML-fil med kart, spillmotor og grensesnitt inkludert. Åpne filen i en moderne nettleser. **Lagring → Last ned lagring** gir en flyttbar sikkerhetskopi. En enkel lokal HTTP-server kan også vise samme fil. Ingen konto eller ekstern karttjeneste er nødvendig.

Smale kontroller: `pnpm check:simulation`, `pnpm check:gameplay`, `pnpm validate:world` og `pnpm typecheck`. Se [fase 1-slicen](docs/16_PHASE1_SLICE.md) for spillerreisen. Neste vurdering er eierens første 10–15 dager.

`pnpm build:vercel` lager fase 1-kandidaten i `dist/vercel-phase1/`. Kommandoen publiserer ingenting. Den publiserte M3-versjonen er dokumentert i [Vercel-loggen](docs/14_VERCEL_DEPLOYMENT.md).
