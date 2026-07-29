/* Compara o combate extraído round a round e dentro da orquestração de mapas.
   Resultado, mutações, telemetria e próxima amostra do RNG devem ser idênticos. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {X,T}=require("../bancada/motor");
const {ROOT}=require("../bancada/common");

const plain=value=>JSON.parse(JSON.stringify(value));
const load=relative=>import(pathToFileURL(path.join(ROOT,...relative.split("/"))).href);

function contexts(count){
  const buys=["pistol","eco","force","full","awp"];
  const edges=[.03,.27,.5,.73,.97];
  return Array.from({length:count},(_,index)=>{
    const buyA=buys[index%buys.length],buyB=buys[(index*3+1)%buys.length];
    const ctx={pEdgeA:edges[index%edges.length],openEdgeA:(index%7-3)*.025,
      buyA,buyB,aIsCT:index%2===0};
    if(index%3!==0){
      ctx.comprasA=Array.from({length:5},(__,i)=>buys[(index+i)%buys.length]);
      ctx.comprasB=Array.from({length:5},(__,i)=>buys[(index+i*2+2)%buys.length]);
    }
    if(index%4===0)ctx.trace={round:index+1,scoreBefore:[index%13,(index*2)%13]};
    return ctx;
  });
}

async function main(){
  const [A,RNG,R,PV,TC,AC,E,M,TM]=await Promise.all([
    load("src/public/evaluation-api.mjs"),load("src/domain/simulation/random-source.mjs"),
    load("src/domain/simulation/round-combat.mjs"),
    load("src/domain/simulation/preservation-value.mjs"),
    load("src/domain/simulation/trade-context.mjs"),
    load("src/domain/simulation/assist-context.mjs"),
    load("src/domain/simulation/economy.mjs"),load("src/domain/simulation/map-simulation.mjs"),
    load("src/domain/simulation/simulation-telemetry.mjs")
  ]);
  const means=R.computeCombatMeans(Object.values(A.POOL),{
    preservationValue:PV.preservationValue,tradeContextProfile:TC.tradeContextProfile,
    assistContextProfile:AC.assistContextProfile
  });
  const roundDeps=rng=>({cfg:X.CFG_SIM,random:rng.rndF,gaussian:rng.gaussF,...means,
    premioVitoria:E.PREMIO_VITORIA,premioObjetivo:E.PREMIO_OBJETIVO});
  const roundDepsLegacyRng=()=>({cfg:X.CFG_SIM,random:X.rndF,gaussian:X.gaussF,...means,
    premioVitoria:E.PREMIO_VITORIA,premioObjetivo:E.PREMIO_OBJETIVO});

  const preparePair=(left,right,map,seed)=>{
    X.srand(seed);
    return [plain(X.prepTime(plain(T[left]),map)),plain(X.prepTime(plain(T[right]),map))];
  };
  const runLegacy=(baseA,baseB,roundContexts,seed)=>{
    const a=plain(baseA),b=plain(baseB);X.srand(seed);
    const rounds=roundContexts.map(source=>{const ctx=plain(source),result=plain(X.combateRound(a,b,ctx));
      return {result,trace:ctx.trace?plain(ctx.trace):null};
    });
    return {rounds,a:plain(a),b:plain(b),next:X.rndF()};
  };
  const runModule=(baseA,baseB,roundContexts,seed)=>{
    const a=plain(baseA),b=plain(baseB),rng=RNG.createMulberry32(seed),deps=roundDeps(rng);
    const rounds=roundContexts.map(source=>{const ctx=plain(source),result=plain(R.combateRound(a,b,ctx,deps));
      return {result,trace:ctx.trace?plain(ctx.trace):null};
    });
    return {rounds,a:plain(a),b:plain(b),next:rng.rndF()};
  };

  const sequences=[
    {teams:[0,1],map:"Nuke",prepSeed:91,seed:20260728,count:64},
    {teams:[8,14],map:"Anubis",prepSeed:37,seed:645,count:64}
  ];
  sequences.forEach(({teams,map,prepSeed,seed,count},index)=>{
    const [baseA,baseB]=preparePair(teams[0],teams[1],map,prepSeed),roundContexts=contexts(count);
    assert.deepEqual(runModule(baseA,baseB,roundContexts,seed),
      runLegacy(baseA,baseB,roundContexts,seed),`sequência de rounds ${index}`);
  });

  const [telemetryBase]=preparePair(2,3,"Inferno",19);
  assert.equal(TM.TELEMETRY_SCHEMA_VERSION,X.TELEMETRY_SCHEMA_VERSION,"versão de telemetria divergiu");
  assert.deepEqual(plain(TM.telemetryTeam(telemetryBase)),plain(X.telemetryTeam(telemetryBase)),
    "identidade de telemetria do time divergiu");

  const mapDeps=combatDeps=>({cfg:X.CFG_SIM,mapasPool:X.MAPAS_POOL,mapaLado:X.MAPA_LADO,
    buy:X.BUY,lossBonus:X.LOSS_BONUS,recompensaArma:X.RECOMPENSA_ARMA,tetoGrana:X.TETO_GRANA,
    random:X.rndF,gaussian:X.gaussF,prepTime:X.prepTime,telemetryTeam:TM.telemetryTeam,
    telemetrySchemaVersion:TM.TELEMETRY_SCHEMA_VERSION,combatProfile:X.combatProfile,
    decidirCompra:X.decidirCompra,pagarCompra:X.pagarCompra,compraDoTime:X.compraDoTime,
    logistica:X.logistica,combateRound:(...args)=>R.combateRound(...args,combatDeps),
    fallenAngels:X.fallenAngels});
  const mapCases=Array.from({length:16},(_,index)=>({seed:800+index,
    map:X.MAPAS_POOL[index%X.MAPAS_POOL.length],left:index%T.length,
    right:(index*5+1)%T.length,options:index%3===0?{telemetry:true}:undefined}));
  mapCases.forEach(({seed,map,left,right,options},index)=>{
    const a1=plain(T[left]),b1=plain(T[right]);X.srand(seed);
    const expected=plain(X.simularMapa(a1,b1,70,68,map,false,options)),nextExpected=X.rndF();
    const a2=plain(T[left]),b2=plain(T[right]);X.srand(seed);
    const actual=plain(M.simularMapa(a2,b2,70,68,map,false,options,
      mapDeps(roundDepsLegacyRng()))),nextActual=X.rndF();
    assert.deepEqual(actual,expected,`composição de mapa ${index}/${map}`);
    assert.equal(nextActual,nextExpected,`RNG da composição de mapa ${index}/${map}`);
  });

  const totalRounds=sequences.reduce((sum,item)=>sum+item.count,0);
  console.log(`round combat parity: ok (${totalRounds} rounds sequenciais · ${mapCases.length} mapas · RNG conferido)`);
}

main().catch(error=>{console.error(error);process.exitCode=1;});
