/* ════════════════════════════════════════════════════════════════════
   draft9-0 · lógica do jogo
   ════════════════════════════════════════════════════════════════════
   SEIS MOTORES, UM PIPELINE. Cada um tem nome próprio e uma só
   responsabilidade; a saída de um alimenta o próximo. Da carta crua ao
   veredito do mapa, o dado flui sempre na mesma direção:

      atributos crus
          │
      ┌───▼──── PRISMA ───────┐  refrata o jogador: função (role) + 2ª função
      │  classificar / sub /  │  + sub-arquétipo + lado (CT/T). Sem gates: tudo
      │  distribuirRoles      │  por afinidade contínua. Decide QUEM é o jogador.
      └───┬───────────────────┘
      ┌───▼──── ZÊNITE ───────┐  condensa identidade + atributos + rating HLTV
      │  ovrUnificado         │  num ÚNICO número numa escala só (OVR 5–22).
      │  avaliarJogador       │  Decide QUÃO BOM ele é. (curva, sem cliffs)
      └───┬───────────────────┘
      ┌───▼──── SINAPSE ──────┐  lê o elenco montado: cobertura de pilares,
      │  quimicaComposicao    │  saturação, egos, treinador → QUÍMICA e FORÇA
      │  forcaTime            │  EFETIVA. Decide quanto o time RENDE junto.
      └───┬───────────────────┘
      ┌───▼──── MARÉ ─────────┐  o "humor competitivo": tier × OVR × firepower
      │  formaDoDia           │  → a forma da noite/campanha que oscila e MOVE
      │  sortearFormaCampanha │  o combate. É o motor de variância do roguelike.
      └───┬───────────────────┘
      ┌───▼──── PÓLVORA ──────┐  o combate VIVO, round a round: sequência de
      │  combateRound         │  duelos, vantagem de homem, clutch, plant/
      │  simularMapa/Serie    │  post-plant/retake/relógio. Quem GANHA emerge.
      │   └─ COFRE            │     sub-motor de ECONOMIA: compra/gasto, carrego
      │      decidirBuy/premio│     de equipamento, recompensa por kill, anti-eco.
      └───┬───────────────────┘
      ┌───▼──── FALLEnANGELs ─┐  o veredito contextual pós-combate: KAST, ADR,
      │  fallenAngels         │  swing, multi-kill, abertura, trade, eco → o
      └───────────────────────┘  RATING (estilo HLTV) de cada jogador no mapa.

   Blocos CFG_* = o balanceamento de cada motor (números, não lógica).
   Layout do arquivo: PRISMA·ZÊNITE·SINAPSE (avaliam jogador/time) → DADOS
   (jogadores/times, já passados pelos três) → MARÉ·PÓLVORA·COFRE·FALLEnANGELs
   (a partida) → ESTADO + UI (roleta, elenco, suíça, playoffs, reprodutor).
   Convenção: nomes e comentários em pt-BR; helpers curtos no topo de cada bloco.
   ════════════════════════════════════════════════════════════════════ */
/* ── CONTRATOS (o dado que circula entre os motores) ────────────────────
   @typedef {Object} Eng  — jogador avaliado (POOL[id]; vive em carta._eng)
     atributos crus: fp,en,tr,op,cl,sn,ut (0-100) · rating (HLTV real) · isIGL
     do PRISMA: primario, secundario, secForte, sub{nome,eixo,agr,lado,stats}
     do ZÊNITE: ovr (5-22) · estrela · esteira · caches: _lado,_mapBase,_formaCamp
   @typedef {Object} TimePronto — {nome,jogadores:[{_eng,...}],ef,quim} (após SINAPSE)
   @typedef {Object} ResultadoMapa — retorno de simularMapa:
     placar[2] · vencedor/vencedorNome · mapa · totalRounds · half1
     rounds[]: {r,pa,pb,venceA,ladoA/B,troca,plantado,buyA/B,clutchX,clutchWon,destaque,snapA/B}
     statsA/B[]: {nick,k,d,a,rating}  (vazios em modo leve)
   Fluxo: ATRIBUTOS → avaliarJogador → POOL → TEAMS → forcaTime → simularMapa/Serie.
   ──────────────────────────────────────────────────────────────────── */
/* ╔═══════════════════════════════════════════════════════════════════╗
   ║  PRISMA · ZÊNITE · SINAPSE — avaliação de jogador e de elenco       ║
   ╚═══════════════════════════════════════════════════════════════════╝ */
/* Perfil por função: AFIN (pesos da identidade) + OVR (pesos do nível) + wR (peso do
   rating HLTV no OVR daquela função) + crédito intrínseco (cérebro/cola, não por título). */
const ROLE_PERFIL={
  AWPer:  {afin:{sn:.80,op:.12,fp:.05},        ovr:{sn:.45,fp:.25,op:.20,cl:.10},       wR:.66},
  Rifler: {afin:{fp:.44,op:.25,tr:.17,cl:.14,ut:.03}, ovr:{fp:.45,op:.25,tr:.15,cl:.15},wR:.66},
  Entry:  {afin:{en:.56,op:.25,fp:.12,tr:.07}, ovr:{en:.40,op:.30,fp:.20,tr:.10},       wR:.64},
  Lurker: {afin:{cl:.50,op:.30,fp:.20},        ovr:{cl:.40,op:.24,fp:.26,ut:.10},       wR:.66},
  Support:{afin:{ut:.50,tr:.25,en:.12,fp:.08,op:.05}, ovr:{ut:.45,tr:.22,fp:.15,op:.10,cl:.08},wR:.45,credito:3}};
const CFG_AVALIACAO={OVR_MIN:5,OVR_MAX:22, // ⚙ balanceamento do PRISMA (afinidade/sub) + ZÊNITE (curva de OVR)
  RAT_LO:.85,RAT_HI:1.50,RAT_CAP:1.25,       // mapa do rating HLTV -> 0..125 (sem cliffs)
  FLOOR:9,SPAN:13.7,K:.0495,MID:55,          // core -> OVR (logística). teto um pouco mais seletivo: o 22 exige elite clara (rating ~1.6+), não satura cedo; MID recentrado mantém o miolo do elenco intacto
  IGL_RAT_K:.80,IGL_CREDITO:9,               // IGL: rating descontado (sacrifica stats) + crédito de liderança intrínseco
  IGL_TITULO:{Campeao:3,Final:2,Top4:1,Top8:0,Grupos:0}, // liderança comprovada por título soma OVR (só p/ IGL)
  IGL_TETO:20,                               // nenhum IGL passa de 20 (o jogo é decidido pelos fraggers)
  VERS_REF:40,VERS_W:.4,VERS_CAP:3,VERS_FADE:60,VERS_SPAN:14, // "Coringa": polivalência (piso alto em TODOS os atributos) resgata quem é subvalorizado; desvanece conforme o core sobe (não empurra quem já é bem avaliado); especialista recebe 0
  SUP_FRAG:72,                               // fp acima disso: não é Support role 1, é Lurker de utilidade (frag + util)
  CORINGA_PISO:42,CORINGA_SPREAD:24,         // sub "Coringa": piso alto E sem especialidade dominante (spread baixo) = polivalente
  PARADOXO:[["Entry","Support"],["Entry","Lurker"]],PARADOXO_PEN:.85};
const CFG_QUIMICA={ // ⚙ balanceamento do SINAPSE (química, treinador, pilares de composição)
  TREINADOR_PLACAR:{Campeao:16,Final:14,Top4:13,Top8:12,Grupos:10}, // base por conquista: vencer Major já é respeitado
  TREINADOR_STR:.14,                                                // prestígio por liderar elenco acima do típico daquela conquista
  TREINADOR_MIN:10,TREINADOR_MAX:20,IGL_FRACO_OVR:13,ESTRELA_LIMITE:2,
  TREINADOR_FORCA:{neutro:15,porPonto:.025},
  PEN:{semIGL:.25,iglFraco:.10,semAWP:.20,semAncora:.11,semIniciativa:.12,estrelaExtra:.07},QUIMICA_MIN:.50,QUIMICA_MAX:1.00,
  TALENTO:{refBruta:82,divisor:22,recMax:.45,teto:1.00}, // talento resiste à química ruim, mas fecha no MÁX 45% do buraco (composição importa mesmo em time forte)
  IDEAL:{IGL:1,AWPer:1,Lurker:1,Support:2,Entry:2,Rifler:3},
  DUREZA:{IGL:.08,AWPer:.07,Lurker:.04,Support:.04,Entry:.03,Rifler:.03},
  SAT_LEVE:.05, // limite de saturação que ainda conta como "estruturado" (selo de Estrutura)
  SEC_NOMINAL_PESO:.5, // secundário nominal cobre metade do que um secundário forte cobriria
  RIFLER_VERSATIL_ALIVIO:.5, // Rifler com 2ª função (Entry/Lurker/Support) conta meio na saturação (não é rifler "puro")
  FUNC_EGO:["Entry","Rifler","AWPer","Lurker"], // estrelas nessas funções geram atrito; IGL/Support não
  RIFLER_INICIATIVA:.5, // Rifler sem Entry cobre o pilar Iniciativa só pela metade
  // características do treinador = MITIGADORES de penalidade (recuperam rumo a 100%, nunca acima):
  CARAC:{Gestor:{tetoEstrelasBonus:1,estrelaExtraPen:.04},        // tolera +1 estrela e suaviza o atrito de ego
    Desenvolvedor:{cruRef:14,cruPorJogador:.05,cruTeto:.18},      // reduz penalidades de elencos crus (escala c/ nº de crus)
    Estrategista:{corteEstrutura:.15,corteComando:.30},           // reduz penalidades estruturais e de comando
    Motivador:{cortePenalidade:.30}},                             // reduz as penalidades de cobertura/saturação (não apaga comp ruim)
  DERIVA:{SOMA_ESPERADA:{Campeao:85,Final:80,Top4:74,Top8:66,Grupos:56},DESENV_RESULTADO_MIN:["Campeao","Final","Top4"],LIMIAR:.3}};

