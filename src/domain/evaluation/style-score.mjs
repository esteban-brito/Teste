/* ZÊNITE — competição entre playstyles: qual estilo o jogador exerce.
   ══════════════════════════════════════════════════════════════════════════════

   Cópia de migração de game.js enquanto ele for a fonte executável; a paridade é
   provada por tools/check-style-score-parity.js.

   Como em role-affinity, as tabelas entram por PARÂMETRO: `NM_DEF` e
   `STYLE_CONTRA` são exatamente o que calibrador-loader.js expõe para o
   calibrador mutar. Espelhá-las como constantes faria o módulo divergir da
   tabela calibrada em silêncio.

   DOIS ESTILOS NÃO SAEM DA COMPETIÇÃO NORMAL, e isso é deliberado:

     Baiter  — não é receita, é DIAGNÓSTICO de baixo impacto: poucos stats acima
               de 50, rating fraco, não abre nem entra. Por isso `baiter` é pulado
               em styleScoreTable e só entra por `badBaiterProfile`.
     Coringa — polivalência genuína: cinco stats acima do piso e espalhamento
               pequeno. Também curto-circuita a competição.

   A ORDEM de PLAYSTYLE_IDS é contrato: `sort` é estável, então empates de score
   são desempatados por ela. */

/** Ordem canônica dos estilos. Desempata score igual — não reordene. */
export const PLAYSTYLE_IDS=["aggressive","spacetaker","trader","playmaker","infiltrator",
  "baiter","clutcher","support","cerebral","anchor"];

/** id do estilo → chave da receita em NM_DEF. */
export const STYLE_KEYS={aggressive:"Opener",spacetaker:"Spacetaker",trader:"Trader",
  playmaker:"Playmaker",infiltrator:"Infiltrador",baiter:"Baiter",clutcher:"Closer",
  support:"Facilitador",cerebral:"Cerebral",anchor:"Ancora"};

/** Os seis eixos da receita. A ordem é usada no produto interno. */
export const NM_AXES=[["fogo","Fogo"],["ent","Entrada"],["ab","Abertura"],
  ["tr","Trade"],["cl","Clutch"],["ut","Utilitário"]];

/* Toda receita é EXATAMENTE três eixos, na escada .50/.30/.20. Os eixos em
   aberto foram decididos por medição contra a classificação aprovada dos 85 —
   ver docs/receitas-padronizadas-2026-07-28.md. `ovrW`, quando existe, é o que o
   NÍVEL pondera, separado da identidade. */
export const NM_DEF={
  Opener:{w:{ab:.50,fogo:.30,ent:.20},ratingWeight:1},
  Spacetaker:{w:{ent:.50,ut:.30,fogo:.20},ratingWeight:1},
  Trader:{w:{tr:.50,fogo:.30,ut:.20},ratingWeight:1},
  Playmaker:{w:{fogo:.50,ab:.30,cl:.20},ratingWeight:1},
  Infiltrador:{w:{cl:.50,ab:.30,fogo:.20},ratingWeight:1},
  Baiter:{w:{tr:.50,cl:.30,fogo:.20},ovrW:{cl:.50,ut:.30,tr:.20},ratingWeight:1},
  Closer:{w:{cl:.50,fogo:.30,ut:.20},ratingWeight:1.05},
  Facilitador:{w:{ut:.50,ent:.30,fogo:.20},ovrW:{ut:.50,tr:.30,ent:.20},ratingWeight:1},
  Cerebral:{w:{ut:.50,ab:.30,cl:.20},ratingWeight:1},
  Ancora:{w:{cl:.50,ut:.30,tr:.20},ratingWeight:1}};

/* SÓ AS PROPORÇÕES IMPORTAM: a penalidade é `cd/(100*cw)`, média ponderada
   normalizada pela soma dos pesos — multiplicar a linha por dez não muda nada.
   Os decimais irregulares NÃO são dívida técnica: duas padronizações foram
   testadas em 28/07/2026 e ambas rejeitadas por medição (a escada fixa piorava a
   classificação; a reescala neutra movia `Favorito gap 16+` de 82,2 para 81,8 só
   pelo arredondamento de terceira casa). Ver o comentário em game.js. */
