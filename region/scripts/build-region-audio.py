#!/usr/bin/env python3
"""Offline project audio assembly; no network. Requires Python numpy/scipy + ffmpeg.

Source Foley: selected Kenney CC0 OGGs in public/audio/source. Atmospheres are
original offline procedural composites, not field recordings. --check needs only
Python's stdlib, and verifies committed originals + rendered outputs.
"""
from pathlib import Path
import argparse, hashlib, json, subprocess, sys
ROOT = Path(__file__).resolve().parents[1] / 'apps/game-client/public/audio'
SOURCES = json.loads((ROOT / 'source-manifest.json').read_text())['sources']
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def check():
    for pack in json.loads((ROOT / 'source-manifest.json').read_text())['packs']:
        license_file = ROOT / pack['license_file']
        assert digest(license_file) == pack['license_sha256'] and 'CC0' in license_file.read_text(), pack['id']
    for row in SOURCES:
        assert row['license'] == 'CC0-1.0' and row['source'].startswith('https://kenney.nl/assets/')
        assert digest(ROOT / row['file']) == row['sha256'], row['file']
    outputs = json.loads((ROOT / 'manifest.json').read_text())['assets']
    for row in outputs:
        assert digest(ROOT / row['file']) == row['sha256'], row['file']
        assert row['duration'] > 0 and row['peak'] < .95 and row['rms'] > .001
    assert {'ambient-camp','ambient-harbor','ambient-night','victory','defeat','combat','claim','discovery','order','confirm','event','day','night'} == {row['id'] for row in outputs}
    print(f'PASS audio provenance: {len(SOURCES)} CC0 originals, {len(outputs)} local rendered assets; sha256, levels, durations and cue coverage.')
if '--check' in sys.argv: check(); sys.exit(0)
import numpy as np
from scipy.signal import butter, sosfilt
SR = 44100
rng = np.random.default_rng(3204)
def empty(seconds): return np.zeros((int(seconds * SR), 2), dtype=np.float64)
def load(group, name):
    raw = subprocess.check_output(['ffmpeg','-v','error','-i',str(ROOT/'source'/('kenney-'+group)/(name+'.ogg')),'-f','f32le','-ac','2','-ar',str(SR),'-'])
    return np.frombuffer(raw,dtype='<f4').reshape(-1,2).astype(np.float64)
def filtered(x, frequency, kind='lowpass'): return sosfilt(butter(2, frequency, btype=kind, fs=SR, output='sos'),x,axis=0)
def pitch(x, ratio):
    positions = np.arange(0,len(x),ratio);return np.stack([np.interp(positions,np.arange(len(x)),x[:,channel]) for channel in range(2)],axis=1)
def mix(target, sample, at, gain=1, pan=0):
    start=int(at*SR); n=min(len(sample),len(target)-start)
    if n>0: target[start:start+n] += sample[:n] * gain * np.array([1-min(.8,max(0,pan)),1+max(-.8,min(0,pan))])
    return target
