# Regelhefte for stedsnavn

Slik gir vi navn til sektorer, porter og nøkkelsteder inne i et område. Reglene gjelder alle regioner. Navnene skrives inn i regionens `places.ts`.

Tonen er Dead of Winter: et kart over funksjoner, ikke adresser. Spilleren skal se på navnet og vite hva som finnes der, og hva det koster å hente det. «Skolen», «Bensinstasjonen», «Matbutikken». Det ekte stedet er krydderet, ikke navnet.

## 1. Grunnreglene

1. **Funksjon først.** Navnet sier hva stedet er: «Byggvarehuset», ikke «Obs Bygg Buøy».
2. **Bestemt form entall, ett eller to ord.** «Kaia», «Boligfeltet», «Bilforhandleren». `short` er som regel det samme som `name`.
3. **Det ekte navnet står i `real`, `realAt` og beskrivelsen.** `real` vises som undertittel på sektorkortet. Tekster som forteller hvor crewet er eller hvilken sektor som påvirkes (logg, encounters, UI, utfall av valg), bruker funksjonsnavnet, fordi spilleren skal kjenne igjen sektoren på kartet. Tekster om byen og folkene i den (hendelser, beskrivelser), bruker `real`. «Ukens tilbud: alt. Obs Bygg har gangene fulle av spikerpistoler …». Merkenavn, gatenavn og lokale kallenavn hører hjemme i `desc`, i funn og i hendelser, aldri i navnet.
4. **Ingen vitser i navnet.** Humoren står i teksten rundt. Navnet er tørt og nyttig.
5. **Like steder skilles med retning**, sett fra midten av området: «Boligfeltet nord», «Boligfeltet sør». Bruk retningen bare når det finnes to av samme slag.
6. **Mer enn to av samme slag skilles med et kjennetegn:** «Blokkene ved kaia», «Villaene på høyden». Kjennetegnet skal være noe man ser på kartet.
7. **`at` er navnet med preposisjon** slik det står i en setning. Se kapittel 4.

## 2. Stedstyper

Typen avgjør hva stedet gir, og navnet følger typen. Kolonnen «Type i spillet» viser hvilken `kind` stedet har i dag. Undertypene (matbutikk, byggvare og så videre) er **[Forslag]**: i dag deler alle butikker samme type, og verdiene settes per sektor.

### Butikker

Skill butikkene etter hva de selger. Da blir valget av mål et reelt valg.

| Navn | Gir mest | Type i spillet |
|---|---|---|
| Matbutikken | mat, vann | butikk |
| Byggvarehuset | tre, skrap, verktøy | butikk |
| Jernvarehandelen | skrap, verktøy, litt våpen | butikk |
| Dyrebutikken | mat (fôr), medisin (dyremedisin), bur og nett | butikk |
| Interiørbutikken | tre, tekstiler, litt beskyttelse | butikk |
| Klesbutikken | beskyttelse (jakker, støvler) | butikk |
| Sportsbutikken | beskyttelse, litt våpen, kondis-utstyr | butikk |
| Bensinstasjonen | drivstoff, snacks, litt verktøy | industri |
| Bilforhandleren | drivstoff, metall, kjøretøydeler | industri |
| **Våpenbutikken** / **Jaktbutikken** | våpen, ammunisjon | nøkkelsted |

### Boliger

Navngi etter bebyggelsen. Den forteller hvor mange som bodde der, og hvor mange kjellere det er.

| Navn | Kjennetegn |
|---|---|
| Rekkehusene | mange naboer, korte avstander, få kjellere |
| Boligfeltet | eneboliger, garasjer, mange kjellere og boder |
| Villaene | få folk, mye å finne per hus, hager |
| Blokkene | mange folk, mange zombier, trappeoppganger og heis |
| Hyttene | spredt, lite å finne, god utsikt |

### Offentlige steder

Skolen, Barnehagen, Kirka, Biblioteket, Idrettshallen, Legesenteret, Sykehjemmet. Brannstasjonen og Politistasjonen er HQ-kandidater (kapittel 3), ikke vanlige sektorer.

