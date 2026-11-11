# Leveranseplan – bygg en vertikal slice, så skaler

Dette er en prioritert **sekvens**, ikke et estimat eller løfte om total tidsbruk. Hver milepæl leveres som en selvstendig, synlig forbedring med korte beslutningsnotater. Ingen bred «big bang».

Historisk etablerte M0–M3 kart, turmotor og en spillbar solo-prototype. Videre leveranser følger [låste beslutninger 02.11.2026](15_LOCKED_DESIGN_2026-11-02.md). Kartvurderingene dokumenteres i `10_M1_GEOGRAPHY_REVIEW.md`.

## M0 – Avklar prosjektgrensen

**Leveranse:** Nytt repo eller isolert arbeidsmappe, dokumentene lagt inn, anbefalt stack, kort teknisk risikoanalyse. Ingen gjenbruk av eksisterende kode uten vurdering.

- Les docs og noter blokkerende Å-valg.
- Velg renderer og kartdatatilgang for prototype.
- Lag enkel prosjektstruktur for world-data / simulation-core / server / client.
- Lag en minimal demoverden definert i data, ikke hardkodet i UI.

**Godkjenningspunkt:** Eieren ser scope, filstruktur og første verden før større implementasjon.

## M1 – Geografisk modell og kart

**Leveranse:** Interaktivt Buøy/Hundvåg-kart med kuraterte L1/L2/L3-soner, POI-er, ruter, bru-/tunnelforbindelser, zoom og ett kontekstpanel.

- Start med få meningsfulle polygoner. Utvid L3 bare der spillet trenger dem.
- Visualiser known/unknown, valgt sone og strategisk POI.
- Test vann/land-naboskap og minst ett chokepoint.

**Godt nok:** Brukeren kan velge soner og forstå tilknytning, reise og POI-strategi. Ingen combat nødvendig.

## M2 – Headless dagssimulering

Status 31.10.2026: ferdig som headless leveranse; se `12_M2_STATUS.md`. M1 er godkjent og enkelt ryddet. Neste milepæl er M3.

**Leveranse:** Deterministisk turmotor med zombiepopulasjon, naboflyt, lydeffekt, enkel barriere, day advancement og rapport.

- Simuler mange dager uten kart/UI.
- Bruk én seedet testverden og en kort formell ressurs-/zombieledger.
- Verifiser determinisme og populasjonsregnskap; ikke bygg omfattende testinfrastruktur.

**Godt nok:** Motoren lager plausible forløp og klare rapporter uten at zombier oppstår fra ingensteds.

## M3 – Spillbar fase 1 (første reelle milepæl)

Status 31.10.2026: spillbar solo-prototype levert; se `13_M3_STATUS.md`. Etter eierens M3-føringer er første mål en liten midlertidig base, ikke hele Rosenberg. Første vurdering er eierens 10–15 spilte dager. Flerdagersoppdrag og fase 2-overgang utsettes; M3-oppdrag tar én dag.

**Historisk leveranse.** Fire overlevende, turavslutning med rapport, enkel kamp og forsyningshenting, midlertidig base og lokal lagring. M3 demonstrerer de tekniske grunnreglene med éndagsoppdrag og en tydelig målsekvens. Se [M3-status](13_M3_STATUS.md).

## M3.1 – Ny fase 1-slice

- Bruk [de første 15 dagene](16_PHASE1_SLICE.md) til å prøve flere strategier, fra stille rekognosering til raske forsyningsraid.
- Skill arbeid, utvendig klarering, bygningssøk, kontroll og forsvar. Gjør arbeidsfremdriften varig mellom døgn og vis belastningen på utsatte passasjer.
- Prøv en konkret individuell rekrutteringsbeslutning og vis hvilke behov og relasjoner den endrer. Spesifiser én produksjonskjede som neste utvidelse av ressursløkken.
- Vis veien fra tilfluktssted til HQ og forsvarbart L2. Kalibrer kravene gjennom målrettet spilling.
- Bruk et separat lagringsnavnerom for prototypen. Kartendringer og migrering av aktive spill krever egen plan og godkjenning.

**Godt nok.** Spilleren forstår alternativene, ser konsekvensene i dagsrapporten og kan fortsette en påbegynt operasjon neste døgn.

## M4 – Fase 2-overgang og automatisering

**Leveranse:** Egnede overlevende, både opprinnelige og rekrutterte, kan bli crew-ledere etter at et fungerende HQ og et forsvarbart L2 er etablert. L2-clear ordre brytes ned i L3-operasjoner. Valg av Safe/Fast route og prioritet for POI.

- Crew har aggregert mannskap, utstyr, transport og ETA.
- HQ har 2–3 grunnleggende funksjoner (f.eks. workshop, security, water).
- Forsvar og patrol kan redusere lokal zombieinntrengning.

**Godt nok:** Spilleren slipper å klikke hvert L3-område, men kan velge det når han vil.

## M5 – Co-op

**Leveranse:** To spillere i én sesjon med separate startsteder, skjulte ordrer, Ready/Lock/Resolve, reconnect og delt daglig verdensstatus.

- Samme simuleringsmotor som solo.
- Lås dag atomic/idempotent.
- Test simultant angrep på samme sone og ressurskonflikt.

**Godt nok:** To spillere kan planlegge og løse 10+ dager sammen uten divergerende tilstand eller doble turer.

## M6 – Fase 3–5, senere

Avhenger av faktisk spillerfeedback fra M3–M5. Legg til produksjonsnett, diplomati, regelsett, mutation research, flere kartregioner og sluttmål som separate, prioriterte systemer. Ikke implementer dem før kjernen er validert.

## Hvordan Codex bør jobbe

For hver milepæl:

1. Kort scope og antakelser (maks én side).
2. Implementer minst mulig komplett vertikal løsning.
3. Kjør relevant smal verifikasjon; prøv hovedflyten manuelt.
4. Vis demo/screenshot og oppsummer hva som er ferdig, svakheter og anbefalt neste steg.
5. Avklar ny designbeslutning før scope utvides.

**Ikke:** seks parallelle agenter som bygger hver sin halvferdige simulator, en stor testpakke før spilling, 1000 POI-er fra import før UI fungerer, eller automatisk redesign av eksisterende prosjekt.

## Scope-/kvalitetsporter

**Grønt:** Kan spilleren forstå konsekvensene av en handling? Er motoren deterministisk og geografisk konsistent? Er opplevelsen morsom i 20–40 dager?

**Rødt:** Flere kompliserte ressurser uten spillverdi, automatisert geografisk inndeling uten manuell kvalitet, skjult spawning, dobbelt turn-resolve, UI som viser hemmelige tall, eller fase 3-funksjoner før fase 1 fungerer.
