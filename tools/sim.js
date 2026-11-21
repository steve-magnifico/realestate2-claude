const {genWorld,PROPS,TYPES,REAL}=require('../src/world.js');
const res={}; TYPES.forEach(k=>res[k]={fin:[],dd:[]});
const rr=[],fxr=[],rmin=[],rmax=[];
for(let s=1;s<=400;s++){const W=genWorld(s*7919,REAL);
 for(const k of TYPES){res[k].fin.push(W.idx[k][40]);let pk=0,dd=0;for(const v of W.idx[k]){pk=Math.max(pk,v);dd=Math.min(dd,v/pk-1);}res[k].dd.push(dd);}
 rmin.push(Math.min(...W.r));rmax.push(Math.max(...W.r));fxr.push(Math.max(...W.fx));fxr.push(Math.min(...W.fx));}
const pc=(a,p)=>{a=[...a].sort((x,y)=>x-y);return a[Math.floor(p*(a.length-1))].toFixed(2)};
for(const k of TYPES)console.log(k,'final p5/50/95',pc(res[k].fin,.05),pc(res[k].fin,.5),pc(res[k].fin,.95),' maxDD p5/50/95',pc(res[k].dd,.05),pc(res[k].dd,.5),pc(res[k].dd,.95));
console.log('rate min p5/50',pc(rmin,.05),pc(rmin,.5),' max p50/95',pc(rmax,.5),pc(rmax,.95));
console.log('fx range',pc(fxr,.02),pc(fxr,.98));
const W=genWorld(12345,REAL);
console.log('qc',W.qc,'sched',W.sched.map(e=>e.q+':'+e.key).join(' '));
for(let t=0;t<=40;t+=2)console.log(t,'r',W.r[t].toFixed(2),'fx',Math.round(W.fx[t]),'g',W.g[t].toFixed(1),'pi',W.pi[t].toFixed(1),'s',W.sent[t].toFixed(2),'| land',W.idx.land[t].toFixed(2),'apt',W.idx.apt[t].toFixed(2),'off',W.idx.office[t].toFixed(2),'fac',W.idx.factory[t].toFixed(2),'| L1',W.price.L1[t].toFixed(1),'A4',W.price.A4[t].toFixed(1),'jr',W.jr[t].toFixed(2),'cost',W.cost[t].toFixed(2));
console.log(W.jack.map((j,i)=>j?i+':'+j:'').filter(Boolean).join(' '));
