/* bancada/auditoria.js - relatorio curto de classificacao e auditoria profunda do simulador.
   Uso: node bancada/auditoria.js
        node bancada/auditoria.js --deep [--format human|json] [--cycles 8] */
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {X,T}=require("./motor");
const {compactStats,countBy,sortedCountEntries,teamNameFor}=require("./common");

const DEEP_SCHEMA_VERSION=3;
const DEFAULT_DEEP_CYCLES=8;
const DEEP_BASE_SEED=0x51f15e1d;
const MAPS=["Mirage","Inferno","Nuke","Ancient","Anubis","Dust2","Train","Overpass"];
const QUARTILES=["Q1","Q2","Q3","Q4"];
const OUTCOMES=["win","loss"];
const BUY_STATES=["pistol","eco","force","full"];
const SIDES=["CT","TR"];
let statisticsPromise=null,sum,mean,quantile,rounded,describe;

function loadSampleStatistics(){
  if(!statisticsPromise){
    const moduleUrl=pathToFileURL(path.join(__dirname,"..","src","domain","statistics","sample-summary.mjs")).href;
    statisticsPromise=import(moduleUrl).then(statistics=>{
      ({sum,mean,rounded}=statistics);
      quantile=statistics.quantileSorted;
      describe=statistics.describeSample;
      return statistics;
    });
  }
  return statisticsPromise;
}

const PLAYSTYLE_ORDER=[
  "spacetaker","infiltrator","playmaker","aggressive","support",
  "trader","anchor","clutcher","cerebral","joker","baiter"
];

function printCount(title,count,order=null){
  console.log(`\n-- ${title} --`);
  sortedCountEntries(count,order)
    .forEach(([key,total])=>console.log(`  ${String(total).padStart(2)} ${label(key)}`));
}

function label(style){
  return X.STYLE_LABEL?X.STYLE_LABEL(style):style;
}

function roleMargin(player){
  const scores=X.afinidades(player);
  const rows=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  return {rows,gap:rows[0][1]-rows[1][1]};
}

function printLowMargins(players){
  console.log("\n-- Margens baixas de role --");
  players
    .map(player=>({player,...roleMargin(player)}))
    .sort((a,b)=>a.gap-b.gap)
    .slice(0,15)
    .forEach(({player,rows,gap})=>{
      const top=rows.slice(0,3).map(([role,score])=>`${role}:${score.toFixed(1)}`).join(" ");
      console.log(`  ${player.nick.padEnd(12)} ${teamNameFor(X.TEAMS,player).padEnd(11)} ${(player.primario+"/"+player.secundario).padEnd(16)} gap ${gap.toFixed(1).padStart(4)}  ${top}`);
    });
}

function printStylePlayers(players,style){
  const selected=players.filter(player=>player.playstyle===style);
  console.log(`\n-- ${label(style)} (${selected.length}) --`);
  selected.forEach(player=>{
    console.log(`  ${player.nick.padEnd(12)} ${teamNameFor(X.TEAMS,player).padEnd(11)} ${(player.primario+"/"+player.secundario).padEnd(16)} rt ${String(player.rating).padEnd(4)} ${compactStats(player)}`);
  });
}

function pairText(player){
  return `${player.primario}/${player.secundario||player.combatRole||"-"}`;
}

function pairReality(player,rolePairReality=X.rolePairReality){
  return rolePairReality?rolePairReality(player.primario,player.secundario||player.combatRole,player):{cost:0,label:"natural",reasons:[]};
}

function styleReality(player,roleStyleReality=X.roleStyleReality){
  const role=player.primario==="IGL"?(player.combatRole||player.secundario):player.primario;
  return roleStyleReality?roleStyleReality(role,player.playstyle,player):{cost:0,label:"natural",reasons:[]};
}

function printRolePairs(players){
  console.log("\n-- Pares de roles --");
  sortedCountEntries(countBy(players,pairText))
    .forEach(([pair,total])=>console.log(`  ${String(total).padStart(2)} ${pair}`));
}

function printRarePairs(players,rolePairReality){
  console.log("\n-- Pares raros por contexto --");
  players
    .map(player=>({player,real:pairReality(player,rolePairReality)}))
    .filter(row=>row.real.cost>=.35)
    .sort((a,b)=>b.real.cost-a.real.cost||a.player.nick.localeCompare(b.player.nick))
    .slice(0,18)
    .forEach(({player,real})=>{
      const why=real.reasons.length?` · ${real.reasons.join("; ")}`:"";
      console.log(`  ${player.nick.padEnd(12)} ${teamNameFor(X.TEAMS,player).padEnd(11)} ${pairText(player).padEnd(16)} ${real.label.padEnd(10)} cost ${real.cost.toFixed(2)} ${compactStats(player)}${why}`);
    });
}

function printRareStyles(players,roleStyleReality){
  console.log("\n-- Role/playstyle raros por contexto --");
  players
    .map(player=>({player,real:styleReality(player,roleStyleReality)}))
    .filter(row=>row.real.cost>=.28)
    .sort((a,b)=>b.real.cost-a.real.cost||a.player.nick.localeCompare(b.player.nick))
    .slice(0,18)
    .forEach(({player,real})=>{
      const role=player.primario==="IGL"?(player.combatRole||player.secundario):player.primario;
      const why=real.reasons.length?` · ${real.reasons.join("; ")}`:"";
      console.log(`  ${player.nick.padEnd(12)} ${teamNameFor(X.TEAMS,player).padEnd(11)} ${(role+"/"+label(player.playstyle)).padEnd(22)} ${real.label.padEnd(10)} cost ${real.cost.toFixed(2)} ${compactStats(player)}${why}`);
    });
}

