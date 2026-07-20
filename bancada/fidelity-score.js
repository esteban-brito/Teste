/* IFCS — núcleo puro da nota de fidelidade ao Counter-Strike.
   Não carrega game.js, DOM ou dados do produto. Recebe observações auditadas e
   devolve diagnóstico; tuning e coleta do corpus pertencem a outras etapas. */
const METHODOLOGY_VERSION="1.0";
const EPSILON=1e-12;

const DIMENSIONS=Object.freeze({
  rules:{label:"Regras e formato competitivo",weight:10},
  maps:{label:"Ecologia de mapas e rounds",weight:15,critical:true},
  economy:{label:"Economia, objetivo e estados",weight:20,critical:true},
  combat:{label:"Produção individual e combate",weight:20,critical:true},
  identity:{label:"Roles, jogadores e identidade",weight:15},
  outcomes:{label:"Força competitiva e resultados",weight:10},
  robustness:{label:"Generalização e robustez",weight:10}
});

const METRICS=Object.freeze([
  {id:"rules.regulation",dimension:"rules",weight:3,kind:"rule"},
  {id:"rules.swiss",dimension:"rules",weight:3,kind:"rule"},
  {id:"rules.playoffs",dimension:"rules",weight:2,kind:"rule"},
  {id:"rules.mapVeto",dimension:"rules",weight:2,kind:"rule"},

  {id:"maps.roundDistribution",dimension:"maps",weight:4,kind:"distance"},
  {id:"maps.ctByMap",dimension:"maps",weight:4,kind:"distance"},
  {id:"maps.marginDistribution",dimension:"maps",weight:3,kind:"distance"},
  {id:"maps.overtimeComeback",dimension:"maps",weight:2,kind:"distance"},
  {id:"maps.heterogeneity",dimension:"maps",weight:2,kind:"distance"},

  {id:"economy.buyDistribution",dimension:"economy",weight:4,kind:"distance"},
  {id:"economy.transitions",dimension:"economy",weight:4,kind:"distance"},
  {id:"economy.plantPostplant",dimension:"economy",weight:5,kind:"distance"},
  {id:"economy.antiEcoForce",dimension:"economy",weight:3,kind:"distance"},
  {id:"economy.clutchRates",dimension:"economy",weight:4,kind:"distance"},

  {id:"combat.killDeathSurvival",dimension:"combat",weight:4,kind:"distance"},
  {id:"combat.adrDamage",dimension:"combat",weight:3,kind:"distance"},
  {id:"combat.kastAssistTrade",dimension:"combat",weight:4,kind:"distance"},
  {id:"combat.openingMultikill",dimension:"combat",weight:4,kind:"distance"},
  {id:"combat.jointStatistics",dimension:"combat",weight:3,kind:"distance"},
  {id:"combat.ecoAdjustedImpact",dimension:"combat",weight:2,kind:"distance"},

  {id:"identity.roleVectors",dimension:"identity",weight:5,kind:"distance"},
  {id:"identity.roleOrdering",dimension:"identity",weight:3,kind:"distance"},
  {id:"identity.playerRating",dimension:"identity",weight:4,kind:"distance"},
  {id:"identity.teamConcentration",dimension:"identity",weight:3,kind:"distance"},

  {id:"outcomes.winCalibration",dimension:"outcomes",weight:4,kind:"brier"},
  {id:"outcomes.strengthMonotonicity",dimension:"outcomes",weight:2,kind:"distance"},
  {id:"outcomes.upsetBlowout",dimension:"outcomes",weight:2,kind:"distance"},
  {id:"outcomes.seriesConversion",dimension:"outcomes",weight:2,kind:"distance"},

  {id:"robustness.eventHoldout",dimension:"robustness",weight:3,kind:"distance"},
  {id:"robustness.temporalHoldout",dimension:"robustness",weight:2,kind:"distance"},
  {id:"robustness.worstStratum",dimension:"robustness",weight:2,kind:"distance"},
  {id:"robustness.seedStability",dimension:"robustness",weight:2,kind:"distance"},
  {id:"robustness.metamorphic",dimension:"robustness",weight:1,kind:"rule"}
]);

