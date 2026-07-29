const assert=require("node:assert/strict"),path=require("node:path"),{pathToFileURL}=require("node:url");
const {X,T}=require("../bancada/motor"),{ROOT}=require("../bancada/common");
const plain=v=>JSON.parse(JSON.stringify(v));
const deps=()=>({cfg:X.CFG_SIM,mapasPool:X.MAPAS_POOL,mapaLado:X.MAPA_LADO,buy:X.BUY,lossBonus:X.LOSS_BONUS,recompensaArma:X.RECOMPENSA_ARMA,tetoGrana:X.TETO_GRANA,random:X.rndF,gaussian:X.gaussF,prepTime:X.prepTime,telemetryTeam:X.telemetryTeam,telemetrySchemaVersion:X.TELEMETRY_SCHEMA_VERSION,combatProfile:X.combatProfile,decidirCompra:X.decidirCompra,pagarCompra:X.pagarCompra,compraDoTime:X.compraDoTime,logistica:X.logistica,combateRound:X.combateRound,fallenAngels:X.fallenAngels});
async function main(){
  const M=await import(pathToFileURL(path.join(ROOT,"src/domain/simulation/map-simulation.mjs")).href);
  const E=await import(pathToFileURL(path.join(ROOT,"src/domain/simulation/economy.mjs")).href);
  const casosBase=[[8,"Nuke",false],[13,"Nuke",false],[20260723,"Inferno",false,{telemetry:true}],[1,"Dust2",true],[77,null,false]];
  const casosGrade=Array.from({length:32},(_,i)=>{
    const seed=1000+i,map=X.MAPAS_POOL[i%X.MAPAS_POOL.length];
    return [seed,map,i%7===0,i%11===0?{telemetry:true}:undefined,i%3===0?null:55+i%17,i%4===0?null:52+i%19];
  });
  const casos=[...casosBase,...casosGrade];
  for(const [i,[seed,map,leve,options,fA=70,fB=68]] of casos.entries()){
    const a1=plain(T[0]),b1=plain(T[1]);X.srand(seed);
    const legado=plain(X.simularMapa(a1,b1,fA,fB,map,leve,options)),r1=X.rndF();
    const a2=plain(T[0]),b2=plain(T[1]),d=deps(),combate=d.combateRound;
    let roundsExecutados=0;d.combateRound=(...args)=>{roundsExecutados++;return combate(...args);};
    X.srand(seed);const resultado=M.simularMapa(a2,b2,fA,fB,map,leve,options,d),novo=plain(resultado),r2=X.rndF();
    assert.deepEqual(novo,legado,`simularMapa caso ${i}`);assert.equal(r2,r1,`RNG caso ${i}`);
    assert.equal(roundsExecutados,novo.totalRounds,`combateRound não executou uma vez por round no caso ${i}`);
    assert.equal(resultado.vencedor,novo.placar[0]>novo.placar[1]?a2:b2,`identidade do vencedor no caso ${i}`);
    if(i===1)assert.ok(novo.totalRounds>=30,"caso de OT repetido não alcançou 30 rounds");
    if(options)assert.equal(novo.telemetry.rounds.length,novo.totalRounds,"telemetria incompleta");
    if(leve){assert.deepEqual(novo.statsA,[]);assert.ok(novo.rounds.every(round=>round.snapA===null));}
    if(!map)assert.ok(X.MAPAS_POOL.includes(novo.mapa),"sorteio devolveu mapa fora do pool");
  }
  const a1=plain(T[2]),b1=plain(T[3]);X.srand(29);
  const legado=plain(X.simularMapa(a1,b1,66,64,"Ancient",false)),r1=X.rndF();
  const a2=plain(T[2]),b2=plain(T[3]),d=deps();
  Object.assign(d,{buy:E.BUY,lossBonus:E.LOSS_BONUS,recompensaArma:E.RECOMPENSA_ARMA,
    tetoGrana:E.TETO_GRANA,decidirCompra:E.decidirCompra,pagarCompra:E.pagarCompra,
    compraDoTime:E.compraDoTime});
  X.srand(29);const composto=plain(M.simularMapa(a2,b2,66,64,"Ancient",false,undefined,d)),r2=X.rndF();
  assert.deepEqual(composto,legado,"simularMapa não compõe com economy.mjs");
  assert.equal(r2,r1,"economy.mjs alterou o consumo de RNG do mapa");
  console.log(`map simulation parity: ok (${casos.length} mapas completos · RNG conferido)`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
