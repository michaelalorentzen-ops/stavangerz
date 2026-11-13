"""Original StavangerZ low-poly meshes. Blender 4.3+: blender -b -t 2 --python this.py"""
import bpy, math, json, struct, sys
from pathlib import Path
from mathutils import Vector
OUT=Path(__file__).resolve().parents[2]/'apps/game-client/public/models/stavangerz'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
M={}
def mat(n,c):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*c,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.86;M[n]=m
for n,c in {'navy':(.085,.14,.19),'teal':(.12,.27,.28),'olive':(.24,.28,.17),'earth':(.30,.22,.15),'rust':(.49,.20,.09),'wood':(.37,.25,.14),'woodlight':(.57,.42,.26),'cream':(.72,.69,.55),'skin':(.62,.41,.27),'skinwarm':(.46,.29,.18),'hair':(.13,.10,.07),'blond':(.38,.26,.12),'grey':(.31,.32,.29),'black':(.055,.067,.063),'metal':(.28,.35,.34),'glass':(.20,.39,.43),'red':(.52,.14,.10),'zskin':(.42,.47,.32),'white':(.84,.81,.67)}.items():mat(n,c)
ROOT=None

def finish(o,n,m,parent=None):
 o.name=n;o.data.materials.append(M[m]);o.parent=parent or ROOT;return o

def cube(n,p,s,m,parent=None,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.scale=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  mod=o.modifiers.new('soft cut edges','BEVEL');mod.width=bevel;mod.segments=1;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 return finish(o,n,m,parent)
def uv(n,p,s,m,parent=None):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=10,ring_count=6,location=p);o=bpy.context.object;o.scale=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,n,m,parent)
def cyl(n,p,r,d,m,parent=None,vertices=10):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=d,location=p);return finish(bpy.context.object,n,m,parent)
def mesh(n,verts,faces,m):
 me=bpy.data.meshes.new(n);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(n,me);bpy.context.collection.objects.link(o);return finish(o,n,m)
def bar(n,a,b,r,m,parent=None):
 a,b=Vector(a),Vector(b);o=cyl(n,(a+b)/2,r,(b-a).length,m,parent,8);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
def empty(n,p=(0,0,0),parent=None):
 o=bpy.data.objects.new(n,None);bpy.context.collection.objects.link(o);o.location=p;o.parent=parent;return o
def localize(o,p):
 # positions were authored relative to root; keep shape when attaching to a pivot
 world=o.location.copy();o.parent=p;o.location=world-p.location

