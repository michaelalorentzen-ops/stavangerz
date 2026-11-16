Kilde: https://github.com/michaelalorentzen-ops/stavangerz/pull/34#issuecomment-6904278053
Oppdatert i GitHub: 2026-11-16T11:16:03Z

**Stavanger Z QA – runde 2**

Testet head: `ea14093e94874cd5a65fbfe27473a6da1d72c75c` (commit 16.11.2026 **11:43 Oslo-tid**), draft, base `main` @ `5a2bebe`. Runde 1 dekket `913b458`. Nye commits siden da: `3d6c6cc` (F05), `94bc455` (F02), `8e9f427` (F01/F03), `6bb83c6` (F04/F06) og `ea14093` (test/bevis). Ingen spillkode eller tall er endret av QA. Vurdert mot et ferdig premium web-PC-spill (1280/1920 primær, 390 sekundær). For hver score under 5 står det hva som mangler, et forslag, forventet effekt og innsats.

**Teknisk:** `pnpm install --frozen-lockfile`, `typecheck`, `validate:world`, `build` og `region:events` («All choices resolve») er grønne. `check:v04` er grønn med nøyaktig de samme PASS-linjene som i runde 1 (diff tom). Alle seks offisielle UI-reiser (start, HUD, contexts, sjekkpunkt, kart, clarity), de fem fra #33, `check:region-content-ui`, `check:region-qa33-ui` og den nye `check:region-cues-ui` er grønne. Den siste har «PASS live map 1280/390: real scout, full place name, readable text, no clipping/occlusion». Min egen økt hadde 0 `pageerror`, 0 native dialoger, `blocked: []` og ingen OSM/Overpass-kall. `/usr/bin/chromium` finnes ikke på QA-maskinen, så reisene kjørte med samme Playwright-Chromium-override som i runde 1.

**Offisiell bot** `pnpm region:bot 150 3 8`, to kjøringer, **byte-identiske** og også identiske med runde 1 (sha256 `51796914…0bc8`): **42/75** overlevd, **0 seire**, **0 krasj** (tomme `.err`), fase 1,9 og sult 15,7. `grep frø | sha256sum` = `28bc8031…71f4`, det samme som i runde 1 og #33/main. Den eneste motorendringen er tekst i `events-people.ts` (`cowardAgain`: hendelsestekst, valgdetalj og minne). `removePeople(2)`, håp −6, uro +6 og RNG er uendret. **Tallbalansen er urørt, verifisert.**

**Runde 1 F01–F06, verifisert i spill** (Survival, frø 101, Lundsneset, Ingrid, pluss bot-tilstand dag 12/30 fra ny head):
- **F01 lukket (en liten rest, se nye F01).** Kartmarkeringen viser nå «Et sted å undersøke / Lundsneset» med 11/12 px på 1280 og 12/12 px på 390, uten klipping (`clip: []`, 162×49 og 160×62, `1280-20-cue-cue.png`, `390-20-cue-cue.png`). Rapport, opplevelseskort, feltjournal og anlegg har 0 tekster under 11 px på PC og under 12 px på 390.
- **F02 delvis lukket.** Kamp, søk og utstyr har egne motiver: en regnkåpe og hanske i et smug, et ransaket skap og hender som inspiserer en stropp. Alle lastes (`1280-07b/07c-*.png`). I «Våre første steg» viser dag 30-tilstanden 5 ulike bilder for 8 minner, men 4 av 8 er fortsatt fjøset (`qa-pr34r2.json → rich.*.bookAll`). Se nye F02.
- **F03 lukket.** På dag 2 åpner rapporten fortsatt på Viktigst med skadene først. Opplevelsesfanen er nå knappen «3 nye minner» (151×44, 12 px, synlig uten scrolling, aria «Se 3 nye minner fra dagens tokt»). Knappen åpner kort 1/3, og varselstripen «Ingrid ble skadet» leder tilbake (`1280-07-d2-rapport.png`, `1280-07b-d2-minner.png`).
- **F04 lukket.** «Feltjournal» med eget ikon og teller er knapp nr. 2 i venstremenyen: 70×53 på PC og 44×44 på 390, med `aria-description` «2 åpne spor». Knappen åpner «Oppdagelser og spor» direkte med 0 axe-brudd (`1280d12-30-hud.png`, `1280-07d-journal-via-hud.png`, `390-30-hud.png`).
- **F05 lukket.** `cowardAgain` er tvunget fram med `forceEvent` på dag 12 (QA-fixtur med 4 voksne, `sim-region/v04/dump-pr34-r2.mts`, `logs/.../dump.log`). Teksten er nå: «Den nye sjansen til Marius har splittet gruppen. To voksne har bestemt seg for å dra i protest. «Vi stoler ikke på ledelsen lenger.» Avgjørelsen står fast.» Den gode varianten «Den andre sjansen» er varm og konkret. Med 0 voksne fungerer også reserveteksten. I UI går de voksne fra 4 til 2, og minnet blir «2 voksne forlot gruppen i protest …» (`1280-50-coward-bad.png`, `390-50-coward-bad.png`, `1280-50-coward-good.png`). Se nye F03.
- **F06 lukket.** `.hq-work-bar` har `role="group"`, og axe gir 0 brudd i HQ på 1280 (dag 12 og dag 30) (`rich.1280.hqAudit`, `rich.1280d12.hqAudit`, `1280-35-hq.png`).

