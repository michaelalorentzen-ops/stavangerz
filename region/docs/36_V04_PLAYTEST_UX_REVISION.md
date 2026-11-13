# v0.4 – spillerflyt etter faktisk ti-døgnstest

Baseline: main `e638dac` / PR28. Eieren rapporterte at det var tungvint og kjedelig å spille, selv om motor- og klikkprøvene var grønne. Dette er en revisjon av hele den vanlige beslutningsløkken, ikke en ny erklæring om at teknisk PASS betyr god UX.

## Grunnlag og prioritering

En ny agent fikk bare spillpremisset, uten dagens UI, bilder eller samtalens konkrete forslag. Førstekonseptet er bevart i [37_V04_INDEPENDENT_DESIGN.md](37_V04_INDEPENDENT_DESIGN.md). Etterpå sammenlignet agenten med appen og spilte gjennom speid, kamp, søk, utstyrsvalg, to ordre, dagsrapport, overtakelsesforsøk og redigering. Den fant også tapt arbeidskontekst og irrelevant global zombiestatistikk. Disse funnene er innarbeidet.

Eierens videre tilbakemeldinger styrer prioriteringen: konkrete stedsnavn, fremdrift før handlingsvalg, færre steg og forklaringsavsnitt, ingen vanlig PC-scroll, gear ved folkene, håndbokhjelp ved spørsmålet, ikonlager, mer bevisst farge/typografi og synlig sammenheng mellom nye innbyggere, arbeid og mat.

## Endringene

- **Kart:** kontroll bæres av faktisk sammenslått L3-geometri, en skarp mintytterkant og lesbare navn; indre grenser er svakere. Valg er hvitt/stiplet. Standard Oversikt demper fareheat og gamle nattpiler. Fare/Forsyning er egne lag. Delkontroll ved L1/L2 og hull/multipolygoner beholdes.
- **Arbeidskontekst:** ny ordre returnerer til samme sone, redigering/avbryt/oppdatering returnerer til dagsplan. Håndbokhjelp returnerer til det uendrede utkastet. HQ-fanen beholdes ved hjelpetur.
- **Ordre:** fast sted/risiko, tre korte tidsbokser, kompakte folk med tre gearknapper hver og reelle valg/automatiske forslag/manuelle låser. Før personvalg vises «Velg folk», ikke en vegg av valideringsfeil. Mandat, leder og returvalg ligger under Avansert. Ingen ny oppdragsmotor.
- **Dagsplan:** kompakte kort, fire per side, adskilt Nye/Pågående. Detaljer foldes; rediger/fjern forblir direkte.
- **Sone:** eierskap, faktisk søkeprosent, sist observerte trussel, registrerte kampresultater og målte boliger/dyrkbar mark/bygninger før handling velges. Kamp har ingen oppdiktet ferdigprosent: zombier kan komme tilbake. Steder har en egen, paginert fane og faktisk rolle/type; den meningsløse generiske «Søk i området»-knappen på POI er fjernet. POI-handlinger kan åpne planleggeren før folk er valgt.
- **Rapport:** få prioriterte utfall, konkrete soneknapper, fire ikonverdier og paginert logg. Rutinemeldinger om hjemlevert utstyr vises i loggen. Mat/vann-tall merkes som drift, ikke full lagerendring eller nåværende lager i en historisk rapport. Globalt antall flyttede zombier er fjernet fra hovedrapporten.
- **Leir/HQ:** direkte inngang til arbeid, tydelig arbeidsføre/i arbeid/uten oppgave, faktisk mannskap versus innbyggere, syv jobbkontroller og brukerutløst fordelingsforslag. Ingen stille automatisk jobbfordeling. HQ prioriterer produksjon, forbruk og bemanning. Matpanelet peker på ufordelt arbeidskraft.
- **Lager:** fargede ikoner med antall, kategorier, åtte ruter per side og valgt gjenstands fakta i samme flate. Gear viser virkelig fysisk plass, reservasjon og låser.
- **Håndbok/typografi:** konteksthjelp åpner riktig tema, én forklaring om gangen. Bokkapitler, mål, milepæler og forskning har sidevalg i stedet for lange PC-lister. Lokale Inter- og Barlow Condensed-fonter; seks WOFF-filer på til sammen omtrent 180 KB, SIL OFL-lisenser følger med. Ingen ekstern fonttjeneste under spilling.

## Motorrettelser og avgrensede regler

