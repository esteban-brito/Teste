import {escapeHtml as esc} from "../shared/html.mjs";

const ROLE_VIEW={Entry:{a:"ENT",c:"var(--r-entry)"},Rifler:{a:"RIF",c:"var(--r-rifler)"},AWPer:{a:"AWP",c:"var(--r-awper)"},Lurker:{a:"LUR",c:"var(--r-lurker)"},Support:{a:"SUP",c:"var(--r-support)"},IGL:{a:"IGL",c:"var(--r-igl)"}};
const ratingClass=rating=>rating>=1.15?"r-top":rating>=0.95?"r-mid":"r-low";
const ratingBarWidth=rating=>Math.round(Math.max(0,Math.min(1,(rating-.6)/1.4))*100);

export function headlineHtml(headline,newRecords){
  const chips=(newRecords||[]).map(record=>`<span class="rec-chip">🏆 ${esc(record.nick?record.nick+" · ":"")}${record.v} ${esc(record.label)}</span>`).join("");
  return `<span class="manchete-tag">MANCHETE</span><span class="manchete-tx">${esc(headline.texto)}</span>${chips?`<span class="manchete-recs">${chips}</span>`:""}`;
}

export function campaignFinalView({campaign,champion,ranking,roster,narrative}){
  const mvp=ranking[0];
  const seals=champion?(campaign.mapasD===0?["CAMPEÃO","9-0 INVICTO"]:["CAMPEÃO"]):["ELIMINADO"];
  const sealsHtml=seals.map(seal=>`<span class="selo-final${seal.indexOf("INVICTO")>=0?" selo-gold":""}">${esc(seal)}</span>`).join("");
  let mvpHtml=null;
  if(mvp){const enginePlayer=roster[mvp.nick]||{};const role=ROLE_VIEW[enginePlayer.primario]||{a:"",c:"#6c7d93"};
    mvpHtml=`<div class="mvp-badge">MVP</div>`+
      `<div class="mvp-id">${enginePlayer.pais?`<span class="mvp-flag">${esc(enginePlayer.pais)}</span>`:""}<span class="mvp-nick">${esc(mvp.nick)}</span>`+
      `${role.a?`<span class="mvp-role" style="--rc:${role.c}">${role.a}</span>`:""}${enginePlayer.ovr!=null?`<span class="mvp-ovr">OVR ${enginePlayer.ovr}</span>`:""}</div>`+
      `<div class="mvp-stats">${mvp.k} / ${mvp.d} / ${mvp.a} <span>K·D·A</span></div>`+
      `<div class="mvp-rate ${ratingClass(mvp.r)}">${mvp.r.toFixed(2)}</div>`+
      (narrative?`<div class="mvp-narrativa">${esc(narrative.texto)}</div>`:"");
  }
  const journey=campaign.jornada||[];
  const journeyHtml=journey.length?`<div class="sec-lbl">A JORNADA</div><div class="jor-tiles">`+journey.map(match=>`<div class="jt ${match.venc?"jt-w":"jt-l"}"><span class="jt-adv">${esc(String(match.adv||"").slice(0,4))}</span><span class="jt-sc">${match.meu}-${match.dele}</span></div>`).join("")+`</div>`:"";
  const ratingsHtml=`<div class="sec-lbl">ELENCO</div>`+ranking.map((player,index)=>{const enginePlayer=roster[player.nick]||{};const role=ROLE_VIEW[enginePlayer.primario]||{a:"",c:"#6c7d93"};const medal=index===0?"md-g":index===1?"md-s":index===2?"md-b":"";
    return `<div class="fr-row${index===0?" mvp":""}"><span class="fr-pos ${medal}">${index+1}</span><span class="fr-role"${role.a?` style="--rc:${role.c}"`:""}>${role.a}</span><span class="fr-nick">${esc(player.nick)}</span><span class="fr-ovr">${enginePlayer.ovr!=null?enginePlayer.ovr:""}</span><span class="fr-bar"><i style="width:${ratingBarWidth(player.r)}%"></i></span><span class="fr-rate ${ratingClass(player.r)}">${player.r.toFixed(2)}</span></div>`;}).join("");
  const bestMap=ranking.reduce((max,player)=>Math.max(max,player.best||0),0);
  const margin=journey.filter(match=>match.venc).reduce((max,match)=>Math.max(max,match.meu-match.dele),0);
  const records=[[`${campaign.mapasV}-${campaign.mapasD}`,"mapas"]];if(bestMap)records.push([bestMap.toFixed(2),"melhor mapa"]);if(margin)records.push(["+"+margin,"maior margem"]);
  const recordsHtml=records.map(record=>`<div class="rec"><span class="rec-v">${record[0]}</span><span class="rec-l">${record[1]}</span></div>`).join("");
  return {title:champion?"CAMPEÃO DO MAJOR":"FIM DA CAMPANHA",sealsHtml,mvpHtml,journeyHtml,ratingsHtml,recordsHtml};
}

export const campaignScoreHtml=(wins,losses)=>`<b>${wins}</b><span>—</span><b>${losses}</b>`;

export function hallView(progress,recordLabels){
  const counters=progress.contadores;
  const countersHtml=[[counters.titulos,"títulos"],[counters.invictos,"9-0 invictos"],[counters.campanhas,"campanhas"]]
    .map(([value,label])=>`<div class="rec"><span class="rec-v">${value}</span><span class="rec-l">${label}</span></div>`).join("");
  const titles=[...progress.titulos].reverse();
  const titlesHtml=titles.length
    ?`<div class="sec-lbl">TÍTULOS</div>`+titles.map(title=>`<div class="hall-titulo">
        <span class="hall-selos">🏆${title.invicto?"<b class=\"hall-inv\">💎 9-0</b>":""}</span>
        <span class="hall-info"><b>${esc(title.placar)}</b> · ${esc(title.data||"")}${title.mvp?` · MVP ${esc(title.mvp.nick)} (${title.mvp.media.toFixed(2)})`:""}</span>
        <span class="hall-elenco">${(title.elenco||[]).map(esc).join(" · ")}${title.treinador?` — coach ${esc(title.treinador)}`:""}</span>
      </div>`).join("")
    :`<div class="hall-vazio">Sua história começa no primeiro título. A roleta está esperando.</div>`;
  const records=Object.entries(progress.recordes);
  const recordsHtml=records.length
    ?`<div class="sec-lbl">RECORDES DO CLUBE</div><div class="hall-recgrid">`+records.map(([key,record])=>
      `<div class="hall-rec"><span class="hall-rec-v">${key==="rating"?record.v.toFixed(2):record.v}</span><span class="hall-rec-l">${esc(recordLabels[key]||key)}</span><span class="hall-rec-m">${record.nick?esc(record.nick)+" · ":""}vs ${esc(record.adv||"?")}${record.mapa?" · "+esc(record.mapa):""}${record.data?" · "+esc(record.data):""}</span></div>`).join("")+`</div>`
    :"";
  return {countersHtml,titlesHtml,recordsHtml};
}