function runQuickAudit(rolePairReality=X.rolePairReality,roleStyleReality=X.roleStyleReality){
  const players=Object.values(X.POOL);
  console.log("AUDITORIA PRISMA");
  console.log(`${players.length} jogadores`);
  printCount("Roles",countBy(players,player=>player.primario));
  printCount("Playstyles",countBy(players,player=>player.playstyle),PLAYSTYLE_ORDER);
  printRolePairs(players);
  printRarePairs(players,rolePairReality);
  printRareStyles(players,roleStyleReality);
  printLowMargins(players);
  printStylePlayers(players,"baiter");
  printStylePlayers(players,"support");
}

function compareText(a,b){
  return a<b?-1:a>b?1:0;
}

function pearson(points){
  if(points.length<2)return 0;
  const meanX=mean(points.map(point=>point[0]));
  const meanY=mean(points.map(point=>point[1]));
  let numerator=0,denominatorX=0,denominatorY=0;
  points.forEach(([x,y])=>{
    numerator+=(x-meanX)*(y-meanY);
    denominatorX+=(x-meanX)**2;
    denominatorY+=(y-meanY)**2;
  });
  return denominatorX&&denominatorY?numerator/Math.sqrt(denominatorX*denominatorY):0;
}

function ranks(values){
  const indexed=values.map((value,index)=>({value,index})).sort((a,b)=>a.value-b.value||a.index-b.index);
  const result=Array(values.length);
  for(let start=0;start<indexed.length;){
    let end=start+1;
    while(end<indexed.length&&indexed[end].value===indexed[start].value)end++;
    const rank=(start+end-1)/2+1;
    for(let index=start;index<end;index++)result[indexed[index].index]=rank;
    start=end;
  }
  return result;
}

function spearman(points){
  if(points.length<2)return 0;
  const rankX=ranks(points.map(point=>point[0]));
  const rankY=ranks(points.map(point=>point[1]));
  return pearson(rankX.map((value,index)=>[value,rankY[index]]));
}

function linearFit(points){
  if(points.length<2)return {slope:0,intercept:0};
  const meanX=mean(points.map(point=>point[0]));
  const meanY=mean(points.map(point=>point[1]));
  const denominator=sum(points.map(([x])=>(x-meanX)**2));
  const slope=denominator?sum(points.map(([x,y])=>(x-meanX)*(y-meanY)))/denominator:0;
  return {slope,intercept:meanY-slope*meanX};
}

function rawPlayerId(card){
  return card?._eng?.id||card?._eng?.nome||card?.nick||"?";
}

function playerEngine(card){
  return card?._eng||card;
}

function roundRobinPairs(teamCount){
  const slots=Array.from({length:teamCount},(_,index)=>index);
  if(slots.length%2)slots.push(null);
  const pairs=[];
  for(let round=0;round<slots.length-1;round++){
    for(let index=0;index<slots.length/2;index++){
      const a=slots[index],b=slots[slots.length-1-index];
      if(a!==null&&b!==null)pairs.push({round,a,b});
    }
    slots.splice(1,0,slots.pop());
  }
  return pairs;
}

function seedFor(cycle,pairIndex){
  const mixed=(DEEP_BASE_SEED+Math.imul(cycle+1,0x9e3779b1)+Math.imul(pairIndex+1,0x85ebca6b))>>>0;
  return mixed||1;
}

function classificationFingerprint(){
  return JSON.stringify(Object.keys(X.POOL).sort(compareText).map(id=>{
    const player=X.POOL[id];
    return [id,player.rating,player.ovr,player.primario,player.secundario,player.combatRole,player.playstyle,
      player.fp,player.en,player.tr,player.op,player.cl,player.sn,player.ut];
  }));
}

function emptyMetricSamples(){
  return {rating:[],kpr:[],dpr:[],apr:[],kast:[],adr:[]};
}

function emptyRoundTelemetry(){
  return {rounds:0,kills:0,deaths:0,assists:0,damage:0,tradeKills:0,kastCredits:0,
    killRounds:0,assistRounds:0,survived:0,saved:0,tradedDeaths:0,tradeKastCredits:0};
}

function addRoundTelemetry(total,row){
  total.rounds++;
  total.kills+=row.kills;total.deaths+=row.deaths;total.assists+=row.assists;total.damage+=row.damage;
  total.tradeKills+=row.tradeKills;total.kastCredits+=row.kastCredit;
  total.killRounds+=row.kastComponents.kill?1:0;total.assistRounds+=row.kastComponents.assist?1:0;
  total.survived+=row.survived?1:0;total.saved+=row.saved?1:0;
  total.tradedDeaths+=row.wasTraded?1:0;total.tradeKastCredits+=row.kastComponents.traded?1:0;
}

function combineRoundTelemetry(rows){
  const total=emptyRoundTelemetry();
  rows.forEach(row=>Object.keys(total).forEach(key=>{total[key]+=row[key];}));
  return total;
}

function summarizeRoundTelemetry(total){
  const rounds=Math.max(1,total.rounds),deaths=Math.max(1,total.deaths),traded=Math.max(1,total.tradedDeaths);
  return {...total,
    kpr:rounded(total.kills/rounds),dpr:rounded(total.deaths/rounds),apr:rounded(total.assists/rounds),
    adr:rounded(total.damage/rounds),kastPercent:rounded(total.kastCredits/rounds*100),
    survivalPercent:rounded(total.survived/rounds*100),savePercent:rounded(total.saved/rounds*100),
    tradedDeathPercent:rounded(total.tradedDeaths/deaths*100),tradeKastCreditPercent:rounded(total.tradeKastCredits/traded*100)};
}

function recordMetricSample(samples,row,rounds){
  samples.rating.push(+row.rating||0);
  samples.kpr.push((row.k||0)/rounds);
  samples.dpr.push((row.d||0)/rounds);
  samples.apr.push((row.a||0)/rounds);
  samples.kast.push((row.kast||0)*100);
  samples.adr.push(+row.adr||0);
}

