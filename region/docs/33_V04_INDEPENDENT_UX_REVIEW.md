# Uavhengig produkt- og spill-UX-vurdering av StavangerZ

Grunnlag: baseline `2737333`, `region/AGENTS.md`, spesifikasjon 27, beslutninger 28, leveranseplan 29, `desktop-day-8.png` og de tre dokumenterte v04-bildene i `docs/evidence/`. UI-kode er lest gjennom `git show 2737333:…`; ingen nye HUD-filer eller andre agentnotater er lest. Ingen spillkode er endret. Vurderingen er en ekspertgjennomgang, ikke dokumentasjon på nybegynneres faktiske atferd eller verifisering av motorfeil.

## Største observerte problemer

1. **Å velge dagens strategi er vanskeligere enn å finne knapper.** Dag-8-bildet viser fire detaljerte personkort, en lang og allerede delvis avkuttet arbeidskatalog, et stort generisk råd og flere navigasjonselementer samtidig. Ingen av dem sier konkret hva som er dagens beste problem å ta stilling til. Dette er et informasjonshierarkiproblem, ikke mangel på funksjoner.
2. **Kontekstpanelet kan miste sin egen kontekst.** I dag-8-bildet er soneoverskrift og første handlinger rullet ut av syne, mens svært forskjellige aktiviteter fortsatt følger i én liste. Spilleren må holde valgt sted og oppdragets mål i hodet. Koden samler feltoppdrag, rutinearbeid, bygging, HQ-moduler og crafting under «Oppdrag», med logistikk som et ytterligere panel etterpå.
3. **Viktige strategiske konsekvenser kommer for sent.** Reise, retur, last, mandat og samband finnes, men ligger i dialogen som åpnes fra dagsplanens «Utstyr». Spilleren må først legge inn en ordre, deretter finne et misvisende navngitt inngangspunkt for å forstå om laget kommer hjem og hvilke feltbeslutninger det tar. I fase 1 er nettopp fravær om natten avgjørende.
4. **Faseadaptasjonen er svak i den dokumenterte hovedflaten.** Fase-4-bildet viser fortsatt en lang personlig mannskapsliste og samme «Hold kjernen levende»-kort som fase 1. Koden velger dette rådet ut fra HQ/eierskap, ikke dagens situasjon eller fase. Regionale avvik kan finnes andre steder; poenget er at startflaten fortsatt prioriterer den gamle ledelsesoppgaven.
5. **Geografien konkurrerer med HUD-en.** Store polygoner har tydelige omriss, men hverdagslige stedsnavn og forholdet mellom leir, valgt sone og omkringliggende muligheter er lite selvforklarende i dag-8-utsnittet. Kartet har god plass; leseren trenger en tydeligere forklaring på hva stedet betyr for dagens valg. Fase-4-bildets «2 av 8» og ærlige delkontroll er et godt grunnlag som bør bevares.

Dokumenterte styrker: fire faste personidentiteter, synlig dag og døgnknapp, ressursutholdenhet, et gjenåpnbart rapportsystem, ærlig L2-kontroll og mobilhistoriekort med tydelig avslutning. Dette bør utvikles videre. Bildet av fase 2 på dag 1 er et scenariobilde; det alene beviser ikke at naturlig progresjon er feil.

## Min anbefalte interaksjonsarkitektur

Spillerløkken bør være: **Forstå dagens press → velg et sted eller en person → sammenlign en konkret handling → bind kapasitet → se planens samlede konsekvens → la døgnet gå → forstå hva som endret seg.** Spillet skal støtte både person-først og sted-først, uten å kreve en bestemt klikkrekkefølge.

