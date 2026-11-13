# Akseptanse – få tester, riktig risiko

Målet er å bevise en interessant og konsekvent spilleløkke, ikke å maksimere testantall.

## 1. Menneskelig gjennomspilling – første vertikale slice

Bruk en dokumentert seed og fire navngitte overlevende på dag 0.

1. Åpne kart. Forstå base, ukjente soner, ressursbeholdning og End Day uten ekstern forklaring.
2. Scout én L3-sone. Få estimat og tidspunkt, ikke allvitende eksakt state.
3. Velg rute og gear. Rydd en tilgrensende sone over én eller flere dager.
4. Claim og sett opp en enkel beskyttelse eller vakthold.
5. Besøk POI, finn begrensede ressurser og se at samme POI ikke gir uendelig loot.
6. Støy/aktivitet trekker zombier fra nabosone. Lokal sum og global sum stemmer.
7. Forsvar presses over tid; varsling gir sjanse for reaksjon.
8. En overlevende skades, mister kapasitet, helbredes eller dør; spilleren må omprioritere.
9. Et event tilbyr et ubehagelig valg, og en konsekvens viser seg senere.
10. Spilleren sikrer kvalifisert HQ, og fase 2-systemet viser samme karakterer som potensielle crew leaders.
11. I kort fase 2-demonstrasjon: Gi én L2-clear ordre, angi prioritert POI og se L3-dag-for-dag-fremdrift.

Første slice er godkjent når flyten er forståelig, ikke kollapser logisk og skaper minst ett faktisk vanskelig strategisk valg.

## 2. Bare tre automatiske kontroller fra start

**A. Determinisme:** Samme initial-state, samme ordrer og samme seed gir samme resultat, inkludert relevante rapporter.

**B. Bevaring og grenser:** Zombiebevegelse kan ikke skape/fjerne zombier; eksplisitte infeksjoner, kills, migrasjon og decay regnskapsføres. Ingen negative ressurser eller dobbeltbruk av crew/gear.

**C. Turn idempotency:** To samtidige Ready/Resolve-forsøk for samme session/day fører til nøyaktig én ny dag og én lagret turrapport.

Legg til smale regresjonstester for bugs som faktisk oppstår. Ingen stor snapshot-suite eller E2E-farm.

## 3. En enkel balansesjekk

Etter at M3 er spillbar: Kjør et lite antall seedede headless runs og vurder:

- Hvor ofte stopper spilleren før HQ?
- Hvor mange dager tar første sikre ekspansjon?
- Hvor mye mat/vann/ammo bruker man typisk?
- Oppstår soneinvadering gjennom forståelige forbindelser?
- Blir hendelser repetetive eller urimelige?

Rapporter fordelinger og observasjoner; ikke tun tall bare for å oppnå et vilkårlig prosentmål.

## 4. Synlig demo ved milepæl

Lever kort videosnutt eller få skjermbilder og en 5–10 punkters status. Vis én konkret handling fra start til konsekvens. Ingen markedsføringspresentasjon.

## 5. Definition of done for fase 1

- Spilleren kan spille 20–40 turer uten utviklerassistanse.
- Valg og utfall er konsistente med spillreglene og geografien.
- Systemet støtter videreutvikling uten å måtte bytte ut hele simuleringsmotoren.
- UX gir lesbarhet, risiko og feedback.
- Åpne beslutninger og kjente svakheter er dokumentert.