function summarizeMetricSamples(samples){
  return {
    rating:describe(samples.rating),
    kpr:describe(samples.kpr),
    dpr:describe(samples.dpr),
    apr:describe(samples.apr),
    kastPercent:describe(samples.kast),
    adr:describe(samples.adr)
  };
}

function emptyPlayerAccumulator(teamIndex,playerIndex,card){
  const engine=playerEngine(card);
  const secondaryRole=engine.secundario||engine.combatRole||null;
  const effectiveCombatRole=engine.combatRole||(engine.primario==="IGL"?secondaryRole:engine.primario)||engine.primario;
  return {
    id:rawPlayerId(card),nick:card.nick||engine.nick||engine.nome,teamIndex,playerIndex,
    team:T[teamIndex].nome,role:engine.primario,secondaryRole,
    rolePair:`${engine.primario}/${secondaryRole||"-"}`,combatRole:engine.combatRole,
    effectiveCombatRole,playstyle:engine.playstyle,
    ovr:engine.ovr,realRating:+engine.rating||0,
    maps:0,orientationA:0,rounds:0,kills:0,deaths:0,assists:0,kastRoundWeight:0,adrRoundWeight:0,
    ownDayStrength:[],opponentDayStrength:[],opponents:new Set(),mapCounts:{},samples:emptyMetricSamples(),
    outcomeCounts:Object.fromEntries(OUTCOMES.map(outcome=>[outcome,0])),
    byOutcome:Object.fromEntries(OUTCOMES.map(outcome=>[outcome,emptyMetricSamples()])),
    roundTelemetry:{overall:emptyRoundTelemetry(),
      bySide:Object.fromEntries(SIDES.map(side=>[side,emptyRoundTelemetry()])),
      byBuy:Object.fromEntries(BUY_STATES.map(state=>[state,emptyRoundTelemetry()]))},
    byMap:Object.fromEntries(MAPS.map(map=>[map,emptyMetricSamples()])),
    byOpponentStrengthQuartile:Object.fromEntries(QUARTILES.map(quartile=>[quartile,emptyMetricSamples()]))
  };
}

function metricRates(player){
  return {
    rating:rounded(mean(player.samples.rating)),
    kpr:rounded(player.kills/player.rounds),
    dpr:rounded(player.deaths/player.rounds),
    apr:rounded(player.assists/player.rounds),
    kastPercent:rounded(player.kastRoundWeight/player.rounds),
    adr:rounded(player.adrRoundWeight/player.rounds)
  };
}

function strengthQuartile(value,bounds){
  if(value<=bounds[0])return "Q1";
  if(value<=bounds[1])return "Q2";
  if(value<=bounds[2])return "Q3";
  return "Q4";
}

function rankIds(players,key){
  return players.slice().sort((a,b)=>b[key]-a[key]||compareText(a.id,b.id)).map((player,index)=>[player.id,index+1]);
}

function countInversions(players){
  let inversions=0,pairs=0;
  for(let a=0;a<players.length;a++)for(let b=a+1;b<players.length;b++){
    const realDiff=players[a].realRating-players[b].realRating;
    const simDiff=players[a].simRating-players[b].simRating;
    if(realDiff===0||simDiff===0)continue;
    pairs++;
    if(Math.sign(realDiff)!==Math.sign(simDiff))inversions++;
  }
  return {inversions,pairs,ratePercent:rounded(pairs?inversions/pairs*100:0)};
}

function groupedPlayerSummary(players,key){
  const groups={};
  players.forEach(player=>{
    const name=String(player[key]??"unknown");
    (groups[name]||(groups[name]=[])).push(player);
  });
  return Object.keys(groups).sort(compareText).map(name=>{
    const rows=groups[name];
    const rounds=sum(rows.map(row=>row.exposure.rounds));
    const maps=sum(rows.map(row=>row.exposure.maps));
    const roundWeighted=metric=>rounded(sum(rows.map(row=>row[metric]*row.exposure.rounds))/rounds);
    const roundTelemetry=summarizeRoundTelemetry(combineRoundTelemetry(rows.map(row=>row.roundTelemetry.overall)));
    return {
      group:name,players:rows.length,maps,rounds,aggregation:"player-round-weighted",
      realRating:rounded(mean(rows.map(row=>row.realRating))),
      simRating:rounded(mean(rows.map(row=>row.simRating))),
      ratingDelta:rounded(mean(rows.map(row=>row.ratingDelta))),
      kpr:rounded(sum(rows.map(row=>row.counts.kills))/rounds),
      dpr:rounded(sum(rows.map(row=>row.counts.deaths))/rounds),
      apr:rounded(sum(rows.map(row=>row.counts.assists))/rounds),
      kastPercent:roundWeighted("kastPercent"),
      adr:roundWeighted("adr"),roundTelemetry
    };
  });
}

function groupedRoundStratum(players,key,dimension,value){
  const groups={};
  players.forEach(player=>{
    const name=String(player[key]??"unknown");
    (groups[name]||(groups[name]=[])).push(player);
  });
  return Object.keys(groups).sort(compareText).map(name=>{
    const rows=groups[name];
    return {group:name,players:rows.length,...summarizeRoundTelemetry(combineRoundTelemetry(
      rows.map(player=>player.roundTelemetry[dimension][value])
    ))};
  });
}

function teamTopIndexes(teamIndex){
  return X.TEAMS[teamIndex].jogadores.map((card,index)=>({id:rawPlayerId(card),index,rating:+playerEngine(card).rating||0}))
    .sort((a,b)=>b.rating-a.rating||compareText(a.id,b.id));
}

