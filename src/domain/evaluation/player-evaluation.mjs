/* ZÊNITE — do estilo ao número: OVR e a avaliação completa do jogador.
   ══════════════════════════════════════════════════════════════════════════════

   Cópia de migração de game.js enquanto ele for a fonte executável; a paridade é
   provada por tools/check-player-evaluation-parity.js.

   Fecha o caminho PRISMA→ZÊNITE: função (role-classification) + estilo
   (style-score) → OVR → avaliação. Aqui não há tabela calibrável nova: o que
   entra é `CFG_AVALIACAO`, e ele vem por parâmetro pelo mesmo motivo dos outros
   módulos deste bloco.

   TRÊS COISAS QUE SÃO CONTRATO, e não escolha de estilo:

   1. `aplicarAvaliacaoContextual` MUTA o jogador (`Object.assign`) e devolve o
      mesmo objeto. Não é descuido: `estrela` deriva do OVR, que só passa a
      existir neste ponto — calculá-la antes devolvia sempre `false` e apagava em
      silêncio toda a penalidade de ego da química. O checador prova a mutação,
      em vez de proibi-la.

   2. A FUNÇÃO não entra no OVR. O nível sai da receita do playstyle mais o bônus
      de rating; só o IGL foge disso, e é exceção declarada.

   3. O rating histórico entra UMA vez, dentro de `nmOVR`. Relê-lo em qualquer
      outro ponto seria contá-lo duas vezes. */

import {classificar,roleSecundarioSeguro} from "./role-classification.mjs";
import {nmStats6,stats7,styleMatch,jokerProfile,NM_DEF,STYLE_KEYS,
  TABELAS_PADRAO as ESTILO_PADRAO} from "./style-score.mjs";
import {styleId} from "./style-identity.mjs";

/** Cortes de nível da CARTA, por OVR. O rating já entrou dentro do OVR. */
export const CFG_NIVEL={LENDA_OVR:21,STAR_OVR:18,SOLIDO_OVR:16,ESTRELA_OVR:20};

/** Campos de CFG_AVALIACAO que este módulo consome. */
export const CFG_PADRAO={
  OVR_MIN:5,OVR_MAX:22,OVR_BASE:8.5,OVR_SPAN:10,RAT_BASE:1.0,RAT_K:8,
  // coerência stats×rating: apara o lift que os stats prometem além do que o
  // rating sustenta. COH_KEEP=0 apara todo o excesso além da folga.
  COH_LIFT0:7.0,COH_SLOPE:4,COH_TOLER:1.5,COH_KEEP:0,
  // exceção do IGL: bônus por COLOCAÇÃO e teto próprio, um degrau abaixo do 22
  // dos fraggers (o jogo é decidido por eles).
  IGL_TITULO:{Campeao:3,Final:2,Top4:1,Top8:0,Grupos:0},IGL_TETO:21
};

const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const dot=(w,p)=>{let s=0;for(const k in w)s+=w[k]*(p[k]||0);return s;};
const clipOVR=(x,cfg)=>clamp(Math.round(x),cfg.OVR_MIN,cfg.OVR_MAX);

/** OVR do IGL: playstyle + bônus por colocação, com teto próprio. */
export function iglOvr(core,coloc,cfg=CFG_PADRAO){
  return Math.min(cfg.IGL_TETO,Math.max(cfg.OVR_MIN,clipOVR(core+(cfg.IGL_TITULO[coloc]||0),cfg)));
}

/** OVR e diagnóstico de estilo. `forcedStyle` pula a competição (usado pelo
    editor do sandbox para responder "e se ele fosse Closer?"). */
