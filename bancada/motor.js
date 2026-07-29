/* Ponte CommonJS das bancadas para a API pública do domínio.
   Cada loadEngines cria uma sessão própria de RNG; dados e configurações continuam
   compartilhados deliberadamente, como no runtime do navegador. */
const PUBLIC_ENGINE=require("../src/public/simulation-api.mjs");

function loadEngines(options={}){
  const state=PUBLIC_ENGINE.buildEvaluationState();
  const session=PUBLIC_ENGINE.createSimulationSession({...options,pool:options.pool??state.POOL});
  return {...PUBLIC_ENGINE,...state,...session};
}

function buildCombatTeams(engine){
  return engine.TEAMS.map(team=>{
    const players=team.jogadores.map(player=>player._eng);
    const coach=team.treinador;
    const strength=engine.forcaTime(players,coach&&coach.carac,coach&&coach.ovr);
    return {nome:team.nome,jogadores:team.jogadores,ef:strength.efetiva,quim:strength.quimica};
  });
}

const X=loadEngines();
const T=buildCombatTeams(X);

module.exports={X,T,loadEngines,buildCombatTeams};