### Arbeid og havn

Industriområdet, Verkstedet, Lageret, Verftet, Kaia, Båthavna, Ferjekaia, Fiskemottaket.

### Natur

| Navn | Gir |
|---|---|
| Skogen | tre, vilt, skjul. Få zombier, men vanskelig å se dem |
| Jordene | dyrkbar mark. Lite i fase 1, men matproduksjon fra fase 2 **[Forslag]** |
| Parken | litt av alt, åpen og oversiktlig |
| Stranda / Svaberget | fisk, vann (med filter), lite skjul |

### Veier og kryss

Krysset, Rundkjøringen, Brufestet, Tunnelmunningen. Slike steder er ofte der portene ligger.

## 3. Nøkkelsteder og HQ-kandidater

Noen steder er så verdifulle at de bryter balansen hvis det finnes ett i hvert område.

**Nøkkelsteder** gir én ting i store mengder:

- **Apoteket:** mye medisin og sjeldne medisinkort.
- **Våpenbutikken / Jaktbutikken:** de eneste gode skytevåpnene i tidlige faser.

**HQ-kandidater** er store bygg med skjulte verdier og en sjanse for funn av alle slag, én gang: Sykehuset, Brannstasjonen, Politistasjonen, Verftet, Kjøpesenteret og Fortet.

Reglene:

1. **Høyst ett nøkkelsted og én HQ-kandidat per område** i fase 1. Rosenberg Verft er Buøys HQ-kandidat.
2. **Navnet kan være det ekte navnet**, fordi det er et landemerke: «Rosenberg Verft», «Kjøpesenteret på Kvadrat». `short` er da det korte ekte navnet («Rosenberg»).
3. **Begge er alltid farlige:** trussel 4–5, låst, eller med en pris (støy, horde, lang reise).

## 4. Preposisjonen i `at`

| Bruk | Når | Eksempler |
|---|---|---|
| **på** | institusjoner, butikker, arbeidsplasser, flate steder | på skolen, på bensinstasjonen, på kaia, på jordene, på verftet |
| **i** | inni noe som omslutter, eller et område man går inn i | i skogen, i blokkene, i boligfeltet, i krysset, i parken |
| **ved** | noe man står ved, ikke i | ved brua, ved tunnelen |
| **hjemme** | bare sektoren `hjem` | |

Er du i tvil, si setningen høyt: «De ble overrasket ___ Byggvarehuset.»

## 5. Porter

En port heter etter det den sperrer, med retning når det trengs: «Brua», «Tunnelen», «Nordporten», «Gjerdet mot verftet». Beskrivelsen sier hva som kommer derfra.

## 6. Når et område kartlegges

1. Del opp området slik det ser ut, med 6–8 sektorer.
2. Gi hver sektor en type og et funksjonsnavn etter kapittel 2.
3. Velg høyst ett nøkkelsted og én HQ-kandidat.
4. Skill like steder med retning eller et kjennetegn.
5. Skriv `desc` med ekte navn og lokal humor.
6. Sjekk at `at` leses riktig i en setning.

## Eksempel: Buøy

Buøy-sektorene heter nå dette:

| Id | Før | Navn | `real` |
|---|---|---|---|
| `hjem` | Hjemme | Hjemme | Hjemme |
| `tommerodden` | Tømmerodden | Kaia | Tømmerodden |
| `obs` | Obs Bygg Buøy | Byggvarehuset | Obs Bygg |
| `nordkrysset` | Nordkrysset | Krysset | Nordkrysset |
| `buoy_nord` | Buøy nord | Boligfeltet | Buøy nord |
| `skolen` | Buøy skole | Skolen | Buøy skole |
| `sorspissen` | Sørspissen | Industriområdet | Sørspissen |
| `rosenberg` | Rosenberg Verft | Rosenberg Verft (HQ-kandidat) | Rosenberg Verft |
