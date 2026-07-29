/* Prova a composição pública inteira contra o motor legado: configuração,
   forma, campanha, mapas, séries, identidade e consumo de RNG. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {X,T}=require("../bancada/motor");
const {ROOT}=require("../bancada/common");

const plain=value=>JSON.parse(JSON.stringify(value));

async function main(){
  const A=await import(pathToFileURL(path.join(ROOT,"src/public/simulation-api.mjs")).href);
  for(const name of ["CFG_SIM","CFG_CAMP","CFG_FA","MAPA_LADO","MAPAS_POOL","PLAYSTYLES"])
    assert.deepEqual(plain(A[name]),plain(X[name]),`${name} público divergiu do legado`);
  for(const name of ["srand","rndF","gaussF","formaDoDia","sortearFormaCampanha",
    "forcaDoDia","prepTime","combateRound","simularMapa","simularSerie","createSimulationSession"])
    assert.equal(typeof A[name],"function",`${name} ausente da API pública`);

  X.srand(71);const expectedForces=T.slice(0,8).map(team=>X.forcaDoDia(team.ef,team.quim)),forceNext=X.rndF();
  A.srand(71);const actualForces=T.slice(0,8).map(team=>A.forcaDoDia(team.ef,team.quim)),actualForceNext=A.rndF();
  assert.deepEqual(actualForces,expectedForces,"força diária pública divergiu");
  assert.equal(actualForceNext,forceNext,"RNG da força diária pública divergiu");

  const cloneTeams=()=>X.TEAMS.map(team=>({nome:team.nome,
    jogadores:team.jogadores.map(player=>({...player._eng}))}));
  const legacyCampaign=cloneTeams();X.srand(83);X.sortearFormaCampanha(legacyCampaign);const campaignNext=X.rndF();
  const publicCampaign=cloneTeams();A.srand(83);A.sortearFormaCampanha(publicCampaign);const publicCampaignNext=A.rndF();
  assert.deepEqual(plain(publicCampaign),plain(legacyCampaign),"forma de campanha pública divergiu");
  assert.equal(publicCampaignNext,campaignNext,"RNG da campanha pública divergiu");

  const mapCases=Array.from({length:24},(_,index)=>({seed:1200+index,
    map:index%9===8?null:X.MAPAS_POOL[index%X.MAPAS_POOL.length],left:index%T.length,
    right:(index*7+1)%T.length,light:index%7===0,
    options:index%5===0?{telemetry:true}:undefined}));
  mapCases.forEach(({seed,map,left,right,light,options},index)=>{
    const a1=plain(T[left]),b1=plain(T[right]);X.srand(seed);
    const expected=plain(X.simularMapa(a1,b1,70,68,map,light,options)),nextExpected=X.rndF();
    const a2=plain(T[left]),b2=plain(T[right]);A.srand(seed);
    const result=A.simularMapa(a2,b2,70,68,map,light,options),actual=plain(result),nextActual=A.rndF();
    assert.deepEqual(actual,expected,`mapa público ${index}`);
    assert.equal(nextActual,nextExpected,`RNG do mapa público ${index}`);
    assert.equal(result.vencedor,actual.placar[0]>actual.placar[1]?a2:b2,`identidade do mapa ${index}`);
  });

  const seriesCases=[[3,3,false],[17,1,true],[211,5,false]];
  seriesCases.forEach(([seed,bestOf,light],index)=>{
    const a1=plain(T[index]),b1=plain(T[index+1]);X.srand(seed);
    const expected=plain(X.simularSerie(a1,b1,()=>X.forcaDoDia(a1.ef,a1.quim),
      ()=>X.forcaDoDia(b1.ef,b1.quim),bestOf,light)),nextExpected=X.rndF();
    const a2=plain(T[index]),b2=plain(T[index+1]);A.srand(seed);
    const result=A.simularSerie(a2,b2,()=>A.forcaDoDia(a2.ef,a2.quim),
      ()=>A.forcaDoDia(b2.ef,b2.quim),bestOf,light),actual=plain(result),nextActual=A.rndF();
    assert.deepEqual(actual,expected,`série pública ${index}`);
    assert.equal(nextActual,nextExpected,`RNG da série pública ${index}`);
    assert.equal(result.vencedor,actual.placarSerie[0]>actual.placarSerie[1]?a2:b2,
      `identidade da série pública ${index}`);
  });

  const first=A.createSimulationSession({seed:99}),second=A.createSimulationSession({seed:99});
  assert.equal(first.rndF(),second.rndF(),"sessões iguais não iniciaram na mesma sequência");
  first.rndF();
  const secondNext=second.rndF(),control=A.createSimulationSession({seed:99});
  control.rndF();assert.equal(secondNext,control.rndF(),"uma sessão deslocou o RNG de outra");
  const customCfg=plain(A.CFG_SIM),custom=A.createSimulationSession({seed:1,cfg:customCfg});
  assert.equal(custom.CFG_SIM,customCfg,"sessão não preservou a configuração injetada");

  console.log(`public simulation API: ok (${mapCases.length} mapas · ${seriesCases.length} séries · sessões isoladas)`);
}

main().catch(error=>{console.error(error);process.exitCode=1;});
