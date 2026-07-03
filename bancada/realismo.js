/* bancada/realismo.js — macro do simulador vs números do CS profissional real.
   Mede: KPR, lado CT/T, plant, pós-plant, compras, anti-eco, conversão pós-pistol,
   clutch 1vX, win% do favorito por gap, surras e placares. Sai 1 se algo fugir da faixa. */
const {X,T}=require("./motor");
if(X.srand)X.srand(90210); // semente fixa → números reproduzíveis
const N=+(process.env.N||300), MAPS=9;
let rounds=0,ctWin=0,plant=0,plantTwin=0,kills=0,games=0,nan=0;
const buy={pistol:0,eco:0,force:0,full:0};let pistN=0,pistConv=0,aeN=0,aeW=0;
const clutch={};for(let x=1;x<=5;x++)clutch[x]={n:0,w:0};
const buckets={"0-3":[0,3],"4-8":[4,8],"9-15":[9,15],"16+":[16,99]};
const z={};Object.keys(buckets).forEach(k=>z[k]={w:0,n:0,blow:0});
for(let c=0;c<N;c++){X.sortearFormaCampanha(T);
 for(const me of T){for(let m=0;m<MAPS;m++){const op=T[Math.floor(Math.random()*T.length)];if(op===me){m--;continue;}
   const g=X.simularMapa(me,op,X.forcaDoDia(me.ef,me.quim),X.forcaDoDia(op.ef,op.quim));games++;
   if(isNaN(g.placar[0]))nan++;
   g.statsA.forEach(s=>kills+=s.k);g.statsB.forEach(s=>kills+=s.k);
   g.rounds.forEach((rd,i)=>{rounds++;
     const ctA=rd.ladoA==="CT";if(ctA===rd.venceA)ctWin++;
     if(rd.plantado){plant++;if((!ctA)===rd.venceA)plantTwin++;}
     buy[rd.buyA]++;buy[rd.buyB]++;
     if(rd.r===1||rd.r===13){const nx=g.rounds[i+1];if(nx){pistN++;if(rd.venceA===nx.venceA)pistConv++;}}
     if((rd.buyA==="full"&&rd.buyB==="eco")||(rd.buyA==="eco"&&rd.buyB==="full")){aeN++;if((rd.buyA==="full")===rd.venceA)aeW++;}
     if(rd.clutchX){clutch[rd.clutchX].n++;if(rd.clutchWon)clutch[rd.clutchX].w++;}
   });
   const dif=Math.abs(me.ef-op.ef),lo=Math.min(...g.placar);
   const forte=(me.ef>=op.ef)===(g.vencedorNome===me.nome);
   for(const k in buckets)if(dif>=buckets[k][0]&&dif<=buckets[k][1]){z[k].n++;if(forte)z[k].w++;if(lo<=3)z[k].blow++;break;}
 }}}
const pct=(a,b)=>100*a/Math.max(1,b);
const kpr=kills/rounds/10, ct=pct(ctWin,rounds), pl=pct(plant,rounds), pp=pct(plantTwin,plant);
const ae=pct(aeW,aeN), pc=pct(pistConv,pistN);
const c1=pct(clutch[1].w,clutch[1].n),c2=pct(clutch[2].w,clutch[2].n),c3=pct(clutch[3].w,clutch[3].n);
const g16=pct(z["16+"].w,z["16+"].n),g03=pct(z["0-3"].w,z["0-3"].n);
const linhas=[
 ["KPR",kpr.toFixed(3),"0.66–0.78",kpr>=.66&&kpr<=.78],
 ["CT-round win%",ct.toFixed(1),"47–54",ct>=47&&ct<=54],
 ["Plant%",pl.toFixed(1),"46–60",pl>=46&&pl<=60],
 ["T win pós-plant%",pp.toFixed(1),"56–72",pp>=56&&pp<=72],
 ["Anti-eco (full vs eco)%",ae.toFixed(1),"70–90",ae>=70&&ae<=90],
 ["Conversão pós-pistol%",pc.toFixed(1),"60–84",pc>=60&&pc<=84],
 ["Clutch 1v1%",c1.toFixed(1),"44–56",c1>=44&&c1<=56],
 ["Clutch 1v2%",c2.toFixed(1),"18–28",c2>=18&&c2<=28],
 ["Clutch 1v3%",c3.toFixed(1),"5–13",c3>=5&&c3<=13],
 ["Favorito gap 0-3%",g03.toFixed(1),"50–58",g03>=50&&g03<=58],
 ["Favorito gap 16+%",g16.toFixed(1),"82–93",g16>=82&&g16<=93],
 ["NaN",String(nan),"0",nan===0]];
let falhas=0;
console.log(`— REALISMO (${games} mapas · ${rounds} rounds · N=${N}) —`);
linhas.forEach(([n,v,faixa,ok])=>{if(!ok)falhas++;console.log(`  ${ok?"✓":"✗"} ${n.padEnd(26)} ${String(v).padStart(6)}   [${faixa}]`);});
console.log(falhas?`✗ ${falhas} métrica(s) fora da faixa`:"✓ macro dentro das faixas reais");
process.exitCode=falhas?1:0;
