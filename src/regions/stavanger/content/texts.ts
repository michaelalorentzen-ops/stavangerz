// Faste tekster i UI-en som er skrevet for Stavanger: slutten av fase 1.
import { AREA, SECTORS } from '../places';
import type { GameState } from '../../../engine/types';

/** Banneret på seiersskjermen */
export const winBanner = () => `noen har hengt opp et banner ${SECTORS.obs.realAt}: «${AREA.name.toUpperCase()}: 1 – APOKALYPSEN: 0»`;

/** Det som venter i fase 2, ut fra hva crewet har funnet */
export const phase2Teaser = (s: GameState) =>
  `Horden på verftet venter. ${s.flags.gann ? `Skoleskipet Gann ligger klart ved ${SECTORS.tommerodden.real}.` : 'Dere har ingen båt ennå.'} ${s.flags.buss ? `Kolumbus-bussen ${SECTORS.sorspissen.realAt} har full tank.` : 'Dere har ikke funnet transport ennå.'}`;
