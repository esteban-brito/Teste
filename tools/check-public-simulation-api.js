/* Exercita a composição pública inteira: configuração, forma, campanha, mapas,
   séries, identidade, determinismo e isolamento de RNG. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {ROOT}=require("../bancada/lib/common");

const plain=value=>JSON.parse(JSON.stringify(value));

function buildCombatTeams(engine){
  return engine.TEAMS.map(team=>{
    const coach=team.treinador;
    const strength=engine.forcaTime(team.jogadores.map(player=>player._eng),
      coach&&coach.carac,coach&&coach.ovr);
    return {nome:team.nome,jogadores:team.jogadores,ef:strength.efetiva,quim:strength.quimica};
  });
}

async function main(){
  const A=await import(pathToFileURL(path.join(ROOT,"src/public/simulation-api.mjs")).href);
  const teams=buildCombatTeams(A);
  for(const name of ["CFG_SIM","CFG_CAMP","CFG_FA","MAPA_LADO","MAPAS_POOL","PLAYSTYLES"])
    assert.ok(A[name]&&typeof A[name]==="object",`${name} ausente da API pública`);
  for(const name of ["srand","rndF","gaussF","formaDoDia","sortearFormaCampanha",
    "forcaDoDia","prepTime","combateRound","simularMapa","simularSerie","createSimulationSession"])
    assert.equal(typeof A[name],"function",`${name} ausente da API pública`);

  const forceA=A.createSimulationSession({seed:71});
  const expectedForces=teams.slice(0,8).map(team=>forceA.forcaDoDia(team.ef,team.quim));
  const expectedForceNext=forceA.rndF();
  const forceB=A.createSimulationSession({seed:71});
  assert.deepEqual(teams.slice(0,8).map(team=>forceB.forcaDoDia(team.ef,team.quim)),
    expectedForces,"força diária deixou de ser determinística");
  assert.equal(forceB.rndF(),expectedForceNext,"consumo de RNG da força diária variou");

  const cloneTeams=()=>A.TEAMS.map(team=>({nome:team.nome,
    jogadores:team.jogadores.map(player=>({...player._eng}))}));
  const campaignA=cloneTeams(),campaignB=cloneTeams();
  const campaignSessionA=A.createSimulationSession({seed:83});
  const campaignSessionB=A.createSimulationSession({seed:83});
  campaignSessionA.sortearFormaCampanha(campaignA);
  campaignSessionB.sortearFormaCampanha(campaignB);
  assert.deepEqual(plain(campaignB),plain(campaignA),"forma de campanha deixou de ser determinística");
  assert.equal(campaignSessionB.rndF(),campaignSessionA.rndF(),"consumo de RNG da campanha variou");

  const mapCases=Array.from({length:24},(_,index)=>({seed:1200+index,
    map:index%9===8?null:A.MAPAS_POOL[index%A.MAPAS_POOL.length],left:index%teams.length,
    right:(index*7+1)%teams.length,light:index%7===0,
    options:index%5===0?{telemetry:true}:undefined}));
  mapCases.forEach(({seed,map,left,right,light,options},index)=>{
    const first=A.createSimulationSession({seed}),second=A.createSimulationSession({seed});
    const a1=plain(teams[left]),b1=plain(teams[right]);
    const expected=plain(first.simularMapa(a1,b1,70,68,map,light,options));
    const expectedNext=first.rndF();
    const a2=plain(teams[left]),b2=plain(teams[right]);
    const result=second.simularMapa(a2,b2,70,68,map,light,options);
    assert.deepEqual(plain(result),expected,`mapa público ${index} deixou de ser determinístico`);
    assert.equal(second.rndF(),expectedNext,`consumo de RNG do mapa ${index} variou`);
    assert.equal(result.vencedor,expected.placar[0]>expected.placar[1]?a2:b2,
      `identidade do vencedor do mapa ${index} foi perdida`);
  });

  const seriesCases=[[3,3,false],[17,1,true],[211,5,false]];
  seriesCases.forEach(([seed,bestOf,light],index)=>{
    const first=A.createSimulationSession({seed}),second=A.createSimulationSession({seed});
    const a1=plain(teams[index]),b1=plain(teams[index+1]);
    const expected=plain(first.simularSerie(a1,b1,()=>first.forcaDoDia(a1.ef,a1.quim),
      ()=>first.forcaDoDia(b1.ef,b1.quim),bestOf,light));
    const expectedNext=first.rndF();
    const a2=plain(teams[index]),b2=plain(teams[index+1]);
    const result=second.simularSerie(a2,b2,()=>second.forcaDoDia(a2.ef,a2.quim),
      ()=>second.forcaDoDia(b2.ef,b2.quim),bestOf,light);
    assert.deepEqual(plain(result),expected,`série pública ${index} deixou de ser determinística`);
    assert.equal(second.rndF(),expectedNext,`consumo de RNG da série ${index} variou`);
    assert.equal(result.vencedor,expected.placarSerie[0]>expected.placarSerie[1]?a2:b2,
      `identidade do vencedor da série ${index} foi perdida`);
  });

  const first=A.createSimulationSession({seed:99}),second=A.createSimulationSession({seed:99});
  assert.equal(first.rndF(),second.rndF(),"sessões iguais não iniciaram na mesma sequência");
  first.rndF();
  const secondNext=second.rndF(),control=A.createSimulationSession({seed:99});
  control.rndF();assert.equal(secondNext,control.rndF(),"uma sessão deslocou o RNG de outra");
  const customCfg=plain(A.CFG_SIM),custom=A.createSimulationSession({seed:1,cfg:customCfg});
  assert.equal(custom.CFG_SIM,customCfg,"sessão não preservou a configuração injetada");
  A.srand(515);const defaultSample=A.rndF();A.srand(515);
  assert.equal(A.rndF(),defaultSample,"sessão padrão não respeita srand");

  console.log(`public simulation API: ok (${mapCases.length} mapas · ${seriesCases.length} séries · sessões isoladas)`);
}

main().catch(error=>{console.error(error);process.exitCode=1;});
