/* bancada/realismo.js - macro do simulador vs numeros do CS profissional real.
   Mede KPR, lados, plant, economia, clutches e forca do favorito. */
const {X,T}=require("./motor");
const {pct,inRange,printCheck,scheduledMatch}=require("./common");

const N=+(process.env.N||300);
const MAPS=9;
const BUCKETS={
  "0-3":[0,3],
  "4-8":[4,8],
  "9-15":[9,15],
  "16+":[16,99]
};

if(X.srand)X.srand(90210);

// A cada TELEMETRY_EVERY mapas ligamos a telemetria pra medir FORMA (método do round,
// duelo de abertura por lado). Ela observa decisões já tomadas: não chama RNG nem muda
// o resultado (game.js: "options.telemetry ... não chama RNG nem altera o resultado
// esportivo"), então amostrar é seguro e mantém a suíte barata.
const TELEMETRY_EVERY=+(process.env.TELEMETRY_EVERY||8);

function initStats(){
  const clutch={};
  for(let players=1;players<=5;players++)clutch[players]={n:0,w:0};
  const gaps={};
  Object.keys(BUCKETS).forEach(key=>gaps[key]={w:0,n:0,blow:0});
  return {
    rounds:0,ctWin:0,plant:0,plantTwin:0,kills:0,games:0,nan:0,
    buy:{pistol:0,eco:0,force:0,full:0},
    pistN:0,pistConv:0,aeN:0,aeW:0,
    clutch,gaps,
    // ——— FORMA (não é média): distribuições que uma faixa de média não protege ———
    killsPorRound:{},          // quantas kills teve cada round → 0/1-kill rounds existem?
    placarPerdedor:{},         // placar do perdedor → o mapa é competitivo ou atropelo?
    compraPorLado:{CT:{pistol:0,eco:0,force:0,full:0},TR:{pistol:0,eco:0,force:0,full:0}},
    metodo:{},                 // elim/tempo/defuse/detona → como o round termina
    equilibradoN:0,equilibradoApertado:0, // competitividade entre times de força parecida
    aberturaPorLado:{CT:0,TR:0},
    telemetriaRounds:0
  };
}

// kills do round r = variação do K acumulado entre snapshots consecutivos.
// Já vem de graça no retorno de simularMapa (snapA/snapB) quando leve=false.
function killsDoRound(game,index){
  const round=game.rounds[index],anterior=index>0?game.rounds[index-1]:null;
  if(!round.snapA||!round.snapB)return null;
  const soma=snap=>snap.reduce((total,linha)=>total+linha.k,0);
  const atual=soma(round.snapA)+soma(round.snapB);
  const antes=anterior&&anterior.snapA?soma(anterior.snapA)+soma(anterior.snapB):0;
  return atual-antes;
}

function recordTelemetria(stats,telemetry){
  telemetry.rounds.forEach(round=>{
    stats.telemetriaRounds++;
    const metodo=round.result?round.result.method:"?";
    stats.metodo[metodo]=(stats.metodo[metodo]||0)+1;
    const abertura=(round.events||[]).find(event=>event.opening);
    if(abertura){
      const lado=round.sides[abertura.killer.team];
      stats.aberturaPorLado[lado]=(stats.aberturaPorLado[lado]||0)+1;
    }
  });
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
  stats.compraPorLado[round.ladoA][round.buyA]++;
  stats.compraPorLado[round.ladoB][round.buyB]++;

  const kills=killsDoRound(game,index);
  if(kills!==null)stats.killsPorRound[kills]=(stats.killsPorRound[kills]||0)+1;

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

  // distribuição de competitividade do mapa: independe do bucket de força, então é
  // contabilizada ANTES do early-return abaixo
  const loserScore=Math.min(...game.placar);
  stats.placarPerdedor[loserScore]=(stats.placarPerdedor[loserScore]||0)+1;

  const diff=Math.abs(team.ef-opponent.ef);
  if(diff<=3){stats.equilibradoN++;if(loserScore>=10)stats.equilibradoApertado++;}

  const bucket=bucketFor(diff);
  if(!bucket)return;

  const favoriteWon=(team.ef>=opponent.ef)===(game.vencedor===team);
  stats.gaps[bucket].n++;
  if(favoriteWon)stats.gaps[bucket].w++;
  if(loserScore<=3)stats.gaps[bucket].blow++;
}

