/* Identidade observável da simulação. Telemetria lê decisões já tomadas e não
   pode consumir RNG nem alterar o resultado esportivo. */
export const TELEMETRY_SCHEMA_VERSION=1;

export function telemetryPlayerId(team,index){
  const player=team.js[index];
  return player.id||player.nome||player.nick||`${team.nome}:${index}`;
}

export function telemetryTeam(team){
  return {name:team.nome,players:team.js.map((player,index)=>({
    index,id:telemetryPlayerId(team,index),nick:player.nick||player.nome||team.nome,
    role:player.primario||null,secondaryRole:player.secundario||null,
    combatRole:player.combatRole||null
  }))};
}
