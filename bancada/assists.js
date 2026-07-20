/* bancada/assists.js - assists do simulador vs CS profissional real (HLTV).
   Trava a fidelidade dos assists — razão A/K, assists por round e a ASSINATURA por função
   (support/IGL assistem muito mais que AWPer/entry). Nenhuma outra suíte cobria isso, e por
   isso os assists derivaram a ~5x baixo (A/K 0.07) antes desta reforma. Referências reais:
   A/K global ~0.25-0.35 · ~0.15-0.25 assists/jogador/round · Support/IGL >> AWPer/Entry. */
const {X,T}=require("./motor");
const {mean,inRange,printCheck,scheduledMatch}=require("./common");

const N=+(process.env.N||120);
const MAPS=9;
if(X.srand)X.srand(4242);

// A função vem do slot do time, nunca do nick: o mesmo jogador pode existir em eras distintas.
let totalK=0,totalA=0,playerRounds=0;
const byRole={}; // role -> {k,a}
function acc(stats,rounds,team){
  stats.forEach((s,index)=>{
    totalK+=s.k;totalA+=s.a;playerRounds+=rounds;
    const role=team.jogadores[index]?._eng.primario||"?";
    const b=byRole[role]=byRole[role]||{k:0,a:0};b.k+=s.k;b.a+=s.a;
  });
}

for(let c=0;c<N;c++){
  X.sortearFormaCampanha(T);
  for(const [teamIndex] of T.entries()){
    for(let m=0;m<MAPS;m++){
      const {a,b}=scheduledMatch(T,teamIndex,c*MAPS+m);
      const game=X.simularMapa(a,b,X.forcaDoDia(a.ef,a.quim),X.forcaDoDia(b.ef,b.quim));
      acc(game.statsA,game.totalRounds,a);acc(game.statsB,game.totalRounds,b);
    }
  }
}

const akGlobal=totalA/Math.max(1,totalK);
const aPerRound=totalA/Math.max(1,playerRounds);
const roleAK=role=>{const b=byRole[role];return b?b.a/Math.max(1,b.k):0;};
const gap=mean(["Support","IGL"].map(roleAK))-mean(["AWPer","Entry"].map(roleAK));

console.log(`— ASSISTS (${N} campanhas · A/K por função) —`);
["AWPer","Entry","Rifler","Lurker","Support","IGL"].forEach(role=>{
  const b=byRole[role];if(b)console.log(`    ${role.padEnd(8)} A/K ${(b.a/Math.max(1,b.k)).toFixed(2)}`);
});

const checks=[
  ["A/K global",akGlobal.toFixed(3),"0.22–0.38",inRange(akGlobal,.22,.38)],
  ["Assists/jogador/round",aPerRound.toFixed(3),"0.14–0.28",inRange(aPerRound,.14,.28)],
  ["Assinatura Support/IGL−AWP/Entry",gap.toFixed(3),"≥0.08",gap>=.08],
];
let failures=0;
checks.forEach(([name,value,range,ok])=>{if(!ok)failures++;printCheck(ok,name,value,range);});
console.log(failures?`✗ ${failures} métrica(s) de assist fora da faixa`:"✓ assists fiéis ao real");
process.exitCode=failures?1:0;
