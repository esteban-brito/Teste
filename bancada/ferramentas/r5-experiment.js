/* bancada/ferramentas/r5-experiment.js - captura e compara observacoes pareadas do R5.
   Nao altera o motor: consome a telemetria opcional da auditoria profunda. */
const crypto=require("node:crypto");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {X}=require("../lib/motor");
const {buildDeepAudit}=require("../suites/auditoria");
const {ROOT}=require("../lib/common");

const CAPTURE_SCHEMA_VERSION=1;
const COMPARISON_SCHEMA_VERSION=1;
const DEFAULT_CYCLES=8;
const SIDES=["CT","TR"];
const BUY_STATES=["pistol","eco","force","full"];
let pairedStatisticsPromise=null;

function sha256(value){
  return crypto.createHash("sha256").update(value).digest("hex");
}

function gameSha256(){
  return sha256(fs.readFileSync(path.join(ROOT,"game.js")));
}

function emptySlice(){
  return {rounds:0,kills:0,deaths:0,assists:0,damage:0,tradeKills:0,kastCredits:0,
    survived:0,saved:0,tradedDeaths:0,tradeKastCredits:0,
    openingKills:0,openingDeaths:0,openingAssists:0,deathSequenceTotal:0,deathSequenceCount:0};
}

function emptyPlayerMap(){
  return {overall:emptySlice(),bySide:Object.fromEntries(SIDES.map(side=>[side,emptySlice()])),
    byBuy:Object.fromEntries(BUY_STATES.map(state=>[state,emptySlice()]))};
}

function addRound(slice,row){
  slice.rounds++;
  slice.kills+=row.kills;slice.deaths+=row.deaths;slice.assists+=row.assists;slice.damage+=row.damage;
  slice.tradeKills+=row.tradeKills;slice.kastCredits+=row.kastCredit;
  slice.survived+=row.survived?1:0;slice.saved+=row.saved?1:0;
  slice.tradedDeaths+=row.wasTraded?1:0;slice.tradeKastCredits+=row.kastComponents.traded?1:0;
}

function addEvent(slice,type,event){
  if(type==="killer"&&event.opening)slice.openingKills++;
  if(type==="victim"){
    if(event.opening)slice.openingDeaths++;
    slice.deathSequenceTotal+=event.sequence;slice.deathSequenceCount++;
  }
  if(type==="assist"&&event.opening)slice.openingAssists++;
}

function eventSlices(playerMap,row){
  return [playerMap.overall,playerMap.bySide[row.side],playerMap.byBuy[row.buy]];
}

function aggregateTelemetry(telemetry){
  if(!telemetry||telemetry.schemaVersion!==1)throw new Error("captura R5 exige telemetria schema 1");
  const players=new Map();
  [...telemetry.teams.A.players,...telemetry.teams.B.players].forEach(player=>{
    if(players.has(player.id))throw new Error(`ID repetido na telemetria: ${player.id}`);
    players.set(player.id,emptyPlayerMap());
  });
  telemetry.rounds.forEach(round=>{
    const roundRows=new Map();
    [...round.players.A,...round.players.B].forEach(row=>{
      const aggregate=players.get(row.id);
      if(!aggregate)throw new Error(`jogador desconhecido na telemetria: ${row.id}`);
      addRound(aggregate.overall,row);addRound(aggregate.bySide[row.side],row);addRound(aggregate.byBuy[row.buy],row);
      roundRows.set(row.id,row);
    });
    round.events.forEach(event=>{
      const participants=[["killer",event.killer],["victim",event.victim],["assist",event.assist]];
      participants.forEach(([type,participant])=>{
        if(!participant)return;
        const row=roundRows.get(participant.id),aggregate=players.get(participant.id);
        if(!row||!aggregate)throw new Error(`evento sem player-round: ${participant.id}`);
        eventSlices(aggregate,row).forEach(slice=>addEvent(slice,type,event));
      });
    });
  });
  return players;
}

function effectiveCombatRole(player){
  const secondaryRole=player.secundario||player.combatRole||null;
  return player.combatRole||(player.primario==="IGL"?secondaryRole:player.primario)||player.primario;
}

