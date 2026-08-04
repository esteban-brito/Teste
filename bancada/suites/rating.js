/* bancada/suites/rating.js - RELATÓRIO da relação entre o rating simulado e o rating histórico.

   Deixou de ser gate em 26/07/2026. Enquanto o motor recebia o rating histórico como
   ENTRADA (CFG_FA.PRIOR, FRAG_RATING, FORMA_RATING), esta correlação media em boa parte o
   motor devolvendo o número que já tinha recebido — era circular. Removidas as injeções, o
   rating passou a emergir da carta (stats, função, playstyle, OVR) e a correlação virou uma
   PREVISÃO de verdade, naturalmente mais baixa.

   O gate de qualidade individual é bancada/suites/perfis.js: assinatura por função e playstyle,
   sobreposição entre bandas de OVR, peso do contexto e r² do OVR. Aqui só se observa o
   quanto a carta consegue prever o histórico, e a COBERTURA continua sendo obrigatória:
   um jogador sumir da amostra ainda é erro. */
const {X,T}=require("../lib/motor");
const {mean,scheduledMatch,signed,okMark}=require("../lib/common");

const N=+(process.env.N||400);
const MAPS=9;
// Faixas de REFERÊNCIA (não reprovam). Servem para enxergar deslocamento entre execuções.
const REF_CORRELATION=.75;
const REF_MAE=.10;
const REF_SLOPE=[.40,1.15];

if(X.srand)X.srand(1337);

function initPlayers(){
  const players={};
  for(const [teamIndex,team] of T.entries()){
    for(const [playerIndex,player] of team.jogadores.entries()){
      const engine=player._eng;
      const key=`${teamIndex}:${playerIndex}`;
      players[key]={key,id:engine.id,nick:engine.nick,team:team.nome,sim:[],real:engine.rating,prim:engine.primario};
    }
  }
  return players;
}

function collectRatings(players){
  for(let campaign=0;campaign<N;campaign++){
    X.sortearFormaCampanha(T);
    for(const [teamIndex,team] of T.entries()){
      for(let map=0;map<MAPS;map++){
        const {a,b}=scheduledMatch(T,teamIndex,campaign*MAPS+map);
        const game=X.simularMapa(
          a,
          b,
          X.forcaDoDia(a.ef,a.quim),
          X.forcaDoDia(b.ef,b.quim)
        );
        const teamStats=a===team?game.statsA:game.statsB;
        teamStats.forEach((stats,index)=>{
          players[`${teamIndex}:${index}`].sim.push(stats.rating);
        });
      }
    }
  }
}

function correlation(points){
  const real=points.map(point=>point.real);
  const sim=points.map(point=>point.sim);
  const realMean=mean(real);
  const simMean=mean(sim);
  const cov=mean(points.map(point=>(point.real-realMean)*(point.sim-simMean)));
  const sx=Math.sqrt(mean(real.map(value=>(value-realMean)**2)));
  const sy=Math.sqrt(mean(sim.map(value=>(value-simMean)**2)));
  return cov/(sx*sy);
}

function byRole(points){
  const roles={};
  points.forEach(point=>{
    (roles[point.prim]=roles[point.prim]||[]).push(point);
  });
  return roles;
}

const players=initPlayers();
collectRatings(players);

const points=Object.values(players).map(player=>({
  key:player.key,
  id:player.id,
  nick:player.nick,
  team:player.team,
  real:player.real,
  sim:mean(player.sim),
  prim:player.prim
}));
const r=correlation(points);
const mae=mean(points.map(point=>Math.abs(point.sim-point.real)));
const realMean=mean(points.map(point=>point.real)),simMean=mean(points.map(point=>point.sim));
const realVariance=mean(points.map(point=>(point.real-realMean)**2));
const slope=realVariance?mean(points.map(point=>(point.real-realMean)*(point.sim-simMean)))/realVariance:0;
const largest=[...points].sort((a,b)=>Math.abs(b.sim-b.real)-Math.abs(a.sim-a.real)).slice(0,5);
const largestError=Math.abs(largest[0]?.sim-largest[0]?.real||0);
const expectedPlayers=X.ATRIBUTOS.length;

console.log(`— RATING real×sim (${points.length} jogadores · N=${N}) —`);
Object.entries(byRole(points))
  .sort((a,b)=>mean(b[1].map(point=>point.real))-mean(a[1].map(point=>point.real)))
  .forEach(([role,items])=>{
    const real=mean(items.map(point=>point.real));
    const sim=mean(items.map(point=>point.sim));
    console.log(`    ${role.padEnd(8)} real ${real.toFixed(2)} → sim ${sim.toFixed(2)}  (Δ ${signed(sim-real)})`);
  });

console.log("  maiores desvios individuais:");
largest.forEach(point=>console.log(`    ${(point.nick+" / "+point.team).padEnd(27)} ${point.real.toFixed(2)} -> ${point.sim.toFixed(2)}  (${signed(point.sim-point.real)})`));

const okCoverage=points.length===expectedPlayers&&points.every(point=>point.id);
const marca=ok=>ok?"·":"▲";
console.log(`  ${okMark(okCoverage)} cobertura por ID = ${points.length}/${expectedPlayers}`);
console.log(`  ${marca(r>=REF_CORRELATION)} correlação r = ${r.toFixed(3)}   [referência ≥${REF_CORRELATION}]`);
console.log(`  ${marca(mae<=REF_MAE)} erro médio  = ${mae.toFixed(3)}   [referência ≤${REF_MAE}]`);
console.log(`  ${marca(slope>=REF_SLOPE[0]&&slope<=REF_SLOPE[1])} inclinação real→sim = ${slope.toFixed(3)}   [referência ${REF_SLOPE[0]}–${REF_SLOPE[1]}]`);
console.log(`  · maior erro individual = ${largestError.toFixed(3)}`);
console.log(`  A inclinação abaixo de 1 é esperada: a carta não contém tudo o que o histórico`);
console.log(`  registrou. Forçá-la a 1 exigiria devolver o rating histórico ao motor.`);
console.log(okCoverage
  ?"✓ relatório de rating gerado (gate de qualidade individual: bancada/suites/perfis.js)"
  :"✗ cobertura incompleta: algum jogador sumiu da amostra");
process.exitCode=okCoverage?0:1;
