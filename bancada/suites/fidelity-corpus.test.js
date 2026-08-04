/* Fixtures sintéticas do contrato de corpus IFCS. */
const assert=require("assert/strict");
const C=require("../lib/fidelity-corpus");
const {okMark}=require("../lib/common");

let failures=0;
function check(label,fn){
  try{fn();console.log(`  ${okMark(true)} ${label}`);}
  catch(error){failures++;console.log(`  ${okMark(false)} ${label}: ${error.message}`);}
}

const digest=value=>C.sha256(String(value));
const sourceUrl="https://github.com/ValveSoftware/counter-strike_rules_and_regs";
const vrsUrl="https://github.com/ValveSoftware/counter-strike_regional_standings";
const maps=["de_ancient","de_anubis","de_dust2","de_inferno","de_mirage","de_nuke","de_train"];

function buildManifest(mapTotal=805){
  const parserOptions={tickrate:128,infernoDuration:7.03125,smokeDuration:20,events:[...C.PARSER_REQUIRED_EVENTS],playerProps:[...C.PARSER_REQUIRED_PLAYER_PROPS],otherProps:[]};
  const splits=["calibration","calibration","calibration","calibration","validation","audit"];
  const events=splits.map((split,index)=>({
    id:`event-${index+1}`,name:`Event ${index+1}`,startDate:`2026-0${index+1}-01`,endDate:`2026-0${index+1}-28`,
    lan:true,valveRanked:true,split,sourceUrl,rulesUrl:sourceUrl,rulesSha256:digest(`rules-${index}`)
  }));
  const matches=Array.from({length:mapTotal},(_,index)=>{
    const eventIndex=index%events.length,event=events[eventIndex],mapName=maps[index%maps.length],id=`map-${String(index).padStart(4,"0")}`;
    const demoSha256=digest(`demo-${index}`);
    return {
      id:`match-${String(index).padStart(4,"0")}`,eventId:event.id,date:event.startDate,bestOf:1,officialUrl:sourceUrl,
      teams:[
        {name:`Alpha ${index}`,vrsRank:1,vrsPublicationDate:"2025-12-01",vrsSourceUrl:vrsUrl},
        {name:`Beta ${index}`,vrsRank:2,vrsPublicationDate:"2025-12-01",vrsSourceUrl:vrsUrl}
      ],
      maps:[{
        id,mapName,status:"valid",officialScore:{teamA:13,teamB:8},
        demo:{sourceUrl,acquiredAt:"2026-07-20",sha256:demoSha256,bytes:1000+index,format:"dem",localPath:`raw/${id}.dem`},
        parsed:{demoSha256,parserVersion:"2.0.2",mapName,teamA:`Alpha ${index}`,teamB:`Beta ${index}`,teamAScore:13,teamBScore:8,roundCount:21,playerCount:10}
      }]
    };
  });
  const validIds=matches.flatMap(match=>match.maps.map(map=>map.id));
  const selectedMapIds=C.selectAuditMapIds(validIds,9,Math.max(30,Math.ceil(validIds.length*.02)));
  const checks=selectedMapIds.map(mapId=>({
    mapId,officialSourceUrl:sourceUrl,checkedBy:"fixture",checkedAt:"2026-07-20",
    identityMapSideScoreExact:true,roundsAndWinnersExact:true,playerKdaExact:true,damageTradeFlashStatus:"exact"
  }));
  return C.sealManifest({
    schemaVersion:"1.0",
    target:{
      id:"cs2-elite-lan-fixture",game:"Counter-Strike 2",startDate:"2026-01-01",endDate:"2026-12-31",
      lanOnly:true,valveRankedOnly:true,teamRankMax:20,activeMaps:maps,specSha256:digest("spec"),
      sources:[
        {id:"valve-rules",url:sourceUrl,revision:"a".repeat(40),sha256:digest("rules")},
        {id:"valve-vrs",url:vrsUrl,revision:"b".repeat(40),sha256:digest("vrs")}
      ]
    },
    parser:{name:"awpy",version:"2.0.2",backend:"demoparser2",scriptSha256:digest("extractor"),options:parserOptions,optionsSha256:C.sha256(C.canonicalJson(parserOptions))},
    splitPolicy:{primaryUnit:"event",secondaryUnit:"match",seed:7,ratios:{calibration:.6,validation:.2,audit:.2}},
    events,matches,
    metricOpportunities:{clutch1v1:400,clutch1v2:250,clutch1v3:120,antiEco:400,forceBuy:400,postPlant:500,rolePlayerRounds:Object.fromEntries(C.ROLES.map(role=>[role,10000]))},
    audit:{selectionSeed:9,selectedMapIds,checks},
    auditHoldout:{locked:true,lockId:"audit-fixture",privateManifestSha256:digest("private"),accessPolicy:"somente release",openedAt:null}
  });
}

