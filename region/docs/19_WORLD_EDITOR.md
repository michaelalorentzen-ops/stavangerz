# World Editor

Sonegrenser, sonetyper og steder lages nå i [soneeditoren](20_ZONE_EDITOR.md). Denne editoren brukes foreløpig bare til forbindelser.

## Samlet utkast med 41 soner – 05.11.2026

Åpne `dist/stavanger-z-41-soner-veigrenser-utkast.json` med **Åpne utkast**. Filen inkluderer verdensutkastet, kartgrunnlaget og redigerbare kartflater. Den rene WorldDefinition-filen heter `dist/stavanger-z-world-41-road-draft.json`. Utkastet har 11 Buøy-soner, 18 Hundvåg-soner, to Engøy-soner, én på Sølyst, én på Grasholmen, to på Bjørnøy, fire på Roaldsøy og to på Ormøy. L2-fordelingen er en foreløpig arbeidsgruppering som eier vurderer etter L3. Steinsøy beholdes som geografisk kontekst uten operativ L3-sone i denne leveransen.

Velg en L3-sone og **Fyll kartflate**. Pek på en flate for å se hele arealet som blir flyttet, og klikk for å tilordne flaten til valgt sone. Kartflatene følger sammenhengende veier, kyst og kartlagte arealgrenser. Flater som ellers ville delt et bygg slås sammen. Berørte naboer og foreløpige L2-grenser oppdateres i samme angretrinn. Godkjente låser respekteres. En flate som dekker hele en annen sone krever en eksplisitt sammenslåing.

Ved kysten brukes korte overganger fra veiknutepunkter til sjø for å dele sammenhengende kyststriper. Disse overgangene er kurateringsforslag. Tomtegrenser kommer fra tomtedata som importeres separat.

Kartene og utkastet kan gjenskapes ved å kjøre `python scripts/curate-geography-41.py`, `pnpm exec tsx scripts/finalize-geography-41.ts` og `python scripts/render-geography-41.py` i denne rekkefølgen fra prosjektroten. Kildene er de beholdte OSM-uttrekkene og Buøy-utkastet. Foreslåtte forbindelser følger sammenhengende kartlagte traséer. Tilgang, enveisregulering og reisetid må kurateres før grafen brukes som autoritativt transportgrunnlag. Arbeidstimer på kartene er grove bygningsestimater.

1. Velg **Hundvåg nord** og **Skeie** eller **Husebø**. Bruk pluss og minus for å zoome. Valg av sone i listen rammer inn sonen.
2. For å dele en sone, velg **Del valgt sone**, klikk fra yttergrense til yttergrense langs ønsket trasé, og velg **Fullfør**. Festing til veier og grenser kan slås av mens du tegner. For å flytte et hjørne, klikk punktet og deretter ny plassering. Felles hjørner flyttes sammen når de har samme koordinat.
3. **Tegn ny L3** skjærer ut det tegnede arealet fra eksisterende L3-soner i distriktet. For å slå sammen soner, velg en nabo fra listen. Begge verktøy respekterer låste soner. Delingsverktøyet krever én flate uten hull.
4. **Plasser POI** legger til et sted i sonen under pekeren. Velg et sted for å flytte det, endre navn eller merke det som HQ-kandidat. Under **Forbindelser** kan en kartlagt forbindelse godkjennes som aktiv.
5. Lås soner du har godkjent. Utkastet lagres lokalt. Last ned **Sikkerhetskopi** før du bytter maskin eller nettleser. Eksporter verdensfilen til gjennomgang når du er klar. Eksporten har status `draft` og oppdaterer ingen publisert verden. Bruk sikkerhetskopien hvis låsene også skal følge med.