function simulate(){
  const stats=initStats();
  let mapIndex=0;
  for(let campaign=0;campaign<N;campaign++){
    X.sortearFormaCampanha(T);
    for(const [teamIndex,team] of T.entries()){
      for(let map=0;map<MAPS;map++){
        const {opponent,a,b}=scheduledMatch(T,teamIndex,campaign*MAPS+map);
        const observar=(mapIndex++%TELEMETRY_EVERY)===0;
        const game=X.simularMapa(
          a,
          b,
          X.forcaDoDia(a.ef,a.quim),
          X.forcaDoDia(b.ef,b.quim),
          null,
          false,
          observar?{telemetry:true}:undefined
        );
        recordGame(stats,team,opponent,game);
        if(game.telemetry)recordTelemetria(stats,game.telemetry);
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

/* ─── FORMA: distribuições que uma faixa de média não protege ───────────── */
const somaMapa=mapa=>Object.values(mapa).reduce((total,valor)=>total+valor,0);
const distribuicao=(mapa,total)=>Object.entries(mapa)
  .sort((a,b)=>Number(a[0])-Number(b[0]))
  .map(([chave,valor])=>`${chave}:${pct(valor,total).toFixed(1)}%`).join("  ");

const roundsMedidos=somaMapa(stats.killsPorRound);
const roundsQuietos=pct((stats.killsPorRound[0]||0)+(stats.killsPorRound[1]||0),roundsMedidos);
const mapasMedidos=somaMapa(stats.placarPerdedor);
// Competitividade só faz sentido entre times de força parecida: o round-robin da suíte cruza
// força 103 com força 73, e nesses confrontos o atropelo é o resultado CORRETO.
const mapasApertados=pct(stats.equilibradoApertado,stats.equilibradoN);
const metodoTotal=somaMapa(stats.metodo);
const porMetodo=chave=>pct(stats.metodo[chave]||0,metodoTotal);
const aberturaTotal=stats.aberturaPorLado.CT+stats.aberturaPorLado.TR;
const aberturaCT=pct(stats.aberturaPorLado.CT,aberturaTotal);
const compraLado=(lado,tipo)=>pct(stats.compraPorLado[lado][tipo],somaMapa(stats.compraPorLado[lado]));

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

/* Checagens de FORMA.

   CORREÇÃO DE MÉTODO (26/07/2026): duas faixas escritas na primeira versão desta seção
   — "rounds com 0 ou 1 kill em 8–20%" e "mapas apertados em 45–70%" — eram estimativas
   próprias, sem fonte pública que as sustentasse. Ajustar o motor para acertá-las seria
   calibrar contra um número inventado. Elas foram reclassificadas:

   · rounds quietos viraram um gate ESTRUTURAL (>2%). A afirmação que a etapa do relógio
     realmente sustenta é que round quieto passou a ser POSSÍVEL: antes era 0,0% por
     construção, porque o laço só avançava quando alguém morria;
   · "mapas apertados" virou RELATÓRIO, medido só entre times equilibrados (|Δforça| ≤ 3),
     que é a única versão da pergunta que significa alguma coisa. Sem fonte para a faixa,
     não vira gate. */
// Ratchet por etapa, igual ao de perfis.js: cada métrica pertence à etapa que a resolve.
// As do relógio já reprovam; as de COMPRA dependem da economia em unidades reais (a etapa
// seguinte), e ficam como relatório até lá — reprovar agora só repetiria um fato conhecido.
const ETAPA_ATIVA={relogio:true,economia:process.env.ECONOMIA_STRICT==="1"};
const checksForma=[
  ["relogio","Rounds com 0 ou 1 kill %",roundsQuietos.toFixed(1),">2 (estrutural)",roundsQuietos>2],
  ["relogio","Rounds por eliminação total %",porMetodo("elim").toFixed(1),"20–45",inRange(porMetodo("elim"),20,45)],
  ["relogio","Rounds por tempo/default %",porMetodo("tempo").toFixed(1),"6–18",inRange(porMetodo("tempo"),6,18)],
  ["relogio","Abertura vencida pelo CT %",aberturaCT.toFixed(1),"46–56",inRange(aberturaCT,46,56)],
  ["economia","Full buy no CT %",compraLado("CT","full").toFixed(1),"55–75",inRange(compraLado("CT","full"),55,75)],
  ["economia","Eco no TR %",compraLado("TR","eco").toFixed(1),"10–25",inRange(compraLado("TR","eco"),10,25)]
];

let failures=0;
console.log(`— REALISMO (${stats.games} mapas · ${stats.rounds} rounds · N=${N}) —`);
checks.forEach(([name,value,range,ok])=>{
  if(!ok)failures++;
  printCheck(ok,name,value,range);
});

console.log(`\n  FORMA (telemetria em 1 de cada ${TELEMETRY_EVERY} mapas · ${stats.telemetriaRounds} rounds observados)`);
console.log(`    kills por round:   ${distribuicao(stats.killsPorRound,roundsMedidos)}`);
console.log(`    placar do perdedor: ${distribuicao(stats.placarPerdedor,mapasMedidos)}`);
console.log(`    método do round:    ${Object.entries(stats.metodo).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}:${pct(v,metodoTotal).toFixed(1)}%`).join("  ")}`);
console.log(`    mapas apertados entre times equilibrados (|Δforça|≤3): ${mapasApertados.toFixed(1)}%  — relatório, sem faixa publicada`);
console.log("");
let formaFora=0,formaPendente=0;
checksForma.forEach(([etapa,name,value,range,ok])=>{
  if(!ok&&!ETAPA_ATIVA[etapa]){
    formaPendente++;
    console.log(`  ▲ ${name.padEnd(26)} ${String(value).padStart(6)}   [${range} · aguarda a economia real]`);
    return;
  }
  if(!ok)formaFora++;
  printCheck(ok,name,value,range);
});

console.log("");
if(failures)console.log(`✗ ${failures} métrica(s) macro fora da faixa`);
else console.log("✓ macro dentro das faixas reais");
if(formaFora)console.log(`✗ ${formaFora} métrica(s) de forma fora da faixa`);
else console.log(formaPendente
  ?`✓ forma do round no alvo · ▲ ${formaPendente} métrica(s) aguardam a economia real`
  :"✓ forma dentro das faixas reais");

process.exitCode=(failures||formaFora)?1:0;
