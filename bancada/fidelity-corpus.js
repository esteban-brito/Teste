/* Contrato puro do corpus IFCS. Não baixa demos nem conhece o simulador. */
const crypto=require("crypto");
const path=require("path");
const {URL}=require("url");

const CORPUS_SCHEMA_VERSION="1.0";
const SPLITS=Object.freeze(["calibration","validation","audit"]);
const EXCLUSION_CODES=Object.freeze([
  "forfeit","incomplete","showmatch","corrupt-demo","nonstandard-config",
  "outside-window","not-lan","not-valve-ranked","team-outside-top20","duplicate"
]);
const RARE_MINIMUMS=Object.freeze({
  clutch1v1:400,
  clutch1v2:250,
  clutch1v3:120,
  antiEco:400,
  forceBuy:400,
  postPlant:500
});
const ROLES=Object.freeze(["AWPer","Rifler","Entry","Lurker","Support","IGL"]);
const ROLE_PLAYER_ROUND_MINIMUM=10000;
const PARSER_REQUIRED_EVENTS=Object.freeze([
  "round_freeze_end","round_officially_ended","player_hurt","player_death","bomb_planted"
]);
const PARSER_REQUIRED_PLAYER_PROPS=Object.freeze(["team_clan_name"]);

const finite=value=>typeof value==="number"&&Number.isFinite(value);
const nonNegativeInteger=value=>Number.isInteger(value)&&value>=0;
const positiveInteger=value=>Number.isInteger(value)&&value>0;
const isSha256=value=>typeof value==="string"&&/^[a-f0-9]{64}$/i.test(value)&&!/^0{64}$/.test(value);
const isGitCommit=value=>typeof value==="string"&&/^[a-f0-9]{40}$/i.test(value)&&!/^0{40}$/.test(value);
const isId=value=>typeof value==="string"&&/^[a-z0-9][a-z0-9._-]*$/.test(value);
const isMap=value=>typeof value==="string"&&/^de_[a-z0-9_]+$/.test(value);
const isHttps=value=>{
  if(typeof value!=="string")return false;
  try{return new URL(value).protocol==="https:";}catch{return false;}
};
const isDate=value=>{
  if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.valueOf())&&date.toISOString().slice(0,10)===value;
};
const safeRelativePath=value=>{
  if(typeof value!=="string"||!value||path.isAbsolute(value)||value.includes("\\"))return false;
  const normalized=path.posix.normalize(value);
  return normalized===value&&!normalized.startsWith("../")&&normalized!=="..";
};

function isPossibleMr12Score(teamA,teamB){
  if(!nonNegativeInteger(teamA)||!nonNegativeInteger(teamB)||teamA===teamB)return false;
  const winner=Math.max(teamA,teamB),loser=Math.min(teamA,teamB);
  if(winner===13)return loser<=11;
  if(winner<16||(winner-16)%3!==0)return false;
  const overtimeIndex=(winner-16)/3;
  return loser>=12+3*overtimeIndex&&loser<=14+3*overtimeIndex;
}

function mulberry32(seed){
  let state=seed>>>0||1;
  return ()=>{let t=state+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};
}

function selectAuditMapIds(mapIds,seed,count){
  if(!Array.isArray(mapIds)||new Set(mapIds).size!==mapIds.length||!mapIds.every(isId))throw new Error("IDs inválidos para seleção de auditoria");
  if(!nonNegativeInteger(seed)||!nonNegativeInteger(count)||count>mapIds.length)throw new Error("parâmetros inválidos para seleção de auditoria");
  const random=mulberry32(seed),shuffled=[...mapIds].sort();
  for(let index=shuffled.length-1;index>0;index--){
    const target=Math.floor(random()*(index+1));
    [shuffled[index],shuffled[target]]=[shuffled[target],shuffled[index]];
  }
  return shuffled.slice(0,count);
}

function canonicalize(value){
  if(value===null||typeof value==="string"||typeof value==="boolean")return value;
  if(typeof value==="number"){
    if(!finite(value))throw new Error("JSON canônico não aceita número não finito");
    return value;
  }
  if(Array.isArray(value))return value.map(canonicalize);
  if(typeof value==="object"){
    const out={};
    for(const key of Object.keys(value).sort()){
      if(value[key]!==undefined)out[key]=canonicalize(value[key]);
    }
    return out;
  }
  throw new Error(`tipo não serializável no JSON canônico: ${typeof value}`);
}