def character(name,coat,skin,hair,collar,height=1.78,zombie=False):
 global ROOT
 ROOT=empty(name)
 body=empty('breathing',(0,0,0),ROOT)
 torso=uv('weatherproof jacket',(0,0,1.18),(.29,.17,.36),coat,body)
 cube('jacket hem',(0,0,.94),(.49,.30,.17),coat,body,.035)
 cube('zip',(0,-.171,1.23),(.021,.012,.48),'metal',body)
 for x in [-.14,.14]:
  cube('storm pocket',(x,-.166,1.05),(.115,.045,.12),coat,body,.014)
  cube('pocket flap',(x,-.195,1.10),(.125,.018,.025),'metal',body)
 cyl('ribbed collar',(0,0,1.49),.135,.16,collar,body)
 uv('hood folded behind neck',(0,.12,1.45),(.21,.14,.12),coat,body)
 uv('face',(0,-.009,1.65),(.147,.133,.19),skin,body)
 uv('nose',(0,-.145,1.65),(.034,.049,.045),skin,body)
 for x in [-.065,.065]:
  uv('eye',(x,-.13,1.69),(.025,.009,.014),'black',body)
  uv('ear',(x*2.25,0,1.65),(.025,.035,.055),skin,body)
 uv('hair crown',(0,.008,1.79),(.15,.134,.075),hair,body)
 if name=='crew-leila':
  for x,y,z in [(-.13,.04,1.73),(.13,.04,1.73),(-.12,.08,1.61),(.12,.08,1.61),(0,.13,1.64),(-.1,.10,1.79),(.1,.1,1.79)]:uv('curly hair',(x,y,z),(.075,.071,.08),hair,body)
 elif name=='crew-ingrid':
  uv('tied ponytail',(0,.16,1.71),(.095,.12,.09),hair,body)
  bar('side fringe',(-.13,-.10,1.77),(.07,-.12,1.82),.035,hair,body)
 else:
  uv('short beard',(0,-.058,1.55),(.112,.092,.055),hair,body)
  if name=='crew-tor':cube('moustache',(0,-.143,1.60),(.12,.025,.025),hair,body,.009)
  else:
   for x in [-.08,.01,.08]:uv('windswept hair',(x,-.015,1.83),(.055,.11,.045),hair,body)
 # broad canvas backpack, webbing and buckle
 cube('rucksack',(0,.205,1.22),(.36,.20,.39),'earth',body,.055)
 for x in [-.20,.20]:
  bar('canvas shoulder strap',(x,-.15,1.43),(x,-.19,1.04),.027,'earth',body)
  cube('brass buckle',(x,-.208,1.20),(.055,.014,.06),'woodlight',body)
 arms=[];legs=[]
 for x in [-.34,.34]:
  a=empty('left shoulder' if x<0 else 'right shoulder',(x,0,1.40),ROOT);arms.append(a)
  o=uv('sleeve',(x,0,1.18),(.095,.105,.26),coat);localize(o,a)
  o=cube('cuff',(x,-.012,.98),(.14,.17,.09),collar,bevel=.02);localize(o,a)
  o=uv('hand',(x,-.016,.90),(.068,.071,.09),skin);localize(o,a)
 for x in [-.135,.135]:
  a=empty('left hip' if x<0 else 'right hip',(x,0,.93),ROOT);legs.append(a)
  o=cube('trouser leg',(x,0,.58),(.20,.22,.65),'navy' if not zombie else 'earth',bevel=.035);localize(o,a)
  o=cube('knee patch',(x,-.12,.48),(.15,.025,.16),'black',bevel=.02);localize(o,a)
  o=cube('leather boot',(x,-.05,.12),(.22,.36,.24),'black',bevel=.04);localize(o,a)
  o=cube('boot sole',(x,-.05,.028),(.23,.37,.056),'metal',bevel=.012);localize(o,a)
 if zombie:
  cube('torn hi-vis vest',(0,-.15,1.28),(.43,.045,.28),'rust',body,.03)
  for x in [-.14,.14]:cube('vest reflector',(x,-.18,1.28),(.035,.016,.24),'cream',body)
 for clip,end in [('Idle',48),('Walk',24),('Guard',48)]:
  for obj in [body]+arms+legs:
   obj.animation_data_create();action=bpy.data.actions.new(clip+'_'+obj.name);obj.animation_data.action=action
   for frame in [1,end//4+1,end//2+1,3*end//4+1,end+1]:
    phase=(frame-1)/end*math.tau;obj.rotation_euler=(0,0,0)
    if obj==body:obj.location.z=(.012 if clip=='Idle' else .018)*(1-math.cos(phase* (2 if clip=='Walk' else 1)))
    elif obj in legs and clip=='Walk':obj.rotation_euler.x=math.sin(phase)*.48*(1 if obj==legs[0] else -1)
    elif obj in arms:
     obj.rotation_euler.x=math.sin(phase)*.42*(1 if obj==arms[1] else -1) if clip=='Walk' else (-.65 if clip=='Guard' else -.06)+math.sin(phase)*.035
     if zombie:obj.rotation_euler.x-=.75
    obj.keyframe_insert(data_path='rotation_euler',frame=frame)
    if obj==body:obj.keyframe_insert(data_path='location',frame=frame)
   for fc in action.fcurves:
    for k in fc.keyframe_points:k.interpolation='LINEAR' if clip=='Walk' else 'BEZIER'
   track=obj.animation_data.nla_tracks.new();track.name=clip;track.strips.new(clip,1,action);obj.animation_data.action=None
 ROOT.scale=(height/1.86,)*3
 return ROOT

def crates():
 for x,y,z in [(-.50,0,.36),(.40,.05,.30),(-.40,0,.98)]:
  cube('supply crate',(x,y,z),(.78,.63,.60),'olive',bevel=.035)
  for xx in [-.29,.29]:cube('crate steel band',(x+xx,y-.325,z),(.045,.02,.58),'metal')
  cube('crate lid',(x,y,z+.31),(.82,.66,.045),'woodlight')
  cube('handle',(x,y-.341,z+.05),(.18,.025,.04),'black')
  cube('inventory tag',(x,y-.34,z-.10),(.14,.018,.09),'cream')
def barricade():
 for x in [-1.65,0,1.65]:
  bar('trestle leg',(x,-.64,0),(x,.18,1.25),.085,'wood');bar('trestle leg',(x,.64,0),(x,-.18,1.25),.085,'wood')
 for z in [.40,.83,1.23]:
  cube('reclaimed timber',(0,-.13,z),(4.0,.14,.18),'woodlight',bevel=.018)
 for x in [-1.6,-.8,0,.8,1.6]:
  o=cube('warning painted slat',(x,-.215,.83),(.30,.012,.16),'rust');o.rotation_euler.y=.15
 cube('watch post sandbag',(-1.25,.6,.18),(1.0,.45,.32),'olive',bevel=.12)
 bar('lamp post',(1.55,.45,0),(1.55,.45,2.3),.05,'metal');cube('lantern',(1.55,.45,2.15),(.20,.20,.28),'cream',bevel=.025)
def boat():
 # pointed clinker hull, open interior and raised gunwale; bow toward -Y
 rings=[(-2.6,.0,.65),(-1.80,.86,.52),(1.65,.91,.48),(2.30,.65,.50)]
 verts=[]
 for y,w,z in rings:verts.extend([(-w,y,z),(w,y,z),(-w*.65,y,.12),(w*.65,y,.12)])
 faces=[]
 for i in range(3):
  a=i*4;b=(i+1)*4
  faces.extend([(a,b,b+2,a+2),(a+1,a+3,b+3,b+1),(a+2,b+2,b+3,a+3)])
 faces.extend([(12,14,15,13),(0,2,3,1)])
 mesh('painted fishing hull',verts,faces,'teal')
 for side in [-1,1]:
  for i in range(3):
   y,w,z=rings[i];yy,ww,zz=rings[i+1];bar('oak gunwale',(side*w,y,z),(side*ww,yy,zz),.065,'woodlight')
 cube('deck',(0,.2,.23),(1.3,3.0,.15),'wood')
 for y in [-1.15,.35,1.42]:cube('cross bench',(0,y,.56),(1.50,.30,.12),'woodlight',bevel=.03)
 cube('outboard motor',(0,2.42,.67),(.40,.38,.52),'navy',bevel=.07)
 bar('motor shaft',(0,2.4,.45),(0,2.4,.02),.07,'metal')
 cube('fuel can',(.48,.90,.41),(.30,.36,.34),'rust',bevel=.035)
 for x in [-.48,.48]:
  bar('oar',(x,-.8,.76),(x,1.3,.76),.035,'woodlight');cube('oar blade',(x,1.5,.76),(.14,.55,.045),'woodlight',bevel=.025)
 cyl('mooring coil',(-.3,-1.6,.39),.19,.07,'cream',vertices=12)
def hq():
 cube('foundation',(0,0,.12),(6.2,4.9,.24),'grey',bevel=.08)
 cube('painted timber walls',(0,0,1.35),(5.8,4.4,2.5),'red',bevel=.025)
 for x in [-2.91,2.91]:
  for y in [-2.20,2.20]:cube('white corner trim',(x,y,1.4),(.16,.16,2.6),'cream')
 # roof gable and two sloping roof planes
 mesh('gable',[(-2.9,-2.2,2.6),(2.9,-2.2,2.6),(0,-2.2,3.7),(-2.9,2.2,2.6),(2.9,2.2,2.6),(0,2.2,3.7)],[(0,1,2),(3,5,4)],'red')
 for side in [-1,1]:
  mesh('standing seam roof',[(0,-2.55,3.75),(side*3.25,-2.55,2.52),(side*3.25,2.55,2.52),(0,2.55,3.75)],[(0,1,2,3)],'navy')
  for y in [-2.35,-1.55,-.75,.05,.85,1.65,2.45]:bar('roof seam',(0,y,3.78),(side*3.25,y,2.55),.025,'metal')
 cube('HQ door',(.10,-2.23,1.15),(1.05,.10,2.10),'navy',bevel=.025)
 cube('door trim',(.10,-2.30,2.25),(1.25,.10,.15),'cream')
 cube('door handle',(.43,-2.30,1.10),(.06,.07,.14),'woodlight')
 for x in [-1.8,1.8]:
  cube('window frame',(x,-2.25,1.66),(1.13,.12,1.12),'cream',bevel=.02)
  cube('window glass',(x,-2.32,1.66),(.93,.04,.94),'glass')
  cube('window mullion',(x,-2.36,1.66),(.055,.03,.94),'cream');cube('window mullion',(x,-2.36,1.66),(.93,.03,.055),'cream')
 cube('entrance step',(.1,-2.7,.17),(1.5,.65,.20),'woodlight',bevel=.02)
 cube('HQ sign',(.10,-2.3,2.55),(.90,.13,.26),'woodlight',bevel=.02)
 # raised radio mast, signal pennant and working stove
 bar('radio mast',(2,1.4,2.9),(2,1.4,5.2),.05,'metal')
 for z in [4.6,5.05]:bar('antenna',(1.45,1.4,z),(2.55,1.4,z),.025,'metal')
 mesh('signal flag',[(2,1.4,4.5),(2.9,1.4,4.4),(2.8,1.4,4.0),(2,1.4,4.1)],[(0,1,2,3)],'rust')
 cyl('stove chimney',(-1.4,.8,3.6),.13,1.35,'black');cube('chimney cap',(-1.4,.8,4.3),(.45,.43,.08),'metal')
 for y in [0,.75]:
  cyl('rain barrel',(3.3,y,.55),.40,1.05,'teal',vertices=12)
  for z in [.15,.88]:cyl('barrel band',(3.3,y,z),.415,.045,'metal',vertices=12)
 cube('wood store',(-3.35,.8,.65),(.65,1.8,1.3),'earth')
 for z in [.25,.55,.85,1.15]:
  for y in [.15,.55,.95,1.35]:bar('split firewood',(-3.65,y,z),(-3.05,y,z),.12,'woodlight')

ASSETS={}; roots=[]
def export(id,builder):
 global ROOT
 ROOT=empty(id);builder();root=ROOT
 bpy.context.scene.frame_set(1)
 bpy.context.view_layer.update()
 lowest=min((obj.matrix_world@Vector(c)).z for obj in root.children_recursive if obj.type=='MESH' for c in obj.bound_box)
 # A ground wrapper preserves animated local channels while placing the lowest
 # geometry at zero, including slanted trestle feet and the boat's motor skeg.
 root.name=id+'-model';ground=empty(id);root.parent=ground;root.location.z-=lowest
 ROOT=root=ground
 bpy.context.view_layer.update()
 # Collapse static pieces by articulation pivot and material: low draw-call meshes,
 # while shoulders/hips retain their independent animation transforms.
 groups={}
 for obj in list(root.children_recursive):
  if obj.type=='MESH':groups.setdefault((obj.parent,obj.data.materials[0].name),[]).append(obj)
 for pieces in groups.values():
  if len(pieces)>1:
   bpy.ops.object.select_all(action='DESELECT')
   for piece in pieces:piece.select_set(True)
   bpy.context.view_layer.objects.active=pieces[0];bpy.ops.object.join()
 objs=[root]+list(root.children_recursive)
 bpy.ops.object.select_all(action='DESELECT')
 for o in objs:o.select_set(True)
 bpy.context.view_layer.objects.active=root
 bpy.ops.export_scene.gltf(filepath=str(OUT/(id+'.glb')),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_anim_slide_to_zero=True,export_yup=True)
 points=[o.matrix_world@Vector(c) for o in objs if o.type=='MESH' for c in o.bound_box]
 dims=[max(p[i] for p in points)-min(p[i] for p in points) for i in range(3)]
 tris=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objs if o.type=='MESH')
 # Inspect actual exported JSON rather than promising animation names.
 raw=(OUT/(id+'.glb')).read_bytes();size=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+size]);clips=[a['name'] for a in g.get('animations',[])]
 ASSETS[id]={'url':'/models/stavangerz/'+id+'.glb','scale':1,'meters':dict(zip(['width','depth','height'],[round(v,3) for v in dims])),'animations':clips,'triangles':tris,'meshes':len(g.get('meshes',[])),'materials':len(g.get('materials',[])),'bytes':len(raw),'facing':'+Z','pivot':'ground-center','provenance':'Original procedural Blender mesh; StavangerZ crew portrait color/identity reference' if id.startswith('crew-') else 'Original procedural Blender mesh; no external geometry or textures'}
 roots.append(root)