const METRIC_BY_ID=Object.freeze(Object.fromEntries(METRICS.map(metric=>[metric.id,metric])));

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const finite=value=>typeof value==="number"&&Number.isFinite(value);
const round=(value,digits=3)=>Number(value.toFixed(digits));
const isSha256=value=>typeof value==="string"&&/^[a-f0-9]{64}$/i.test(value);
const isNonNegativeInteger=value=>Number.isInteger(value)&&value>=0;

function mean(values){
  if(!Array.isArray(values)||!values.length)throw new Error("média requer amostra não vazia");
  if(!values.every(finite))throw new Error("amostra contém valor não finito");
  return values.reduce((sum,value)=>sum+value,0)/values.length;
}

function percentile(values,p){
  if(!Array.isArray(values)||!values.length)throw new Error("percentil requer amostra não vazia");
  if(!values.every(finite))throw new Error("amostra contém valor não finito");
  if(!finite(p)||p<0||p>1)throw new Error("percentil deve estar entre 0 e 1");
  const sorted=[...values].sort((a,b)=>a-b);
  const position=clamp(p,0,1)*(sorted.length-1);
  const low=Math.floor(position),high=Math.ceil(position),fraction=position-low;
  return sorted[low]+(sorted[high]-sorted[low])*fraction;
}

function quantiles(values){
  return Object.fromEntries([.05,.25,.5,.75,.95].map(p=>[`p${String(p*100).padStart(2,"0")}`,round(percentile(values,p))]));
}

function wasserstein1(sampleA,sampleB){
  if(!Array.isArray(sampleA)||!sampleA.length||!Array.isArray(sampleB)||!sampleB.length){
    throw new Error("Wasserstein requer duas amostras não vazias");
  }
  if(!sampleA.every(finite)||!sampleB.every(finite))throw new Error("Wasserstein recebeu valor não finito");
  const a=[...sampleA].sort((x,y)=>x-y),b=[...sampleB].sort((x,y)=>x-y);
  let ia=0,ib=0,cdfA=0,cdfB=0,previous=Math.min(a[0],b[0]),distance=0;
  while(ia<a.length||ib<b.length){
    const nextA=ia<a.length?a[ia]:Infinity,nextB=ib<b.length?b[ib]:Infinity;
    const point=Math.min(nextA,nextB);
    distance+=Math.abs(cdfA-cdfB)*(point-previous);
    while(ia<a.length&&a[ia]===point)ia++;
    while(ib<b.length&&b[ib]===point)ib++;
    cdfA=ia/a.length;cdfB=ib/b.length;previous=point;
  }
  return distance;
}

function brierScore(predictions,outcomes){
  if(!Array.isArray(predictions)||!predictions.length||predictions.length!==outcomes?.length){
    throw new Error("Brier requer previsões e resultados pareados");
  }
  let total=0;
  predictions.forEach((prediction,index)=>{
    const outcome=outcomes[index];
    if(!finite(prediction)||prediction<0||prediction>1||!(outcome===0||outcome===1)){
      throw new Error("Brier recebeu probabilidade ou resultado inválido");
    }
    total+=(prediction-outcome)**2;
  });
  return total/predictions.length;
}

function brierSkillScore(predictions,outcomes,baselineProbability=null){
  const base=baselineProbability==null?mean(outcomes):baselineProbability;
  if(!finite(base)||base<0||base>1)throw new Error("probabilidade-base inválida");
  const model=brierScore(predictions,outcomes);
  const baseline=brierScore(outcomes.map(()=>base),outcomes);
  if(baseline<=EPSILON)return model<=EPSILON?1:0;
  return 1-model/baseline;
}

function accuracyFromDistance(distance){
  if(!finite(distance)||distance<0)throw new Error("distância normalizada inválida");
  return 100*Math.pow(.8,distance*distance);
}

function reliabilityFactor(delta,ciHalfWidth){
  if(!finite(delta)||delta<=0)throw new Error("delta deve ser positivo");
  if(!finite(ciHalfWidth)||ciHalfWidth<0)throw new Error("meia largura do IC deve ser finita e não negativa");
  return Math.min(1,delta/Math.max(ciHalfWidth,EPSILON));
}

