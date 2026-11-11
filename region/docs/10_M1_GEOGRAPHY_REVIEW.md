# M1 – geografisk utkast til vurdering

Historisk vurdering: M1 er nå godkjent og geografivurderingen avsluttet. Siste føringer står i beslutningsloggen; videre arbeid følger M2/M3.


Dato: 31.10.2026. Status: **M1 godkjent som teknisk prototype; geografi fortsatt åpen.** Se `11_GEOGRAPHY_DETAIL_REVIEW.md` for siste vurdering.

## Åpne og kontroller

Fra prosjektroten: `pnpm install --frozen-lockfile`, deretter `pnpm dev`. Åpne http://127.0.0.1:3000 . For produksjonsvisning: stopp dev, kjør `pnpm build`, deretter `pnpm start`. Begge serverne bindes til loopback. Ingen deploy eller eksterne kartfliser.

Bruk L1/L2/L3-knappene, velg en sone i kart eller liste, og åpne POI/passasjer i kontekstpanelet. Dag 0-skissen viser bare ett foreslått kjent startområde. Kartet er en redigerings-/gjennomgangsvisning med full geografi, ikke en spillklient som beskytter skjult intel.

## Forslaget

- L1: ett kuratert Buøy/Hundvåg-utsnitt.
- L2: **Buøy** og **Hundvåg sør** er aktive. Et tredje, lite **Engøy-randområde** er framtidig og finnes bare for å gi bruforbindelsen et reelt endepunkt.
- L3: 11 soner i første område, Rosenberg som framtidig HQ-kandidat og et framtidig bruland på Engøy. Antallet er et resultat av utsnittet, ingen kvote.
- 10 kildebelagte POI-markører, 14 eksplisitte forbindelser og tre tematiske vannbarrierer.
- Veier, bygninger og kyst er fra OSM. Spillgrenser og adgang er forslag; særlig Hundvåg-grensene er grove korridorskisser.

## Strategiske lesninger

Foreslått start er **03 Tårnringen/Fregattveien**. Nordover finnes en rute via **02 Buøy idrett/Beite → 01 Hundvågveien/Kommandørveien → 07 Bangarvågen → 08 Ulsnes/Hundvågkrossen**. Den smale landforbindelsen er en eksplisitt passasje mellom L2-områdene.

**09 Nedre Vågen** ligger nær Buøy over sjøen, men landruten går gjennom **08 → 10 → 11 → 09** rundt Galeivågen. Ingen direkte vannpassasje er lagt inn.

En mulig senere HQ-rute er **03 → 04 Pyntesundveien → 05 Clipperveien/verftsadkomst → 06 Skipsbyggergata/Ankerplassen → 07 Bangarvågen → 12 Rosenberg**. Nordruten via 02/01 gir også forbindelse. Siste verftsadkomst er framtidig; faktisk port/adgang må kurateres før spilling. HQ er verken etablert eller automatisk sikret.

**Pyntesund bru** er en egen framtidig forbindelse til **13 Engøy**. Tunnelen vises som underjordisk kildegeometri med en transportmarkør ved Buøy-tilkomsten; utløp utenfor utsnittet og kjøreregler er ikke oppfunnet for M1.

## Vurder særlig før låsing

1. Er **03** et godt lokalt utgangspunkt med forståelig vei mot forsyninger og verftet?
2. **07** er stort fordi kai/industri henger sammen. Bør området deles ved en faktisk port eller en annen tydelig intern barriere?
3. **05** (tidligere merket Dalehaugen) er en liten adkomstlomme på omtrent 3 000 m². Behold den bare hvis denne passasjen gir et meningsfullt taktisk valg; ellers slå den sammen før første godkjente verdensversjon.
4. Hundvåg-korridorene trenger lokal vurdering. Nord-/østkant er kartutsnitt, ikke sjø, vegg eller verdensgrense.

## Teknisk kontrakt og utvidelse

`WorldDefinition` inneholder statisk geografi; `GameState` inneholder bare dynamisk tilstand og ID-referanser. Navn, etikettposisjon og listeindeks brukes ikke som identitet. L3-ID-er er eksplisitt registrert med innvendige ankerpunkter i kurateringsskriptet.

Publiserte tilstander skal bindes til både `worldId` og `worldVersion`, og gamle publiserte definisjoner beholdes i registeret. Under M1 er definisjonen derimot et redigerbart utkast. `resolveSavedWorld` avviser utkast som grunnlag for publiserte lagringer; ingen migreringslogikk bygges for geografikurateringen. Kompatibilitetskontrollen beskytter publiserte definisjoner, men tillater korrigering av utkast.

Dag 0-skissen oppretter ikke kontroll, populasjon, ressurser eller HQ. L1/L2 har ingen egne zombiepopulasjoner. Geografiversjonen låser ikke senere balanseverdier.

## Verifikasjon

- `pnpm validate:world`: hierarki, referanser, geometri, hull, soneoverlapp, POI-/kantplassering, minst to L2 og versjonskompatibilitet.
- Shapely-kontroll på eksporten: gyldige polygoner, adskilte L3-interiører og ingen modellert veipassasje over sjø.
- `pnpm typecheck` og lokalt produksjonsbygg bestått.
- Manuelt i Chrome: L1-/L2-/L3-valg, eget Hundvåg-aggregat, zoom, dag 0-skisse, Rosenberg-markør, HQ-kandidat og markering av framtidig verftsadkomst. POI-klikk som først valgte polygonet bak markøren ble rettet med stopp av hendelsesbobling.
- Dette er en kartgjennomgang. Dag 0 → HQ-spilling, determinisme/populasjonsregnskap og samtidig turløsning kommer med respektive motor-/spillmilepæler.

## Status ved grensen

**Fungerer:** lokal kartvisning, geografisk hierarki, kildebelagte POI-er, eksplisitt graf og separate statiske/dynamiske kontrakter.

**Bevisst utelatt:** detaljert UI, kamp, økonomi, turløsning, co-op, database og spillbar verftsetablering.

**Største risiko:** kartdata bekrefter ikke porttilgang eller gode taktiske grenser. De store og små sonene må vurderes før motorregler bindes til dem.

**Neste leveranse:** målrettet geografirevisjon parallelt med en M2-start på syntetiske soner. Endelig geometri er ikke en forutsetning for headless motorarbeid, etter eierens siste avklaring.