export const STYLE_CONTRA={
  aggressive:{cl:.112,ut:.08},
  spacetaker:{cl:.036,ut:.05},
  trader:{ent:.10,ab:.08,cl:.06},
  playmaker:{ut:.06,tr:.04,cl:.05,ent:.012,fogo:.010},
  infiltrator:{ent:.18,tr:.08},
  baiter:{ent:.28,ab:.16,ut:.08},
  clutcher:{ent:.14,ab:.027,tr:.06},
  support:{fogo:.10,ent:.12},
  cerebral:{ent:.22,fogo:.08},
  anchor:{ent:.252,ab:.12,fogo:.06}
};

/** Limiares do Coringa: piso por stat e espalhamento máximo. */
export const NM_COR={pisoMin:45,spreadMax:35};

/** Campos de CFG_AVALIACAO que este módulo consome. */
export const CFG_PADRAO={
  AWP_LEAN:.152,
  FAC_GLUE_MAX:.35,FAC_GLUE_FLOOR:45,FAC_GLUE_RANGE:10,FAC_GLUE_SPREAD:10,
  FAC_GLUE_SPEC_START:25,FAC_GLUE_SPEC_RANGE:20,FAC_GLUE_TRADE_FLOOR:30,FAC_GLUE_TRADE_RANGE:15
};

export const TABELAS_PADRAO={NM_DEF,STYLE_CONTRA,NM_COR,CFG:CFG_PADRAO};

const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));

/** Os seis eixos do jogador. No AWPer, "fogo" é a AWP — é com ela que ele mata. */
export function nmStats6(p,role){
  const fogo=role==="AWPer"?(p.sn||0):(p.fp||0);
  return {fogo,ent:p.en||0,ab:p.op||0,tr:p.tr||0,cl:p.cl||0,ut:p.ut||0};
}

/** Os sete atributos crus, na ordem usada pelo perfil de Coringa. */
export function stats7(p){return [p.fp||0,p.en||0,p.tr||0,p.op||0,p.cl||0,p.sn||0,p.ut||0];}

/** Baiter = BAIXO IMPACTO, não receita. IGL fraco em stats é sacrifício de
    função, não egoísmo, e por isso fica de fora. */
export function badBaiterProfile(p){
  if(p.isIGL)return false;
  const above=["fp","en","tr","op","cl","sn","ut"].filter(k=>(p[k]||0)>50).length;
  // op<=45 pega o baiter que nem abre; o OU cobre o FALSO abridor: joga para
  // espaço (op alto) mas com fogo e trade quase nulos não produz nada.
  return above<=2&&(p.rating||0)<=1.02&&(p.en||0)<=50&&
    ((p.op||0)<=45||((p.fp||0)<=15&&(p.tr||0)<=20));
}

/** Perfil de polivalência. `ok` decide se o jogador vira Coringa. */
export function jokerProfile(s7,cor=NM_COR){
  const sorted=[...s7].sort((a,b)=>b-a),below=s7.filter(v=>v<cor.pisoMin).length;
  const min5=sorted[4]||0,spread=(sorted[0]||0)-(sorted[4]||0);
  const mean=s7.reduce((a,b)=>a+b,0)/7;
  const variance=s7.reduce((s,v)=>s+(v-mean)**2,0)/7;
  return {ok:below<=1&&min5>=cor.pisoMin&&spread<=cor.spreadMax,
    sorted,below,min5,spread,mean,score:clamp(1-variance/800,0,1)};
}

