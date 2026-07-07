/* bancada/realismo.js - macro do simulador vs numeros do CS profissional real.
   Mede KPR, lados, plant, economia, clutches e forca do favorito. */
const {X,T}=require("./motor");
const {pct,inRange,printCheck,pickOpponent}=require("./common");

const N=+(process.env.N||300);
const MAPS=9;
const BUCKETS={
  "0-3":[0,3],
  "4-8":[4,8],
  "9-15":[9,15],
  "16+":[16,99]
};

if(X.srand)X.srand(90210);

function initStats(){
  const clutch={};
  for(let players=1;players<=5;players++)clutch[players]={n:0,w:0};
  const gaps={};
  Object.keys(BUCKETS).forEach(key=>gaps[key]={w:0,n:0,blow:0});
  return {
    rounds:0,ctWin:0,plant:0,plantTwin:0,kills:0,games:0,nan:0,
    buy:{pistol:0,eco:0,force:0,full:0},
    pistN:0,pistConv:0,aeN:0,aeW:0,
    clutch,gaps
  };
}

function bucketFor(diff){
  return Object.entries(BUCKETS).find(([,range])=>diff>=range[0]&&diff<=range[1])?.[0];
}

function recordRound(stats,game,round,index){
  stats.rounds++;
  const ctA=round.ladoA==="CT";
  if(ctA===round.venceA)stats.ctWin++;
  if(round.plantado){
    stats.plant++;
    if((!ctA)===round.venceA)stats.plantTwin++;
  }

  stats.buy[round.buyA]++;
  stats.buy[round.buyB]++;

  if(round.r===1||round.r===13){
    const next=game.rounds[index+1];
    if(next){
      stats.pistN++;
      if(round.venceA===next.venceA)stats.pistConv++;
    }
  }

  const fullVsEco=(round.buyA==="full"&&round.buyB==="eco")||(round.buyA==="eco"&&round.buyB==="full");
  if(fullVsEco){
    stats.aeN++;
    if((round.buyA==="full")===round.venceA)stats.aeW++;
  }

  if(round.clutchX){
    stats.clutch[round.clutchX].n++;
    if(round.clutchWon)stats.clutch[round.clutchX].w++;
  }
}

function recordGame(stats,team,opponent,game){
  stats.games++;
  if(Number.isNaN(game.placar[0]))stats.nan++;
  game.statsA.forEach(player=>stats.kills+=player.k);
  game.statsB.forEach(player=>stats.kills+=player.k);
  game.rounds.forEach((round,index)=>recordRound(stats,game,round,index));

  const diff=Math.abs(team.ef-opponent.ef);
  const bucket=bucketFor(diff);
  if(!bucket)return;

  const favoriteWon=(team.ef>=opponent.ef)===(game.vencedorNome===team.nome);
  const loserScore=Math.min(...game.placar);
  stats.gaps[bucket].n++;
  if(favoriteWon)stats.gaps[bucket].w++;
  if(loserScore<=3)stats.gaps[bucket].blow++;
}

function simulate(){
  const stats=initStats();
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
        recordGame(stats,team,opponent,game);
      }
    }
  }
  return stats;
}

const stats=simulate();
const kpr=stats.kills/stats.rounds/10;
const ct=pct(stats.ctWin,stats.rounds);
const plant=pct(stats.plant,stats.rounds);
const postPlant=pct(stats.plantTwin,stats.plant);
const antiEco=pct(stats.aeW,stats.aeN);
const pistolConv=pct(stats.pistConv,stats.pistN);
const clutch1=pct(stats.clutch[1].w,stats.clutch[1].n);
const clutch2=pct(stats.clutch[2].w,stats.clutch[2].n);
const clutch3=pct(stats.clutch[3].w,stats.clutch[3].n);
const favorite03=pct(stats.gaps["0-3"].w,stats.gaps["0-3"].n);
const favorite16=pct(stats.gaps["16+"].w,stats.gaps["16+"].n);

const checks=[
  ["KPR",kpr.toFixed(3),"0.66–0.78",inRange(kpr,.66,.78)],
  ["CT-round win%",ct.toFixed(1),"47–54",inRange(ct,47,54)],
  ["Plant%",plant.toFixed(1),"46–60",inRange(plant,46,60)],
  ["T win pós-plant%",postPlant.toFixed(1),"56–72",inRange(postPlant,56,72)],
  ["Anti-eco (full vs eco)%",antiEco.toFixed(1),"70–90",inRange(antiEco,70,90)],
  ["Conversão pós-pistol%",pistolConv.toFixed(1),"60–84",inRange(pistolConv,60,84)],
  ["Clutch 1v1%",clutch1.toFixed(1),"44–56",inRange(clutch1,44,56)],
  ["Clutch 1v2%",clutch2.toFixed(1),"18–28",inRange(clutch2,18,28)],
  ["Clutch 1v3%",clutch3.toFixed(1),"5–13",inRange(clutch3,5,13)],
  ["Favorito gap 0-3%",favorite03.toFixed(1),"50–58",inRange(favorite03,50,58)],
  ["Favorito gap 16+%",favorite16.toFixed(1),"82–93",inRange(favorite16,82,93)],
  ["NaN",String(stats.nan),"0",stats.nan===0]
];

let failures=0;
console.log(`— REALISMO (${stats.games} mapas · ${stats.rounds} rounds · N=${N}) —`);
checks.forEach(([name,value,range,ok])=>{
  if(!ok)failures++;
  printCheck(ok,name,value,range);
});
console.log(failures?`✗ ${failures} métrica(s) fora da faixa`:"✓ macro dentro das faixas reais");
process.exitCode=failures?1:0;
