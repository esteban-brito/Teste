/* Compara a fronteira combatProfile extraída com o legado para todo o elenco,
   wrappers usados pela aplicação e perfis sintéticos de fallback. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {X}=require("../bancada/motor");
const {ROOT}=require("../bancada/common");

function plain(value){
  return JSON.parse(JSON.stringify(value));
}

async function main(){
  const moduleUrl=pathToFileURL(path.join(ROOT,"src","domain","simulation","combat-profile.mjs")).href;
  const {combatProfile}=await import(moduleUrl);
  const players=Object.values(X.POOL);
  const synthetic=[null,{},
    {primario:"desconhecida",secundario:"Support"},
    {primario:"IGL",secundario:"AWPer"},
    {primario:"IGL"},
    {primario:"Support",combatRole:"Entry"},
    ...players,
    ...players.map(player=>({_eng:player})),
    ...players.map(player=>({primario:"Support",secundario:"Lurker",_eng:player}))
  ];

  synthetic.forEach((player,index)=>{
    const before=player==null?player:JSON.stringify(player);
    assert.deepEqual(combatProfile(player),plain(X.combatProfile(player)),`divergência no perfil ${index}`);
    if(player!=null)assert.equal(JSON.stringify(player),before,`perfil ${index} foi alterado`);
  });

  assert.equal(combatProfile({primario:"IGL",secundario:"Entry"}).activeCombatRole,"Entry",
    "IGL/Entry não ativou a função secundária no combate");
  assert.equal(combatProfile({primario:"IGL",combatRole:"AWPer",secundario:"Support"}).activeCombatRole,"AWPer",
    "combatRole classificada não prevaleceu para IGL");
  assert.equal(combatProfile({primario:"Lurker",secundario:"Entry"}).activeCombatRole,"Lurker",
    "não-IGL abandonou a função primária");

  console.log(`combat profile parity: ok (${synthetic.length} comparações)`);
}

main().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