- Speiding har nå en ærlig funksjon: uten observasjoner er søk-/kamprisiko «Ukjent». Forhåndsvisningen bruker ikke skjulte zombietall. Samme observerbare tilstand med 0/999 skjulte zombier gir samme forhåndsvisning.
- Nye soneutbyggingsordre åpner i fase 2, nye områdenett i fase 3. Dette konkretiserer eierens ønske om senere utbygging som en arbeidshypotese ut fra fasenes hensikt. Eksakte terskler er ikke omklassifisert til en ny eierlåst produktbeslutning. HQ, holdbare sperringer og nødvendige HQ-moduler beholdes i fase 1 slik D25 fortsatt kan oppfylles. Påbegynt feltarbeid i eldre saves beholdes.
- Innkommende zombier får faktisk destinasjon og antall i rapporten før kartjournalens 40-bevegelsersgrense. Ingen zombieledger eller migrasjonsutfall er endret.
- `clear` heter **Bekjemp zombier**; lagrings-ID beholdes. Kamp-/søkelinjer får faktiske resultatdata. Eldre rapporter uten data fylles ikke ut med oppdiktede tall.
- Flere personer bidrar allerede samme døgn. Regresjon: én/tre personer gir 8/24 faktiske søketimer, høyere kampinnsats og gyldig gruppeovertakelse. Det er ikke lagt til et automatisk søk→kamp→overtakelse-kombooppdrag.
- Utmattelsesbalansen beholdes: normalt +18 per oppdrag, over 80 gir 40 % redusert arbeidskapasitet, ledig hjemme −25, eksplisitt hvile hjemme totalt −75 uten andre påvirkninger. UI og håndbok viser virkningen; eierens spørsmål om vanlig åttetimersarbeid er registrert som et konkret balanseproblem, ikke bortforklart som UI alene.

## Verifikasjon og gjenværende arbeid

Samlet produksjonsbygg og TypeScript er grønne. Motorens funksjonsgate har 19 kontroller og passerer; hendelsesprøven bygger 113 av 117 hendelser over 16 tilstander. Vanlig spillerreise har passert 8 døgn desktop og 6 mobil etter de nye fase-/risikoreglene. Later-game-kontekster, fysisk levering og mobile kartkontroller har passert1280/390.

`check-v04-ui-clarity.ts` laster eksplisitte fixture-saves og prøver nettopp spillerinnvendingene: sonefremdrift før valg, ingen tidlig feilliste, tre personer og reelle gearlåser, håndbokretur uten utkasttap, bevart navigasjonskontekst, faktisk arbeidsfordeling, ikonlager, stedfestet kort rapport og målte PC-overløp. Dette er separat fra den naturlige reisen og påstås ikke å være en menneskelig brukerstudie. Under integrering fanget prøven både en gammel lagerinngang og flere små vindusoverløp; isolerte komponentprøver var ikke nok.

Den endelige integrerte målerunden passerer både 1280×900 og 390×844 uten sidefeil. Alle 16 målte PC-kontekster passer uten scrolling; mobil har vertikal scrolling i enkelte detaljflater, ingen horisontal overløp. Checkpoint-prøven bekrefter eksakt gjenopptakelse midt i felt og natt. Kartprøven passerer. Testene kjøres mot lokalt produksjonsbygg, ikke en ny publisert versjon. Balanse for mat/vann, arbeid, utmattelse og langtidsprogresjon gjenstår. Ekte mobilmaskinvare og en ny menneskelig langkampanje er ikke påstått testet. Den forrige 75-kjøringen gjelder forrige motor; den brukes ikke som stabilitetsbevis for de nye fasegatingene.


### Kjørbare kontroller og bilder

Fra `region/`: `pnpm check:v04`, `pnpm typecheck`, `pnpm build`, `pnpm check:region-ui`, `pnpm check:region-completion-ui`, `pnpm check:region-checkpoints-ui`, `pnpm check:region-map-ui` og `pnpm check:region-clarity-ui`. UI-kontrollene bruker kjørende lokal server, eller `REGION_TEST_URL`.

- [Kart fra faktisk simulert dag 10](evidence/v04-clarity/natural-day10-map.png) (gjenopptatt eldre save, uten nye kart-fixture-endringer).
- Deklarert dag-10-fixture: [HQ](evidence/v04-clarity/hq-1280.png), [arbeidsfordeling](evidence/v04-clarity/hq-work-1280.png), [trepersonoppdrag](evidence/v04-clarity/three-person-order-1280.png), [ikonlager](evidence/v04-clarity/inventory-1280.png), [rapport med konkret sted](evidence/v04-clarity/daily-report-1280.png).
- [Mobilkart](evidence/v04-clarity/map-390.png), [mobiloppdrag](evidence/v04-clarity/three-person-order-390.png) og [målte vinduer/interaksjonsresultater](evidence/v04-clarity/window-and-interaction-results.json).

Kartgeometri og nytt grunnriss er ikke en ny grafikkpakke: videre kvalitet på 2,5D-modeller og større kunstnerisk variasjon er fortsatt mulig. Denne revisjonen erklærer ikke hele v0.4 eller eierens visuelle ambisjon ferdig.
