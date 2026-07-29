/* Prova a preparação modular contra o motor legado para elenco, mapa, caches e
   consumo de RNG. O resultado completo inclui os jogadores já mutados pelos caches. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {X}=require("../bancada/motor");
const {ROOT}=require("../bancada/common");

const plain=value=>JSON.parse(JSON.stringify(value));
const load=relative=>import(pathToFileURL(path.join(ROOT,...relative.split("/"))).href);

async function main(){
  const [A,P,R,F,D,C,S,E,V,T,U]=await Promise.all([
    load("src/public/evaluation-api.mjs"),load("src/domain/simulation/team-preparation.mjs"),
    load("src/domain/simulation/random-source.mjs"),load("src/domain/simulation/player-form.mjs"),
    load("src/domain/simulation/duel-weights.mjs"),load("src/domain/simulation/combat-profile.mjs"),
    load("src/domain/evaluation/style-identity.mjs"),load("src/domain/simulation/exposure-profile.mjs"),
    load("src/domain/simulation/preservation-value.mjs"),load("src/domain/simulation/trade-context.mjs"),
    load("src/domain/simulation/assist-context.mjs")
  ]);
  const sideMean=P.computeSideMean(Object.values(A.POOL));
  const dependencies=rng=>({
    gaussian:rng.gaussF,playerForm:F.formaDoDia,
    duelSkill:player=>D.skillDuelo(player,C.combatProfile(player)),
    fragWeight:player=>D.fragPeso(player,C.combatProfile(player)),
    mapMultiplier:P.mapMultiplier,
    sideAffinity:player=>P.sideAffinity(player,sideMean),
    styleAggression:S.styleAggression,exposureProfile:E.exposureProfile,
    preservationValue:V.preservationValue,tradeContextProfile:T.tradeContextProfile,
    assistContextProfile:U.assistContextProfile,combatProfile:C.combatProfile
  });

  const cases=[];
  A.TEAMS.forEach((team,teamIndex)=>X.MAPAS_POOL.forEach((map,mapIndex)=>cases.push({
    seed:20260728+teamIndex*100+mapIndex,map,team:plain(team),label:`${team.nome}/${map}`
  })));
  cases.push(
    {seed:7,map:"Mirage",team:{nome:"Fallback",jogadores:[]},label:"time vazio"},
    {seed:11,map:"Mapa inexistente",team:{nome:"Aninhado",meu:true,
      time:{jogadores:plain(A.TEAMS[0].jogadores.slice(0,2))}},label:"time aninhado incompleto"},
    {seed:13,map:"Nuke",team:{nome:"Excedente",
      jogadores:plain([...A.TEAMS[0].jogadores,A.TEAMS[1].jogadores[0]])},label:"seis jogadores"}
  );

  cases.forEach(({seed,map,team,label})=>{
    X.srand(seed);
    const expected=plain(X.prepTime(plain(team),map)),nextExpected=X.rndF();
    const rng=R.createMulberry32(seed);
    const prepared=P.prepareTeam(plain(team),map,dependencies(rng));
    const actual=plain(prepared),nextActual=rng.rndF();
    assert.deepEqual(actual,expected,`preparação divergiu em ${label}`);
    assert.equal(nextActual,nextExpected,`consumo de RNG divergiu em ${label}`);
    assert.equal(prepared.js.length,5,`preparação não normalizou cinco jogadores em ${label}`);
  });

  const fallback=P.prepareTeam({nome:"Fallback",jogadores:[]},"Mirage",
    dependencies(R.createMulberry32(17)));
  assert.equal(fallback.js[0],fallback.js[4],"fallback deixou de reutilizar a mesma base");
  console.log(`team preparation parity: ok (${cases.length} casos · 17 times × 8 mapas · RNG conferido)`);
}

main().catch(error=>{console.error(error);process.exitCode=1;});
