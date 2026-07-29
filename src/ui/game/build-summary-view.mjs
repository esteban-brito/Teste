import {escapeHtml as esc} from "../shared/html.mjs";

const SEAL_META={Comando:{ic:"◆",lab:"Comando"},AWP:{ic:"◎",lab:"AWP"},"Âncora":{ic:"◈",lab:"Âncora"},
  Iniciativa:{ic:"▲",lab:"Iniciativa"},Estrutura:{ic:"◫",lab:"Estrutura"},Treinador:{ic:"★",lab:"Treinador"},
  Estrelas:{ic:"✦",lab:"Egos"},Excesso:{ic:"⨯",lab:"Saturação"},Desenvolvimento:{ic:"✧",lab:"Lapidação"}};

const pillarOf=text=>{for(const pillar of["Comando","AWP","Âncora","Iniciativa","Estrutura","Treinador","Estrelas","Desenvolvimento"])if(text.startsWith(pillar))return pillar;
  if(/^\d+×/.test(text))return"Excesso";return"—";};
const classifySeal=text=>{let match=text.match(/\+(\d+)%/);if(match)return{tipo:"bonus",pct:+match[1]};
  match=text.match(/−(\d+)%/);if(match)return{tipo:+match[1]>=12?"grave":"leve",pct:+match[1]};
  if(/falta/.test(text))return{tipo:"neutro",pct:0};return{tipo:"forte",pct:0};};

export function construirCartao(alertas,coachDelta){
  const entries=[...alertas,coachDelta!==0?`Treinador ${coachDelta>0?"+":""}${coachDelta}%`:"Treinador"];
  const seals=entries.map(text=>{const classification=classifySeal(text),pillar=pillarOf(text),meta=SEAL_META[pillar]||{ic:"·",lab:pillar};
    return {...classification,pilar:pillar,ic:meta.ic,lab:meta.lab};});
  const value=seal=>seal.tipo==="forte"?"✓":seal.tipo==="neutro"?"—":seal.tipo==="bonus"?`+${seal.pct}%`:`−${seal.pct}%`;
  const order={grave:0,leve:1,bonus:2,neutro:3,forte:4};
  seals.sort((a,b)=>order[a.tipo]-order[b.tipo]||b.pct-a.pct);
  return seals.map(seal=>`<span class="selo ${seal.tipo}"><i>${seal.ic}</i>${esc(seal.lab)}<b>${value(seal)}</b></span>`).join("");
}
