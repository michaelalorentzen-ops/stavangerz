import type { ReactNode } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';

export const metadata = { title: 'Stavanger Z · Etter dag null', description: 'Fire overlevende. Ett døgn av gangen. Overlev og bygg et samfunn i Stavanger-regionen.' };
export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="nb"><body>{children}</body></html>;
}
