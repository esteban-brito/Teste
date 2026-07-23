/* Compara o sinal puro de utilidade para assistência entre módulo e adapter. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {X}=require("../bancada/motor");
const {ROOT}=require("../bancada/common");

function plain(value){
  return JSON.parse(JSON.stringify(value));
}

async function main(){
  const moduleUrl=pathToFileURL(path.join(ROOT,"src","domain","simulation","assist-context.mjs")).href;
  const {assistContextProfile}=await import(moduleUrl);
  const players=Object.values(X.POOL);
  const synthetic=[null,{}, {ut:95}, {ut:10}, ...players,...players.map(player=>({_eng:player}))];

  synthetic.forEach((player,index)=>{
    const before=player==null?player:JSON.stringify(player);
    const actual=assistContextProfile(player);
    assert.deepEqual(actual,plain(X.assistContextProfile(player)),`divergência no contexto ${index}`);
    assert.ok(Number.isFinite(actual.utility),`${index}: contexto inválido`);
    if(player!=null)assert.equal(JSON.stringify(player),before,`perfil ${index} foi alterado`);
  });

  assert.ok(assistContextProfile({ut:95}).utility>assistContextProfile({ut:10}).utility,
    "utility não diferenciou oportunidade de assistência");
  console.log(`assist context parity: ok (${synthetic.length} comparações)`);
}

main().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