export function nmOVR(p,role,forcedStyle=null,cfg=CFG_PADRAO,tabelas=ESTILO_PADRAO){
  const s6=nmStats6(p,role),s7=stats7(p);
  const match=forcedStyle
    ?{id:styleId(forcedStyle),score:1,second:.75,margin:.25,clarity:.9}
    :styleMatch(s6,s7,role,p,tabelas);
  const style=match.id;
  const receita=id=>(tabelas.NM_DEF||NM_DEF)[STYLE_KEYS[id]];

  let score;
  if(style==="joker"){
    const jp=jokerProfile(s7,tabelas.NM_COR),top5=jp.sorted.slice(0,5);
    score=top5.reduce((a,b)=>a+b,0)/5;
  }else{
    // MÉDIA PONDERADA real (normaliza pela soma dos pesos), não produto-escalar
    // cru: assim a escala do OVR fica imune ao drift de Σw e o calibrador pode
    // mexer num peso isolado sem estourá-la.
    const rec=receita(style),qualityW=rec.ovrW||rec.w;
    const sw=Object.values(qualityW).reduce((a,b)=>a+b,0);
    score=dot(qualityW,s6)/(sw||1);
  }

  const lift=(score/100)*cfg.OVR_SPAN;
  const expLift=clamp(cfg.COH_LIFT0+cfg.COH_SLOPE*((p.rating||0)-cfg.RAT_BASE),0,cfg.OVR_SPAN);
  const over=Math.max(0,lift-expLift-cfg.COH_TOLER);
  const base=cfg.OVR_BASE+lift-(1-cfg.COH_KEEP)*over;

  const rec=style==="joker"?null:receita(style);
  const ratingWeight=clamp(+(rec?.ratingWeight??1),.25,2);
  const bonus=Math.max(0,(p.rating||0)-cfg.RAT_BASE)*cfg.RAT_K*ratingWeight;

  return {style,ovr:clipOVR(base+bonus,cfg),statScore:score,score,base,bonus,
    core:base+bonus,ratingWeight,s6,matchScore:match.score,matchMargin:match.margin};
}

/** OVR final considerando a função. Só o IGL desvia do caminho comum. */
export function ovrUnificado(role,p,sec,cfg=CFG_PADRAO,tabelas=ESTILO_PADRAO){
  const combatRole=role==="IGL"?(sec||"Rifler"):role;
  const style=nmOVR(p,combatRole,null,cfg,tabelas);
  if(role==="IGL")return iglOvr(style.core,p.colocacao,cfg);
  return Math.min(cfg.OVR_MAX,Math.max(cfg.OVR_MIN,style.ovr));
}

/** Orquestrador PRISMA→ZÊNITE. MUTA `p` e devolve o mesmo objeto — ver o
    cabeçalho: `estrela` só pode ser decidida depois que o OVR existe. */
export function aplicarAvaliacaoContextual(p,cfg=CFG_PADRAO,tabelas=ESTILO_PADRAO,nivel=CFG_NIVEL){
  const fallback=(!p.primario||!p.secundario)?classificar(p):null;
  const role=p.primario||fallback[0];
  const sec=role==="IGL"
    ?(p.secundario||fallback[1])
    :roleSecundarioSeguro(role,p.secundario||fallback[1],p);
  const combatRole=role==="IGL"?(sec||"Rifler"):role;
  const style=nmOVR(p,combatRole,null,cfg,tabelas);
  const ovr=role==="IGL"
    ?iglOvr(style.core,p.colocacao,cfg)
    :Math.min(cfg.OVR_MAX,Math.max(cfg.OVR_MIN,style.ovr));

  return Object.assign(p,{ovr,combatRole,
    role1:role==="IGL"?"IGL":role,
    role2:role==="IGL"?null:sec,
    playstyle:style.style,style,estrela:ovr>=nivel.ESTRELA_OVR});
}

/** Avaliação completa de um jogador cru. Não muta a entrada: copia antes. */
export function avaliarJogador(p,cfg=CFG_PADRAO,tabelas=ESTILO_PADRAO,nivel=CFG_NIVEL){
  const classe=classificar(p);
  const role=classe[0];
  return aplicarAvaliacaoContextual({...p,primario:role,secundario:classe[1],
    secForte:classe.secForte!==false,classe:classe.join("-")},cfg,tabelas,nivel);
}
