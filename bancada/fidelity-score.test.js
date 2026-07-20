/* Caracterização matemática e contratual do scorer IFCS. */
const assert=require("assert/strict");
const F=require("./fidelity-score");
const {okMark}=require("./common");

let failures=0;
function check(label,fn){
  try{fn();console.log(`  ${okMark(true)} ${label}`);}
  catch(error){failures++;console.log(`  ${okMark(false)} ${label}: ${error.message}`);}
}

function validManifest(){
  const specSha256="b".repeat(64),referenceManifestSha256="a".repeat(64),seedManifestSha256="c".repeat(64);
  return {
    methodologyVersion:"1.0",targetId:"cs2-test",
    specSha256,
    reference:{manifestSha256:referenceManifestSha256,valid:true,parserVersion:"fixture-1",parserAuditPassed:true,mapCount:800,eventCount:6,minMapsPerActiveMap:80,holdoutLocked:true,materialRuleContradiction:false},
    simulation:{seedManifestSha256,valid:true,finite:true,reproducible:true,mapCount:50000,seedBlocks:30},
    runProvenance:{specSha256,referenceManifestSha256,seedManifestSha256,gitCommit:"d".repeat(40),environment:"test",durationSeconds:1}
  };
}

function perfectObservation(metric){
  const base={id:metric.id,referenceValid:true,simulationAvailable:true};
  if(metric.kind==="rule")return {...base,conformance:100};
  if(metric.kind==="brier")return {...base,predictions:[0,1,0,1],outcomes:[0,1,0,1],delta:5,scoreCiHalfWidth:2};
  return {...base,real:1,simulated:1,delta:1,ciHalfWidth:.5};
}

function perfectInput(){
  return {...validManifest(),bootstrapScores:Array(1000).fill(100),metrics:F.METRICS.map(perfectObservation)};
}

console.log("— IFCS: SCORER E CONTRATOS —");

check("pesos das dimensões somam 100",()=>{
  assert.equal(Object.values(F.DIMENSIONS).reduce((sum,dimension)=>sum+dimension.weight,0),100);
});

check("pesos das métricas reproduzem cada dimensão",()=>{
  Object.entries(F.DIMENSIONS).forEach(([id,dimension])=>{
    assert.equal(F.METRICS.filter(metric=>metric.dimension===id).reduce((sum,metric)=>sum+metric.weight,0),dimension.weight);
  });
});

check("curva IFCS vale 100 no alvo, 80 em 1 delta e 40,96 em 2 deltas",()=>{
  assert.equal(F.accuracyFromDistance(0),100);
  assert.ok(Math.abs(F.accuracyFromDistance(1)-80)<1e-9);
  assert.ok(Math.abs(F.accuracyFromDistance(2)-40.96)<1e-9);
});

check("curva é monotônica para distâncias crescentes",()=>{
  const scores=[0,.25,.5,1,2,3,4].map(F.accuracyFromDistance);
  assert.ok(scores.every((score,index)=>index===0||score<=scores[index-1]));
});

check("confiabilidade cai pela metade quando IC tem duas vezes delta",()=>{
  assert.equal(F.reliabilityFactor(2,4),.5);
  assert.equal(F.reliabilityFactor(2,1),1);
  assert.throws(()=>F.reliabilityFactor(2,Infinity),/finita/);
});

check("Wasserstein funciona com tamanhos de amostra diferentes",()=>{
  assert.equal(F.wasserstein1([0,0,2],[1,1]),1);
  assert.equal(F.wasserstein1([0,1],[0,1]),0);
});

check("Brier premia previsão perfeita e zera skill da climatologia",()=>{
  assert.equal(F.brierSkillScore([0,1,0,1],[0,1,0,1]),1);
  assert.equal(F.brierSkillScore([.5,.5,.5,.5],[0,1,0,1]),0);
});

check("entrada perfeita produz IFCS oficial 100",()=>{
  const report=F.scoreFidelityReport(perfectInput());
  assert.equal(report.valid,true);assert.equal(report.official,true);assert.equal(report.score,100);
  assert.deepEqual(report.interval,[100,100]);assert.equal(report.coverage,100);
});

