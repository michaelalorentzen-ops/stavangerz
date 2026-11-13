# v0.4 – visuell spillidentitet etter QA31

Eieren vurderte QA31 som positiv, men skjermbildene ga fortsatt for lite spillpreg og tiltrekningskraft. QA31 sitt snitt 4,82 er ikke et bevis på at den kunstneriske ambisjonen er nådd. Baseline er main `c6c034a`, testet QA-head `6b7cb8c`. Dette arbeidet prioriterer visuell materialitet og komposisjon med den fungerende flyten som ramme.

## Visuell retning – arbeidshypotese, ikke ny låst produktbeslutning

Nordisk havne- og leirstemning: mørkt blekk, varm messing, papir, illustrerte mennesker og brukte gjenstander. Eksisterende malte miljøbilder brukes tydeligere. O12 er ikke omklassifisert til LÅST; eierens videre visuelle vurdering avgjør om retningen treffer.

- **Hovedskjerm:** ressursmedaljonger, mer tilstedeværende portretter, sammenhengende instrumentmeny, en tydeligere døgnknapp og en illustrert dagsnotis. Nytt terrengmateriale følger de faktiske bolig-/skog-/jordbruksflatene; mintgrensen for faktisk kontroll beholdes.
- **Kartkomposisjon:** første kamera er litt nærmere og plasserer leiren over sentrum, så land og tilnærminger får mer plass enn tom sjø. Senere døgn flytter ikke spillerens kamera. Mannskap og navn er flyttet klar av HQ-merket; på mobil står laget i to rekker. Fysisk register og kartkoordinater er uendret.
- **Ekspedisjon:** eksisterende planleggingsillustrasjon, handlingssegl, større faktiske portretter, taktile utstyrssockets og forankrede gearvalg. Samme personer, ordre, risiko og validering; ingen nye felter eller mer forklaringsprosa.
- **Leiren:** en stor dekorativ baseillustrasjon i oversikten, med faktisk mat/vann/arbeid ved siden av. Bildet er atmosfære, ikke et foto eller bevis på den bestemte POI-ens innretning. Andre HQ-faner beholder en grunnere illustrert header.
- **Lager:** en original 4×4-atlas med 16 illustrerte forsynings-/utstyrsobjekter. Katalog, antall, fysisk plass, tap og reservasjon kommer fortsatt fra motoren. Øvrige varer beholder ikonfallback. Små vareutvalg får en balansert 3-kolonners visning. Sidekontroller vises bare når det finnes flere sider, og gearforklaring bare der gear faktisk vises. Generisk teknisk oppdragsforklaring er fjernet fra ressursdetaljen; håndbokknappen beholdes.
- **Feltbok og dossier:** lys papirflate med mørkt blekk i boka; sterkere illustrert personpresentasjon; rapportens stemningsbilde styres av faktisk historisk alvorlighet. Ingen hendelser eller geografi diktes inn.
- **Start:** tydelig StavangerZ-ordmerke, havneillustrasjon, ikonbaserte spillestiler, markerte startvalg og en samlet kart-/startflate. Alle 17 forslag, Story/Survival/Realistic, Hardcore, Fortsett og fast mobilstart beholdes.

## Uavhengig visuell vurdering

En separat agent vurderte baseline og bilder uten filansvar. Første kandidat var fortsatt for mye nye rammer rundt administrasjon; dette førte til større HQ-scene og faktiske gjenstandsillustrasjoner. Samlet kandidat ble vurdert som merkbart mer spillpreget, særlig lager, leir, bok og ekspedisjon. Seneste to konkrete innvendinger ble fulgt opp med ryddigere HQ-/personetiketter og mindre unødvendig lagerkrom. Dette er en agentvurdering, ikke eiergodkjenning eller en ny QA-poengsum.

## Verifisering og grenser

Produksjonsbygg og TypeScript passerer. Klarhetsprøven passerer 1280×800/390 med 18 kontrollerte PC-kontekster uten scrolling, virkelig gearbytte, håndbokretur, rapport, arbeid og reload. Den nye stor-tekst-regresjonen måler hele «Innstillinger» innenfor navigasjonsknappen.

Startprøven passerer 1280/1920/390: alle 17 forslag, faktisk Story+Hardcore, ferdigmalt kart og synlig startknapp. Senfasekontekster med alle HQ-faner, POI, fysisk last og to passasjerer passerer 1280/390. Kartprøven inkluderer lokale GLB-er, ulike posisjoner og context-loss/restore. Checkpoint-prøven bekrefter eksakt gjenopptakelse i felt/natt. Naturlig reise har passert 8 faktiske døgn PC og 6 mobil; sluttkontrollen etter siste etikett-/lagerryddepass passerer også alle åtte/seks døgn med eksakt reload.

Motor, verden, saves, D25–D28 og tallbalanse er uendret. Atlasen er en lokal PNG på omtrent 2,2 MiB og lastes når illustrerte inventarflater brukes; samme fil gjenbrukes mellom rutene. Ingen nye runtime-tjenester, shaders eller evige animasjonsløkker er lagt til. Virkelig GPU-ytelse og eierens kunstneriske vurdering er fortsatt ikke erstattet av skytest. Ny QA må vurdere denne versjonen.

## Bilder og målinger

[Kart før art-løftet](evidence/art-direction/map-day10-before.png), [kart fra faktisk dag 10](evidence/art-direction/map-day10-1280.png), [mobilkart](evidence/art-direction/map-day10-390.png), [start](evidence/art-direction/start-1280.png), [mobilstart](evidence/art-direction/start-390.png), [ekspedisjon](evidence/art-direction/expedition-1280.png), [leir](evidence/art-direction/hq-1280.png), [illustrert lager](evidence/art-direction/inventory-1280.png), [feltbok](evidence/art-direction/book-1280.png). Kartbildet gjenopptar et tidligere faktisk simulert save; øvrige komponentbilder bruker deklarerte kontroll-fixtures.

[Vindus-/interaksjonsresultater](evidence/art-direction/window-results.json), [startmålinger](evidence/art-direction/start-results.json), [senfasekontekster](evidence/art-direction/context-results.json), [naturlig spillerreise](evidence/art-direction/journey-results.json). Atlasens kategorier og genereringsopphav står i [art-README](../apps/game-client/public/art/README.md).
