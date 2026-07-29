/* bancada/motor.js - carrega os motores de game.js em Node, sem DOM.
   Uso: const {X,T}=require("./motor"); */
const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {ROOT}=require("./common");

const GAME_PATH=path.join(ROOT,"game.js");
const UI_MARKER="// === UI START ===";
const PUBLIC_ENGINE_IMPORT='import * as PublicEngine from "./src/public/simulation-api.mjs";';
const EXPORTS=[
  "TEAMS","POOL","ATRIBUTOS","TIMES_DEF","PAIS_JOGADOR","PAIS_TREINADOR",
  "forcaTime","simularMapa","simularSerie","forcaDoDia","formaDoDia","sortearFormaCampanha",
  "avaliarJogador","aplicarAvaliacaoContextual","distribuirRoles","quimicaComposicao","combatProfile","exposureProfile","preservationValue","tradeContextProfile","assistContextProfile","fallenAngelsComponents","fallenAngels",
  "afinidades","roleAfinidade","rolePairReality","secondaryScore","roleStyleReality","STYLE_LABEL","styleScoreTable","nmOVR",
  "CFG_AVALIACAO","NM_DEF",
  // tabelas de função: o checador de paridade compara valor a valor e ainda prova
  // o comportamento sob tabela CALIBRADA (é o que o calibrador muta)
  "ROLE_PERFIL","ROLE_CONTRA","IGL_ROLE_AFIN","ROLE_RULES","ROLES_COMBATE",
  "classificar","roleSecundarioSeguro",
  // ZÊNITE: o checador compara a tabela de estilos posição a posição, não só o vencedor
  "STYLE_CONTRA","nmStats6","stats7","styleMatch","badBaiterProfile","jokerProfile",
  "ovrUnificado","CFG_NIVEL",
  // SINAPSE: química de elenco, força efetiva e característica do treinador
  "ovrTreinador","quimicaPlaystyles","derivaCaracteristica","CFG_QUIMICA",
  // MARÉ: o checador precisa do gerador para provar CONSUMO de azar, não só valor
  "gaussF","PERFIL_TIER","PERFIL_ROLE","centroOVR","formaPositiva","formaCaudaLivre",
  "skillDuelo","fragPeso",
  // COFRE: decisão, aplicação e tabelas precisam ser comparadas sem reinterpretar a economia
  "BUY","CUSTO","CUSTO_REPOR","RECOMPENSA_ARMA","PREMIO_VITORIA","PREMIO_OBJETIVO","LOSS_BONUS","TETO_GRANA","PRECO_RIFLE",
  "leituraDoInimigo","decidirCompra","pagarCompra","compraDoTime",
  // orquestração de mapa: dependências explícitas para a prova da fatia round a round
  "prepTime","telemetryTeam","TELEMETRY_SCHEMA_VERSION","combateRound","MAPA_LADO",
  // identidade e balanceamento: a bancada de perfis precisa ler playstyle e config sem duplicar tabelas
  "PLAYSTYLES","PLAYSTYLE_IDS","STYLE_ID","styleAgr","styleTraits","tierDe","MAPAS_POOL",
  "CFG_SIM","CFG_FA","CFG_CAMP","PERFIL_TIER","logistica","rndF",
  "coletarMarcos","atualizarRecordes","manchete","narrativaMVP"
];

function loadEngines(){
  const source=fs.readFileSync(GAME_PATH,"utf8").split("\n")
    .filter(line=>line.trim()!==PUBLIC_ENGINE_IMPORT);
  let cut=source.findIndex(line=>line.includes(UI_MARKER));
  if(cut<0)cut=source.findIndex(line=>line.includes("document.getElementById"));
  if(cut<0)throw new Error(`marcador de UI nao encontrado em ${GAME_PATH}`);

  const sandbox={Math,Object,Array,JSON,console};
  vm.createContext(sandbox);
  const exportExpr=EXPORTS.map(name=>`${name}:${name}`).join(",");
  const code=source.slice(0,cut).join("\n")+
    `;globalThis.X={${exportExpr},srand:typeof srand!=="undefined"?srand:null};`;
  vm.runInContext(code,sandbox,{filename:GAME_PATH});
  if(!sandbox.X)throw new Error(`motores nao foram exportados de ${GAME_PATH}`);
  return sandbox.X;
}

function buildCombatTeams(X){
  return X.TEAMS.map(team=>{
    const players=team.jogadores.map(player=>player._eng);
    const coach=team.treinador;
    const strength=X.forcaTime(players,coach&&coach.carac,coach&&coach.ovr);
    return {nome:team.nome,jogadores:team.jogadores,ef:strength.efetiva,quim:strength.quimica};
  });
}

const X=loadEngines();
const T=buildCombatTeams(X);

module.exports={X,T,loadEngines,buildCombatTeams};