function reseal(manifest,mutate){
  const copy=JSON.parse(JSON.stringify(manifest));mutate(copy);return C.sealManifest(copy);
}

console.log("— IFCS: CORPUS E PROVENIÊNCIA —");

check("JSON canônico independe da ordem das chaves",()=>{
  assert.equal(C.canonicalJson({b:2,a:{d:4,c:3}}),C.canonicalJson({a:{c:3,d:4},b:2}));
});

check("manifesto completo fica pronto para nota oficial",()=>{
  const report=C.validateCorpusManifest(buildManifest());
  assert.equal(report.valid,true,JSON.stringify(report.errors.slice(0,3)));
  assert.equal(report.officialReady,true,JSON.stringify(report.blockers.slice(0,3)));
  assert.equal(report.stats.validMaps,805);assert.equal(report.stats.events,6);
});

check("alteração posterior ao selo é detectada",()=>{
  const manifest=buildManifest();manifest.matches[0].maps[0].officialScore.teamA=14;
  const report=C.validateCorpusManifest(manifest);
  assert.ok(report.errors.some(issue=>issue.code==="manifest.hash-mismatch"));
});

check("corpus parcial pode ser estruturalmente válido, mas não oficial",()=>{
  const report=C.validateCorpusManifest(buildManifest(70));
  assert.equal(report.valid,true);assert.equal(report.officialReady,false);
  assert.ok(report.blockers.some(issue=>issue.code==="minimum.maps"));
});

check("cada mapa ativo exige ao menos 80 observações",()=>{
  const manifest=reseal(buildManifest(),copy=>copy.target.activeMaps[6]="de_overpass");
  const report=C.validateCorpusManifest(manifest);
  assert.ok(report.blockers.some(issue=>issue.code==="minimum.map-stratum"&&issue.message.includes("de_overpass")));
});

check("mapa fora do pool congelado é rejeitado",()=>{
  const manifest=reseal(buildManifest(),copy=>copy.matches[0].maps[0].mapName="de_cache");
  const report=C.validateCorpusManifest(manifest);
  assert.ok(report.errors.some(issue=>issue.code==="map.pool"));
});

check("travessia de diretório na demo é rejeitada",()=>{
  const manifest=reseal(buildManifest(),copy=>copy.matches[0].maps[0].demo.localPath="../segredo.dem");
  const report=C.validateCorpusManifest(manifest);
  assert.ok(report.errors.some(issue=>issue.code==="demo.path"));
});

check("divergência de versão do parser é rejeitada",()=>{
  const manifest=reseal(buildManifest(),copy=>copy.matches[0].maps[0].parsed.parserVersion="2.0.1");
  const report=C.validateCorpusManifest(manifest);
  assert.ok(report.errors.some(issue=>issue.code==="parsed.parser-version"));
});

check("opções do parser são verificadas pelo próprio hash",()=>{
  const manifest=reseal(buildManifest(),copy=>copy.parser.options.events.push("weapon_fire"));
  const report=C.validateCorpusManifest(manifest);
  assert.ok(report.errors.some(issue=>issue.code==="parser.options-mismatch"));
});

check("evento mínimo do extrator não pode ser removido",()=>{
  const manifest=reseal(buildManifest(),copy=>{
    copy.parser.options.events=copy.parser.options.events.filter(event=>event!=="player_hurt");
    copy.parser.optionsSha256=C.sha256(C.canonicalJson(copy.parser.options));
  });
  const report=C.validateCorpusManifest(manifest);
  assert.ok(report.errors.some(issue=>issue.code==="parser.required-event"));
});

check("nome canônico do time precisa ser extraído dos ticks",()=>{
  const manifest=reseal(buildManifest(),copy=>{
    copy.parser.options.playerProps=[];
    copy.parser.optionsSha256=C.sha256(C.canonicalJson(copy.parser.options));
  });
  const report=C.validateCorpusManifest(manifest);
  assert.ok(report.errors.some(issue=>issue.code==="parser.required-player-prop"));
});

check("alias interno da demo preserva o nome canônico do time",()=>{
  const manifest=reseal(buildManifest(70),copy=>{
    copy.matches[0].teams[1].demoTeamName="Beta Internal";
  });
  const report=C.validateCorpusManifest(manifest);
  assert.equal(report.valid,true,JSON.stringify(report.errors));
});