function recordTopPreservation(teamAcc,teamIndex,stats){
  const expected=teamTopIndexes(teamIndex);
  const actual=stats.map((row,index)=>({id:rawPlayerId(X.TEAMS[teamIndex].jogadores[index]),index,rating:+row.rating||0}))
    .sort((a,b)=>b.rating-a.rating||compareText(a.id,b.id));
  teamAcc.top1Hits+=expected[0].id===actual[0].id?1:0;
  const expectedTop3=new Set(expected.slice(0,3).map(row=>row.id));
  teamAcc.top3Overlap+=actual.slice(0,3).filter(row=>expectedTop3.has(row.id)).length;
}

function recordPlayerSide(accumulators,teamIndex,opponentIndex,stats,rounds,map,orientationA,ownStrength,opponentStrength,quartile,outcome){
  if(!OUTCOMES.includes(outcome))throw new Error(`resultado individual invalido: ${outcome}`);
  stats.forEach((row,playerIndex)=>{
    const id=rawPlayerId(X.TEAMS[teamIndex].jogadores[playerIndex]);
    const player=accumulators.get(id);
    if(!player)throw new Error(`jogador sem acumulador: ${id}`);
    player.maps++;
    player.orientationA+=orientationA?1:0;
    player.rounds+=rounds;
    player.kills+=row.k||0;
    player.deaths+=row.d||0;
    player.assists+=row.a||0;
    player.kastRoundWeight+=(row.kast||0)*100*rounds;
    player.adrRoundWeight+=(+row.adr||0)*rounds;
    player.ownDayStrength.push(ownStrength);
    player.opponentDayStrength.push(opponentStrength);
    player.opponents.add(opponentIndex);
    player.mapCounts[map]=(player.mapCounts[map]||0)+1;
    player.outcomeCounts[outcome]++;
    recordMetricSample(player.samples,row,rounds);
    recordMetricSample(player.byOutcome[outcome],row,rounds);
    recordMetricSample(player.byMap[map],row,rounds);
    recordMetricSample(player.byOpponentStrengthQuartile[quartile],row,rounds);
  });
}

function recordRoundTelemetry(playerAccumulators,telemetry){
  if(!telemetry||telemetry.schemaVersion!==1)throw new Error("telemetria de round ausente ou incompatível");
  telemetry.rounds.forEach(round=>[...round.players.A,...round.players.B].forEach(row=>{
    const player=playerAccumulators.get(row.id);
    if(!player)throw new Error(`telemetria sem acumulador: ${row.id}`);
    if(!SIDES.includes(row.side))throw new Error(`${row.id}: lado inválido ${row.side}`);
    if(!BUY_STATES.includes(row.buy))throw new Error(`${row.id}: compra inválida ${row.buy}`);
    addRoundTelemetry(player.roundTelemetry.overall,row);
    addRoundTelemetry(player.roundTelemetry.bySide[row.side],row);
    addRoundTelemetry(player.roundTelemetry.byBuy[row.buy],row);
  }));
}

function assertDeepCoverage({cycles,pairs,mapCount,playerAccumulators,beforeFingerprint}){
  const expectedMaps=pairs.length*cycles;
  const expectedPlayerMaps=(T.length-1)*cycles;
  const expectedPerMap=expectedPlayerMaps/MAPS.length;
  const poolIds=Object.keys(X.POOL).sort(compareText);
  const teamIds=X.TEAMS.flatMap(team=>team.jogadores.map(rawPlayerId)).sort(compareText);
  if(poolIds.length!==85)throw new Error(`cobertura esperava 85 IDs, recebeu ${poolIds.length}`);
  if(JSON.stringify(poolIds)!==JSON.stringify(teamIds))throw new Error("IDs de POOL e TEAMS divergem");
  if(sum(Object.values(mapCount))!==expectedMaps)throw new Error("total de mapas diverge da agenda");
  MAPS.forEach(map=>{
    if(mapCount[map]!==expectedMaps/MAPS.length)throw new Error(`exposicao global desigual em ${map}`);
  });
  playerAccumulators.forEach(player=>{
    if(player.maps!==expectedPlayerMaps)throw new Error(`${player.id}: ${player.maps} mapas, esperado ${expectedPlayerMaps}`);
    if(player.opponents.size!==T.length-1)throw new Error(`${player.id}: cobertura incompleta de adversarios`);
    if(player.orientationA!==expectedPlayerMaps/2)throw new Error(`${player.id}: exposicao A/B desigual`);
    MAPS.forEach(map=>{
      if(player.mapCounts[map]!==expectedPerMap)throw new Error(`${player.id}: exposicao desigual em ${map}`);
    });
  });
  if(classificationFingerprint()!==beforeFingerprint)throw new Error("a auditoria alterou classificacoes ou atributos");
}