const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const clipOVR=x=>clamp(Math.round(x),CFG_AVALIACAO.OVR_MIN,CFG_AVALIACAO.OVR_MAX);
const dot=(w,p)=>{let s=0;for(const k in w)s+=w[k]*(p[k]||0);return s;}; // produto-escalar pesos·atributos
const ROLES_COMBATE=["AWPer","Rifler","Entry","Lurker","Support"];
const ROLE_CONTRA={
  AWPer:{en:.08,tr:.04,ut:.04},
  Rifler:{sn:.18,ut:.04,cl:.05},
  Entry:{sn:.08,ut:.02},
  Lurker:{en:.15,tr:.04,sn:.06},
  Support:{en:.06,sn:.10,fp:.06}
};
const IGL_ROLE_AFIN={AWPer:{},Rifler:{},Entry:{},Lurker:{},Support:{}};
const ROLE_RULES={
  // Pesos condicionais calibraveis. Comecam em 0 para preservar o motor base;
  // o sandbox pode ativar regras globais quando uma transicao exigir criterio mais fino.
  Support:{
    aggroSemUtil:{w:0,en:56,ut:56,tr:48},
    aberturaSemUtil:{w:0,op:54,ut:58},
    fraggerSemSuporte:{w:0,fp:58,ut:55,tr:48}
  },
  Entry:{
    entradaSemImpacto:{w:0,en:58,fp:52,tr:42},
    entradaSemAbertura:{w:0,en:58,op:50}
  },
  Lurker:{
    pressaoAlta:{w:0,en:62,cl:52}
  },
  Rifler:{
    baixaTroca:{w:0,fp:55,tr:42}
  },
  AWPer:{
    sniperBaixo:{w:0,sn:58}
  }
};
const ROLE_PAIR_BASE={
  "Entry/Support":.55,"Support/Entry":.42,
  "Entry/Lurker":.34,"Lurker/Entry":.30,
  "Entry/AWPer":.28,"AWPer/Entry":.22,
  "AWPer/Support":.30,"Support/AWPer":.26,
  "AWPer/Lurker":.18,"Lurker/AWPer":.16,
  "Rifler/Support":.12,"Support/Rifler":.10,
  "Rifler/Entry":.08,"Entry/Rifler":.08,
  "Rifler/Lurker":.08,"Lurker/Rifler":.08
};
function rolePairReality(primary,secondary,p){
  if(!primary||!secondary||primary===secondary)return {cost:0,label:"natural",reasons:[]};
  const reasons=[],key=`${primary}/${secondary}`;
  let cost=ROLE_PAIR_BASE[key]??.14;
  const en=p.en||0,fp=p.fp||0,tr=p.tr||0,op=p.op||0,cl=p.cl||0,ut=p.ut||0,sn=p.sn||0;
  if(primary==="Entry"||secondary==="Entry"){
    const entryCore=.45*en+.25*op+.20*fp+.10*tr;
    if(entryCore>=62)cost-=.12; else {cost+=.10;reasons.push("entry sem base completa");}
    if(Math.max(fp,tr)<55){cost+=.12;reasons.push("entry sem impacto/trade");}
    if(primary==="Support"||secondary==="Support"){
      if(tr>=48&&ut>=52)cost-=.18; else {cost+=.14;reasons.push("entry/support sem trade+utility");}
    }
    if(primary==="Lurker"||secondary==="Lurker"){
      if(cl>=55&&op>=55)cost-=.10; else cost+=.08;
    }
  }
  if(primary==="AWPer"||secondary==="AWPer"){
    if(sn>=65)cost-=.12; else {cost+=.16;reasons.push("AWP sem sniper");}
    if((primary==="Entry"||secondary==="Entry")&&en>=55&&op>=65)cost-=.10;
  }
  if(primary==="Support"||secondary==="Support"){
    if(ut>=55||tr>=52)cost-=.10; else {cost+=.10;reasons.push("support sem util/trade");}
    if(en>=65&&ut<55&&tr<50)cost+=.14;
  }
  const finalCost=clamp(cost,0,.85);
  return {cost:finalCost,label:finalCost>=.55?"muito raro":finalCost>=.35?"raro":finalCost>=.18?"situacional":"natural",reasons};
}
function secondaryScore(primary,secondary,p,scores){
  return (scores[secondary]??0)-rolePairReality(primary,secondary,p).cost*18;
}
function roleRulePenalty(role,p){
  const rules=ROLE_RULES[role]||{};let pen=0;
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
function roleAfinidade(role,p){
  let score=dot(ROLE_PERFIL[role].afin,p)-dot(ROLE_CONTRA[role]||{},p)-roleRulePenalty(role,p);
  if(p.isIGL)score+=dot(IGL_ROLE_AFIN[role]||{},p);
  if(role==="Entry"){
    const en=p.en||0,op=p.op||0,fp=p.fp||0,apoio=Math.max(op,fp);
    score+=.025*Math.min(en,op)+.015*Math.min(en,fp);
    score-=.25*Math.max(0,en-apoio);
    score-=.22*Math.max(0,55-Math.max(fp,p.tr||0));
  }
  if(role==="Lurker"){
    const cl=p.cl||0,op=p.op||0,fp=p.fp||0;
    score+=.04*Math.min(cl,Math.max(op,fp));
  }
  if(role==="Support"){
    score+=.05*Math.min(p.ut||0,p.tr||0);
  }
  if(role==="Rifler"){
    score+=.065*Math.min(p.fp||0,p.op||0)+.02*Math.min(p.fp||0,p.tr||0);
  }
  return score;
}
// afinidade do jogador por cada função (núcleo do PRISMA): atração por perfil,
// repulsão por atributos incompatíveis e pequenas sinergias de identidade.
// regra única: "support" que fragueia (fp alto) é LURKER de utilidade, não support role 1.
// usada tanto na classificação individual quanto no passe de time (distribuirRoles) — fonte única.
const afinidades=p=>{const sc={};ROLES_COMBATE.forEach(r=>sc[r]=roleAfinidade(r,p));
  if((p.fp||0)>=CFG_AVALIACAO.SUP_FRAG&&sc.Support>sc.Lurker)sc.Lurker=sc.Support+.01;return sc;};
/* ┌─ PRISMA ─ classificação de função ────────────────────────────────┐
   AFINIDADE contínua (sem gates nem números mágicos): primário = maior
   afinidade; secundário = 2ª (paradoxo = leve desconto na escolha, não veto). */
function classificar(p){
  const sc=afinidades(p);
  const ordem=ROLES_COMBATE.slice().sort((a,b)=>sc[b]-sc[a]);
  if(p.isIGL){const c=["IGL",ordem[0]];c.secForte=true;return c;}
  const prim=ordem[0],par=CFG_AVALIACAO.PARADOXO;
  const ehPar=(a,b)=>par.some(([x,y])=>(a===x&&b===y)||(a===y&&b===x));
  let sec=ordem.slice(1).sort((a,b)=>secondaryScore(prim,b,p,sc)-secondaryScore(prim,a,p,sc))[0];
  if(ehPar(prim,sec)&&ordem[2]&&sc[ordem[2]]>=sc[sec]*CFG_AVALIACAO.PARADOXO_PEN)sec=ordem[2];
  const c=[prim,sec];
  c.secForte=(secondaryScore(prim,sec,p,sc)/Math.max(1,sc[prim]))>=.82; // bi-funcional de verdade (grau contínuo -> bool p/ química)
  return c;}
function roleSecundarioSeguro(primary,secondary,p,scores=null){
  if(secondary&&secondary!==primary)return secondary;
  const sc=scores||afinidades(p);
  return ROLES_COMBATE.filter(r=>r!==primary)
    .sort((a,b)=>secondaryScore(primary,b,p,sc)-secondaryScore(primary,a,p,sc))[0]||"Rifler";
}
const ESTEIRA={AWPer:"Artilharia",Rifler:"Assalto",Entry:"Vanguarda",Lurker:"Ancora",Support:"Sistema",IGL:"Comando"};
/* ┌─ ZÊNITE ─ OVR unificado ───────────────────────────────────────────┐ */
// OVR unificado p/ TODAS as funções (escala única, sem cliffs):
//   core = wR·rating + (1−wR)·atributos-da-função + crédito; OVR = curva logística clip 5..22.
// O IGL herda o PERFIL DO SEU ROLE DE COMBATE (secundário): um IGL/AWPer pondera o rating como
// AWPer, um IGL/Support como Support (o peso do rating depende do role, como pediu o usuário).
// Como o IGL sacrifica stats individuais, o peso de rating é descontado (IGL_RAT_K) + crédito de
// liderança intrínseco, e ainda soma um bônus de TÍTULO (IGL_TITULO): liderança que ganhou Major
// vale OVR. Esse bônus é exclusivo do IGL — fragger nunca depende da colocação do time.
const ratingScore=r=>clamp((r-CFG_AVALIACAO.RAT_LO)/(CFG_AVALIACAO.RAT_HI-CFG_AVALIACAO.RAT_LO),0,CFG_AVALIACAO.RAT_CAP)*100;
const curvaOVR=core=>{const C=CFG_AVALIACAO;return clipOVR(C.FLOOR+C.SPAN/(1+Math.exp(-C.K*(core-C.MID))));};
const NM_AXES=[["fogo","Fogo"],["ent","Entrada"],["ab","Abertura"],["tr","Trade"],["cl","Clutch"],["ut","Utilitário"]];
const NM_DEF={
  Agressivo:{w:{ent:.45,ab:.30,fogo:.15,tr:.10},wR:.40},
  Spacetaker:{w:{ab:.35,fogo:.35,ent:.30},wR:.52},
  Trader:{w:{tr:.45,fogo:.30,ut:.25},wR:.48},
  Playmaker:{w:{fogo:.50,ab:.30,cl:.10,tr:.10},wR:.60},
  Infiltrador:{w:{cl:.40,ab:.30,fogo:.30},wR:.52},
  Baiter:{w:{tr:.40,cl:.30,fogo:.30},wR:.32},
  Clutcher:{w:{cl:.55,fogo:.45},wR:.52},
  Facilitador:{w:{ut:.45,tr:.30,ab:.25},wR:.40},
  Cerebral:{w:{ab:.35,ut:.35,cl:.30},wR:.52},
  Ancora:{w:{cl:.40,ut:.35,tr:.25},wR:.45}};
const STYLE_CONTRA={
  aggressive:{cl:.14,ut:.08,sn:.06},
  spacetaker:{cl:.08,ut:.05,sn:.06},
  trader:{ent:.10,ab:.08,sn:.06},
  playmaker:{ut:.06,tr:.04,sn:.06},
  infiltrator:{ent:.18,tr:.08,sn:.06},
  baiter:{ent:.28,ab:.16,ut:.08,sn:.06},
  clutcher:{ent:.14,ab:.08,tr:.06,sn:.06},
  support:{fogo:.10,ent:.12,sn:.08},
  cerebral:{ent:.16,fogo:.06,sn:.06},
  anchor:{ent:.24,ab:.12,fogo:.06,sn:.06}
};
const STYLE_ROLE_FIT={
  AWPer:{spacetaker:.06,clutcher:.07,playmaker:.055,infiltrator:.04,baiter:.02,anchor:.02,aggressive:.02},
  Rifler:{spacetaker:.055,aggressive:.055,trader:.045,infiltrator:.03,playmaker:.03},
  Entry:{aggressive:.215,spacetaker:.18,trader:.07,playmaker:.045,infiltrator:-.08,clutcher:-.10,cerebral:-.16,baiter:-.28,anchor:-.30,support:-.12},
  Lurker:{infiltrator:.11,playmaker:.08,clutcher:.12,cerebral:.09,baiter:.06,anchor:.06,spacetaker:-.08,aggressive:-.16},
  Support:{support:.20,trader:.13,cerebral:.13,anchor:.12,clutcher:.04,aggressive:-.10,spacetaker:-.12,playmaker:-.04},
  IGL:{cerebral:.12,support:.10,trader:.06,playmaker:.04}
};
const NM_COR={pisoMin:45,spreadMax:35};
const STYLE_KEYS={aggressive:"Agressivo",spacetaker:"Spacetaker",trader:"Trader",playmaker:"Playmaker",infiltrator:"Infiltrador",baiter:"Baiter",clutcher:"Clutcher",support:"Facilitador",cerebral:"Cerebral",anchor:Object.keys(NM_DEF).find(k=>k.includes("ncora"))||"Ancora"};
const PLAYSTYLES={
  aggressive:{label:"Agressivo",traits:{pace:1,space:.7,trade:.2,structure:-.1,ct:-.2,t:.8}},
  spacetaker:{label:"Spacetaker",traits:{pace:.8,space:1,trade:0,structure:-.2,ct:-.2,t:1}},
  trader:{label:"Trader",traits:{pace:.2,space:.1,trade:1,structure:.4,ct:.2,t:.5}},
  playmaker:{label:"Playmaker",traits:{pace:.4,space:.8,trade:.1,structure:-.1,ct:.1,t:.6}},
  infiltrator:{label:"Infiltrador",traits:{pace:-.2,space:.8,trade:-.2,structure:.1,ct:.3,t:.3}},
  baiter:{label:"Baiter",traits:{pace:-.5,space:-.4,trade:.4,structure:-.2,ct:.2,t:-.3}},
  clutcher:{label:"Clutcher",traits:{pace:-.1,space:.1,trade:0,structure:.2,ct:.5,t:.1}},
  support:{label:"Facilitador",traits:{pace:.1,space:.2,trade:.6,structure:1,ct:.5,t:.5}},
  cerebral:{label:"Cerebral",traits:{pace:-.1,space:.4,trade:.2,structure:.9,ct:.4,t:.3}},
  anchor:{label:"Ancora",traits:{pace:-.6,space:-.2,trade:.2,structure:.8,ct:1,t:-.3}}};
const PLAYSTYLE_IDS=Object.keys(PLAYSTYLES);
const STYLE_LABEL=id=>id==="joker"?"Coringa":(PLAYSTYLES[id]?.label||id);
const STYLE_ID=x=>x==="Coringa"||x==="joker"?"joker":(PLAYSTYLE_IDS.find(id=>id===x||STYLE_KEYS[id]===x||PLAYSTYLES[id].label===x)||x);
const STYLE_RECIPE=id=>NM_DEF[STYLE_KEYS[id]];
const coringaWR=()=>PLAYSTYLE_IDS.reduce((s,id)=>s+(STYLE_RECIPE(id)?.wR||0),0)/PLAYSTYLE_IDS.length;
const ROLE_STYLE_BASE={
  Entry:{anchor:.46,support:.30,cerebral:.26,clutcher:.22,infiltrator:.18,trader:.12},
  Support:{aggressive:.28,spacetaker:.24,playmaker:.14,infiltrator:.12,baiter:.10},
  Lurker:{aggressive:.18,spacetaker:.14,trader:.12,support:.10},
  AWPer:{support:.16,anchor:.14,trader:.10},
  Rifler:{baiter:.18,anchor:.10},
  IGL:{aggressive:.16,spacetaker:.12,baiter:.12}
};
function roleStyleReality(role,style,p){
  const id=STYLE_ID(style),reasons=[];
  let cost=(ROLE_STYLE_BASE[role]&&ROLE_STYLE_BASE[role][id])||0;
  const en=p.en||0,fp=p.fp||0,tr=p.tr||0,op=p.op||0,cl=p.cl||0,ut=p.ut||0,sn=p.sn||0;
  if(role==="Entry"){
    if(["aggressive","spacetaker","playmaker","trader"].includes(id)&&en>=55)cost-=.08;
    if(id==="anchor"){if(cl>=60&&ut>=55&&en<55)cost-=.12;else reasons.push("entry com leitura passiva");}
    if(id==="support"){if(tr>=50&&ut>=55)cost-=.12;else reasons.push("entry sem suporte real");}
    if(Math.max(fp,op)<55)cost+=.08;
  }
  if(role==="Support"){
    if(ut>=55||tr>=52)cost-=.08; else cost+=.08;
    if(["aggressive","spacetaker"].includes(id)&&en>=60&&ut<55)reasons.push("support agressivo sem utility");
  }
  if(role==="AWPer"&&sn<60)cost+=.08;
  if(role==="Lurker"&&id==="aggressive"&&cl<50)cost+=.06;
  const finalCost=clamp(cost,0,.70);
  return {cost:finalCost,label:finalCost>=.45?"muito raro":finalCost>=.28?"raro":finalCost>=.14?"situacional":"natural",reasons};
}
function nmStats6(p,role){const fogo=role==="AWPer"?(p.sn||0):(p.fp||0);return {fogo,ent:p.en||0,ab:p.op||0,tr:p.tr||0,cl:p.cl||0,ut:p.ut||0};}
function stats7(p){return [p.fp||0,p.en||0,p.tr||0,p.op||0,p.cl||0,p.sn||0,p.ut||0];}
function badBaiterProfile(p){
  if(p.isIGL)return false; // IGL fraco em stats pode ser sacrifício de função, não egoísmo.
  const above=["fp","en","tr","op","cl","sn","ut"].filter(k=>(p[k]||0)>50).length;
  return above<=1&&(p.rating||0)<=1.00&&(p.fp||0)<=35&&(p.en||0)<=45&&
    (p.tr||0)<=25&&(p.cl||0)<=55&&(p.sn||0)<=30&&(p.ut||0)<=60;
}
function jokerProfile(s7){
  const sorted=[...s7].sort((a,b)=>b-a),below=s7.filter(v=>v<NM_COR.pisoMin).length;
  const min5=sorted[4]||0,spread=(sorted[0]||0)-(sorted[4]||0),mean=s7.reduce((a,b)=>a+b,0)/7;
  const variance=s7.reduce((s,v)=>s+(v-mean)**2,0)/7;
  return {ok:below<=1&&min5>=NM_COR.pisoMin&&spread<=NM_COR.spreadMax,sorted,below,min5,spread,mean,score:clamp(1-variance/800,0,1)};
}
function styleMatch(s6,s7,role="Rifler",p=null){
  if(p&&badBaiterProfile(p))return {id:"baiter",score:.9,second:.7,margin:.2,clarity:.85};
  const jp=jokerProfile(s7);
  if(jp.ok)return {id:"joker",score:.88+.12*jp.score,second:.72,margin:.16+.12*jp.score,clarity:.75+.25*jp.score};
  const scores=[];
  for(const id of PLAYSTYLE_IDS){if(id==="baiter")continue;const rec=STYLE_RECIPE(id);if(!rec)continue;const w=rec.w;let d=0,nw=0,ns=0;
    for(const [k] of NM_AXES){const wi=w[k]||0,si=s6[k];d+=wi*si;nw+=wi*wi;ns+=si*si;}
    let score=d/(Math.sqrt(nw*ns)+1e-9);
    const contra=STYLE_CONTRA[id]||{};let cd=0,cw=0;
    for(const k in contra){cd+=contra[k]*(s6[k]||0);cw+=contra[k];}
    score-=cw?cd/(100*cw)*.42:0;
    score+=(STYLE_ROLE_FIT[role]?.[id]||0);
    scores.push({id,score});}
  scores.sort((a,b)=>b.score-a.score);
  const best=scores[0]||{id:"playmaker",score:0},second=scores[1]?.score||0;
  return {...best,second,margin:best.score-second,clarity:clamp((best.score-second)*5,0,1)};
}
function nmOVR(p,role,forcedStyle=null){
  const s6=nmStats6(p,role),s7=stats7(p),match=forcedStyle?{id:STYLE_ID(forcedStyle),score:1,second:.75,margin:.25,clarity:.9}:styleMatch(s6,s7,role,p);
  const style=match.id,rating=ratingScore(p.rating);let wR,statScore;
  const roleRec=ROLE_PERFIL[role]||ROLE_PERFIL.Rifler,roleScore=dot(roleRec.ovr||{},p);
  if(style==="joker"){wR=clamp(.65*(roleRec.wR??coringaWR())+.35*coringaWR(),.35,.72);const jp=jokerProfile(s7),top5=jp.sorted.slice(0,5),meanTop5=top5.reduce((a,b)=>a+b,0)/5,meanAll=s7.reduce((a,b)=>a+b,0)/7;const styleScore=.55*meanTop5+.35*jp.min5+.10*(meanAll-meanTop5);statScore=.58*roleScore+.42*styleScore;}
  else{const rec=STYLE_RECIPE(style);wR=clamp(.65*(roleRec.wR??rec.wR)+.35*rec.wR,.35,.72);const styleScore=dot(rec.w,s6);statScore=.58*roleScore+.42*styleScore;}
  const clarityAdj=style==="joker"?1.2:(match.clarity-.45)*2.2,roleDutyAdj=clamp((statScore-55)/18,-2.5,1.5);
  const core=wR*rating+(1-wR)*statScore+clarityAdj+roleDutyAdj;
  return {style,ovr:curvaOVR(core),wR,statScore,core,s6,matchScore:match.score,matchMargin:match.margin};
}
const IGL_CREDITO_SHARE=.55;
function ovrUnificado(role,p,sec){const C=CFG_AVALIACAO,combatRole=role==="IGL"?(sec||"Rifler"):role,style=nmOVR(p,combatRole);
  if(role==="IGL")return Math.min(C.IGL_TETO,Math.max(1,curvaOVR(style.core+C.IGL_CREDITO*IGL_CREDITO_SHARE)+(C.IGL_TITULO[p.colocacao]||0)));
  return Math.min(C.OVR_MAX,Math.max(C.OVR_MIN,style.ovr));}
/* ┌─ PRISMA ─ arquétipo unificado ────────────────────────────────────┐ */
// Playstyle é a identidade principal; sub-arquétipo é a tradução dessa identidade
// dentro da função. Assim química/sim/verso leem a mesma decisão, não dois
// classificadores independentes.
const SUBARQ={
  AWPer:[
    {nome:"AWP Agressiva",sig:{en:.48,op:.27,fp:.25},agr:.9, lado:[-1,3],stats:["sn","op","fp","en"]}, // entra/abre com pick (en = agressão)
    {nome:"AWP Reativa",  sig:{cl:.48,sn:.30,ut:.22},agr:-.9,lado:[3,-1],stats:["sn","cl","ut","op"]}],// segura ângulos, espera o pick
  Rifler:[
    {nome:"Fragger",    sig:{fp:.55,op:.45},        agr:.6, lado:[-1,2],stats:["fp","op","en","cl"]}, // pura mira/impacto
    {nome:"Conector",   sig:{tr:.45,cl:.30,ut:.25}, agr:-.4,lado:[1,1], stats:["tr","cl","ut","fp"]}, // liga as jogadas
    {nome:"Mid-rounder",sig:{op:.42,cl:.33,ut:.25}, agr:0,  lado:[1,1], stats:["op","cl","ut","fp"]}],// controla o meio/info
  Entry:[
    {nome:"Ponta-de-lança",sig:{en:.55,op:.45},        agr:1, lado:[-3,5],stats:["en","op","fp","tr"]}, // 1º contato puro
    {nome:"Spacetaker",    sig:{op:.40,fp:.40,en:.20}, agr:.8,lado:[-2,4],stats:["op","fp","en","cl"]}],// 2º homem, toma espaço fragando
  Lurker:[
    {nome:"Infiltrador",sig:{cl:.50,fp:.28,op:.22},agr:-.3,lado:[2,1], stats:["cl","fp","op","ut"]}, // solo, flanco, info
    {nome:"Playmaker",  sig:{op:.50,fp:.30,cl:.20},agr:.4, lado:[0,2], stats:["op","fp","cl","ut"]}, // cria a jogada
    {nome:"Âncora",     sig:{cl:.40,ut:.40,tr:.20},agr:-1, lado:[5,-2],stats:["cl","ut","tr","op"]}],// segura o bombsite (CT)
  Support:[
    {nome:"Pop-flasher",sig:{ut:.55,op:.25,en:.20},agr:.2, lado:[1,1], stats:["ut","op","en","tr"]}, // flashes p/ abrir
    {nome:"Refrag",     sig:{tr:.50,fp:.30,ut:.20},agr:.3, lado:[1,2], stats:["tr","fp","ut","cl"]}] // troca e fecha o round
};
const SUB_CONTRA={
  AWPer:[{ut:.08,tr:.06},{en:.14,fp:.05}],
  Rifler:[{ut:.10,tr:.06,sn:.08},{en:.10,sn:.08},{en:.08,sn:.08}],
  Entry:[{cl:.14,ut:.10,tr:.08,sn:.08},{ut:.08,tr:.06,sn:.08}],
  Lurker:[{en:.20,tr:.06,sn:.06},{tr:.06,ut:.04,sn:.06},{en:.38,op:.16,fp:.08,sn:.06}],
  Support:[{fp:.08,sn:.08},{en:.08,sn:.08}]
};
const SUB_BY_STYLE={
  AWPer:{aggressive:0,spacetaker:0,playmaker:0,trader:1,infiltrator:1,baiter:1,clutcher:1,support:1,cerebral:1,anchor:1},
  Rifler:{aggressive:0,spacetaker:0,playmaker:0,trader:1,baiter:1,support:1,cerebral:2,infiltrator:2,clutcher:2,anchor:1},
  Entry:{aggressive:0,spacetaker:1,playmaker:1,trader:1,infiltrator:1,clutcher:1,baiter:1,cerebral:1,support:1,anchor:1},
  Lurker:{infiltrator:0,baiter:0,playmaker:1,spacetaker:1,aggressive:1,trader:1,clutcher:2,cerebral:2,support:2,anchor:2},
  Support:{support:0,cerebral:0,anchor:0,trader:1,aggressive:1,spacetaker:1,playmaker:1,infiltrator:1,baiter:1,clutcher:1}
};
// Coringa: jogador POLIVALENTE — piso alto em tudo E sem especialidade dominante (joga de tudo, sem estilo fixo)
const ehCoringa=p=>{const v=[p.fp||0,p.en||0,p.tr||0,p.op||0,p.cl||0,p.ut||0],mn=Math.min(...v),mx=Math.max(...v);
  return mn>=CFG_AVALIACAO.CORINGA_PISO&&(mx-mn)<=CFG_AVALIACAO.CORINGA_SPREAD;};
const SUB_CORINGA={nome:"Coringa",eixo:0,agr:0,lado:[0,0],stats:["fp","op","cl","ut"]};
function subArquetipo(role,p,styleId=null){const subs=SUBARQ[role];if(!subs)return null;
  if(ehCoringa(p))return{...SUB_CORINGA}; // polivalente: sobrepõe o estilo da função
  const forcedIndex=SUB_BY_STYLE[role]?.[STYLE_ID(styleId)];
  let best=subs[0],bs=-1,second=-1;
  subs.forEach((s,i)=>{const sc=dot(s.sig,p)-dot((SUB_CONTRA[role]||[])[i]||{},p);if(sc>bs){second=bs;bs=sc;if(forcedIndex==null)best=s;}else if(sc>second)second=sc;});
  if(forcedIndex!=null)best=subs[forcedIndex]||best;
  return{nome:best.nome,eixo:+(bs-Math.max(0,second)).toFixed(1),agr:best.agr,lado:best.lado,stats:best.stats};}
// STAR PLAYERS — definidos por curadoria (não se calcula: NiKo é star com OVR 15 ou 22).
const TIER_LENDA=["s1mple","ZywOo","device","dev1ce","NiKo","coldzera","donk","GeT_RiGhT","olofmeister"];
const TIER_STAR=["kennyS","m0NESY","KSCERATO","blameF","shox","XANTARES","JW","ropz","rain"];
// ORQUESTRADOR PRISMA→ZÊNITE: classifica (função+sub) e avalia (OVR) um jogador de uma vez.
function aplicarAvaliacaoContextual(p){
  const fallback=(!p.primario||!p.secundario)?classificar(p):null;
  const role=p.primario||fallback[0],sec=role==="IGL"?(p.secundario||fallback[1]):roleSecundarioSeguro(role,p.secundario||fallback[1],p);
  const combatRole=role==="IGL"?(sec||"Rifler"):role,style=nmOVR(p,combatRole);
  let ovr=Math.min(role==="IGL"?CFG_AVALIACAO.IGL_TETO:CFG_AVALIACAO.OVR_MAX,Math.max(CFG_AVALIACAO.OVR_MIN,style.ovr));
  if(role==="IGL")ovr=Math.min(CFG_AVALIACAO.IGL_TETO,Math.max(1,curvaOVR(style.core+CFG_AVALIACAO.IGL_CREDITO*IGL_CREDITO_SHARE)+(CFG_AVALIACAO.IGL_TITULO[p.colocacao]||0)));
  const sub=subArquetipo(combatRole,p,style.style);
  return Object.assign(p,{ovr,combatRole,role1:role==="IGL"?"IGL":role,role2:role==="IGL"?null:sec,playstyle:style.style,style,sub,esteira:ESTEIRA[role]});
}
function avaliarJogador(p){const classe=classificar(p);const role=classe[0];
  const _nk=p.nick||p.nome;const estrela=TIER_LENDA.includes(_nk)||TIER_STAR.includes(_nk);
  return aplicarAvaliacaoContextual({...p,primario:role,secundario:classe[1],secForte:classe.secForte!==false,classe:classe.join("-"),estrela});}
// PRISMA · passe de TIME: distribui as funções olhando o elenco, não o jogador isolado.
//  • cap 2 no role 1: no máx 2 jogadores com a mesma função primária; o excedente desce pra 2ª melhor afinidade.
//  • AWP: todo time tem AWPer — se ninguém é, o de maior sn assume (role 1; role 2 se for o IGL).
// idempotente (deriva da afinidade dos atributos, nunca do estado atual → seguro re-rodar). NÃO mexe em
// OVR (fica no melhor encaixe do jogador, ninguém é rebaixado) nem na esteira/sub.
function distribuirRoles(engs){
  const naoIgl=engs.filter(e=>!e.isIGL);
  const sc=new Map(naoIgl.map(e=>[e,afinidades(e)])); // mesma afinidade do PRISMA (fonte única)
  const cand=[];naoIgl.forEach(e=>ROLES_COMBATE.forEach(r=>cand.push({e,r,s:sc.get(e)[r]})));
  cand.sort((a,b)=>b.s-a.s);
  const capRole=r=>r==="AWPer"?1:2;              // TETO: só 1 AWPer primário por time; demais funções cap 2
  const count={};ROLES_COMBATE.forEach(r=>count[r]=0);const prim=new Map();
  cand.forEach(c=>{if(prim.has(c.e)||count[c.r]>=capRole(c.r))return;prim.set(c.e,c.r);count[c.r]++;});
  const melhorRole=e=>{const s=sc.get(e);return ROLES_COMBATE.reduce((b,r)=>s[r]>s[b]?r:b,ROLES_COMBATE[0]);};
  naoIgl.forEach(e=>{const p=prim.get(e),s=sc.get(e);const ord=ROLES_COMBATE.slice().sort((a,b)=>secondaryScore(p,b,e,s)-secondaryScore(p,a,e,s));
    e.primario=p;e.secundario=roleSecundarioSeguro(p,ord.find(r=>r!==p),e,s);
    // regra do teto de AWP: quem PEGARIA AWPer primário mas foi barrado → AWPer é forçado como função 2 (sempre)
    if(p!=="AWPer"&&melhorRole(e)==="AWPer")e.secundario="AWPer";
    e.secForte=(secondaryScore(p,e.secundario,e,s)/Math.max(1,s[p]))>=.82;});
  // AWP: ninguém AWPer (primário, nem IGL com AWP no role 2)? → maior sn assume (role 1; role 2 se IGL)
  if(!engs.some(j=>j.primario==="AWPer"||(j.primario==="IGL"&&j.secundario==="AWPer"))){
    const notaAWP=j=>(j.sn??0)*1000+(j.op??0)+(j.fp??0)*.5; // desempate: sn manda; empate (ex.: todos 0) → melhor abertura/fogo pega a AWP
    const c=engs.reduce((b,j)=>(notaAWP(j)>notaAWP(b)?j:b),engs[0]);
    if(c.primario==="IGL")c.secundario="AWPer";else{c.secundario=c.primario;c.primario="AWPer";}}
  engs.forEach(aplicarAvaliacaoContextual);
  return engs;}
/* ╔═══════════════════════════════════════════════════════════════════╗
   ║  SINAPSE — química de elenco e força efetiva                        ║
   ║  Lê as funções/OVRs do PRISMA+ZÊNITE e mede como o time se LIGA:    ║
   ║  cobertura de pilares, saturação, egos e o efeito do treinador.     ║
   ╚═══════════════════════════════════════════════════════════════════╝ */
function ovrTreinador(somaOVR,colocacao){const C=CFG_QUIMICA;
  const base=C.TREINADOR_PLACAR[colocacao]??C.TREINADOR_MIN;       // o que o time conquistou
  const tip=C.DERIVA.SOMA_ESPERADA[colocacao]??70;                 // soma de OVR típica p/ essa conquista
  const prestigio=C.TREINADOR_STR*Math.max(0,somaOVR-tip);         // liderar elenco acima do típico agrega (não pune time fraco)
  return clamp(Math.round(base+prestigio),C.TREINADOR_MIN,C.TREINADOR_MAX);}
function quimicaPlaystyles(jogadores,caracTreinador=null){
  const qtd={};jogadores.map(j=>STYLE_ID(j.playstyle)).forEach(e=>qtd[e]=(qtd[e]||0)+1);
  const temCoringa=qtd.joker>0,alertas=[];let quimica=1,sinergias=0;
  const nAggro=(qtd.aggressive||0)+(qtd.spacetaker||0);
  if(nAggro>0&&qtd.support){const b=Math.min(.08,.03*nAggro);quimica+=b;sinergias++;alertas.push(`Ponta de Lanca +${Math.round(b*100)}%`);}
  if(qtd.aggressive&&qtd.trader){const b=Math.min(.06,.03*Math.min(2,qtd.aggressive));quimica+=b;sinergias++;alertas.push(`Dupla Dinamica +${Math.round(b*100)}%`);}
  if(qtd.spacetaker&&qtd.trader){const b=.04;quimica+=b;sinergias++;alertas.push(`Entry + Trade +${Math.round(b*100)}%`);}
  if(qtd.playmaker&&qtd.baiter){const b=.03;quimica+=b;sinergias++;alertas.push(`Espaco + Lucro +${Math.round(b*100)}%`);}
  if(qtd.playmaker&&qtd.support&&!nAggro){const b=.04;quimica+=b;sinergias++;alertas.push(`Estrela Apoiado +${Math.round(b*100)}%`);}
  if(qtd.cerebral&&qtd.support){const b=.03;quimica+=b;sinergias++;alertas.push(`Utility Combo +${Math.round(b*100)}%`);}
  if(qtd.infiltrator&&qtd.aggressive){const b=.03;quimica+=b;sinergias++;alertas.push(`Split Setup +${Math.round(b*100)}%`);}
  if(qtd.infiltrator&&qtd.cerebral){const b=.05;quimica+=b;sinergias++;alertas.push(`Rede de Informacao +${Math.round(b*100)}%`);}
  if(qtd.anchor&&qtd.clutcher){const b=.05;quimica+=b;sinergias++;alertas.push(`Retake Perfeito +${Math.round(b*100)}%`);}
  if(temCoringa&&qtd.aggressive){const b=.02;quimica+=b;sinergias++;alertas.push(`Coringa + Agressivo +${Math.round(b*100)}%`);}
  if(temCoringa&&qtd.cerebral){const b=.03;quimica+=b;sinergias++;alertas.push(`Coringa + Cerebral +${Math.round(b*100)}%`);}
  const avgPace=jogadores.reduce((s,j)=>{const id=STYLE_ID(j.playstyle);return s+(PLAYSTYLES[id]?.traits?.pace||0);},0)/Math.max(1,jogadores.length);
  const satPlaymakers=(qtd.playmaker||0)+(qtd.baiter||0)>=3,invasaoEspaco=(qtd.infiltrator||0)>=2;
  const guerraEstrelas=jogadores.filter(j=>j.estrela).length>=3,covardia=avgPace<-.15;
  let pen=0;
  if(satPlaymakers){pen+=.15;alertas.push("Saturacao de Playmakers -15%");}
  if(covardia){pen+=.10;alertas.push("Covardia Tatica -10%");}
  if(invasaoEspaco){pen+=.10;alertas.push("Invasao de Espaco -10%");}
  if(guerraEstrelas){pen+=.15;alertas.push("Guerra de Estrelas -15%");}
  if(caracTreinador){
    if(caracTreinador==="Estrategista"&&sinergias>0){const b=Math.min(.08,.04*sinergias);quimica+=b;alertas.push(`Prancheta +${Math.round(b*100)}%`);}
    if(caracTreinador==="Estrategista"&&invasaoEspaco){pen=Math.max(0,pen-.04);alertas.push("Plano anti-lurk +4%");}
    if(caracTreinador==="Gestor"&&guerraEstrelas){pen=Math.max(0,pen-.10);alertas.push("Gestor domou os Egos +10%");}
    if(caracTreinador==="Gestor"&&satPlaymakers){pen=Math.max(0,pen-.04);alertas.push("Hierarquia definida +4%");}
    if(caracTreinador==="Motivador"&&covardia){pen=Math.max(0,pen-.06);alertas.push("Grito do Motivador +6%");}
    else if(caracTreinador==="Motivador"&&avgPace<0){quimica+=.03;alertas.push("Motivador acelerou +3%");}
    if(caracTreinador==="Desenvolvedor"&&temCoringa){quimica+=.05;alertas.push("Coringa lapidado +5%");}
    if(caracTreinador==="Desenvolvedor"&&(qtd.baiter||0)>=2){quimica+=.04;alertas.push("Baiters evoluidos +4%");}
  }
  if(temCoringa&&pen>0){pen*=.5;alertas.push("Coringa mitigou conflitos");}
  const raw=clamp(quimica-pen,.5,1.08);
  return {mult:clamp(1+(raw-1)*.55,.90,1.05),alertas};
}
function quimicaComposicao(jogadores,caracTreinador=null){const C=CFG_QUIMICA;
  const car=caracTreinador?(C.CARAC[caracTreinador]??{}):{};const alertas=[];
  // IGLs acumulam DUAS funções (IGL + sua role 2). a cobertura considera a role 2 de TODOS os IGLs;
  // o IGL de maior OVR é quem lidera (comando). Assim a cobertura independe da ordem dos slots.
  const igls=jogadores.filter(j=>j.primario==="IGL");
  const melhorIgl=igls.reduce((b,j)=>(!b||j.ovr>b.ovr)?j:b,null);
  const temPrim=fn=>jogadores.some(j=>j.primario===fn)||igls.some(j=>j.secundario===fn);
  // cobertura secundária ponderada (forte=cheio, nominal=meio) p/ o tamanho da penalidade parcial
  const nSec=fn=>jogadores.filter(j=>j.secundario===fn&&j.primario!==fn)
    .reduce((s,j)=>s+(j.secForte?1:C.SEC_NOMINAL_PESO),0);
  // headcount cru (forte OU nominal) p/ a regra de dupla cobertura: 2 jogadores com a função 2 = 1 primário
  const nSecRaw=fn=>jogadores.filter(j=>j.secundario===fn&&j.primario!==fn).length;
  // mitigação de penalidade pela característica do treinador (recupera rumo a 100%, nunca acima)
  const crus=car.cruRef!=null?jogadores.filter(j=>j.ovr<=car.cruRef).length:0;
  let corteFrac=car.cortePenalidade||0;                                  // Motivador: corta tudo
  if(car.corteEstrutura)corteFrac=Math.max(corteFrac,car.corteEstrutura); // Estrategista: corta estrutura
  if(car.cruPorJogador&&crus>0)corteFrac=Math.max(corteFrac,Math.min(car.cruTeto,crus*car.cruPorJogador)); // Desenvolvedor: escala c/ crus
  const corte=1-corteFrac;
  const corteIGL=car.corteComando?(1-car.corteComando):1; // comando é estrutural: só o Estrategista ameniza
  let mult=1;
  // pilar com 3 estados: primário=0% | 2+ jogadores com a função 2=dupla cobertura | 1 secundário=penalidade parcial | nenhum=cheia
  const pilar=(nome,pen,temP,secs,secsRaw)=>{
    if(temP){alertas.push(`${nome}`);return;}
    if(secsRaw>=2){alertas.push(`${nome} (dupla cobertura)`);return;} // 2 jogadores com a função 2 = 1 primário (decisão de design)
    if(secs>0){const p=pen*Math.pow(0.5,secs)*corte;mult*=(1-p);alertas.push(`${nome} secundária −${Math.round(p*100)}%`);return;}
    mult*=(1-pen*corte);alertas.push(`${nome} falta −${Math.round(pen*corte*100)}%`);
  };
  const isIglFraco=melhorIgl&&melhorIgl.ovr<C.IGL_FRACO_OVR;
  let penCmd=1; // comando é estrutural: aplicado FORA da resistência de talento (em forcaTime)
  if(!melhorIgl){penCmd=1-C.PEN.semIGL*corteIGL;alertas.push(`Comando falta −${Math.round(C.PEN.semIGL*corteIGL*100)}%`);}
  else if(isIglFraco){penCmd=1-C.PEN.iglFraco*corteIGL;alertas.push(`Comando fraco −${Math.round(C.PEN.iglFraco*corteIGL*100)}%`);}
  else alertas.push("Comando");
  pilar("AWP",C.PEN.semAWP,temPrim("AWPer"),nSec("AWPer"),nSecRaw("AWPer"));
  pilar("Âncora",C.PEN.semAncora,temPrim("Lurker")||temPrim("Support"),nSec("Lurker")+nSec("Support"),nSecRaw("Lurker")+nSecRaw("Support"));
  // Iniciativa: Entry abre o round (preenche completo); Rifler é fogo sem abertura (cobre parcial)
  if(temPrim("Entry")){alertas.push("Iniciativa");}
  else if(nSecRaw("Entry")>=2){alertas.push("Iniciativa (dupla cobertura)");} // 2 jogadores com Entry 2 = 1 primário
  else if(temPrim("Rifler")){const eSec=nSec("Entry");const fator=eSec>0?C.RIFLER_INICIATIVA*Math.pow(0.5,eSec):C.RIFLER_INICIATIVA;const p=C.PEN.semIniciativa*fator*corte;mult*=(1-p);alertas.push(`Iniciativa ${eSec>0?"parcial":"limitada"} −${Math.round(p*100)}%`);}
  else pilar("Iniciativa",C.PEN.semIniciativa,false,nSec("Entry")+nSec("Rifler"),nSecRaw("Entry")+nSecRaw("Rifler"));
  // saturação: excesso de uma função primária além do ideal (a role 2 de cada IGL conta como +1 naquela função)
  let satTotal=0;
  ["IGL","AWPer","Lurker","Support","Entry","Rifler"].forEach(fn=>{
    let n=jogadores.filter(j=>j.primario===fn).length+igls.filter(j=>j.secundario===fn).length;
    if(fn==="Rifler"){const vers=jogadores.filter(j=>j.primario==="Rifler"&&["Entry","Lurker","Support"].includes(j.secundario)).length;n-=vers*C.RIFLER_VERSATIL_ALIVIO;}
    const excesso=Math.max(0,n-C.IDEAL[fn]);
    if(excesso>0){const p=excesso*C.DUREZA[fn]*corte;satTotal+=p;mult*=(1-p);
      alertas.push(`${n}× ${fn} −${Math.round(p*100)}%`);}
  });
  // estrela: só funções de holofote geram atrito de ego (IGL/Support servem, não disputam protagonismo)
  const nEstrelasEgo=jogadores.filter(j=>j.estrela&&C.FUNC_EGO.includes(j.primario)).length;
  const limiteEstrelas=C.ESTRELA_LIMITE+(car.tetoEstrelasBonus||0);const extras=Math.max(0,nEstrelasEgo-limiteEstrelas);
  if(extras>0){const pe=(car.estrelaExtraPen??C.PEN.estrelaExtra)*corte;mult*=Math.pow(1-pe,extras);
    alertas.push(`Estrelas (${nEstrelasEgo}) −${Math.round(pe*extras*100)}%`);}else alertas.push(`Estrelas (${nEstrelasEgo})`);
  // SEM bônus aditivo: um time perfeito já fica em 100% por não ter penalidade nenhuma.
  const ps=quimicaPlaystyles(jogadores,caracTreinador);
  mult*=ps.mult;
  ps.alertas.forEach(a=>alertas.push(a));
  const temPilares=melhorIgl&&melhorIgl.ovr>=C.IGL_FRACO_OVR&&temPrim("AWPer")&&(temPrim("Lurker")||temPrim("Support"))&&(temPrim("Entry")||temPrim("Rifler"));
  alertas.push(temPilares&&nEstrelasEgo<=limiteEstrelas&&satTotal<=C.SAT_LEVE?"Estrutura":"Estrutura falta");
  if(car.cruPorJogador&&crus>0)alertas.push(`Desenvolvimento (${crus} cru${crus>1?"s":""})`); // selo: a mitigação já entrou no corte
  const quimSemCmd=Math.max(C.QUIMICA_MIN,Math.min(C.QUIMICA_MAX,mult));
  return{quimica:+Math.max(C.QUIMICA_MIN,Math.min(C.QUIMICA_MAX,mult*penCmd)).toFixed(3),quimicaSemCmd:+quimSemCmd.toFixed(3),penCmd:+penCmd.toFixed(3),alertas};}
const arred=x=>Math.floor(x+0.4); // arredonda: fracionário ≥.6 sobe, ≤.5 desce
function forcaTime(jogadores,caracTreinador=null,ovrTreinador=null){const bruta=jogadores.reduce((s,j)=>s+j.ovr,0);
  const q=quimicaComposicao(jogadores,caracTreinador);
  const C=CFG_QUIMICA;const tf=C.TREINADOR_FORCA;
  const fatorT=ovrTreinador!=null?1+(ovrTreinador-tf.neutro)*tf.porPonto:1;
  // Talento resiste à química ruim: times de firepower alto preenchem parte do que falta até o teto.
  // (FaZe/SK têm bruta enorme mas química comprometida — o talento individual ganha rounds no CS real.)
  const tal=C.TALENTO;
  const resist=clamp((bruta-tal.refBruta)/tal.divisor,0,1)*tal.recMax;
  // firepower alto recupera parte da química penalizada — mas no MÁX recMax do buraco (nunca tudo). Comando vem depois.
  const baseEf=Math.min(tal.teto,q.quimicaSemCmd+(1-q.quimicaSemCmd)*resist);
  const quimicaEf=+Math.max(C.QUIMICA_MIN,Math.min(C.QUIMICA_MAX,baseEf*q.penCmd)).toFixed(3); // comando é estrutural: firepower não compra um caller
  return{bruta,...q,quimica:quimicaEf,fatorTreinador:fatorT,efetiva:arred(bruta*quimicaEf*fatorT)};}
function derivaCaracteristica(time,POOL){const D=CFG_QUIMICA.DERIVA;const js=time.jogadores.map(n=>POOL[n]);
  const ovrs=js.map(j=>j.ovr);const min=Math.min(...ovrs),max=Math.max(...ovrs),soma=ovrs.reduce((a,b)=>a+b,0),media=soma/js.length;
  const estrelas=js.filter(j=>j.estrela);
  const igl=js.find(j=>j.primario==="IGL");
  const temFn=fn=>js.some(j=>j.primario===fn)||(!!igl&&igl.secundario===fn);
  const pilares=!!igl&&igl.ovr>=CFG_QUIMICA.IGL_FRACO_OVR&&temFn("AWPer")&&(temFn("Lurker")||temFn("Support"));
  const score={Gestor:estrelas.length>=2?Math.max(0,estrelas.reduce((s,j)=>s+(j.ovr-17),0)-3):0,
    Desenvolvedor:D.DESENV_RESULTADO_MIN.includes(time.colocacao)?Math.max(0,13-min)+Math.max(0,media-min-2.5)*.5:0,
    Estrategista:(pilares?2:0)-estrelas.length*1.05-Math.max(0,(max-min)-5)*.3, // estrelas puxam pra longe do Estrategista (caller que gerencia egos vira Motivador/Gestor)
    Motivador:(D.SOMA_ESPERADA[time.colocacao]-soma)/5};
  const[carac,val]=Object.entries(score).sort((a,b)=>b[1]-a[1])[0];return val>=D.LIMIAR?carac:"Motivador";}

/* ╔═══════════════════════════════════════════════════════════════════╗
   ║  DADOS — jogadores e times (já refratados por PRISMA·ZÊNITE·SINAPSE)║
   ║  ATRIBUTOS (cartas) → POOL (avaliado) → TEAMS (funções no contexto  ║
   ║  do time + química do treinador). Daqui pra baixo: a PARTIDA e a UI. ║
   ╚═══════════════════════════════════════════════════════════════════╝ */
const PAISES_MAP={s1mple:"UKR",electroNic:"RUS",b1t:"UKR",Perfecto:"RUS",Boombl4:"RUS",donk:"RUS",sh1ro:"RUS",tN1R:"BLR",zweih:"RUS",chopper:"RUS",
  ZywOo:"FRA",ropz:"EST",mezii:"GBR",flameZ:"ISR",apEX:"FRA",mzinho:"MNG",bLitz:"MNG","910":"MNG",controlez:"MNG",Techno:"MNG",
  KSCERATO:"BRA",yuurih:"BRA",saffee:"BRA",arT:"BRA",drop:"BRA",FL1T:"RUS",fame:"RUS",n0rb3r7:"RUS",Qikert:"KAZ",Jame:"RUS",
  coldzera:"BRA",TACO:"BRA",FalleN:"BRA",fnx:"BRA",fer:"BRA",
  B1ad3:"UKR",Outsiders:"RUS",guerri:"BRA",dead:"BRA",XTQZZZ:"FRA",hally:"RUS",maaRaa:"MNG",dastan:"KAZ",valens:"CAN",zakk:"BRA",Swani:"GER",sidde:"BRA",
  kennyS:"FRA","NBK-":"FRA",Happy:"FRA",apEX_envy:"FRA",kioShiMa:"FRA",
  tarik:"USA",autimatic:"USA",RUSH:"USA",Skadoodle:"USA",Stewie2K:"USA",
  RobbaN:"SWE",zonic:"DEN",kakafu:"AUT"};

const ATRIBUTOS=[
  {nome:"s1mple",fp:100,en:25,tr:30,op:93,cl:24,sn:87,ut:50,rating:1.47,colocacao:"Campeao",isIGL:false},
  {nome:"electroNic",fp:96,en:58,tr:24,op:96,cl:62,sn:0,ut:75,rating:1.28,colocacao:"Campeao",isIGL:false},
  {nome:"b1t",fp:84,en:9,tr:10,op:72,cl:55,sn:4,ut:66,rating:1.27,colocacao:"Campeao",isIGL:false},
  {nome:"Perfecto",fp:25,en:58,tr:61,op:21,cl:54,sn:0,ut:57,rating:1.08,colocacao:"Campeao",isIGL:false},
  {nome:"Boombl4",fp:26,en:73,tr:42,op:20,cl:58,sn:0,ut:58,rating:1.06,colocacao:"Campeao",isIGL:true},
  {nome:"donk",fp:100,en:42,tr:74,op:96,cl:13,sn:10,ut:34,rating:1.57,colocacao:"Top4",isIGL:false},
  {nome:"sh1ro",fp:69,en:17,tr:31,op:24,cl:75,sn:94,ut:73,rating:1.16,colocacao:"Top4",isIGL:false},
  {nome:"tN1R",fp:48,en:87,tr:18,op:26,cl:63,sn:0,ut:56,rating:1.05,colocacao:"Top4",isIGL:false},
  {nome:"zweih",fp:24,en:36,tr:8,op:68,cl:22,sn:2,ut:42,rating:0.97,colocacao:"Top4",isIGL:false},
  {nome:"chopper",fp:2,en:21,tr:10,op:31,cl:70,sn:0,ut:86,rating:0.85,colocacao:"Top4",isIGL:true},
  {nome:"ZywOo",fp:99,en:25,tr:56,op:80,cl:49,sn:95,ut:63,rating:1.38,colocacao:"Campeao",isIGL:false},
  {nome:"ropz",fp:95,en:26,tr:58,op:78,cl:87,sn:4,ut:16,rating:1.37,colocacao:"Campeao",isIGL:false},
  {nome:"mezii",fp:82,en:80,tr:78,op:27,cl:94,sn:0,ut:58,rating:1.23,colocacao:"Campeao",isIGL:false},
  {nome:"flameZ",fp:39,en:76,tr:10,op:63,cl:37,sn:0,ut:62,rating:1.02,colocacao:"Campeao",isIGL:false},
  {nome:"apEX",fp:2,en:62,tr:31,op:69,cl:52,sn:0,ut:95,rating:0.85,colocacao:"Campeao",isIGL:true},
  {nome:"mzinho",fp:89,en:21,tr:5,op:76,cl:24,sn:3,ut:65,rating:1.22,colocacao:"Top8",isIGL:false},
  {nome:"bLitz",fp:66,en:56,tr:47,op:54,cl:87,sn:1,ut:98,rating:1.08,colocacao:"Top8",isIGL:true},
  {nome:"910",fp:56,en:21,tr:38,op:47,cl:94,sn:92,ut:62,rating:1.02,colocacao:"Top8",isIGL:false},
  {nome:"controlez",fp:55,en:2,tr:28,op:74,cl:80,sn:1,ut:46,rating:1.00,colocacao:"Top8",isIGL:false},
  {nome:"Techno",fp:9,en:37,tr:13,op:59,cl:34,sn:0,ut:40,rating:0.87,colocacao:"Top8",isIGL:false},
  {nome:"KSCERATO",fp:98,en:10,tr:38,op:79,cl:92,sn:1,ut:76,rating:1.34,colocacao:"Top4",isIGL:false},
  {nome:"yuurih",fp:69,en:21,tr:34,op:24,cl:82,sn:0,ut:68,rating:1.13,colocacao:"Top4",isIGL:false},
  {nome:"saffee",fp:48,en:42,tr:51,op:44,cl:37,sn:91,ut:58,rating:1.07,colocacao:"Top4",isIGL:false},
  {nome:"arT",fp:41,en:58,tr:3,op:77,cl:24,sn:16,ut:54,rating:1.02,colocacao:"Top4",isIGL:true},
  {nome:"drop",fp:52,en:55,tr:34,op:23,cl:23,sn:0,ut:52,rating:1.06,colocacao:"Top4",isIGL:false},
  {nome:"FL1T",fp:91,en:18,tr:37,op:82,cl:68,sn:0,ut:57,rating:1.25,colocacao:"Campeao",isIGL:false},
  {nome:"fame",fp:86,en:58,tr:41,op:92,cl:51,sn:0,ut:67,rating:1.24,colocacao:"Campeao",isIGL:false},
  {nome:"n0rb3r7",fp:27,en:34,tr:40,op:12,cl:52,sn:0,ut:58,rating:1.03,colocacao:"Campeao",isIGL:false},
  {nome:"Qikert",fp:4,en:91,tr:1,op:59,cl:28,sn:0,ut:84,rating:0.94,colocacao:"Campeao",isIGL:false},
  {nome:"Jame",fp:80,en:9,tr:21,op:74,cl:94,sn:96,ut:79,rating:1.31,colocacao:"Campeao",isIGL:true},
  {nome:"coldzera",fp:99,en:14,tr:35,op:22,cl:80,sn:75,ut:45,rating:1.38,colocacao:"Campeao",isIGL:false},
  {nome:"TACO",fp:96,en:78,tr:8,op:73,cl:39,sn:2,ut:24,rating:1.25,colocacao:"Campeao",isIGL:false},
  {nome:"FalleN",fp:68,en:46,tr:17,op:78,cl:51,sn:95,ut:55,rating:1.19,colocacao:"Campeao",isIGL:true},
  {nome:"fnx",fp:79,en:48,tr:24,op:52,cl:33,sn:0,ut:82,rating:1.19,colocacao:"Campeao",isIGL:false},
  {nome:"fer",fp:72,en:25,tr:10,op:89,cl:32,sn:0,ut:17,rating:1.12,colocacao:"Campeao",isIGL:false},
  {nome:"kennyS",fp:94,en:46,tr:52,op:96,cl:63,sn:98,ut:28,rating:1.23,colocacao:"Campeao",isIGL:false},
  {nome:"NBK-",fp:79,en:44,tr:81,op:36,cl:68,sn:5,ut:72,rating:1.14,colocacao:"Campeao",isIGL:false},
  {nome:"Happy",fp:65,en:11,tr:39,op:40,cl:43,sn:12,ut:54,rating:1.10,colocacao:"Campeao",isIGL:true},
  {id:"apEX_envy",nome:"apEX",fp:77,en:97,tr:41,op:89,cl:24,sn:1,ut:42,rating:1.11,colocacao:"Campeao",isIGL:false},
  {nome:"kioShiMa",fp:61,en:52,tr:61,op:32,cl:49,sn:0,ut:64,rating:1.07,colocacao:"Campeao",isIGL:false},
  // Virtus.pro · EMS One Katowice 2014 (curadoria: era Rating 1.0 traduzida pra escala atual, por papel real)
  {nome:"pashaBiceps",pais:"POL",fp:88,en:41,tr:48,op:92,cl:68,sn:81,ut:36,rating:1.38,colocacao:"Campeao",isIGL:false}, // A AWP do time, MVP do major
  {nome:"NEO",pais:"POL",fp:66,en:34,tr:77,op:42,cl:78,sn:6,ut:71,rating:1.16,colocacao:"Campeao",isIGL:false},
  {nome:"Snax",pais:"POL",fp:72,en:44,tr:82,op:78,cl:94,sn:18,ut:54,rating:1.20,colocacao:"Campeao",isIGL:false},
  {nome:"byali",pais:"POL",fp:75,en:81,tr:55,op:68,cl:48,sn:1,ut:32,rating:1.31,colocacao:"Campeao",isIGL:false},
  {nome:"TaZ",pais:"POL",fp:23,en:36,tr:32,op:25,cl:42,sn:0,ut:66,rating:0.85,colocacao:"Campeao",isIGL:true},
  {nome:"tarik",fp:93,en:42,tr:59,op:53,cl:25,sn:24,ut:49,rating:1.22,colocacao:"Campeao",isIGL:true},
  {nome:"autimatic",fp:89,en:58,tr:37,op:53,cl:28,sn:14,ut:42,rating:1.20,colocacao:"Campeao",isIGL:false},
  {nome:"RUSH",fp:68,en:84,tr:88,op:27,cl:47,sn:0,ut:43,rating:1.16,colocacao:"Campeao",isIGL:false},
  {nome:"Skadoodle",fp:57,en:77,tr:25,op:77,cl:60,sn:94,ut:68,rating:1.15,colocacao:"Campeao",isIGL:false},
  {nome:"Stewie2K",fp:85,en:77,tr:25,op:80,cl:33,sn:16,ut:64,rating:1.14,colocacao:"Campeao",isIGL:false},
  {nome:"NiKo",pais:"BIH",fp:100,en:29,tr:59,op:90,cl:86,sn:4,ut:64,rating:1.70,colocacao:"Campeao",isIGL:false},
  {nome:"rain",pais:"NOR",fp:100,en:84,tr:37,op:96,cl:62,sn:0,ut:51,rating:1.61,colocacao:"Campeao",isIGL:false},
  {nome:"GuardiaN",pais:"SVK",fp:87,en:40,tr:31,op:84,cl:28,sn:95,ut:47,rating:1.32,colocacao:"Campeao",isIGL:false},
  {nome:"olofmeister",pais:"SWE",fp:79,en:39,tr:6,op:36,cl:6,sn:7,ut:23,rating:1.27,colocacao:"Campeao",isIGL:false},
  {nome:"karrigan",pais:"DEN",fp:33,en:93,tr:5,op:46,cl:19,sn:4,ut:66,rating:1.20,colocacao:"Campeao",isIGL:true},
  {nome:"device",pais:"DEN",fp:93,en:11,tr:41,op:88,cl:39,sn:90,ut:65,rating:1.32,colocacao:"Campeao",isIGL:false},
  {nome:"Xyp9x",pais:"DEN",fp:91,en:44,tr:34,op:19,cl:87,sn:1,ut:91,rating:1.29,colocacao:"Campeao",isIGL:false},
  {nome:"Magisk",pais:"DEN",fp:88,en:84,tr:30,op:66,cl:36,sn:10,ut:53,rating:1.28,colocacao:"Campeao",isIGL:false},
  {nome:"dupreeh",pais:"DEN",fp:92,en:70,tr:31,op:92,cl:49,sn:7,ut:41,rating:1.25,colocacao:"Campeao",isIGL:false},
  {nome:"gla1ve",pais:"DEN",fp:32,en:62,tr:17,op:53,cl:34,sn:0,ut:95,rating:1.05,colocacao:"Campeao",isIGL:true},
  // ——— Immortals · PGL Major Krakow 2017 (Finalista) ———
  {nome:"kNgV-",pais:"BRA",fp:81,en:36,tr:44,op:86,cl:39,sn:74,ut:40,rating:1.12,colocacao:"Final",isIGL:false},
  {nome:"HEN1",pais:"BRA",fp:55,en:13,tr:7,op:64,cl:86,sn:94,ut:68,rating:1.12,colocacao:"Final",isIGL:false},
  {nome:"LUCAS1",pais:"BRA",fp:75,en:89,tr:65,op:27,cl:45,sn:0,ut:48,rating:1.11,colocacao:"Final",isIGL:false},
  {nome:"boltz",pais:"BRA",fp:64,en:5,tr:23,op:59,cl:25,sn:0,ut:81,rating:1.08,colocacao:"Final",isIGL:false},
  {nome:"steel",pais:"BRA",fp:69,en:52,tr:38,op:32,cl:34,sn:0,ut:24,rating:1.08,colocacao:"Final",isIGL:true},
  // ——— G2 · IEM Sydney 2023 (3rd-4th) ———
  {nome:"m0NESY",pais:"RUS",fp:99,en:48,tr:8,op:89,cl:38,sn:91,ut:49,rating:1.44,colocacao:"Top4",isIGL:false},
  {nome:"jks",pais:"AUS",fp:34,en:50,tr:78,op:27,cl:51,sn:0,ut:54,rating:1.06,colocacao:"Top4",isIGL:false},
  {id:"NiKo_g2",nome:"NiKo",pais:"BIH",fp:45,en:51,tr:57,op:50,cl:51,sn:3,ut:53,rating:1.05,colocacao:"Top4",isIGL:false},
  {nome:"huNter-",pais:"BIH",fp:28,en:51,tr:66,op:23,cl:44,sn:1,ut:74,rating:0.97,colocacao:"Top4",isIGL:false},
  {nome:"HooXi",pais:"DEN",fp:5,en:70,tr:56,op:46,cl:31,sn:0,ut:81,rating:0.79,colocacao:"Top4",isIGL:true},
  // ——— Spirit · IEM Katowice 2024 (Campeao) ———
  {id:"donk_kato24",nome:"donk",pais:"RUS",fp:100,en:53,tr:69,op:97,cl:63,sn:0,ut:35,rating:1.75,colocacao:"Campeao",isIGL:false},
  {id:"sh1ro_kato24",nome:"sh1ro",pais:"RUS",fp:68,en:40,tr:94,op:36,cl:94,sn:86,ut:47,rating:1.20,colocacao:"Campeao",isIGL:false},
  {nome:"zont1x",pais:"UKR",fp:49,en:57,tr:22,op:75,cl:57,sn:0,ut:53,rating:1.12,colocacao:"Campeao",isIGL:false},
  {nome:"magixx",pais:"RUS",fp:21,en:93,tr:54,op:28,cl:79,sn:0,ut:66,rating:1.07,colocacao:"Campeao",isIGL:false},
  {id:"chopper_kato24",nome:"chopper",pais:"RUS",fp:13,en:93,tr:6,op:52,cl:35,sn:0,ut:65,rating:1.02,colocacao:"Campeao",isIGL:true},
  // ——— FURIA · IEM Chengdu 2025 (Campeao) ———
  {id:"FalleN_furia25",nome:"FalleN",pais:"BRA",fp:5,en:63,tr:37,op:10,cl:40,sn:2,ut:76,rating:0.86,colocacao:"Campeao",isIGL:true},
  {nome:"YEKINDAR",pais:"LVA",fp:73,en:62,tr:3,op:91,cl:21,sn:0,ut:47,rating:1.11,colocacao:"Campeao",isIGL:false},
  {id:"yuurih_furia25",nome:"yuurih",pais:"BRA",fp:67,en:49,tr:39,op:18,cl:50,sn:0,ut:72,rating:1.13,colocacao:"Campeao",isIGL:false},
  {id:"KSCERATO_furia25",nome:"KSCERATO",pais:"BRA",fp:85,en:25,tr:36,op:77,cl:53,sn:0,ut:91,rating:1.23,colocacao:"Campeao",isIGL:false},
  {nome:"molodoy",pais:"KAZ",fp:93,en:5,tr:61,op:70,cl:89,sn:96,ut:55,rating:1.27,colocacao:"Campeao",isIGL:false},
  // ——— BIG · ESL One Cologne 2018 (Vice-campeão) ———
  {nome:"tabseN",pais:"GER",fp:90,en:33,tr:13,op:82,cl:46,sn:84,ut:89,rating:1.18,colocacao:"Final",isIGL:false},
  {nome:"nex",pais:"GER",fp:88,en:34,tr:69,op:31,cl:32,sn:0,ut:87,rating:1.10,colocacao:"Final",isIGL:false},
  {nome:"tiziaN",pais:"GER",fp:30,en:56,tr:22,op:27,cl:87,sn:0,ut:77,rating:1.01,colocacao:"Final",isIGL:false},
  {nome:"smooya",pais:"GBR",fp:39,en:3,tr:11,op:84,cl:66,sn:94,ut:56,rating:1.00,colocacao:"Final",isIGL:false},
  {nome:"gob b",pais:"GER",fp:12,en:39,tr:34,op:28,cl:39,sn:8,ut:90,rating:0.91,colocacao:"Final",isIGL:true},
  //@jogadores — o gerador (tools/add-team.js) insere novos jogadores ACIMA desta linha
];
// Cada jogador recebe um ID único automático. O "nome" é só display (pode repetir:
// o mesmo jogador em times/épocas diferentes são entradas distintas com stats próprios).
// Para diferenciar entradas com nick repetido, use o campo `id` explícito no ATRIBUTOS;
// se ausente, o id é o próprio nome (caso de jogador único).
const POOL={};
ATRIBUTOS.forEach(p=>{const id=p.id||p.nome;POOL[id]={...p,id,nick:p.nick||p.nome,pais:p.pais||PAISES_MAP[p.nome]||"—",...avaliarJogador(p)};});

const TIMES_DEF=[
  {nome:"NAVI",cor:"#ffd400",coach:"B1ad3",camp:"Stockholm Major 2021",colocacao:"Campeao",jogadores:["s1mple","electroNic","b1t","Perfecto","Boombl4"]},
  {nome:"Outsiders",cor:"#39d3ff",coach:"dastan",camp:"Rio Major 2022",colocacao:"Campeao",jogadores:["Jame","FL1T","fame","n0rb3r7","Qikert"]},
  {nome:"FURIA",cor:"#00e676",coach:"guerri",camp:"Rio Major 2022",colocacao:"Top4",jogadores:["KSCERATO","yuurih","saffee","arT","drop"]},
  {nome:"SK",cor:"#ff5a1f",coach:"dead",camp:"Cologne Major 2016",colocacao:"Campeao",jogadores:["coldzera","FalleN","fer","fnx","TACO"]},
  {nome:"Vitality",cor:"#f5d020",coach:"XTQZZZ",camp:"Budapest Major 2025",colocacao:"Campeao",jogadores:["ZywOo","ropz","mezii","flameZ","apEX"]},
  {nome:"Spirit",cor:"#b06cff",coach:"hally",camp:"Budapest Major 2025",colocacao:"Top4",jogadores:["donk","sh1ro","tN1R","zweih","chopper"]},
  {nome:"MongolZ",cor:"#ff3b54",coach:"maaRaa",camp:"Budapest Major 2025",colocacao:"Top8",jogadores:["mzinho","bLitz","910","controlez","Techno"]},
  {nome:"EnVyUs",cor:"#00b4a0",coach:null,camp:"DreamHack Cluj-Napoca 2015",colocacao:"Campeao",jogadores:["kennyS","NBK-","Happy","apEX_envy","kioShiMa"]},
  {nome:"Cloud9",cor:"#00aeef",coach:"valens",camp:"ELEAGUE Major Boston 2018",colocacao:"Campeao",jogadores:["tarik","autimatic","RUSH","Skadoodle","Stewie2K"]},
  {nome:"FaZe",cor:"#e43d30",coach:"RobbaN",camp:"ESL One New York 2017",colocacao:"Campeao",jogadores:["NiKo","rain","GuardiaN","olofmeister","karrigan"]},
  {nome:"Astralis",cor:"#e2231a",coach:"zonic",camp:"IEM Katowice 2019",colocacao:"Campeao",jogadores:["device","Xyp9x","Magisk","dupreeh","gla1ve"]},
  {nome:"Immortals",cor:"#00c2a8",coach:"zakk",camp:"PGL Major Krakow 2017",colocacao:"Final",jogadores:["kNgV-","HEN1","LUCAS1","boltz","steel"]},
  {nome:"G2",cor:"#e4002b",coach:"Swani",camp:"IEM Sydney 2023",colocacao:"Top4",jogadores:["m0NESY","jks","NiKo_g2","huNter-","HooXi"]},
  {nome:"Spirit",cor:"#7d8aa0",coach:"hally",camp:"IEM Katowice 2024",colocacao:"Campeao",jogadores:["donk_kato24","sh1ro_kato24","zont1x","magixx","chopper_kato24"]},
  {nome:"FURIA",cor:"#1faa59",coach:"sidde",camp:"IEM Chengdu 2025",colocacao:"Campeao",jogadores:["FalleN_furia25","YEKINDAR","yuurih_furia25","KSCERATO_furia25","molodoy"]},
  {nome:"Virtus.pro",cor:"#f0a020",coach:null,camp:"EMS One Katowice 2014",colocacao:"Campeao",jogadores:["pashaBiceps","NEO","Snax","byali","TaZ"]},
  {nome:"BIG",cor:"#e9edf3",coach:"kakafu",coachPais:"AUT",camp:"ESL One Cologne 2018",colocacao:"Final",jogadores:["tabseN","nex","tiziaN","smooya","gob b"]},
  //@times — o gerador (tools/add-team.js) insere novos times ACIMA desta linha
];

const CARAC_SLUG={Gestor:"gestor",Estrategista:"estrategista",Desenvolvedor:"desenvolvedor",Motivador:"motivador"};
const CARAC_COR={Gestor:"var(--c-gestor)",Estrategista:"var(--c-estrategista)",Desenvolvedor:"var(--c-desenvolvedor)",Motivador:"var(--c-motivador)"};
const ROLE_COR={IGL:"var(--r-igl)",AWPer:"var(--r-awper)",Entry:"var(--r-entry)",Rifler:"var(--r-rifler)",Lurker:"var(--r-lurker)",Support:"var(--r-support)"};

let pid=0;
const TEAMS=TIMES_DEF.map((t,i)=>{
  distribuirRoles(t.jogadores.map(n=>POOL[n])); // funções no CONTEXTO do time (cap 2 + AWP); cada jogador está em 1 time só
  const carac=t.coach?derivaCaracteristica(t,POOL):null;
  const somaOVR=t.jogadores.reduce((s,n)=>s+POOL[n].ovr,0);
  return{
    id:"t"+i,nome:t.nome,cor:t.cor,camp:t.camp,coloc:t.colocacao,
    jogadores:t.jogadores.map(n=>{const j=POOL[n];
      return{
      id:"p"+(pid++),nick:j.nick,pais:j.pais,time:t.nome,tipo:"player",
      ovr:j.ovr,prim:j.primario,sec:j.secundario,esteira:j.esteira,estrela:j.estrela,
      _eng:j /* objeto do motor (avaliação A/B/C) usado no cálculo de química */
    };}),
    treinador:t.coach?{id:"c"+i,nick:t.coach,pais:t.coachPais||PAISES_MAP[t.coach]||"—",time:t.nome,tipo:"coach", // coachPais inline: times novos não precisam mexer no PAISES_MAP
      ovr:ovrTreinador(somaOVR,t.colocacao),carac,caracCor:CARAC_COR[carac],caracSlug:CARAC_SLUG[carac]}:null
  };
});

/* ╔═══════════════════════════════════════════════════════════════════╗
   ║  A PARTIDA — MARÉ · PÓLVORA · COFRE · FALLEnANGELs                  ║
   ║  Helpers de azar compartilhados pelos quatro motores do mapa:       ║
   ║  rndF (uniforme), gaussF (normal, p/ a MARÉ) e logistica (duelo).   ║
   ╚═══════════════════════════════════════════════════════════════════╝ */
// RNG SEMEADO (mulberry32): todo o azar dos motores passa por rndF. srand(n) fixa a semente →
// simulações REPRODUZÍVEIS (bancada compara antes/depois bit a bit; abre a porta p/ "Major com seed").
// Por padrão a semente é aleatória (cada jogo é único, como sempre foi).
let _rng=(Math.random()*4294967296)>>>0;
const srand=s=>{_rng=(s>>>0)||1;};
const rndF=()=>{let t=_rng+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};
const gaussF=()=>{let u=0,v=0;while(u===0)u=rndF();while(v===0)v=rndF();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};
const logistica=(fa,fb,D)=>1/(1+Math.pow(10,(fb-fa)/D));

const CFG_SIM={D_MAPA:30,AMP_MAX:11,AMP_CONSIST:.7, // ⚙ balanceamento da PÓLVORA (combate) + COFRE (economia)
  PESO_EF:.60,                  // 60% força do time (OVR+química+treinador), 40% skill individual cru
  // motor de combate por jogador (validado vs CS2 real: KPR~0.67, rating~1.0, fiel HLTV)
  LADO_CT:0.8,FORMA_DIA:7,      // vantagem-base de CT (pequena; a composição é que decide o lado)
  LADO_COMP:1.05,               // escala da vantagem de lado por COMPOSIÇÃO (lurker/anchor→CT, entry→T)
  MOM_STEP:.05,MOM_MAX:.14,TILT_STEP:.018,TILT_MAX:.10,
  // ROUND VIVO: o round é uma SEQUÊNCIA DE DUELOS; o vencedor EMERGE (não é um dado só).
  // D_DUELO = decisão de UM duelo (bem mais raso que o round; o round é a soma de ~5-9 duelos).
  // pistol é quase cara-ou-coroa (D alto) → o azarão ganha pistol/anti-eco e o 13-0 fica raro.
  D_DUELO:112,D_DUELO_PIST:360,OPEN_SCALE:520,CLUTCH_DUEL:.22,CLUTCH_X:.115,CLUTCH_EXP:1.55,LADO_MAPA_P:.013,
  SAVE_BASE:.30,SAVE_MEN:.10,CLOSE_MEN:.18, // salvar (eco em desvantagem) e fechar bomb/tempo (vantagem de homem)
  // ——— BOMBA / RELÓGIO (assimetria real T×CT): o round tem fases, não é só eliminar ———
  // pré-plant: o T tenta plantar (cresce com tempo e vantagem de homem); se o relógio estoura sem plant, o CT vence (default/hold).
  RND_TEMPO:6,PLANT_BASE:.05,PLANT_TEMPO:.05,PLANT_MEN:.11,
  // pós-plant: a bomba tem 40s. T segura ângulos (edge POST_EDGE); CT precisa retomar+defusar antes da detonação.
  PP_TEMPO:3,POST_EDGE:.07,DEFUSE_BASE:.24,DEFUSE_MEN:.22,PLANT_BONUS:800,KILL_REWARD:90,
  EXP_KILL:1.45,EXP_OPEN:1.10,EXP_VITIMA:.55,TRADE_CHANCE:.62, // EXP_OPEN: abertura é menos sobre fp puro
  W_OP_KILL:.28,W_EN_VIT:.28,W_TR_KILL:.32, // tipo de kill segue a categoria HLTV: abertura→op, morte de abertura→en (entry), trade→tr (tilt suave: macro-neutro)
  ADR_KILL:95,ADR_VIT:55,ADR_AST:40,ADR_CHIP:14, // dano por evento → alimenta o ADR (fidelidade HLTV)
  FRAG_FP_BASE:35,FRAG_OVR:.018, // distribuição de kills: fp manda; concentra (alguém estoura no mapa, varia pela forma)
  DUELO_BASE:12,DUELO_OVR:4.6,   // skillDuelo: força de combate por OVR (base + inclinação) — quem GANHA o round
  MAPA_SCALE:380,MAPA_CAP:.06,SUB_ABRE:0.72,SUB_SURV:0.34,SUB_INT:40};

/* ╔═══════════════════════════════════════════════════════════════════╗
   ║  FALLEnANGELs — rating contextual (estilo HLTV)                     ║
   ║  Lê o LOG de eventos que a PÓLVORA gera por jogador no mapa e devolve║
   ║  uma nota: swing + eco + KAST + multi + abertura + trade + ADR + fp.║
   ╚═══════════════════════════════════════════════════════════════════╝ */
// win-probability por estado XvX (dados de CS profissional: vantagem de homem vale muito)
const FA_WP={"5v5":.50,"5v4":.74,"5v3":.88,"5v2":.95,"5v1":.99,
  "4v5":.26,"4v4":.50,"4v3":.73,"4v2":.87,"4v1":.95,
  "3v5":.12,"3v4":.27,"3v3":.50,"3v2":.72,"3v1":.86,
  "2v5":.05,"2v4":.13,"2v3":.28,"2v2":.50,"2v1":.70,
  "1v5":.01,"1v4":.05,"1v3":.13,"1v2":.27,"1v1":.50};
const faWP=(meu,ini)=>meu<=0?0:ini<=0?1:(FA_WP[`${Math.min(meu,5)}v${Math.min(ini,5)}`]??.5);
// round swing: quanto a kill (ou morte) move a probabilidade de vitória do round
const faSwingKill=(meu,ini)=>faWP(meu,ini-1)-faWP(meu,ini);   // >=0, maior vindo de trás
const faSwingMorte=(meu,ini)=>faWP(meu-1,ini)-faWP(meu,ini);  // <=0
// eco adjustment: kill com arma pior vale mais (matador_buy x vitima_buy)
const FA_ECO={full:{full:1,force:.9,eco:.62,pistol:.55},force:{full:1.18,force:1,eco:.78,pistol:.68},
  eco:{full:1.6,force:1.3,eco:1,pistol:.85},pistol:{full:1.55,force:1.25,eco:.95,pistol:1}};
const faEco=(mb,vb)=>(FA_ECO[mb]&&FA_ECO[mb][vb])||1;
const CFG_FA={BASE:.520,W_EK:.385,W_SURV:.160,W_KAST:.240,W_MULTI:.042,W_SWING:.10,PESO_MORTE:.95,PESO_OPEN:.216, // ⚙ balanceamento do FALLEnANGELs (pesos do rating)
  // W_EK menor + BASE maior = tiers comprimidos (topo desce, 19-22 se sobrepõem) sem matar a variação (forma é que oscila)
  // ADR (dano por round) entra como sinal independente das kills: parte do peso saiu de W_EK pra cá,
  // então quem dá muito dano sem converter (ou vice-versa) varia → mais sobreposição entre OVRs (vida).
  W_ADR:.0019,ADR_REF:76,W_TRADE:.075,OPEN_D_W:.6, // fidelidade: dano + trade (refrag); morte-de-abertura pesa menos (tentar a entrada é a função) — HLTV
  IMP_OVR:.012,IGL_SIS:.015, // impacto escala com a SKILL dentro da função (±~5%, centrado em 16); IGL: crédito de sistema moderado (o slope já premia o caller de elite)

  // bônus de firepower: poder de fogo bruto puxa o rating pra cima (ajuda entries de fp alto). Cosmético — não muda resultado.
  FP:{ref:62,per:.0030,min:-.04,max:.09}};
// impacto por função no kill: entry/rifler que fragga gera mais valor que support/igl (centrado ~1.0)
const FA_IMPACTO={AWPer:1.035,Entry:1.065,Lurker:1.04,Rifler:1.03,Support:.97,IGL:.955}; // calibrado por validação real×sim (com IMP_OVR o impacto escala por skill; bases recentradas)
// rating FALLEnANGELs de um jogador a partir do seu log de eventos no mapa
function fallenAngels(ev){const C=CFG_FA,R=ev.totalRounds||1;
  const ekpr=ev.kills.reduce((s,k)=>s+faEco(k.buyMatador,k.buyVitima),0)/R; // kills eco-ajustadas
  const survPR=1-(ev.mortes.length/R);
  const kast=(ev.roundsKAST||0)/R;
  const m=ev.multi||{},multiScore=((m[2]||0)+(m[3]||0)*2.2+(m[4]||0)*4+(m[5]||0)*7)/R;
  let swing=0;
  ev.kills.forEach(k=>{if(k.roundGanho)swing+=faSwingKill(k.estadoMeu,k.estadoInim);});
  ev.mortes.forEach(mo=>{swing+=faSwingMorte(mo.estadoMeu,mo.estadoInim)*C.PESO_MORTE;});
  const openPR=((ev.opK||0)-(ev.opD||0)*C.OPEN_D_W)/R*C.PESO_OPEN; // abertura: ganhar o duelo vale cheio; morrer abrindo penaliza menos (risco inerente ao entry)
  const adr=(ev.dmg||0)/R;                                   // dano por round (ADR) — sinal de impacto independente das kills
  const adrTerm=(adr-C.ADR_REF)*C.W_ADR;                     // centrado: quem dá muito dano sobe, pouco dano desce (suave)
  const tradePR=(ev.tradeK||0)/R*C.W_TRADE;                  // eficiência de trade: refrag pelo time vale rating
  const fpBonus=Math.max(C.FP.min,Math.min(C.FP.max,((ev.fp??60)-C.FP.ref)*C.FP.per)); // poder de fogo bruto soma ao rating
  // impacto EFETIVO = base da função × skill dentro dela (AWPer de elite ≠ AWPer modesto); IGL soma o crédito de sistema
  const impEf=(ev.impacto??1)*(1+C.IMP_OVR*((ev.ovr??16)-16));
  const sistema=ev.prim==="IGL"?C.IGL_SIS:0;
  const rating=C.BASE+ekpr*C.W_EK*impEf+survPR*C.W_SURV+kast*C.W_KAST+multiScore*C.W_MULTI+(swing/R)*C.W_SWING+openPR+adrTerm+tradePR+fpBonus+sistema;
  return Math.max(.30,Math.min(3.0,rating));}

/* ╔═══════════════════════════════════════════════════════════════════╗
   ║  MARÉ — forma do dia e de campanha (o motor de variância)          ║
   ║  A inspiração da noite (tier × OVR × firepower) que MOVE o combate: ║
   ║  craque oscila pouco e tem piso alto; role player é streaky. É o    ║
   ║  que faz cada run do roguelike ser diferente sem deslocar a média.  ║
   ╚═══════════════════════════════════════════════════════════════════╝ */
// curadoria de tiers (legado histórico): Lenda explode e raramente cai; Role travado e modesto
function tierDe(j){const a=j._eng||j;const nick=a.nick||j.nick;
  if(TIER_LENDA.includes(nick))return "Lenda";
  if(TIER_STAR.includes(nick))return "Star";
  const fp=a.fp??60,prim=a.primario||j.primario||"Rifler";
  if((prim==="IGL"||prim==="Support")&&fp<55)return "Role"; // IGL/support sem fp → modesto
  return "Solido";}
// perfil de distribuição por tier (piso=resistência a cair, vol=largura, teto modulado por fp)
// vol = largura da oscilação da forma. Estrela/lenda OSCILA MENOS (consistente, piso alto); role
// player é mais streaky (vol maior). É o que separa o craque confiável do jogador de altos e baixos.
const PERFIL_TIER={Lenda:{piso:.16,vol:.27,tetoBase:2.05,tetoFp:.65},Star:{piso:.13,vol:.28,tetoBase:1.70,tetoFp:.50},
  Solido:{piso:.07,vol:.28,tetoBase:1.45,tetoFp:.40},Role:{piso:.05,vol:.29,tetoBase:1.30,tetoFp:.20}};
// explosividade por função: teto e largura da cauda de cima próprios de cada role (AWP/entry/rifler explodem; support/IGL travados)
const PERFIL_ROLE={AWPer:{expl:1.32,teto:1.32},Rifler:{expl:1.28,teto:1.24},Entry:{expl:1.26,teto:1.16},Lurker:{expl:1.14,teto:1.16},Support:{expl:1.12,teto:1.12},IGL:{expl:1.02,teto:1.02}};
const centroOVR=ovr=>clamp(0.28+(ovr-5)*0.060,0.53,1.44); // OVR puxa o centro (média esperada)
// sorteia a forma do dia do jogador: o "humor competitivo" daquele mapa (assimétrica, com vida)
function formaDoDia(j){const a=j._eng||j;const t=tierDe(j),p=PERFIL_TIER[t];
  const centro=centroOVR(a.ovr??13)+(a._formaCamp??0); // forma de campanha: o "humor" do jogador no Major inteiro
  const fp=a.fp??60,sn=a.sn??0,cl=a.cl??45;const pr=PERFIL_ROLE[a.primario]||{expl:1,teto:1};const ovrAmp=clamp(((a.ovr??13)-13)/55,0,.18); // OVR amplifica a explosão (suave: craque é consistente, não mais volátil)
  const combust=clamp((fp-45)/50,0.05,1.35);        // firepower explode (cauda pra cima)
  const apoio=clamp((sn*0.3+cl*0.4)/100,0,0.4);     // awp/clutch dão empurrão menor
  const pisoExtra=clamp((sn*0.5+cl*0.3)/100,0,0.35);// awp/clutch sobem o piso (consistência)
  const piso=0.50+p.piso*((a.ovr??13)-5)/17+pisoExtra*0.3;
  const teto=(p.tetoBase+p.tetoFp*clamp((fp-50)/50,0,1.3))*(1.35+(pr.teto-1)*1.4); // teto livre, modulado pelo role
  const g=gaussF();let desvio;
  if(g>=0)desvio=g*p.vol*(0.45+(combust+apoio)*1.0)*pr.expl*(1+ovrAmp); // cauda pra cima: firepower × explosão do role × OVR (amortecida: 1.50 é pico, não média)
  else desvio=g*p.vol*(1-p.piso*1.1);                  // queda amortecida por tier
  let r=centro+desvio;
  if(r<piso)r=piso-(piso-r)*0.35;                       // piso resistente, não parede
  return clamp(r,0.30,Math.min(teto,2.2));}                // teto absoluto: nem heater vira 2.5+ (rating de mapa real raramente passa de ~2.2)

// forma de CAMPANHA: sorteada uma vez no início do Major, vale os 9 mapas da run.
// um componente coletivo (o time "clica" ou não no evento) + um individual por tier
// (lenda balança mais — é ela que ganha ou perde o campeonato). zero-média: não desloca
// o rating global, só faz CADA run ser diferente (o motor de variância do roguelike).
// forma de campanha: lenda/estrela varia POUCO no Major (confiável); role player balança mais.
// AMP_TIME maior = o time "clica" ou não no evento com mais força (mais zebras de campanha).
const CFG_CAMP={AMP_TIME:0.11,AMP_JOG:{Lenda:0.12,Star:0.13,Solido:0.18,Role:0.23}};
function sortearFormaCampanha(times){
  times.forEach(t=>{
    const seedTime=gaussF()*CFG_CAMP.AMP_TIME;
    const lista=t.jogadores||(t.time&&t.time.jogadores)||[];
    lista.filter(Boolean).forEach(p=>{const a=p._eng||p;
      a._formaCamp=seedTime+gaussF()*CFG_CAMP.AMP_JOG[tierDe(a)];});
  });
}

/* ╔═══════════════════════════════════════════════════════════════════╗
   ║  PÓLVORA — combate vivo, round a round (mapa e série)              ║
   ║  O round é uma SEQUÊNCIA DE DUELOS; o vencedor EMERGE dela (vantagem ║
   ║  de homem, clutch, trade, plant/post-plant/retake/relógio). Consome ║
   ║  OVR (PRISMA·ZÊNITE), química (SINAPSE), forma (MARÉ) e economia     ║
   ║  (COFRE); produz placar + o log que o FALLEnANGELs vira rating.      ║
   ╚═══════════════════════════════════════════════════════════════════╝ */
// DOIS eixos DESACOPLADOS (correlação fp×rating_real=0.835 nos dados):
//  • skillDuelo (OVR)  → FORÇA DO TIME: quem GANHA o round/jogo. Um IGL de OVR alto e fp baixo
//    puxa a vitória do time mesmo fragando pouco. Ancorado no veredito de PRISMA·ZÊNITE·SINAPSE.
//  • fragPeso (FIREPOWER) → QUEM FRAGA dentro do time: distribui as kills (→ rating individual).
//    fp manda; OVR dá só um empurrão leve de habilidade. IGL fp 2 fraga pouco (rating baixo) ainda
//    que decisivo pra vitória; fragger fp alto fraga muito (rating alto). É o que o CS real mostra.
const CONV_FUNC={Rifler:1.0,AWPer:1.0,Entry:.98,Lurker:.97,Support:.92,IGL:.90};
function skillDuelo(j){const a=j._eng||j;const C=CFG_SIM;const ovr=j.ovr??a.ovr??13;const prim=j.primario||a.primario||"Rifler";
  return (C.DUELO_BASE+(ovr-5)*C.DUELO_OVR)*(CONV_FUNC[prim]??.95);}
function fragPeso(j){const a=j._eng||j;const C=CFG_SIM;const fp=a.fp??60,ovr=j.ovr??a.ovr??13;
  return (C.FRAG_FP_BASE+fp)*(1+(ovr-13)*C.FRAG_OVR);} // firepower domina o frag; OVR = leve skill

// prepara um time pro combate: skills (com forma da noite), clutch e acumulador de stats
// agressão de playstyle derivada do sub-arquétipo: quão na frente o jogador joga o round
// (abre duelos e se expõe) vs quão posicional/clutcher ele é. Escala pela definição do arquétipo.
function subAgr(j){const a=j._eng||j,sb=a.sub;if(!sb)return 0; // agressão = direção do sub × quão definido ele é
  const inten=Math.max(.35,Math.min(1,Math.abs(sb.eixo||0)/CFG_SIM.SUB_INT));return (sb.agr||0)*inten;}
// ——— AFINIDADE DE LADO (composição): CT = segurar/anchor, T = tomar espaço/entry ———
// derivada dos STATS (cl/ut/sn seguram bombsite; en/op/fp tomam espaço) + role + sub-arquétipo.
// lurker/support/âncora puxam o time pro CT; entry/agressivo puxam pro T. zero-centrado: time
// equilibrado fica ~0 (só a vantagem-base de CT), composição desbalanceada inclina o lado.
const LADO_ROLE={Lurker:[5,1],Support:[4,0],AWPer:[2,2],IGL:[1,1],Rifler:[-1,3],Entry:[-4,5]};
function ladoFitRaw(a){const r=LADO_ROLE[a.primario]||[0,0],s=(a.sub&&a.sub.lado)||[0,0];
  return [.08*((a.cl||45)-50)+.06*((a.ut||50)-50)+.05*((a.sn||0)-35)+r[0]+s[0],   // segurar (CT)
          .08*((a.en||45)-50)+.07*((a.op||50)-50)+.05*((a.fp||60)-55)+r[1]+s[1]];} // tomar espaço (T)
// média da liga p/ ZERO-CENTRAR: a afinidade vira DESVIO (time equilibrado ~0; só composição inclina)
const LADO_MEAN=(()=>{const ps=Object.values(POOL);let c=0,t=0;ps.forEach(p=>{const f=ladoFitRaw(p);c+=f[0];t+=f[1];});return[c/ps.length,t/ps.length];})();
function ladoFit(j){const a=j._eng||j;if(a._lado)return a._lado;const f=ladoFitRaw(a);return a._lado=[f[0]-LADO_MEAN[0],f[1]-LADO_MEAN[1]];}
function prepTime(t,mapa){
  // aceita {jogadores:[...]} ou {time:{jogadores:[...]}}; normaliza pra lista de _eng
  let lista=t.jogadores||(t.time&&t.time.jogadores)||[];
  let js=lista.filter(Boolean).map(j=>j._eng||j);
  if(js.length<5){ // fallback: time incompleto — preenche com clones do que houver (evita crash)
    const base=js[0]||{fp:50,tr:50,en:50,op:50,cl:50,sn:0,ut:50,nick:t.nome||"—"};
    while(js.length<5)js.push(base);
  }
  js=js.slice(0,5);
  // forma do dia por jogador: a inspiração da noite move o COMBATE (gera kills reais)
  const formas=js.map(j=>formaDoDia(j));
  return {nome:t.nome,meu:!!t.meu,js,
    // skill de combate (OVR) = força do time/round; frag (firepower) = distribuição de kills
    skills:js.map((j,i)=>skillDuelo(j)*Math.pow(formas[i],1.0)*mapMult(j,mapa)),
    frags:js.map((j,i)=>fragPeso(j)*Math.pow(formas[i],1.0)*mapMult(j,mapa)),
    // afinidade de lado do time = média da composição (ct, t) — define a vantagem por lado
    ctEdge:js.reduce((s,j)=>s+ladoFit(j)[0],0)/js.length,
    tEdge:js.reduce((s,j)=>s+ladoFit(j)[1],0)/js.length,
    cls:js.map(j=>j.cl||40),agr:js.map(j=>subAgr(j)),
    ops:js.map(j=>j.op??50),ens:js.map(j=>j.en??45),trs:js.map(j=>j.tr??50), // categorias HLTV por jogador (tipo de kill)
    // força de abertura do time (op/entry/sniper/util — flashes ajudam a abrir): inclina o PRIMEIRO duelo
    open:js.reduce((s,j)=>s+((j.op??50)*.35+(j.en??45)*.30+(j.sn??0)*.20+(j.ut??50)*.15),0)/js.length,
    stats:js.map(j=>({nick:j.nick||t.nome,impacto:FA_IMPACTO[j.primario]??1,prim:j.primario,ovr:j.ovr??16,fp:j.fp??60,ut:j.ut??50,k:0,d:0,a:0,dmg:0,tradeK:0,
      fa:{kills:[],mortes:[],assists:0,roundsKAST:0,multi:{},opK:0,opD:0},_kRound:0,_contribRound:false}))};
}
// ROUND VIVO — o round é uma SEQUÊNCIA DE DUELOS e o vencedor EMERGE deles.
//  • quem GANHA cada duelo = força do time (pEdgeA, vinda do OVR/efetiva/lado/momentum/economia);
//  • quem FRAGA dentro do time = firepower (pondera matador e vítima). Eixos desacoplados.
//  • a vantagem de homem se acumula sozinha (é uma corrida pra eliminar → 5v4 vale mais, como no real);
//  • clutch 1vX tem vida própria (o solitário luta pelo cl); trade/refrag revida na hora;
//  • lado em desvantagem + eco pode SALVAR (não morre, guarda economia); lado em vantagem FECHA (bomb/tempo).
// ctx={pEdgeA,openEdgeA,buyA,buyB}. Retorna quem venceu (venceA), sobreviventes e o destaque.
const _psDuelo=[0,0,0,0,0]; // buffer de pesos do pick (≤5 vivos), compartilhado: zero alocação por duelo no hot path
function combateRound(a,b,ctx){
  const C=CFG_SIM;
  const vivA=[0,1,2,3,4],vivB=[0,1,2,3,4];
  const mata=(arr,i)=>arr.splice(arr.indexOf(i),1); // remoção in-place (mesma ordem dos vivos; zero alocação por kill)
  const buyA=ctx.buyA,buyB=ctx.buyB;
  const roundKills=[]; // {team,rec} → roundGanho marcado no fim (só kills do vencedor contam swing)
  const pick=(arr,fn)=>{let tot=0;for(let i=0;i<arr.length;i++){_psDuelo[i]=fn(arr[i]);tot+=_psDuelo[i];}tot=tot||1;
    let r=rndF()*tot;for(let i=0;i<arr.length;i++)if((r-=_psDuelo[i])<0)return arr[i];return arr[arr.length-1];};
  // um duelo: o lado VENCEDOR mata um do PERDEDOR. opening = 1º duelo; trade = refrag imediato.
  function duelo(venc,vivV,buyV,perd,vivP,buyP,opening,trade){
    const expK=opening?C.EXP_OPEN:C.EXP_KILL;
    // quem FRAGA: firepower é o VOLUME; o TIPO de kill pende pra categoria HLTV (abertura→op, trade→tr)
    const tilt=i=>opening?Math.max(.25,1+C.W_OP_KILL*((venc.ops[i]-50)/50)):trade?Math.max(.25,1+C.W_TR_KILL*((venc.trs[i]-50)/50)):1;
    const ki=pick(vivV,i=>Math.pow(Math.max(venc.frags[i],8),expK)*tilt(i)*(1+(opening?C.SUB_ABRE:0)*(venc.agr[i]||0)));
    // quem MORRE: na abertura, o entry (en alto) que avançou cai primeiro
    const vTilt=i=>opening?Math.max(.25,1+C.W_EN_VIT*((perd.ens[i]-50)/50)):1;
    const vi=pick(vivP,i=>Math.pow(Math.max(perd.frags[i],8),C.EXP_VITIMA)*vTilt(i)*(1+(opening?C.SUB_ABRE:C.SUB_SURV)*(perd.agr[i]||0)));
    const rec={estadoMeu:vivV.length,estadoInim:vivP.length,buyMatador:buyV,buyVitima:buyP,roundGanho:true};
    venc.stats[ki].fa.kills.push(rec);roundKills.push({team:venc,rec});
    venc.stats[ki].k++;venc.stats[ki]._kRound++;venc.stats[ki]._contribRound=true;
    venc.stats[ki].dmg+=C.ADR_KILL+rndF()*40;          // dano letal
    if(trade)venc.stats[ki].tradeK++;                   // refrag = trade kill
    const mo={estadoMeu:vivP.length,estadoInim:vivV.length};
    perd.stats[vi].fa.mortes.push(mo);perd.stats[vi].d++;
    perd.stats[vi].dmg+=rndF()*C.ADR_VIT;               // atirou de volta antes de cair
    if(opening){venc.stats[ki].fa.opK++;perd.stats[vi].fa.opD++;}
    return vi;
  }
  // ——— FASES DO ROUND: o T tenta plantar; pós-plant o T segura, o CT retoma. Relógio resolve o que não é eliminado.
  const aCT=ctx.aIsCT;                          // time a está no CT neste round? (b é o T, e vice-versa)
  const ctVence=()=>aCT?"A":"B", tVence=()=>aCT?"B":"A"; // quem leva o round se o objetivo decide
  let primeira=true,fim=null,g=0;               // fim: "A"/"B" se o round fecha por objetivo/save antes da eliminação
  let plantado=false,tempo=0,pp=0,metodo=null;  // metodo: tempo|defuse|detona|close|elim → define o prêmio (CS2: objetivo=3500)
  let clutch=null;                              // 1ª vez que um lado fica em 1vX (pra medir/registrar o clutch)
  while(vivA.length>0&&vivB.length>0&&fim===null&&g++<30){
    let p=ctx.pEdgeA;
    if(primeira)p=clamp(p+ctx.openEdgeA,.03,.97);                // abertura: melhor entry/AWP leva o 1º pick
    if(plantado)p=clamp(p+(aCT?-C.POST_EDGE:C.POST_EDGE),.03,.97); // pós-plant: o T segura ângulos do bombsite (edge defensivo)
    // clutch: o último vivo segura ângulos e isola os inimigos que empurram → edge por duelo que CRESCE com X
    // (mantém a força de time no duelo, só soma o bônus de clutch + habilidade cl). Calibrado p/ ~real.
    if(vivA.length===1&&vivB.length>1)p=clamp(p+Math.pow(vivB.length-1,C.CLUTCH_EXP)*C.CLUTCH_X+((a.cls[vivA[0]]||45)-50)/100*C.CLUTCH_DUEL,.03,.97);
    if(vivB.length===1&&vivA.length>1)p=clamp(p-Math.pow(vivA.length-1,C.CLUTCH_EXP)*C.CLUTCH_X-((b.cls[vivB[0]]||45)-50)/100*C.CLUTCH_DUEL,.03,.97);
    const aWins=rndF()<p;
    const venc=aWins?a:b,perd=aWins?b:a,vivV=aWins?vivA:vivB,vivP=aWins?vivB:vivA,buyV=aWins?buyA:buyB,buyP=aWins?buyB:buyA;
    const vi=duelo(venc,vivV,buyV,perd,vivP,buyP,primeira,false);
    mata(aWins?vivB:vivA,vi);
    primeira=false;
    // TRADE/refrag: o time que LEVOU a kill troca na hora (o entry abriu, mas é trocado)
    const vVnow=aWins?vivA:vivB,vPnow=aWins?vivB:vivA; // venc do duelo segue vivo; perd perdeu 1
    // frequência de trade fixa (calibrada); QUEM pega o trade kill é que pende pra tr (fidelidade na stat).
    // NÃO troca contra um CLUTCHER (vencedor sozinho): o último vivo isola os duelos — sem isso o 1vX morre injusto.
    if(vPnow.length>0&&vVnow.length>1&&rndF()<C.TRADE_CHANCE){
      const vi2=duelo(perd,vPnow,buyP,venc,vVnow,buyV,false,true);
      mata(aWins?vivA:vivB,vi2);
      perd.stats[vi]._contribRound=true; // KAST: quem morreu (entry abrindo / support) e foi TROCADO ganha crédito de "traded" — fiel ao "T" do KAST
    }
    if(vivA.length===0||vivB.length===0)break; // eliminação total decide na hora
    // registra a 1ª situação de clutch (1vX): o solitário enfrenta X inimigos. medido/aproveitado depois.
    if(!clutch){if(vivA.length===1)clutch={aLone:true,x:vivB.length};else if(vivB.length===1)clutch={aLone:false,x:vivA.length};}
    // CLOSE por vantagem de homem: o lado dominante FECHA o round (executa o plant+detona / segura / retoma)
    // sem precisar duelar até o último homem — como no CS real. 1vX NUNCA encerra aqui (o clutch é sempre jogado).
    const adv=Math.abs(vivA.length-vivB.length);
    if(adv>=2&&Math.min(vivA.length,vivB.length)>=2&&rndF()<C.CLOSE_MEN*adv){fim=vivA.length>vivB.length?"A":"B";metodo="close";break;}
    // estado por LADO (não por time): o objetivo é assimétrico
    const vivT=aCT?vivB:vivA,vivCT=aCT?vivA:vivB,buyT=aCT?buyB:buyA,buyCT=aCT?buyA:buyB;
    tempo++;
    if(!plantado){
      // SAVE do T: muito atrás (>=2) e sem dinheiro → desiste do plant, guarda armas → CT vence no tempo (sobreviventes vivem)
      if(vivCT.length-vivT.length>=2){const eco=buyT==="eco"||buyT==="force";
        if(rndF()<(eco?C.SAVE_BASE:C.SAVE_BASE*.35)+(vivCT.length-vivT.length)*C.SAVE_MEN){fim=ctVence();metodo="tempo";break;}}
      // PLANT: chance cresce com o tempo e com a vantagem de homem do T (tomou o site)
      const pPlant=clamp(C.PLANT_BASE+tempo*C.PLANT_TEMPO+(vivT.length-vivCT.length)*C.PLANT_MEN,0,.92);
      if(rndF()<pPlant){plantado=true;pp=0;}
      else if(tempo>=C.RND_TEMPO){fim=ctVence();metodo="tempo";break;} // relógio estourou sem plant → CT segura (default/hold)
    }else{
      pp++;
      // SAVE do CT: pós-plant muito atrás (>=2) e sem grana → não retoma → T detona (sobreviventes CT vivem)
      if(vivT.length-vivCT.length>=2){const eco=buyCT==="eco"||buyCT==="force";
        if(rndF()<(eco?C.SAVE_BASE:C.SAVE_BASE*.35)+(vivT.length-vivCT.length)*C.SAVE_MEN){fim=tVence();metodo="detona";break;}}
      // DEFUSE: CT com pelo menos paridade limpa o site e defusa (cresce com a vantagem de homem)
      if(vivCT.length>=vivT.length&&rndF()<C.DEFUSE_BASE+Math.max(0,vivCT.length-vivT.length)*C.DEFUSE_MEN){fim=ctVence();metodo="defuse";break;}
      // DETONAÇÃO: relógio da bomba estourou → T vence o post-plant
      if(pp>=C.PP_TEMPO){fim=tVence();metodo="detona";break;}
    }
  }
  const venceA=fim!==null?fim==="A":vivA.length>0;
  const vencT=venceA?a:b,vivVfinal=venceA?vivA:vivB;
  roundKills.forEach(rk=>{rk.rec.roundGanho=(rk.team===vencT);}); // só o vencedor pontua swing
  // destaque factual: quem do vencedor mais matou neste round (antes de zerar _kRound)
  let mvp=0;for(let i=1;i<5;i++)if((vencT.stats[i]._kRound||0)>(vencT.stats[mvp]._kRound||0))mvp=i;
  const destaque=vencT.stats[mvp].nick;
  // assistência por UTILIDADE: quem dá utility habilita a kill (crédito do support/IGL → KAST/assist/ADR)
  if(rndF()<.55&&vivVfinal.length){const ai=pick(vivVfinal,i=>18+(vencT.stats[i].ut||40));
    vencT.stats[ai].a++;vencT.stats[ai].fa.assists++;vencT.stats[ai]._contribRound=true;vencT.stats[ai].dmg+=C.ADR_AST+rndF()*30;}
  // chip de utilidade pros que participaram sem kill (dano de granada/spray) + multi/KAST do round
  [a,b].forEach((t,lado)=>{const viv=lado===0?vivA:vivB;t.stats.forEach((s,i)=>{
    const kr=s._kRound||0;if(kr>=2)s.fa.multi[kr]=(s.fa.multi[kr]||0)+1;
    const vivo=viv.includes(i);
    if(s._contribRound||vivo){s.fa.roundsKAST++;if(kr===0)s.dmg+=rndF()*C.ADR_CHIP;} // participou: chip de dano
    s._kRound=0;s._contribRound=false;});});
  let kA=0,kB=0;roundKills.forEach(rk=>{rk.team===a?kA++:kB++;}); // kills por time no round → recompensa econômica
  const clutchWon=clutch?(clutch.aLone?venceA:!venceA):null; // o solitário venceu o round?
  // método por ELIMINAÇÃO: com bomba no chão, o vencedor ainda resolve o objetivo (CT defusa / T detona)
  if(!metodo)metodo=plantado?(venceA===aCT?"defuse":"detona"):"elim";
  const premioV=(metodo==="defuse"||metodo==="detona")?PREMIO_OBJETIVO:PREMIO_VITORIA; // CS2: objetivo paga 3500
  return {venceA,sobreviventes:vivVfinal.length,destaque,plantado,metodo,premioV,killsA:kA,killsB:kB,clutchX:clutch&&clutch.x,clutchWon};
}

// força do dia: oscila inverso à química (coeso=consistente, caótico=imprevisível)
function forcaDoDia(efetiva,quimica){
  // química 50%→0 (volátil) .. 100%→1 (consistente). normalizado pelo teto atual (1.00)
  const consist=clamp((quimica-CFG_QUIMICA.QUIMICA_MIN)/(CFG_QUIMICA.QUIMICA_MAX-CFG_QUIMICA.QUIMICA_MIN),0,1);
  const amp=CFG_SIM.AMP_MAX*(1-consist*CFG_SIM.AMP_CONSIST);
  return efetiva+(rndF()*2-1)*amp;
}
/* ┌─ COFRE ─ economia (sub-motor da PÓLVORA) ──────────────────────────┐
   Comprar GASTA; morrer PERDE equipamento (sobrevivente carrega a arma);
   cada kill paga. A decisão de compra é ciente do carrego. Daí emergem
   eco, force-buy de leitura, anti-eco e a conversão pós-pistol. */
const BUY={pistol:.5,eco:.12,force:.62,full:1.0};
// ECONOMIA REAL: comprar GASTA dinheiro; morrer PERDE equipamento (sobrevivente carrega a arma).
const COMPRA_CUSTO={pistol:0,eco:200,force:2400,full:4300}; // custo de equipar 5 do zero
const EQUIP_CARRY=500; // valor de equipamento que cada sobrevivente leva pro próximo round (não precisa recomprar)
const custoReal=(buy,surv)=>Math.max(0,COMPRA_CUSTO[buy]-(surv||0)*EQUIP_CARRY); // só repõe quem morreu
// compra inteligente, ciente do carregamento: full se dá pra equipar; senão força (com folga) ou eco
// pra RESETAR; force-buy de LEITURA quando vem de poucas derrotas (negar o anti-eco / pegar de surpresa).
const decidirBuy=(m,pist,ls,surv)=>{
  if(pist)return"pistol";
  if(m>=custoReal("full",surv))return"full";
  if(m>=custoReal("force",surv)+1500)return"force";
  if((ls||0)<=1&&m>=custoReal("force",surv)&&rndF()<.45)return"force";
  return"eco";};
const PREMIO_VITORIA=3250,PREMIO_OBJETIVO=3500,LOSS_BONUS=[1400,1900,2400,2900,3400],TETO_GRANA=16000; // CS2: bomba/defuse pagam 3500; escada de derrota 1400→3400
// ——— identidade de mapa: cada mapa recompensa atributos diferentes (modula, não determina) ———
// peso por atributo (soma ~1). a afinidade é medida CONTRA a média do próprio jogador em todos os
// mapas, então lenda equilibrada varia quase nada (boa em tudo); só o especialista sente o mapa.
const MAPA_PERFIL={
  Mirage:{fp:.34,op:.30,tr:.18,ut:.18},   Inferno:{ut:.34,tr:.28,en:.20,cl:.18},
  Nuke:{sn:.30,cl:.26,ut:.24,tr:.20},     Ancient:{cl:.30,op:.26,ut:.24,tr:.20},
  Anubis:{fp:.30,cl:.26,op:.26,ut:.18},   Dust2:{fp:.34,sn:.30,op:.26,en:.10},
  Train:{sn:.30,ut:.30,cl:.22,tr:.18},    Overpass:{ut:.30,cl:.26,tr:.24,op:.20}};
// multiplicador de combate por mapa: 1 ± pouco. auto-centrado (média dos mults do jogador ≈ 1).
// afinidade de mapa = dot(perfil-do-mapa, atributos) — reusa o produto-escalar do PRISMA.
function mapMult(j,mapa){const a=j._eng||j;const perfil=MAPA_PERFIL[mapa];if(!perfil)return 1;
  if(a._mapBase===undefined){let s=0,n=0;for(const m in MAPA_PERFIL){s+=dot(MAPA_PERFIL[m],a);n++;}a._mapBase=s/n;}
  const fit=dot(perfil,a)-a._mapBase; // >0 mapa favorece o perfil dele, <0 desfavorece
  return clamp(1+fit/CFG_SIM.MAPA_SCALE,1-CFG_SIM.MAPA_CAP,1+CFG_SIM.MAPA_CAP);}
// viés de LADO por mapa (pontos de força somados ao lado CT; negativo = mapa T-sided).
// Calibrado p/ reproduzir os spreads reais: Nuke/Train CT-sided (~54-56% CT), Anubis T-sided (~48%).
const MAPA_LADO={Nuke:1.9,Train:1.3,Overpass:.7,Ancient:.8,Mirage:.2,Inferno:0,Dust2:0,Anubis:-.7};
const MAPAS_POOL=["Mirage","Inferno","Nuke","Ancient","Anubis","Dust2","Train","Overpass"];

// simula um mapa completo round a round; retorna placar, vencedor, timeline e stats por jogador.
// leve=true (jogos que ninguém assiste: playoffs NPC / bancadas): pula snapshots do scoreboard e o
// cálculo de rating — MESMO combate, mesmo consumo de RNG (placar idêntico sob a mesma semente).
function simularMapa(A,B,fA,fB,mapaForcado,leve){
  const C=CFG_SIM;
  const mapa=mapaForcado||MAPAS_POOL[Math.floor(rndF()*MAPAS_POOL.length)]; // mapa decidido ANTES (modula o combate)
  const a=prepTime(A,mapa),b=prepTime(B,mapa);
  const formaDiaA=gaussF()*C.FORMA_DIA,formaDiaB=gaussF()*C.FORMA_DIA;
  let pa=0,pb=0,mA=800,mB=800,lsA=0,lsB=0,r=0;
  let sA=0,sB=0; // sequências de vitória (momentum)
  let survA=5,survB=5; // sobreviventes do round anterior (carregam equipamento → barateia a próxima compra)
  const rounds=[];
  // lados: 1º tempo A=CT · 2º tempo A=TR · OT (r≥25): alterna a cada 3 rounds (MR3 real)
  const ladoDe=(time,round)=>{const ehA=time===A;
    const aCT=round<13?true:round<25?false:(Math.floor((round-25)/3)%2===0);
    return (ehA===aCT)?"CT":"TR";};
  const mediaSkill=t=>t.skills.reduce((s,v)=>s+v,0)/5;
  // base do round e edge de abertura são CONSTANTES no mapa → calcula uma vez (fora do loop)
  const baseA=mediaSkill(a)*(1-C.PESO_EF)+(fA||mediaSkill(a))*C.PESO_EF;
  const baseB=mediaSkill(b)*(1-C.PESO_EF)+(fB||mediaSkill(b))*C.PESO_EF;
  const openEdgeA=clamp((a.open-b.open)/C.OPEN_SCALE,-.12,.12); // melhor abertura leva o 1º duelo
  // bônus de lado por time: 2 valores possíveis cada (CT/T) — precomputados fora do loop de rounds.
  // o viés do MAPA age direto no pEdge do duelo (LADO_MAPA_P) — pontos de força são amortecidos pelas fases.
  const pLadoMapa=(MAPA_LADO[mapa]||0)*C.LADO_MAPA_P;
  const bonusCtA=C.LADO_CT+C.LADO_COMP*a.ctEdge,bonusTA=C.LADO_COMP*a.tEdge;
  const bonusCtB=C.LADO_CT+C.LADO_COMP*b.ctEdge,bonusTB=C.LADO_COMP*b.tEdge;
  let half1=null;
  // CS2 (MR12): vence quem chega a 13 na regulação. 12-12 → OT MR3 REPETÍVEL (real):
  // alvo 16; empate 15-15 → alvo 19; 18-18 → 22... (19-17, 22-20 são placares possíveis)
  let alvo=13;
  while(pa<alvo&&pb<alvo){
    r++;
    if(r===13){half1=[pa,pb];lsA=0;lsB=0;sA=0;sB=0;mA=800;mB=800;survA=5;survB=5;} // reset economia/momentum no 2º tempo
    const pistol=(r===1||r===13);
    if(pistol){mA=800;mB=800;survA=5;survB=5;}
    // OT (MR3): cada half de prorrogação começa com $10k fixos (real CS2) → full buy garantido
    if(r>=25&&(r-25)%3===0){mA=10000;mB=10000;survA=0;survB=0;lsA=0;lsB=0;}
    const buyA=decidirBuy(mA,pistol,lsA,survA),buyB=decidirBuy(mB,pistol,lsB,survB);
    mA=Math.max(0,mA-custoReal(buyA,survA));mB=Math.max(0,mB-custoReal(buyB,survB)); // GASTA na compra (repõe só quem morreu)
    // força do round por time = média de skill × economia × lado × momentum − tilt + forma do dia
    const momA=clamp(sA*C.MOM_STEP,0,C.MOM_MAX),momB=clamp(sB*C.MOM_STEP,0,C.MOM_MAX);
    // tilt = derrotas SEGUIDAS (= sequência de vitórias do rival); lsA/lsB agora é o nível da escada de grana
    const tiltA=clamp((sB-2)*C.TILT_STEP,0,C.TILT_MAX),tiltB=clamp((sA-2)*C.TILT_STEP,0,C.TILT_MAX);
    // vantagem de lado = base de CT + composição do time (precomputada: só muda na troca de lado)
    const ladoA=ladoDe(A,r),ladoB=ladoDe(B,r);
    const ladoBonusA=ladoA==="CT"?bonusCtA:bonusTA;
    const ladoBonusB=ladoB==="CT"?bonusCtB:bonusTB;
    const fRA=(baseA+ladoBonusA+formaDiaA)*(0.42+0.58*BUY[buyA])*(1+momA-tiltA);
    const fRB=(baseB+ladoBonusB+formaDiaB)*(0.42+0.58*BUY[buyB])*(1+momB-tiltB);
    // pEdge = prob de A vencer UM duelo (raso); o VENCEDOR DO ROUND emerge da sequência de duelos
    // (vantagem de homem, clutch, save, trade nascem daí). pistol ≈ cara-ou-coroa → azarão tem chance.
    // viés do mapa: quem está de CT num mapa CT-sided ganha o edge por duelo (Nuke pesa p/ os dois lados)
    const pEdgeA=clamp(logistica(fRA,fRB,pistol?C.D_DUELO_PIST:C.D_DUELO)+(ladoA==="CT"?pLadoMapa:-pLadoMapa),.03,.97);
    const res=combateRound(a,b,{pEdgeA,openEdgeA,buyA,buyB,aIsCT:ladoA==="CT"});
    const venceA=res.venceA;
    // COFRE CS2: perdedor recebe o NÍVEL atual da escada (1ª derrota=1400) e sobe 1; vencedor
    // ganha o prêmio PELO MÉTODO (bomba/defuse=3500, resto=3250) e o nível do rival DESCE 1 (não zera).
    if(venceA){pa++;sA++;sB=0;mA+=res.premioV;mB+=LOSS_BONUS[Math.min(lsB,4)];lsB=Math.min(lsB+1,4);lsA=Math.max(0,lsA-1);}
    else{pb++;sB++;sA=0;mB+=res.premioV;mA+=LOSS_BONUS[Math.min(lsA,4)];lsA=Math.min(lsA+1,4);lsB=Math.max(0,lsB-1);}
    if(pa===alvo-1&&pb===alvo-1)alvo+=3; // 12-12 → alvo 16 · 15-15 → 19 · 18-18 → 22 (OT repetível)
    // bônus de plant (CS2): o T que plantou ganha $800 mesmo perdendo o round — mantém o lado perdedor vivo na economia
    if(res.plantado){const tÉA=ladoA!=="CT"; if(tÉA){if(!venceA)mA+=C.PLANT_BONUS;}else{if(venceA)mB+=C.PLANT_BONUS;}}
    // recompensa por kill: cada abate dá dinheiro (independe de ganhar/perder) — fragar mantém a economia viva.
    // proxy do CS2 real por arma: force-buy joga de SMG ($600/kill) → paga mais; rifle/pistol $300 → base
    const krA=buyA==="force"?C.KILL_REWARD*1.8:C.KILL_REWARD,krB=buyB==="force"?C.KILL_REWARD*1.8:C.KILL_REWARD;
    mA+=res.killsA*krA;mB+=res.killsB*krB;
    mA=Math.min(TETO_GRANA,mA);mB=Math.min(TETO_GRANA,mB);
    // sobreviventes carregam equipamento pro próximo round (só quem comprou arma de verdade: force/full)
    const deadA=res.killsB,deadB=res.killsA;
    survA=(buyA==="force"||buyA==="full")?Math.max(0,5-deadA):0;
    survB=(buyB==="force"||buyB==="full")?Math.max(0,5-deadB):0;
    // snapshot do K-D acumulado dos 10 jogadores até este round (pro scoreboard ao vivo animar).
    // leve: ninguém assiste → sem snapshot (era ~440 objetos por mapa jogados fora)
    const snapA=leve?null:a.stats.map(s=>({k:s.k,d:s.d})),snapB=leve?null:b.stats.map(s=>({k:s.k,d:s.d}));
    rounds.push({r,pa,pb,venceA,ladoA,ladoB,troca:(r===13),plantado:res.plantado,buyA,buyB,
      clutchX:res.clutchX,clutchWon:res.clutchWon,destaque:res.destaque,snapA,snapB});
  }
  // rating FALLEnANGELs por jogador (contextual: swing, eco, KAST, multi-kills)
  const totalR=pa+pb;
  const rate=stats=>stats.map(s=>{
    const rating=fallenAngels({...s.fa,totalRounds:totalR,impacto:s.impacto,prim:s.prim,ovr:s.ovr,fp:s.fp,dmg:s.dmg,tradeK:s.tradeK});
    return {nick:s.nick,k:s.k,d:s.d,a:s.a,rating:+rating.toFixed(2)};});
  return {placar:[pa,pb],vencedorNome:pa>pb?A.nome:B.nome,vencedor:pa>pb?A:B,rounds,
    half1,mapa,
    nomeA:A.nome,nomeB:B.nome,meuA:!!A.meu,meuB:!!B.meu,corA:A.cor,corB:B.cor,
    statsA:leve?[]:rate(a.stats),statsB:leve?[]:rate(b.stats),totalRounds:totalR}; // leve: rating não é visto → não calcula
}

/* ┌─ PÓLVORA ─ série best-of (MD1 na suíça, MD3 nos playoffs) ─────────┐ */
// série best-of; usa força do dia a cada mapa
function simularSerie(A,B,fdA,fdB,md,leve){
  const need=Math.ceil(md/2);let wa=0,wb=0;const mapas=[];
  while(wa<need&&wb<need){
    const g=simularMapa(A,B,fdA(),fdB(),null,leve);
    mapas.push(g);g.vencedor===A?wa++:wb++; // por referência: robusto a times homônimos
  }
  return {vencedor:wa>wb?A:B,vencedorNome:wa>wb?A.nome:B.nome,placarSerie:[wa,wb],mapas};
}

/* ╔═══════════════════════════════════════════════════════════════════╗
   ║  ESTADO + UI — roleta de draft, montagem de elenco, fase suíça,    ║
   ║  playoffs e o reprodutor de partidas. Consome TEAMS e os motores    ║
   ║  acima; daqui pra baixo é apresentação (DOM/áudio/animação).        ║
   ╚═══════════════════════════════════════════════════════════════════╝ */
// === UI START ===
const SPIN_MS=2700; // giro mais rápido (era 4000)
const WIN_INDEX=44;
const rnd=n=>Math.floor(Math.random()*n);
const pick=a=>a[rnd(a.length)];
const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const tierOf=o=>o>=22?"tier-h":o>=21?"tier-s":o>=18?"tier-1":o>=15?"tier-2":"tier-3";

/* ——— ÁUDIO · Web Audio sintetizado ————————————————— */
const Audio={ctx:null,mudo:false,master:null,VOL:.65, // master gain: volume geral um pouco mais baixo
  init(){if(!this.ctx){try{this.ctx=new(window.AudioContext||window.webkitAudioContext)();this.master=this.ctx.createGain();this.master.gain.value=this.VOL;this.master.connect(this.ctx["destination"]);}catch{}}
    if(this.ctx&&this.ctx.state==="suspended")this.ctx.resume();
    // iOS só libera o áudio se um som tocar DENTRO do gesto do usuário — buffer mudo de 1 amostra
    if(this.ctx&&!this._unlocked){try{const s=this.ctx.createBufferSource();s.buffer=this.ctx.createBuffer(1,1,22050);s.connect(this.master);s.start(0);}catch{}this._unlocked=true;}},
  // tom curto e brilhante (moeda/crédito)
  _blip(f,t,vol=.1,dur=.08,type="square"){const ctx=this.ctx,o=ctx.createOscillator(),g=ctx.createGain();
    o.type=type;o.frequency.value=f;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g).connect(this.master);o.start(t);o.stop(t+dur+.02);},
  // sino de cassino: parciais inarmônicas com cauda longa
  _bell(t,base,vol=.12){const ctx=this.ctx;[[1,1],[2.01,.5],[2.99,.32],[4.18,.2]].forEach(([m,a])=>{
    const o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";o.frequency.value=base*m;
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol*a,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+.9);
    o.connect(g).connect(this.master);o.start(t);o.stop(t+.95);});},
  // cascata de moedas caindo: pings rápidos descendentes
  _coins(t,n=10,vol=.07){for(let i=0;i<n;i++){const f=2600-i*120+(Math.random()*200-100);
    this._blip(f,t+i*.045+Math.random()*.012,vol,.06,"triangle");}},
  // ka-CHUNK mecânico: reel travando (thunk grave + estalo do mecanismo)
  _clunk(t,vol=.13){const ctx=this.ctx;
    const o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";
    o.frequency.setValueAtTime(118,t);o.frequency.exponentialRampToValueAtTime(46,t+.10);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+.14);
    o.connect(g).connect(this.master);o.start(t);o.stop(t+.16);
    const src=ctx.createBufferSource();src.buffer=this._nz();const lp=ctx.createBiquadFilter();lp.type="lowpass";lp.frequency.value=1300;
    const ng=ctx.createGain();ng.gain.setValueAtTime(vol*.85,t);ng.gain.exponentialRampToValueAtTime(.0001,t+.05);
    src.connect(lp).connect(ng).connect(this.master);src.start(t);src.stop(t+.06);},
  // clink metálico: moeda batendo na bandeja (ruído por band-pass ressonante + parcial agudo)
  _clink(t,vol=.05,pitch=1){const ctx=this.ctx;
    const src=ctx.createBufferSource();src.buffer=this._nz();const bp=ctx.createBiquadFilter();bp.type="bandpass";bp.frequency.value=3100*pitch;bp.Q.value=7;
    const g=ctx.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+.05);
    src.connect(bp).connect(g).connect(this.master);src.start(t);src.stop(t+.06);
    const o=ctx.createOscillator(),og=ctx.createGain();o.type="triangle";o.frequency.value=3500*pitch;
    og.gain.setValueAtTime(vol*.6,t);og.gain.exponentialRampToValueAtTime(.0001,t+.035);
    o.connect(og).connect(this.master);o.start(t);o.stop(t+.05);},
  // bandeja de moedas: chuva metálica irregular que rareia (a parte viciante)
  _coinTray(t,n=26,vol=.05){let dt=0;for(let i=0;i<n;i++){const prog=i/n;
    this._clink(t+dt,vol*(0.55+Math.random()*0.6)*(1-prog*0.4),0.8+Math.random()*0.75);
    dt+=(.026+prog*.04)*(0.6+Math.random()*0.9);}},
  // sino metálico de slot antigo (parciais inarmônicas = clang)
  _bellMetal(t,vol=.1){const ctx=this.ctx;[[1,1],[2.76,.55],[5.4,.28],[8.9,.13]].forEach(([m,a])=>{
    const o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";o.frequency.value=640*m;
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol*a,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+.6);
    o.connect(g).connect(this.master);o.start(t);o.stop(t+.65);});},
  // tick da roleta: click seco de reel + brilho metálico (bola/cilindro de cassino)
  _nz(){if(!this._noise){const ctx=this.ctx,len=Math.floor(ctx.sampleRate*.03);const b=ctx.createBuffer(1,len,ctx.sampleRate);const d=b.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3);this._noise=b;}return this._noise;},
  tick(pitch=1){if(this.mudo||!this.ctx)return;const ctx=this.ctx,t=ctx.currentTime;
    const src=ctx.createBufferSource();src.buffer=this._nz();
    const bp=ctx.createBiquadFilter();bp.type="bandpass";bp.frequency.value=1700+1700*pitch;bp.Q.value=1.4;
    const g=ctx.createGain();g.gain.setValueAtTime(.42,t);g.gain.exponentialRampToValueAtTime(.0001,t+.022);
    src.connect(bp).connect(g).connect(this.master);src.start(t);src.stop(t+.03);
    this._blip(2400+1400*pitch,t,.05,.035,"triangle");},
  // crédito/seleção: coin-up brilhante
  // JACKPOT de máquina antiga: 3 reels travando (ka-chunk) -> sino metálico -> chuva de moedas na bandeja
  ding(){if(this.mudo||!this.ctx)return;const t=this.ctx.currentTime;
    this._clunk(t,.09);this._clunk(t+.14,.10);this._clunk(t+.29,.16); // reels parando um a um, o último pesado
    this._bellMetal(t+.34,.11);                                        // sino metálico do prêmio
    this._coinTray(t+.46,30,.055);},                                   // bandeja de moedas (gostoso/viciante)
  // JACKPOT — campeão: arpejo de sinos + cascata de moedas + sino final
  fanfare(){if(this.mudo||!this.ctx)return;const t=this.ctx.currentTime;
    [523,659,784,1047].forEach((f,i)=>this._bell(t+i*.12,f,.12));
    this._coins(t+.25,14,.07);
    this._bell(t+.62,1047,.16);this._blip(1568,t+.62,.08,.5,"triangle");},
  // eliminado: descida abafada de cassino ("não foi dessa vez")
  derrota(){if(this.mudo||!this.ctx)return;const t=this.ctx.currentTime;
    [466,392,311,247].forEach((f,i)=>{const o=this.ctx.createOscillator(),g=this.ctx.createGain();
      o.type="triangle";o.frequency.setValueAtTime(f,t+i*.16);o.frequency.exponentialRampToValueAtTime(f*.94,t+i*.16+.3);
      g.gain.setValueAtTime(.0001,t+i*.16);g.gain.exponentialRampToValueAtTime(.09,t+i*.16+.04);g.gain.exponentialRampToValueAtTime(.0001,t+i*.16+.5);
      o.connect(g).connect(this.master);o.start(t+i*.16);o.stop(t+i*.16+.55);});},
  // round vencido: blip de moeda (meu=agudo brilhante, adversário=grave seco)
  // ponto marcado: pip macio e curto (sine), claro p/ meu, surdo p/ adversário — não cansa repetindo
  roundWin(meu){if(this.mudo||!this.ctx)return;const ctx=this.ctx,t=ctx.currentTime;
    const f=meu?720:380;const o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";
    o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*1.5,t+.04);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(meu?.05:.038,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+.12);
    o.connect(g).connect(this.master);o.start(t);o.stop(t+.14);},
  // momento-chave: tensão de cassino (reels travando num grande prêmio)
  // destaque: realce macio (swell curto de triangle), sem buzz
  impacto(meu){if(this.mudo||!this.ctx)return;const ctx=this.ctx,t=ctx.currentTime;
    const o=ctx.createOscillator(),g=ctx.createGain();o.type="triangle";
    o.frequency.setValueAtTime(330,t);o.frequency.exponentialRampToValueAtTime(495,t+.12);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.06,t+.05);g.gain.exponentialRampToValueAtTime(.0001,t+.28);
    o.connect(g).connect(this.master);o.start(t);o.stop(t+.3);},
  // fim de jogo: vitória = mini-jackpot (sinos+moedas); derrota = descida menor
  fimJogo(venci){if(this.mudo||!this.ctx)return;const t=this.ctx.currentTime;
    if(venci){[659,784,1047].forEach((f,i)=>this._bell(t+i*.1,f,.11));this._coins(t+.2,8,.06);}
    else [440,370,294].forEach((f,i)=>{const o=this.ctx.createOscillator(),g=this.ctx.createGain();
      o.type="triangle";o.frequency.value=f;const d=t+i*.14;g.gain.setValueAtTime(.0001,d);g.gain.exponentialRampToValueAtTime(.1,d+.03);g.gain.exponentialRampToValueAtTime(.0001,d+.5);
      o.connect(g).connect(this.master);o.start(d);o.stop(d+.55);});}};

