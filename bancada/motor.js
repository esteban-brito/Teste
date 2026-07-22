/* bancada/motor.js - carrega os motores de game.js em Node, sem DOM.
   Uso: const {X,T}=require("./motor"); */
const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {ROOT}=require("./common");

const GAME_PATH=path.join(ROOT,"game.js");
const UI_MARKER="// === UI START ===";
const EXPORTS=[
  "TEAMS","POOL","ATRIBUTOS","TIMES_DEF","PAISES_MAP",
  "forcaTime","simularMapa","simularSerie","forcaDoDia","sortearFormaCampanha",
  "avaliarJogador","aplicarAvaliacaoContextual","distribuirRoles","quimicaComposicao","fallenAngels",
  "afinidades","roleAfinidade","rolePairReality","secondaryScore","roleStyleReality","STYLE_LABEL","styleScoreTable","nmOVR",
  "CFG_AVALIACAO","NM_DEF"
];

function loadEngines(){
  const source=fs.readFileSync(GAME_PATH,"utf8").split("\n");
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