function finalizePlayers(playerAccumulators){
  const players=Array.from(playerAccumulators.values()).map(player=>{
    const rates=metricRates(player);
    return {
      id:player.id,nick:player.nick,teamIndex:player.teamIndex,teamId:X.TEAMS[player.teamIndex].id,
      team:player.team,role:player.role,secondaryRole:player.secondaryRole,
      rolePair:player.rolePair,combatRole:player.combatRole,effectiveCombatRole:player.effectiveCombatRole,
      playstyle:player.playstyle,
      ovr:player.ovr,realRating:player.realRating,simRating:rates.rating,
      ratingDelta:rounded(rates.rating-player.realRating),kpr:rates.kpr,dpr:rates.dpr,apr:rates.apr,
      kastPercent:rates.kastPercent,adr:rates.adr,
      counts:{kills:player.kills,deaths:player.deaths,assists:player.assists},
      exposure:{maps:player.maps,rounds:player.rounds,orientationA:player.orientationA,orientationB:player.maps-player.orientationA,
        outcomes:{...player.outcomeCounts},
        opponents:Array.from(player.opponents).sort((a,b)=>a-b).map(index=>({index,name:T[index].nome})),
        mapsByName:Object.fromEntries(MAPS.map(map=>[map,player.mapCounts[map]||0])),
        meanOwnDayStrength:rounded(mean(player.ownDayStrength)),meanOpponentDayStrength:rounded(mean(player.opponentDayStrength))},
      distributions:summarizeMetricSamples(player.samples),
      byOutcome:Object.fromEntries(OUTCOMES.map(outcome=>[outcome,summarizeMetricSamples(player.byOutcome[outcome])])),
      roundTelemetry:{overall:summarizeRoundTelemetry(player.roundTelemetry.overall),
        bySide:Object.fromEntries(SIDES.map(side=>[side,summarizeRoundTelemetry(player.roundTelemetry.bySide[side])])),
        byBuy:Object.fromEntries(BUY_STATES.map(state=>[state,summarizeRoundTelemetry(player.roundTelemetry.byBuy[state])]))},
      byMap:Object.fromEntries(MAPS.map(map=>[map,summarizeMetricSamples(player.byMap[map])])),
      byOpponentStrengthQuartile:Object.fromEntries(QUARTILES.map(quartile=>[quartile,summarizeMetricSamples(player.byOpponentStrengthQuartile[quartile])]))
    };
  }).sort((a,b)=>compareText(a.id,b.id));
  const realRanks=new Map(rankIds(players,"realRating"));
  const simRanks=new Map(rankIds(players,"simRating"));
  players.forEach(player=>{
    player.realRatingRank=realRanks.get(player.id);
    player.simRatingRank=simRanks.get(player.id);
    player.rankMovement=player.realRatingRank-player.simRatingRank;
  });
  return players;
}

function buildTeamReports(players,teamAccumulators){
  return T.map((team,index)=>{
    const teamPlayers=players.filter(player=>player.teamIndex===index);
    const preservation=teamAccumulators[index];
    return {
      index,id:X.TEAMS[index].id,name:team.nome,effectiveStrength:team.ef,chemistry:team.quim,maps:preservation.maps,
      top1PreservationPercent:rounded(preservation.top1Hits/preservation.maps*100),
      top3OverlapPercent:rounded(preservation.top3Overlap/(preservation.maps*3)*100),
      inversions:countInversions(teamPlayers),
      players:teamPlayers.map(player=>player.id)
    };
  });
}