function metricObservationScore(definition,observation){
  const base={id:definition.id,dimension:definition.dimension,weight:definition.weight,kind:definition.kind};
  if(!observation)return {...base,score:0,referenceValid:false,simulationAvailable:false,reason:"observação ausente"};
  if(observation.referenceValid!==true)return {...base,score:0,referenceValid:false,simulationAvailable:observation.simulationAvailable===true,reason:"referência inválida"};
  if(observation.simulationAvailable!==true)return {...base,score:0,referenceValid:true,simulationAvailable:false,reason:"saída ausente no simulador"};

  if(definition.kind==="rule"){
    const conformance=observation.conformance;
    if(![0,50,100].includes(conformance))throw new Error(`${definition.id}: conformidade deve ser 0, 50 ou 100`);
    if(conformance===50&&(typeof observation.justification!=="string"||!observation.justification.trim())){
      throw new Error(`${definition.id}: conformidade parcial requer justificativa`);
    }
    return {...base,score:conformance,accuracy:conformance,reliability:1,referenceValid:true,simulationAvailable:true,justification:observation.justification||null};
  }

  if(definition.kind==="brier"){
    if(!finite(observation.delta)||observation.delta<=0)throw new Error(`${definition.id}: delta do score Brier deve ser positivo`);
    const skill=brierSkillScore(observation.predictions,observation.outcomes,observation.baselineProbability);
    const accuracy=100*clamp(skill,0,1);
    const reliability=reliabilityFactor(observation.delta,observation.scoreCiHalfWidth);
    const baseProbability=observation.baselineProbability==null?mean(observation.outcomes):observation.baselineProbability;
    return {
      ...base,score:accuracy*reliability,accuracy,reliability,brierSkill:skill,
      brierScore:brierScore(observation.predictions,observation.outcomes),
      baselineBrierScore:brierScore(observation.outcomes.map(()=>baseProbability),observation.outcomes),
      delta:observation.delta,ciHalfWidth:observation.scoreCiHalfWidth,
      sampleSize:observation.outcomes.length,referenceValid:true,simulationAvailable:true
    };
  }

  const delta=observation.delta;
  if(!finite(delta)||delta<=0)throw new Error(`${definition.id}: delta deve ser positivo`);
  let absoluteDistance;
  if(Array.isArray(observation.realSamples)||Array.isArray(observation.simulatedSamples)){
    absoluteDistance=wasserstein1(observation.realSamples,observation.simulatedSamples);
  }else{
    if(!finite(observation.real)||!finite(observation.simulated))throw new Error(`${definition.id}: valores escalar real/sim inválidos`);
    absoluteDistance=Math.abs(observation.simulated-observation.real);
  }
  const normalizedDistance=absoluteDistance/delta;
  const accuracy=accuracyFromDistance(normalizedDistance);
  const reliability=reliabilityFactor(delta,observation.ciHalfWidth);
  const evidence=Array.isArray(observation.realSamples)?{
    sampleSizeReal:observation.realSamples.length,
    sampleSizeSimulated:observation.simulatedSamples.length,
    realQuantiles:quantiles(observation.realSamples),
    simulatedQuantiles:quantiles(observation.simulatedSamples)
  }:{real:observation.real,simulated:observation.simulated};
  return {
    ...base,...evidence,score:accuracy*reliability,accuracy,reliability,
    absoluteDistance,normalizedDistance,delta,ciHalfWidth:observation.ciHalfWidth,
    referenceValid:true,simulationAvailable:true
  };
}

