/* Garante que as definições de elencos continuem sendo uma cópia mecânica
   enquanto game.js permanecer como fonte executável. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {X}=require("../bancada/motor");

const EXPECTED_TEAM_COUNT=17;
const PLAYERS_PER_TEAM=5;
const DERIVED_FIELDS=["id","treinador","quim","forca","forcaBruta","forcaEfetiva"];

function plain(value){
  return JSON.parse(JSON.stringify(value));
}

function moduleUrl(filename){
  return pathToFileURL(path.join(__dirname,"..","src","data",filename)).href;
}

async function main(){
  const [{RAW_TEAMS},{RAW_PLAYERS}]=await Promise.all([
    import(moduleUrl("teams.mjs")),
    import(moduleUrl("players.mjs"))
  ]);
  const legacyTeams=plain(X.TIMES_DEF);
  const playerIds=new Set(RAW_PLAYERS.map(player=>player.id||player.nome));

  assert.equal(RAW_TEAMS.length,EXPECTED_TEAM_COUNT,"quantidade de elencos crus mudou");
  assert.deepEqual(RAW_TEAMS,legacyTeams,"src/data/teams.mjs divergiu de game.js");

  RAW_TEAMS.forEach((team,index)=>{
    assert.equal(team.jogadores.length,PLAYERS_PER_TEAM,`t${index} precisa ter cinco jogadores`);
    assert.equal(new Set(team.jogadores).size,PLAYERS_PER_TEAM,`t${index} repete jogador`);
    team.jogadores.forEach(playerId=>assert.ok(playerIds.has(playerId),`t${index} referencia ID ausente: ${playerId}`));
    DERIVED_FIELDS.forEach(field=>assert.equal(Object.hasOwn(team,field),false,`t${index} contém campo derivado ${field}`));
  });

  console.log(`raw team parity: ok (${RAW_TEAMS.length} elencos)`);
}

main().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