const S={
  jogadores:Array(5).fill(null),
  treinador:null,
  drawn:null,
  taken:new Set(),
  sel:null,
  spinning:false,
  justPlaced:null
};

let spinSession=0;

const $=id=>document.getElementById(id);
const roulette=$("roulette"),track=$("track"),picksEl=$("picks"),lineupEl=$("lineup"),lineupCoach=$("lineupCoach");
const hintEl=$("hint"),spinwrap=$("spinwrap"),picksTag=$("picksTag"),picksNote=$("picksNote"),winnerPill=$("winnerPill");
const hint=t=>{hintEl.textContent=t};

// AUTO-FIT do verso do treinador: ajusta a fonte da descrição p/ o MAIOR tamanho que
// preenche a carta sem cortar (cada texto tem comprimento diferente). Mede o .cb-desc
// (que tem o tamanho da carta via .cback position:absolute) e faz busca binária.
function fitText(el,min,max){
  const avail=el.parentElement.clientHeight;         // altura útil do verso (.cback); el cresce com o conteúdo
  if(!avail)return;
  el.style.fontSize=max+"px";
  if(el.scrollHeight<=avail)return;                  // já cabe no máximo
  let lo=min,hi=max;
  for(let i=0;i<14;i++){const m=(lo+hi)/2;el.style.fontSize=m+"px";
    if(el.scrollHeight<=avail)lo=m;else hi=m;}
  el.style.fontSize=lo+"px";
}
// encolhe a fonte de um título até caber em UMA linha (parte do tamanho do CSS; só reduz se precisar).
function fitOneLine(el){
  el.style.fontSize="";                               // volta ao tamanho do CSS (clamp por largura da carta)
  if(el.scrollWidth<=el.clientWidth)return;           // já cabe em 1 linha → mantém o tamanho cheio
  const css=parseFloat(getComputedStyle(el).fontSize)||16;
  let lo=8,hi=css;
  for(let i=0;i<12;i++){const m=(lo+hi)/2;el.style.fontSize=m+"px";
    if(el.scrollWidth<=el.clientWidth)lo=m;else hi=m;}
  el.style.fontSize=lo+"px";
}
function ajustarVersos(){
  document.querySelectorAll(".cb-desc").forEach(el=>{if(el.clientHeight)fitText(el,10,28);});      // treinador: preenche a altura
  document.querySelectorAll(".cb-head").forEach(el=>{if(el.clientWidth)fitOneLine(el);});            // jogador: nome do estilo em 1 linha
}
let _fitRaf;const reajustar=()=>{cancelAnimationFrame(_fitRaf);_fitRaf=requestAnimationFrame(ajustarVersos);};
addEventListener("resize",reajustar);
// re-ajusta quando a fonte web (Barlow) termina de carregar: no mobile ela chega DEPOIS do
// 1º ajuste, mudando a métrica do texto → sem isto, sobra/falta espaço (FOUT).
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(ajustarVersos);

