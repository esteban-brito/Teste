/* Compara os sinais puros de contexto de trade entre módulo e adapter. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {X}=require("../bancada/motor");
const {ROOT}=require("../bancada/common");

function plain(value){
  return JSON.parse(JSON.stringify(value));
}

async function main(){
  const moduleUrl=pathToFileURL(path.join(ROOT,"src","domain","simulation","trade-context.mjs")).href;
  const {tradeContextProfile}=await import(moduleUrl);
  const players=Object.values(X.POOL);
  const synthetic=[null,{},
    {tr:90,ut:85,en:80},
    {tr:20,ut:30,en:15},
    ...players,...players.map(player=>({_eng:player}))
  ];

  synthetic.forEach((player,index)=>{
    const before=player==null?player:JSON.stringify(player);
    const actual=tradeContextProfile(player);
    assert.deepEqual(actual,plain(X.tradeContextProfile(player)),`divergência no contexto ${index}`);
    assert.ok(Number.isFinite(actual.readiness)&&Number.isFinite(actual.tradeability),`${index}: contexto inválido`);
    if(player!=null)assert.equal(JSON.stringify(player),before,`perfil ${index} foi alterado`);
  });

  const ready=tradeContextProfile({tr:90,ut:85,en:80});
  const isolated=tradeContextProfile({tr:20,ut:30,en:15});
  assert.ok(ready.readiness>isolated.readiness&&ready.tradeability>isolated.tradeability,
    "atributos não diferenciaram oportunidade de trade");
  console.log(`trade context parity: ok (${synthetic.length} comparações)`);
}

main().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