def fade(x, seconds=.04):
    n=min(int(seconds*SR),len(x)//2);x=x.copy()
    if n: x[:n]*=np.linspace(0,1,n)[:,None];x[-n:]*=np.linspace(1,0,n)[:,None]
    return x
def room(x, amount=.15):
    result=x.copy()
    for delay,gain in [(.083,amount),(.151,amount*.6),(.277,amount*.3)]: mix(result,x,delay,gain)
    return result
def texture(seconds, low=180, high=1800):
    x=rng.normal(0,1,(int(seconds*SR),2));x=filtered(filtered(x,high),low,'highpass');return x/(np.std(x)+1e-9)
def normalize(x, peak=.65): return x/(np.max(np.abs(x))+1e-9)*peak
outputs=[]
def write(name,x,description,ingredients):
    x=normalize(fade(x,.02),.36 if name.startswith('ambient') else .68)
    pcm=np.clip(x*32767,-32768,32767).astype('<i2').tobytes();path=ROOT/(name+'.mp3')
    subprocess.run(['ffmpeg','-y','-v','error','-f','s16le','-ar',str(SR),'-ac','2','-i','-','-codec:a','libmp3lame','-b:a','96k','-map_metadata','-1',str(path)],input=pcm,check=True)
    outputs.append({'id':name,'file':path.name,'sha256':digest(path),'duration':round(len(x)/SR,3),'peak':round(float(np.max(np.abs(x))),6),'rms':round(float(np.sqrt(np.mean(x*x))),6),'description':description,'ingredients':ingredients})
cloth=load('rpg','cloth1');belt=load('rpg','beltHandle1');latch=load('rpg','metalLatch');book=load('rpg','bookOpen');close=load('rpg','bookClose');coins=load('rpg','handleCoins');creak=load('rpg','creak1')
step0=load('rpg','footstep00');step1=load('rpg','footstep01');wood=load('impact','impactWood_heavy_002');metal=load('impact','impactMetal_medium_003');bell=load('impact','impactBell_heavy_001');grass=load('impact','footstep_grass_001');deck=load('impact','footstep_wood_000')
# Material-led cues. A real pack/latch/footstep gesture replaces the electronic order ping.
x=empty(2.2);mix(x,cloth,0,.45,-.2);mix(x,belt,.08,.7);mix(x,step0,.36,.7,-.25);mix(x,step1,.77,.65,.25);write('order',x,'Equipment picked up and two departing footsteps.',['rpg/cloth1','rpg/beltHandle1','rpg/footstep00','rpg/footstep01'])
x=empty(1.1);mix(x,latch,.02,.8);mix(x,cloth,.08,.3);write('confirm',x,'Short physical latch and cloth confirmation.',['rpg/metalLatch','rpg/cloth1'])
x=empty(2.5);mix(x,book,.02,.5);mix(x,coins,.25,.4);mix(x,pitch(bell,1.5),.4,.22);write('discovery',room(x),'A journal opened, material find and restrained bell resonance.',['rpg/bookOpen','rpg/handleCoins','impact/impactBell_heavy_001'])
x=empty(3.8);mix(x,wood,.02,.4);mix(x,cloth,.1,.35)
for i,ratio in enumerate([1,1.25,1.5]):mix(x,pitch(bell,ratio),.12+i*.2,.32)
write('claim',room(x,.22),'Physical stake impact and layered resonant bells for actual control gained.',['impact/impactWood_heavy_002','rpg/cloth1','impact/impactBell_heavy_001'])
x=empty(2.8);mix(x,filtered(wood,1500),.14,.7,-.2);mix(x,filtered(metal,2200),.48,.35,.3);mix(x,filtered(pitch(wood,.75),1100),.87,.45);write('combat',room(x,.22),'Distant material impacts; no gunshot, voice or implied weapon.',['impact/impactWood_heavy_002','impact/impactMetal_medium_003'])
x=empty(2.4);mix(x,close,.03,.55);mix(x,cloth,.2,.25);mix(x,deck,.35,.3);write('event',x,'A journal closed and nearby material movement.',['rpg/bookClose','rpg/cloth1','impact/footstep_wood_000'])
x=empty(3);mix(x,grass,.04,.35,-.2);mix(x,step1,.45,.32,.2);mix(x,book,.86,.35);mix(x,pitch(bell,1.25),1.05,.15);write('day',room(x),'Returning steps and opening the day record.',['impact/footstep_grass_001','rpg/footstep01','rpg/bookOpen','impact/impactBell_heavy_001'])
x=empty(3.8);mix(x,filtered(pitch(creak,.7),1000),.1,.35);mix(x,cloth,.4,.25);mix(x,filtered(texture(3.8),1100)*np.sin(np.linspace(0,np.pi,len(x)))[:,None],0,.025);write('night',room(x),'A quiet shelter creak and wind transition; no enemy cue.',['rpg/creak1','rpg/cloth1','original filtered-noise design'])
x=empty(5.5);mix(x,wood,.02,.22)
for i,ratio in enumerate([1,1.25,1.5,2]):mix(x,pitch(bell,ratio),.18+i*.29,.3 if i<3 else .2)
mix(x,coins,1.3,.2);write('victory',room(x,.3),'Longer bell resolution with grounded material attack for actual campaign victory.',['impact/impactWood_heavy_002','impact/impactBell_heavy_001','rpg/handleCoins'])
x=empty(5);mix(x,close,.05,.45);mix(x,filtered(pitch(bell,.65),1800),.28,.2);mix(x,filtered(pitch(creak,.6),800),.8,.2);write('defeat',room(x,.22),'Closing journal and low fading resonance for actual campaign loss.',['rpg/bookClose','impact/impactBell_heavy_001','rpg/creak1'])
# Longer offline atmosphere composites. These are sound design, NOT field recordings.
for name in ['camp','harbor','night']:
 x=empty(24);t=np.arange(len(x))/SR;wind=texture(24,90,2000);gust=.12+.055*np.sin(t*.7)+.035*np.sin(t*.23);x+=wind*gust[:,None]*.18
 if name=='camp':
  for at,sample,gain,pan in [(2.3,cloth,.09,-.5),(7.2,grass,.1,.5),(7.9,step1,.07,.3),(13.4,creak,.045,-.4),(18.1,belt,.055,.5)]:mix(x,sample,at,gain,pan)
 elif name=='harbor':
  surf=texture(24,80,1400);wash=(.5+.5*np.sin(t*1.12-.6))**2;x+=surf*wash[:,None]*.09
  for at,pan in [(4.1,-.45),(14.4,.45),(20.1,-.1)]:mix(x,filtered(pitch(creak,.65),1800),at,.045,pan)
 else:
  x=filtered(x,1400);mix(x,filtered(pitch(creak,.85),900),9.8,.025,-.4);mix(x,cloth,19.3,.025,.4)
 # Match head/tail with a long equal-power crossfade, then encode with fade edges.
 n=SR*2;x[:n]=x[:n]*np.linspace(0,1,n)[:,None]+x[-n:]*np.linspace(1,0,n)[:,None];x=x[:-n]
 write('ambient-'+name,x,'Original offline '+name+' atmosphere composite; not a field recording.',['original filtered-noise wind/wash design','selected Kenney CC0 material Foley; see build script'])
(ROOT/'manifest.json').write_text(json.dumps({'version':1,'sample_rate':SR,'assets':outputs},indent=2)+'\n');check()