function captureTeamObservations(context,telemetryKey,statsKey,teamIndex,opponentIndex,orientationA,telemetryByPlayer){
  const telemetry=context.result.telemetry;
  const teamMeta=telemetry.teams[telemetryKey];
  const stats=context.result[statsKey];
  const won=telemetryKey==="A"?context.result.placar[0]>context.result.placar[1]:context.result.placar[1]>context.result.placar[0];
  return teamMeta.players.map((meta,index)=>{
    const player=X.POOL[meta.id];
    if(!player)throw new Error(`captura sem jogador no POOL: ${meta.id}`);
    const aggregate=telemetryByPlayer.get(meta.id),row=stats[index];
    if(!aggregate||!row)throw new Error(`captura incompleta: ${meta.id}`);
    if(aggregate.overall.rounds!==context.result.totalRounds)throw new Error(`${meta.id}: rounds da captura divergentes`);
    if(aggregate.overall.kills!==row.k||aggregate.overall.deaths!==row.d||aggregate.overall.assists!==row.a){
      throw new Error(`${meta.id}: K/D/A da captura divergente`);
    }
    const blockKey=`${context.cycle}:${context.pairIndex}`;
    const secondaryRole=player.secundario||player.combatRole||null;
    return {
      key:`${blockKey}:${meta.id}`,blockKey,cycle:context.cycle,pairIndex:context.pairIndex,pairRound:context.pairRound,
      seed:context.seed,map:context.map,playerId:meta.id,teamId:X.TEAMS[teamIndex].id,
      opponentId:X.TEAMS[opponentIndex].id,orientationA,won,
      role:player.primario,secondaryRole,rolePair:`${player.primario}/${secondaryRole||"-"}`,
      effectiveCombatRole:effectiveCombatRole(player),playstyle:player.playstyle,ovr:player.ovr,realRating:player.rating,
      rating:row.rating,overall:aggregate.overall,bySide:aggregate.bySide,byBuy:aggregate.byBuy
    };
  });
}

function captureMap(context){
  const telemetryByPlayer=aggregateTelemetry(context.result.telemetry);
  return [
    ...captureTeamObservations(context,"A","statsA",context.aIndex,context.bIndex,true,telemetryByPlayer),
    ...captureTeamObservations(context,"B","statsB",context.bIndex,context.aIndex,false,telemetryByPlayer)
  ];
}

function assertCapture(capture){
  if(capture.schemaVersion!==CAPTURE_SCHEMA_VERSION)throw new Error("schema de captura R5 incompatível");
  const expected=capture.audit.method.maps*10;
  if(capture.observations.length!==expected)throw new Error(`captura possui ${capture.observations.length}/${expected} observacoes`);
  const keys=new Set(capture.observations.map(row=>row.key));
  if(keys.size!==capture.observations.length)throw new Error("captura possui chaves duplicadas");
  const blocks=new Set(capture.observations.map(row=>row.blockKey));
  if(blocks.size!==capture.audit.method.maps)throw new Error("captura possui cobertura incompleta de mapas");
  capture.observations.forEach(row=>{
    if(!row.playerId||!row.teamId||!row.opponentId)throw new Error(`identidade incompleta em ${row.key}`);
    if(row.overall.rounds<=0)throw new Error(`exposicao vazia em ${row.key}`);
    if(SIDES.some(side=>row.bySide[side].rounds<=0))throw new Error(`lado ausente em ${row.key}`);
    const buyRounds=BUY_STATES.reduce((total,state)=>total+row.byBuy[state].rounds,0);
    if(buyRounds!==row.overall.rounds)throw new Error(`compras incompletas em ${row.key}`);
  });
}

async function captureExperiment(cycles=DEFAULT_CYCLES){
  const observations=[];
  const report=await buildDeepAudit(cycles,{onMap:context=>observations.push(...captureMap(context))});
  const capture={
    schemaVersion:CAPTURE_SCHEMA_VERSION,kind:"r5-paired-player-map-capture",diagnosticOnly:true,
    engine:{gameSha256:gameSha256(),auditSha256:sha256(JSON.stringify(report)),auditSchemaVersion:report.schemaVersion,
      telemetrySchemaVersion:1},
    audit:{method:report.method,coverage:report.coverage,global:report.global},
    observations
  };
  assertCapture(capture);
  return capture;
}

