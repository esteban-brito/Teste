/* bancada/r5-comparison.js - contratos da captura e comparacao pareada R5. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const manifest=require("../docs/r5-experiment.json");
const {captureExperiment,compareCaptures,comparisonHasZeroDeltas}=require("./r5-experiment");

async function main(){
  const statistics=await import(pathToFileURL(path.join(__dirname,"..","src","domain","statistics","paired-comparison.mjs")).href);
  assert.deepEqual(statistics.distributionSummary([0,1,2]),{
    n:3,mean:1,stdDev:1,p001:.002,p01:.02,p05:.1,p50:1,p95:1.9,p99:1.98,p999:1.998,min:0,max:2
  },"quantis de cauda divergiram");

  const capture=await captureExperiment(manifest.developmentSchedule.cycles);
  assert.equal(capture.engine.gameSha256,manifest.baseline.gameSha256,"game.js divergiu do baseline congelado");
  assert.equal(capture.engine.auditSha256,manifest.baseline.auditSha256,"auditoria divergiu do baseline congelado");
  assert.equal(capture.audit.method.baseSeed,manifest.developmentSchedule.baseSeed,"seed-base divergiu do manifesto");
  assert.equal(capture.observations.length,manifest.developmentSchedule.playerMapObservations,"cobertura R5 incompleta");

  const identity=await compareCaptures(capture,capture);
  assert.equal(comparisonHasZeroDeltas(identity),true,"baseline x baseline nao zerou todos os deltas");
  assert.deepEqual(identity.overall.rating.blockDeltaCi95,[0,0],"IC pareado nulo divergiu");

  const changed={...capture,engine:{...capture.engine,gameSha256:"synthetic-candidate"},observations:capture.observations.map((row,index)=>
    index===0?{...row,rating:row.rating+.5}:row)};
  const detected=await compareCaptures(capture,changed);
  assert.notEqual(detected.overall.rating.observationMeanDelta,0,"comparador ignorou regressao sintetica de rating");
  assert.equal(detected.overall.kpr.observationMeanDelta,0,"regressao sintetica contaminou metrica independente");

  const contextDrift={...capture,observations:capture.observations.map((row,index)=>index===0?{...row,map:"Mapa divergente"}:row)};
  await assert.rejects(compareCaptures(capture,contextDrift),/contexto map diverge/,"comparador aceitou contexto nao pareado");

  console.log("— R5: EXPERIMENTO PAREADO —");
  console.log(`  ✓ ${capture.audit.method.maps} mapas e ${capture.observations.length} player-maps cobertos`);
  console.log("  ✓ hashes do motor e da auditoria conferem com o manifesto");
  console.log("  ✓ baseline x baseline produz delta e IC95% exatamente zero");
  console.log("  ✓ regressao sintetica e deriva de contexto sao detectadas");
  console.log("✓ infraestrutura R5 pronta sem alterar balanceamento");
}

main().catch(error=>{console.error(`r5-comparison: ${error.message}`);process.exitCode=1;});
