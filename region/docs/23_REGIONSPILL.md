# Regionspillet: første spillbare versjon

Status 11.11.2026: spillbar versjon `region-0.1` på forsiden. Den første Buøy-prototypen ligger på `/fase1` med egne lagringer.

## Start

- Dobbeltklikk `Stavanger Z.cmd`, eller kjør `pnpm dev` og åpne http://127.0.0.1:3000.
- Velg et av 17 startområder. Hvert L1-område har ett, og Buøy og Lundsneset er med i tillegg. Kortet viser hvor krevende området er, ut fra hvor mange som bodde i nabosonene.
- Frøet gjør runden gjentakbar: samme frø og samme valg gir samme utfall.

## Slik spilles det

En tur er én dag. Velg folk til venstre, velg en sone på kartet og legg til en handling. Folk som ikke får noe oppdrag, hviler og forsvarer leiren. **Avslutt dag** løser alt samtidig.

| Handling | Hva den gjør |
|---|---|
| Speid | Anslår zombier og funn. Lite støy. Gir kontakt med grupper i nærheten. |
| Rydd | Dreper zombier. Skytevåpen dreper flere, men bruker ammunisjon og lager støy. |
| Søk | Henter funn. Hver person bærer en begrenset mengde. Kan gi nye overlevende. |
| Overta | Sonen blir deres. Krever få zombier og minst 10 % gjennomsøkt. |
| Sperr grensene | Barrikader mot nabosoner. Zombier må slite dem ned. |
| Bygg ut | L3-oppgraderinger fra katalogen: drivhus, åkre, fiskebase, regnvann, vaktpost, saltkoking, riving med mer. |
| Etabler HQ | HQ-typen kommer fra kandidaten i sonen, og bestemmer hva dere har fra start og den unike modulen. |
| HQ-modul | Kjøkken, medbay, verksted, ammoverksted, boliger, radiorom, murer med mer. |
| Bygg nett | Strøm, samband, veier og vann for et helt L2-område. Krever anlegg i en sone dere eier. |
| Hold, sperr, spreng | For bruer og tunneler. En sprengt tunnel er borte for godt. |
| Dyrk, fisk | Mat avhenger av årstid, jord og båt. |
| Hvil, behandle, lag | Helse, utmattelse og produksjon i HQ: ammunisjon, antibiotika og byggemateriale. |

## Verden

- **Zombier:** omtrent 12 % av dem som bodde i hver sone. De flytter seg hver dag over grenser, bruer og tunneler, og trekkes mot lyd. Alle flyttinger regnskapsføres, så ingen zombier oppstår fra ingensteds. Om natten møter zombiene i soner dere eier forsvaret der.
- **Hendelser:** én gang i uka kommer en større hendelse, og innimellom små gode overraskelser. Hva som kan skje, avhenger av hva dere eier:
  - kyst gir storm og godt fiske
  - jord gir innhøsting
  - lange undersjøiske tunneler blir oversvømt uten strøm
  - grenser mot uryddede soner gir horder på vandring
  - i tillegg kommer folk ved sperringen, plyndrere, sykdom, brann, rotter og vinterkulde
- **Grupper:** Sju NPC-grupper holder hver sitt HQ:
  - Garnisonen
  - SUS-leiren
  - Verftsfolket
  - Flyplassen
  - Handelslaget
  - Øybøndene
  - Domkirkesamfunnet

  Hver gruppe tilbyr noe og vil ha noe. Kontakt får dere ved å speide i nærheten, med radio eller gjennom hendelser. Handel skjer til verdi, og forholdet til gruppen teller.
- **Årstider:** Spillet starter 1. april. Avlingene er størst om høsten, og om vinteren trengs drivstoff til varme.
- **Moral:** Moralen trekker mot et nivå som avhenger av strøm, kjøkken, HQ, soner, skadde og døde. Faller den til 0, går gruppen hver til sitt.
- **Mål:** Ni milepæler fra «Et trygt sted» til «To måneder».

## For QA

- **Uten nettleser:** `pnpm region:bot [dager=90] [frø=3]` spiller fra alle startområder med en forsiktig bot og skriver én linje per runde. Siste linje er en JSON-oppsummering.
- **I nettleseren:** `window.__szRegion` viser `state`, `world`, `orders` og `selected`, og kan bare leses. Knappene har vanlige tekster. Start-knappen har `data-testid="start-game"`, og Avslutt dag har `data-testid="end-day"`.
- **Lagring:** Spillet lagres i `localStorage` under nøkkelen `stavanger-z.region.v1`.
- **Spillverden:** `apps/game-client/public/world/region-v1.json`. Skrives på nytt med `pnpm region:world` eller knappen **Til spillet** i soneeditoren.
- **Tall å balansere:** De står i `packages/gameplay/src/region/rules.ts`.
- **Hva QA bør vurdere:**
  - Er de første dagene spennende eller trege?
  - Føles tette byområder vanskelige og rike, og landet trygt men tregt?
  - Gir bruer og tunneler interessante valg?
  - Er hendelsene for hyppige eller for snille?
  - Er handelen nyttig?
  - Når blir spillet kjedelig?

## Bot-runde 11.11.2026 (90 dager, 3 frø per startområde)

Se siste kjøring i svaret fra Claude. Boten klarer seg i de fleste startområdene. Antall soner etter 90 dager spriker fra 1–2 i tette byområder til over 20 på landet. Det er en balanse som må vurderes.

## Kjente mangler

- **Grupper:** NPC-gruppene utvider seg ikke og angriper ikke av seg selv. Plyndrere kommer bare gjennom hendelser.
- **Båter:** Båtreiser bruker en enkel rekkevidde på 3 km mellom kystsoner. Ferger finnes ikke.
- **Folk:** Ingen enkeltpersonlighet, relasjoner eller fase 2 med lagledere ennå.
- **Mobil:** Grensesnittet virker, men er ikke tilpasset.