function validateRunManifest(input){
  const issues=[];
  if(!input||typeof input!=="object")return ["entrada IFCS ausente"];
  if(input.methodologyVersion!==METHODOLOGY_VERSION)issues.push(`metodologia deve ser ${METHODOLOGY_VERSION}`);
  if(typeof input.targetId!=="string"||!input.targetId.trim())issues.push("targetId ausente");
  const reference=input.reference||{},simulation=input.simulation||{},run=input.runProvenance||{};
  if(!isSha256(input.specSha256))issues.push("hash da especificação inválido");
  if(!isSha256(reference.manifestSha256))issues.push("hash do manifesto real inválido");
  if(!isSha256(simulation.seedManifestSha256))issues.push("hash do manifesto de seeds inválido");
  if(run.specSha256!==input.specSha256)issues.push("hash da especificação diverge no run");
  if(run.referenceManifestSha256!==reference.manifestSha256)issues.push("hash do corpus diverge no run");
  if(run.seedManifestSha256!==simulation.seedManifestSha256)issues.push("hash das seeds diverge no run");
  if(typeof run.gitCommit!=="string"||!/^[a-f0-9]{40}$/i.test(run.gitCommit))issues.push("commit do run inválido");
  if(typeof run.environment!=="string"||!run.environment.trim())issues.push("ambiente do run ausente");
  if(!finite(run.durationSeconds)||run.durationSeconds<0)issues.push("duração do run inválida");
  if(reference.valid!==true)issues.push("corpus real marcado como inválido");
  if(reference.parserAuditPassed!==true)issues.push("auditoria do parser não aprovada");
  if(typeof reference.parserVersion!=="string"||!reference.parserVersion.trim())issues.push("versão do parser ausente");
  if(!isNonNegativeInteger(reference.mapCount)||reference.mapCount<800)issues.push("corpus real requer ao menos 800 mapas");
  if(!isNonNegativeInteger(reference.eventCount)||reference.eventCount<6)issues.push("corpus real requer ao menos 6 eventos");
  if(!isNonNegativeInteger(reference.minMapsPerActiveMap)||reference.minMapsPerActiveMap<80)issues.push("corpus real requer 80 mapas por mapa ativo");
  if(simulation.valid!==true)issues.push("simulação marcada como inválida");
  if(simulation.finite!==true)issues.push("simulação contém ou não descartou valores não finitos");
  if(simulation.reproducible!==true)issues.push("reprodutibilidade por seed não comprovada");
  if(!isNonNegativeInteger(simulation.mapCount))issues.push("quantidade de mapas simulados inválida");
  if(!isNonNegativeInteger(simulation.seedBlocks))issues.push("quantidade de blocos de seed inválida");
  return issues;
}

function scoreFidelityReport(input){
  const fatalIssues=validateRunManifest(input);
  if(fatalIssues.length)return {valid:false,official:false,score:null,issues:fatalIssues};

  let metrics;
  try{
    const observations=new Map();
    for(const observation of input.metrics||[]){
      if(!observation||typeof observation.id!=="string")throw new Error("observação sem id");
      if(!METRIC_BY_ID[observation.id])throw new Error(`métrica desconhecida: ${observation.id}`);
      if(observations.has(observation.id))throw new Error(`métrica duplicada: ${observation.id}`);
      observations.set(observation.id,observation);
    }
    metrics=METRICS.map(definition=>metricObservationScore(definition,observations.get(definition.id)));
  }catch(error){
    return {valid:false,official:false,score:null,issues:[`observações IFCS inválidas: ${error.message}`]};
  }
  const totalWeight=METRICS.reduce((sum,metric)=>sum+metric.weight,0);
  const referenceWeight=metrics.filter(metric=>metric.referenceValid).reduce((sum,metric)=>sum+metric.weight,0);
  const modelWeight=metrics.filter(metric=>metric.referenceValid&&metric.simulationAvailable).reduce((sum,metric)=>sum+metric.weight,0);
  const referenceCoverage=100*referenceWeight/totalWeight,modelCoverage=100*modelWeight/totalWeight;
  // Cobertura mede a capacidade de sustentar a comparação com evidência real.
  // Saída ausente no jogo recebe zero, mas não apaga uma referência que existe.
  const coverage=referenceCoverage;
  if(coverage<70)return {valid:false,official:false,score:null,coverage,issues:["cobertura IFCS abaixo de 70%"],metrics};

  const dimensions=Object.entries(DIMENSIONS).map(([id,definition])=>{
    const items=metrics.filter(metric=>metric.dimension===id);
    const weight=items.reduce((sum,metric)=>sum+metric.weight,0);
    const score=items.reduce((sum,metric)=>sum+metric.weight*metric.score,0)/weight;
    return {id,label:definition.label,weight:definition.weight,critical:!!definition.critical,score};
  });
  const rawScore=dimensions.reduce((sum,dimension)=>sum+dimension.weight*dimension.score,0)/100;
  const issues=[],caps=[];
  const simulation=input.simulation;
  if(input.bootstrapScores!=null&&!Array.isArray(input.bootstrapScores)){
    return {valid:false,official:false,score:null,issues:["bootstrapScores deve ser uma lista"],metrics};
  }
  if(Array.isArray(input.bootstrapScores)&&!input.bootstrapScores.every(value=>finite(value)&&value>=0&&value<=100)){
    return {valid:false,official:false,score:null,issues:["bootstrapScores contém valor inválido"],metrics};
  }
  const bootstrapScores=Array.isArray(input.bootstrapScores)?input.bootstrapScores:null;
  const interval=bootstrapScores?.length>=1000?[percentile(bootstrapScores,.025),percentile(bootstrapScores,.975)]:null;

  if(coverage<90){caps.push(79);issues.push("cobertura abaixo de 90%");}
  if(input.reference.holdoutLocked!==true){caps.push(79);issues.push("holdout de auditoria não está bloqueado");}
  if(simulation.mapCount<50000||simulation.seedBlocks<30){caps.push(79);issues.push("amostra simulada abaixo do mínimo oficial");}
  if(!interval){caps.push(79);issues.push("IC95% bootstrap com 1.000 réplicas ausente");}
  else if((interval[1]-interval[0])/2>1){caps.push(79);issues.push("IC95% da nota excede meia largura de 1 ponto");}
  if(dimensions.some(dimension=>dimension.critical&&dimension.score<50)){
    caps.push(69);issues.push("dimensão central abaixo de 50");
  }
  if(input.reference.materialRuleContradiction===true){caps.push(59);issues.push("contradição material de regra competitiva");}
  const cap=caps.length?Math.min(...caps):100;
  const score=Math.min(rawScore,cap);
  return {
    valid:true,
    official:cap===100,
    methodologyVersion:METHODOLOGY_VERSION,
    targetId:input.targetId,
    score:round(score),
    rawScore:round(rawScore),
    interval:interval?interval.map(value=>round(Math.min(value,cap))):null,
    coverage:round(coverage,1),
    referenceCoverage:round(referenceCoverage,1),
    modelCoverage:round(modelCoverage,1),
    cap,
    issues,
    dimensions:dimensions.map(dimension=>({...dimension,score:round(dimension.score)})),
    metrics:metrics.map(metric=>({...metric,score:round(metric.score),accuracy:finite(metric.accuracy)?round(metric.accuracy):metric.accuracy,reliability:finite(metric.reliability)?round(metric.reliability):metric.reliability}))
  };
}

