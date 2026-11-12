# v0.4 – personlig utstyr og integrert spilltest

Dato: 12.11.2026. Bygger på [UI-baselinen](30_V04_PLAYTEST_STATUS.md), draft #25 og bildepakken #24. Arbeidsgren: `feat/v04-personal-gear`. Ingen merge til main eller deploy.

## Hva som er bygget

D26/O05 er implementert som en avgrenset fase-1-loop med tre kategorier: våpen, beskyttelse og oppdragsverktøy.

- `gear.ts` eier unike gjenstander, faktisk holder/depot, oppdragsbinding, funnkilde, vedvarende manuelle preferanser og rapportert kunnskap.
- `prepareGearPlan` er en ren, felles reservasjonsplanlegger for UI og motor. Første gyldige ordre får førstevalg. En gjenstand kan ikke brukes av to personer eller oppdrag samtidig. Endring, kansellering og gyldig overlevering i samme lag frigjør utstyr uten duplisering.
- Auto equip er standard. Manuelle valg låser én kategori; øvrige kan fortsatt velges automatisk. Bevisst tom kategori og Auto equip AV støttes. Ugyldige låser varsles og erstattes ikke i stillhet.
- Dagsplanen viser faktisk foreslått/reservert utrustning. Utstyrsknappen åpner en valgfri editor; normal planlegging krever ingen ekstra modal. Lager kan vise beholdningen uten et oppdrag.
- Våpen bruker eksisterende ammo-/støy-/kampregler. Beskyttelse demper fysisk skade uten å stoppe bitt. Verktøy har faktisk virkning på søk, observasjon, bygging eller behandling; tallene ligger i katalogen, ikke i React.
- Søksloot er endelig og seedet gjennom sonens gjennomsøkingsprogresjon. Gamle gjennomførte søk spiller ikke ut funn på nytt. Nytt gear bruker bærekapasitet før materialloot, og hver gjenstand beholder proveniens selv etter tap.
- Personer og gear bindes til et oppdrag gjennom nattcheckpoint. Folk ute i felten kan ikke samtidig forsvare HQ. Oppdragsverktøy og nye funn blir tilgjengelige etter faktisk retur/levering. Bortetid, skade, død, eksplisitt lokasjon og gammelt retursted respekteres.
- HQ-adresseendring flytter ikke utstyr fra et gammelt depot. Eksisterende felles gruppeflytting kan ta med lagret gear innen ledig bærekapasitet; aktive bortelag følger ikke automatisk med. UI advarer ved etablering av HQ på et annet sted.
- Nye funn forblir urapporterte til de faktisk leveres. Et enslig lag som dør uten å rapportere røper ingen nye gearnavn. Tidligere kjent utstyr kan vises som tapt. UI og ZA-boka bruker `knownGearItems`, aldri rå ledger som kunnskapsgrunnlag.
- Eksisterende hendelser som tar fra en person våpen virker også med ny utrustning. Hendelser som krever skytevåpen ser faktisk utrustning, ikke bare gammel `weapon`-scalar.

## Kompatibilitet og kontrakter

`RegionState.gear` og `RegionOrder.gear` er valgfrie. Eksisterende `region-2`-saves kan leses uten mutasjon eller migrering. Startvåpen avledes idempotent fra eksisterende personer; tapte starter-ID-er oppstår ikke på nytt. Tilstanden er JSON-serialiserbar, inkludert checkpoint, preferanser, oppdrag og proveniens.

Verdens-ID-er, geometri, grunnleggende materialøkonomi, zombiepopulasjon og D25-terskler er bevart. Nattforsvar påvirkes av rettingen som fjerner samtidige HQ-forsvarere ute i felten. Gear påvirker naturligvis arbeidsytelse, støy, kamp og skade.

## Hypoteser og avgrensninger

Dette er ikke et ferdig transportsystem. Vanlige dagsoppdrag følger eksisterende ett-døgnsmodell og returnerer ved neste 07; eldre `awayUntil` kan forlenge bindingen. Ingen ny detaljert reisetids-/kjøretøymodell er innført. Eksplisitte `crewPositions` overstyres ikke.

Et lag som returnerer til gammelt leirsted etter HQ-flytting registreres der. Lageret der og laget blir ikke automatisk tilgjengelig i nytt HQ. Et separat hente-/omdirigeringsoppdrag gjenstår. Velg samme leirsted som HQ for den enkleste sammenhengende fase-1-testen.

Ett slot per kategori, auto-score, verneprosenter, verktøybonuser, søketerskler og tre endelige caches per sone er **H09-hypoteser**, ikke nye låste produktbeslutninger. Generell katalogvekt er ikke en full modell for slitasje eller personbæring. Vanskelighetsgrader, Hardcore, radiosystem, større transportmodell og nye kanoniske POI-historier er fortsatt utenfor denne leveransen.

## Verifisert motor og bygg

