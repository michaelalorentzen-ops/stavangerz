import { createRoot } from 'react-dom/client';
import WorldEditor from './app/world-editor';
import review from '../../dist/stavanger-z-41-soner-veigrenser-utkast.json';
import type { WorldDefinition } from '../../packages/world-data/src/model';
import type { MapLibrary } from '../../packages/world-data/src/editor-osm';

// A separate file and storage namespace keep the owner's existing draft intact.
const bootstrap = review as unknown as {world:WorldDefinition;locked:string[];mapLibrary:MapLibrary};
createRoot(document.getElementById('root')!).render(
  <WorldEditor bootstrap={bootstrap} storageScope="road-review-2026-11-06" />,
);
