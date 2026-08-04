/* R5.8: decompõe o rating pós-eventos usando somente a telemetria pública do
   simulador. Não altera o motor nem usa o holdout de auditoria para tuning. */
const assert=require("node:assert/strict");
const {X,T}=require("../lib/motor");
const {mean,scheduledMatch}=require("../lib/common");

const N=+(process.env.N||400);
const MAPS=9;
const PRIOR={ref:1.16,per:.45,min:-.18,max:.27};
const COMPONENT_KEYS=["base","economyAdjustedKills","survival","kast","multikill","swing","opening","damage","trade","prior","system"];

function correlation(points,valueOf){
  const xs=points.map(point=>point.real),ys=points.map(valueOf),xm=mean(xs),ym=mean(ys);
  const covariance=mean(points.map((point,index)=>(point.real-xm)*(ys[index]-ym)));
  const sx=Math.sqrt(mean(xs.map(value=>(value-xm)**2))),sy=Math.sqrt(mean(ys.map(value=>(value-ym)**2)));
  return sx&&sy?covariance/(sx*sy):0;
}

function metrics(points,valueOf){
  const errors=points.map(point=>valueOf(point)-point.real);
  return {
    correlation:correlation(points,valueOf),
    mae:mean(errors.map(Math.abs)),
    rmse:Math.sqrt(mean(errors.map(error=>error**2)))
  };
}

function emptyEvent(){
  return {kills:[],mortes:[],roundsKAST:0,multi:{},opK:0,opD:0,dmg:0,tradeK:0};
}

function rebuildEvents(telemetry){
  const output={A:Array.from({length:5},emptyEvent),B:Array.from({length:5},emptyEvent)};
  telemetry.rounds.forEach(round=>{
    const alive={A:5,B:5},roundKills={A:[0,0,0,0,0],B:[0,0,0,0,0]};
    round.events.forEach(event=>{
      assert.equal(event.type,"kill","telemetria contém evento desconhecido");
      const killerTeam=event.killer.team,victimTeam=event.victim.team;
      const killer=output[killerTeam][event.killer.index],victim=output[victimTeam][event.victim.index];
      killer.kills.push({
        estadoMeu:alive[killerTeam],estadoInim:alive[victimTeam],
        buyMatador:event.killer.buy,buyVitima:event.victim.buy,
        roundGanho:killerTeam===round.result.winner
      });
      roundKills[killerTeam][event.killer.index]++;
      victim.mortes.push({estadoMeu:alive[victimTeam],estadoInim:alive[killerTeam]});
      alive[victimTeam]--;
      if(event.opening){killer.opK++;victim.opD++;}
    });
    for(const side of ["A","B"]){
      round.players[side].forEach((player,index)=>{
        const event=output[side][index],kills=roundKills[side][index];
        event.dmg+=player.damage;
        event.tradeK+=player.tradeKills;
        event.roundsKAST+=player.kastCredit;
        if(kills>=2)event.multi[kills]=(event.multi[kills]||0)+1;
      });
    }
  });
  return output;
}

function sumComponents(components){
  return components.base+components.economyAdjustedKills+components.survival+components.kast+
    components.multikill+components.swing+components.opening+components.damage+components.trade+
    components.prior+components.system;
}

function componentRows(game,a,b){
  const events=rebuildEvents(game.telemetry),cards={A:a.jogadores,B:b.jogadores},stats={A:game.statsA,B:game.statsB};
  return Object.fromEntries(["A","B"].map(side=>[side,cards[side].map((card,index)=>{
    const engine=card._eng||card,profile=X.combatProfile(card);
    const input={...events[side][index],totalRounds:game.totalRounds,impacto:profile.ratingImpact,
      prim:profile.primaryRole,ovr:card.ovr??engine.ovr??16,ratingBase:engine.rating};
    const components=JSON.parse(JSON.stringify(X.fallenAngelsComponents(input)));
    const total=sumComponents(components),observed=stats[side][index].rating;
    assert.ok(Math.abs(+total.toFixed(2)-observed)<1e-12,
      `${engine.id}: rating reconstruído ${total.toFixed(2)} divergiu de ${observed.toFixed(2)}`);
    return {components,total,kpr:input.kills.length/game.totalRounds,dpr:input.mortes.length/game.totalRounds,
      kast:input.roundsKAST/game.totalRounds,adr:input.dmg/game.totalRounds};
  })]));
}

function initPlayers(){
  const players={};
  T.forEach((team,teamIndex)=>team.jogadores.forEach((card,playerIndex)=>{
    const engine=card._eng||card,key=`${teamIndex}:${playerIndex}`;
    players[key]={key,id:engine.id,nick:engine.nick,team:team.nome,role:engine.primario,real:engine.rating,maps:[]};
  }));
  return players;
}

