import {rolePairReality} from "./role-pair-reality.mjs";

/* PRISMA: pontuação usada para escolher a role secundária.
   Extração mecânica de game.js; valores e ordem das operações são contrato. */
export function secondaryScore(primary,secondary,player,scores){
  return (scores[secondary]??0)-rolePairReality(primary,secondary,player).cost*18;
}
