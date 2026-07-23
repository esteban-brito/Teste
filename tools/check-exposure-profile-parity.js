/* Prova que a fronteira pura de exposição reproduz o motor legado para
   todo o elenco e para fallbacks relevantes, sem mutar os jogadores. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {X}=require("../bancada/motor");
const {ROOT}=require("../bancada/common");

function plain(value){
  return JSON.parse(JSON.stringify(value));
}

async function main(){
  const moduleUrl=pathToFileURL(path.join(ROOT,"src","domain","simulation","exposure-profile.mjs")).href;
  const {exposureProfile}=await import(moduleUrl);
  const players=Object.values(X.POOL);
  const synthetic=[null,{},
    {primario:"IGL",secundario:"Entry",en:95,op:70,cl:20,ut:60,sn:0},
    {primario:"IGL",secundario:"AWPer",en:10,op:70,cl:90,ut:80,sn:95},
    {primario:"Lurker",en:20,op:60,cl:90,ut:50,sn:0},
    ...players,...players.map(player=>({_eng:player}))
  ];

  synthetic.forEach((player,index)=>{
    const before=player==null?player:JSON.stringify(player);
    const actual=exposureProfile(player);
    assert.deepEqual(actual,plain(X.exposureProfile(player)),`divergência no perfil ${index}`);
    for(const phase of ["opening","preplant","postplant"]){
      for(const side of ["CT","TR"]){
        assert.ok(Number.isFinite(actual[phase][side])&&actual[phase][side]>0,
          `${index}: exposição inválida em ${phase}/${side}`);
      }
    }
    if(player!=null)assert.equal(JSON.stringify(player),before,`perfil ${index} foi alterado`);
  });

  const entry=exposureProfile({primario:"IGL",secundario:"Entry",en:90,op:70,cl:20,ut:50,sn:0});
  const awper=exposureProfile({primario:"IGL",secundario:"AWPer",en:10,op:70,cl:80,ut:50,sn:95});
  assert.ok(entry.opening.TR>awper.opening.TR,"função efetiva não diferenciou o primeiro contato");

  console.log(`exposure profile parity: ok (${synthetic.length} comparações)`);
}

main().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
