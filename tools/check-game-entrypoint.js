/* Garante que o jogo principal consome a API pública sem domínio duplicado. */
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
assert.match(game,/import \{Audio\} from "\.\/src\/application\/audio\.mjs";/,
  "game.js não importa o efeito público de áudio");
assert.match(game,/import \{PROGRESSO\} from "\.\/src\/infrastructure\/persistence\/progress-store\.mjs";/,
  "game.js não importa o adaptador de persistência");
assert.match(game,/import \{escapeHtml as esc\} from "\.\/src\/ui\/shared\/html\.mjs";/,
  "game.js não importa o escape HTML compartilhado");
assert.match(game,/import \{createCardView\} from "\.\/src\/ui\/game\/card-view\.mjs";/,
  "game.js não importa o renderizador de cartas");
assert.match(game,/import \{construirCartao\} from "\.\/src\/ui\/game\/build-summary-view\.mjs";/,
  "game.js não importa o renderizador do resumo de build");
assert.match(game,/import \{liveTeamHeaderHtml,prematchTeamHtml\} from "\.\/src\/ui\/game\/team-view\.mjs";/,
  "game.js não importa a view compartilhada de times");
assert.match(game,/import \{swissBoardHtml,bracketSubtitle,bracketBoardHtml\} from "\.\/src\/ui\/game\/tournament-view\.mjs";/,
  "game.js não importa a view do torneio");
assert.match(game,/import \{scoreboardSideHtml\} from "\.\/src\/ui\/game\/match-view\.mjs";/,
  "game.js não importa a view da partida");
assert.match(game,/import \{headlineHtml,campaignFinalView,campaignScoreHtml,hallView\} from "\.\/src\/ui\/game\/history-view\.mjs";/,
  "game.js não importa a view de campanha e Hall");
assert.doesNotMatch(game,/\bconst Audio\s*=\s*\{/,
  "game.js voltou a embutir o serviço de áudio");
assert.doesNotMatch(game,/\bconst PROGRESSO\s*=\s*\{/,
  "game.js voltou a embutir o serviço de persistência");
assert.doesNotMatch(game,/\bconst (?:ROLE_COR|STAT_LABEL|SELO_META)\s*=\s*\{/,
  "game.js voltou a embutir templates ou metadados das cartas");
assert.doesNotMatch(game,/\b(?:function (?:chip|serieEl|monoChip)|const mono\s*=)/,
  "game.js voltou a embutir templates ou identidade visual de times");
assert.doesNotMatch(game,/\/\/ === UI START ===/,
  "game.js voltou a usar comentário como fronteira de API");
assert.doesNotMatch(game,/\b(?:const ATRIBUTOS|function simularMapa|function avaliarJogador)\b/,
  "game.js voltou a embutir domínio ou dados");

const applicationStart=game.indexOf("const SPIN_MS"),preamble=game.slice(0,applicationStart);
assert.ok(applicationStart>0,"início da aplicação ausente");
assert.match(game,/new window\.URLSearchParams\(location\.search\)\.get\("e2e"\)==="1"/,
  "ponte E2E não está protegida pelo parâmetro de teste");
assert.match(game,/Object\.defineProperty\(window,"__DRAFT9_E2E__"/,
  "ponte E2E explícita ausente");
for(const name of ["TEAMS","POOL","forcaTime","simularMapa","simularSerie","forcaDoDia",
  "sortearFormaCampanha","distribuirRoles","STYLE_LABEL","STYLE_ID","CFG_SIM","logistica",
  "STYLE_RECIPE","srand","rndF","coletarMarcos","atualizarRecordes","manchete","narrativaMVP",
  "RECORDE_LABELS"]){
  assert.match(preamble,new RegExp(`\\b${name}\\b`),
    `contrato ${name} não foi importado pela aplicação`);
}
console.log("game entrypoint: ok (módulo ES · sem bloco legado)");
