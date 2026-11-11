# Bildepakke til Codex: Stavanger Z

Dette er bestillingen av bilder til regionspillet. Selve listen står i [art/SHOTLIST.md](art/SHOTLIST.md) og [art/shotlist.json](art/shotlist.json). Den lages av `pnpm art:shotlist` fra spillets egne data, så filnavn og tekster stemmer med det spilleren ser.

## Oppdraget

Lag bildene i listen, med prioritet 1 først (52 bilder). De legges i `region/apps/game-client/public/art/<file>.webp`. Kjør deretter `pnpm art:manifest` i `region/`. Spillet viser et bilde bare når det står i `manifest.json`, så det virker hele veien mens bildene kommer inn.

Codex skal ikke endre noen kode. Bare `public/art/`, `manifest.json` og eventuelt denne fila.

## Stil

- **Uttrykk:** Malt og grafisk, mellom gouache og en mørk tegneserieroman. Ikke fotorealistisk, og ikke 3D-render. Tydelige silhuetter og begrenset palett. Tenk illustrasjoner til en bok, ikke filmplakat.
- **Palett:** Dempede blågrå og olivengrønne toner med fuktig lys. Varmt lys bare fra bål, lommelykter og vinduer. Blod og vold kun antydet, mørkt og lite. Fargene skal passe spillets UI: mørk grønn-grå bakgrunn (#111a17), lys oliven aksent (#c9d38f), advarselsoransje (#e0a64a) og rødt (#e0705a).
- **Stavanger:**
  - hvite trehus i Gamle Stavanger
  - Vågen og Skagenkaien
  - Domkirken
  - Vålandstårnet og Ullandhaugtårnet
  - Bybrua og Byfjordbrua
  - Rosenberg verft og kraner
  - oljeinstallasjoner og forsyningsskip
  - Jærens lave jorder, steingarder og naust
  - holmene i Ryfylke
  - sørvestlig regn, måker og lav himmel
  - Stavanger lufthavn Sola
  - kjøpesentre på Forus
- **Mennesker:** Vanlige nordmenn i regnjakker, arbeidsklær, refleksvester og ullgensere. Ingen supermodeller og ingen militær kosplay. Crewet skal være gjenkjennelig fra portrett til hendelse.
- **Zombier:** Mest som silhuetter og skikkelser på avstand. Grå, våte og slitne, aldri tegneserieaktige monstre. Detaljert gørr skal ikke være med.
- **Tone:** Alvorlig med varme. Det er et spill om valg, ikke om skrekk. Tørr lokal humor kan skimtes, som en måke med en pølse eller en Viking-skjorte, men aldri slapstick.

## Grenser

- **Merkevarer:** Ingen ekte logoer eller varemerker. Butikker, skip og firma får fiktive navn. Cruiseskipet heter ikke noe ekte, og Equinor, Rema og Coop skal ikke synes.
- **Personer:** Ingen gjenkjennelige ekte personer.
- **Barn:** Aldri i fare på en grafisk måte. Det holder at de er der.
- **Sensitive hendelser:** Ved overgrep og vold gir motivet bare stemningen. Et eksempel er `guardAccusation`: en vaktbu i regn, to personer langt fra hverandre. Selve handlingen vises aldri.
- **Tekst i bildet:** Ingen, bortsett fra skilt med fiktive navn.

## Format

| Type | Mappe | Størrelse | Merknad |
|---|---|---|---|
| Startbilde | `intro/hero` | 1920×1080 | Vises øverst på startskjermen |
| Intro, fase, slutt, hendelser, HQ, unike steder | `intro/`, `phases/`, `end/`, `events/`, `hq/`, `wonders/` | 1600×700 | Beskjæres til 16:7. Hold det viktige i midten |
| Portretter | `crew/` | 512×512 | Brystbilde, nøytral bakgrunn i spillets mørke grønn, lys fra venstre |
| Mutasjoner | `mutations/` | 512×512 | Som en klinisk feltrapport |

- **Filformat:** WebP med kvalitet 80. Hver fil bør være under 250 kB. Spillet tar også imot `.jpg` og `.png`.
- **Filnavn:** Akkurat som i listen, med `.webp` til slutt. Navnene er små bokstaver uten æ, ø og å, så `crew/oystein.webp` og ikke `Øystein`.

## Rekkefølge

1. `intro/hero` og intro 1–4. Det er det første spilleren ser.
2. Crewet: Ingrid, Marius, Leila og Tor.
3. Fasene 1–5 og de seks unike stedene.
4. De 32 nøkkelhendelsene med prioritet 1 i listen.
5. Resten: HQ-typer, rekrutter, prioritet 2 og 3.

## Kontroll

- Kjør `pnpm art:manifest` og start spillet med `pnpm dev`.
- Start i Lundsneset. Introen skal vise bildene.
- Åpne Unike steder. Hver kort skal ha bilde.
- `window.__szRegion` viser tilstanden. Hendelser kan tvinges fram for kontroll med `pnpm region:events`, som bygger alle hendelser.
