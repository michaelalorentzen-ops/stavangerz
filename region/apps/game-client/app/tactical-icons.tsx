export type IconName = 'food' | 'water' | 'medicine' | 'materials' | 'ammo' | 'scout' | 'clear' | 'claim' | 'secure' | 'scavenge' | 'repair' | 'establishBase' | 'person' | 'clock' | 'pin' | 'residential' | 'industrial' | 'school' | 'sports' | 'transport' | 'power' | 'area';
const paths: Record<IconName, string> = {
  residential:'m2 11 6-6 6 6M4 9v11h8V9M13 6l4-4 5 5m-7 2v11h5V7M7 20v-5h3v5',
  industrial:'M3 21V10l6 4V8l6 5V3h4v12h2v6ZM6 17h1m4 0h1m4 0h1',
  school:'m2 7 10-5 10 5-10 5Zm4 3v7l6 4 6-4v-7m4-3v9',
  sports:'M3 5h18v14H3Zm9 0v14m0-10a3 3 0 1 0 0 6 3 3 0 0 0 0-6M3 9h3v6H3m18-6h-3v6h3',
  transport:'M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4',
  power:'m13 2-9 12h7l-1 8 10-13h-7Z',
  area:'m12 2 10 10-10 10L2 12Zm-4 10h8m-4-4v8',
  food:'M5 3v7m3-7v7m3-7v7M5 8h6v4H8v9M18 3c-3 4-3 8 0 9h2V3Zm2 9v9',
  water:'M12 2C10 6 5 11 5 15a7 7 0 0 0 14 0c0-4-5-9-7-13ZM8 15c0 2 1 3 3 4',
  medicine:'M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z',
  materials:'m12 2 3 4 5-1 2 5-4 3 1 5-5 2-3-4-5 1-2-5 4-3-1-5Zm0 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  ammo:'M4 8 6 3l2 5v13H4Zm7 0 2-5 2 5v13h-4Zm7 0 2-5 2 5v13h-4M4 16h4m3 0h4m3 0h4',
  scout:'M3 9 5 4h4l1 5m4 0 1-5h4l2 5M2 9h8v11H2Zm12 0h8v11h-8Zm-4 3h4',
  clear:'m4 20 5-5m5-5 6-6M6 3l15 15-3 3L3 6Zm8 12 3-3',
  claim:'M5 22V3m0 0h14l-3 5 3 5H5',
  secure:'m12 2 9 4v6c0 5-5 8-9 10-4-2-9-5-9-10V6Zm-5 9 4 4 6-7',
  scavenge:'M2 3h3l3 12h11l3-9H6M8 19h1m9 0h1',
  repair:'m14 4 2 4 4 2a7 7 0 0 1-8 8l-6 5-4-4 6-6a7 7 0 0 1 6-9Z',
  establishBase:'m2 11 10-9 10 9M5 9v13h14V9M10 22v-8h4v8',
  person:'M8 6a4 4 0 1 0 8 0 4 4 0 0 0-8 0M3 22v-4a9 9 0 0 1 18 0v4Z',
  clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 3v7l4 2',
  pin:'M12 22S4 14 4 9a8 8 0 0 1 16 0c0 5-8 13-8 13Zm0-16a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
};
export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return <svg className={`sz-icon ${className}`} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}