- **Fast ramme:** dag/klokke, fase, mat og vann uttrykt som utholdenhet, alvorligste aktuelle trussel. Bunnlinjen viser uavklarte beslutninger, inngang til hele dagsplanen og døgnknappen. Planlagte ordre er ikke i seg selv varsler.
- **Kart:** primær arbeidsflate med leir, kjente folk/lag, valgt område og relevante spor. Et lite «I dag»-kort kobler ett faktisk behov og ett kapasitetsmål til konkrete steder eller valg. Det gir råd, ikke en påtvunget oppdragskjede.
- **Kontekstpanel:** først «hva vet vi om dette stedet/personen, og hvorfor betyr det noe?». Deretter relevante handlingsfamilier, for eksempel undersøke, sikre, forsyne eller utvikle. Et valgt oppdrag åpner selve planleggeren; detaljer om bygninger, lager og logistikk får egen dybde.
- **Oppdragsplanlegger:** sted, aktivitet og folk i samme flate. Auto-utstyr er standard. Før bekreftelse vises forventet retur, hvem som blir igjen til nattforsvar, kjente kostnader og vesentlig usikkerhet. Mandat og utstyrsdetaljer kan utvides. «Utstyr» bør ikke være eneste vei til reise og mandat.
- **Dagsplan:** både nye ordre og allerede pågående oppdrag, med tydelig forskjell på de to. Endre eller avbryt på stedet. Vis en ærlig, samlet kapasitetsoppsummering og reservasjoner før døgnet starter.
- **Rapport:** én hovedhendelse med årsak og konsekvens, faktisk forsyningsutholdenhet og få viktige oppfølginger. «Vis på kart» binder hendelsen tilbake til spillflaten. Kritiske uleste funn må finnes igjen etter lukking.
- **Faseutvikling:** tidlig er personenes liv og nære ekspedisjoner hovedsaken; deretter HQ-drift og kapasiteter; sent regioners avvik, forsyningslinjer og ledermandater. De samme menneskene og festede kortene lever videre. ZA-bok og historikk er tilgjengelige som dybde, ikke et ekstra obligatorisk trinn hver morgen.

## Visuell retning

En geografisk feltledelse med menneskelig nærhet: mørk blågrønn grunn, varme offwhite tekster, avdempede terrengflater og gjenkjennelige personportretter. Bruk blek grønn til gjennomførbar handling, amber til oppmerksomhet og rød til konkret fare; ikke samme gule vekt på alle grenser og elementer. Skill valgt sone fra eierskap med form/linjetype i tillegg til farge. Bevar synlige veier og noen få relevante stedsnavn ved hvert zoomnivå. Bruk stor typografi på beslutningsgrunnlaget og mindre på oppslag; unngå små, likeverdige tallrekker på alle personkort. En illustrasjon hører best hjemme ved et viktig sted, funn eller faseskifte, og skal ikke dekke kartet til daglig.

Mobil bør ha samme mentale modell: kart, én aktiv bottom sheet og fast døgnhandling. Ark skal kunne trekkes ned uten å miste utkastet. Screenshottene av historiekortene er lesbare, men de dokumenterer ikke hele mobilens planleggingsflyt.

## Fem akseptansekriterier for en ferdig spillopplevelse

1. **Første meningsfulle dag:** En ny spiller kan i fase 1 peke ut leiren og de fire overlevende, forstå ett aktuelt behov og planlegge et relevant oppdrag uten ekstern forklaring. Etter bekreftelse ser spilleren hvilke personer som er bundet og hvem som blir igjen.
2. **Ærlig planlegging:** Før døgnstart kan spilleren se forventet retur, kostnader/reservasjoner og nattforsvar for dagens plan, endre eller avbryte en ordre og forstå hvorfor en ugyldig handling ikke kan gjennomføres. Ukjent risiko presenteres som ukjent, ikke som et oppdiktet sikkert anslag.
3. **Forståelig konsekvens:** Etter ett døgn kan spilleren forklare den viktigste endringen, finne hendelsens sted og se neste praktiske mulighet. En kritisk avgjørelse kan ikke skippes, og kritiske uleste funn er tilgjengelige også etter at rapporten lukkes.
4. **Samme spill gjennom vekst:** En lagring i fase 1, 2 og 4/5 åpner med riktig ledelsesoppgave i fokus: person/nærmiljø, HQ/kapasitet, så regionale avvik/mandater. Normal regional rutine krever ikke manuell gjentakelse av alle lokale ordre; viktige personer og regional forsyningsfysikk forblir synlige.
5. **Sammenhengende gjennomspilling:** En menneskelig test fra fire overlevende via HQ til regional styring viser at mål og manglende kapasiteter kan forstås underveis, at valg påvirker mennesker og kart, og at en vanskelig dag gir et begripelig neste valg. Samme kjerneflyt fungerer på desktop og mobil uten avkuttede bekreftelser, skjult valgt sted eller horisontal scrolling.

Disse er mine UX-forslag innenfor de låste prinsippene, ikke nye låste spillregler eller erklæring om at akseptansen er oppfylt.
