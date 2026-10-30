// Faste tekster i UI-en som er skrevet for Stavanger: slutten av fase 1.
import { AREA, LANDMARKS, SECTORS } from '../places';
import type { GameState } from '../../../engine/types';

/** Banneret på seiersskjermen */
export const winBanner = () => `noen har hengt opp et banner ${SECTORS.obs.realAt}: «${AREA.name.toUpperCase()}: 1 – APOKALYPSEN: 0»`;

/** Det som venter i fase 2, ut fra hva crewet har funnet */
export const phase2Teaser = (s: GameState) =>
  `Horden på verftet venter. ${s.flags.gann ? `Skoleskipet Gann ligger klart ved ${SECTORS.tommerodden.real}.` : 'Dere har ingen båt ennå.'} ${s.flags.buss ? `Kolumbus-bussen ${SECTORS.sorspissen.realAt} har full tank.` : 'Dere har ikke funnet transport ennå.'}`;

/** Overgangen til fase 2: verftet åpnes */
export const phase2Intro = () =>
  `Gjerdet ${SECTORS.rosenberg.at} har holdt horden inne hele fase 1. Nå skal dere inn. Verftet har kraner, stål, senger og en kantine, og hele morgenskiftet står fortsatt i porten. ${AREA.name} må holdes samtidig, men det dere har tatt, holder seg en stund.`;

/** Slutten av betaen: fase 2 er vunnet */
export const finaleText = (s: GameState) =>
  `${SECTORS.rosenberg.name} er deres. Kranene står stille, kaffemaskinen i kantina går igjen, og noen har allerede satt opp en vaktliste på oppslagstavla. Fase 2 tok ${s.day - s.phaseStartDay} ${s.day - s.phaseStartDay === 1 ? 'dag' : 'dager'}. ${LANDMARKS.sandnes} har ikke kommentert saken.`;