function collect(players){
  if(X.srand)X.srand(1337);
  for(let campaign=0;campaign<N;campaign++){
    X.sortearFormaCampanha(T);
    T.forEach((team,teamIndex)=>{
      for(let map=0;map<MAPS;map++){
        const {a,b}=scheduledMatch(T,teamIndex,campaign*MAPS+map);
        const game=X.simularMapa(a,b,X.forcaDoDia(a.ef,a.quim),X.forcaDoDia(b.ef,b.quim),undefined,false,{telemetry:true});
        const side=a===team?"A":"B",rows=componentRows(game,a,b)[side];
        rows.forEach((row,index)=>players[`${teamIndex}:${index}`].maps.push(row));
      }
    });
  }
}

function hashKey(value){
  let hash=2166136261^20260723;
  for(const char of value){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return hash>>>0;
}

function split(points){
  const ordered=[...points].sort((a,b)=>hashKey(a.key)-hashKey(b.key)||a.key.localeCompare(b.key));
  const calibrationSize=Math.floor(points.length*.6),validationSize=Math.floor(points.length*.2);
  return {
    calibration:ordered.slice(0,calibrationSize),
    validation:ordered.slice(calibrationSize,calibrationSize+validationSize),
    audit:ordered.slice(calibrationSize+validationSize)
  };
}

function priorFor(real,coefficient){
  return Math.max(PRIOR.min,Math.min(PRIOR.max,(real-PRIOR.ref)*coefficient));
}

function fitPrior(points){
  let best={coefficient:0,rmse:Infinity};
  for(let step=0;step<=1200;step++){
    const coefficient=step/1000;
    const result=metrics(points,point=>point.events+priorFor(point.real,coefficient));
    if(result.rmse<best.rmse)best={coefficient,rmse:result.rmse};
  }
  return best.coefficient;
}

function fixed(value,digits=4){return value.toFixed(digits);}
function printMetrics(label,result){
  console.log(`  ${label.padEnd(25)} r ${fixed(result.correlation,3)} · MAE ${fixed(result.mae,4)} · RMSE ${fixed(result.rmse,4)}`);
}

const players=initPlayers();
collect(players);
const points=Object.values(players).map(player=>{
  assert.equal(player.maps.length,N*MAPS,`${player.id}: cobertura incompleta`);
  const components=Object.fromEntries(COMPONENT_KEYS.map(key=>[key,mean(player.maps.map(map=>map.components[key]))]));
  const total=mean(player.maps.map(map=>map.total));
  assert.ok(Math.abs(components.prior-priorFor(player.real,PRIOR.per))<1e-12,
    `${player.id}: configuração congelada do prior divergiu do motor`);
  return {...player,components,total,events:total-components.prior,
    kpr:mean(player.maps.map(map=>map.kpr)),dpr:mean(player.maps.map(map=>map.dpr)),
    kast:mean(player.maps.map(map=>map.kast)),adr:mean(player.maps.map(map=>map.adr))};
});
const groups=split(points),candidate=fitPrior(groups.calibration);

console.log(`— R5.8: COMPONENTES DO RATING (${N*MAPS*17} mapas-alvo · ${points.length} jogadores) —`);
console.log("  parcela                    média      dp entre jogadores   r com rating real");
COMPONENT_KEYS.forEach(key=>{
  const values=points.map(point=>point.components[key]),average=mean(values);
  const deviation=Math.sqrt(mean(values.map(value=>(value-average)**2)));
  console.log(`  ${key.padEnd(26)} ${fixed(average).padStart(8)}   ${fixed(deviation).padStart(8)}             ${fixed(correlation(points,point=>point.components[key]),3).padStart(6)}`);
});
console.log("\nDiagnóstico global:");
printMetrics("eventos sem prior",metrics(points,point=>point.events));
printMetrics("rating atual",metrics(points,point=>point.total));
console.log(`  prior atual ${PRIOR.per.toFixed(3)} · candidato ajustado só na calibração ${candidate.toFixed(3)}`);
console.log("\nCalibração (51 jogadores):");
printMetrics("atual",metrics(groups.calibration,point=>point.total));
printMetrics("candidato",metrics(groups.calibration,point=>point.events+priorFor(point.real,candidate)));
console.log("Validação (17 jogadores):");
printMetrics("atual",metrics(groups.validation,point=>point.total));
printMetrics("candidato",metrics(groups.validation,point=>point.events+priorFor(point.real,candidate)));
console.log(`Holdout de auditoria: ${groups.audit.length} jogadores selados; candidato não reportado.`);

console.log("\nMaiores resíduos atuais:");
[...points].sort((a,b)=>Math.abs(b.total-b.real)-Math.abs(a.total-a.real)).slice(0,8).forEach(point=>{
  console.log(`  ${(point.nick+" / "+point.team).padEnd(28)} real ${point.real.toFixed(2)} · sim ${point.total.toFixed(3)} · KPR/DPR ${point.kpr.toFixed(3)}/${point.dpr.toFixed(3)} · KAST ${(100*point.kast).toFixed(1)} · ADR ${point.adr.toFixed(1)} · eventos ${point.events.toFixed(3)} · prior ${point.components.prior.toFixed(3)} · erro ${(point.total-point.real).toFixed(3)}`);
});
