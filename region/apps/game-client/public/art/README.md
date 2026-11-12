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