Overflow og axe: 0 horisontal overflow og 0 axe-brudd i start, HUD, rapport, bok, journal, anlegg, HQ og hendelse på 1280, 1920, 390 og 1280 med stor tekst. Avvik fra `42_V04_LIVING_EXPERIENCE.md` og `43_V04_QA34_POLISH.md`: ingen funksjonelle (se F01 for en liten rest av 12 px-målet).

**Nye funn (alle lave, ingen høye eller middels):**
- **F01 lav. Navnet i sitatet i ZA-boka er 11 px på 390.** I «Våre første steg» er `cite` («Marius») 11 px på 390, mens resten av kortmetadataen er 12 px. Bevis: `qa-pr34r2.json → rich.390.bookAudit.tiny`, `390-31-zabok.png`.
- **F02 lav. Halvparten av «Våre første steg» viser fortsatt samme fjøs.** På gårdsstart bruker speiding, POI, overtakelse og perimeter miljøbildet `farm`. Fire av åtte minner er dermed identiske, og de kommer to og to på rad. Kampmotivet (trehusgate i regn) passer dessuten dårlig med en kystgård. Bevis: `rich.1280.bookAll`, `1280-07c-d2-minne-3.png`.
- **F03 lav. Tittelen «Igjen» og et usynlig utfall.** Den dårlige varianten heter fortsatt «Igjen», men teksten sier ikke lenger hva som skjedde igjen. Etter valget viser `resolveEvent` bare «Dere valgte: …». At to voksne dro, står bare i minnet og i folketallet, ikke som en synlig linje eller toast (`dump.log`, `1280-50-coward-bad-etter.png`).
- **F04 lav. Feltjournalen har ingen hurtigtast.** `HUD_SHORTCUT_ACTIONS` dekker bare crew, book, settings og hq (`region-game.tsx:61`). PC er primærplattformen, og journalen er nå en av de viktigste inngangene.

**Spillbarhet (1–5), mot runde 1:**
- Enkelt vs tungvindt **5**. Journal, minner og lagring nås med ett klikk.
- Gir mening **5**. Hendelsestekst, minner og bilder sier det samme som rapporten.
- Konsekvens **4**. **(a)** Protesten er nå en menneskelig og synlig konsekvens, men tempoet er uendret: 0/75 bot-seire, og naturlig seier kom først dag 194 i #33. **(b) S5:** balanse og tempo mot seier nærmere dag 50: **4→5**, innsats **stor**.
- Dopamin **4** (nær 5). **(a)** Knappen «3 nye minner» og de nye motivene løfter skadedagene tydelig, men F02 og at førstegangsminnene tar slutt etter dag 2–3 gjør at belønningen tørker ut. Dag 3 hadde ingen nye minner (`play.d3.teaser`). **(b) S1** (motiv per handling og miljø) + **S3** (minner etter førstegangene, for eksempel «første natt uten skade» eller «10. sone»): **4→5**, innsats **middels**.
- Hva runde 2 gjør nytt **5**. Alle seks funn er adressert presist, med egen innholdsreise (`check:region-cues-ui`) og en ærlig bevisnotat (`43_V04_QA34_POLISH.md`).

**UX K1–K11 snitt 4,91** (runde 1: 4,73). K1–K10 er 5, og **K3 (4→5)** og **K8 (4→5)** er løftet. Under 5:
- **K11 ytelse 4.** **(a)** Fortsatt bare SwiftShader. Ytelsen på en fysisk GPU er ikke målt (doc 43 sier det samme). **(b) S6:** kjør Innstillinger → Ytelse på din PC og legg ved JSON: **4→5**, liten.

**Veien til 5** (etter effekt per innsats):
- **S1:** egne motiver for speiding, POI, overtakelse og perimeter (eller rotasjon i miljøfamilien), og et kampmotiv som følger miljøet (gård/kyst/by), så ingen bilder gjentas i «Våre første steg» (F02).
- **S2:** «Igjen» → for eksempel «Splittet», og en rapportlinje eller toast «To voksne forlot leiren i protest» etter valget (F03).
- **S3:** minner etter førstegangene (milepæler, første tap, første helt rolige natt), så «N nye minner» dukker opp også i midtspillet (dopamin).
- **S4:** hurtigtast for Feltjournal (F04) og 12 px på sitatnavnet i boka på mobil (F01).
- **S6:** GPU-måling.
- **S5:** balanse og seierstempo (fase 1-målet: nær 100 % seier rundt dag 50).

**Topp 5:** S1, S3, S2, S4, S5.

**Premium-gap:** (1) seier innenfor kampanjelengden og balanse (S5, det største gapet), (2) belønning gjennom midtspillet (S3), (3) siste variasjon i illustrasjonene (S1), (4) småpolish på tastatur og tekst (S2, S4), (5) ekte GPU (S6). Lesbarhet, tilgjengelighet, lagring og historieinnganger er nå på premiumnivå.

Kommandoer: se over. Rapport: `rapport-region-v04-pr34-runde2.md`. Logger i `logs/region-v04-pr34-r2/` (`qa-pr34r2.json`, `dump.log`, `official-*.log`, `bot-run1/2.txt`). Bilder i `shots/region-v04-pr34-r2/`. Skript: `shoot-region-v04-pr34-r2.mjs` og `sim-region/v04/dump-pr34-r2.mts` (QA-maskin).