function mulberry32(seed){
  let state=seed>>>0||1;
  return ()=>{let t=state+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};
}

function bootstrapStatistic(blocks,statistic,{iterations=1000,seed=20260720}={}){
  if(!Array.isArray(blocks)||blocks.length<2)throw new Error("bootstrap requer ao menos dois blocos");
  if(typeof statistic!=="function")throw new Error("bootstrap requer função estatística");
  if(!Number.isInteger(iterations)||iterations<1)throw new Error("iterações de bootstrap inválidas");
  if(!Number.isInteger(seed)||seed<0)throw new Error("seed de bootstrap inválida");
  const random=mulberry32(seed),values=[];
  for(let iteration=0;iteration<iterations;iteration++){
    const sample=Array.from({length:blocks.length},()=>blocks[Math.floor(random()*blocks.length)]);
    const value=statistic(sample);
    if(!finite(value))throw new Error("estatística bootstrap não finita");
    values.push(value);
  }
  return {values,interval:[percentile(values,.025),percentile(values,.975)]};
}

function inputTemplate(){
  const placeholderHash="0".repeat(64);
  return {
    methodologyVersion:METHODOLOGY_VERSION,
    targetId:"preencher-target-id",
    specSha256:placeholderHash,
    reference:{manifestSha256:placeholderHash,valid:false,parserVersion:"preencher",parserAuditPassed:false,mapCount:0,eventCount:0,minMapsPerActiveMap:0,holdoutLocked:false,materialRuleContradiction:false},
    simulation:{seedManifestSha256:placeholderHash,valid:false,finite:false,reproducible:false,mapCount:0,seedBlocks:0},
    runProvenance:{specSha256:placeholderHash,referenceManifestSha256:placeholderHash,seedManifestSha256:placeholderHash,gitCommit:"0".repeat(40),environment:"preencher",durationSeconds:0},
    bootstrapScores:[],
    metrics:METRICS.map(metric=>({id:metric.id,referenceValid:false,simulationAvailable:false}))
  };
}

module.exports={
  METHODOLOGY_VERSION,DIMENSIONS,METRICS,
  mean,percentile,quantiles,wasserstein1,brierScore,brierSkillScore,
  accuracyFromDistance,reliabilityFactor,metricObservationScore,
  validateRunManifest,scoreFidelityReport,bootstrapStatistic,inputTemplate
};