// MODO VIRAR: quando ativo, clicar numa carta VIRA (frente/verso) em vez de selecioná-la.
let modoVirar=false;
const limparFlips=()=>document.querySelectorAll(".card.flipped,.coachcard.flipped").forEach(c=>c.classList.remove("flipped"));
function setModoVirar(on){
  modoVirar=on;
  const b=$("flipModeBtn");
  if(b){b.classList.toggle("ativo",on);b.setAttribute("aria-pressed",on?"true":"false");b.textContent=on?"Virando ✓":"Virar cartas";}
  if(!on)limparFlips();
}

const teamCardHTML=(t,extra="")=>`<div class="tcard ${extra}" data-team="${esc(t.id)}" style="--col:${esc(t.cor)}">
  <div class="tcoloc">${esc(t.coloc)}</div><div class="tname">${esc(t.nome)}</div><div class="tcamp">${esc(t.camp)}</div></div>`;

const cardClass=p=>p.tipo==="coach"?"coachcard coach-"+p.caracSlug:"card "+tierOf(p.ovr);

const playerHTML=p=>`<div class="cmeta"><span>${esc(p.pais)}</span><span>${esc(p.time)}</span></div>
  <div class="ccore"><div class="ovr">${p.ovr}</div><div class="nick">${esc(p.nick)}</div><div class="starsig">${p.estrela?"STAR ★ PLAYER":""}</div></div>
  <div class="roles"><span class="role prim" style="--rc:${ROLE_COR[p.prim]}">${esc(p.prim)}</span><span class="role sec">${esc(p.sec)}</span></div>`;

