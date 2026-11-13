# Soneeditor

Soneeditoren erstatter tegning av sonegrenser. Kartet deles automatisk i celler fra tomtegrenser, veier og kyst, og du maler cellene inn i soner. Grensene beregnes alltid fra cellene. Hull, overlapp og L3-soner utenfor sin L2-sone kan derfor ikke oppstå.

## Start

Dobbeltklikk `Soneeditor.cmd`, eller kjør `pnpm zones`. Editoren åpnes i nettleseren. Vinduet med serveren må stå åpent mens du jobber. Endringer lagres automatisk i `world-zones/project.json`.

Første gang på en maskin trengs Python og biblioteker i `.tools/python`:

```bash
python -m pip install --target .tools/python shapely==2.2.0 pyproj
```

## Slik jobber du

| Handling | Resultat |
|---|---|
| Klikk på en sone i lista, eller `Alt`+klikk på kartet | Sonen blir aktiv |
| Pek på kartet | Viser hva som flyttes, og hvordan antall bygg endres |
| Klikk | Flytter et kvartal til aktiv sone |
| `Shift`+klikk eller `Shift`+dra | Flytter enkelttomter |
| `Ctrl`+dra | Flytter alle celler innenfor området du ringer inn |
| `K`, klikk to punkter, `Enter` | Smart kutt deler store celler. Klikk flere punkter for å styre traseen |
| `Ctrl+Z` / `Ctrl+Y` | Angrer eller gjør om |
| `1`, `2`, `3` | Bytter til L1, L2 eller L3 |
| `N`, `L`, `F`, `Esc` | Ny sone, lås, vis på kartet, fjern valg |

På L2-nivå klikker du L3-soner inn i aktiv L2-sone. På L1-nivå klikker du L2-soner inn i aktiv L1-sone. Låste soner verken gir fra seg eller tar imot celler.

## Innhold: hva hver sone er

Bytt til **Innhold** øverst i panelet, eller trykk `I`. Da velger et klikk en sone uten å flytte noe, og et sonekort åpnes til høyre. Pil opp og ned går til forrige og neste sone i lista. `G` går tilbake til **Grenser**.

- **Foreslå innhold** finnes i oversikten når ingen sone er valgt. Knappen fyller ut type, potensial, funn, produksjon og et notat for hver L3-sone. Den legger også inn HQ-kandidater, strategiske anlegg og ressurssteder fra OpenStreetMap. Soner du har satt opp selv, blir ikke rørt. Ctrl+Z angrer hele forslaget.
- ◐ i lista betyr forslag, og ✓ betyr satt eller godtatt av deg. Endrer du noe, eller trykker **Godta**, er sonen din.
- **Målt fra kartet** viser areal, boliger, jord, åpen mark, skog, kyst og mat i året. Tallene følger sonen når du maler den om.
- **Kan bygges ut med** viser oppgraderingene sonen har grunnlag for.
- Et sted har en rolle og en type fra katalogen: HQ-type, anlegg eller ressurssted. Et HQ viser hva det har fra start, sin unike mulighet og målte fordeler i området rundt.
- L2-kortet viser hvilke nett (strøm, samband, vei og vann) området har anlegg for.

Typer og ressurser står i [`content-catalog.json`](../packages/world-data/data/content-catalog.json). Se [21_RESSURSER_OG_HQ.md](21_RESSURSER_OG_HQ.md).

## Nye områder

Velg **Områder → Legg til område** og dra en ramme på kartet. Veier, bygg og kyst hentes fra OpenStreetMap, og tomter hentes fra Kartverket. Du får deretter et første forslag til soner. Land som allerede er med, endres ikke. Grensen mot nabolandet følger tomtene ved rammen, så den deler ikke hus.

Bygg ut Stavanger i passe store ruter, for eksempel en bydel om gangen. En testbygging av 64 km² med 48 000 tomter tok omtrent 50 minutter. Hundvåg tok under ett minutt når kildene allerede var lastet ned. **Foreslå inndeling** på en aktiv L2-sone lager nye L3-soner for alle ulåste soner i den.

## Arbeid sammen med Claude

`project.json` inneholder sonehierarkiet under `zones` og celle → L3-sone under `assignments`. Claude kan endre fila direkte. Editoren laster endringen inn innen få sekunder, og `Ctrl+Z` tar den tilbake. Cellene med nøkkeltall ligger i `world-zones/areas/<område>/cells.geojson`.

## Kommandolinje

