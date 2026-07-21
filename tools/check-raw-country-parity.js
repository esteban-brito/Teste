/* Garante que os metadados de país continuem sendo uma cópia mecânica
   enquanto game.js permanecer como fonte executável. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {X}=require("../bancada/motor");

function plain(value){
  return JSON.parse(JSON.stringify(value));
}

function moduleUrl(filename){
  return pathToFileURL(path.join(__dirname,"..","src","data",filename)).href;
}

async function main(){
  const [{PAISES_MAP},{ATRIBUTOS},{TIMES_DEF}]=await Promise.all([
    import(moduleUrl("countries.mjs")),
    import(moduleUrl("players.mjs")),
    import(moduleUrl("teams.mjs"))
  ]);

  assert.deepEqual(PAISES_MAP,plain(X.PAISES_MAP),"src/data/countries.mjs divergiu de game.js");
  Object.entries(PAISES_MAP).forEach(([name,country])=>{
    assert.match(country,/^[A-Z]{3}$/,`país inválido para ${name}`);
  });
  ATRIBUTOS.forEach(player=>{
    assert.notEqual(player.pais||PAISES_MAP[player.nome],undefined,`país ausente para ${player.id||player.nome}`);
  });
  TIMES_DEF.filter(team=>team.coach).forEach(team=>{
    const country=team.coachPais||PAISES_MAP[team.coach]||PAISES_MAP[team.nome];
    assert.notEqual(country,undefined,`país ausente para treinador de ${team.nome}`);
  });

  console.log(`raw country parity: ok (${Object.keys(PAISES_MAP).length} entradas)`);
}

main().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
