import {teamChipHtml} from "./team-view.mjs";

const SWISS_RECORDS=["0-0","1-0","0-1","2-0","1-1","0-2","2-1","1-2","2-2"];
const SWISS_FINAL_SLOTS=8;

/* Coluna de destino da Suíça (classificados ou eliminados). Mostra apenas os
   times que já chegaram: reservar as oito vagas enchia metade da tela de caixas
   vazias na rodada 0. O contador no cabeçalho preserva quantas faltam. */
function finalColumnHtml(label,headClass,slotClass,teams){
  const filled=teams.map(team=>
    `<div class="qualified-slot${slotClass}${team.meu?" mine":""}">${teamChipHtml(team)}</div>`).join("");
  return `<div class="swiss-col"><div class="swiss-colhead ${headClass}">${label}`+
    `<b class="swiss-count">${teams.length}/${SWISS_FINAL_SLOTS}</b></div>`+
    (filled||`<div class="swiss-col-vazio">nenhum ainda</div>`)+`</div>`;
}

export function swissBoardHtml({times,classificados,eliminados}){
  let html="";
  SWISS_RECORDS.forEach(record=>{
    const [wins,losses]=record.split("-").map(Number);
    const group=times.filter(team=>team.v===wins&&team.d===losses&&team.vivo);
    if(!group.length)return;
    html+=`<div class="swiss-col"><div class="swiss-colhead neutral">${wins}:${losses}</div>`+
      group.map(team=>`<div class="match${team.meu?" mine":""}">${teamChipHtml(team)}</div>`).join("")+`</div>`;
  });
  html+=finalColumnHtml("Classificados","qual","",classificados);
  html+=finalColumnHtml("Eliminados","elim"," elim-slot",eliminados);
  return html;
}

export function bracketSubtitle(playoffs){
  return playoffs.campeao?"· campeão coroado":["· quartas de final","· semifinais","· grande final"][playoffs.fase]||"";
}

function seriesHtml(playoffs,teamA,teamB,key,phase,currentPhase){
  const result=playoffs&&playoffs.res[key];
  const pending=!teamA||!teamB;
  const aWon=result&&result.vencedorSeed===teamA,bWon=result&&result.vencedorSeed===teamB;
  const active=!pending&&!result&&phase===currentPhase;
  return `<div class="series${(teamA?.meu||teamB?.meu)?" mine":""}${result?" done":""}${active?" ativa":""}">
    <div class="series-row${aWon?" win":""}${result&&!aWon?" lose":""}">${teamChipHtml(teamA)}<span class="sc">${result?result.placarSerie[0]:""}</span></div>
    <div class="series-sep"></div>
    <div class="series-row${bWon?" win":""}${result&&!bWon?" lose":""}">${teamChipHtml(teamB)}<span class="sc">${result?result.placarSerie[1]:""}</span></div></div>`;
}

export function bracketBoardHtml(playoffs){
  return `
    <div class="bracket-round">
      <div class="bracket-round-title">Quartas</div>
      ${playoffs.quartas.map((pair,index)=>seriesHtml(playoffs,pair[0],pair[1],"q"+index,0,playoffs.fase)).join("")}
    </div>
    <div class="bracket-round">
      <div class="bracket-round-title">Semifinais</div>
      ${seriesHtml(playoffs,playoffs.semi[0],playoffs.semi[1],"s0",1,playoffs.fase)}
      ${seriesHtml(playoffs,playoffs.semi[2],playoffs.semi[3],"s1",1,playoffs.fase)}
    </div>
    <div class="bracket-round">
      <div class="bracket-round-title">Final</div>
      ${seriesHtml(playoffs,playoffs.final[0],playoffs.final[1],"f",2,playoffs.fase)}
    </div>
    <div class="bracket-round champ-col">
      <div class="bracket-round-title">Campeão</div>
      <div class="champion${playoffs.campeao?" crowned":""}">
        ${playoffs.campeao?`<div class="cup-tag">CAMPEÃO</div>${teamChipHtml(playoffs.campeao)}<div class="champ-tag">${playoffs.campeao.meu?"VOCÊ É CAMPEÃO":"Campeão do Major"}</div>`
          :`<div class="cup-tag dim">—</div><div class="champ-wait">aguardando…</div>`}
      </div>
    </div>`;
}
