/* API pública de simulação — uma composição, um objeto de configuração e uma
   fonte de RNG por sessão. Nenhum consumidor precisa recortar `game.js`. */
export * from "./evaluation-api.mjs";

import {POOL} from "./evaluation-api.mjs";
import {CFG_PADRAO as CFG_QUIMICA} from "../domain/chemistry/team-chemistry.mjs";
import {styleAggression} from "../domain/evaluation/style-identity.mjs";
import {createMulberry32} from "../domain/simulation/random-source.mjs";
import {formaDoDia as playerForm,sortearFormaCampanha as drawCampaignForm}
  from "../domain/simulation/player-form.mjs";
import {forcaDoDia as teamForm} from "../domain/simulation/team-form.mjs";
import {combatProfile} from "../domain/simulation/combat-profile.mjs";
import {skillDuelo,fragPeso} from "../domain/simulation/duel-weights.mjs";
import {exposureProfile} from "../domain/simulation/exposure-profile.mjs";
import {preservationValue} from "../domain/simulation/preservation-value.mjs";
import {tradeContextProfile} from "../domain/simulation/trade-context.mjs";
import {assistContextProfile} from "../domain/simulation/assist-context.mjs";
import {computeSideMean,mapMultiplier,sideAffinity,prepareTeam}
  from "../domain/simulation/team-preparation.mjs";
import {computeCombatMeans,combateRound as runCombatRound}
  from "../domain/simulation/round-combat.mjs";
import {TELEMETRY_SCHEMA_VERSION,telemetryTeam}
  from "../domain/simulation/simulation-telemetry.mjs";
import {BUY,LOSS_BONUS,RECOMPENSA_ARMA,TETO_GRANA,PREMIO_VITORIA,PREMIO_OBJETIVO,
  decidirCompra,pagarCompra,compraDoTime} from "../domain/simulation/economy.mjs";
import {fallenAngels as calculateRating} from "../domain/simulation/fallen-angels.mjs";
import {simularMapa as runMap} from "../domain/simulation/map-simulation.mjs";
import {simularSerie as runSeries} from "../domain/simulation/series-simulation.mjs";
import {CFG_SIM,CFG_CAMP,CFG_FA,MAPA_LADO,MAPAS_POOL}
  from "../domain/simulation/simulation-config.mjs";

export {CFG_SIM,CFG_CAMP,CFG_FA,CFG_QUIMICA,MAPA_LADO,MAPAS_POOL,
  BUY,LOSS_BONUS,RECOMPENSA_ARMA,TETO_GRANA,PREMIO_VITORIA,PREMIO_OBJETIVO,
  TELEMETRY_SCHEMA_VERSION};

export const logistica=(left,right,divisor)=>1/(1+Math.pow(10,(right-left)/divisor));

export function createSimulationSession({pool=POOL,seed,cfg=CFG_SIM,cfgCamp=CFG_CAMP,
  cfgFa=CFG_FA,cfgQuimica=CFG_QUIMICA}={}){
  const rng=createMulberry32(seed);
  const players=Array.isArray(pool)?pool:Object.values(pool);
  const sideMean=computeSideMean(players,cfg);
  const combatMeans=computeCombatMeans(players,
    {preservationValue,tradeContextProfile,assistContextProfile});
  const profileFor=player=>combatProfile(player,cfg);
  const prepDependencies={
    gaussian:rng.gaussF,
    playerForm:(player,gaussian)=>playerForm(player,gaussian,cfg),
    duelSkill:player=>skillDuelo(player,profileFor(player),cfg),
    fragWeight:player=>fragPeso(player,profileFor(player),cfg),
    mapMultiplier:(player,map)=>mapMultiplier(player,map,cfg),
    sideAffinity:player=>sideAffinity(player,sideMean,cfg),
    styleAggression:player=>styleAggression(player,cfg.STYLE_AGR),
    exposureProfile:player=>exposureProfile(player,cfg),
    preservationValue,tradeContextProfile,assistContextProfile,combatProfile:profileFor
  };
  const roundDependencies={cfg,random:rng.rndF,gaussian:rng.gaussF,...combatMeans,
    premioVitoria:PREMIO_VITORIA,premioObjetivo:PREMIO_OBJETIVO};
  const prepTime=(team,map)=>prepareTeam(team,map,prepDependencies);
  const combateRound=(left,right,context)=>runCombatRound(left,right,context,roundDependencies);
  const mapDependencies={cfg,mapasPool:MAPAS_POOL,mapaLado:MAPA_LADO,buy:BUY,
    lossBonus:LOSS_BONUS,recompensaArma:RECOMPENSA_ARMA,tetoGrana:TETO_GRANA,
    random:rng.rndF,gaussian:rng.gaussF,prepTime,telemetryTeam,
    telemetrySchemaVersion:TELEMETRY_SCHEMA_VERSION,combatProfile:profileFor,
    decidirCompra,pagarCompra,compraDoTime,logistica,combateRound,
    fallenAngels:event=>calculateRating(event,cfgFa)};
  const simularMapa=(left,right,formLeft,formRight,map,light,options)=>
    runMap(left,right,formLeft,formRight,map,light,options,mapDependencies);
  const simularSerie=(left,right,formLeft,formRight,bestOf,light)=>
    runSeries(left,right,formLeft,formRight,bestOf,light,
      {mapasPool:MAPAS_POOL,random:rng.rndF,simularMapa});
  const formaDoDia=player=>playerForm(player,rng.gaussF,cfg);
  const sortearFormaCampanha=teams=>drawCampaignForm(teams,rng.gaussF,cfgCamp);
  const forcaDoDia=(effective,chemistry)=>teamForm(effective,chemistry,rng.rndF,cfg,cfgQuimica);
  return {CFG_SIM:cfg,CFG_CAMP:cfgCamp,CFG_FA:cfgFa,srand:rng.srand,rndF:rng.rndF,
    gaussF:rng.gaussF,formaDoDia,sortearFormaCampanha,forcaDoDia,prepTime,
    combateRound,simularMapa,simularSerie};
}

const DEFAULT_SESSION=createSimulationSession();
export const {srand,rndF,gaussF,formaDoDia,sortearFormaCampanha,forcaDoDia,
  prepTime,combateRound,simularMapa,simularSerie}=DEFAULT_SESSION;
