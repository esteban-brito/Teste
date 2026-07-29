/* PRISMA — afinidade de função: o núcleo que decide qual função cada jogador exerce.
   ══════════════════════════════════════════════════════════════════════════════

   Cópia de migração de game.js enquanto ele for a fonte executável; a paridade é
   provada por tools/check-role-affinity-parity.js sobre os 85 e sobre entradas
   degeneradas.

   POR QUE ESTE MÓDULO RECEBE AS TABELAS EM VEZ DE ESPELHÁ-LAS. Os outros módulos
   já extraídos (style-identity, exposure-profile) copiam os números do CFG como
   constantes. Aqui isso seria errado: `ROLE_PERFIL`, `ROLE_CONTRA`, `IGL_ROLE_AFIN`
   e `ROLE_RULES` são exatamente o que `calibrador-loader.js` exporta para o
   calibrador MUTAR. Uma cópia congelada divergiria da tabela calibrada em silêncio,
   que é a classe de bug que este ciclo veio eliminar.

   Então as tabelas entram por parâmetro, com o padrão do jogo como default —
   "dependências passadas explicitamente", como manda o AGENTS.md. */

/** Ordem canônica das funções de combate. A ordem importa: desempates de
    classificação dependem dela (docs/architecture.md §Pontos de atenção). */
export const ROLES_COMBATE=["AWPer","Rifler","Entry","Lurker","Support"];

/* Afinidade padronizada em três stats, na escada .50/.30/.20 das receitas de
   playstyle. O AWPer é exceção declarada: é a única função do CS definida por um
   stat só — joga de AWP ou não joga. Colocá-lo na escada foi testado e tirou o
   sh1ro de AWPer e a AWP do Jame, dois AWPers de carreira. */
export const ROLE_PERFIL={
  AWPer:  {afin:{sn:.80,op:.12,fp:.05}},
  Rifler: {afin:{fp:.50,op:.30,tr:.20}},
  Entry:  {afin:{en:.50,op:.30,fp:.20}},
  Lurker: {afin:{cl:.50,op:.30,fp:.20}},
  Support:{afin:{ut:.50,tr:.30,en:.20},credito:3}};

/** Repulsão: atributos que contradizem a função. */
export const ROLE_CONTRA={
  AWPer:{en:.08,tr:.04,ut:.04,fp:.017},
  Rifler:{sn:.18,ut:.04,cl:.067},
  Entry:{sn:.08,ut:.02},
  Lurker:{en:.15,tr:.04,sn:.06},
  Support:{en:.06,sn:.10,fp:.039}
};

/** Ajuste aplicado só a quem é IGL. */
export const IGL_ROLE_AFIN={AWPer:{},Rifler:{},Entry:{cl:.098},Lurker:{},Support:{en:-.093}};

/** Regras condicionais calibráveis. Peso 0 = desligada, preservando o motor base. */
export const ROLE_RULES={
  Support:{
    aggroSemUtil:{w:.468,en:56,ut:56,tr:48},
    aberturaSemUtil:{w:0,op:54,ut:58},
    fraggerSemSuporte:{w:0,fp:58,ut:55,tr:48}
  },
  Entry:{
    entradaSemImpacto:{w:0,en:58,fp:52,tr:42},
    entradaSemAbertura:{w:.372,en:58,op:50}
  },
  Lurker:{pressaoAlta:{w:0,en:62,cl:52}},
  Rifler:{baixaTroca:{w:0,fp:55,tr:42}},
  AWPer:{sniperBaixo:{w:0,sn:58}}
};

/* IDENTIDADE DE FUNÇÃO, DECLARADA. Antes cada função tinha um bloco de código
   próprio dentro de roleAfinidade, com números mágicos soltos — impossível
   comparar duas funções sem ler o corpo, e adicionar uma sexta era escrever mais
   um `if`. Agora toda função declara os mesmos campos:

     sinergia — precisa dos DOIS stats juntos. `min(a, melhor de b)`: um Entry com
                entrada 90 e abertura 20 não é entry, é alguém que corre.
     limite   — stat que não pode ultrapassar o apoio que o sustenta.
     piso     — abaixo disto não é essa função, por mais que o resto encaixe.
     tipo     — `generalista` soma o bônus de equilíbrio (o Rifler é definido por
                não ter buraco, não por um pico). */
export const ROLE_IDENT={
  AWPer:{},
  Rifler:{sinergia:[{a:"fp",b:["op"],w:.065},{a:"fp",b:["tr"],w:.02}],tipo:"generalista"},
  Entry:{sinergia:[{a:"en",b:["op"],w:.025},{a:"en",b:["fp"],w:.015}],
    limite:{stat:"en",por:["op","fp"],w:.25},
    piso:{stats:["fp","tr"],valor:55,w:.22}},
  Lurker:{sinergia:[{a:"cl",b:["op","fp"],w:.04}]},
  Support:{sinergia:[{a:"ut",b:["tr"],w:.05}]}
};

/** Campos de CFG_AVALIACAO que este módulo consome. */
export const CFG_PADRAO={
  SUP_FRAG:72,
  RIFLER_GLUE_MAX:7,RIFLER_GLUE_FLOOR:40,RIFLER_GLUE_SCALE:.60,
  RIFLER_GLUE_SPREAD_PEN:.10,RIFLER_GLUE_SPEC_START:35,RIFLER_GLUE_SPEC_RANGE:20
};