check("partida fora do top 20 é rejeitada",()=>{
  const manifest=reseal(buildManifest(),copy=>copy.matches[0].teams[0].vrsRank=21);
  const report=C.validateCorpusManifest(manifest);
  assert.ok(report.errors.some(issue=>issue.code==="team.rank"));
});

check("placar extraído deve reproduzir o placar oficial",()=>{
  const manifest=reseal(buildManifest(),copy=>copy.matches[0].maps[0].parsed.teamAScore=12);
  const report=C.validateCorpusManifest(manifest);
  assert.ok(report.errors.some(issue=>issue.code==="parsed.score"));
});

check("placares MR12 impossíveis são rejeitados",()=>{
  assert.equal(C.isPossibleMr12Score(13,11),true);
  assert.equal(C.isPossibleMr12Score(16,14),true);
  assert.equal(C.isPossibleMr12Score(19,17),true);
  assert.equal(C.isPossibleMr12Score(14,13),false);
  assert.equal(C.isPossibleMr12Score(16,15),false);
  const manifest=reseal(buildManifest(),copy=>{copy.matches[0].maps[0].officialScore={teamA:14,teamB:13};copy.matches[0].maps[0].parsed.teamAScore=14;copy.matches[0].maps[0].parsed.teamBScore=13;copy.matches[0].maps[0].parsed.roundCount=27;});
  assert.ok(C.validateCorpusManifest(manifest).errors.some(issue=>issue.code==="map.score"));
});

check("auditoria abaixo de 2% ou 30 mapas bloqueia publicação",()=>{
  const manifest=reseal(buildManifest(),copy=>{copy.audit.selectedMapIds=copy.audit.selectedMapIds.slice(0,29);copy.audit.checks=copy.audit.checks.slice(0,29);});
  const report=C.validateCorpusManifest(manifest);
  assert.ok(report.blockers.some(issue=>issue.code==="audit.minimum"));
});

check("amostra de auditoria não pode ser escolhida manualmente",()=>{
  const manifest=reseal(buildManifest(),copy=>[copy.audit.selectedMapIds[0],copy.audit.selectedMapIds[1]]=[copy.audit.selectedMapIds[1],copy.audit.selectedMapIds[0]]);
  const report=C.validateCorpusManifest(manifest);
  assert.ok(report.errors.some(issue=>issue.code==="audit.selection-mismatch"));
});

check("checagem inexata não pode ser compensada na nota",()=>{
  const manifest=reseal(buildManifest(),copy=>copy.audit.checks[0].playerKdaExact=false);
  const report=C.validateCorpusManifest(manifest);
  assert.ok(report.errors.some(issue=>issue.code==="audit.exactness"));
});

check("holdout aberto bloqueia prontidão oficial",()=>{
  const manifest=reseal(buildManifest(),copy=>{copy.auditHoldout.locked=false;copy.auditHoldout.openedAt="2026-07-20";});
  const report=C.validateCorpusManifest(manifest);
  assert.equal(report.valid,true);assert.equal(report.officialReady,false);
  assert.ok(report.blockers.some(issue=>issue.code==="holdout.unlocked"));
});

check("oportunidade rara insuficiente permanece visível",()=>{
  const manifest=reseal(buildManifest(),copy=>copy.metricOpportunities.clutch1v3=119);
  const report=C.validateCorpusManifest(manifest);
  assert.ok(report.blockers.some(issue=>issue.code==="opportunity.minimum"&&issue.message.includes("clutch1v3")));
});

check("mínimo de player-rounds é aplicado a cada role",()=>{
  const manifest=reseal(buildManifest(),copy=>copy.metricOpportunities.rolePlayerRounds.Support=9999);
  const report=C.validateCorpusManifest(manifest);
  assert.ok(report.blockers.some(issue=>issue.code==="opportunity.role-minimum"&&issue.message.includes("Support")));
});

check("ID duplicado de mapa é rejeitado",()=>{
  const manifest=reseal(buildManifest(),copy=>copy.matches[1].maps[0].id=copy.matches[0].maps[0].id);
  const report=C.validateCorpusManifest(manifest);
  assert.ok(report.errors.some(issue=>issue.code==="map.duplicate"));
});

check("template é selado, mas placeholders e mínimos falham fechado",()=>{
  const report=C.validateCorpusManifest(C.corpusTemplate());
  assert.equal(report.valid,false);assert.equal(report.officialReady,false);
  assert.ok(report.errors.length>0);
  assert.ok(report.blockers.length>0);
});

console.log(failures?`✗ ${failures} checagem(ns) de corpus falharam`:"✓ corpus IFCS preserva população, proveniência, splits e auditoria");
process.exitCode=failures?1:0;