Bygninger telles etter plasseringen til midtpunktet i hvert fotavtrykk. Arbeidstid er et estimat basert på OSM-bygningstype. Nøkkeltallene bruker den utvidede editorbasen og lagres ikke som spilltilstand. © [OpenStreetMap-bidragsytere](https://www.openstreetmap.org/copyright), ODbL.

Startutkast og kartgrunnlag kan gjenskapes med `python scripts/render-phase1-road-map.py --editor` med kartuttrekkene beskrevet i [fase 1-revisjonen](18_PHASE1_REFINEMENT.md). Forslag til nye forbindelser stammer fra kartlagte kryssinger og må vurderes før de aktiveres.

For å utvide kartet, velg **Legg til OSM-kart** og importer ett eller flere mindre OSM XML-uttrekk. Bruk **Kartutsnitt** for å bytte område. Velg **Tegn nytt L2**, gi distriktet et navn og tegn yttergrensen. L1 utvides med det nye distriktet. Tegn deretter L3-soner innenfor det. **Sikkerhetskopi** pakker med de importerte kartene, sonene, POI-ene og låsene. Verdenseksporten er en egen fil for gjennomgang og integrering i spillet.

Slå på **Fest punkter** for å feste hvert punkt, også når du flytter et eksisterende hjørne. **Følg vei mellom klikk** følger hele traseen og siste side tilbake til start i tegne- og arealmodus. Manglende forbindelse stopper tegningen med en forklaring. Slå av linjefølging ved fri tegning. Valget **Tomt** følger importerte tomtegrenser, **Kyst / vann** følger kystlinjer, og **Sonegrense / kyst** følger eksisterende grenselinjer. Klikk tettere ved tvetydige veikryss.

Du kan navngi nye soner under tegning og redigere navnet etterpå i sidepanelet. **Slett valgt POI** og **Slett valgt sone** kan angres. Flytt eller slett POI-er før du sletter sonen de ligger i. Lås godkjente soner med sonelåsen. Startadressen velges ved spillstart og er uavhengig av sonekurateringen.

Velg en L3-sone og bruk **Utvid sone** for å ta areal fra en nabo i samme L2. **Visk ut** frigjør areal fra valgt sone. Med **Tegn område med snapping** kan du følge en vei og markere et presist areal. Med **Dra med pensel** kan du gjøre raske justeringer. Langs kysten kan du dra over yttergrensen. Utvidelser og nye L3-soner klippes til L2-distriktet. Ett penselstrøk er ett angretrinn.

Med **Fest penselkanten** kan du male langs en vei, tomtegrense eller kartlagt vannkant. Hold kanten av penselen nær linjen du vil følge. Kartet viser den justerte flaten mens du drar. Importerte vannflater fra lukkede OSM-veier klippes bort når festing er på.

Bruk **Områder → Start på nytt i distriktet** for å tegne L3 på nytt i ett distrikt. Editorens sikkerhetskopi lastes ned før eksisterende L3-soner, POI-er og tilknyttede forbindelser fjernes fra utkastet. L1, L2 og kartgrunnlaget beholdes.

Velg **Vei** under **Fest til** når en gate skal styre grensen. For **Tomt** må du først legge til tomtegrenser som GeoJSON i WGS84. Filen kan inneholde linjer eller polygoner. Tomtegrensene følger med sikkerhetskopien. **Soneetiketter** viser bygg og estimerte timer i aktivt distrikt.

### Veigjennomgang 6. november 2026

`dist/stavanger-z-world-editor-41-review.html` åpner det reviderte 41-soners utkastet med kartgrunnlag og kartflater innebygd. Filen bruker egne lagringsnøkler for både utkast og kartbibliotek, slik at det tidligere lokale utkastet beholdes. Kartversjon og antall L3 vises i toppfeltet. **Sikkerhetskopi** og **Valider og eksporter verden** fungerer som før.

Den kuraterte geografien henter yttergrenser fra hele OSM-øyer, fremfor gamle klippede L2-omriss. Buøy/Hundvåg-skillet følger Hundvåg ring med korte avslutninger mot sjøen. Bygg som ligger på vannkanten beholdes hele. Veiavslutningene går bare to centimeter over den første strandlinjen; den tidligere 30-meters forlengelsen kunne hoppe over smale bukter. Arealbrukslinjer er fortsatt ikke verifiserte eiendomsgrenser.

Gjenskap med `python scripts/curate-geography-41.py`, deretter `pnpm exec tsx scripts/finalize-geography-41.ts`, `python scripts/check-geography-41.py` og `pnpm build:portable --editor-review`. Regresjonskontrollen sjekker alle L1-, L2- og L3-grenser mot interiøret i kartlagte bygg, inkludert kysten. Vanlig editor bygges fremdeles med `pnpm build:portable --editor`.
