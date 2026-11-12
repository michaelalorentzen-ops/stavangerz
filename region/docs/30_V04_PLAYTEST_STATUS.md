# v0.4 – samlet spillteststatus

Dato: 12.11.2026. Arbeidet gjelder bare `region/`. Ingen merge til main eller deploy er utført.

## Gjenopprettet baseline

Checkout startet tomt. Repositoryet ble klonet, og `feat/v04-phase-one-playtest` ble opprettet direkte fra `origin/feat/v04-phase-bot-policy` (`da16b82`). Ingen lokale brukerendringer fantes eller ble overskrevet.

Åpne eksisterende drafts ved oppstart: #12, #14, #15, #16, #18, #19, #21, #22, #23. #13, #17 og #20 er issues. Den samlede motorhistorikken var #23 → #22 → #21 → #19 → #18 → #16 → #14 → #12. Dagsrapporten fra #15 var allerede integrert i #19.

**Avvik:** dokumentasjonscommits for D24/D25 og M1-status lå på `docs/v04-orchestration`, men var ikke forfedre til `da16b82`. Disse ble hentet inn uten å erstatte motorgrenen. De nyere, separate ZA-bok- og soneanimasjonsfilene ble vurdert og integrert; begge var ubrukte hjelpefiler på sine kildegrener.

## Implementert i UI-leveransen

- Kartet er fast hovedflate på desktop og mobil. Mannskap og sonepanel åpnes over kartet på mobil, og dagsknappen er alltid tilgjengelig.
- Færre primærmenyer; dypere oversikter ligger under Oversikter. Dagsplanen beholdes separat, med kansellering og synlig kapasitet.
- Veiviser som kan foldes sammen, lesbare ferdigheter/personbeskrivelser og eksplisitt hovedpersonvalg med portretter.
- Lokal bildepakke: fire faste portretter, intro og gjenbrukbare rapportmiljøer. 12 WebP-bilder, ca. 2 MB. Stil er fortsatt O12-hypotese.
- ZA-bok med låste fasekapitler, alltid åpen håndbok og feltguide avledet av faktisk spilltilstand. D25-status hentes fra motorens `phaseOneReadiness`.
- Polygonklippet overtakelse/tap koblet til presentert journaltilstand. Maks åtte synlige L3-soner ved zoom ≥12, 20 fps, cleanup og redusert bevegelse. Kartet flyttes bare etter eksplisitt spillerhandling.
- Sonesøk gir et alternativ til presise kartklikk. Ukjente grupper og POI-navn skjules i sonepanelet.
- Overtakelseskrav viser motorens faktiske regler, fremfor et misvisende gammelt estimat for arbeidstimer som ikke brukes av claim.
- Rettet lukkeknapp som ble dekket av rapportinnhold. Etter hendelsesvalg hentes oppdatert autoritativ rapport; gammel «krever valg»-linje undertrykkes når samme rapport inneholder det faktiske valget.
- Tastaturfokus holdes i aktiv dialog, og Escape lukker valgfrie oversikter. Tom dagsplan får eksplisitt kontroll før døgnet går.

## Verifisering og observerte resultater

Reproduserbar nettleserreise: `scripts/check-region-ui.ts`. Testen bruker faktisk UI fra start, leser hele introen, velger Ingrid, åpner håndbok/feltguide, splitter første dags oppdrag manuelt, kansellerer/planlegger på nytt og går gjennom flere døgn. Senere dagsplaner velges av testboten, men registreres og gjennomføres med knapper i UI. Det er ikke en uavhengig menneskelig balansetest.

Før gear-integrasjonen bestod **8 døgn på desktop (1440×1000)** og **6 døgn på mobil (390×844)** med seed 101 i Lundsneset, ingen nettleserfeil, ingen horisontalt overløp og eksakt lik autoritativ save etter reload. Reisen omfattet rydding, søk, rekruttering av befolkning, soneovertakelse, HQ, fiske, dyrking, modulbygging, hvile, avspilling/skip, hendelsesvalg og dagsrapporter. Alle fire navngitte personer levde ved slutten. Sluttkartets høyde var 860 px på desktop og 667 px på mobil.

Motorprøver for lokasjon, replay, checkpoint, D25 og gammel claim-regresjon består. Eksisterende simulation/gameplay-kontroller består. Eventtesten registrerer 115 hendelser, bygger 111 på 16 tilstander, og alle prøvde valg løses; fire betingede hendelser er ikke dekket.

Bot-baseline før gear: **17 kuraterte starter × 40 døgn, seed 101**. 15 overlevde; 3 kom videre fra fase 1 (alle var i fase 3 ved slutt). Snitt 2,7 soner og 6,8 sultdøgn. Dette underbygger fortsatt balanse-/strategirisiko; det beviser ikke menneskelig softlock. D25-terskler er ikke endret.

Kommandoer fra `region/`:

```sh
npx --yes pnpm@10.17.1 install --frozen-lockfile
pnpm typecheck
node --import tsx scripts/check-v04-location.ts
node --import tsx scripts/check-v04-replay.ts
node --import tsx scripts/check-v04-checkpoint.ts
node --import tsx scripts/check-v04-phase-gate.ts
pnpm region:claim
pnpm check:simulation
pnpm check:gameplay
pnpm region:events
pnpm region:bot 40 1 0
pnpm build
# Med serveren kjørende i et annet terminalvindu:
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium pnpm check:region-ui
```

`PLAYWRIGHT_CHROMIUM_EXECUTABLE` kan utelates hvis Playwrights egen Chromium er installert. Skjermbilder og reisedagbok skrives til ignorerte `region/artifacts/region-ui/`. Testen bruker en isolert nettleserprofil og berører ingen personlig nettleserlagring.

Installasjonsavviket fra eldre PR-er ble reprodusert: miljøets `pnpm` var 11, mens prosjektet angir 10.17.1. Ren, låst installasjon med deklarert versjon og eksplisitt `onlyBuiltDependencies: [esbuild]` består. Ingen eksisterende brukerfil ble gjenopprettet eller overskrevet.

## Pågående neste leveranse: personlig gear

Mikki avklarte D26/O05 i denne økten: bygg våpen, beskyttelse og oppdragsverktøy med auto-equip, manuelle låser og faktisk reservasjon/retur. Dette er delegert som egen motorpakke og isolert UI-komponent. Det er **ikke** del av den ferdigverifiserte UI-baselinen over. Tall, slots og lootmengder er hypoteser; ny detaljert reisetids-/transportmodell er ikke bestemt.

## Fortsatt mangler / avgrensninger

- Fullt v0.4 er ikke ferdig. De tre vanskelighetsgradene og Hardcore-reglene er ikke implementert.
- Crew-geografi, radioeskalering, flerdøgnsreiser og lokal transport/logistikk er ikke et ferdig system. Kartet animerer ikke oppdiktede crew-ruter.
- Døgnreplay viser statusendringer, journal og synlighetsfiltrerte nattbevegelser; det er ikke et komplett historisk snapshot av HP, intel og alle ressurser per tidspunkt.
- Dagsrapportprioritet bruker eksisterende toner/tekst som deterministisk fallback; full semantisk hendelsestaksonomi gjenstår.
- Ingen nye kanoniske POI-/personbundne sidehistorier er innført. O06/O07/O13 må respekteres før irreversible fortellingsvalg.
- Hele M2/M3 og endelig balanse kan ikke kalles ferdig. Neste menneskelige spilltest bør særlig undersøke fremgang etter HQ, gjentakende oppdrag, forsvarskostnad, forsyning og forståelsen av D25.
