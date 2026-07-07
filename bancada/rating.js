/* bancada/rating.js — valida o rating SIMULADO contra o rating REAL (HLTV) de cada jogador.
   Agrupa por role e mede correlação global + erro médio. Sai 1 se degradar além do piso. */
const {X,T}=require("./motor");
if(X.srand)X.srand(1337);
const N=+(process.env.N||400), MAPS=9;
const PD={};T.forEach(me=>me.jogadores.forEach(j=>{const e=j._eng;PD[e.nick]={sim:[],real:e.rating,prim:e.primario};}));
for(let c=0;c<N;c++){X.sortearFormaCampanha(T);
 for(const me of T){for(let m=0;m<MAPS;m++){const op=T[Math.floor(Math.random()*T.length)];if(op===me){m--;continue;}
   const g=X.simularMapa(me,op,X.forcaDoDia(me.ef,me.quim),X.forcaDoDia(op.ef,op.quim));
   g.statsA.forEach((s,i)=>PD[me.jogadores[i]._eng.nick].sim.push(s.rating));
 }}}
const m=a=>a.reduce((x,y)=>x+y,0)/a.length;
const ps=Object.values(PD).map(d=>({real:d.real,sim:m(d.sim),prim:d.prim}));
const xs=ps.map(p=>p.real),ys=ps.map(p=>p.sim),mx=m(xs),my=m(ys);
const cov=m(ps.map(p=>(p.real-mx)*(p.sim-my)));
const sx=Math.sqrt(m(xs.map(x=>(x-mx)**2))),sy=Math.sqrt(m(ys.map(y=>(y-my)**2)));
const r=cov/(sx*sy), mae=m(ps.map(p=>Math.abs(p.sim-p.real)));
console.log(`— RATING real×sim (${ps.length} jogadores · N=${N}) —`);
const roles={};ps.forEach(p=>(roles[p.prim]=roles[p.prim]||[]).push(p));
Object.entries(roles).sort((a,b)=>m(b[1].map(p=>p.real))-m(a[1].map(p=>p.real)))
 .forEach(([role,a])=>{const d=m(a.map(p=>p.sim))-m(a.map(p=>p.real));
   console.log(`    ${role.padEnd(8)} real ${m(a.map(p=>p.real)).toFixed(2)} → sim ${m(a.map(p=>p.sim)).toFixed(2)}  (Δ ${(d>=0?"+":"")+d.toFixed(2)})`);});
const okR=r>=.75, okM=mae<=.12;
console.log(`  ${okR?"✓":"✗"} correlação r = ${r.toFixed(3)}   [≥0.75]`);
console.log(`  ${okM?"✓":"✗"} erro médio  = ${mae.toFixed(3)}   [≤0.12]`);
console.log(okR&&okM?"✓ rating fiel ao real":"✗ rating degradou");
process.exitCode=okR&&okM?0:1;
