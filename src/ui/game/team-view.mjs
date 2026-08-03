import {escapeHtml as esc} from "../shared/html.mjs";

export const teamMonogram=name=>name.replace(/[^A-Za-z0-9]/g,"").slice(0,2).toUpperCase();

/* A COR vem do dado e por isso viaja inline; a GEOMETRIA é do CSS e fica lá.

   Até 02/08/2026 `prematchTeamHtml` emitia `width:74px;height:74px;font-size:1.5rem;
   border-radius:18px` — os MESMOS quatro valores já declarados em
   `.pm-team .team-mono`. Duas fontes da verdade para uma medida, e nenhuma guarda
   olhando: mexer no CSS deixava o inline vencendo, por especificidade, sem nada
   reclamar. O tamanho da antessala continua onde sempre esteve, no CSS. */
/* Um fallback só. Havia dois — `#2a3346` para slot vazio do bracket e `#888` para
   time sem cor —, mas `cor` cobre os 17 elencos (provado por `check-data-catalog`),
   então o segundo caminho nunca foi alcançado. */
const COR_AUSENTE="#2a3346";
const monoHtml=team=>`<div class="team-mono" style="background:${esc(team?.cor||COR_AUSENTE)}">`+
  `${team?teamMonogram(team.nome):"?"}</div>`;

export function teamChipHtml(team,loser){
  if(!team)return `<div class="team-chip">${monoHtml(null)}<span class="tn">—</span></div>`;
  return `<div class="team-chip${loser?" loser":""}">${monoHtml(team)}<span class="tn">${esc(team.nome)}</span></div>`;
}

export function liveTeamHeaderHtml(team,side,sideElementId){
  return monoHtml(team)+
    `<div class="sb-info"><span class="sb-name">${esc(team.nome)}</span>${team.camp?`<span class="sb-camp">${esc(team.camp)}</span>`:""}<span class="sb-side ${side}" id="${sideElementId}">${side.toUpperCase()}</span></div>`;
}

export function prematchTeamHtml(team){
  return monoHtml(team)+`
    <div class="pm-name">${esc(team.nome)}</div>${team.camp?`<div class="pm-camp">${esc(team.camp)}</div>`:""}<div class="pm-ef">força <b>${team.ef}</b></div>`;
}