const coachHTML=p=>`<div class="coach-seal">Treinador</div>
  <div class="cmeta"><span>${esc(p.pais)}</span><span>${esc(p.time)}</span></div>
  <div class="ccore"><div class="ovr">${p.ovr}</div><div class="nick">${esc(p.nick)}</div></div>
  <div class="carac">${esc(p.carac)}</div>`;

// ——— VERSO da carta: as 4 stats vêm do próprio SUB-ARQUÉTIPO (sub.stats, definido no SUBARQ) ———
const STAT_LABEL={fp:"Firepower",op:"Abertura",cl:"Clutch",ut:"Utilitário",en:"Entrada",tr:"Trade",sn:"AWP"};
const STAT_VERSO_DEF=["fp","op","cl","ut"]; // fallback (sem sub)
const statBar=(lab,v)=>`<div class="statbar"><span class="sb-lab">${esc(lab)}</span><span class="sb-val">${Math.round(v||0)}</span></div>`;
// verso do jogador: nome + estilo no topo e as 4 stats do sub-arquétipo embaixo
const backPlayer=p=>{const e=p._eng||{};const base=(e.sub&&e.sub.stats)||STAT_VERSO_DEF;
  const keys=["fp",...base.filter(k=>k!=="fp")].slice(0,4); // Firepower sempre 1º; os outros 3 na ordem de relevância do sub
  return `<div class="cb-head">${esc(e.sub?e.sub.nome:(p.prim||""))}</div>`+
  `<div class="cb-stats">${keys.map(k=>statBar(STAT_LABEL[k],e[k])).join("")}</div>`;};