const ratio=(numerator,denominator,scale=1)=>denominator?numerator/denominator*scale:0;
const sliceMetrics=(prefix,getSlice)=>[
  {key:`${prefix}kpr`,value:row=>ratio(getSlice(row).kills,getSlice(row).rounds)},
  {key:`${prefix}dpr`,value:row=>ratio(getSlice(row).deaths,getSlice(row).rounds)},
  {key:`${prefix}apr`,value:row=>ratio(getSlice(row).assists,getSlice(row).rounds)},
  {key:`${prefix}adr`,value:row=>ratio(getSlice(row).damage,getSlice(row).rounds)},
  {key:`${prefix}kastPercent`,value:row=>ratio(getSlice(row).kastCredits,getSlice(row).rounds,100)},
  {key:`${prefix}survivalPercent`,value:row=>ratio(getSlice(row).survived,getSlice(row).rounds,100)},
  {key:`${prefix}savePercent`,value:row=>ratio(getSlice(row).saved,getSlice(row).rounds,100)}
];
const METRICS=[
  {key:"rating",value:row=>row.rating},
  ...sliceMetrics("",row=>row.overall),
  {key:"tradedDeathPercent",value:row=>ratio(row.overall.tradedDeaths,row.overall.deaths,100)},
  {key:"tradeKastCreditPercent",value:row=>ratio(row.overall.tradeKastCredits,row.overall.tradedDeaths,100)},
  {key:"tradeKillsPerRound",value:row=>ratio(row.overall.tradeKills,row.overall.rounds)},
  {key:"openingKillsPerRound",value:row=>ratio(row.overall.openingKills,row.overall.rounds)},
  {key:"openingDeathsPerRound",value:row=>ratio(row.overall.openingDeaths,row.overall.rounds)},
  {key:"meanDeathSequence",value:row=>ratio(row.overall.deathSequenceTotal,row.overall.deathSequenceCount)},
  ...sliceMetrics("ct.",row=>row.bySide.CT),...sliceMetrics("tr.",row=>row.bySide.TR)
];

async function pairedStatistics(){
  if(!pairedStatisticsPromise){
    const moduleUrl=pathToFileURL(path.join(ROOT,"src","domain","statistics","paired-comparison.mjs")).href;
    pairedStatisticsPromise=import(moduleUrl);
  }
  return pairedStatisticsPromise;
}

const STABLE_FIELDS=["playerId","teamId","opponentId","orientationA","role","secondaryRole","rolePair",
  "effectiveCombatRole","playstyle","ovr","realRating","map","seed","cycle","pairIndex","pairRound"];

function assertComparable(before,after){
  assertCapture(before);assertCapture(after);
  if(before.audit.method.cycles!==after.audit.method.cycles)throw new Error("capturas usam ciclos diferentes");
  if(before.audit.method.seedPolicy!==after.audit.method.seedPolicy)throw new Error("capturas usam politicas de seed diferentes");
  const afterByKey=new Map(after.observations.map(row=>[row.key,row]));
  before.observations.forEach(row=>{
    const candidate=afterByKey.get(row.key);
    if(!candidate)throw new Error(`candidato sem observacao: ${row.key}`);
    STABLE_FIELDS.forEach(field=>{
      if(row[field]!==candidate[field])throw new Error(`contexto ${field} diverge em ${row.key}`);
    });
  });
}

async function compareRows(beforeRows,afterRows){
  const {comparePairedMetric}=await pairedStatistics();
  return Object.fromEntries(METRICS.map(metric=>[metric.key,comparePairedMetric(beforeRows,afterRows,{
    keyOf:row=>row.key,blockOf:row=>row.blockKey,valueOf:metric.value
  })]));
}

function groupedRows(rows,key){
  const groups={};
  rows.forEach(row=>{const name=String(row[key]??"unknown");(groups[name]||(groups[name]=[])).push(row);});
  return groups;
}