function buildDeepAuditSync(cycles=DEFAULT_DEEP_CYCLES,options={}){
  if(!Number.isInteger(cycles)||cycles<=0||cycles%MAPS.length!==0){
    throw new Error(`--cycles deve ser multiplo positivo de ${MAPS.length}`);
  }
  if(!options||typeof options!=="object")throw new TypeError("opcoes da auditoria devem formar um objeto");
  if(options.onMap!==undefined&&typeof options.onMap!=="function")throw new TypeError("onMap deve ser uma funcao");
  if(!X.srand)throw new Error("motor nao exporta srand; auditoria deterministica indisponivel");
  const beforeFingerprint=classificationFingerprint();
  const pairs=roundRobinPairs(T.length);
  const strengthValues=T.map(team=>team.ef).slice().sort((a,b)=>a-b);
  const strengthBounds=[quantile(strengthValues,.25),quantile(strengthValues,.5),quantile(strengthValues,.75)];
  const playerAccumulators=new Map();
  X.TEAMS.forEach((team,teamIndex)=>team.jogadores.forEach((card,playerIndex)=>{
    const accumulator=emptyPlayerAccumulator(teamIndex,playerIndex,card);
    if(playerAccumulators.has(accumulator.id))throw new Error(`ID duplicado: ${accumulator.id}`);
    playerAccumulators.set(accumulator.id,accumulator);
  }));
  const teamAccumulators=T.map(()=>({maps:0,top1Hits:0,top3Overlap:0}));
  const globalSamples=emptyMetricSamples();
  const mapCount=Object.fromEntries(MAPS.map(map=>[map,0]));
  const buyStateCounts=Object.fromEntries(BUY_STATES.map(state=>[state,0]));
  let totalRounds=0,totalKills=0,totalDeaths=0,totalAssists=0,totalPlayerRounds=0;

  for(let cycle=0;cycle<cycles;cycle++)pairs.forEach((pair,pairIndex)=>{
    const swapped=cycle%2===1;
    const aIndex=swapped?pair.b:pair.a,bIndex=swapped?pair.a:pair.b;
    const a=T[aIndex],b=T[bIndex];
    const map=MAPS[(pairIndex+cycle)%MAPS.length];
    const seed=seedFor(cycle,pairIndex);
    X.srand(seed);
    const strengthA=X.forcaDoDia(a.ef,a.quim),strengthB=X.forcaDoDia(b.ef,b.quim);
    const result=X.simularMapa(a,b,strengthA,strengthB,map,false,{telemetry:true});
    const rounds=result.totalRounds||1;
    totalRounds+=rounds;
    mapCount[map]++;
    teamAccumulators[aIndex].maps++;
    teamAccumulators[bIndex].maps++;
    recordTopPreservation(teamAccumulators[aIndex],aIndex,result.statsA);
    recordTopPreservation(teamAccumulators[bIndex],bIndex,result.statsB);
    const quartileA=strengthQuartile(b.ef,strengthBounds),quartileB=strengthQuartile(a.ef,strengthBounds);
    const aWon=result.placar[0]>result.placar[1];
    recordPlayerSide(playerAccumulators,aIndex,bIndex,result.statsA,rounds,map,true,strengthA,strengthB,quartileA,aWon?"win":"loss");
    recordPlayerSide(playerAccumulators,bIndex,aIndex,result.statsB,rounds,map,false,strengthB,strengthA,quartileB,aWon?"loss":"win");
    recordRoundTelemetry(playerAccumulators,result.telemetry);
    if(options.onMap)options.onMap({cycle,pairIndex,pairRound:pair.round,seed,map,aIndex,bIndex,strengthA,strengthB,result});
    result.rounds.forEach(round=>{
      [round.buyA,round.buyB].forEach(state=>{
        if(!BUY_STATES.includes(state))throw new Error(`estado de compra desconhecido: ${state}`);
        buyStateCounts[state]++;
      });
    });
    [...result.statsA,...result.statsB].forEach(row=>{
      totalKills+=row.k||0;
      totalDeaths+=row.d||0;
      totalAssists+=row.a||0;
      totalPlayerRounds+=rounds;
      recordMetricSample(globalSamples,row,rounds);
    });
  });

  assertDeepCoverage({cycles,pairs,mapCount,playerAccumulators,beforeFingerprint});
  const players=finalizePlayers(playerAccumulators);
  const teams=buildTeamReports(players,teamAccumulators);
  const ratingPoints=players.map(player=>[player.realRating,player.simRating]);
  const ovrPoints=players.map(player=>[player.ovr,player.simRating]);
  const fit=linearFit(ratingPoints);
  const errors=players.map(player=>player.simRating-player.realRating);
  const totalTop1Hits=sum(teamAccumulators.map(team=>team.top1Hits));
  const totalTop3Overlap=sum(teamAccumulators.map(team=>team.top3Overlap));
  const inversionTotals=teams.reduce((total,team)=>({inversions:total.inversions+team.inversions.inversions,pairs:total.pairs+team.inversions.pairs}),{inversions:0,pairs:0});
  const largestDeltas=players.slice().sort((a,b)=>Math.abs(b.ratingDelta)-Math.abs(a.ratingDelta)||compareText(a.id,b.id)).slice(0,15)
    .map(player=>({id:player.id,nick:player.nick,team:player.team,role:player.role,realRating:player.realRating,
      simRating:player.simRating,delta:player.ratingDelta,realRank:player.realRatingRank,simRank:player.simRatingRank,rankMovement:player.rankMovement}));
  const largestRankMovements=players.slice().sort((a,b)=>Math.abs(b.rankMovement)-Math.abs(a.rankMovement)||compareText(a.id,b.id)).slice(0,15)
    .map(player=>({id:player.id,nick:player.nick,team:player.team,realRank:player.realRatingRank,simRank:player.simRatingRank,
      rankMovement:player.rankMovement,realRating:player.realRating,simRating:player.simRating}));

  const teamRoundSamples=sum(Object.values(buyStateCounts));
  const report={
    schemaVersion:DEEP_SCHEMA_VERSION,
    kind:"prisma-simulator-characterization",
    diagnosticOnly:true,
    passFailThresholds:[],
    method:{
      source:"game.js via bancada/motor.js",rngContract:"mulberry32-v1",baseSeed:DEEP_BASE_SEED,
      cycles,teams:T.length,players:players.length,pairingsPerCycle:pairs.length,maps:pairs.length*cycles,
      mapsPerPlayer:(T.length-1)*cycles,mapRotation:MAPS,orientationPolicy:"odd cycles swap every pairing",
      seedPolicy:"base + imul(cycle + 1, 0x9e3779b1) + imul(pair + 1, 0x85ebca6b)",
      opponentStrengthQuartileBounds:strengthBounds.map(value=>rounded(value))
    },
    coverage:{
      rawIds:players.length,uniqueTeams:T.length,uniqueOpponentsPerPlayer:T.length-1,
      mapCounts:mapCount,classificationFingerprintPreserved:true,equalMapExposure:true,equalOrientationExposure:true
    },
    global:{
      maps:pairs.length*cycles,rounds:totalRounds,playerRounds:totalPlayerRounds,
      totals:{kills:totalKills,deaths:totalDeaths,assists:totalAssists},
      pooledRates:{kpr:rounded(totalKills/totalPlayerRounds),dpr:rounded(totalDeaths/totalPlayerRounds),apr:rounded(totalAssists/totalPlayerRounds)},
      playerMapDistributions:summarizeMetricSamples(globalSamples),
      economy:{
        teamRoundSamples,buyStateCounts,
        buyStatePercent:Object.fromEntries(BUY_STATES.map(state=>[state,rounded(buyStateCounts[state]/teamRoundSamples*100)]))
      },
      calibration:{
        realRatingVsSimRating:{pearson:rounded(pearson(ratingPoints)),spearman:rounded(spearman(ratingPoints)),
          mae:rounded(mean(errors.map(Math.abs))),rmse:rounded(Math.sqrt(mean(errors.map(error=>error**2)))),
          slope:rounded(fit.slope),intercept:rounded(fit.intercept)},
        ovrVsSimRating:{pearson:rounded(pearson(ovrPoints)),spearman:rounded(spearman(ovrPoints))}
      },
      ranking:{
        top1PreservationPercent:rounded(totalTop1Hits/(T.length*(T.length-1)*cycles)*100),
        top3OverlapPercent:rounded(totalTop3Overlap/(T.length*(T.length-1)*cycles*3)*100),
        withinTeamInversions:{inversions:inversionTotals.inversions,pairs:inversionTotals.pairs,
          ratePercent:rounded(inversionTotals.pairs?inversionTotals.inversions/inversionTotals.pairs*100:0)}
      }
    },
    groups:{
      byRole:groupedPlayerSummary(players,"role"),
      byCombatRole:groupedPlayerSummary(players,"effectiveCombatRole"),
      byRolePair:groupedPlayerSummary(players,"rolePair"),
      bySecondaryRole:groupedPlayerSummary(players,"secondaryRole"),
      byRoleSide:Object.fromEntries(SIDES.map(side=>[side,groupedRoundStratum(players,"role","bySide",side)])),
      byRoleBuy:Object.fromEntries(BUY_STATES.map(state=>[state,groupedRoundStratum(players,"role","byBuy",state)])),
      byPlaystyle:groupedPlayerSummary(players,"playstyle"),
      byOvr:groupedPlayerSummary(players,"ovr")
    },
    limitations:[
      "buy states are team-level abstractions; the engine has no individual weapon inventory",
      "save telemetry marks explicit save branches and surviving players, not a preserved weapon",
      "assists do not distinguish damage assists from flash assists",
      "the report characterizes the simulator and is not an IFCS score or a real-data target"
    ],
    anomalies:{largestAbsoluteRatingDeltas:largestDeltas,largestAbsoluteRankMovements:largestRankMovements},
    teams,
    players
  };
  assertDeepReport(report);
  return report;
}

