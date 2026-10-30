// Regionen spillet bruker: steder, id-er og folk. Ingen kjøretidsavhengigheter til motoren, så motoren
// kan lese dem når som helst. En ny by lages som en ny mappe ved siden av stavanger/ og byttes inn her
// og i content.ts.
export type * from './stavanger/ids';
export * from './stavanger/places';
export * from './stavanger/people';