const canonicalJson=value=>JSON.stringify(canonicalize(value));
const sha256=value=>crypto.createHash("sha256").update(value).digest("hex");

function manifestPayload(manifest){
  const payload={...manifest};
  delete payload.declaredSha256;
  return payload;
}

const manifestSha256=manifest=>sha256(canonicalJson(manifestPayload(manifest)));
const sealManifest=manifest=>({...manifestPayload(manifest),declaredSha256:manifestSha256(manifest)});

function validateCorpusManifest(manifest){
  const errors=[],blockers=[],warnings=[];
  const error=(code,message,location="$")=>errors.push({code,message,location});
  const block=(code,message,location="$")=>blockers.push({code,message,location});
  const warn=(code,message,location="$")=>warnings.push({code,message,location});

  if(!manifest||typeof manifest!=="object"||Array.isArray(manifest)){
    return {valid:false,officialReady:false,errors:[{code:"manifest.missing",message:"manifesto ausente",location:"$"}],blockers,warnings};
  }

  if(manifest.schemaVersion!==CORPUS_SCHEMA_VERSION)error("schema.version",`schemaVersion deve ser ${CORPUS_SCHEMA_VERSION}`,"$.schemaVersion");
  let computedSha256=null;
  if(!isSha256(manifest.declaredSha256))error("manifest.hash-format","declaredSha256 inválido","$.declaredSha256");
  else{
    try{
      computedSha256=manifestSha256(manifest);
      if(computedSha256!==manifest.declaredSha256)error("manifest.hash-mismatch","conteúdo diverge do hash declarado","$.declaredSha256");
    }catch(cause){error("manifest.canonical-json",cause.message,"$");}
  }
  const target=manifest.target||{};
  if(!isId(target.id))error("target.id","target.id inválido","$.target.id");
  if(target.game!=="Counter-Strike 2")error("target.game","game deve ser Counter-Strike 2","$.target.game");
  if(!isDate(target.startDate)||!isDate(target.endDate)||target.startDate>target.endDate){
    error("target.window","janela temporal inválida","$.target");
  }
  if(target.lanOnly!==true)error("target.lan","população deve ser somente LAN","$.target.lanOnly");
  if(target.valveRankedOnly!==true)error("target.ranked","população deve ser Valve-ranked","$.target.valveRankedOnly");
  if(target.teamRankMax!==20)error("target.rank","teamRankMax deve ser 20","$.target.teamRankMax");
  const activeMaps=Array.isArray(target.activeMaps)?target.activeMaps:[];
  if(activeMaps.length!==7||new Set(activeMaps).size!==activeMaps.length||!activeMaps.every(isMap)){
    error("target.maps","activeMaps deve congelar sete IDs de mapa únicos","$.target.activeMaps");
  }
  if(!isSha256(target.specSha256))error("target.spec-hash","specSha256 inválido","$.target.specSha256");
  const sources=Array.isArray(target.sources)?target.sources:[];
  if(sources.length<2)error("target.sources","registre ao menos regras Valve e elegibilidade VRS","$.target.sources");
  sources.forEach((source,index)=>{
    const location=`$.target.sources[${index}]`;
    if(!isId(source?.id))error("source.id","id de fonte inválido",`${location}.id`);
    if(!isHttps(source?.url))error("source.url","URL HTTPS inválida",`${location}.url`);
    if(!isGitCommit(source?.revision))error("source.revision","revisão Git de 40 hex obrigatória",`${location}.revision`);
    if(!isSha256(source?.sha256))error("source.hash","hash do conteúdo da fonte inválido",`${location}.sha256`);
  });

  const parser=manifest.parser||{};
  if(typeof parser.name!=="string"||!parser.name.trim())error("parser.name","parser ausente","$.parser.name");
  if(typeof parser.version!=="string"||!/^\d+\.\d+\.\d+$/.test(parser.version))error("parser.version","versão semântica do parser inválida","$.parser.version");
  if(typeof parser.backend!=="string"||!parser.backend.trim())error("parser.backend","backend do parser ausente","$.parser.backend");
  if(!isSha256(parser.scriptSha256))error("parser.script-hash","hash do extrator inválido","$.parser.scriptSha256");
  if(!isSha256(parser.optionsSha256))error("parser.options-hash","hash das opções inválido","$.parser.optionsSha256");
  if(!parser.options||typeof parser.options!=="object"||Array.isArray(parser.options))error("parser.options","opções explícitas do parser ausentes","$.parser.options");
  else{
    try{
      if(parser.optionsSha256!==sha256(canonicalJson(parser.options)))error("parser.options-mismatch","optionsSha256 diverge das opções declaradas","$.parser.optionsSha256");
    }catch(cause){error("parser.options-invalid",cause.message,"$.parser.options");}
  }
  const parserOptions=parser.options||{};
  if(!positiveInteger(parserOptions.tickrate))error("parser.tickrate","tickrate deve ser inteiro positivo","$.parser.options.tickrate");
  if(!finite(parserOptions.infernoDuration)||parserOptions.infernoDuration<=0)error("parser.inferno-duration","infernoDuration deve ser positivo","$.parser.options.infernoDuration");
  if(!finite(parserOptions.smokeDuration)||parserOptions.smokeDuration<=0)error("parser.smoke-duration","smokeDuration deve ser positivo","$.parser.options.smokeDuration");
  for(const field of ["events","playerProps","otherProps"]){
    const values=parserOptions[field];
    if(!Array.isArray(values)||!values.every(value=>typeof value==="string"&&value.trim())||new Set(values).size!==values?.length){
      error("parser.option-list",`${field} deve ser uma lista de strings únicas`,`$.parser.options.${field}`);
    }
  }
  if(Array.isArray(parserOptions.events)){
    PARSER_REQUIRED_EVENTS.forEach(event=>{
      if(!parserOptions.events.includes(event))error("parser.required-event",`evento obrigatório ausente: ${event}`,"$.parser.options.events");
    });
  }
  if(Array.isArray(parserOptions.playerProps)){
    PARSER_REQUIRED_PLAYER_PROPS.forEach(prop=>{
      if(!parserOptions.playerProps.includes(prop))error("parser.required-player-prop",`propriedade obrigatória ausente: ${prop}`,"$.parser.options.playerProps");
    });
  }

  const policy=manifest.splitPolicy||{};
  if(policy.primaryUnit!=="event"||policy.secondaryUnit!=="match")error("split.units","split deve usar evento e partida como blocos","$.splitPolicy");
  if(!nonNegativeInteger(policy.seed))error("split.seed","seed inteira não negativa obrigatória","$.splitPolicy.seed");
  const ratios=policy.ratios||{};
  if(!SPLITS.every(split=>finite(ratios[split])&&ratios[split]>0)||Math.abs(SPLITS.reduce((sum,split)=>sum+ratios[split],0)-1)>1e-9){
    error("split.ratios","ratios positivos devem somar 1","$.splitPolicy.ratios");
  }

  const events=Array.isArray(manifest.events)?manifest.events:[];
  const eventById=new Map(),eventCounts=Object.fromEntries(SPLITS.map(split=>[split,0]));
  events.forEach((event,index)=>{
    const location=`$.events[${index}]`;
    if(!isId(event?.id))error("event.id","id de evento inválido",`${location}.id`);
    else if(eventById.has(event.id))error("event.duplicate","id de evento duplicado",`${location}.id`);
    else eventById.set(event.id,event);
    if(typeof event?.name!=="string"||!event.name.trim())error("event.name","nome de evento ausente",`${location}.name`);
    if(!isDate(event?.startDate)||!isDate(event?.endDate)||event.startDate>event.endDate)error("event.window","datas do evento inválidas",location);
    if(isDate(target.startDate)&&isDate(target.endDate)&&(event.startDate<target.startDate||event.endDate>target.endDate))error("event.outside-window","evento fora da janela do alvo",location);
    if(event?.lan!==true)error("event.not-lan","evento precisa ser LAN",`${location}.lan`);
    if(event?.valveRanked!==true)error("event.not-ranked","evento precisa ser Valve-ranked",`${location}.valveRanked`);
    if(!SPLITS.includes(event?.split))error("event.split","split de evento inválido",`${location}.split`);
    else eventCounts[event.split]++;
    if(!isHttps(event?.sourceUrl))error("event.source","fonte verificável do evento ausente",`${location}.sourceUrl`);
    if(!isHttps(event?.rulesUrl))error("event.rules","regras do evento ausentes",`${location}.rulesUrl`);
    if(!isSha256(event?.rulesSha256))error("event.rules-hash","hash das regras do evento inválido",`${location}.rulesSha256`);
  });
  if(events.length<6)block("minimum.events",`corpus possui ${events.length}/6 eventos` ,"$.events");
  SPLITS.forEach(split=>{if(eventCounts[split]===0)block("split.empty",`split ${split} não possui evento`,"$.events");});

  const matches=Array.isArray(manifest.matches)?manifest.matches:[];
  const matchIds=new Set(),mapIds=new Set(),demoHashes=new Set(),validMaps=[];
  const mapCounts=Object.fromEntries(activeMaps.map(map=>[map,0]));
  const splitMapCounts=Object.fromEntries(SPLITS.map(split=>[split,0]));
  const mapSplitCounts=Object.fromEntries(activeMaps.map(map=>[map,Object.fromEntries(SPLITS.map(split=>[split,0]))]));
  matches.forEach((match,matchIndex)=>{
    const location=`$.matches[${matchIndex}]`,event=eventById.get(match?.eventId);
    if(!isId(match?.id))error("match.id","id de partida inválido",`${location}.id`);
    else if(matchIds.has(match.id))error("match.duplicate","id de partida duplicado",`${location}.id`);
    else matchIds.add(match.id);
    if(!event)error("match.event","eventId não encontrado",`${location}.eventId`);
    if(!isDate(match?.date))error("match.date","data da partida inválida",`${location}.date`);
    else if(event&&(match.date<event.startDate||match.date>event.endDate))error("match.event-window","partida fora das datas do evento",`${location}.date`);
    if(![1,3,5].includes(match?.bestOf))error("match.best-of","bestOf deve ser 1, 3 ou 5",`${location}.bestOf`);
    if(!isHttps(match?.officialUrl))error("match.official-source","fonte oficial da partida ausente",`${location}.officialUrl`);
    const teams=Array.isArray(match?.teams)?match.teams:[];
    if(teams.length!==2)error("match.teams","partida deve ter dois times",`${location}.teams`);
    teams.forEach((team,teamIndex)=>{
      const teamLocation=`${location}.teams[${teamIndex}]`;
      if(typeof team?.name!=="string"||!team.name.trim())error("team.name","nome de time ausente",`${teamLocation}.name`);
      if(!positiveInteger(team?.vrsRank)||team.vrsRank>20)error("team.rank","time fora do top 20 VRS",`${teamLocation}.vrsRank`);
      if(!isDate(team?.vrsPublicationDate)||team.vrsPublicationDate>match.date)error("team.rank-date","publicação VRS deve existir até a data da partida",`${teamLocation}.vrsPublicationDate`);
      if(!isHttps(team?.vrsSourceUrl))error("team.rank-source","fonte VRS ausente",`${teamLocation}.vrsSourceUrl`);
      if(team?.demoTeamName!=null&&(typeof team.demoTeamName!=="string"||!team.demoTeamName.trim())){
        error("team.demo-name","demoTeamName precisa ser uma string não vazia",`${teamLocation}.demoTeamName`);
      }
    });
    if(teams.length===2&&teams[0]?.name===teams[1]?.name)error("match.same-team","times da partida devem ser distintos",`${location}.teams`);
    if(teams.length===2&&(teams[0]?.demoTeamName||teams[0]?.name)===(teams[1]?.demoTeamName||teams[1]?.name)){
      error("match.same-demo-team","nomes internos da demo devem identificar dois times distintos",`${location}.teams`);
    }

    const maps=Array.isArray(match?.maps)?match.maps:[];
    if(!maps.length)error("match.maps","partida sem mapas",`${location}.maps`);
    if([1,3,5].includes(match?.bestOf)&&maps.filter(map=>map?.status==="valid").length>match.bestOf){
      error("match.too-many-maps","partida possui mais mapas válidos que o formato permite",`${location}.maps`);
    }
    maps.forEach((map,mapIndex)=>{
      const mapLocation=`${location}.maps[${mapIndex}]`;
      if(!isId(map?.id))error("map.id","id de mapa inválido",`${mapLocation}.id`);
      else if(mapIds.has(map.id))error("map.duplicate","id de mapa duplicado",`${mapLocation}.id`);
      else mapIds.add(map.id);
      if(!["valid","excluded"].includes(map?.status))error("map.status","status deve ser valid ou excluded",`${mapLocation}.status`);
      if(map?.status==="excluded"){
        if(!EXCLUSION_CODES.includes(map.exclusionCode))error("map.exclusion-code","código de exclusão inválido",`${mapLocation}.exclusionCode`);
        if(typeof map.exclusionReason!=="string"||!map.exclusionReason.trim())error("map.exclusion-reason","justificativa de exclusão ausente",`${mapLocation}.exclusionReason`);
        return;
      }
      if(!activeMaps.includes(map?.mapName))error("map.pool","mapa válido fora do pool congelado",`${mapLocation}.mapName`);
      const score=map?.officialScore||{};
      if(!isPossibleMr12Score(score.teamA,score.teamB)){
        error("map.score","placar oficial impossível",`${mapLocation}.officialScore`);
      }
      const demo=map?.demo||{};
      if(!isHttps(demo.sourceUrl))error("demo.source","URL HTTPS da demo ausente",`${mapLocation}.demo.sourceUrl`);
      if(!isDate(demo.acquiredAt))error("demo.acquired-at","data de aquisição inválida",`${mapLocation}.demo.acquiredAt`);
      else if(isDate(match?.date)&&demo.acquiredAt<match.date)error("demo.acquired-before-match","demo não pode ser adquirida antes da partida",`${mapLocation}.demo.acquiredAt`);
      if(!isSha256(demo.sha256))error("demo.hash","hash da demo inválido",`${mapLocation}.demo.sha256`);
      else if(demoHashes.has(demo.sha256))error("demo.duplicate","hash de demo duplicado",`${mapLocation}.demo.sha256`);
      else demoHashes.add(demo.sha256);
      if(!positiveInteger(demo.bytes))error("demo.bytes","tamanho da demo inválido",`${mapLocation}.demo.bytes`);
      if(demo.format!=="dem")error("demo.format","artefato local precisa ser a demo .dem extraída",`${mapLocation}.demo.format`);
      if(!safeRelativePath(demo.localPath))error("demo.path","caminho local deve ser relativo, POSIX e sem travessia",`${mapLocation}.demo.localPath`);
      const parsed=map?.parsed||{};
      if(parsed.demoSha256!==demo.sha256)error("parsed.demo-hash","parser não referencia a demo declarada",`${mapLocation}.parsed.demoSha256`);
      if(parsed.parserVersion!==parser.version)error("parsed.parser-version","versão do parser diverge do manifesto",`${mapLocation}.parsed.parserVersion`);
      if(parsed.mapName!==map.mapName)error("parsed.map","mapa extraído diverge do catálogo",`${mapLocation}.parsed.mapName`);
      if(teams.length===2&&(parsed.teamA!==teams[0]?.name||parsed.teamB!==teams[1]?.name))error("parsed.teams","times extraídos divergem do catálogo",`${mapLocation}.parsed`);
      if(parsed.teamAScore!==score.teamA||parsed.teamBScore!==score.teamB)error("parsed.score","placar extraído diverge do oficial",`${mapLocation}.parsed`);
      if(parsed.roundCount!==score.teamA+score.teamB)error("parsed.rounds","total de rounds diverge do placar",`${mapLocation}.parsed.roundCount`);
      if(parsed.playerCount!==10)error("parsed.players","mapa deve conter dez jogadores",`${mapLocation}.parsed.playerCount`);
      validMaps.push({id:map.id,name:map.mapName,split:event?.split,demo,location:mapLocation});
      if(Object.hasOwn(mapCounts,map.mapName))mapCounts[map.mapName]++;
      if(event&&SPLITS.includes(event.split)){
        splitMapCounts[event.split]++;
        if(Object.hasOwn(mapSplitCounts,map.mapName))mapSplitCounts[map.mapName][event.split]++;
      }
    });
  });

  if(validMaps.length<800)block("minimum.maps",`corpus possui ${validMaps.length}/800 mapas válidos`,"$.matches");
  for(const map of activeMaps){
    if((mapCounts[map]||0)<80)block("minimum.map-stratum",`${map} possui ${mapCounts[map]||0}/80 mapas válidos`,"$.matches");
    SPLITS.forEach(split=>{
      if((mapSplitCounts[map]?.[split]||0)===0)block("split.map-missing",`${map} não aparece no split ${split}`,"$.matches");
    });
  }
  if(validMaps.length){
    const accepted={calibration:[.5,.75],validation:[.1,.3],audit:[.1,.3]};
    SPLITS.forEach(split=>{
      const share=splitMapCounts[split]/validMaps.length,[low,high]=accepted[split];
      if(share<low||share>high)block("split.imbalance",`${split} representa ${(100*share).toFixed(1)}% dos mapas`,"$.matches");
    });
  }

  const opportunities=manifest.metricOpportunities||{};
  for(const [metric,minimum] of Object.entries(RARE_MINIMUMS)){
    if(!nonNegativeInteger(opportunities[metric]))error("opportunity.invalid",`${metric} deve ser inteiro não negativo`, `$.metricOpportunities.${metric}`);
    else if(opportunities[metric]<minimum)block("opportunity.minimum",`${metric} possui ${opportunities[metric]}/${minimum} oportunidades`, `$.metricOpportunities.${metric}`);
  }
  const rolePlayerRounds=opportunities.rolePlayerRounds||{};
  ROLES.forEach(role=>{
    const value=rolePlayerRounds[role],location=`$.metricOpportunities.rolePlayerRounds.${role}`;
    if(!nonNegativeInteger(value))error("opportunity.invalid",`${role} player-rounds deve ser inteiro não negativo`,location);
    else if(value<ROLE_PLAYER_ROUND_MINIMUM)block("opportunity.role-minimum",`${role} possui ${value}/${ROLE_PLAYER_ROUND_MINIMUM} player-rounds`,location);
  });

  const audit=manifest.audit||{},requiredAuditCount=Math.max(30,Math.ceil(validMaps.length*.02));
  if(!nonNegativeInteger(audit.selectionSeed))error("audit.seed","seed de seleção inválida","$.audit.selectionSeed");
  const selected=Array.isArray(audit.selectedMapIds)?audit.selectedMapIds:[];
  if(new Set(selected).size!==selected.length)error("audit.selection-duplicate","seleção de auditoria contém duplicata","$.audit.selectedMapIds");
  const validMapIds=new Set(validMaps.map(map=>map.id));
  selected.forEach((id,index)=>{if(!validMapIds.has(id))error("audit.selection-invalid","auditoria selecionou mapa não válido",`$.audit.selectedMapIds[${index}]`);});
  if(selected.length<requiredAuditCount)block("audit.minimum",`auditoria selecionou ${selected.length}/${requiredAuditCount} mapas`,"$.audit.selectedMapIds");
  const validMapIdList=validMaps.map(map=>map.id);
  if(nonNegativeInteger(audit.selectionSeed)&&validMaps.length>=requiredAuditCount&&validMapIdList.every(isId)&&new Set(validMapIdList).size===validMapIdList.length){
    const expectedSelection=selectAuditMapIds(validMapIdList,audit.selectionSeed,requiredAuditCount);
    if(selected.length!==expectedSelection.length||selected.some((id,index)=>id!==expectedSelection[index])){
      error("audit.selection-mismatch","amostra não corresponde ao sorteio determinístico declarado","$.audit.selectedMapIds");
    }
  }
  const checks=Array.isArray(audit.checks)?audit.checks:[],checkByMap=new Map();
  checks.forEach((check,index)=>{
    const location=`$.audit.checks[${index}]`;
    if(checkByMap.has(check?.mapId))error("audit.check-duplicate","mapa auditado duas vezes",`${location}.mapId`);
    else checkByMap.set(check?.mapId,check);
    if(!selected.includes(check?.mapId))error("audit.check-unselected","checagem não pertence à amostra sorteada",`${location}.mapId`);
    if(!isHttps(check?.officialSourceUrl))error("audit.official-source","fonte oficial da checagem ausente",`${location}.officialSourceUrl`);
    if(typeof check?.checkedBy!=="string"||!check.checkedBy.trim())error("audit.reviewer","responsável pela checagem ausente",`${location}.checkedBy`);
    if(!isDate(check?.checkedAt))error("audit.date","data da checagem inválida",`${location}.checkedAt`);
    for(const field of ["identityMapSideScoreExact","roundsAndWinnersExact","playerKdaExact"]){
      if(check?.[field]!==true)error("audit.exactness",`${field} deve ser comprovado como exato`,`${location}.${field}`);
    }
    if(!["exact","explained"].includes(check?.damageTradeFlashStatus))error("audit.advanced-events","dano/trade/flash sem conclusão auditável",`${location}.damageTradeFlashStatus`);
    if(check?.damageTradeFlashStatus==="explained"&&(typeof check.explanation!=="string"||!check.explanation.trim()))error("audit.explanation","divergência explicada requer justificativa",`${location}.explanation`);
  });
  selected.forEach(id=>{if(!checkByMap.has(id))block("audit.unchecked",`mapa selecionado sem checagem: ${id}`,"$.audit.checks");});

  const holdout=manifest.auditHoldout||{};
  if(holdout.locked!==true||holdout.openedAt!=null)block("holdout.unlocked","holdout de auditoria não está bloqueado","$.auditHoldout");
  if(!isId(holdout.lockId))error("holdout.id","lockId inválido","$.auditHoldout.lockId");
  if(!isSha256(holdout.privateManifestSha256))error("holdout.hash","hash do manifesto privado inválido","$.auditHoldout.privateManifestSha256");
  if(typeof holdout.accessPolicy!=="string"||!holdout.accessPolicy.trim())error("holdout.policy","política de acesso ausente","$.auditHoldout.accessPolicy");

  const expectedRatio={calibration:.6,validation:.2,audit:.2};
  SPLITS.forEach(split=>{
    if(finite(ratios[split])&&Math.abs(ratios[split]-expectedRatio[split])>.000001){
      warn("split.nonstandard-ratio",`${split} diverge do protocolo 60/20/20`,`$.splitPolicy.ratios.${split}`);
    }
  });

  const stats={
    events:events.length,
    matches:matches.length,
    validMaps:validMaps.length,
    excludedMaps:matches.reduce((sum,match)=>sum+(Array.isArray(match?.maps)?match.maps.filter(map=>map?.status==="excluded").length:0),0),
    mapsByName:mapCounts,
    mapsBySplit:splitMapCounts,
    mapsByNameAndSplit:mapSplitCounts,
    requiredAuditCount,
    auditedMaps:checks.length
  };
  if(computedSha256==null){
    try{computedSha256=manifestSha256(manifest);}catch{/* erro de canonicalização já registrado */}
  }
  return {valid:errors.length===0,officialReady:errors.length===0&&blockers.length===0,computedSha256,errors,blockers,warnings,stats};
}