/** Conjunto padrão: o que o jogo usa quando ninguém injeta nada. */
export const TABELAS_PADRAO={
  ROLE_PERFIL,ROLE_CONTRA,IGL_ROLE_AFIN,ROLE_RULES,ROLE_IDENT,CFG:CFG_PADRAO
};

const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const dot=(w,p)=>{let s=0;for(const k in w)s+=w[k]*(p[k]||0);return s;};
const melhorDe=(p,stats)=>Math.max(...stats.map(k=>p[k]||0));

/** Penalidade por regra condicional da função. */
export function roleRulePenalty(role,p,rulesTable=ROLE_RULES){
  const rules=rulesTable[role]||{};let pen=0;
  const en=p.en||0,fp=p.fp||0,tr=p.tr||0,op=p.op||0,cl=p.cl||0,sn=p.sn||0,ut=p.ut||0;
  if(role==="Support"){
    const r=rules.aggroSemUtil;if(r)pen+=(r.w||0)*Math.max(0,en-(r.en||0))*Math.max(0,(r.ut||0)-ut,(r.tr||0)-tr)/100;
    const a=rules.aberturaSemUtil;if(a)pen+=(a.w||0)*Math.max(0,op-(a.op||0))*Math.max(0,(a.ut||0)-ut)/100;
    const f=rules.fraggerSemSuporte;if(f)pen+=(f.w||0)*Math.max(0,fp-(f.fp||0))*Math.max(0,(f.ut||0)-ut,(f.tr||0)-tr)/100;
  }
  if(role==="Entry"){
    const i=rules.entradaSemImpacto;if(i)pen+=(i.w||0)*Math.max(0,en-(i.en||0))*Math.max(0,(i.fp||0)-fp,(i.tr||0)-tr)/100;
    const a=rules.entradaSemAbertura;if(a)pen+=(a.w||0)*Math.max(0,en-(a.en||0))*Math.max(0,(a.op||0)-op)/100;
  }
  if(role==="Lurker"){
    const r=rules.pressaoAlta;if(r)pen+=(r.w||0)*Math.max(0,en-(r.en||0))*Math.max(0,(r.cl||0)-cl)/100;
  }
  if(role==="Rifler"){
    const r=rules.baixaTroca;if(r)pen+=(r.w||0)*Math.max(0,fp-(r.fp||0))*Math.max(0,(r.tr||0)-tr)/100;
  }
  if(role==="AWPer"){
    const r=rules.sniperBaixo;if(r)pen+=(r.w||0)*Math.max(0,(r.sn||0)-sn)/10;
  }
  return pen;
}

/** Bônus do Rifler generalista: equilíbrio em fogo/entrada/utility, reduzido
    continuamente quando abertura/clutch/AWP revelam especialidade dominante. */
export function riflerGeneralistBonus(p,cfg=CFG_PADRAO){
  const fp=p.fp||0,en=p.en||0,ut=p.ut||0;
  const mn=Math.min(fp,en,ut),mx=Math.max(fp,en,ut),spread=mx-mn;
  const base=clamp((mn-cfg.RIFLER_GLUE_FLOOR)*cfg.RIFLER_GLUE_SCALE-spread*cfg.RIFLER_GLUE_SPREAD_PEN,
    0,cfg.RIFLER_GLUE_MAX);
  const specialty=Math.max(p.op||0,p.cl||0,p.sn||0);
  const antiSpec=clamp(1-(specialty-cfg.RIFLER_GLUE_SPEC_START)/Math.max(1,cfg.RIFLER_GLUE_SPEC_RANGE),0,1);
  return base*antiSpec;
}

/** Afinidade do jogador por UMA função: atração por perfil, repulsão por
    atributos incompatíveis, e as sinergias/limites declarados em ROLE_IDENT. */
export function roleAfinidade(role,p,tabelas=TABELAS_PADRAO){
  const t=tabelas,cfg=t.CFG||CFG_PADRAO;
  let score=dot(t.ROLE_PERFIL[role].afin,p)-dot(t.ROLE_CONTRA[role]||{},p)
    -roleRulePenalty(role,p,t.ROLE_RULES);
  if(p.isIGL)score+=dot(t.IGL_ROLE_AFIN[role]||{},p);
  const ident=t.ROLE_IDENT[role]||{};
  // soma as parcelas positivas antes de aplicar, preservando a ordem de operação
  let ganho=0;
  (ident.sinergia||[]).forEach(s=>{ganho+=s.w*Math.min(p[s.a]||0,melhorDe(p,s.b));});
  if(ident.tipo==="generalista")ganho+=riflerGeneralistBonus(p,cfg);
  score+=ganho;
  if(ident.limite)score-=ident.limite.w*Math.max(0,(p[ident.limite.stat]||0)-melhorDe(p,ident.limite.por));
  if(ident.piso)score-=ident.piso.w*Math.max(0,ident.piso.valor-melhorDe(p,ident.piso.stats));
  return score;
}

/** Afinidade por TODAS as funções. Regra única: "support" que fragueia (fp alto)
    é Lurker de utilidade, não Support de função primária. */
export function afinidades(p,tabelas=TABELAS_PADRAO){
  const cfg=tabelas.CFG||CFG_PADRAO,sc={};
  ROLES_COMBATE.forEach(r=>{sc[r]=roleAfinidade(r,p,tabelas);});
  if((p.fp||0)>=cfg.SUP_FRAG&&sc.Support>sc.Lurker)sc.Lurker=sc.Support+.01;
  return sc;
}