def charbuilder(*a,**kw):
 global ROOT
 old=ROOT;new=character(*a,**kw)
 # remove placeholder and retain authored character root
 bpy.data.objects.remove(old,do_unlink=True);new.name=a[0];ROOT=new
for id,args in [('crew-ingrid',('olive','skin','hair','black',1.75)),('crew-marius',('earth','skin','blond','rust',1.83)),('crew-leila',('teal','skinwarm','hair','cream',1.71)),('crew-tor',('navy','skin','grey','rust',1.85)),('zombie',('grey','zskin','hair','black',1.76))]:
 export(id,lambda id=id,args=args:charbuilder(id,*args,zombie=id=='zombie'))
for id,fn in [('hq',hq),('barricade',barricade),('boat',boat),('supply-crates',crates)]:export(id,fn)
manifest={'version':1,'generator':'region/tools/blender/build_world_assets.py','units':'meters','up':'Y','blenderUp':'Z','fps':24,'loopClips':{'Idle':2,'Walk':1,'Guard':2},'assets':ASSETS}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
if '--skip-render' in sys.argv:
 print('Exported',len(ASSETS),'GLBs and manifest');sys.exit(0)
# Curated studio contact sheet, rendered by Blender; no image compositing.
for root in roots:
 for o in root.children_recursive:
  if o.animation_data:
   for track in o.animation_data.nla_tracks:track.mute=track.name!='Idle'