function corpusTemplate(){
  const hash="0".repeat(64),commit="0".repeat(40);
  const options={tickrate:128,infernoDuration:7.03125,smokeDuration:20,events:[...PARSER_REQUIRED_EVENTS,"player_spawn","item_pickup","bomb_defused","bomb_exploded"],playerProps:[...PARSER_REQUIRED_PLAYER_PROPS],otherProps:[]};
  return sealManifest({
    schemaVersion:CORPUS_SCHEMA_VERSION,
    target:{
      id:"preencher-target",game:"Counter-Strike 2",startDate:"2026-01-01",endDate:"2026-12-31",
      lanOnly:true,valveRankedOnly:true,teamRankMax:20,
      activeMaps:["de_preencher_1","de_preencher_2","de_preencher_3","de_preencher_4","de_preencher_5","de_preencher_6","de_preencher_7"],
      specSha256:hash,
      sources:[
        {id:"valve-major-rules",url:"https://github.com/ValveSoftware/counter-strike_rules_and_regs",revision:commit,sha256:hash},
        {id:"valve-vrs",url:"https://github.com/ValveSoftware/counter-strike_regional_standings",revision:commit,sha256:hash}
      ]
    },
    parser:{name:"awpy",version:"2.0.2",backend:"demoparser2",scriptSha256:hash,options,optionsSha256:hash},
    splitPolicy:{primaryUnit:"event",secondaryUnit:"match",seed:20260720,ratios:{calibration:.6,validation:.2,audit:.2}},
    events:[],matches:[],metricOpportunities:{...Object.fromEntries(Object.keys(RARE_MINIMUMS).map(metric=>[metric,0])),rolePlayerRounds:Object.fromEntries(ROLES.map(role=>[role,0]))},
    audit:{selectionSeed:20260720,selectedMapIds:[],checks:[]},
    auditHoldout:{locked:false,lockId:"preencher-lock",privateManifestSha256:hash,accessPolicy:"preencher",openedAt:null}
  });
}

module.exports={
  CORPUS_SCHEMA_VERSION,SPLITS,EXCLUSION_CODES,RARE_MINIMUMS,ROLES,ROLE_PLAYER_ROUND_MINIMUM,PARSER_REQUIRED_EVENTS,PARSER_REQUIRED_PLAYER_PROPS,
  canonicalJson,sha256,manifestSha256,sealManifest,
  validateCorpusManifest,corpusTemplate,safeRelativePath,
  isPossibleMr12Score,selectAuditMapIds
};
