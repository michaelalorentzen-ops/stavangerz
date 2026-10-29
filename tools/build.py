"""Setter sammen src/ til ferdige filer i dist/."""
from pathlib import Path
root = Path(__file__).resolve().parent.parent
src = root / 'src'
html = (src / 'template.html').read_text()
for key, f in [('/*__MAP__*/null', 'map.json'), ('/*__ENGINE__*/', 'engine.js'), ('/*__EVENTS__*/', 'events.js'), ('/*__UI__*/', 'ui.js')]:
    html = html.replace(key, (src / f).read_text())
dist = root / 'dist'
dist.mkdir(exist_ok=True)
# artifact.html: uten <html>/<head>, for publisering som Claude-artifact.
(dist / 'artifact.html').write_text(html)

# Frittstående versjon som kan åpnes direkte i nettleseren.
(dist / 'index.html').write_text('<!doctype html>\n<html lang="nb"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<style>html,body{margin:0}[hidden]{display:none!important}</style></head><body>\n' + html + '\n</body></html>\n')
print('dist/index.html', (dist / 'index.html').stat().st_size // 1024, 'KB')