check("saída ausente recebe zero sem redistribuir peso",()=>{
  const input=perfectInput();
  input.metrics=input.metrics.map(metric=>metric.id==="robustness.metamorphic"?{id:metric.id,referenceValid:true,simulationAvailable:false}:metric);
  const report=F.scoreFidelityReport(input);
  assert.equal(report.valid,true);assert.equal(report.coverage,100);assert.equal(report.modelCoverage,99);assert.equal(report.score,99);
  assert.equal(report.metrics.find(metric=>metric.id==="robustness.metamorphic").score,0);
});

check("cobertura abaixo de 70 invalida a nota",()=>{
  const input=perfectInput();input.metrics=input.metrics.slice(0,10);
  const report=F.scoreFidelityReport(input);
  assert.equal(report.valid,false);assert.equal(report.score,null);
});

check("aproximar uma observação do real nunca piora seu score",()=>{
  const definition=F.METRICS.find(metric=>metric.kind==="distance");
  const scores=[4,3,2,1,0].map(error=>F.metricObservationScore(definition,{referenceValid:true,simulationAvailable:true,real:0,simulated:error,delta:1,ciHalfWidth:.5}).score);
  assert.ok(scores.every((score,index)=>index===0||score>=scores[index-1]));
});

check("ausência de holdout limita nota a 79",()=>{
  const input=perfectInput();input.reference.holdoutLocked=false;
  const report=F.scoreFidelityReport(input);
  assert.equal(report.valid,true);assert.equal(report.official,false);assert.equal(report.score,79);assert.equal(report.cap,79);
});

check("dimensão crítica abaixo de 50 limita nota a 69",()=>{
  const input=perfectInput();
  input.metrics=input.metrics.map(metric=>metric.id.startsWith("economy.")&&metric.kind!=="rule"?{...metric,simulated:10}:metric);
  const report=F.scoreFidelityReport(input);
  assert.equal(report.cap,69);assert.equal(report.score,69);
});

check("contradição material de regra limita nota a 59",()=>{
  const input=perfectInput();input.reference.materialRuleContradiction=true;
  const report=F.scoreFidelityReport(input);
  assert.equal(report.cap,59);assert.equal(report.score,59);
});

check("manifesto insuficiente é recusado antes da pontuação",()=>{
  const input=perfectInput();input.reference.mapCount=799;
  const report=F.scoreFidelityReport(input);
  assert.equal(report.valid,false);assert.match(report.issues.join(" "),/800 mapas/);
});

check("divergência de hash entre manifesto e run invalida a nota",()=>{
  const input=perfectInput();input.runProvenance.seedManifestSha256="e".repeat(64);
  const report=F.scoreFidelityReport(input);
  assert.equal(report.valid,false);assert.match(report.issues.join(" "),/seeds diverge/);
});

check("NaN no bootstrap invalida em vez de reduzir silenciosamente",()=>{
  const input=perfectInput();input.bootstrapScores[10]=Number.NaN;
  const report=F.scoreFidelityReport(input);
  assert.equal(report.valid,false);assert.match(report.issues.join(" "),/bootstrapScores/);
});

check("valor não finito numa observação invalida a execução",()=>{
  const input=perfectInput();
  const index=input.metrics.findIndex(metric=>metric.id==="maps.roundDistribution");
  input.metrics[index]={...input.metrics[index],simulated:Infinity};
  const report=F.scoreFidelityReport(input);
  assert.equal(report.valid,false);assert.match(report.issues.join(" "),/não finito|inválidos/);
});

check("conformidade parcial de regra exige justificativa",()=>{
  const definition=F.METRICS.find(metric=>metric.kind==="rule");
  assert.throws(()=>F.metricObservationScore(definition,{referenceValid:true,simulationAvailable:true,conformance:50}),/justificativa/);
});

check("bootstrap em blocos é determinístico por seed",()=>{
  const a=F.bootstrapStatistic([1,2,3,4],F.mean,{iterations:1000,seed:7});
  const b=F.bootstrapStatistic([1,2,3,4],F.mean,{iterations:1000,seed:7});
  assert.deepEqual(a.interval,b.interval);assert.deepEqual(a.values,b.values);
  assert.ok(a.interval[0]<a.interval[1]);
});

check("template contém todas as métricas e falha fechado",()=>{
  const template=F.inputTemplate();
  assert.equal(template.metrics.length,F.METRICS.length);
  assert.ok(F.validateRunManifest(template).length>0);
});

console.log(failures?`✗ ${failures} checagem(ns) IFCS falharam`:"✓ scorer IFCS preserva pesos, incerteza, cobertura e caps");
process.exitCode=failures?1:0;
