/* Garante que o primeiro módulo de dados continue sendo uma cópia mecânica
   enquanto game.js permanecer como fonte executável. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {X}=require("../bancada/motor");

const EXPECTED_PLAYER_COUNT=85;
const DERIVED_FIELDS=[
  "primario","secundario","combatRole","role1","role2","playstyle",
  "sub","ovr","estrela","classe","esteira","style"
];

function plain(value){
  return JSON.parse(JSON.stringify(value));
}

function resolvedId(player){
  return player.id||player.nome;
}

async function main(){
  const moduleUrl=pathToFileURL(path.join(__dirname,"..","src","data","players.mjs")).href;
  const {RAW_PLAYERS}=await import(moduleUrl);
  const legacyPlayers=plain(X.ATRIBUTOS);

  assert.equal(RAW_PLAYERS.length,EXPECTED_PLAYER_COUNT,"quantidade de jogadores crus mudou");
  assert.deepEqual(RAW_PLAYERS,legacyPlayers,"src/data/players.mjs divergiu de game.js");

  const ids=RAW_PLAYERS.map(resolvedId);
  assert.equal(new Set(ids).size,ids.length,"IDs crus resolvidos precisam ser únicos");
  RAW_PLAYERS.forEach(player=>DERIVED_FIELDS.forEach(field=>{
    assert.equal(Object.hasOwn(player,field),false,`${resolvedId(player)} contém campo derivado ${field}`);
  }));

  console.log(`raw player parity: ok (${RAW_PLAYERS.length} registros)`);
}

main().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