- Direkte TypeScript og Next 16 produksjonsbygg: bestått på integrasjonen.
- Ny `scripts/check-v04-gear.ts`: bestått. Dekker ren planlegging, prioritet, cancel/reorder, samme-lag overlevering, tomme/manuelle låser, default/off, faktiske effekter, endelig loot, tidligere søk, depot/retur, bortetid, skade/død, ukjent transit, HQ-flytting, konfiskering, urapportert død speider og JSON-checkpoint.
- Checkpoint/replay/lokasjon/claim/D25-regresjoner: bestått. Samme pause/fortsett-valg gir samme resultat, og ammo belastes én gang.
- Eksisterende simulation/gameplay/events: bestått av motorpakken. Eventtesten bygger 111 av 115 registrerte hendelser; alle prøvde valg løses. Fire betingede hendelser er fortsatt ikke dekket.
- Bot etter gear: 17 kuraterte starter ×40 døgn, seed101: 14 overlever, 14 avslutter i fase1 og 3 i fase3, snitt 2,6 soner og 6,6 sultdøgn. Før gear var overlevelsen 15/17. Dette er en ny kombinert baseline for gear og fysisk HQ-forsvar, ikke et isolert kausalbevis eller endelig balanse.

## Determinismefeil funnet i nettleserprøven

Den separate nattcheckpoint-prøven avdekket at `sort(() => rng() - .5)` ga ulik offerrekkefølge i Node og Chromium med samme seed. En tilfeldig comparator er ikke transitiv, og sorteringsalgoritmen kan forbruke RNG ulikt mellom kjøremiljøer. Den er erstattet med eksplisitt seedet Fisher–Yates-stokking med fast antall RNG-kall. Dette er en feilretting, ikke et nytt kamp- eller fasekrav. Checkpoint-/gear-/replay-/D25-/claim-regresjonene består etter rettingen; ny bot-baseline og kryssruntime-prøve består også. Fisher–Yates-endringen ga samme overordnede 17×40-resultat som gear-baselinen over.

## Nettleserstatus

Den utvidede produksjonsreisen er gjennomført med `scripts/check-region-ui.ts`. Den omfatter manuelle gear-låser, Auto equip av/på, loot, lager/feltguide, faktisk touch på mobil, rapportarkiv, normal avspilling/skip og eksakt save/reload, i tillegg til den opprinnelige spillerreisen.

En separat checkpoint-fixture bruker motorens faktiske pauseobjekt i en isolert nettleserprofil. Den prøver redusert bevegelse, obligatorisk valg, reload før/etter og sammenligner UI-resultatet med én deterministisk motorfortsettelse. Hovedreisene starter normalt og injiserer ingen spilltilstand.

**Sluttresultat: bestått.**

| Prøve | Verifisert resultat |
| --- | --- |
| Desktop, 1440×1000 | 8 døgn fra normal start; intro, hovedperson, ZA-bok, dagsplan/cancel, manuelle gear-låser, Auto equip av/på, faktisk loot, overtakelse, HQ, matproduksjon, hvile, avspilling/skip, hendelsesvalg, rapportarkiv og eksakt save/reload. |
| Mobil, 390×844 med touch | Samme kjerneflyt gjennom 6 døgn, inkludert faktisk skjerm-touch på leirmarkøren, utstyr, lager/feltguide og rapportarkiv. Ingen horisontalt overløp. |
| Nattcheckpoint, mobil + redusert bevegelse | Valget kan ikke avvises med Escape eller omgås med skip. Reload før valget bevarer checkpoint. UI-resultatet er helt likt Node-motorens deterministiske fortsettelse. Reload etterpå belaster ikke ammo på nytt: 40 → 35 én gang. |
| Målrettet kontroll av siste bygg | Alle fire portretter laster. Lagreknapp for utstyr er synlig uten å bla gjennom alle personkort på desktop og mobil. En gyldig veiforbindelse kan planlegges allerede i fase 1; UI innfører ingen ekstra fasegate. |

De to hovedreisene hadde ingen pageerrors, beholdt alle fire navngitte personer og endte med fem unike gear-items, hvorav ett faktisk søksfunn. Desktop dag 8: 73,6 mat, 116,8 vann og ett kontrollert område; mobil dag 6: 70 mat, 104,8 vann og ett kontrollert område. Dette er en første spillreise, ikke en full menneskelig fase-2-gjennomspilling eller balansegodkjenning.

En mellomliggende produksjonsrunde ble avbrutt av en miljørekobling og ble ikke regnet som bestått mobiltest. Den fullførte mobilreisen og den endelige checkpoint-kontrollen erstatter denne. Siste backendendringer for kanonisk plassering og offerstokking er prøvd med målrettede motor-/nettleserregresjoner; de vanlige reisene bruker legacy-fallback for plassering.

Artefakter: `artifacts/gear-ui/` (desktop), `artifacts/gear-ui-mobile/` (mobil), `artifacts/final-checkpoint/` (siste checkpoint) og `artifacts/final-*-equipment.png` (faste utstyrshandlinger). Loggene og bildene er lokale og ignorerte i Git.


Kjør fra `region/`:

```sh
npx --yes pnpm@10.17.1 install --frozen-lockfile
npx --yes pnpm@10.17.1 typecheck
npx --yes pnpm@10.17.1 region:gear
npx --yes pnpm@10.17.1 build
# Start produksjonsbygget i ett terminalvindu:
npx --yes pnpm@10.17.1 start
# Kjør den isolerte nettleserreisen i et annet:
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npx --yes pnpm@10.17.1 check:region-ui
```

Playwrights egen Chromium kan brukes ved å utelate executable-variabelen. Testartefakter er lokale og ignorerte: `region/artifacts/gear-ui/`.