function assertDeepReport(report){
  const expectedPlayers=report.method.players;
  ["byRole","byCombatRole","byRolePair","bySecondaryRole","byPlaystyle","byOvr"].forEach(key=>{
    const covered=sum(report.groups[key].map(group=>group.players));
    if(covered!==expectedPlayers)throw new Error(`${key}: cobertura ${covered}/${expectedPlayers}`);
    const rounds=sum(report.groups[key].map(group=>group.rounds));
    if(rounds!==report.global.playerRounds)throw new Error(`${key}: player-rounds incompletos`);
  });
  SIDES.forEach(side=>{
    const groups=report.groups.byRoleSide[side];
    if(sum(groups.map(group=>group.players))!==expectedPlayers)throw new Error(`${side}: cobertura por role incompleta`);
  });
  BUY_STATES.forEach(state=>{
    const groups=report.groups.byRoleBuy[state];
    if(sum(groups.map(group=>group.players))!==expectedPlayers)throw new Error(`${state}: cobertura por role incompleta`);
    const playerRounds=sum(groups.map(group=>group.rounds));
    if(playerRounds!==report.global.economy.buyStateCounts[state]*5)throw new Error(`${state}: telemetria econômica incompleta`);
  });
  if(report.global.totals.kills!==report.global.totals.deaths)throw new Error("kills e deaths globais divergem");
  if(report.global.economy.teamRoundSamples!==report.global.rounds*2){
    throw new Error("amostra economica diverge de dois times por round");
  }
  report.players.forEach(player=>{
    const outcomes=sum(Object.values(player.exposure.outcomes));
    if(outcomes!==player.exposure.maps)throw new Error(`${player.id}: vitorias/derrotas divergem dos mapas`);
    const outcomeSamples=sum(OUTCOMES.map(outcome=>player.byOutcome[outcome].rating.n));
    if(outcomeSamples!==player.exposure.maps)throw new Error(`${player.id}: distribuicao por resultado incompleta`);
    const overall=player.roundTelemetry.overall;
    if(overall.rounds!==player.exposure.rounds)throw new Error(`${player.id}: telemetria não cobre todos os rounds`);
    if(overall.kills!==player.counts.kills||overall.deaths!==player.counts.deaths||overall.assists!==player.counts.assists){
      throw new Error(`${player.id}: K/D/A da telemetria diverge do mapa`);
    }
    if(Math.abs(overall.kastPercent-player.kastPercent)>.051)throw new Error(`${player.id}: KAST da telemetria diverge do mapa`);
    if(Math.abs(overall.adr-player.adr)>.51)throw new Error(`${player.id}: ADR da telemetria diverge do mapa`);
    if(sum(SIDES.map(side=>player.roundTelemetry.bySide[side].rounds))!==overall.rounds)throw new Error(`${player.id}: lados incompletos`);
    if(sum(BUY_STATES.map(state=>player.roundTelemetry.byBuy[state].rounds))!==overall.rounds)throw new Error(`${player.id}: compras incompletas`);
    if(overall.tradeKastCredits>overall.tradedDeaths)throw new Error(`${player.id}: créditos de trade excedem mortes trocadas`);
  });
}

async function buildDeepAudit(cycles=DEFAULT_DEEP_CYCLES,options={}){
  await loadSampleStatistics();
  return buildDeepAuditSync(cycles,options);
}

function printMetricLine(name,stats){
  console.log(`  ${name.padEnd(8)} media ${stats.mean.toFixed(3).padStart(7)} · mediana ${stats.median.toFixed(3).padStart(7)} · p05 ${stats.p05.toFixed(3).padStart(7)} · p95 ${stats.p95.toFixed(3).padStart(7)}`);
}

function printGroupRows(title,rows){
  console.log(`\n-- ${title} --`);
  rows.forEach(row=>console.log(`  ${row.group.padEnd(18)} n=${String(row.players).padStart(2)} · rating ${row.simRating.toFixed(3)} · KPR ${row.kpr.toFixed(3)} · DPR ${row.dpr.toFixed(3)} · APR ${row.apr.toFixed(3)} · KAST ${row.kastPercent.toFixed(1)}% · ADR ${row.adr.toFixed(1)}`));
}

function printRoleTelemetry(report){
  const bySide=report.groups.byRoleSide;
  console.log("\n-- Sobrevivencia e save por lado --");
  report.groups.byRole.forEach(role=>{
    const ct=bySide.CT.find(row=>row.group===role.group),tr=bySide.TR.find(row=>row.group===role.group);
    console.log(`  ${role.group.padEnd(8)} CT DPR ${ct.dpr.toFixed(3)} · sobrevive ${ct.survivalPercent.toFixed(1)}% · save ${ct.savePercent.toFixed(1)}% | TR DPR ${tr.dpr.toFixed(3)} · sobrevive ${tr.survivalPercent.toFixed(1)}% · save ${tr.savePercent.toFixed(1)}%`);
  });
  console.log("\n-- Mortes trocadas e credito KAST --");
  report.groups.byRole.forEach(role=>{
    const trace=role.roundTelemetry;
    console.log(`  ${role.group.padEnd(8)} mortes trocadas ${trace.tradedDeathPercent.toFixed(1)}% · creditadas no KAST ${trace.tradeKastCreditPercent.toFixed(1)}%`);
  });
}

