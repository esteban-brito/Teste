/* bancada/rating.js - valida rating simulado contra rating real (HLTV).
   Mede correlacao global e erro medio; sai 1 se degradar alem do piso. */
const {X,T}=require("./motor");
const {mean,scheduledMatch,signed,okMark}=require("./common");

const N=+(process.env.N||400);
const MAPS=9;
const MIN_CORRELATION=.90;
const MAX_MAE=.065;
const MIN_SLOPE=.85;
const MAX_SLOPE=1.15;
const MAX_PLAYER_ERROR=.20;

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
const okR=r>=MIN_CORRELATION;
const okM=mae<=MAX_MAE;
const okSlope=slope>=MIN_SLOPE&&slope<=MAX_SLOPE;
const okPlayer=largestError<=MAX_PLAYER_ERROR;
console.log(`  ${okMark(okCoverage)} cobertura por ID = ${points.length}/${expectedPlayers}`);
console.log(`  ${okMark(okR)} correlação r = ${r.toFixed(3)}   [≥${MIN_CORRELATION}]`);
console.log(`  ${okMark(okM)} erro médio  = ${mae.toFixed(3)}   [≤${MAX_MAE}]`);
console.log(`  ${okMark(okSlope)} inclinação real→sim = ${slope.toFixed(3)}   [${MIN_SLOPE}–${MAX_SLOPE}]`);
console.log(`  ${okMark(okPlayer)} maior erro individual = ${largestError.toFixed(3)}   [≤${MAX_PLAYER_ERROR}]`);
console.log(okR&&okM&&okSlope&&okPlayer?"✓ rating fiel ao real":"✗ rating degradou");
process.exitCode=okCoverage&&okR&&okM&&okSlope&&okPlayer?0:1;