async function compareGroups(before,after,key){
  const beforeGroups=groupedRows(before,key),afterGroups=groupedRows(after,key);
  const names=Object.keys(beforeGroups).sort();
  if(JSON.stringify(names)!==JSON.stringify(Object.keys(afterGroups).sort()))throw new Error(`${key}: grupos divergentes`);
  return Object.fromEntries(await Promise.all(names.map(async name=>[name,await compareRows(beforeGroups[name],afterGroups[name])])));
}

async function compareCaptures(before,after){
  assertComparable(before,after);
  return {
    schemaVersion:COMPARISON_SCHEMA_VERSION,kind:"r5-paired-comparison",diagnosticOnly:true,passFailThresholds:[],
    method:{pairingUnit:"player-map",uncertaintyBlock:"simulated-map",metrics:METRICS.map(metric=>metric.key),
      cycles:before.audit.method.cycles,maps:before.audit.method.maps,observations:before.observations.length},
    engines:{before:before.engine,after:after.engine},
    overall:await compareRows(before.observations,after.observations),
    byRole:await compareGroups(before.observations,after.observations,"role"),
    byEffectiveCombatRole:await compareGroups(before.observations,after.observations,"effectiveCombatRole")
  };
}

function comparisonHasZeroDeltas(comparison){
  const metricGroups=[comparison.overall,...Object.values(comparison.byRole),...Object.values(comparison.byEffectiveCombatRole)];
  return metricGroups.every(metrics=>Object.values(metrics).every(metric=>
    metric.observationMeanDelta===0&&metric.blockMeanDelta===0&&metric.maxAbsoluteObservationDelta===0&&
    (!metric.blockDeltaCi95||metric.blockDeltaCi95.every(value=>value===0))));
}

function readJson(file){return JSON.parse(fs.readFileSync(path.resolve(file),"utf8"));}
function writeJson(file,value){
  const resolved=path.resolve(file);
  fs.mkdirSync(path.dirname(resolved),{recursive:true});
  const descriptor=fs.openSync(resolved,"wx");
  try{fs.writeFileSync(descriptor,JSON.stringify(value));}finally{fs.closeSync(descriptor);}
  return resolved;
}

function option(args,name){const index=args.indexOf(name);return index>=0?args[index+1]:null;}
function cyclesFrom(args){const raw=option(args,"--cycles");return raw===null?DEFAULT_CYCLES:Number(raw);}

function printComparison(comparison){
  console.log(`R5 pareado · ${comparison.method.maps} mapas · ${comparison.method.observations} player-maps`);
  ["rating","kpr","dpr","apr","kastPercent","adr","survivalPercent","savePercent"].forEach(key=>{
    const metric=comparison.overall[key];
    console.log(`  ${key.padEnd(18)} ${metric.before.mean.toFixed(4)} -> ${metric.after.mean.toFixed(4)} · delta ${metric.observationMeanDelta.toFixed(4)}`);
  });
}

async function main(args=process.argv.slice(2)){
  const command=args[0];
  if(command==="capture"){
    const output=option(args,"--output");
    if(!output)throw new Error("capture exige --output <arquivo novo>");
    const capture=await captureExperiment(cyclesFrom(args));
    console.log(`captura R5: ${writeJson(output,capture)} · ${capture.observations.length} observacoes`);
    return;
  }
  if(command==="compare"){
    const beforeFile=option(args,"--before"),afterFile=option(args,"--after"),output=option(args,"--output");
    if(!beforeFile||!afterFile)throw new Error("compare exige --before e --after");
    const comparison=await compareCaptures(readJson(beforeFile),readJson(afterFile));
    if(output)console.log(`comparacao R5: ${writeJson(output,comparison)}`);
    else printComparison(comparison);
    return;
  }
  console.log("Uso:\n  node bancada/ferramentas/r5-experiment.js capture --cycles 8 --output <novo.json>\n  node bancada/ferramentas/r5-experiment.js compare --before <baseline.json> --after <candidate.json> [--output <novo.json>]");
}

if(require.main===module)main().catch(error=>{console.error(`r5-experiment: ${error.message}`);process.exitCode=1;});

module.exports={captureExperiment,compareCaptures,comparisonHasZeroDeltas,METRICS};
