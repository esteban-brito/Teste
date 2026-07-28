/* Garante que os metadados de país continuem sendo uma cópia mecânica
   enquanto game.js permanecer como fonte executável.

   Desde 28/07/2026 são DUAS tabelas com chaves declaradas: PAIS_JOGADOR pelo ID
   cru e PAIS_TREINADOR pelo nome do treinador. O checador prova a paridade das
   duas e, além disso, que a resolução cobre os 85 jogadores e os 15 treinadores
   — a cobertura é o que realmente importa, e ela não pode cair em silêncio. */
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
  const [{PAIS_JOGADOR,PAIS_TREINADOR},{ATRIBUTOS},{TIMES_DEF}]=await Promise.all([
    import(moduleUrl("countries.mjs")),
    import(moduleUrl("players.mjs")),
    import(moduleUrl("teams.mjs"))
  ]);

  assert.deepEqual(PAIS_JOGADOR,plain(X.PAIS_JOGADOR),"PAIS_JOGADOR divergiu de game.js");
  assert.deepEqual(PAIS_TREINADOR,plain(X.PAIS_TREINADOR),"PAIS_TREINADOR divergiu de game.js");

  [...Object.entries(PAIS_JOGADOR),...Object.entries(PAIS_TREINADOR)].forEach(([key,country])=>{
    assert.match(country,/^[A-Z]{3}$/,`país inválido para ${key}`);
  });

  // PAIS_JOGADOR indexa pelo ID cru: nenhuma chave pode ser um nome que não seja ID.
  const ids=new Set(ATRIBUTOS.map(player=>player.id||player.nome));
  Object.keys(PAIS_JOGADOR).forEach(key=>{
    assert.ok(ids.has(key),`PAIS_JOGADOR["${key}"] não corresponde a nenhum ID cru`);
  });

  // cobertura: todo jogador e todo treinador precisam resolver um país
  ATRIBUTOS.forEach(player=>{
    const id=player.id||player.nome;
    assert.notEqual(player.pais||PAIS_JOGADOR[id],undefined,`país ausente para ${id}`);
  });
  TIMES_DEF.filter(team=>team.coach).forEach(team=>{
    assert.notEqual(team.coachPais||PAIS_TREINADOR[team.coach],undefined,
      `país ausente para treinador de ${team.nome}`);
  });

  console.log(`raw country parity: ok (${Object.keys(PAIS_JOGADOR).length} jogadores · `+
    `${Object.keys(PAIS_TREINADOR).length} treinadores)`);
}

main().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
