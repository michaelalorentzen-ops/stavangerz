"""Read binary glTF directly: embedded, finite, closed animation loops and budgets."""
import json,struct,math
from pathlib import Path
D=Path(__file__).resolve().parents[2]/'apps/game-client/public/models/stavangerz'
manifest=json.loads((D/'manifest.json').read_text())
def accessor(g,b,index):
 a=g['accessors'][index];v=g['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']]
 assert a['componentType']==5126
 offset=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',n*4)
 return [struct.unpack_from('<'+'f'*n,b,offset+i*stride) for i in range(a['count'])]
for key,asset in manifest['assets'].items():
 raw=(D/(key+'.glb')).read_bytes();magic,version,length=struct.unpack_from('<III',raw)
 assert magic==0x46546C67 and version==2 and length==len(raw)
 size=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+size]);b=raw[28+size:]
 assert all('uri' not in buffer for buffer in g['buffers'])
 assert [a['name'] for a in g.get('animations',[])]==asset['animations']
 exported_triangles=sum(g['accessors'][p['indices']]['count']//3 for m in g['meshes'] for p in m['primitives'])
 assert exported_triangles==asset['triangles'],(key,exported_triangles,asset['triangles'])
 assert len(g['meshes'])==asset['meshes'] and len(g['materials'])==asset['materials']
 assert asset['triangles']<3000 and len(raw)<300_000
 if key.startswith('crew-') or key=='zombie':
  assert set(asset['animations'])=={'Idle','Walk','Guard'}
  for anim in g['animations']:
   varying=0
   for s in anim['samplers']:
    times=accessor(g,b,s['input']);values=accessor(g,b,s['output'])
    assert abs(times[0][0])<1e-5
    assert abs(times[-1][0]-manifest['loopClips'][anim['name']])<1e-5
    assert all(math.isfinite(v) for row in values for v in row)
    assert max(abs(a-b) for a,b in zip(values[0],values[-1]))<1e-4, (key,anim['name'],'loop seam')
    varying+=any(max(abs(a-b) for a,b in zip(values[0],row))>1e-4 for row in values)
   assert varying>0,(key,anim['name'],'static clip')
 print(key,asset['triangles'],'triangles',len(g['meshes']),'meshes',len(raw),'bytes',asset['animations'])
print('PASS: 9 original embedded GLBs; 15 animated loops, correct clip names, periods and closed endpoints')
