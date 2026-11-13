'use client';

import { useState } from 'react';
import {
  GEAR_CATALOG, MUTATIONS, PHASES, TECHS, gearItemName, goalMet, indexWorld, knownGearItems, phaseOneReadiness,
  type RegionState, type RegionWorld,
} from '../../../packages/gameplay/src/region/index';
import './za-book.css';
import { visibleDiscoveries } from '../../../packages/gameplay/src/region/discoveries';

type BookTab = 'chapters' | 'manual' | 'field';
type Note = { lead: string; body: string };

const CHAPTER_NOTES: Record<number, { motto: string; advice: Note[]; closing: string }> = {
  1: {
    motto: 'Et sted å sove. Noe å drikke. En vei ut.',
    advice: [
      { lead: 'Se før du handler.', body: 'En gate kan se tom ut uten å være trygg. Speid, vurder retrett og velg hvilke soner som faktisk er verdt risikoen.' },
      { lead: 'Hold noe, ikke alt.', body: 'Noen få sammenhengende områder med forsvar er mer nyttige enn mange steder du ikke klarer å beskytte.' },
      { lead: 'Tell munnene.', body: 'Flere overlevende kan gi deg flere hender, men alle trenger mat og vann hver dag. Du bestemmer hvor stor risikoen skal være.' },
    ],
    closing: 'Det finnes ingen perfekt start. Du trenger en leir som overlever neste natt.',
  },
  2: {
    motto: 'Å overleve er én ting. Å leve sammen er noe annet.',
    advice: [
      { lead: 'Bygg rutiner.', body: 'Et hovedkvarter trenger mat, vann, hvile, arbeid og folk som holder vakt. Størrelse alene gjør ingen tryggere.' },
      { lead: 'Du må velge.', body: 'Regler former samfunnet. Det som er effektivt i dag, kan koste deg tillit senere.' },
      { lead: 'Folk er forskjellige.', body: 'Legg merke til hvem som kan speide, bygge, pleie og lede. En dyktig person kan være viktigere enn enda et våpen.' },
    ],
    closing: 'Et samfunn skal vare når du ikke selv står ved porten.',
  },
  3: {
    motto: 'Det er slutt på det som står igjen i hyllene.',
    advice: [
      { lead: 'Finn nye kilder.', body: 'Et stabilt samfunn kan ikke leve av leting alene. Produksjon, handel og transport må etter hvert erstatte funn.' },
      { lead: 'Hold forbindelsene.', body: 'Et område langt borte er vanskelig å holde dersom forsyningene ikke kommer frem.' },
      { lead: 'Lær av de døde.', body: 'Zombiene kan endre seg. Observasjoner og forskning gjør trusler lettere å forstå, men fjerner ikke risikoen.' },
    ],
    closing: 'Den neste vinteren er et større problem enn den neste gaten.',
  },
  4: {
    motto: 'Du kan ikke stå vakt i hele Stavanger.',
    advice: [
      { lead: 'Fordel arbeidet.', body: 'Se etter flaskehalser i mat, bygging og vakthold. Flere områder hjelper lite dersom dere mangler folk til å holde dem.' },
      { lead: 'Husk menneskene.', body: 'Et stort samfunn trenger mer enn forsvar. Lover, helse og tillit påvirker hvor lenge folk holder sammen.' },
      { lead: 'Beskytt helheten.', body: 'En dårlig forbindelse, et svakt forsvarsverk eller en tom matbod kan true mer enn én bydel.' },
    ],
    closing: 'Du må velge hva slags makt du vil ha, og hva du lar andre bestemme.',
  },
  5: {
    motto: 'Hva skal bli igjen etter at de døde er borte?',
    advice: [
      { lead: 'En seier er ikke bare et kart.', body: 'Mat, tillit, forskning, diplomati og samhold kan være like viktige som grenser.' },
      { lead: 'Tenk over hvem dere ble.', body: 'Valgene dine skaper et samfunn. Det er ikke sikkert at den enkleste veien gjennom krisen er den du vil være kjent for.' },
      { lead: 'Ingen vet alt.', body: 'Noen historier blir aldri funnet. Andre tar slutt fordi menneskene som bar dem, ikke overlevde.' },
    ],
    closing: 'Boka har ingen fasit på hva Stavanger skal bli.',
  },
};

