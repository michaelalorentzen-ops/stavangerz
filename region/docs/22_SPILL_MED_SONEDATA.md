# Spill med sonedata: forslag

Status: forslag 10.11.2026, ikke besluttet. Bygger på [21_RESSURSER_OG_HQ.md](21_RESSURSER_OG_HQ.md) og dataene fra soneeditoren.

## Hva dataene gir oss

For hver L3-sone vet vi:
- areal, husrom, jord i drift, beite, hager, skog, myr og fjell (OpenStreetMap og AR5)
- kystlengde, og hvor mye av grensen som er vann
- hva som kan finnes og produseres
- hvor tungt det er å ta over sonen

I tillegg har vi HQ-kandidater, anlegg, ressurssteder, og 32 bruer og tunneler som forbinder sonene.

## Det som gjør det spennende

1. **Grensen koster, vannet er gratis.** Hver meter landgrense må holdes med vakter. Vann trenger ingen. Det gjør øyer som Buøy, Hundvåg, Rennesøy og Finnøy fristende, men da blir bruene og tunnelene livsnerven. Vekst gir mer ressurser, men lengre grense.
2. **Bruer og tunneler er valg med pris.** Du kan holde, sperre eller sprenge. Det er lett å sprenge, men dyrt å gjenoppbygge, og en sprengt tunnel er borte for godt. Undersjøiske tunneler trenger strøm til pumpene. Uten strømnett fylles de med vann etter en tid, og da forsvinner forbindelsen av seg selv.
3. **Matklokka.** Butikkmat tar slutt og går ut på dato. Jord må sås om våren og høstes om høsten, så den første vinteren blir en krise for den som ikke har planlagt. AR5 gjør jordbruksområdene på Rennesøy, Finnøy og i Sola verdifulle. I byen må man rive hus og dyrke hagene.
4. **By eller land.** Tette byområder har mange bygg og mange zombier, men også mye å finne. Landlige soner er store og tar lang tid å gå over, men har jord, diesel, traktorer og jaktvåpen. Begge veier gir noe, og begge koster.
5. **Det sjeldne skaper handel og konflikt.** Tennhetter, antibiotika, sprengstoff og 3D-printere finnes få steder: militærleirer, apotek, sykehus, skoler og steinbrudd. NPC-grupper kan sitte på dem. Det gir grunn til å handle, alliere seg eller angripe.
6. **HQ-et er identiteten din.** Et verft bygger kjøretøy, et sykehus forsker og en kystgård lever av sjø og jord. Ingen typer har trekk lagt inn for typens skyld. Svakheten er det området rundt mangler.
7. **Hendelser knyttet til stedet.** En storm stopper fergene. En tunnel blir oversvømt. En horde vandrer gjennom Byfjordtunnelen fra Randaberg. Røyk fra Forus kan ses fra hele byen.

## Hvordan spillet kan bruke soneeditorens verden

Spillet laster bare L1-, L2- og L3-soner, steder og forbindelser, aldri cellene.

| Steg | Innhold |
|---|---|
| 1. Spillverden fra eksporten | Forenkle geometrien til om lag 3–5 m i en egen spillfil, og del den opp per L1, så klienten laster bare det som trengs. Hele regionen har i dag 900 000 punkter, og det er for mye for nettleseren. |
| 2. Fjern hardkodede ID-er | Start, base og første POI defineres i verden, for eksempel med rollen «start» i editoren. Illustrasjoner velges etter sonetype, ikke etter ID. |
| 3. Kart | Bytt dagens SVG-kart, som er låst til Buøy, med MapLibre som i editoren. |
| 4. Regler fra målingene | Zombieantallet hentes fra overtakelsesanslaget, funn fra *Kan finnes her* og arbeidstid fra bygg og areal. |
| 5. «Test i spillet» | En knapp i editoren eksporterer og starter en ny gjennomspilling på den verdenen. Gamle lagringer beholder sin verden. |

**Beslutning som trengs før steg 1–5:** Leveranseplanen sier at kartbytte og migrering av spill skal ha egen plan og godkjenning. Fase 1-utsnittet på Buøy flyttes da fra dagens verden med 14 celler til editorverdenen. Den nye verden får ny versjon, og gamle lagringer bruker fortsatt den gamle.
