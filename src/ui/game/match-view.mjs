import {escapeHtml as esc} from "../shared/html.mjs";
import {teamMonogram} from "./team-view.mjs";

import {fundoParaSiglaBranca,TINTA_CLARA} from "../shared/contrast.mjs";

/* O LADO DEIXOU DE SER UM CHIP AQUI — 07/08/2026, a pedido: *"e se eles ficassem
   inteiramente nas cores de CT ou TR? […] aí não precisa escrever nada do tipo
   TR Ataque CT Defesa. Quanto mais visual, design, e menos texto, melhor."*
   O BLOCO INTEIRO passou a carregar a cor do lado, e alterna na virada do round
   13 — uma área de centenas de px² diz o que um chip de 447 px² dizia por
   escrito. O nome por extenso e o `aria-label` continuam existindo no chip do
   TOPO, que é o canal de quem não lê a cor: perder o texto nos dois lugares
   deixaria a informação só em cor, e isso o projeto não aceita.
   Por isso `side` saiu da assinatura: quem pinta o lado agora é `definirLados`,
   em `game.js`, na classe do bloco — e a regra 45 diz que quem MONTA a peça tem
   de ser quem a ATUALIZA. */
export function scoreboardSideHtml({name,mine,color,stats}){
  const row=player=>`<div class="ls-row${mine?" mine":""}" data-nick="${esc(player.nick)}">
    <span class="ls-nick">${esc(player.nick)}</span>
    <span class="ls-kd-val"><b>0</b> <s>/</s> 0</span>
    <span class="ls-kast">–</span>
    <span class="ls-adr">–</span>
    <span class="ls-rate">–</span></div>`;
  const cor=color||"#888";
  const head=`<div class="ls-head">
    <span class="ls-team-id"><span class="ls-mono" style="background:${esc(fundoParaSiglaBranca(cor))};color:${TINTA_CLARA}">${esc(teamMonogram(name))}</span><span class="ls-team">${esc(name)}</span></span>
    <span class="ls-col">K–D</span>
    <span class="ls-col">KAST</span>
    <span class="ls-col">ADR</span>
    <span class="ls-col">Rating</span></div>`;
  return head+stats.map(row).join("");
}
