/* bancada/rating.js - valida rating simulado contra rating real (HLTV).
   Mede correlacao global e erro medio; sai 1 se degradar alem do piso. */
const {X,T}=require("./motor");
const {mean,pickOpponent,signed,okMark}=require("./common");

const N=+(process.env.N||400);
const MAPS=9;
const MIN_CORRELATION=.75;
const MAX_MAE=.12;

if(X.srand)X.srand(1337);

function initPlayers(){
  const players={};
  for(const team of T){
    for(const player of team.jogadores){
      const engine=player._eng;
      players[engine.nick]={sim:[],real:engine.rating,prim:engine.primario};
    }
  }
  return players;
}

function collectRatings(players){
  for(let campaign=0;campaign<N;campaign++){
    X.sortearFormaCampanha(T);
    for(const team of T){
      for(let map=0;map<MAPS;map++){
        const opponent=pickOpponent(T,team);
        const game=X.simularMapa(
          team,
          opponent,
          X.forcaDoDia(team.ef,team.quim),
          X.forcaDoDia(opponent.ef,opponent.quim)
        );
        game.statsA.forEach((stats,index)=>{
          const nick=team.jogadores[index]._eng.nick;
          players[nick].sim.push(stats.rating);
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
  real:player.real,
  sim:mean(player.sim),
  prim:player.prim
}));
const r=correlation(points);
const mae=mean(points.map(point=>Math.abs(point.sim-point.real)));

console.log(`— RATING real×sim (${points.length} jogadores · N=${N}) —`);
Object.entries(byRole(points))
  .sort((a,b)=>mean(b[1].map(point=>point.real))-mean(a[1].map(point=>point.real)))
  .forEach(([role,items])=>{
    const real=mean(items.map(point=>point.real));
    const sim=mean(items.map(point=>point.sim));
    console.log(`    ${role.padEnd(8)} real ${real.toFixed(2)} → sim ${sim.toFixed(2)}  (Δ ${signed(sim-real)})`);
  });

const okR=r>=MIN_CORRELATION;
const okM=mae<=MAX_MAE;
console.log(`  ${okMark(okR)} correlação r = ${r.toFixed(3)}   [≥${MIN_CORRELATION}]`);
console.log(`  ${okMark(okM)} erro médio  = ${mae.toFixed(3)}   [≤${MAX_MAE}]`);
console.log(okR&&okM?"✓ rating fiel ao real":"✗ rating degradou");
process.exitCode=okR&&okM?0:1;
