import {escapeHtml as esc} from "../shared/html.mjs";
import {teamMonogram} from "./team-view.mjs";

export function scoreboardSideHtml({name,mine,side,color,stats}){
  const row=player=>`<div class="ls-row${mine?" mine":""}" data-nick="${esc(player.nick)}">
    <span class="ls-nick">${esc(player.nick)}</span>
    <span class="ls-kd-val"><b>0</b> <s>/</s> 0</span>
    <span class="ls-kast">–</span>
    <span class="ls-adr">–</span>
    <span class="ls-rate">–</span></div>`;
  const head=`<div class="ls-head">
    <span class="ls-team-id"><span class="ls-mono" style="background:${esc(color||"#888")}">${esc(teamMonogram(name))}</span><span class="ls-team">${esc(name)}</span><span class="ls-side-tag ${side}">${side.toUpperCase()}</span></span>
    <span class="ls-col">K–D</span>
    <span class="ls-col">KAST</span>
    <span class="ls-col">ADR</span>
    <span class="ls-col">Rating</span></div>`;
  return head+stats.map(row).join("");
}
