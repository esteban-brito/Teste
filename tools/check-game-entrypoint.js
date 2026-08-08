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
assert.match(game,/import \{setCardFlipped\} from "\.\/src\/application\/card-face\.mjs";/,
  "game.js não importa o controle acessível de face da carta");
assert.match(game,/import \{createDraftState,resetDraftState\} from "\.\/src\/application\/draft\/draft-state\.mjs";/,
  "game.js não importa o estado do draft");
assert.match(game,/import \{createMajorState,resetMajorState\} from "\.\/src\/application\/major\/major-state\.mjs";/,
  "game.js não importa o estado do Major");
assert.match(game,/import \{createMapPlaybackState,createMatchState,resetMatchState\} from "\.\/src\/application\/match\/match-state\.mjs";/,
  "game.js não importa os estados de reprodução e série");
assert.match(game,/import \{escapeHtml as esc\} from "\.\/src\/ui\/shared\/html\.mjs";/,
  "game.js não importa o escape HTML compartilhado");
assert.match(game,/import \{createCardView\} from "\.\/src\/ui\/game\/card-view\.mjs";/,
  "game.js não importa o renderizador de cartas");
assert.match(game,/import \{construirCartao\} from "\.\/src\/ui\/game\/build-summary-view\.mjs";/,
  "game.js não importa o renderizador do resumo de build");
/* `aplicarLado` entrou em 07/08/2026 com o chip de lado legível. Ele é importado
   e não reimplementado de propósito: quem MONTA o chip tem de ser quem o
   ATUALIZA na virada do round 13 — a versão anterior trocava o lado com
   `el.textContent="TR"` daqui, o que apagava a estrutura interna do chip montada
   lá. Duas verdades sobre a mesma peça é como a tabela ficou um lado atrás. */
assert.match(game,/import \{liveTeamHeaderHtml,prematchTeamHtml,aplicarLado,estiloDoTime,canaisDoTime\} from "\.\/src\/ui\/game\/team-view\.mjs";/,
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
assert.doesNotMatch(game,/\b(?:const|let|var) (?:S|TG|MP|MATCH)\s*=\s*\{/,
  "game.js voltou a embutir um dos estados da aplicação");

/* Os quatro estados nascem e são zerados nos módulos de `src/application`. A
   prova tem de ser a CHAMADA, não a grafia do reset: o padrão textual anterior
   memorizava a ordem histórica das chaves, então bastava reinlinar
   `Object.assign(S,{treinador:...,jogadores:...})` para passar limpo. E o import
   órfão também não segurava — `no-unused-vars` é `warn`, e o lint sai com 0.
   Contar chamadas fecha os dois furos de uma vez, porque reinlinar um reset
   apaga necessariamente o call site.

   As contagens descrevem o wiring ATUAL do entrypoint. Quando os controladores
   saírem (P5 §12) elas mudam de propósito: atualize o número junto com a
   extração; não afrouxe a asserção para fazer a fatia passar.

   Cuidado ao endurecer isto: `atualizarMajorUI()` zera `TG.times`/`TG.playoffs`
   quando o elenco deixa de estar completo, e `iniciarTorneio()` monta o Major
   campo a campo. Os dois são legítimos e precisam continuar passando — por isso
   a guarda mede chamada e mutação em massa, nunca escrita direta em campo. */
/* `resetDraftState` passou de 2 para 3 chamadas em 07/08/2026: entrou o botão de
   ELENCO ALEATÓRIO, que zera o draft antes de montar 5+1 de uma vez. É uso
   legítimo da mesma função — exatamente o que esta guarda quer proteger, já que
   a alternativa seria o botão limpar `S` campo a campo e reinlinar o reset. */
const CHAMADAS_DE_ESTADO=[
  ["createDraftState",1],["resetDraftState",3],
  ["createMajorState",1],["resetMajorState",1],
  ["createMapPlaybackState",1],["createMatchState",1],["resetMatchState",1]
];
for(const [nome,esperado] of CHAMADAS_DE_ESTADO){
  const chamadas=(game.match(new RegExp(`\\b${nome}\\(`,"g"))||[]).length;
  assert.equal(chamadas,esperado,
    `game.js deveria chamar ${nome}() ${esperado}× e chama ${chamadas}× — `+
    "reset reinlinado, ou controlador movido sem atualizar esta guarda");
}
assert.doesNotMatch(game,/Object\.assign\((?:S|TG|MP|MATCH),/,
  "game.js voltou a mutar um estado da aplicação em massa; use o reset do módulo");
assert.doesNotMatch(game,/\bS\.taken\.clear\(\)/,
  "game.js voltou a zerar o Set do draft fora de resetDraftState");
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
