// Balansesimulering: spiller N runder av fase 1 med en enkel bot.
// Bruk: node tools/sim.js [antall]
const fs=require('fs');const vm=require('vm');
const dir=require('path').join(__dirname,'..');const N=+process.argv[2]||200;
const code=fs.readFileSync(dir+'/src/engine.js','utf8')+'\n'+fs.readFileSync(dir+'/src/events.js','utf8')+'\n;this.API={newGame,resolveDay,drawEvent,runChoice,PLAYABLE,GATES,taskOptions,phaseProgress,sum};';
const ctx={};vm.createContext(ctx);vm.runInContext(code,ctx);const A=ctx.API;
const results=[];
for(let seed=1;seed<=N;seed++){
  const s=A.newGame(seed,{name:'Meg',stats:{muskler:3,kondis:2,snoking:3,nerver:3,mekk:2,prat:2},trait:'lokalkjent'},['arild','mona','toregil']);
  while(!s.over && s.day<80){
    const inf=A.PLAYABLE.filter(id=>s.sectors[id].z>0).sort((a,b)=>s.sectors[a].z-s.sectors[b].z);
    const opts=A.taskOptions(s);
    s.crew.forEach((c,i)=>{
      if(c.hp<=1){c.task={type:'hvile'};return;}
      const gate=opts.find(o=>o.type==='befeste'&&s.gates[o.target].level<2);
      const lete=opts.filter(o=>o.type==='lete');
      if(c.trait==='sveiser'&&gate&&s.res.materialer>2){c.task=gate;return;}
      if(inf.length && i<3){c.task={type:'klarere',target:inf[0]};return;}
      if(gate && s.res.materialer>2){c.task=gate;return;}
      if(lete.length){c.task=lete[i%lete.length];return;}
      if(gate){c.task=gate;return;}
      c.task={type:'hvile'};
    });
    A.resolveDay(s);
    const ev=A.drawEvent(s); if(ev){ const ch=ev.choices.filter(c=>!c.when||c.when(s))[0]; A.runChoice(s,ev,ch);}
  }
  results.push({over:s.over,day:s.day,crew:s.crew.length,mat:s.res.mat,moral:s.moral,lost:s.stats.lost,cleared:A.phaseProgress(s).cleared,gates:Object.values(s.gates).map(g=>g.level).join('')});
}
const won=results.filter(r=>r.over==='won');
console.log('won',won.length,'dead',results.filter(r=>r.over==='dead').length,'timeout',results.filter(r=>!r.over).length);
const days=won.map(r=>r.day).sort((a,b)=>a-b);console.log('days median',days[days.length>>1],'min',days[0],'max',days[days.length-1]);
console.log('avg lost',results.reduce((a,r)=>a+r.lost,0)/results.length, 'avg moral',results.reduce((a,r)=>a+r.moral,0)/results.length);
console.log(results.filter(r=>r.over!=='won').slice(0,4));