/** Identidade coletiva do Facilitador por equilíbrio fogo/entrada/utility. */
export function facilitatorGlueBonus(s6,role="Rifler",cfg=CFG_PADRAO){
  const trio=[s6.fogo||0,s6.ent||0,s6.ut||0],mn=Math.min(...trio),mx=Math.max(...trio);
  const floor=clamp((mn-cfg.FAC_GLUE_FLOOR)/Math.max(1,cfg.FAC_GLUE_RANGE),0,1);
  const balance=clamp(1-(mx-mn)/Math.max(1,cfg.FAC_GLUE_SPREAD),0,1);
  const specialty=Math.max(s6.ab||0,s6.cl||0);
  const lowSpec=clamp(1-(specialty-cfg.FAC_GLUE_SPEC_START)/Math.max(1,cfg.FAC_GLUE_SPEC_RANGE),0,1);
  const trade=clamp(((s6.tr||0)-cfg.FAC_GLUE_TRADE_FLOOR)/Math.max(1,cfg.FAC_GLUE_TRADE_RANGE),0,1);
  const roleMul=role==="Rifler"?1:role==="Support"?.8:role==="Entry"?.55:.35;
  return cfg.FAC_GLUE_MAX*floor*balance*(.60+.20*lowSpec+.20*trade)*roleMul;
}

/** Competição entre os estilos normais, ordenada por score decrescente.
    Fonte única: o calibrador usa esta mesma função, então regras contextuais
    (como AWP_LEAN) nunca ficam invisíveis à sensibilidade. */
export function styleScoreTable(s6,role="Rifler",tabelas=TABELAS_PADRAO){
  const t=tabelas,cfg=t.CFG||CFG_PADRAO,scores=[];
  for(const id of PLAYSTYLE_IDS){
    if(id==="baiter")continue;                    // diagnóstico, não receita
    const rec=t.NM_DEF[STYLE_KEYS[id]];if(!rec)continue;
    const w=rec.w;let d=0,nw=0,ns=0;
    for(const [k] of NM_AXES){const wi=w[k]||0,si=s6[k]||0;d+=wi*si;nw+=wi*wi;ns+=si*si;}
    let score=d/(Math.sqrt(nw*ns)+1e-9);          // similaridade de cosseno
    const contra=t.STYLE_CONTRA[id]||{};let cd=0,cw=0;
    // só eixos do s6: um eixo fora dele somava 0 no numerador mas inflava `cw`,
    // DILUINDO as penalidades reais. Guarda a invariante.
    for(const k in contra){if(!(k in s6))continue;cd+=(contra[k]||0)*(s6[k]||0);cw+=(contra[k]||0);}
    score-=cw?cd/(100*cw)*.42:0;
    if(id==="support")score+=facilitatorGlueBonus(s6,role,cfg);
    if(role==="AWPer"&&cfg.AWP_LEAN){
      // AWPer passivo: op alto dele é pick de AWP (Closer), não espaço de Infiltrador
      const lean=cfg.AWP_LEAN*clamp(1-(s6.ent||0)/50,0,1);
      if(id==="clutcher")score+=lean;
      else if(id==="infiltrator")score-=lean;
    }
    scores.push({id,score});
  }
  return scores.sort((a,b)=>b.score-a.score);
}

/** Estilo vencedor, com margem e nitidez. Baiter e Coringa curto-circuitam. */
export function styleMatch(s6,s7,role="Rifler",p=null,tabelas=TABELAS_PADRAO){
  const cor=tabelas.NM_COR||NM_COR;
  if(p&&badBaiterProfile(p))
    return {id:"baiter",score:.9,second:.7,margin:.2,clarity:.85,locked:"baiter"};
  const jp=jokerProfile(s7,cor);
  if(jp.ok)return {id:"joker",score:.88+.12*jp.score,second:.72,
    margin:.16+.12*jp.score,clarity:.75+.25*jp.score,locked:"joker"};
  const scores=styleScoreTable(s6,role,tabelas);
  const best=scores[0]||{id:"playmaker",score:0},second=scores[1]?.score||0;
  return {...best,second,margin:best.score-second,
    clarity:clamp((best.score-second)*5,0,1),scores};
}
