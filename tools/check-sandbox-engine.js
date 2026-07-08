const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const src = fs.readFileSync(path.join(root, "game.js"), "utf8");
const lines = src.split(/\r?\n/);
let cut = lines.findIndex(line => line.includes("// === UI START ==="));
if (cut < 0) cut = lines.findIndex(line => line.includes("document.getElementById"));
if (cut < 0) throw new Error("Nao encontrei o inicio da camada de UI em game.js");

const E = new Function(lines.slice(0, cut).join("\n") + `
return {
  TEAMS,
  avaliarJogador,
  distribuirRoles,
  forcaTime,
  aplicarAvaliacaoContextual
};`)();

let mismatches = 0;
E.TEAMS.forEach(team => {
  const rebuilt = team.jogadores.map(card => Object.assign({}, card._eng));
  E.distribuirRoles(rebuilt);
  rebuilt.forEach((player, index) => {
    const original = team.jogadores[index]._eng;
    const fields = ["role1", "role2", "combatRole", "primario", "secundario", "playstyle", "ovr"];
    fields.forEach(field => {
      if (player[field] !== original[field]) {
        mismatches += 1;
        console.error(`${team.nome} / ${player.nome}: ${field} esperado=${original[field]} atual=${player[field]}`);
      }
    });
  });
});

if (mismatches) {
  console.error(`sandbox/game engine mismatches: ${mismatches}`);
  process.exit(1);
}

console.log("sandbox/game engine check: ok");
