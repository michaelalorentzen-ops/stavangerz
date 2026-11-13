# Kuratert bildepakke – v0.4 spilltest

Alle bilder er generert for StavangerZ 12.11.2026 med ImageGen og kontrollert visuelt. Ingen eksterne bildeadresser eller runtime-generering. WebP-filer er encodet fra de genererte originalene; portrettene er 640 × 640, miljøbildene 1280 × 720.

Retning: malt illustrasjon, dempet sjøgrønt/grått og varme ravlys. Dette er en prøvbar visuell hypotese (O12), ikke en ny låst stilbeslutning. Miljøbilder er stemningsillustrasjoner, ikke geografisk dokumentasjon eller operative opplysninger om bestemte soner. Havnebildet er korrigert til Stavangers lave kystgeografi. Ingen sone- eller POI-bildebindinger er introdusert.

## Stabile identiteter

- `crew/ingrid.webp`: Ingrid, speider. Brun hestehale, olivengrønn regnjakke, grå strikk.
- `crew/marius.webp`: Marius, jeger. Kort mørkblondt hår, rødblondt skjegg, brun jakke.
- `crew/leila.webp`: Leila, sykepleier. Mørke krøller i løs knute, petrolblå jakke.
- `crew/tor.webp`: Tor, mekaniker. Gråsprengt hår og bart, marineblå arbeidsjakke.

Bildene følger eksisterende navn og roller i `rules.ts`; de representerer ikke dynamisk utrustning. Ikke gjenbruk disse ansiktene for tilfeldige rekrutter.

## Miljøer og eksisterende bindinger

- `intro/hero.webp`, `intro/1.webp`: stille havnefront i grålysningen. Samme illustrasjon gjenbrukes på startskjerm og første introside.
- `intro/2.webp`: tomt hvilested i trappeoppgang med lykt, tepper og ryggsekker. Ingen figuridentiteter eller antall levende personer antydes.
- `intro/3.webp`: planleggingsbord med kart, kikkert, kompass, vann og radio.
- `intro/4.webp`: beskjeden trehusport, regntønne, kjøkkenhage og et varmt vindu.
- `report/quiet.webp`: samme planleggingsbord, for rutinesammendrag.
- `report/success.webp`: samme trehusmiljø, for håpefull fremgang.
- `report/danger.webp`: samme mørke trappeoppgang, for usikkerhet/tap. Bildet påstår ingen konkret hendelse eller dødsfall.

Rapportvariantene er uttrykkelig gjenbruk av miljøfamilier, ikke unike event-illustrasjoner. Velg dem kun som dekorativ stemning ved rapportens faktiske alvorlighet. Vis ikke bilder av uoppdagede steder som etterretning.

## Alternativtekst

Bruk tom `alt` på rene stemningsbilder når nærliggende overskrift allerede gir sammenhengen. Faste portretter kan ha `alt="Portrett av Ingrid"` osv., eller tom `alt` når navnet står rett ved siden av. Ikke legg rollen eller skjult spillinformasjon i alternativtekst.

Manifest regenereres med `node scripts/art-manifest.mjs` fra `region/`.

## Fase- og avslutningsbilder, 13.11.2026

Seks nye ImageGen-illustrasjoner er visuelt kontrollert mot den samme sjøgrønne/ravfargede, maleriske stilen. De er 1280 × 720 WebP og bruker lave kystlandskap uten fjell eller påstander om kartets eksakte geografi. Ingen eksisterende bilder er byttet ut.

- `phases/2.webp`: et beskjedent permanent HQ med braced treport, regntønne og varmt lys.
- `phases/3.webp`: fiske, enkel dyrking og et lite drivhus som viser produksjon og rutiner.
- `phases/4.webp`: et større kystkart og flere bydeler sett fra et praktisk planleggingsrom.
- `phases/5.webp`: et møtebord, notatbok og radio; felles ansvar uten å fastsette styreform.
- `end/win.webp`: et reparert hjem, kjøkkenhage og rolig havn; generisk håpefullt etterord som kan brukes for flere avslutninger.
- `end/lose.webp`: en tom stol, notatbok og nedskrudd lykt; et verdig siste bilde uten å påstå hvem som døde eller hvilken krise som avsluttet spillet.

Bildene gir stemning; motorens faktiske epilogtekst beskriver resultatet. Ingen gjenkjennelige hovedpersoner eller nye kanoniske figurer er lagt inn. Dekorative fase-/epilogbilder bør ha tom `alt` når overskriften/etterordet allerede gir innholdet.

## Illustrert inventar, 13.11.2026

`items/inventory-atlas.png` er en original ImageGen-generert 4×4-atlas med transparent bakgrunn, visuelt inspisert før integrering. Ingen tekst er bakt inn i bildene. Rekkefølge (venstre→høyre, øverst→nederst): mat, vann, medisin, drivstoff; ammunisjon, byggematerialer, brekkjern, kikkert; verktøykasse, lommelykt, medisinveske, hjelm; beskyttelsesvest, arbeidsjakke, pistol, rifle. Illustrasjonene er generiske representasjoner av eksisterende kategorier, ikke nye ressurser eller nye utrustningsregler. `ItemArt` bruker CSS-celler; ikonfallback beholdes for øvrige katalogvarer. Asseten lastes ved bruk av illustrerte inventarflater og gjenbrukes mellom rutene. Antall, tilgjengelighet, navn, plass og reservasjon kommer fortsatt fra motoren.

Atlas 2 (`items/inventory-atlas-2.png`), generert og visuelt kontrollert 13.11.2026, fullfører de 32 ressurs- og utstyrskategoriene: metall, deler, elektronikk, salt; batterier, solcelle, generator, antibiotika; tennhetter, radio, motor, båt; 3D-printer, sprengstoff, nærkampvåpen, hagle. Samme generiske, dekorative kategoriillustrasjoner og CSS-celler, uten nye regler. Original bevart i genereringsarkivet.