Kjør fra prosjektroten med `python tools/zone-editor/zonetool.py`:

| Kommando | Formål |
|---|---|
| `status` | Viser områder og antall soner |
| `add <id> <navn> <v> <s> <ø> <n>` | Legger til et område fra lengde- og breddegrader |
| `build <id>` | Bygger et område på nytt fra lagrede kilder |
| `refetch <id>` | Henter ferske kilder og bygger på nytt |
| `import-world <id> <fil>` | Fordeler et områdes celler etter L3-soner i en verdensfil |
| `import-pois <fil>` | Henter steder fra en verdensfil inn i prosjektet |
| `export` | Skriver et verdensutkast til `dist/` |

Når et område bygges på nytt, følger sonene cellene. Uendrede celler beholder sonen sin, og endrede celler får sonen som dekker mest av dem. Smarte kutt legges på igjen.

## Eksport

**Eksporter** skriver `dist/stavanger-z-world-soneeditor-<tid>.json` og kontrollerer at soner ikke overlapper, at hver sone ligger i sin overordnede sone, og at steder og forbindelser ligger i riktige soner. Spillets egen kontroll kjøres også, men bare for filer under 150 000 punkter, fordi den bruker mange minutter på hele Stavanger. Filen bygger på verdensfila i `settings.baseWorld`. Soner i områder editoren dekker, byttes ut. Steder kommer fra editoren og får sonen de ligger i. Type, potensial og ressurser følger sonene som `primaryType`, `potential` og `resources`. Steder får `role`, `hqProfile` og `resources`, og HQ-steder får `hqCandidate`. Gamle forbindelser som havner inni én sone fjernes, og nye forslag lages der en kartlagt vei eller sti krysser en sonegrense. Filen har status `draft` og endrer ikke spillet. Forbindelsene har status `proposed`, og tilgang må vurderes før de gjøres aktive.

## Kilder og begrensninger

Kartverkets tomtegrenser (CC BY 4.0), OpenStreetMap (ODbL) og Kartverkets bakgrunnskart krediteres i kartet. Tomtegrenser er geografisk grunnlag og sier ingenting om eierskap eller tilgang. Rå kildefiler lagres i `.tools/imports/zones/`. Sikkerhetskopier av prosjektet ligger i `world-zones/history/`, høyst én per fem minutter og de 60 siste.

Bakgrunnskartet krever nett, men editoren virker uten det. Skrudd av viser den veier fra egne data.

Forbindelser redigeres foreløpig i [den gamle World Editor](19_WORLD_EDITOR.md). Spillet bruker ennå ikke type, potensial, ressurser eller HQ-profil. Feltene er lagret og eksportert, så spillreglene kan ta dem i bruk senere.

## Hele regionen

Prosjektet dekker Stavanger, Randaberg, Sola med Tananger, byområdet i Sandnes til og med Hommersåk, Rennesøy, Finnøy og Talgje. Det er 9 områder og om lag 78 000 celler.

- `python tools/zone-editor/zoneexpand.py A|B` bygger områdene, klippet langs kommune- og bydelsgrenser fra OpenStreetMap ([`zoneadmin.py`](../tools/zone-editor/zoneadmin.py)).
- `python tools/zone-editor/zonetool.py regroup` legger L2 under L1 etter bydel og kommune. Kommandoen deler store bydeler, slår sammen og deler L2 til 3–9 L3-soner og gir genererte soner navn etter steder og gater.
- `python tools/zone-editor/zonetool.py suggest` fyller innhold i soner som ikke er satt opp for hånd.

Med hele regionen lastet bruker editoren lengre tid på å starte. Spillets egen kontroll hoppes over ved eksport, og editorens raske kontroll brukes i stedet.

## Overtakelse, kyststriper, bruer og tunneler

- Sonekortet har **Å ta over sonen**. Der står hvor mange zombier sonen anslås å ha, hvor mange bygg som må søkes gjennom, timer for arbeidet og hvor mange vaktposter grensen krever.
- Varselet **lang kyststripe** gjelder soner som er lange og smale langs sjøen. Knappen **Fordel på naboene** gir hver celle til nabosonen den deler mest grense med. Ctrl+Z angrer.
- Bruer og tunneler er anlegg. Kortet viser lengde, hvilke soner de forbinder, og valgene holde, sperre og sprenge. Ved eksport blir hver av dem en forbindelse mellom sonene på hver side.
- `Stavanger Z.cmd` starter spillet og editoren sammen, og begge har lenke til den andre.
