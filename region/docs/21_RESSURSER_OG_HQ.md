# Ressurser, HQ-typer og soneinnhold

Status: designforslag, besluttet av eier 10.11.2026. Tall er spillhypoteser til kalibrering.
Katalogen ligger i [`content-catalog.json`](../packages/world-data/data/content-catalog.json). Beregningene ligger i [`content.ts`](../packages/world-data/src/content.ts).

## Fire ressurslag

| Lag | Eksempler | Rolle |
|---|---|---|
| Forbruksvarer | Mat, vann, medisin, drivstoff, ammunisjon | Brukes opp hver dag og har egne målere |
| Materialer | Byggemateriale, metall, mekaniske deler, elektronikk, salt | Få grove kategorier. Løse gjenstander demonteres til disse |
| Strategiske komponenter | Batterier, solceller, generatorer, antibiotika, tennhetter, radio, motorer, båter | Sjeldne. Kan sjelden eller aldri lages, og er derfor gode byttevarer |
| Kapasiteter | Strøm, vannforsyning, verksted, helse, samband, havn, dyrking, fiske, tømmer | Hører til stedet. Det de produserer kan byttes |

Handel oppstår fordi geografien fordeler ressursene ujevnt, fordi ting forfaller (bensin, medisin, butikkmat), og fordi noe ikke kan lages (antibiotika, tennhetter). Tjenester som reparasjon, behandling og frakt kan også byttes.

## Sonens innhold

- **Funn:** det som kan hentes én gang, for eksempel apotek, dagligvare og våpenbutikk.
- **Produksjon:** det sonen kan gi igjen og igjen, for eksempel dyrking, fiske og tømmer.
- **Målinger:** boligareal og antall boliger, jord, åpen mark, skog, industri, drivhus og kyst. Kommer fra OpenStreetMap og brukes til å regne ut boligplass og mat.

Jord, beite, skog, myr, fjell og bebygd areal måles fra NIBIOs arealressurskart AR5. Det kartlegger all jord i Norge, også den OpenStreetMap mangler. Der AR5 ikke er lest, brukes OpenStreetMap.

Regnemodellen bruker disse antakelsene. 1 mat er én persons dagsbehov.

| Kilde | Mat per hektar i året |
|---|---|
| Jord i drift (fulldyrka og overflatedyrka) | 3 000 |
| Beite når det er pløyd opp | 1 500 |
| Hager og plener (30 % av bebygd areal) og parker når de dyrkes | 1 500 |

Drivhus gir 1,5 mat per m² i året. Én båt med mannskap gir 6 mat per dag, altså nok til 6 personer.

Det finnes langt flere hus enn overlevende. *Husrom* er derfor ikke en grense, men et mål på hvor mye som kan tas i bruk eller rives for å gi materialer og mer jord. Det knappe er trygghet, mat og arbeidsfolk.

## HQ-typer

| Type | Har fra start | Unik mulighet |
|---|---|---|
| Militærbase | Murer og gjerder, vakttårn, stort lager | Treningsleir |
| Flyplass | Murer og gjerder, utkikk, stort lager | Utkikk |
| Kjøpesenter | Stort lager, felleskjøkken | Takhage |
| Sykehus | Medbay, felleskjøkken | Laboratorium, eneste vei til antibiotika |
| Industri og verft | Verksted, tungverksted, kai | Tungverksted |
| Skole og campus | Felleskjøkken, opplæring | Opplæring |
| Kystgård | Kai og båtplass | Saltkokeri |
| Kirke og tilflukt | Murer | Tilflukt: folk søker hit, og moralen øker |
| Fengsel | Murer, sluse, felleskjøkken | Sluse |

Alle HQ-er kan bygge de vanlige modulene etter hvert. **Ingen type har en innebygd svakhet.** Et HQ er svakt der området rundt mangler noe. Rosenberg har verksted, kai, boliger på Buøy og vann rundt nesten hele området, men ikke jord. Mat må derfor komme fra drivhus, fiske, riving og dyrking, eller fra en kystgård som Lundsneset.

## Oppgraderinger og nett

L3-soner kan bygges ut med drivhus, oppdyrking av åpen mark, riving for dyrking eller materialer, fiskebase, solcellepark, regnvann, sperringer, vaktpost og saltkoking. Kravene leses fra målingene, for eksempel kystlengde og åpen mark.

L2-områder får fire nett:

| Nett | Krever | Gir |
|---|---|---|
| Strøm | Trafostasjon, solceller og batterier | Moral og maskiner |
| Samband | Sambandstårn eller radiorom | Koordinering |
| Veier | Ryddede ruter | Raskere frakt og patrulje |
| Vann | Vannverk, vanntårn eller filtre | Mindre sykdom |

## Status i spillet

Datamodellen, katalogen og beregningene (`zoneCapacity`, `hqAdvantages`, `availableUpgrades`, `networkOptions`) er på plass, og verdenskontrollen avviser ukjente katalog-id-er. Turreglene bruker dem ikke ennå. Det hører til M4–M6, der én produksjonskjede kommer først.