// o que cada característica de treinador FAZ — objetivo, com os números reais do efeito no SINAPSE
const CARAC_DESC={
  Gestor:"Tolera +1 estrela no elenco. Penalidade por estrela extra: 7% → 4%.",
  Desenvolvedor:"Reduz penalidades de elenco cru: 5% por jogador de OVR ≤14, até 18%.",
  Estrategista:"Reduz penalidades de estrutura em 15% e de comando (IGL) em 30%.",
  Motivador:"Reduz em 30% as penalidades de cobertura e saturação do elenco."};
// verso do treinador: só o que a característica FAZ (o nome dela já está na frente da carta)
const backCoach=p=>`<div class="cb-desc">${esc(CARAC_DESC[p.carac]||"")}</div>`;
// jogador vira p/ as stats; treinador vira p/ o significado da característica. Faces giram em 3D.
const cardHTML=p=>{const verso=p.tipo==="coach"?backCoach(p):backPlayer(p);const frente=p.tipo==="coach"?coachHTML(p):playerHTML(p);
  return `<div class="cfaces"><div class="cface cfront">${frente}</div><div class="cface cback">${verso}</div></div>`;};

function elencoCheio(){return S.jogadores.every(Boolean)&&!!S.treinador}

function forcaTotal(){
  return S.jogadores.filter(Boolean).reduce((s,x)=>s+x.ovr,0)||null;
}

// HUD: count-up suave da força total + pulso ao mudar (respeita movimento reduzido)
const _reduzMov=window.matchMedia&&window.matchMedia("(prefers-reduced-motion:reduce)").matches;
const _bump=el=>{if(!el||_reduzMov)return;el.classList.remove("bump");void el.offsetWidth;el.classList.add("bump");};
let _pwrCur=0,_pwrRaf=0,_cntPrev=-1;
function animarPwr(val){
  const el=$("pwr");if(!el)return;
  cancelAnimationFrame(_pwrRaf);
  if(val==null){_pwrCur=0;el.textContent="—";return;}
  if(_reduzMov){_pwrCur=val;el.textContent=val;return;}
  const from=_pwrCur||0,to=val,t0=performance.now(),dur=420;
  const step=now=>{const k=Math.min(1,(now-t0)/dur),e=1-Math.pow(1-k,3);
    el.textContent=Math.round(from+(to-from)*e);
    if(k<1)_pwrRaf=requestAnimationFrame(step);else _pwrCur=to;};
  _pwrRaf=requestAnimationFrame(step);
  _bump(el);
}
function updateHud(){
  const n=S.jogadores.filter(Boolean).length+(S.treinador?1:0);
  const cnt=$("cnt");cnt.textContent=n+"/6";
  if(_cntPrev!==-1&&n!==_cntPrev)_bump(cnt);
  _cntPrev=n;
  animarPwr(forcaTotal());
  renderResultado();
}

/* ——— UI · cartão de build (selos + veredito; parseia os alertas do motor) ——— */
const SELO_META={Comando:{ic:"◆",lab:"Comando"},AWP:{ic:"◎",lab:"AWP"},"Âncora":{ic:"◈",lab:"Âncora"},
  Iniciativa:{ic:"▲",lab:"Iniciativa"},Estrutura:{ic:"◫",lab:"Estrutura"},Treinador:{ic:"★",lab:"Treinador"},
  Estrelas:{ic:"✦",lab:"Egos"},Excesso:{ic:"⨯",lab:"Saturação"},Desenvolvimento:{ic:"✧",lab:"Lapidação"}};
const pilarDe=t=>{for(const p of["Comando","AWP","Âncora","Iniciativa","Estrutura","Treinador","Estrelas","Desenvolvimento"])if(t.startsWith(p))return p;
  if(/^\d+×/.test(t))return"Excesso";return"—";};
const classificarSelo=t=>{let m=t.match(/\+(\d+)%/);if(m)return{tipo:"bonus",pct:+m[1]};
  m=t.match(/−(\d+)%/);if(m)return{tipo:+m[1]>=12?"grave":"leve",pct:+m[1]};
  if(/falta/.test(t))return{tipo:"neutro",pct:0};return{tipo:"forte",pct:0};};
function construirCartao(alertas,dt){
  const arr=[...alertas,dt!==0?`Treinador ${dt>0?"+":""}${dt}%`:"Treinador"];
  const selos=arr.map(t=>{const c=classificarSelo(t),p=pilarDe(t),m=SELO_META[p]||{ic:"·",lab:p};return{...c,pilar:p,ic:m.ic,lab:m.lab};});
  const val=s=>s.tipo==="forte"?"✓":s.tipo==="neutro"?"—":s.tipo==="bonus"?`+${s.pct}%`:`−${s.pct}%`;
  const ord={grave:0,leve:1,bonus:2,neutro:3,forte:4};
  selos.sort((a,b)=>ord[a.tipo]-ord[b.tipo]||b.pct-a.pct);
  const html=selos.map(s=>`<span class="selo ${s.tipo}"><i>${s.ic}</i>${esc(s.lab)}<b>${val(s)}</b></span>`).join("");
  return html;
}
function renderResultado(){
  const box=$("result");
  if(!elencoCheio()){box.hidden=true;return;}
  // usa os objetos do motor (_eng) p/ química real; cópias + distribuição no contexto do SEU time
  // (cap 2 + AWP) sem corromper os times-fonte de onde os jogadores vieram
  const eng=distribuirRoles(S.jogadores.map(j=>({...j._eng})));
  const r=forcaTime(eng,S.treinador.carac,S.treinador.ovr);
  $("rBruta").textContent=r.bruta;
  $("rQuim").textContent=arred(r.quimica*100)+"%";
  $("rEfet").textContent=r.efetiva;
  const dt=Math.round((r.fatorTreinador-1)*100);
  $("rAlertas").innerHTML=construirCartao(r.alertas,dt);
  box.hidden=false;
}

function updateSpinUI(){
  const pendente=!!S.drawn;
  spinwrap.classList.toggle("gone",pendente||S.spinning||elencoCheio());
  $("respinbtn").hidden=!pendente||S.spinning;
  if(typeof atualizarMajorUI==="function")atualizarMajorUI();
}

function limparHighlights(){
  document.querySelectorAll(".avail,.swp,.sel").forEach(el=>el.classList.remove("avail","swp","sel"));
}

/* ——— UI · roleta (offset medido no DOM, não estimado) ——— */
function offsetParaCentralizar(index){
  track.style.transition="none";
  track.style.transform="translate3d(0,0,0)";
  void track.offsetWidth;
  const alvo=track.children[index];
  if(!alvo)return 0;
  const centroRoleta=roulette.getBoundingClientRect().left+roulette.offsetWidth/2;
  const centroCarta=alvo.getBoundingClientRect().left+alvo.offsetWidth/2;
  return centroRoleta-centroCarta;
}