positions=[(-4,-3,0),(-2,-3,0),(0,-3,0),(2,-3,0),(4,-3,0),(-4,4,0),(4,3.5,0),(3.5,8,0),(5,.0,0)]
for r,p in zip(roots,positions):r.location=p
ROOT=None
cube('display floor',(0,3,-.18),(21,22,.30),'black',bevel=.10)
for r in roots:
 depth=ASSETS[r.name]['meters']['depth']
 bpy.ops.object.text_add(location=(r.location.x,r.location.y-max(1.05,depth/2+.45),.02));t=bpy.context.object;t.name='caption';t.data.body=r.name.replace('crew-','').upper();t.data.size=.25;t.data.align_x='CENTER';t.data.extrude=.001;t.data.materials.append(M['cream'])
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=False
scene.world.color=(.25,.25,.25)
for n,p,power,size in [('key',(-7,-9,15),2800,8),('fill',(8,1,12),1900,7),('rim',(-2,12,14),2600,7)]:
 bpy.ops.object.light_add(type='AREA',location=p);o=bpy.context.object;o.name=n;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,3,0))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(14,-23,24));cam=bpy.context.object;cam.rotation_euler=(Vector((0,3,0.9))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=21;scene.camera=cam
scene.render.resolution_x=1600;scene.render.resolution_y=1400;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.filepath=str(OUT/'contact-sheet.png');scene.render.image_settings.file_format='PNG';bpy.ops.render.render(write_still=True)
# Character detail view confirms clothing, face, silhouette and readable palette.
for r in roots[5:]:
 for o in [r]+list(r.children_recursive):o.hide_render=True
cam.location=(5,-13,6);cam.rotation_euler=(Vector((0,-3,1))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=11
scene.render.resolution_x=1600;scene.render.resolution_y=640;scene.render.filepath=str(OUT/'crew-preview.png');bpy.ops.render.render(write_still=True)
print('ASSET_MANIFEST',json.dumps(ASSETS))
