/* Guarda os dois consumidores de navegador: ambos devem importar a API pública
   e nenhum pode voltar a recortar ou avaliar o texto de game.js. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");

const root=path.resolve(__dirname,"..");
async function main(){
  const E=await import(pathToFileURL(path.join(root,"src","public","simulation-api.mjs")).href);
  let mismatches=0;
  E.TEAMS.forEach(team=>{
    const rebuilt=team.jogadores.map(card=>({...card._eng}));
    E.distribuirRoles(rebuilt);
    rebuilt.forEach((player,index)=>{
      const original=team.jogadores[index]._eng;
      for(const field of ["role1","role2","combatRole","primario","secundario","playstyle","ovr"]){
        if(player[field]===original[field])continue;
        mismatches++;
        console.error(`${team.nome} / ${player.nome}: ${field} esperado=${original[field]} atual=${player[field]}`);
      }
    });
  });
  assert.equal(mismatches,0,"API pública reconstruiu o elenco com divergências");

  for(const file of ["sandbox.html","calibrador-worker.js"]){
    const source=fs.readFileSync(path.join(root,file),"utf8");
    assert.match(source,/src\/public\/simulation-api\.mjs/,`${file} não importa a API pública`);
    assert.doesNotMatch(source,/fetch\(["']game\.js|engineSlice|linhas\.slice\(0,\s*cut\)/,
      `${file} voltou a recortar game.js`);
  }
  console.log("public browser engine consumers: ok (sandbox + worker)");
}

main().catch(error=>{console.error(error);process.exitCode=1;});
