/* Garante que o jogo principal consome a mesma API pública do laboratório. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const game=fs.readFileSync(path.join(root,"game.js"),"utf8");

assert.match(html,/<script\s+type="module"\s+src="game\.js\?v=DEV"><\/script>/,
  "index.html não carrega game.js como módulo ES");
assert.match(game,/import \* as PublicEngine from "\.\/src\/public\/simulation-api\.mjs";/,
  "game.js não importa a API pública");
const marker=game.indexOf("// === UI START ==="),tail=game.slice(marker);
assert.ok(marker>=0,"marcador da UI ausente");
assert.match(tail,/new window\.URLSearchParams\(location\.search\)\.get\("e2e"\)==="1"/,
  "ponte E2E nÃ£o estÃ¡ protegida pelo parÃ¢metro de teste");
assert.match(tail,/Object\.defineProperty\(window,"__DRAFT9_E2E__"/,
  "ponte E2E explÃ­cita ausente");
for(const name of ["TEAMS","POOL","forcaTime","simularMapa","simularSerie","forcaDoDia",
  "sortearFormaCampanha","distribuirRoles","STYLE_LABEL","STYLE_ID","CFG_SIM","logistica",
  "srand","rndF","coletarMarcos","atualizarRecordes","manchete","narrativaMVP"]){
  assert.match(tail,new RegExp(`\\b${name}\\b`),`contrato ${name} não foi injetado na UI`);
}
console.log("game entrypoint: ok (módulo ES · API pública injetada)");
