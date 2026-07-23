/* Compara o valor abstrato de preservação entre módulo puro e adapter. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {X}=require("../bancada/motor");
const {ROOT}=require("../bancada/common");

async function main(){
  const moduleUrl=pathToFileURL(path.join(ROOT,"src","domain","simulation","preservation-value.mjs")).href;
  const {preservationValue}=await import(moduleUrl);
  const players=Object.values(X.POOL);
  const synthetic=[null,{},
    {sn:95,cl:80,ut:60,fp:75},
    {sn:0,cl:20,ut:40,fp:55},
    ...players,...players.map(player=>({_eng:player}))
  ];

  synthetic.forEach((player,index)=>{
    const before=player==null?player:JSON.stringify(player);
    const actual=preservationValue(player);
    assert.equal(actual,X.preservationValue(player),`divergência no valor ${index}`);
    assert.ok(Number.isFinite(actual)&&actual>=0,`${index}: valor inválido`);
    if(player!=null)assert.equal(JSON.stringify(player),before,`perfil ${index} foi alterado`);
  });

  assert.ok(preservationValue({sn:95,cl:80,ut:60,fp:75})>
    preservationValue({sn:0,cl:20,ut:40,fp:55}),"stats não diferenciaram preservação");
  console.log(`preservation value parity: ok (${synthetic.length} comparações)`);
}

main().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