const MANUAL: { heading: string; description: string; entries: Note[] }[] = [
  {
    heading: 'Kartet',
    description: 'Det du vet, er ikke alltid det som finnes.',
    entries: [
      { lead: 'L1, L2 og L3', body: 'L1 er store deler av regionen, L2 er distrikter, og L3 er de lokale områdene du kan undersøke og sikre. Zoom for å se detaljene.' },
      { lead: 'Speiding', body: 'Et ukjent område må undersøkes før du kan stole på det som vises. Speiderrapporter gir kunnskap, ikke eierskap.' },
      { lead: 'Kontroll', body: 'Å rydde og ta et område er bare starten. Vakthold og forbindelser avgjør om du kan holde det over tid.' },
      { lead: 'Spesielle steder', body: 'Et POI er et navngitt sted i en sone, som en butikk eller en mulig HQ-bygning. Sjekk sonepanelet for kjente funn, funksjoner og handlinger.' },
    ],
  },
  {
    heading: 'Døgnet',
    description: 'Du gir ordre før verden beveger seg.',
    entries: [
      { lead: 'Dagsplan', body: 'Velg en eller flere personer, velg en lokal sone på kartet og legg til et oppdrag fra sonepanelet. Planen gjennomføres når du avslutter dagen. Du kan fjerne et oppdrag før døgnet begynner.' },
      { lead: 'Speid, rydd, søk eller overta', body: 'Speid gir fersk etterretning. Rydd bekjemper zombier. Søk henter ressurser og kan finne folk. Overta gir kontroll når sonen er nesten tom. Oppdragskortet viser krav, kostnader og forventning før du legger det til.' },
      { lead: 'Risiko', body: 'Nattangrep, utmattelse, lyd og uventede hendelser kan endre planen. Noen beslutninger må tas før døgnet kan fortsette.' },
      { lead: 'Rapporter', body: 'Dagsrapporten løfter frem det viktigste. Mindre hendelser og spor finner du i detaljene og krøniken.' },
    ],
  },
  {
    heading: 'Menneskene',
    description: 'Folk er mer enn et tall.',
    entries: [
      { lead: 'Crew', body: 'Helse, utmattelse, ferdigheter og våpen påvirker hvem du bør sende ut. Skadde eller utslitte folk kan koste mer enn de hjelper.' },
      { lead: 'Din person', body: 'Du velger en av de navngitte overlevende som hovedperson. Ved et kritisk nattangrep på HQ kan døgnet stoppe for et valg dersom hovedpersonen er til stede. Oppdrag kan koste helse og liv.' },
      { lead: 'Våpen', body: 'Hver person har et våpen som vises i personkortet. Skytevåpen bruker ammunisjon og lager støy; uten patroner blir kampen svakere. Kontroller oppdragskortets prognose før du sender laget.' },
    ],
  },
  {
    heading: 'Utstyr',
    description: 'En gjenstand kan bare være ett sted om gangen.',
    entries: [
      { lead: 'Tre kategorier', body: 'Våpen påvirker kamp, ammunisjon og støy. Beskyttelse demper fysisk skade, men stopper ikke bitt. Oppdragsverktøy hjelper konkrete aktiviteter, som søk, speiding, bygging eller behandling.' },
      { lead: 'Automatisk som utgangspunkt', body: 'Når du planlegger et oppdrag, foreslår Auto equip tilgjengelig utstyr som passer aktiviteten. Se tildelingen i dagsplanen. Åpne Utstyr på oppdraget for å endre den.' },
      { lead: 'Lås bare det du vil bestemme selv', body: 'Et manuelt valg låser den kategorien. De andre kategoriene kan fortsatt velges automatisk. Du kan også låse en kategori tom eller slå automatikken av. En låst gjenstand som ikke er tilgjengelig må avklares før oppdraget kan gå.' },
      { lead: 'Første plan får førstevalg', body: 'Utstyr reserveres i dagsplanens rekkefølge. Det kan ikke lånes til to lag samtidig. Fjern eller endre et oppdrag for å frigjøre reservasjonen.' },
      { lead: 'Folk og utstyr følger hverandre', body: 'Et feltlag kan ikke samtidig forsvare HQ. Utstyr hos noen som er borte er utilgjengelig for andre. Søksfunn og oppdragsverktøy blir tilgjengelige på lageret etter faktisk hjemkomst og levering.' },
      { lead: 'Leting er endelig', body: 'Nye personlige funn følger gjennomsøkingen av et område. Gjentatte søk i en tom sone skaper ikke flere gjenstander. Vurder om et nytt funn er verdt reisen og risikoen.' },
    ],
  },
  {
    heading: 'Reise og forsyning',
    description: 'En ordre er også en reise dit og en vei tilbake.',
    entries: [
      { lead: 'Der folk faktisk er', body: 'Et lag må være samlet før avreise. Reisen følger åpne forbindelser mellom lokale soner. Et langt oppdrag kan vare flere døgn, og laget er borte fra HQ mens det reiser eller arbeider.' },
      { lead: 'Bli i felt eller dra hjem', body: 'Du kan sende et lag til en sone, la det bli der, eller gi ordre om hjemreise. En stengt eller ødelagt forbindelse kan bryte ruten. Se oppdragsoversikten og velg en annen åpen rute eller et annet retursted når det trengs.' },
      { lead: 'Hent og forsyn', body: 'Et lokalt depot har sitt eget innhold. Forsyningsoppdrag henter varer der laget faktisk er og leverer på det valgte stedet. Henteoppdrag tar med lagret feltlast. Det krever bærere, ledig kapasitet og en åpen rute.' },
      { lead: 'Kunnskap er lettere enn last', body: 'Radio kan overføre en rapport. Den kan aldri gjøre mat, deler eller et utstyrsfunn tilgjengelig på HQ-lageret. Lasten må overleve reisen og bli levert.' },
      { lead: 'Vakt i et helt område', body: 'Områdebasert vakthold dekker et L2- eller L3-område. Det er en vedvarende oppgave, ikke en person som står på et tilfeldig punkt. Vaktlaget kan ikke samtidig være på et annet oppdrag eller forsvare sentralt HQ.' },
    ],
  },
  {
    heading: 'Samband og feltvalg',
    description: 'Feltlederen har et ansvar også når du ikke hører radioen.',
    entries: [
      { lead: 'Vanligvis avgjør laget', body: 'Bortelag følger oppdragets mandat. En forsiktig, balansert eller dristig instruks påvirker om feltlederen fortsetter når det blir farlig. Uten samband må de klare seg selv.' },
      { lead: 'Kontakt ved kritiske hendelser', body: 'Du kan be et lag kontakte deg ved alvorlige hendelser. Da må en fysisk radio med strøm følge laget, HQ må kunne svare, og forbindelsen må være innen rekkevidde. En avkrysning alene gir ikke samband.' },
      { lead: 'Din person er på stedet', body: 'Når hovedpersonen selv møter en kritisk situasjon, kan døgnet stoppe for et valg. Det gjelder også kritisk HQ-forsvar når personen faktisk er der. Avklar valget før samme døgn fortsetter.' },
      { lead: 'Skip og gjenopptakelse', body: 'Hopp over avslutter bare den visuelle døgnavspillingen. Det omgår aldri et uavklart valg. Du kan lukke spillet ved en lagret beslutning og komme tilbake til det samme pågående døgnet.' },
    ],
  },
  {
    heading: 'Oppdagelser og spor',
    description: 'Boka kjenner bare det noen har fortalt videre.',
    entries: [
      { lead: 'Flere veier til en ledetråd', body: 'Speiding, søk, et konkret rykte eller et feltlag med fungerende radio kan gi samme spor. Et rykte sier aldri at en sone er trygg. Fersk etterretning og vanlig risikovurdering gjelder fortsatt.' },
      { lead: 'Undersøk, velg og følg opp', body: 'Et kjent spor kan undersøkes med et eget dagsoppdrag. Når resultatet er rapportert, velger du hvordan laget skal følge det opp. Noen valg avslutter historien; andre gir et nytt arbeidssted eller neste undersøkelse. Les kostnader og arbeidstid før avreise.' },
      { lead: 'Levende avsendere', body: 'En privat feltobservasjon blir ikke kjent fordi du avslutter dagen. En levende avsender må rapportere etter hjemkomst eller sende gjennom faktisk samband. En død speider som aldri rapporterte, fyller ikke ut feltguiden.' },
      { lead: 'Historier kan gå tapt', body: 'Noen spor er knyttet til én person. Mister dere personen, kan den valgfrie historien bli liggende ufullført. Verken vanlig utforsking, nødvendige funksjoner eller faseprogresjon krever at alle sidehistorier fullføres.' },
      { lead: 'Steder og fortellinger', body: 'Navngitte steder kommer fra verdenskartet. Hendelsene, notatene og hemmelighetene i historiene er fiksjon. Vanlig søk, et lokalt POI og et unikt anlegg er forskjellige typer innhold.' },
      { lead: 'Unike anleggsoppdrag', body: 'Et nytt unikt sted går fra oppdaget til undersøkt og sikret, og deretter til operativt. Hvert trinn krever et faktisk crew-oppdrag på stedet. Først når grunnfunksjonen er klargjort, får samfunnet anleggseffektene. Videre utbygging følger etterpå. Allerede aktive anlegg i eldre lagringer beholder driften.' },
    ],
  },
  {
    heading: 'Spillmodus og tap',
    description: 'Velg hvor hardt krisen skal ramme når du starter.',
    entries: [
      { lead: 'Story', body: 'Mer rom for historien: større startforsyninger, mildere skade og forbruk, mer å finne og konkrete råd om vanskelige situasjoner.' },
      { lead: 'Survival og Realistic', body: 'Survival er standard med vanlige forsyninger og konsekvenser. Realistic gir knappere forsyninger og funn, mer forbruk, større skader og mer utmattelse. Ingen modus gjør et farlig oppdrag trygt.' },
      { lead: 'Hardcore er et eget valg', body: 'Hardcore kan kombineres med alle tre gradene. Dør hovedpersonen, er denne gjennomspillingen over. I vanlig spill kan en levende etterfølger velges, og samfunnet kan fortsette.' },
      { lead: 'Fortsettelse og tidligere valg', body: 'En lagret pågående beslutning kan gjenopptas. Hardcore bruker den nyeste registrerte gjennomspillingen og avviser vanlig tilbakespoling til eldre lagringer. Å lukke nettleseren er ikke en måte å gjøre et allerede lagret valg om igjen.' },
      { lead: 'En fremtid som følger av valgene', body: 'Samfunnets stabilitet, forskning, relasjoner og avgjørelser former avslutningen. Etterordet beskriver dem som overlevde og samfunnet dere bygde; det er ikke et siste valg mellom helt løsrevne slutter.' },
    ],
  },
  {
    heading: 'Regionalt ansvar',
    description: 'Senere må andre kunne holde sitt område uten at du står ved porten.',
    entries: [
      { lead: 'Fra fase 4', body: 'Et kontrollert lokalt område kan bli regionalt HQ for sin L1-region. Lederen må være en levende navngitt person som faktisk reiser dit. Regionene tilhører samme samfunn.' },
      { lead: 'Lokale folk og lagre', body: 'Folk og varer må transporteres til det regionale hovedkvarteret før de kan brukes der. En innbygger kan ikke samtidig arbeide og spise ved to HQ-er. Lokal matproduksjon og vakthold må ha faktisk dekning.' },
      { lead: 'Mandat og ønskede reserver', body: 'Forsvar, balanse og vekst fordeler lokale rutiner forskjellig. Et reservebudsjett sier hva området ønsker å holde på lager; det overfører ingen varer. Organiser forsyning der lageret ikke dekker behovet.' },
      { lead: 'Avvik fremfor hver arbeidsoppgave', body: 'Se etter lokale mangler og lederproblemer i den regionale oversikten. Store strategiske valg og bekreftelse av ledere ligger hos deg. Død eller fravær kan stanse rutinene til et nytt ansvar er avklart.' },
    ],
  },
  {
    heading: 'Leiren',
    description: 'Et trygt område må også kunne leve.',
    entries: [
      { lead: 'Forsyninger', body: 'Se på forbruk og produksjon, ikke bare hvor mye som ligger på lageret. Flere folk krever mer mat og vann.' },
      { lead: 'Forsvar og fase 2', body: 'Et HQ, et sammenhengende kjerneområde, varig forsvar og utholdenhet for mat og vann åpner neste fase. Hele hjemmets L2 er en større prestasjon, men er ikke obligatorisk. Se de faktiske fasekravene for hva som mangler hos dere.' },
      { lead: 'Forskning', body: 'Fra fase 2 kan dere starte tilgjengelige forskningsprosjekter med riktig HQ og ressurser. Fullførte resultater blir skrevet inn i feltguiden.' },
    ],
  },
];

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