function printDeepAudit(report){
  const calibration=report.global.calibration.realRatingVsSimRating;
  const ranking=report.global.ranking;
  console.log("AUDITORIA PROFUNDA PRISMA / POLVORA");
  console.log(`${report.method.players} jogadores · ${report.method.teams} times · ${report.method.maps} mapas · ${report.global.rounds} rounds`);
  console.log(`Agenda: ${report.method.cycles} ciclos round-robin · ${report.method.mapsPerPlayer} mapas por jogador · 16 adversarios · 8 mapas equilibrados`);
  console.log(`Cobertura: ${report.coverage.rawIds}/85 IDs · orientacao A/B equilibrada · classificacoes preservadas`);
  console.log("\n-- Distribuicoes por jogador-mapa --");
  const distributions=report.global.playerMapDistributions;
  printMetricLine("Rating",distributions.rating);
  printMetricLine("KPR",distributions.kpr);
  printMetricLine("DPR",distributions.dpr);
  printMetricLine("APR",distributions.apr);
  printMetricLine("KAST %",distributions.kastPercent);
  printMetricLine("ADR",distributions.adr);
  console.log("\n-- Fidelidade ordinal (diagnostico, sem threshold) --");
  console.log(`  rating real x simulado · Pearson ${calibration.pearson.toFixed(3)} · Spearman ${calibration.spearman.toFixed(3)} · MAE ${calibration.mae.toFixed(3)} · RMSE ${calibration.rmse.toFixed(3)}`);
  console.log(`  regressao · sim = ${calibration.intercept.toFixed(3)} + ${calibration.slope.toFixed(3)} × real`);
  console.log(`  top 1 preservado ${ranking.top1PreservationPercent.toFixed(1)}% · overlap top 3 ${ranking.top3OverlapPercent.toFixed(1)}% · inversoes internas ${ranking.withinTeamInversions.inversions}/${ranking.withinTeamInversions.pairs}`);
  const economy=report.global.economy;
  console.log("\n-- Compras (time-rounds) --");
  BUY_STATES.forEach(state=>console.log(`  ${state.padEnd(8)} ${String(economy.buyStateCounts[state]).padStart(6)} · ${economy.buyStatePercent[state].toFixed(1)}%`));
  printGroupRows("Por role primaria",report.groups.byRole);
  printRoleTelemetry(report);
  printGroupRows("Por funcao de combate efetiva",report.groups.byCombatRole);
  printGroupRows("Por par primaria/secundaria",report.groups.byRolePair);
  printGroupRows("Por playstyle",report.groups.byPlaystyle);
  console.log("\n-- Maiores deltas absolutos de rating --");
  report.anomalies.largestAbsoluteRatingDeltas.forEach(row=>console.log(`  ${row.nick.padEnd(12)} ${row.team.padEnd(11)} ${row.role.padEnd(7)} real ${row.realRating.toFixed(2)} · sim ${row.simRating.toFixed(3)} · delta ${row.delta>=0?"+":""}${row.delta.toFixed(3)} · rank ${row.realRank}->${row.simRank}`));
  console.log("\nRelatorio descritivo: nenhuma faixa de aprovacao e nenhuma mudanca de balanceamento.");
  console.log("Use --format json para o detalhamento por ID, mapa, quartil de adversario e time.");
}

function usage(){
  console.log("Uso:");
  console.log("  node bancada/auditoria.js");
  console.log("  node bancada/auditoria.js --deep [--format human|json] [--cycles 8]");
  console.log("\n--cycles deve ser multiplo de 8 para preservar exposicao igual a mapas e lados.");
}

function parseArguments(args){
  if(!args.length)return {mode:"quick",format:"human",cycles:DEFAULT_DEEP_CYCLES};
  if(args.includes("--help")||args.includes("-h"))return {mode:"help",format:"human",cycles:DEFAULT_DEEP_CYCLES};
  let deep=false,format="human",cycles=DEFAULT_DEEP_CYCLES;
  for(let index=0;index<args.length;index++){
    const argument=args[index];
    if(argument==="--deep")deep=true;
    else if(argument==="--json"){deep=true;format="json";}
    else if(argument==="--format")format=args[++index];
    else if(argument.startsWith("--format="))format=argument.slice("--format=".length);
    else if(argument==="--cycles")cycles=Number(args[++index]);
    else if(argument.startsWith("--cycles="))cycles=Number(argument.slice("--cycles=".length));
    else throw new Error(`argumento desconhecido: ${argument}`);
  }
  if(!deep)throw new Error("opcoes do relatorio profundo exigem --deep");
  if(!["human","json"].includes(format))throw new Error(`formato invalido: ${format}`);
  return {mode:"deep",format,cycles};
}

async function main(args=process.argv.slice(2)){
  const options=parseArguments(args);
  if(options.mode==="help")return usage();
  if(options.mode==="quick"){
    const evaluationPath=path.join(__dirname,"..","src","domain","evaluation");
    const pairModuleUrl=pathToFileURL(path.join(evaluationPath,"role-pair-reality.mjs")).href;
    const styleModuleUrl=pathToFileURL(path.join(evaluationPath,"role-style-reality.mjs")).href;
    const [{rolePairReality},{roleStyleReality}]=await Promise.all([import(pairModuleUrl),import(styleModuleUrl)]);
    return runQuickAudit(rolePairReality,roleStyleReality);
  }
  const report=await buildDeepAudit(options.cycles);
  if(options.format==="json")console.log(JSON.stringify(report,null,2));
  else printDeepAudit(report);
}

if(require.main===module){
  main().catch(error=>{
    console.error(`auditoria: ${error.message}`);
    process.exitCode=1;
  });
}

module.exports={buildDeepAudit,parseArguments,runQuickAudit};
