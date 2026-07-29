import {escapeHtml as esc} from "../shared/html.mjs";

export const teamMonogram=name=>name.replace(/[^A-Za-z0-9]/g,"").slice(0,2).toUpperCase();

export function teamChipHtml(team,loser){
  if(!team)return `<div class="team-chip"><div class="team-mono" style="background:#2a3346">?</div><span class="tn">—</span></div>`;
  return `<div class="team-chip${loser?" loser":""}"><div class="team-mono" style="background:${team.cor||"#888"}">${teamMonogram(team.nome)}</div><span class="tn">${esc(team.nome)}</span></div>`;
}

export function liveTeamHeaderHtml(team,side,sideElementId){
  return `<div class="team-mono" style="background:${team.cor||"#888"}">${teamMonogram(team.nome)}</div>`+
    `<div class="sb-info"><span class="sb-name">${esc(team.nome)}</span>${team.camp?`<span class="sb-camp">${esc(team.camp)}</span>`:""}<span class="sb-side ${side}" id="${sideElementId}">${side.toUpperCase()}</span></div>`;
}

export function prematchTeamHtml(team){
  return `<div class="team-mono" style="background:${team.cor||"#888"};width:74px;height:74px;font-size:1.5rem;border-radius:18px">${teamMonogram(team.nome)}</div>
    <div class="pm-name">${esc(team.nome)}</div>${team.camp?`<div class="pm-camp">${esc(team.camp)}</div>`:""}<div class="pm-ef">força <b>${team.ef}</b></div>`;
}