let spinCleanup=null;
function pararAnimacao(){
  spinSession++;
  if(spinCleanup){spinCleanup();spinCleanup=null;}
  track.style.transition="none";
  track.style.willChange="auto";
  S.spinning=false;
}

function idleTrack(){
  pararAnimacao();
  track.style.transform="translate3d(0,0,0)";
  track.innerHTML=Array.from({length:7},()=>teamCardHTML(pick(TEAMS),"dim")).join("");
}

function abortarSpin(){
  pararAnimacao();
  S.drawn=null;
  limparHighlights();
  renderPicks();
  idleTrack();
  updateSpinUI();
}

function revelarTime(time,winIndex){
  S.drawn=time;
  S.spinning=false;
  track.style.willChange="auto";
  // o card vencedor já está com win/hot pela explosão; só garante o estado dim dos demais
  track.querySelectorAll(".tcard").forEach((el,i)=>{
    if(i!==winIndex){el.classList.add("dim");el.classList.remove("win","hot","tick");}
  });
  renderPicks();
  updateSpinUI();
  hint(`Time sorteado: ${time.nome}${time.camp?" · "+time.camp:""}. Escolha 1 carta.`);
  picksTag.scrollIntoView({behavior:"smooth",block:"nearest"});
}

function sortear(){
  if(S.spinning||elencoCheio()||S.drawn)return;

  Audio.init();
  const sessao=++spinSession;
  S.spinning=true;
  S.sel=null;
  limparHighlights();
  renderPicks();
  updateSpinUI();
  hint("");

  const vencedor=pick(TEAMS);
  const fita=[
    ...Array.from({length:WIN_INDEX},()=>pick(TEAMS)),
    vencedor,
    ...Array.from({length:4},()=>pick(TEAMS))
  ];

  track.style.willChange="transform";
  track.style.transition="none";
  track.style.transform="translate3d(0,0,0)";
  track.innerHTML=fita.map(t=>teamCardHTML(t,"dim")).join("");
  void track.offsetWidth;

  const cardW=track.children[WIN_INDEX].offsetWidth;
  const limite=Math.min(roulette.offsetWidth/2,cardW)*0.4;     // nunca passa do marcador
  const jitter=Math.max(-limite,Math.min(limite,(rnd(20)/100-.1)*cardW));
  const destino=offsetParaCentralizar(WIN_INDEX)+jitter;

  requestAnimationFrame(()=>{
    if(sessao!==spinSession)return;
    track.style.transition=`transform ${SPIN_MS}ms cubic-bezier(.16,.82,.20,1)`; // decel mais limpa, assentamento refinado
    track.style.transform=`translate3d(${destino}px,0,0)`;
  });

  // tick: detecta o card no centro pela posição calculada do transform (barato, sem 49 getBoundingClientRect)
  const cards=[...track.children];
  const gap=parseFloat(getComputedStyle(track).gap)||0;
  const padLeft=parseFloat(getComputedStyle(track).paddingLeft)||0;
  const passo=cardW+gap;
  const centroX=roulette.offsetWidth/2;
  const destinoAbs=Math.abs(destino)||1;
  let ultimoIdx=-1;
  const loopTick=()=>{
    if(sessao!==spinSession||!S.spinning)return;
    const m=new DOMMatrixReadOnly(getComputedStyle(track).transform);
    const idx=Math.round((centroX-m.m41-padLeft-cardW/2)/passo);
    if(idx!==ultimoIdx&&idx>=0&&idx<cards.length){
      ultimoIdx=idx;
      const el=cards[idx];
      el.classList.remove("tick");void el.offsetWidth;el.classList.add("tick");
      Audio.tick(1-Math.min(1,Math.abs(m.m41)/destinoAbs)*.7);   // agudo no início, grave ao chegar
    }
    rafTick=requestAnimationFrame(loopTick);
  };
  let rafTick=requestAnimationFrame(loopTick);

  const finalizar=()=>{
    if(sessao!==spinSession)return;
    cancelAnimationFrame(rafTick);
    track.removeEventListener("transitionend",aoFim);
    clearTimeout(fallback);
    spinCleanup=null;
    S.spinning=false;                                    // para o loop imediatamente
    const carta=track.children[WIN_INDEX];
    const idNaFita=carta?.dataset.team;
    const timeConfirmado=TEAMS.find(t=>t.id===idNaFita)||vencedor;
    // explosão de vitória: glow no card + flash na roleta + ding
    cards.forEach((el,i)=>el.classList.toggle("dim",i!==WIN_INDEX));
    if(carta){carta.classList.remove("dim","tick");carta.classList.add("win","hot");}
    roulette.classList.remove("flash");void roulette.offsetWidth;roulette.classList.add("flash");
    setTimeout(()=>roulette.classList.remove("flash"),520);
    Audio.ding();
    setTimeout(()=>{if(sessao===spinSession)revelarTime(timeConfirmado,WIN_INDEX);},500);
  };

  const aoFim=e=>{
    if(e.target!==track||e.propertyName!=="transform")return;
    finalizar();
  };

  track.addEventListener("transitionend",aoFim);
  const fallback=setTimeout(finalizar,SPIN_MS+350);
  spinCleanup=()=>{track.removeEventListener("transitionend",aoFim);clearTimeout(fallback);};
}

function renderLineup(){
  lineupEl.innerHTML=S.jogadores.map((j,i)=>j
    ?`<div class="${cardClass(j)}${S.justPlaced===String(i)?" land":""}" data-move="${i}" tabindex="0">${cardHTML(j)}</div>`
    :`<div class="slot" data-slot="${i}"><span class="ph">+</span></div>`).join("");
  lineupCoach.innerHTML=S.treinador
    ?`<div class="${cardClass(S.treinador)}${S.justPlaced==="coach"?" land":""}" data-move="coach" tabindex="0">${cardHTML(S.treinador)}</div>`
    :`<div class="slot coach" data-slot="coach"><span class="ph">★</span></div>`;
  S.justPlaced=null;
  if(S.sel)iluminarSlots();
  updateHud();
  ajustarVersos();
}

function renderPicks(){
  if(!S.drawn){
    picksEl.innerHTML="";
    picksTag.hidden=true;
    picksNote.hidden=true;
    winnerPill.textContent="";
    setModoVirar(false); // some o controle junto com as cartas → não vaza o modo pro lineup
    return;
  }
  picksTag.hidden=false;
  picksNote.hidden=false;
  winnerPill.textContent=S.drawn.camp?S.drawn.nome+" · "+S.drawn.camp:S.drawn.nome;
  winnerPill.style.background=`color-mix(in srgb,${S.drawn.cor} 22%,transparent)`;
  winnerPill.style.color=S.drawn.cor;
  winnerPill.style.border=`1px solid color-mix(in srgb,${S.drawn.cor} 45%,transparent)`;

  const cartas=[...S.drawn.jogadores,S.drawn.treinador].filter(Boolean);
  // apelidos já na line: bloqueia jogador repetido (mesmo nick, OVR diferente) na própria seleção
  const nicksNaLine=new Set(S.jogadores.filter(Boolean).map(j=>j.nick));
  picksEl.innerHTML=cartas.map((p,i)=>{
    const preso=S.taken.has(p.id);
    const dup=!preso&&p.tipo!=="coach"&&nicksNaLine.has(p.nick);
    const trava=preso?" taken":dup?" dup":"";
    return`<div class="${cardClass(p)} deal${trava}" data-pick="${esc(p.id)}" ${preso||dup?"":'tabindex="0"'}
      style="--sel:${esc(S.drawn.cor)};animation-delay:${i*55}ms">${cardHTML(p)}</div>`;
  }).join("");
  ajustarVersos();
}

function iluminarSlots(){
  if(!S.sel)return;
  if(S.sel.kind==="coach"){
    const sl=lineupCoach.querySelector('[data-slot="coach"]');
    if(sl){sl.classList.add("avail");sl.tabIndex=0;}
    const mv=lineupCoach.querySelector('[data-move="coach"]');
    if(mv&&S.sel.origem!=="coach")mv.classList.add("swp");
  }else{
    lineupEl.querySelectorAll("[data-slot]").forEach(s=>{s.classList.add("avail");s.tabIndex=0;});
    lineupEl.querySelectorAll("[data-move]").forEach(m=>{
      if(m.dataset.move!==String(S.sel.origem))m.classList.add("swp");
    });
  }
}

function selecionar(origem,kind,card){
  if(S.sel?.origem===origem){
    S.sel=null;limparHighlights();
    hint(S.drawn?`Time sorteado: ${S.drawn.nome}. Escolha 1 carta.`:"");
    return;
  }
  S.sel={origem,kind,card};
  limparHighlights();
  iluminarSlots();
  if(origem==="pick"){
    picksEl.querySelector(`[data-pick="${card.id}"]`)?.classList.add("sel");
  }
}

function concluirPick(){
  S.drawn=null;
  S.sel=null;
  limparHighlights();
  renderLineup();
  renderPicks();
  idleTrack();
  updateSpinUI();
  hint(elencoCheio()?"Elenco completo. Boa sorte no campeonato invicto.":"Sorteie o próximo reforço.");
}

function colocarEm(slot){
  if(!S.sel)return;
  const{origem,kind,card}=S.sel;
  const slotCoach=slot.dataset.slot==="coach";

  if(kind==="coach"){
    if(!slotCoach||origem!=="pick")return;
    S.treinador=card;
    S.taken.add(card.id);
    S.justPlaced="coach";
    return concluirPick();
  }
  if(slotCoach)return;
  const idx=+slot.dataset.slot;
  if(Number.isNaN(idx))return;

  if(origem==="pick"){
    if(S.jogadores.some(j=>j&&j.nick===card.nick)){
      hint(`${card.nick} já está na sua line — não dá pra repetir o mesmo jogador.`);
      return;
    }
    S.jogadores[idx]=card;
    S.taken.add(card.id);
    S.justPlaced=String(idx);
    return concluirPick();
  }
  const orig=+origem;
  if(Number.isNaN(orig)||orig===idx)return;
  [S.jogadores[idx],S.jogadores[orig]]=[S.jogadores[orig],S.jogadores[idx]];
  S.sel=null;
  limparHighlights();
  renderLineup();
  hint("");
}

function trocarCom(el){
  if(!S.sel)return;
  const a=+S.sel.origem,b=+el.dataset.move;
  if(Number.isNaN(a)||Number.isNaN(b)||a===b)return;
  [S.jogadores[a],S.jogadores[b]]=[S.jogadores[b],S.jogadores[a]];
  S.sel=null;
  limparHighlights();
  renderLineup();
  hint("");
}

function resetar(){
  if((S.jogadores.some(Boolean)||S.treinador||S.drawn)&&!confirm("Resetar o elenco e perder o progresso?"))return;
  pararAnimacao();
  Object.assign(S,{jogadores:Array(5).fill(null),treinador:null,drawn:null,sel:null,spinning:false});
  S.taken.clear();
  limparHighlights();
  renderLineup();
  renderPicks();
  idleTrack();
  updateSpinUI();
  hint("Sorteie um time e escolha 1 jogador por rodada.");
}

$("rollbtn").onclick=sortear;
$("mutebtn").onclick=e=>{Audio.init();Audio.mudo=!Audio.mudo;
  e.currentTarget.textContent=Audio.mudo?"🔇":"🔊";
  e.currentTarget.classList.toggle("muted",Audio.mudo);
  if(!Audio.mudo)Audio.tick();};
$("respinbtn").onclick=abortarSpin;
$("resetbtn").onclick=resetar;
$("flipModeBtn").onclick=()=>{setModoVirar(!modoVirar);
  hint(modoVirar?"Modo virar ativo: clique numa carta para ver o verso.":(S.drawn?`Time sorteado: ${S.drawn.nome}. Escolha 1 carta.`:""));};

// TILT COLECIONÁVEL: a carta das picks inclina em 3D seguindo o ponteiro; o foil (CSS) acompanha
// via --mx/--my. Só visual — não interfere no clique/seleção. Desligado em reduced-motion.
const _semTilt=matchMedia("(prefers-reduced-motion:reduce)");
picksEl.addEventListener("pointermove",e=>{
  if(_semTilt.matches)return;
  const c=e.target.closest(".card,.coachcard");if(!c)return;
  const r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
  c.style.setProperty("--ry",((x-.5)*11).toFixed(2)+"deg");
  c.style.setProperty("--rx",((.5-y)*11).toFixed(2)+"deg");
  c.style.setProperty("--mx",(x*100).toFixed(1)+"%");
  c.style.setProperty("--my",(y*100).toFixed(1)+"%");
});
picksEl.addEventListener("pointerout",e=>{
  const c=e.target.closest(".card,.coachcard");
  if(c&&!(e.relatedTarget&&c.contains(e.relatedTarget)))["--rx","--ry","--mx","--my"].forEach(v=>c.style.removeProperty(v));
});

document.addEventListener("click",e=>{
  if(e.target.closest("#mutebtn,#rollbtn,#respinbtn,#resetbtn,#flipModeBtn"))return; // botões têm handler próprio
  // MODO VIRAR ativo: qualquer carta clicada VIRA (frente/verso), sem selecionar/posicionar
  if(modoVirar){const c=e.target.closest(".card,.coachcard");if(c){c.classList.toggle("flipped");return;}}
  if(S.spinning)return;                                                 // trava interação durante o giro
  const pickEl=e.target.closest("[data-pick]");
  if(pickEl&&picksEl.contains(pickEl)&&!pickEl.classList.contains("taken")&&!pickEl.classList.contains("dup")&&S.drawn){
    const carta=[...S.drawn.jogadores,S.drawn.treinador].filter(Boolean).find(c=>c.id===pickEl.dataset.pick);
    if(!carta)return;
    if(carta.tipo==="coach"&&S.treinador)return hint("Vaga de treinador já ocupada.");
    if(carta.tipo!=="coach"&&S.jogadores.some(j=>j&&j.nick===carta.nick))return hint(`${carta.nick} já está na sua line.`);
    if(carta.tipo!=="coach"&&S.jogadores.every(Boolean))return hint("As 5 vagas estão cheias.");
    selecionar("pick",carta.tipo==="coach"?"coach":"player",carta);
    hint("Clique no slot destacado.");
    return;
  }
  const slot=e.target.closest(".slot.avail");
  if(slot&&S.sel)return colocarEm(slot);
  const swap=e.target.closest(".swp");
  if(swap&&S.sel&&S.sel.origem!=="pick")return trocarCom(swap);
  const move=e.target.closest("[data-move]");
  if(!move)return;
  const isCoach=move.dataset.move==="coach";
  const area=isCoach?lineupCoach:lineupEl;
  if(!area.contains(move))return;
  selecionar(move.dataset.move,isCoach?"coach":"player",isCoach?S.treinador:S.jogadores[+move.dataset.move]);
  hint("Mova para um slot ou troque posições.");
});

document.addEventListener("keydown",e=>{
  if(e.key!=="Enter"&&e.key!==" ")return;
  if(S.spinning)return;
  if(modoVirar){const c=e.target.closest(".card,.coachcard");if(c){e.preventDefault();c.classList.toggle("flipped");return;}}
  const alvo=e.target.closest("[data-pick]:not(.taken):not(.dup),[data-move],.slot.avail");
  if(!alvo)return;
  e.preventDefault();
  alvo.click();
});

/* ——— UI · telas de torneio (suíça + playoffs) —————— */
const efT=t=>forcaTime(t.jogadores.map(j=>j._eng),t.treinador?.carac,t.treinador?.ovr);
const mono=nome=>nome.replace(/[^A-Za-z0-9]/g,"").slice(0,2).toUpperCase();
const TG={};

function chip(t,perdedor){
  if(!t)return `<div class="team-chip"><div class="team-mono" style="background:#2a3346">?</div><span class="tn">—</span></div>`;
  return `<div class="team-chip${perdedor?" loser":""}"><div class="team-mono" style="background:${t.cor||"#888"}">${mono(t.nome)}</div><span class="tn">${esc(t.nome)}</span></div>`;
}
// monta o objeto-time do jogador a partir do elenco montado
function montarMeuTime(){
  const cartas=S.jogadores.filter(Boolean);
  // cópias dos _eng + distribuição no contexto do SEU time (cap 2 + AWP) — não corrompe os times-fonte.
  // o sim lê cada carta._eng, então as cartas do time apontam pras cópias com as funções do contexto.
  const js=distribuirRoles(cartas.map(p=>({...p._eng})));
  const cartasSim=cartas.map((c,i)=>({...c,_eng:js[i]}));
  const r=forcaTime(js,S.treinador?.carac||null,S.treinador?.ovr||null);
  return {time:{nome:"SEU TIME",cor:"#39d3ff",jogadores:cartasSim},nome:"SEU TIME",cor:"#39d3ff",camp:"",
    ef:r.efetiva,quim:r.quimica,v:0,d:0,vivo:true,hist:[],meu:true};
}
function iniciarTorneio(){
  // sorteia 15 dos times (Fisher-Yates) → Major de 16 com o seu time; campo varia a cada run
  const npc=TEAMS.slice();
  for(let i=npc.length-1;i>0;i--){const j=Math.floor(rndF()*(i+1));[npc[i],npc[j]]=[npc[j],npc[i]];}
  // o time NPC que mais compartilha jogadores com o SEU elenco sai do Major (só dá pra excluir 1:
  // melhor esforço contra "donk vs donk"; empate resolve pelo embaralhamento acima)
  const meusNicks=new Set(S.jogadores.filter(Boolean).map(p=>p.nick));
  const overlap=t=>t.jogadores.reduce((n,j)=>n+(meusNicks.has(j.nick)?1:0),0);
  let fora=15,melhor=0;
  npc.forEach((t,i)=>{const o=overlap(t);if(o>melhor){melhor=o;fora=i;}});
  npc.splice(fora,1);
  const base=npc.slice(0,15).map(t=>{const r=efT(t);         // teto de 15 NPC (independe de quantos times existam) → Major sempre 16
    return {time:t,nome:t.nome,cor:t.cor,camp:t.camp,ef:r.efetiva,quim:r.quimica,v:0,d:0,vivo:true,hist:[]};});
  base.push(montarMeuTime());
  TG.times=base;TG.rodada=0;TG.classificados=[];TG.eliminados=[];TG.playoffs=null;
  // campanha do jogador: acumula mapas e rating por jogador ao longo do Major
  TG.campanha={mapasV:0,mapasD:0,ratings:{},jornada:[],fim:null};
  sortearFormaCampanha(TG.times); // semeia o "humor" da run: cada Major joga diferente
}
// registra os mapas de uma partida jogada pelo jogador (acumula rating por jogador do seu time)
function registrarPartida(jogo){
  const c=TG.campanha;if(!c)return;
  const meuStats=jogo.meuA?jogo.statsA:(jogo.meuB?jogo.statsB:null);if(!meuStats)return;
  const meuSc=jogo.meuA?jogo.placar[0]:jogo.placar[1],advSc=jogo.meuA?jogo.placar[1]:jogo.placar[0];
  const meuVenceu=meuSc>advSc;
  meuVenceu?c.mapasV++:c.mapasD++;
  meuStats.forEach(s=>{const e=c.ratings[s.nick]=c.ratings[s.nick]||{r:[],k:0,d:0,a:0};
    e.r.push(s.rating);e.k+=s.k;e.d+=s.d;e.a+=(s.a||0);});
  if(!c.jornada)c.jornada=[];
  const adv=(typeof MATCH!=="undefined"&&MATCH.B)?MATCH.B.nome:"???";
  c.jornada.push({adv,meu:meuSc,dele:advSc,venc:meuVenceu});
}
// detecta fim de campanha e abre a tela final (campeão ou eliminado)
function checarFimDeCampanha(){
  const c=TG.campanha;if(!c||c.fim)return false;
  const meu=TG.times.find(t=>t.meu);if(!meu)return false;
  const P=TG.playoffs;
  if(P&&P.campeao){c.fim=P.campeao.meu?"campeao":"eliminado";telaFinal();return true;}
  if(TG.eliminados.some(t=>t.meu)){c.fim="eliminado";telaFinal();return true;}
  return false;
}
function telaFinal(){
  const c=TG.campanha;const campeao=c.fim==="campeao";
  const meuTime=TG.times&&TG.times.find(t=>t.meu);
  const jogs=(meuTime&&meuTime.time&&meuTime.time.jogadores)||[];
  const roster={};jogs.forEach(j=>{if(j&&j._eng)roster[j._eng.nick]=j._eng;});
  const ROLE={Entry:{a:"ENT",c:"var(--r-entry)"},Rifler:{a:"RIF",c:"var(--r-rifler)"},AWPer:{a:"AWP",c:"var(--r-awper)"},Lurker:{a:"LUR",c:"var(--r-lurker)"},Support:{a:"SUP",c:"var(--r-support)"},IGL:{a:"IGL",c:"var(--r-igl)"}};
  const fx=r=>r>=1.15?"r-top":r>=0.95?"r-mid":"r-low";
  const barW=r=>Math.round(clamp((r-.6)/1.4,0,1)*100);
  const rt=Object.entries(c.ratings).map(([nick,e])=>({nick,r:e.r.reduce((a,b)=>a+b,0)/e.r.length,k:e.k,d:e.d,a:e.a||0,best:Math.max.apply(null,e.r)})).sort((a,b)=>b.r-a.r);
  const mvp=rt[0];
  $("finalTitulo").textContent=campeao?"CAMPEÃO DO MAJOR":"FIM DA CAMPANHA";
  const selos=campeao?(c.mapasD===0?["CAMPEÃO","9-0 INVICTO"]:["CAMPEÃO"]):["ELIMINADO"];
  $("finalSelos").innerHTML=selos.map(x=>`<span class="selo-final${x.indexOf("INVICTO")>=0?" selo-gold":""}">${esc(x)}</span>`).join("");
  if(mvp){const e=roster[mvp.nick]||{};const rl=ROLE[e.primario]||{a:"",c:"#6c7d93"};
    $("finalMvpCard").style.display="";
    $("finalMvpCard").innerHTML=`<div class="mvp-badge">MVP</div>`+
      `<div class="mvp-id">${e.pais?`<span class="mvp-flag">${esc(e.pais)}</span>`:""}<span class="mvp-nick">${esc(mvp.nick)}</span>`+
      `${rl.a?`<span class="mvp-role" style="--rc:${rl.c}">${rl.a}</span>`:""}${e.ovr!=null?`<span class="mvp-ovr">OVR ${e.ovr}</span>`:""}</div>`+
      `<div class="mvp-stats">${mvp.k} / ${mvp.d} / ${mvp.a} <span>K·D·A</span></div>`+
      `<div class="mvp-rate ${fx(mvp.r)}">${mvp.r.toFixed(2)}</div>`;
  } else $("finalMvpCard").style.display="none";
  const jor=c.jornada||[];
  $("finalJornada").innerHTML=jor.length?`<div class="sec-lbl">A JORNADA</div><div class="jor-tiles">`+jor.map(m=>`<div class="jt ${m.venc?"jt-w":"jt-l"}"><span class="jt-adv">${esc(String(m.adv||"").slice(0,4))}</span><span class="jt-sc">${m.meu}-${m.dele}</span></div>`).join("")+`</div>`:"";
  $("finalRatings").innerHTML=`<div class="sec-lbl">ELENCO</div>`+rt.map((pp,i)=>{const e=roster[pp.nick]||{};const rl=ROLE[e.primario]||{a:"",c:"#6c7d93"};const md=i===0?"md-g":i===1?"md-s":i===2?"md-b":"";
    return `<div class="fr-row${i===0?" mvp":""}"><span class="fr-pos ${md}">${i+1}</span><span class="fr-role"${rl.a?` style="--rc:${rl.c}"`:""}>${rl.a}</span><span class="fr-nick">${esc(pp.nick)}</span><span class="fr-ovr">${e.ovr!=null?e.ovr:""}</span><span class="fr-bar"><i style="width:${barW(pp.r)}%"></i></span><span class="fr-rate ${fx(pp.r)}">${pp.r.toFixed(2)}</span></div>`;}).join("");
  const bestMap=rt.reduce((mx,pp)=>Math.max(mx,pp.best||0),0);
  const margem=jor.filter(m=>m.venc).reduce((mx,m)=>Math.max(mx,m.meu-m.dele),0);
  const recs=[[`${c.mapasV}-${c.mapasD}`,"mapas"]];if(bestMap)recs.push([bestMap.toFixed(2),"melhor mapa"]);if(margem)recs.push(["+"+margem,"maior margem"]);
  $("finalRec").innerHTML=recs.map(r=>`<div class="rec"><span class="rec-v">${r[0]}</span><span class="rec-l">${r[1]}</span></div>`).join("");
  const ov=$("finalOverlay");ov.classList.remove("is-champ","is-elim");ov.classList.add(campeao?"is-champ":"is-elim");
  abrir("finalOverlay");
  Audio.init();campeao?Audio.fanfare():Audio.derrota();
  const pl=$("finalPlacar");const draw=v=>{pl.innerHTML=`<b>${v}</b><span>—</span><b>${c.mapasD}</b>`;};
  let n=0;draw(0);const passo=()=>{if(n<c.mapasV){n++;draw(n);setTimeout(passo,80);}};setTimeout(passo,300);
}
function suicaCompleta(){return TG.times&&TG.classificados.length>=8;}