export default function ZaBook({ state, world, onGoals, onDiscoveries }: {
  state: RegionState;
  world: RegionWorld;
  onGoals: () => void;
  onDiscoveries?: () => void;
}) {
  const [tab, setTab] = useState<BookTab>('chapters');
  const [chapter, setChapter] = useState(Math.min(5, Math.max(1, state.phase)));
  const [manualIndex, setManualIndex] = useState(0);
  const activeChapter = Math.min(chapter, state.phase);
  const current = PHASES[activeChapter - 1];
  const notes = CHAPTER_NOTES[activeChapter];
  const completed = current.goals.filter(g => goalMet(state, world, g.id)).length;
  const core = state.phase === 1 ? phaseOneReadiness(state, world) : null;
  const visibleMutations = state.mutations;
  const foundGear = [...new Map(knownGearItems(state).filter(item => item.provenance.kind === 'search').map(item => [item.kind, item])).values()];
  const research = TECHS.filter(t => state.research.done.includes(t.id));
  const currentResearch = TECHS.find(t => t.id === state.research.current);
  const observedPlaces = Object.keys(state.wonders ?? {}).length;
  const totalControlled = Object.values(state.zones).filter(z => z.status === 'controlled').length;
  const index = indexWorld(world);
  const homeName = index.byId.get(state.homeZoneId)?.name ?? 'ukjent område';
  const discoveries = visibleDiscoveries(state);

  return <div className="zab">
    <div className="zab-head">
      <p className="zab-eyebrow">FELTNOTATER · STAVANGER · DAG {state.day}</p>
      <h2>ZA-boka</h2>
      <p>Skrevet for dem som fortsatt lever. Finn råd for kapitlet deres, slå opp grunnreglene, eller les det dere har oppdaget.</p>
      <nav className="zab-tabs" aria-label="ZA-bokas deler">
        <button className={tab === 'chapters' ? 'active' : ''} aria-current={tab === 'chapters' ? 'page' : undefined} onClick={() => setTab('chapters')}>Kapitler</button>
        <button className={tab === 'manual' ? 'active' : ''} aria-current={tab === 'manual' ? 'page' : undefined} onClick={() => setTab('manual')}>Håndbok</button>
        <button className={tab === 'field' ? 'active' : ''} aria-current={tab === 'field' ? 'page' : undefined} onClick={() => setTab('field')}>Feltguide <span>{visibleMutations.length + research.length + foundGear.length + discoveries.length}</span></button>
      </nav>
    </div>

    {tab === 'chapters' && <div className="zab-chapters">
      <div className="zab-chapter-nav" aria-label="Velg kapittel">
        {PHASES.map(p => {
          const open = p.id <= state.phase;
          return <button type="button" key={p.id} className={(open ? 'zab-chapter-open' : 'zab-chapter-locked') + (activeChapter === p.id ? ' active' : '')}
            disabled={!open} aria-current={activeChapter === p.id ? 'page' : undefined} aria-label={open ? 'Kapittel ' + p.id + ': ' + p.name : 'Kapittel ' + p.id + ' låst'}
            onClick={() => setChapter(p.id)}>
            <span className="zab-chapter-number">{ROMAN[p.id - 1]}</span>
            <span><strong>{open ? p.name : 'Ikke skrevet ennå'}</strong><small>{open ? (p.id === state.phase ? 'Nåværende kapittel' : 'Tidligere kapittel') : 'Låses opp i fase ' + p.id}</small></span>
            <span aria-hidden="true">{open ? '›' : '◌'}</span>
          </button>;
        })}
      </div>

      <article className="zab-paper" key={activeChapter}>
        <p className="zab-eyebrow">KAPITTEL {ROMAN[activeChapter - 1]} / {PHASES.length}</p>
        <h3>{current.name}</h3>
        <blockquote>{notes.motto}</blockquote>
        <p className="zab-intro">{current.intro}</p>
        <div className="zab-handwriting">
          {notes.advice.map(note => <section key={note.lead}><h4>{note.lead}</h4><p>{note.body}</p></section>)}
        </div>
        <p className="zab-ending">{notes.closing}</p>
        {activeChapter === state.phase && <div className="zab-goal-note">
          <div><strong>Din verden akkurat nå</strong>
            <span>{totalControlled} lokale soner kontrollert · Leir: {homeName}</span>
            {core ? <span>{core.hasHQ ? `HQ-kjerne: ${core.connectedL3}/${core.requiredL3} sammenhengende soner` : 'Dere har ikke et operativt HQ ennå.'} · {core.defenceReady ? 'Varig forsvar på plass' : 'Varig forsvar gjenstår'} · {core.suppliesReady ? 'Mat og vann holder' : 'Forsyningskapasitet gjenstår'}</span>
              : <span>{completed} av {current.goals.length} milepæler oppfylt</span>}
          </div>
          <button type="button" onClick={onGoals}>Vis faktiske fasekrav</button>
        </div>}
      </article>
    </div>}

    {tab === 'manual' && <div className="zab-manual">
      <div className="zab-manual-nav">
        {MANUAL.map((section, i) => <button key={section.heading} type="button" aria-current={manualIndex === i ? 'page' : undefined} className={manualIndex === i ? 'active' : ''} onClick={() => setManualIndex(i)}>{section.heading}<span aria-hidden="true">›</span></button>)}
      </div>
      <article className="zab-paper">
        <p className="zab-eyebrow">OPPSLAGSVERK / ALLTID TILGJENGELIG</p>
        <h3>{MANUAL[manualIndex].heading}</h3>
        <p className="zab-intro">{MANUAL[manualIndex].description}</p>
        <div className="zab-handwriting">{MANUAL[manualIndex].entries.map(entry => <section key={entry.lead}><h4>{entry.lead}</h4><p>{entry.body}</p></section>)}</div>
      </article>
    </div>}

    {tab === 'field' && <div className="zab-field">
      <section className="zab-field-card">
        <p className="zab-eyebrow">RAPPORTERTE SPOR</p>
        <h3>Det noen har fortalt videre</h3>
        {!discoveries.length && <p className="zab-unknown">Ingen lokale historier er rapportert. Urapporterte feltobservasjoner og ukjente steder blir ikke vist her.</p>}
        {discoveries.map(entry => <div className="zab-discovery" key={entry.id}><span className="zab-discovery-mark">{entry.status === 'resolved' ? '✓' : entry.status === 'lost' ? '–' : '?'}</span>
          <div><strong>{entry.title}</strong><small>{entry.poiName} · {entry.status === 'resolved' ? 'Avsluttet' : entry.status === 'lost' ? 'Sporet er tapt' : 'Valgfritt spor'}</small><p>{entry.notes.at(-1)?.text}</p></div>
        </div>)}
        {onDiscoveries && <button type="button" className="zab-journal-link" onClick={onDiscoveries}>Åpne feltjournalen</button>}
      </section>
      <section className="zab-field-card">
        <p className="zab-eyebrow">OBSERVASJONER</p>
        <h3>Det vi vet om de døde</h3>
        {!visibleMutations.length && <p className="zab-unknown">Ingen uvanlig atferd rapportert ennå.</p>}
        {visibleMutations.map((m, i) => {
          const description = m.known ? MUTATIONS.find(x => x.id === m.id) : undefined;
          return <div className="zab-discovery" key={m.id + ':' + i}>
            <span className={'zab-discovery-mark ' + (m.known ? 'known' : 'unknown')}>{m.known ? '✓' : '?'}</span>
            <div><strong>{description?.name ?? 'Ukjent endring i atferd'}</strong><small>Først observert dag {m.day} · {m.known ? 'Undersøkt' : 'Ikke forstått'}</small>
              <p>{description?.text ?? 'Noe er annerledes med zombiene. Observasjonen er notert, men årsak og mottiltak er fortsatt ukjent.'}</p></div>
          </div>;
        })}
      </section>
      <section className="zab-field-card">
        <p className="zab-eyebrow">DOKUMENTERTE FUNN</p>
        <h3>Det vi har lært</h3>
        {research.length === 0 && <p className="zab-unknown">Ingen forskningsresultater nedskrevet ennå. En gruppe med kunnskap kan endre dette.</p>}
        {research.map(t => <div className="zab-discovery" key={t.id}><span className="zab-discovery-mark known">✓</span><div><strong>{t.name}</strong><p>{t.text}</p></div></div>)}
        {currentResearch && <p className="zab-in-progress">Pågående arbeid: {currentResearch.name}. Resultatene er ikke klare.</p>}
      </section>
      <section className="zab-field-card">
        <p className="zab-eyebrow">RAPPORTERTE UTSTYRSFUNN</p>
        <h3>Det vi kan ta i bruk</h3>
        {!foundGear.length && <p className="zab-unknown">Ingen nye utstyrstyper er rapportert hjem ennå.</p>}
        {foundGear.map(item => <div className="zab-discovery" key={item.kind}><span className="zab-discovery-mark known">✓</span><div><strong>{gearItemName(item)}</strong><p>{GEAR_CATALOG[item.kind]?.description}</p><small>Funnet under oppdrag dag {item.provenance.day}. Nåværende beholdning og bærer vises i Lager.</small></div></div>)}
      </section>
      <section className="zab-field-card">
        <p className="zab-eyebrow">FUNN OG HENDELSER</p>
        <h3>Det som har skjedd</h3>
        <p className="zab-unknown">{observedPlaces} spesielle steder registrert i leirens oversikt. Ikke alle steder er oppdaget, og boka viser ikke hemmeligheter dere ennå ikke kjenner.</p>
        {!state.memory.length && <p className="zab-unknown">Ingen større hendelser skrevet ned.</p>}
        {state.memory.slice(-8).reverse().map((entry, i) => <div className="zab-memory" key={entry.day + ':' + i}><small>Dag {entry.day}</small><p>{entry.text}</p></div>)}
      </section>
    </div>}

    <footer className="zab-foot">
      <span>Det finnes alltid mer å lære enn det som står her.</span>
      <span>FASE {state.phase} / {PHASES.length}</span>
    </footer>
  </div>;
}
