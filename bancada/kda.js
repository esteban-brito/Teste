/* bancada/kda.js - distribuição de K/D/KAST/ADR vs CS profissional real (HLTV).
   Trava o que nenhuma suíte cobria e por isso derivou: KPR/DPR por função, KAST e ADR globais.
   Referências reais (por round, elite): KPR global ~0.68-0.72 · KAST ~70-73% · ADR ~76-82;
   fraggers (AWPer/Rifler/Lurker) fragam mais que support/IGL; AWPer/estrela dá mais dano que support. */
const {X,T}=require("./motor");
const {mean,inRange,printCheck,scheduledMatch}=require("./common");

const N=+(process.env.N||120);
const MAPS=9;
if(X.srand)X.srand(7788);

const byRole={}; // role -> {k,d,r,kast,adr}
let K=0,R=0,KA=0,AD=0;
function acc(stats,rounds,team){
  stats.forEach((s,index)=>{
    const role=team.jogadores[index]?._eng.primario||"?";
    const b=byRole[role]=byRole[role]||{k:0,d:0,r:0,kast:0,adr:0};
    b.k+=s.k;b.d+=s.d;b.r+=rounds;b.kast+=(s.kast||0)*rounds;b.adr+=(s.adr||0)*rounds;
    K+=s.k;R+=rounds;KA+=(s.kast||0)*rounds;AD+=(s.adr||0)*rounds;
  });
}
for(let c=0;c<N;c++){
  X.sortearFormaCampanha(T);
  for(const [teamIndex] of T.entries()){
    for(let m=0;m<MAPS;m++){
      const {a,b}=scheduledMatch(T,teamIndex,c*MAPS+m);
      const g=X.simularMapa(a,b,X.forcaDoDia(a.ef,a.quim),X.forcaDoDia(b.ef,b.quim));
      acc(g.statsA,g.totalRounds,a);acc(g.statsB,g.totalRounds,b);
    }
  }
}

const kpr=r=>byRole[r].k/byRole[r].r, dpr=r=>byRole[r].d/byRole[r].r, adr=r=>byRole[r].adr/byRole[r].r;
const gKPR=K/R, gKAST=KA/R*100, gADR=AD/R;
const fraggers=mean(["AWPer","Rifler","Lurker"].map(kpr)), roleplay=mean(["Support","IGL"].map(kpr));

console.log(`— K/D/KAST/ADR (${N} campanhas · por função) —`);
["AWPer","Rifler","Entry","Lurker","Support","IGL"].forEach(r=>
  console.log(`    ${r.padEnd(8)} KPR ${kpr(r).toFixed(2)}  DPR ${dpr(r).toFixed(2)}  ADR ${adr(r).toFixed(0)}`));

// bandas HLTV (globais robustas + assinatura por função)
const checks=[
  ["KPR global",gKPR.toFixed(3),"0.66–0.73",inRange(gKPR,.66,.73)],
  ["KAST global %",gKAST.toFixed(1),"69–76",inRange(gKAST,69,76)],
  ["ADR global",gADR.toFixed(1),"73–84",inRange(gADR,73,84)],
  ["KPR fraggers − roleplayers",(fraggers-roleplay).toFixed(3),"≥0.08",fraggers-roleplay>=.08],
  ["ADR AWPer − Support",(adr("AWPer")-adr("Support")).toFixed(1),"≥5",adr("AWPer")-adr("Support")>=5],
  ["DPR (todas as funções) em 0.60–0.77","—","0.60–0.77",
    ["AWPer","Rifler","Entry","Lurker","Support","IGL"].every(r=>inRange(dpr(r),.60,.77))],
];
let failures=0;
checks.forEach(([name,value,range,ok])=>{if(!ok)failures++;printCheck(ok,name,value,range);});
console.log(failures?`✗ ${failures} métrica(s) de K/D/KAST/ADR fora da faixa`:"✓ K/D/KAST/ADR fiéis ao real");
process.exitCode=failures?1:0;