function avancarSuica(){
  if(!TG.times||suicaCompleta())return;
  TG.rodada++;
  const ativos=TG.times.filter(t=>t.vivo);
  const buckets={};ativos.forEach(t=>{const k=t.v+"-"+t.d;(buckets[k]=buckets[k]||[]).push(t);});
  // monta os pares da rodada; separa o do jogador
  const pares=[];let parDoJogador=null;
  const jaJogaram=(x,y)=>(x.opps||[]).includes(y);
  Object.values(buckets).forEach(g=>{const a=[...g];
    for(let i=a.length-1;i>0;i--){const j=Math.floor(rndF()*(i+1));[a[i],a[j]]=[a[j],a[i]];} // Fisher-Yates (sort(rnd-.5) é enviesado)
    // anti-rematch (real: suíça evita reencontros): se o par já se enfrentou, troca com alguém à frente
    for(let i=0;i<a.length-1;i+=2){
      if(jaJogaram(a[i],a[i+1]))for(let j=i+2;j<a.length;j++){if(!jaJogaram(a[i],a[j])){[a[i+1],a[j]]=[a[j],a[i+1]];break;}}
    }
    for(let i=0;i<a.length-1;i+=2){const par=[a[i],a[i+1]];
      a[i].opps=a[i].opps||[];a[i+1].opps=a[i+1].opps||[];a[i].opps.push(a[i+1]);a[i+1].opps.push(a[i]);
      if(a[i].meu||a[i+1].meu)parDoJogador=par;else pares.push(par);}
    if(a.length%2)a[a.length-1]._bye=true;
  });
  // jogo DECISIVO (real: classificação/eliminação é MD3): alguém do par está a 1 mapa de sair ou passar
  const decisivo=(x,y)=>x.v===2||x.d===2||y.v===2||y.d===2;
  // resolve os outros jogos (rápido, no fundo); decisivos = melhor-de-3 moedas (favorece o mais forte)
  const resolverPar=([x,y])=>{
    let wx=0,wy=0;const need=decisivo(x,y)?2:1;
    while(wx<need&&wy<need){
      const pX=logistica(forcaDoDia(x.ef,x.quim),forcaDoDia(y.ef,y.quim),CFG_SIM.D_MAPA);
      rndF()<pX?wx++:wy++;}
    const vc=wx>wy?x:y,pd=wx>wy?y:x;vc.v++;pd.d++;vc.hist.push("V");pd.hist.push("D");
  };
  const finalizarRodada=()=>{
    ativos.forEach(t=>{if(t._bye){t.v++;delete t._bye;}});
    TG.times.forEach(t=>{if(t.vivo&&t.v>=3){t.vivo=false;TG.classificados.push(t);}
      else if(t.vivo&&t.d>=3){t.vivo=false;TG.eliminados.push(t);}});
    renderSwiss();
  };
  // se o jogador joga nesta rodada, abre a partida; os outros resolvem ao fim dela
  if(parDoJogador){
    const [a,b]=parDoJogador;const meu=a.meu?a:b,adv=a.meu?b:a;
    const md=decisivo(meu,adv)?3:1; // real: jogos de classificação/eliminação são MD3
    const ctx=`Rodada ${TG.rodada} · Fase Suíça · você está ${meu.v}-${meu.d}${md===3?" · DECISIVO (MD3)":""}`;
    fechar("suicaOverlay");
    abrirPartida(meu,adv,md,ctx,(venc)=>{
      // aplica o resultado da SUA partida
      const meuVenceu=venc===meu; // identidade por referência (robusto a nomes iguais: 2 Spirit/FURIA)
      (meuVenceu?meu:adv).v++;(meuVenceu?adv:meu).d++;
      meu.hist.push(meuVenceu?"V":"D");adv.hist.push(meuVenceu?"D":"V");
      pares.forEach(resolverPar);
      finalizarRodada();
      if(!checarFimDeCampanha())abrir("suicaOverlay");
    });
  }else{
    pares.forEach(resolverPar);
    finalizarRodada();
  }
}
function renderSwiss(){
  $("suicaSub").textContent=suicaCompleta()?"· classificação definida":`· rodada ${TG.rodada}`;
  const records=["0-0","1-0","0-1","2-0","1-1","0-2","2-1","1-2","2-2"];
  let html="";
  records.forEach(rec=>{
    const [v,d]=rec.split("-").map(Number);
    const grupo=TG.times.filter(t=>t.v===v&&t.d===d&&t.vivo);
    if(!grupo.length)return;
    html+=`<div class="swiss-col"><div class="swiss-colhead neutral">${v}:${d}</div>`+
      grupo.map(t=>`<div class="match${t.meu?" mine":""}">${chip(t)}</div>`).join("")+`</div>`;
  });
  // classificados (verde) e eliminados (vermelho)
  html+=`<div class="swiss-col"><div class="swiss-colhead qual">Classificados</div>`+
    Array.from({length:8},(_,i)=>{const t=TG.classificados[i];
      return `<div class="qualified-slot${t?"":" empty"}${t?.meu?" mine":""}">${t?chip(t):'<span class="tn empty-tn">—</span>'}</div>`;}).join("")+`</div>`;
  html+=`<div class="swiss-col"><div class="swiss-colhead elim">Eliminados</div>`+
    Array.from({length:8},(_,i)=>{const t=TG.eliminados[i];
      return `<div class="qualified-slot elim-slot${t?"":" empty"}${t?.meu?" mine":""}">${t?chip(t):'<span class="tn empty-tn">—</span>'}</div>`;}).join("")+`</div>`;
  $("swissBoard").innerHTML=html;
  // controles: avançar some quando acaba; botão de ir aos playoffs aparece SÓ aqui, após classificação
  $("suicaAvancar").hidden=suicaCompleta();
  $("suicaPlayoffs").hidden=!suicaCompleta();
}

// ---- Playoffs ----
function garantirPlayoffs(){
  if(TG.playoffs)return;
  const seeds=[...TG.classificados].slice(0,8).sort((a,b)=>b.ef-a.ef);
  TG.playoffs={seeds,
    quartas:[[seeds[0],seeds[7]],[seeds[3],seeds[4]],[seeds[1],seeds[6]],[seeds[2],seeds[5]]],
    semi:[null,null,null,null],final:[null,null],campeao:null,fase:0,res:{}};
}
function avancarPlayoff(){
  const P=TG.playoffs;if(!P||P.campeao)return;
  const fd=t=>()=>forcaDoDia(t.ef,t.quim);
  // resolve a série e guarda o SEED vencedor por referência (robusto a times homônimos)
  const jogar=(a,b)=>{const r=simularSerie(a.time,b.time,fd(a),fd(b),3,true);r.vencedorSeed=r.vencedor===a.time?a:b;return r;}; // leve: série NPC, ninguém assiste
  // pares da fase atual
  let pares,aplicar;
  if(P.fase===0){
    pares=P.quartas.map((p,i)=>({par:p,key:"q"+i}));
    aplicar=()=>{P.semi=P.quartas.map((p,i)=>P.res["q"+i].vencedorSeed);P.fase=1;};
  }else if(P.fase===1){
    pares=[{par:[P.semi[0],P.semi[1]],key:"s0"},{par:[P.semi[2],P.semi[3]],key:"s1"}];
    aplicar=()=>{P.final=[P.res.s0.vencedorSeed,P.res.s1.vencedorSeed];P.fase=2;};
  }else{
    pares=[{par:[P.final[0],P.final[1]],key:"f"}];
    aplicar=()=>{P.campeao=P.res.f.vencedorSeed;P.fase=3;};
  }
  // separa a série do jogador
  const meuPar=pares.find(({par})=>par[0]?.meu||par[1]?.meu);
  const outros=pares.filter(x=>x!==meuPar);
  const faseNome=["Quartas de final","Semifinal","Grande Final"][P.fase];
  if(meuPar){
    const [a,b]=meuPar.par;const meu=a.meu?a:b,adv=a.meu?b:a;
    fechar("playoffOverlay");
    abrirPartida(meu,adv,3,`${faseNome} · Playoffs · melhor de 3`,(venc,placar)=>{
      // placar vem como [vMeu, vAdv]; mapeia pra ordem [a,b] do par do bracket
      const [vMeu,vAdv]=placar;
      const pa=(a.meu?vMeu:vAdv),pb=(b.meu?vMeu:vAdv);
      P.res[meuPar.key]={vencedorNome:venc.nome,placarSerie:[pa,pb],vencedorSeed:venc};
      outros.forEach(({par,key})=>{P.res[key]=jogar(par[0],par[1]);});
      aplicar();renderBracket();
      const meuPerdeu=venc!==meu;
      if(meuPerdeu&&TG.campanha){TG.campanha.fim="eliminado";telaFinal();}
      else if(P.campeao&&P.campeao.meu){TG.campanha.fim="campeao";telaFinal();}
      else abrir("playoffOverlay");
    });
  }else{
    outros.forEach(({par,key})=>{P.res[key]=jogar(par[0],par[1]);});
    aplicar();renderBracket();
  }
}
function serieEl(a,b,key,fase,faseAtual){
  const P=TG.playoffs,r=P&&P.res[key];
  const pendente=!a||!b;
  const aWin=r&&r.vencedorSeed===a,bWin=r&&r.vencedorSeed===b;
  const ativa=!pendente&&!r&&fase===faseAtual;
  return `<div class="series${(a?.meu||b?.meu)?" mine":""}${r?" done":""}${ativa?" ativa":""}">
    <div class="series-row${aWin?" win":""}${r&&!aWin?" lose":""}">${chip(a)}<span class="sc">${r?r.placarSerie[0]:""}</span></div>
    <div class="series-sep"></div>
    <div class="series-row${bWin?" win":""}${r&&!bWin?" lose":""}">${chip(b)}<span class="sc">${r?r.placarSerie[1]:""}</span></div></div>`;
}
function renderBracket(){
  const P=TG.playoffs;
  $("playoffSub").textContent=P.campeao?"· campeão coroado":["· quartas de final","· semifinais","· grande final"][P.fase]||"";
  $("bracketBoard").innerHTML=`
    <div class="bracket-round">
      <div class="bracket-round-title">Quartas</div>
      ${P.quartas.map((p,i)=>serieEl(p[0],p[1],"q"+i,0,P.fase)).join("")}
    </div>
    <div class="bracket-round">
      <div class="bracket-round-title">Semifinais</div>
      ${serieEl(P.semi[0],P.semi[1],"s0",1,P.fase)}
      ${serieEl(P.semi[2],P.semi[3],"s1",1,P.fase)}
    </div>
    <div class="bracket-round">
      <div class="bracket-round-title">Final</div>
      ${serieEl(P.final[0],P.final[1],"f",2,P.fase)}
    </div>
    <div class="bracket-round champ-col">
      <div class="bracket-round-title">Campeão</div>
      <div class="champion${P.campeao?" crowned":""}">
        ${P.campeao?`<div class="cup-tag">CAMPEÃO</div>${chip(P.campeao)}<div class="champ-tag">${P.campeao.meu?"VOCÊ É CAMPEÃO":"Campeão do Major"}</div>`
          :`<div class="cup-tag dim">—</div><div class="champ-wait">aguardando…</div>`}
      </div>
    </div>`;
  $("playoffAvancar").hidden=!!P.campeao;
}

function abrir(id){const el=$(id);if(el._fechando){clearTimeout(el._fechando);el._fechando=null;}el.classList.remove("fechando");el.hidden=false;document.body.style.overflow="hidden";}
function fechar(id){const el=$(id);document.body.style.overflow="";el.classList.add("fechando");if(el._fechando)clearTimeout(el._fechando);el._fechando=setTimeout(()=>{el.hidden=true;el.classList.remove("fechando");el._fechando=null;},190);}
// troca antessala<->scoreboard com fade-in
function mostrarTela(id){const el=$(id);el.classList.remove("is-hidden");el.classList.remove("tela-in");void el.offsetWidth;el.classList.add("tela-in");}
function abrirSuica(){if(!TG.times)iniciarTorneio();renderSwiss();abrir("suicaOverlay");}
function abrirPlayoffs(){garantirPlayoffs();renderBracket();fechar("suicaOverlay");abrir("playoffOverlay");}

$("suicabtn").onclick=abrirSuica;
$("suicaFechar").onclick=()=>fechar("suicaOverlay");
$("suicaAvancar").onclick=avancarSuica;
$("suicaPlayoffs").onclick=abrirPlayoffs;
$("playoffFechar").onclick=()=>fechar("playoffOverlay");
$("playoffAvancar").onclick=avancarPlayoff;
// mostra a seção do Major só quando o elenco estiver completo
/* ——— UI · reprodutor de partida (cinematográfico) ——— */
// ritmo dos rounds: pulso legível e mais pausado (rounds correm devagar pra acompanhar)
const RITMO={base:260,troca:1000,inicio:500};
const MP={ativo:false,timer:null,onFim:null,gen:0,jogo:null,ctx:""};

function monoChip(nome,cor){return `<div class="team-mono" style="background:${cor||"#888"}">${mono(nome)}</div>`;}

function reproduzirMapa(jogo,A,B,contexto){
  // invalida qualquer reprodução anterior: cancela timer e incrementa a geração
  clearTimeout(MP.timer);
  const meuGen=++MP.gen;
  MP.ativo=true;MP.jogo=jogo;MP.ctx=contexto;
  $("matchContinue").hidden=true;$("matchSkip").hidden=false;
  $("roundStrip").innerHTML="";
  const aMine=!!A.meu,bMine=!!B.meu;
  $("sbTeamA").className="sb-team sb-a"+(aMine?" mine":"");
  $("sbTeamB").className="sb-team sb-b"+(bMine?" mine":"");
  $("sbTeamA").innerHTML=monoChip(A.nome,A.cor)+`<div class="sb-info"><span class="sb-name">${esc(A.nome)}</span>${A.camp?`<span class="sb-camp">${esc(A.camp)}</span>`:""}<span class="sb-side ct" id="sideA">CT</span></div>`;
  $("sbTeamB").innerHTML=monoChip(B.nome,B.cor)+`<div class="sb-info"><span class="sb-name">${esc(B.nome)}</span>${B.camp?`<span class="sb-camp">${esc(B.camp)}</span>`:""}<span class="sb-side tr" id="sideB">TR</span></div>`;
  $("sbScoreA").textContent="0";$("sbScoreB").textContent="0";
  $("sbMap").textContent=jogo.mapa;$("sbProgress").style.width="0%";
  montarScoreboard(jogo); // tabela inicial dos 10 jogadores (zerada)
  // cacheia os elementos quentes do loop (evita $() por round)
  const elProg=$("sbProgress"),elRS=$("roundStrip"),elScA=$("sbScoreA"),elScB=$("sbScoreB"),elSideA=$("sideA"),elSideB=$("sideB");
  const total=jogo.rounds.length;
  let i=0;
  const passo=()=>{
    if(meuGen!==MP.gen||!MP.ativo)return; // timer órfão de outra reprodução: ignora
    if(i>=total)return finalizarReproducao(jogo,meuGen);
    const rd=jogo.rounds[i];
    const ladoVenc=rd.venceA?rd.ladoA:rd.ladoB;
    if(rd.venceA)setScore(elScA,rd.pa,ladoVenc);else setScore(elScB,rd.pb,ladoVenc);
    elProg.style.width=Math.round((i+1)/total*100)+"%";
    addCelula(rd,ladoVenc,elRS);
    Audio.roundWin(rd.venceA?aMine:bMine);
    if(rd.troca){elSideA.className="sb-side tr";elSideA.textContent="TR";
      elSideB.className="sb-side ct";elSideB.textContent="CT";}
    atualizarScoreboard(jogo,rd); // atualiza K-D e pulsa quem fragou
    if(rd.destaque)Audio.impacto(false);
    i++;
    MP.timer=setTimeout(passo,rd.troca?RITMO.troca:RITMO.base);
  };
  MP.timer=setTimeout(passo,RITMO.inicio);
}
function setScore(elOrId,val,lado){const el=typeof elOrId==="string"?$(elOrId):elOrId;el.textContent=val;
  el.classList.remove("bump","flash-ct","flash-tr");void el.offsetWidth;
  el.classList.add("bump",lado==="CT"?"flash-ct":"flash-tr");}
function addCelula(rd,lado,strip){
  const s=strip||$("roundStrip");const c=document.createElement("div");
  c.className=`rs-cell pop ${lado==="CT"?"ct":"tr"}${rd.destaque?" key":""}`;
  s.appendChild(c);
}
// monta a tabela inicial do scoreboard (10 jogadores, K-D zerado)
function montarScoreboard(jogo){
  const linha=(s,meu)=>`<div class="ls-row${meu?" mine":""}" data-nick="${esc(s.nick)}">
    <span class="ls-nick">${esc(s.nick)}</span>
    <span class="ls-kd-val"><b>0</b> <s>/</s> 0</span>
    <span class="ls-rate">–</span></div>`;
  const head=(nome,meu,lado,cor)=>`<div class="ls-head">
    <span class="ls-team-id"><span class="ls-mono" style="background:${esc(cor||"#888")}">${esc(mono(nome))}</span><span class="ls-team">${esc(nome)}</span><span class="ls-side-tag ${lado}">${lado.toUpperCase()}</span></span>
    <span class="ls-col">K–D</span>
    <span class="ls-col">Rating</span></div>`;
  $("lsSideA").className="ls-side"+(jogo.meuA?" mine":"");
  $("lsSideB").className="ls-side"+(jogo.meuB?" mine":"");
  $("lsSideA").innerHTML=head(jogo.nomeA,jogo.meuA,"ct",jogo.corA)+jogo.statsA.map(s=>linha(s,jogo.meuA)).join("");
  $("lsSideB").innerHTML=head(jogo.nomeB,jogo.meuB,"tr",jogo.corB)+jogo.statsB.map(s=>linha(s,jogo.meuB)).join("");
  // cacheia linhas e células uma vez (evita re-query a cada round)
  const cacheLado=sideId=>[...$(sideId).querySelectorAll(".ls-row")].map(r=>({row:r,kd:r.querySelector(".ls-kd-val"),rate:r.querySelector(".ls-rate")}));
  MP.sb={A:cacheLado("lsSideA"),B:cacheLado("lsSideB")};
}
// atualiza o K-D do scoreboard até o round atual e pulsa quem fragou
function atualizarScoreboard(jogo,rd){
  if(!MP.sb)return;
  const upd=(cells,stats,snap)=>{
    snap.forEach((s,idx)=>{
      const c=cells[idx];if(!c)return;
      c.kd.innerHTML=`<b>${s.k}</b> <s>/</s> ${s.d}`;
      if(stats[idx].nick===rd.destaque){c.row.classList.remove("frag");void c.row.offsetWidth;c.row.classList.add("frag");}
    });
  };
  upd(MP.sb.A,jogo.statsA,rd.snapA);
  upd(MP.sb.B,jogo.statsB,rd.snapB);
}
function finalizarReproducao(jogo,meuGen){
  if(meuGen!==MP.gen)return; // reprodução já substituída
  MP.ativo=false;
  $("sbScoreA").textContent=jogo.placar[0];$("sbScoreB").textContent=jogo.placar[1];
  $("sbProgress").style.width="100%";
  Audio.fimJogo(!!jogo.vencedor.meu);
  // scoreboard com os stats finais (K-D completo)
  const ult=jogo.rounds[jogo.rounds.length-1];
  if(ult)atualizarScoreboard(jogo,ult);
  // rating do mapa: aparece só agora, no fim
  const preencheRating=(cells,stats)=>{if(!cells)return;
    stats.forEach((st,idx)=>{const c=cells[idx];if(c&&c.rate){
      c.rate.textContent=st.rating.toFixed(2);c.rate.className="ls-rate "+(st.rating>=1.15?"r-top":st.rating>=0.95?"r-mid":"r-low");}});};
  if(MP.sb){preencheRating(MP.sb.A,jogo.statsA);preencheRating(MP.sb.B,jogo.statsB);}
  $("matchSkip").hidden=true;$("matchContinue").hidden=false;
  if(MP.onFim){const cb=MP.onFim;MP.onFim=null;cb();} // dispara só uma vez
}
// pula direto pro resultado do mapa em curso (renderiza tudo de uma vez)
function pularMapa(){
  if(!MP.ativo||!MP.jogo)return;
  const jogo=MP.jogo;clearTimeout(MP.timer);
  $("roundStrip").innerHTML="";
  jogo.rounds.forEach(rd=>addCelula(rd,rd.venceA?rd.ladoA:rd.ladoB));
  $("sbScoreA").textContent=jogo.placar[0];$("sbScoreB").textContent=jogo.placar[1];
  finalizarReproducao(jogo,MP.gen);
}
function pararReproducao(){MP.ativo=false;MP.gen++;clearTimeout(MP.timer);MATCH.rodando=false;}

/* ——— UI · orquestração da partida —————————————————— */
// MATCH guarda a série em andamento do jogador
const MATCH={A:null,B:null,md:1,mapaIdx:0,vA:0,vB:0,contexto:"",onSerieFim:null};

function abrirPartida(meuTime,adversario,md,contexto,onSerieFim){
  pararReproducao(); // garante que nenhuma reprodução anterior continue rodando
  MATCH.A=meuTime;MATCH.B=adversario;MATCH.md=md;MATCH.mapaIdx=0;MATCH.vA=0;MATCH.vB=0;
  MATCH.contexto=contexto;MATCH.onSerieFim=onSerieFim;MATCH.rodando=false;
  mostrarAntessala();
  abrir("matchOverlay");
}
function mostrarAntessala(){
  $("livemap").classList.add("is-hidden");mostrarTela("prematch");
  const {A,B,contexto,md}=MATCH;
  if(!A||!B)return; // proteção: par incompleto
  $("prematchCtx").textContent=contexto+(md>1?" · melhor de "+md:" · 1 mapa");
  const teamCard=(t)=>`<div class="team-mono" style="background:${t.cor||"#888"};width:74px;height:74px;font-size:1.5rem;border-radius:18px">${mono(t.nome)}</div>
    <div class="pm-name">${esc(t.nome)}</div>${t.camp?`<div class="pm-camp">${esc(t.camp)}</div>`:""}<div class="pm-ef">força <b>${t.ef}</b></div>`;
  $("pmTeamA").className="pm-team"+(A.meu?" mine":"");$("pmTeamA").innerHTML=teamCard(A);
  $("pmTeamB").className="pm-team"+(B.meu?" mine":"");$("pmTeamB").innerHTML=teamCard(B);
}
function iniciarMapaDaSerie(){
  if(MATCH.rodando)return; // já tem um mapa em curso — ignora clique repetido
  MATCH.rodando=true;
  Audio.init();
  $("prematch").classList.add("is-hidden");mostrarTela("livemap");
  const {A,B}=MATCH;
  const fdA=forcaDoDia(A.ef,A.quim),fdB=forcaDoDia(B.ef,B.quim);
  const tA={...A.time,nome:A.nome,cor:A.cor,meu:A.meu},tB={...B.time,nome:B.nome,cor:B.cor,meu:B.meu};
  const jogo=simularMapa(tA,tB,fdA,fdB);
  MP.onFim=()=>{ // ao fim do mapa: contabiliza a série e libera o botão Continuar
    if(jogo.vencedorNome===A.nome)MATCH.vA++;else MATCH.vB++;
    if(typeof registrarPartida==="function"&&(jogo.meuA||jogo.meuB))registrarPartida(jogo);
    MATCH.rodando=false;
  };
  reproduzirMapa(jogo,tA,tB,MATCH.contexto);
}
function continuarPartida(){
  if(MATCH.rodando)return; // mapa ainda rolando — ignora
  const need=Math.ceil(MATCH.md/2);
  if(MATCH.vA>=need||MATCH.vB>=need){ // série acabou
    const cb=MATCH.onSerieFim;MATCH.onSerieFim=null; // dispara só uma vez
    fechar("matchOverlay");
    if(cb)cb(MATCH.vA>MATCH.vB?MATCH.A:MATCH.B,[MATCH.vA,MATCH.vB]);
  }else{ // próximo mapa da série (sem antessala)
    MATCH.mapaIdx++;
    iniciarMapaDaSerie();
  }
}
$("prematchStart").onclick=iniciarMapaDaSerie;
$("matchContinue").onclick=continuarPartida;
$("matchSkip").onclick=pularMapa;
$("matchClose").onclick=()=>{pararReproducao();fechar("matchOverlay");};
function jogarNovamente(){
  ["finalOverlay","playoffOverlay","suicaOverlay","matchOverlay"].forEach(fechar);
  pararReproducao();pararAnimacao();
  // zera torneio e partida
  TG.times=null;TG.rodada=0;TG.classificados=[];TG.eliminados=[];TG.playoffs=null;TG.campanha=null;
  Object.assign(MATCH,{A:null,B:null,md:1,mapaIdx:0,vA:0,vB:0,contexto:"",onSerieFim:null,rodando:false});
  Object.values(POOL).forEach(p=>{delete p._formaCamp;}); // nova run sorteia forma de campanha de novo
  // zera o elenco do zero — é o recomeço, sem confirmação
  Object.assign(S,{jogadores:Array(5).fill(null),treinador:null,drawn:null,sel:null,spinning:false});
  S.taken.clear();
  limparHighlights();renderLineup();renderPicks();idleTrack();updateSpinUI();atualizarMajorUI();renderResultado();
  hint("Sorteie um time e comece uma nova campanha rumo ao 9-0.");
  window.scrollTo(0,0);
}
$("finalVoltar").onclick=jogarNovamente;
function atualizarMajorUI(){
  const pronto=elencoCheio();
  $("majorTag").hidden=!pronto;
  $("majorSection").hidden=!pronto;
  if(!pronto){TG.times=null;TG.playoffs=null;fechar("suicaOverlay");fechar("playoffOverlay");}
}

// desbloqueia o áudio (iOS/Safari) no primeiro gesto do usuário, em qualquer lugar da página
["pointerdown","touchstart","touchend","mousedown","click","keydown"].forEach(ev=>document.addEventListener(ev,()=>Audio.init(),{once:true,passive:true}));

idleTrack();
renderLineup();
renderPicks();
updateSpinUI();
