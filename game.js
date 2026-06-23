/* ════════════════════════════════════════════════════════════════════
   draft9-0 · lógica do jogo
   ────────────────────────────────────────────────────────────────────
   Organização do arquivo (de cima para baixo):
     1. MOTOR        — avaliação de jogadores (OVR), química, rating HLTV,
                       simulação de mapa e série. Blocos CFG_* = balanceamento.
     2. DADOS        — jogadores (ATRIBUTOS), times (TIMES_DEF), POOL/TEAMS.
     3. ESTADO + UI  — roleta, montagem de elenco, fase suíça, playoffs e o
                       reprodutor de partidas.
   Convenção: nomes e comentários em pt-BR; helpers curtos no topo de cada bloco.
   ════════════════════════════════════════════════════════════════════ */
/* ——— MOTORES A/B/C · avaliação de jogadores e química ——— */
const CFG_IDENTIDADE={K_APOIO:.30,PARADOXOS:[["Entry","Support"],["Entry","Lurker"]],
  AWP_SUPREMO:{min:85,bonus:25},LURKER_SOLO:{enRef:20,fator:.6},LURKER_FILTRO:{enRef:45,fator:2.5},LURKER_GATE:{opMin:40},
  SUPPORT_UT_REF:70, // acima deste ut, a penalidade de fp no support encolhe (rifler-support legítimo)
  SUPPORT_TR_MIN:25, // abaixo deste trade, o support é descontado (fragger solo não joga de apoio)
  SUPPORT_CL_REF:55,SUPPORT_K_CLUTCH:.35, // clutch alto puxa pra longe de support (perfil solo, não coletivo)
  SEC_FORTE_GAP:.35,
  LK_CTRL:{w:1.21,ref:65.95,fpRef:84.95}, // lurker-controlador: ut+op alto vira lurk, amortecido por fp elite (fp alto=rifler)
  SUPP_K_OP:0.33,SUPP_OP_REF:59.44};   // support penalizado por op alto (apoio segura, nao abre) // gap relativo de afinidade ≤35% = secundário genuíno; acima disso é nominal
const CFG_AVALIACAO={OVR_MIN:5,OVR_MAX:20,ELITE_REF:1.25,
  ABERRACAO:{r22:1.65,r21:1.45}, // rating acima destes limiares força OVR 22 / 21 (sobre-humano)
  ART:{r:6.5,sn:.04,fp:.01,secMul:.015,base:3.5,eliteMul:15,secCap:75},
  ASS:{r:7.5,fp:.04,base:4.0,subRef:55,subDiv:28,subClamp:.8,eliteMul:8},
  ESP:{mecR:9.0,mecBase:6.0,funcMul:14,funcMulSup:11.5,funcBase:5,convRef:25,convDiv:10,convClamp:2.5},
  ANC:{wM:.62,wF:.32,wMp:.50,wFp:.49,eliteMul:18,clRef:60,kCl:.10},OPR:{wM:.50,wF:.50}, // clRef/kCl: âncora com clutch baixo (cl<clRef) perde um pouco
  CMD:{FM:9.86,FB:2.68,BR:2.32,UTW:8.64,FADE:0.7,PC:4.08,bonusEntry:1,bonusFpRef:45,bonusFpDiv:20},
  PISO_COLOCACAO:{Campeao:6,Final:4,Top4:3,Top8:2,Grupos:0}};
const CFG_QUIMICA={RESULTADO:{Campeao:5,Final:4,Top4:3,Top8:2,Grupos:1},
  ESPERADO_POR_SOMA:[{min:86,e:5},{min:78,e:4},{min:70,e:3},{min:60,e:2},{min:0,e:1}],
  TREINADOR_BASE:15,TREINADOR_K_BONUS:2.5,TREINADOR_K_PUN:1.5,PISO_TREINADOR:{Campeao:16,Final:15,Top4:15,Top8:12,Grupos:10},
  TREINADOR_MIN:10,TREINADOR_MAX:20,IGL_FRACO_OVR:13,ESTRELA_LIMITE:2,
  TREINADOR_FORCA:{neutro:15,porPonto:.025},
  PEN:{semIGL:.25,iglFraco:.10,semAWP:.20,semAncora:.11,semIniciativa:.12,estrelaExtra:.07},BONUS_ESTRUTURA:.08,QUIMICA_MIN:.50,QUIMICA_MAX:1.20,
  CORTE_IGL_ESTRATEGISTA:.10, // só o Estrategista ameniza a falta de IGL, e só 10% (Motivador não mexe)
  TALENTO:{refBruta:78,divisor:15,peso:1.0,teto:1.12}, // firepower alto resiste à química ruim (preenche o gap até o teto)
  IDEAL:{IGL:1,AWPer:1,Lurker:1,Support:2,Entry:2,Rifler:3},
  DUREZA:{IGL:.08,AWPer:.07,Lurker:.04,Support:.04,Entry:.03,Rifler:.03},
  SAT_LEVE:.05, // limite de saturação que ainda permite bônus de estrutura
  SEC_NOMINAL_PESO:.5, // secundário nominal cobre metade do que um secundário forte cobriria
  RIFLER_VERSATIL_ALIVIO:.5, // Rifler com 2ª função (Entry/Lurker/Support) conta meio na saturação (não é rifler "puro")
  FUNC_EGO:["Entry","Rifler","AWPer","Lurker"], // estrelas nessas funções geram atrito; IGL/Support não
  RIFLER_INICIATIVA:.5, // Rifler sem Entry cobre o pilar Iniciativa só pela metade
  CARAC:{Gestor:{tetoEstrelasBonus:1,estrelaExtraPen:.04},Desenvolvedor:{cruRef:14,cruPorJogador:.03,cruTeto:.08},Estrategista:{bonusEstrutura:.13},Motivador:{cortePenalidade:.40}},
  DERIVA:{SOMA_ESPERADA:{Campeao:85,Final:80,Top4:74,Top8:66,Grupos:56},DESENV_RESULTADO_MIN:["Campeao","Final","Top4"],LIMIAR:.3}};

const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const clipOVR=x=>clamp(Math.round(x),CFG_AVALIACAO.OVR_MIN,CFG_AVALIACAO.OVR_MAX);
const BACKBONE={Rifler:"fp",AWPer:"sn",Lurker:"cl",Support:"ut",Entry:"en"};
const backbone=(p,s)=>p[BACKBONE[s]]??0;
const bonusElite=(r,m)=>r>=CFG_AVALIACAO.ELITE_REF?(r-CFG_AVALIACAO.ELITE_REF)*m:0;
const ehParadoxo=(a,b)=>CFG_IDENTIDADE.PARADOXOS.some(([x,y])=>(a===x&&b===y)||(a===y&&b===x));
const GATES_PRIMARIO={Lurker:p=>p.op>=CFG_IDENTIDADE.LURKER_GATE.opMin||p.cl>=86,AWPer:p=>p.sn>=CFG_IDENTIDADE.AWP_SUPREMO.min};
function afinidades(p){const cfg=CFG_IDENTIDADE;let awp=p.sn;if(p.sn>=cfg.AWP_SUPREMO.min)awp+=cfg.AWP_SUPREMO.bonus;
  let lurker=p.cl+Math.max(0,cfg.LURKER_SOLO.enRef-p.en)*cfg.LURKER_SOLO.fator;
  if(p.en>cfg.LURKER_FILTRO.enRef)lurker-=(p.en-cfg.LURKER_FILTRO.enRef)*cfg.LURKER_FILTRO.fator;
  // boost de lurker-controlador: ut+op alto (controla o mapa) com cl real, amortecido por fp elite
  if(p.cl>=45&&p.en<=45){const lk=cfg.LK_CTRL;const ctrl=(0.55*p.ut+0.45*p.op)-lk.ref;
    const damp=Math.max(0,Math.min(1,(100-p.fp)/(100-lk.fpRef)));if(ctrl>0)lurker+=lk.w*ctrl*damp;}
  let supp=Math.max(0,(.75*p.ut+.25*p.tr-cfg.K_APOIO*p.fp*Math.max(0,Math.min(1,(cfg.SUPPORT_UT_REF-p.ut)/cfg.SUPPORT_UT_REF))-cfg.SUPPORT_K_CLUTCH*Math.max(0,p.cl-cfg.SUPPORT_CL_REF))*(p.tr>=cfg.SUPPORT_TR_MIN?1:p.tr/cfg.SUPPORT_TR_MIN));
  supp-=cfg.SUPP_K_OP*Math.max(0,p.op-cfg.SUPP_OP_REF);
  return{AWPer:awp,Entry:.74*p.en+.26*p.op,Rifler:.55*p.fp+.30*p.tr+.15*p.op,
    Support:Math.max(0,supp),Lurker:Math.max(0,lurker)};}
function motorA(p){if(p.classeCravada){const c=p.classeCravada.split("-");c.secForte=true;return c;}
  const sc=afinidades(p);
  const ordem=Object.keys(sc).sort((a,b)=>sc[b]-sc[a]);
  if(p.isIGL){const c=["IGL",ordem[0]];c.secForte=true;return c;}
  // AWP supremo: SN altíssimo força AWPer como primário (recurso único do time)
  const awpSupremo=p.sn>=CFG_IDENTIDADE.AWP_SUPREMO.min;
  const prim=awpSupremo?"AWPer":(ordem.find(s=>!GATES_PRIMARIO[s]||GATES_PRIMARIO[s](p))??ordem[0]);
  const sec=ordem.find(s=>s!==prim&&!ehParadoxo(prim,s));
  // secundário é "forte" (jogador genuinamente bi-funcional) se a afinidade dele
  // for próxima do primário; se o gap for grande, o 2º papel é só nominal
  const ref=Math.max(1,sc[prim]);const gap=(sc[prim]-(sc[sec]??0))/ref;
  const c=[prim,sec];c.secForte=gap<=CFG_IDENTIDADE.SEC_FORTE_GAP;return c;}
const ESTEIRA={AWPer:"Artilharia",Rifler:"Assalto",Entry:"Vanguarda",Lurker:"Ancora",Support:"Sistema",IGL:"Comando"};
function ovrArtilharia(p,s){const k=CFG_AVALIACAO.ART;const sc=Math.min(backbone(p,s),k.secCap);
  return clipOVR(k.r*p.rating+k.sn*p.sn+k.fp*p.fp+sc*k.secMul+k.base+bonusElite(p.rating,k.eliteMul));}
function ovrAssalto(p,s){const k=CFG_AVALIACAO.ASS;
  const sub={Entry:.60*p.en+.40*p.op,Lurker:.60*p.cl+.40*p.tr,Support:.60*p.ut+.40*p.tr,AWPer:.70*p.sn+.30*p.op}[s]??0;
  const mod=clamp((sub-k.subRef)/k.subDiv,-k.subClamp,k.subClamp);
  return clipOVR(k.r*p.rating+k.fp*p.fp+k.base+mod+bonusElite(p.rating,k.eliteMul));}
function nucleoOperario(p,s,fnAtr,mul){const k=CFG_AVALIACAO.ESP;
  return{M:k.mecR*p.rating+k.mecBase,F:(fnAtr/100)*mul+k.funcBase,modConv:clamp((backbone(p,s)-k.convRef)/k.convDiv,-k.convClamp,0)};}
function ovrVanguarda(p,s){const{M,F,modConv}=nucleoOperario(p,s,.70*p.en+.30*p.op,CFG_AVALIACAO.ESP.funcMul);
  return clipOVR(CFG_AVALIACAO.OPR.wM*M+CFG_AVALIACAO.OPR.wF*F+modConv);}
function ovrAncora(p,s){const k=CFG_AVALIACAO.ANC;const pm=SUBARQ.Lurker.eixo(p)>=0;
  // Playmaker e avaliado pelo frag/pick (op+fp) com peso proprio; Clutcher pela posicao/clutch (cl)
  const fnAtr=pm?(0.5*p.op+0.5*p.fp):p.cl;
  const{M,F,modConv}=nucleoOperario(p,s,fnAtr,CFG_AVALIACAO.ESP.funcMul);
  const pisoClutch=k.kCl*Math.min(0,p.cl-k.clRef); // âncora pouco clutcher (cl baixo) vale um tico menos; cl alto não muda
  return clipOVR((pm?k.wMp:k.wM)*M+(pm?k.wFp:k.wF)*F+modConv+pisoClutch+bonusElite(p.rating,k.eliteMul));}
function ovrSistema(p,s){const{M,F,modConv}=nucleoOperario(p,s,p.ut,CFG_AVALIACAO.ESP.funcMulSup);
  return clipOVR(CFG_AVALIACAO.OPR.wM*M+CFG_AVALIACAO.OPR.wF*F+modConv);}
function ovrComando(p,s){const k=CFG_AVALIACAO.CMD;
  // O IGL não é role de combate — avalia-se em DUAS CAMADAS.
  // CAMADA 1 — frag herdado do SECUNDÁRIO: o que o IGL rende no tiroteio depende do que ele joga.
  const frag={AWPer:.50*p.sn+.30*p.op+.20*p.fp,Rifler:.60*p.fp+.25*p.op+.15*p.tr,
    Entry:.50*p.en+.30*p.op+.20*p.fp,Lurker:.45*p.cl+.30*p.fp+.25*p.op,
    Support:.40*p.ut+.25*p.en+.20*p.op+.15*p.tr}[s]??(.50*p.fp+.50*p.op);
  const fn=clamp(frag/100,0,1);
  const combate=(frag/100)*k.FM+k.FB+(s==="Entry"?k.bonusEntry:0);
  // CAMADA 2 — prêmio de comando: o valor que o frag NÃO mede.
  // colocação (título prova o caller) + forma (rating) + cérebro tático (ut),
  // este COMPENSANDO quem fraga pouco: caller puro vale pela cabeça; IGL-fragger já é pago no frag.
  const piso={Campeao:k.PC,Final:k.PC*0.70,Top4:k.PC*0.55,Top8:k.PC*0.38,Grupos:0}[p.colocacao]??0;
  const cerebro=piso+(p.rating-1.0)*k.BR+(p.ut/100)*k.UTW*(1-fn*k.FADE)+Math.max(0,p.fp-k.bonusFpRef)/k.bonusFpDiv;
  return clipOVR(combate+cerebro);}
function motorB(p,classe){const esteira=ESTEIRA[classe[0]];
  const fns={Artilharia:ovrArtilharia,Assalto:ovrAssalto,Vanguarda:ovrVanguarda,Ancora:ovrAncora,Sistema:ovrSistema,Comando:ovrComando};
  return{esteira,ovr:fns[esteira](p,classe[1])};}
// ——— Sub-arquétipos: eixo ponderado por esteira (detecção automática, multi-atributo) ———
// eixo>0 = sub A, <0 = sub B; magnitude = quão definido é o arquétipo. Define COMO o jogador joga.
const SUBARQ={
  AWPer:{eixo:p=>0.60*p.op+0.40*p.fp-0.60*p.cl-0.40*p.ut,nomes:["Agressivo","Posicional"]},
  Rifler:{eixo:p=>0.55*p.op+0.30*p.fp-0.50*p.tr-0.45*p.cl,nomes:["Fogo","Conector"]},
  Entry:{eixo:p=>0.45*p.op+0.42*p.fp-0.62*p.tr-0.22*p.ut,nomes:["Abertura","Trade"]},
  Lurker:{eixo:p=>0.50*p.op+0.38*p.fp-0.72*p.cl,nomes:["Playmaker","Clutcher"]},
  Support:{eixo:p=>0.55*p.fp+0.25*p.op-0.50*p.ut-0.30*p.tr,nomes:["Apoio","Utilitario"]}
};
function subArquetipo(role,p){const s=SUBARQ[role];if(!s)return null;const e=s.eixo(p);
  return{nome:s.nomes[e>=0?0:1],eixo:+e.toFixed(1),lado:e>=0?"A":"B"};}
// STAR PLAYERS — definidos por curadoria (não se calcula: NiKo é star com OVR 15 ou 22).
const TIER_LENDA=["s1mple","ZywOo","device","dev1ce","NiKo","coldzera","donk","GeT_RiGhT","olofmeister"];
const TIER_STAR=["kennyS","m0NESY","KSCERATO","blameF","shox","XANTARES","JW","ropz"];
function avaliarJogador(p){const classe=motorA(p);const{esteira,ovr}=motorB(p,classe);
  const ab=CFG_AVALIACAO.ABERRACAO;const ovrFinal=p.rating>ab.r22?22:p.rating>ab.r21?21:ovr;
  const _nk=p.nick||p.nome;const estrela=TIER_LENDA.includes(_nk)||TIER_STAR.includes(_nk);
  const _roleSub=classe[0]==="IGL"?classe[1]:classe[0];const sub=subArquetipo(_roleSub,p);
  return{primario:classe[0],secundario:classe[1],secForte:classe.secForte!==false,classe:classe.join("-"),esteira,ovr:ovrFinal,estrela,sub};}
function ovrTreinador(somaOVR,colocacao){const C=CFG_QUIMICA;
  const delta=(C.RESULTADO[colocacao]??1)-(C.ESPERADO_POR_SOMA.find(x=>somaOVR>=x.min)??{e:1}).e;
  const ajuste=delta>=0?C.TREINADOR_K_BONUS*delta:C.TREINADOR_K_PUN*delta;
  return Math.max(C.PISO_TREINADOR[colocacao]??C.TREINADOR_MIN,Math.min(C.TREINADOR_MAX,Math.round(C.TREINADOR_BASE+ajuste)));}
function quimicaComposicao(jogadores,caracTreinador=null){const C=CFG_QUIMICA;
  const car=caracTreinador?(C.CARAC[caracTreinador]??{}):{};const alertas=[];
  const igl=jogadores.find(j=>j.primario==="IGL");
  // primário de qualquer um OU 2ª função do IGL (IGL acumula duas funções)
  const temPrim=fn=>jogadores.some(j=>j.primario===fn)||(!!igl&&igl.secundario===fn);
  // cobertura secundária ponderada (forte=cheio, nominal=meio) p/ o tamanho da penalidade parcial
  const nSec=fn=>jogadores.filter(j=>j.secundario===fn&&j.primario!==fn)
    .reduce((s,j)=>s+(j.secForte?1:C.SEC_NOMINAL_PESO),0);
  // headcount cru (forte OU nominal) p/ a regra de dupla cobertura: 2 jogadores com a função 2 = 1 primário
  const nSecRaw=fn=>jogadores.filter(j=>j.secundario===fn&&j.primario!==fn).length;
  const corte=car.cortePenalidade?(1-car.cortePenalidade):1;let mult=1;
  // comando (falta/fraqueza de IGL) é estrutural: Motivador NÃO ameniza. só o Estrategista, e pouco.
  const corteIGL=caracTreinador==="Estrategista"?(1-C.CORTE_IGL_ESTRATEGISTA):1;
  // pilar com 3 estados: primário=0% | 2+ jogadores com a função 2=dupla cobertura | 1 secundário=penalidade parcial | nenhum=cheia
  const pilar=(nome,pen,temP,secs,secsRaw)=>{
    if(temP){alertas.push(`${nome}`);return;}
    if(secsRaw>=2){alertas.push(`${nome} (dupla cobertura)`);return;} // 2 jogadores com a função 2 = 1 primário
    if(secs>0){const p=pen*Math.pow(0.5,secs)*corte;mult*=(1-p);alertas.push(`${nome} secundária −${Math.round(p*100)}%`);return;}
    mult*=(1-pen*corte);alertas.push(`${nome} falta −${Math.round(pen*corte*100)}%`);
  };
  const isIglFraco=igl&&igl.ovr<C.IGL_FRACO_OVR;
  let penCmd=1; // comando é estrutural: aplicado FORA da resistência de talento (em forcaTime)
  if(!igl){penCmd=1-C.PEN.semIGL*corteIGL;alertas.push(`Comando falta −${Math.round(C.PEN.semIGL*corteIGL*100)}%`);}
  else if(isIglFraco){penCmd=1-C.PEN.iglFraco*corteIGL;alertas.push(`Comando fraco −${Math.round(C.PEN.iglFraco*corteIGL*100)}%`);}
  else alertas.push("Comando");
  pilar("AWP",C.PEN.semAWP,temPrim("AWPer"),nSec("AWPer"),nSecRaw("AWPer"));
  pilar("Âncora",C.PEN.semAncora,temPrim("Lurker")||temPrim("Support"),nSec("Lurker")+nSec("Support"),nSecRaw("Lurker")+nSecRaw("Support"));
  // Iniciativa: Entry abre o round (preenche completo); Rifler é fogo sem abertura (cobre parcial)
  // temPrim já considera a 2ª função do IGL, sem precisar checar igl.secundario de novo
  if(temPrim("Entry")){alertas.push("Iniciativa");}
  else if(nSecRaw("Entry")>=2){alertas.push("Iniciativa (dupla cobertura)");} // 2 jogadores com Entry 2 = 1 primário
  else if(temPrim("Rifler")){const eSec=nSec("Entry");const fator=eSec>0?C.RIFLER_INICIATIVA*Math.pow(0.5,eSec):C.RIFLER_INICIATIVA;const p=C.PEN.semIniciativa*fator*corte;mult*=(1-p);alertas.push(`Iniciativa ${eSec>0?"parcial":"limitada"} −${Math.round(p*100)}%`);}
  else{const secs=nSec("Entry")+nSec("Rifler"),secsRaw=nSecRaw("Entry")+nSecRaw("Rifler");
    if(secsRaw>=2){alertas.push("Iniciativa (dupla cobertura)");}
    else if(secs>0){const p=C.PEN.semIniciativa*Math.pow(0.5,secs)*corte;mult*=(1-p);alertas.push(`Iniciativa secundária −${Math.round(p*100)}%`);}
    else{mult*=(1-C.PEN.semIniciativa*corte);alertas.push(`Iniciativa falta −${Math.round(C.PEN.semIniciativa*corte*100)}%`);}}
  // saturação: excesso de uma função primária além do ideal, ponderado pela dureza da função
  let satTotal=0;
  ["IGL","AWPer","Lurker","Support","Entry","Rifler"].forEach(fn=>{
    let n=jogadores.filter(j=>j.primario===fn).length+(igl&&igl.secundario===fn?1:0); // 2ª função do IGL conta como primária
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
  const temPilares=igl&&igl.ovr>=C.IGL_FRACO_OVR&&temPrim("AWPer")&&(temPrim("Lurker")||temPrim("Support"))&&(temPrim("Entry")||temPrim("Rifler"));
  if(temPilares&&nEstrelasEgo<=limiteEstrelas&&satTotal<=C.SAT_LEVE){const b=car.bonusEstrutura??C.BONUS_ESTRUTURA;mult*=(1+b);alertas.push(`Estrutura +${Math.round(b*100)}%`);}else alertas.push("Estrutura falta");
  // Desenvolvedor: extrai química de elencos crus — bônus por jogador de OVR baixo que faz render
  if(car.cruRef!=null){const crus=jogadores.filter(j=>j.ovr<=car.cruRef).length;
    if(crus>0){const bd=Math.min(car.cruTeto,crus*car.cruPorJogador);mult*=(1+bd);alertas.push(`Desenvolvimento (${crus} cru${crus>1?"s":""}) +${Math.round(bd*100)}%`);}}
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
  const resist=Math.max(0,(bruta-tal.refBruta)/tal.divisor)*tal.peso;
  // resistência preenche só a química NÃO-estrutural (cobertura de função). o comando vem depois.
  // penalizado (química<1): talento recupera só ATÉ o neutro (cap resist em 1) — penalidades não viram cosmético.
  // estruturado (≥1): inalterado, o bônus de química vem da estrutura, não do firepower.
  const baseEf=q.quimicaSemCmd>=1?Math.min(tal.teto,q.quimicaSemCmd+(1-q.quimicaSemCmd)*resist):Math.min(tal.teto,q.quimicaSemCmd+(1-q.quimicaSemCmd)*Math.min(1,resist));
  const quimicaEf=+Math.max(C.QUIMICA_MIN,Math.min(C.QUIMICA_MAX,baseEf*q.penCmd)).toFixed(3); // comando é estrutural: firepower não compra um caller
  return{bruta,...q,quimica:quimicaEf,quimicaBase:q.quimica,fatorTreinador:fatorT,efetiva:arred(bruta*quimicaEf*fatorT)};}
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

/* ——— DADOS · jogadores, times e estruturas da UI ——— */
const PAISES_MAP={s1mple:"UKR",electroNic:"RUS",b1t:"UKR",Perfecto:"RUS",Boombl4:"RUS",donk:"RUS",sh1ro:"RUS",tN1R:"BLR",zweih:"RUS",chopper:"RUS",
  ZywOo:"FRA",ropz:"EST",mezii:"GBR",flameZ:"ISR",apEX:"FRA",mzinho:"MNG",bLitz:"MNG","910":"MNG",controlez:"MNG",Techno:"MNG",
  KSCERATO:"BRA",yuurih:"BRA",saffee:"BRA",arT:"BRA",drop:"BRA",FL1T:"RUS",fame:"RUS",n0rb3r7:"RUS",Qikert:"KAZ",Jame:"RUS",
  coldzera:"BRA",TACO:"BRA",FalleN:"BRA",fnx:"BRA",fer:"BRA",
  B1ad3:"UKR",Outsiders:"RUS",guerri:"BRA",dead:"BRA",XTQZZZ:"FRA",hally:"RUS",maaRaa:"MNG",dastan:"KAZ",valens:"CAN",zakk:"BRA",Swani:"GER",sidde:"BRA",
  kennyS:"FRA","NBK-":"FRA",Happy:"FRA",apEX_envy:"FRA",kioShiMa:"FRA",
  tarik:"USA",autimatic:"USA",RUSH:"USA",Skadoodle:"USA",Stewie2K:"USA",
  RobbaN:"SWE",zonic:"DEN"};

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
  {nome:"kennyS",fp:61,en:0,tr:2,op:69,cl:55,sn:93,ut:5,rating:1.31,colocacao:"Campeao",isIGL:false},
  {nome:"NBK-",fp:57,en:0,tr:0,op:11,cl:49,sn:1,ut:3,rating:1.14,colocacao:"Campeao",isIGL:false},
  {nome:"Happy",fp:63,en:0,tr:0,op:73,cl:15,sn:28,ut:64,rating:1.14,colocacao:"Campeao",isIGL:true},
  {id:"apEX_envy",nome:"apEX",fp:56,en:0,tr:1,op:87,cl:0,sn:0,ut:4,rating:1.11,colocacao:"Campeao",isIGL:false},
  {nome:"kioShiMa",fp:45,en:0,tr:2,op:30,cl:11,sn:1,ut:5,rating:1.07,colocacao:"Campeao",isIGL:false},
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
  {nome:"molodoy",pais:"KAZ",fp:93,en:5,tr:61,op:70,cl:89,sn:96,ut:55,rating:1.27,colocacao:"Campeao",isIGL:false}
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
  {nome:"Envy",cor:"#00b4a0",coach:null,camp:"DreamHack Cluj-Napoca 2015",colocacao:"Campeao",jogadores:["kennyS","NBK-","Happy","apEX_envy","kioShiMa"]},
  {nome:"Cloud9",cor:"#00aeef",coach:"valens",camp:"ELEAGUE Major Boston 2018",colocacao:"Campeao",jogadores:["tarik","autimatic","RUSH","Skadoodle","Stewie2K"]},
  {nome:"FaZe",cor:"#e43d30",coach:"RobbaN",camp:"ESL One New York 2017",colocacao:"Campeao",jogadores:["NiKo","rain","GuardiaN","olofmeister","karrigan"]},
  {nome:"Astralis",cor:"#e2231a",coach:"zonic",camp:"IEM Katowice 2019",colocacao:"Campeao",jogadores:["device","Xyp9x","Magisk","dupreeh","gla1ve"]},
  {nome:"Immortals",cor:"#00c2a8",coach:"zakk",camp:"PGL Major Krakow 2017",colocacao:"Final",jogadores:["kNgV-","HEN1","LUCAS1","boltz","steel"]},
  {nome:"G2",cor:"#e4002b",coach:"Swani",camp:"IEM Sydney 2023",colocacao:"Top4",jogadores:["m0NESY","jks","NiKo_g2","huNter-","HooXi"]},
  {nome:"Spirit",cor:"#7d8aa0",coach:"hally",camp:"IEM Katowice 2024",colocacao:"Campeao",jogadores:["donk_kato24","sh1ro_kato24","zont1x","magixx","chopper_kato24"]},
  {nome:"FURIA",cor:"#1faa59",coach:"sidde",camp:"IEM Chengdu 2025",colocacao:"Campeao",jogadores:["FalleN_furia25","YEKINDAR","yuurih_furia25","KSCERATO_furia25","molodoy"]}
];

const CARAC_SLUG={Gestor:"gestor",Estrategista:"estrategista",Desenvolvedor:"desenvolvedor",Motivador:"motivador"};
const CARAC_COR={Gestor:"var(--c-gestor)",Estrategista:"var(--c-estrategista)",Desenvolvedor:"var(--c-desenvolvedor)",Motivador:"var(--c-motivador)"};
const ROLE_COR={IGL:"var(--r-igl)",AWPer:"var(--r-awper)",Entry:"var(--r-entry)",Rifler:"var(--r-rifler)",Lurker:"var(--r-lurker)",Support:"var(--r-support)"};

let pid=0;
const TEAMS=TIMES_DEF.map((t,i)=>{
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
    treinador:t.coach?{id:"c"+i,nick:t.coach,pais:PAISES_MAP[t.coach]||"—",time:t.nome,tipo:"coach",
      ovr:ovrTreinador(somaOVR,t.colocacao),carac,caracCor:CARAC_COR[carac],caracSlug:CARAC_SLUG[carac]}:null
  };
});

/* ——— ENGINE · helpers e configuração ————————————————— */
const rndF=()=>Math.random();
const gaussF=()=>{let u=0,v=0;while(u===0)u=rndF();while(v===0)v=rndF();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};
const logistica=(fa,fb,D)=>1/(1+Math.pow(10,(fb-fa)/D));

const CFG_SIM={D_MAPA:30,D_ROUND:78,D_PISTOL:90,AMP_MAX:12,AMP_CONSIST:.7,
  PESO_EF:.78,
  // motor de combate por jogador (validado vs CS2 real: KPR~0.67, rating~1.0, fiel HLTV)
  LADO_CT:2.2,FORMA_DIA:9,
  MOM_STEP:.05,MOM_MAX:.14,TILT_STEP:.018,TILT_MAX:.10,CLUTCH_SWING:.20,
  EXP_KILL:1.4,EXP_VITIMA:.55,BAIXAS_PERD:5.0,BAIXAS_VENC:2.0,TRADE_CHANCE:.7,
  MAPA_SCALE:380,MAPA_CAP:.06,SUB_ABRE:0.72,SUB_SURV:0.34,SUB_INT:40};

/* ——— MOTOR FALLEnANGELs · rating contextual (estilo HLTV 3.0) ——— */
// PARTE 1 — cálculo do rating a partir dos eventos reais do mapa (swing + eco + KAST + multi)
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
const CFG_FA={BASE:.345,W_EK:.74,W_SURV:.132,W_KAST:.204,W_MULTI:.042,W_SWING:.10,PESO_MORTE:.95,PESO_OPEN:.216,
  // bônus de firepower: poder de fogo bruto puxa o rating pra cima (ajuda entries de fp alto). Cosmético — não muda resultado.
  FP:{ref:62,per:.0026,min:-.04,max:.105}};
// impacto por função no kill: entry/rifler que fragga gera mais valor que support/igl (centrado ~1.0)
const FA_IMPACTO={Entry:1.07,Lurker:1.06,Rifler:1.03,AWPer:.99,Support:.93,IGL:.91}; // lurker é função de frag/clutch — pontua entre os mais altos
// rating FALLEnANGELs de um jogador a partir do seu log de eventos no mapa
function fallenAngels(ev){const C=CFG_FA,R=ev.totalRounds||1;
  const ekpr=ev.kills.reduce((s,k)=>s+faEco(k.buyMatador,k.buyVitima),0)/R; // kills eco-ajustadas
  const survPR=1-(ev.mortes.length/R);
  const kast=(ev.roundsKAST||0)/R;
  const m=ev.multi||{},multiScore=((m[2]||0)+(m[3]||0)*2.2+(m[4]||0)*4+(m[5]||0)*7)/R;
  let swing=0;
  ev.kills.forEach(k=>{if(k.roundGanho)swing+=faSwingKill(k.estadoMeu,k.estadoInim);});
  ev.mortes.forEach(mo=>{swing+=faSwingMorte(mo.estadoMeu,mo.estadoInim)*C.PESO_MORTE;});
  const openPR=((ev.opK||0)-(ev.opD||0))/R*C.PESO_OPEN;
  const fpBonus=Math.max(C.FP.min,Math.min(C.FP.max,((ev.fp??60)-C.FP.ref)*C.FP.per)); // poder de fogo bruto soma ao rating
  const rating=C.BASE+ekpr*C.W_EK*(ev.impacto??1)+survPR*C.W_SURV+kast*C.W_KAST+multiScore*C.W_MULTI+(swing/R)*C.W_SWING+openPR+fpBonus;
  return Math.max(.30,Math.min(3.0,rating));}

// PARTE 2 — forma do dia: a inspiração da noite (tier × OVR × firepower) que MOVE o combate
// curadoria de tiers (legado histórico): Lenda explode e raramente cai; Role travado e modesto
function tierDe(j){const a=j._eng||j;const nick=a.nick||j.nick;
  if(TIER_LENDA.includes(nick))return "Lenda";
  if(TIER_STAR.includes(nick))return "Star";
  const fp=a.fp??60,prim=a.primario||j.primario||"Rifler";
  if((prim==="IGL"||prim==="Support")&&fp<55)return "Role"; // IGL/support sem fp → modesto
  return "Solido";}
// perfil de distribuição por tier (piso=resistência a cair, vol=largura, teto modulado por fp)
const PERFIL_TIER={Lenda:{piso:.26,vol:.25,tetoBase:2.05,tetoFp:.65},Star:{piso:.15,vol:.25,tetoBase:1.70,tetoFp:.50},
  Solido:{piso:.07,vol:.22,tetoBase:1.45,tetoFp:.40},Role:{piso:.05,vol:.16,tetoBase:1.30,tetoFp:.20}};
// explosividade por função: teto e largura da cauda de cima próprios de cada role (AWP/entry/rifler explodem; support/IGL travados)
const PERFIL_ROLE={AWPer:{expl:1.32,teto:1.32},Rifler:{expl:1.28,teto:1.24},Entry:{expl:1.26,teto:1.16},Lurker:{expl:1.14,teto:1.16},Support:{expl:1.12,teto:1.12},IGL:{expl:1.02,teto:1.02}};
const centroOVR=ovr=>clamp(0.28+(ovr-5)*0.060,0.53,1.44); // OVR puxa o centro (média esperada)
// sorteia a forma do dia do jogador: o "humor competitivo" daquele mapa (assimétrica, com vida)
function formaDoDia(j){const a=j._eng||j;const t=tierDe(j),p=PERFIL_TIER[t];
  const centro=centroOVR(a.ovr??13)+(a._formaCamp??0); // forma de campanha: o "humor" do jogador no Major inteiro
  const fp=a.fp??60,sn=a.sn??0,cl=a.cl??45;const pr=PERFIL_ROLE[a.primario]||{expl:1,teto:1};const ovrAmp=clamp(((a.ovr??13)-13)/30,0,.38); // OVR amplifica a explosão
  const combust=clamp((fp-45)/50,0.05,1.35);        // firepower explode (cauda pra cima)
  const apoio=clamp((sn*0.3+cl*0.4)/100,0,0.4);     // awp/clutch dão empurrão menor
  const pisoExtra=clamp((sn*0.5+cl*0.3)/100,0,0.35);// awp/clutch sobem o piso (consistência)
  const piso=0.50+p.piso*((a.ovr??13)-5)/17+pisoExtra*0.3;
  const teto=(p.tetoBase+p.tetoFp*clamp((fp-50)/50,0,1.3))*(1.35+(pr.teto-1)*1.4); // teto livre, modulado pelo role
  const g=gaussF();let desvio;
  if(g>=0)desvio=g*p.vol*(0.45+(combust+apoio)*1.35)*pr.expl*(1+ovrAmp); // cauda pra cima: firepower × explosão do role × OVR
  else desvio=g*p.vol*(1-p.piso*1.1);                  // queda amortecida por tier
  let r=centro+desvio;
  if(r<piso)r=piso-(piso-r)*0.35;                       // piso resistente, não parede
  return clamp(r,0.30,teto);}

// forma de CAMPANHA: sorteada uma vez no início do Major, vale os 9 mapas da run.
// um componente coletivo (o time "clica" ou não no evento) + um individual por tier
// (lenda balança mais — é ela que ganha ou perde o campeonato). zero-média: não desloca
// o rating global, só faz CADA run ser diferente (o motor de variância do roguelike).
const CFG_CAMP={AMP_TIME:0.14,AMP_JOG:{Lenda:0.20,Star:0.18,Solido:0.16,Role:0.15}};
function sortearFormaCampanha(times){
  times.forEach(t=>{
    const seedTime=gaussF()*CFG_CAMP.AMP_TIME;
    const lista=t.jogadores||(t.time&&t.time.jogadores)||[];
    lista.filter(Boolean).forEach(p=>{const a=p._eng||p;
      a._formaCamp=seedTime+gaussF()*CFG_CAMP.AMP_JOG[tierDe(a)];});
  });
}

/* ——— ENGINE DE SIMULAÇÃO · mapa round a round —————— */
// skill de combate ancorado no OVR (veredito dos Motores A/B/C), com textura leve por função.
// fraggers convertem OVR em duelo quase cheio; support/IGL um pouco menos no tiroteio direto.
const CONV_FUNC={Rifler:1.0,AWPer:1.0,Entry:.98,Lurker:.97,Support:.92,IGL:.90};
function skillDuelo(j){const a=j._eng||j;const ovr=j.ovr??a.ovr??13;const prim=j.primario||a.primario||"Rifler";
  return (12+(ovr-5)*4.6)*(CONV_FUNC[prim]??.95);}

// prepara um time pro combate: skills (com forma da noite), clutch e acumulador de stats
// agressão de playstyle derivada do sub-arquétipo: quão na frente o jogador joga o round
// (abre duelos e se expõe) vs quão posicional/clutcher ele é. Escala pela definição do arquétipo.
const AGR_SUB={Agressivo:1,Posicional:-1,Fogo:.6,Conector:-.5,Abertura:1,Trade:-.9,Playmaker:1,Clutcher:-1,Apoio:.4,Utilitario:-.5};
function subAgr(j){const a=j._eng||j,sb=a.sub;if(!sb)return 0;
  const inten=Math.max(.35,Math.min(1,Math.abs(sb.eixo||0)/CFG_SIM.SUB_INT));return (AGR_SUB[sb.nome]||0)*inten;}
function prepTime(t,mapa){
  const C=CFG_SIM;
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
    // skill de combate = OVR × forma da noite × afinidade de mapa (modulação leve, ±MAPA_CAP)
    skills:js.map((j,i)=>skillDuelo(j)*Math.pow(formas[i],1.0)*mapMult(j,mapa)),cls:js.map(j=>j.cl||40),agr:js.map(j=>subAgr(j)),
    stats:js.map(j=>({nick:j.nick||t.nome,impacto:FA_IMPACTO[j.primario]??1,fp:j.fp??60,k:0,d:0,a:0,
      fa:{kills:[],mortes:[],assists:0,roundsKAST:0,multi:{},opK:0,opD:0},_kRound:0,_contribRound:false}))};
}
// resolve o combate de um round respeitando conservação (cada kill = uma morte)
// emite contexto por kill (estado XvX, buys, opening) pro FALLEnANGELs; ctx={buyVenc,buyPerd}
function combateRound(venc,perd,ctx){
  const C=CFG_SIM;let vV=[0,1,2,3,4],vP=[0,1,2,3,4];
  const killsRound=[0,0,0,0,0]; // kills do vencedor SÓ neste round
  const pk=(t,i)=>Math.pow(Math.max(t.skills[i],8),C.EXP_KILL);   // peso de quem mata (ligado a skill)
  const pv=(t,i)=>Math.pow(Math.max(t.skills[i],8),C.EXP_VITIMA); // peso de quem morre (mais plano)
  const baixasP=Math.round(clamp(C.BAIXAS_PERD+gaussF()*.6,3,5));
  const baixasV=Math.round(clamp(C.BAIXAS_VENC+gaussF()*1.0,0,4));
  const pick=(arr,fn)=>{const ps=arr.map(fn),tot=ps.reduce((a,b)=>a+b,0);let r=rndF()*tot;
    for(let i=0;i<arr.length;i++)if((r-=ps[i])<0)return arr[i];return arr[arr.length-1];};
  const bV=ctx?ctx.buyVenc:"full",bP=ctx?ctx.buyPerd:"full";
  let mortosP=0,mortosV=0,g=0,primeiraKill=true;
  while(vP.length>0&&mortosP<baixasP&&g++<25){
    // sub-arquétipo molda o round: agressivo abre o duelo (e se expõe); posicional/clutcher sobrevive
    const mV=pick(vV,i=>pk(venc,i)*(1+(primeiraKill?C.SUB_ABRE:0)*(venc.agr[i]||0)));
    const tP=pick(vP,i=>pv(perd,i)*(1+(primeiraKill?C.SUB_ABRE:C.SUB_SURV)*(perd.agr[i]||0)));
    // estado ANTES da kill: vencedor com vV.length vivos, perdedor com vP.length
    venc.stats[mV].fa.kills.push({estadoMeu:vV.length,estadoInim:vP.length,buyMatador:bV,buyVitima:bP,roundGanho:true});
    venc.stats[mV].k++;killsRound[mV]++;venc.stats[mV]._kRound++;venc.stats[mV]._contribRound=true;
    perd.stats[tP].fa.mortes.push({estadoMeu:vP.length,estadoInim:vV.length});
    perd.stats[tP].d++;
    if(primeiraKill){venc.stats[mV].fa.opK++;perd.stats[tP].fa.opD++;primeiraKill=false;}
    vP=vP.filter(x=>x!==tP);mortosP++;
    if(mortosV<baixasV&&vV.length>1&&rndF()<C.TRADE_CHANCE){ // perdedor revida (trade)
      const matador=vP.length?vP[Math.floor(rndF()*vP.length)]:perd.skills.indexOf(Math.max(...perd.skills));
      const tV=pick(vV,i=>pv(venc,i)*(1+C.SUB_SURV*(venc.agr[i]||0)));
      // kill do perdedor: round perdido pra ele → swing não conta (roundGanho:false)
      perd.stats[matador].fa.kills.push({estadoMeu:vP.length,estadoInim:vV.length,buyMatador:bP,buyVitima:bV,roundGanho:false});
      perd.stats[matador].k++;perd.stats[matador]._contribRound=true;
      venc.stats[tV].fa.mortes.push({estadoMeu:vV.length,estadoInim:vP.length});
      venc.stats[tV].d++;vV=vV.filter(x=>x!==tV);mortosV++;}
  }
  if(rndF()<.45){const ai=vV[Math.floor(rndF()*vV.length)];if(ai!=null){venc.stats[ai].a++;venc.stats[ai].fa.assists++;venc.stats[ai]._contribRound=true;}}
  // multi-kills + KAST do round, pra ambos os times
  [venc,perd].forEach((t,lado)=>{t.stats.forEach((s,i)=>{
    const kr=s._kRound||0;if(kr>=2)s.fa.multi[kr]=(s.fa.multi[kr]||0)+1;
    const vivo=(lado===0&&vV.includes(i)); // sobreviveu (só o vencedor tem vivos garantidos)
    if(s._contribRound||vivo)s.fa.roundsKAST++;
    s._kRound=0;s._contribRound=false;});});
  // destaque factual: quem do vencedor mais matou neste round (nick, pra pulsar a linha)
  let mvp=0;for(let i=1;i<5;i++)if(killsRound[i]>killsRound[mvp])mvp=i;
  return {sobreviventes:vV.length,destaque:venc.stats[mvp].nick};
}

// força do dia: oscila inverso à química (coeso=consistente, caótico=imprevisível)
function forcaDoDia(efetiva,quimica){
  const consist=clamp((quimica-.50)/(1.20-.50),0,1);
  const amp=CFG_SIM.AMP_MAX*(1-consist*CFG_SIM.AMP_CONSIST);
  return efetiva+(rndF()*2-1)*amp;
}
const BUY={pistol:.5,eco:.30,force:.62,full:1.0};
const decidirBuy=(m,pist)=>pist?"pistol":m>=4500?"full":m>=2200?(rndF()<.5?"force":"eco"):"eco";
const premio=(v,buy,ls)=>v?3250+(buy==="eco"?1000:500):[1400,1900,2400,2900,3400][Math.min(ls,4)]+(buy==="eco"?900:0);
// ——— identidade de mapa: cada mapa recompensa atributos diferentes (modula, não determina) ———
// peso por atributo (soma ~1). a afinidade é medida CONTRA a média do próprio jogador em todos os
// mapas, então lenda equilibrada varia quase nada (boa em tudo); só o especialista sente o mapa.
const MAPA_PERFIL={
  Mirage:{fp:.34,op:.30,tr:.18,ut:.18},   Inferno:{ut:.34,tr:.28,en:.20,cl:.18},
  Nuke:{sn:.30,cl:.26,ut:.24,tr:.20},     Ancient:{cl:.30,op:.26,ut:.24,tr:.20},
  Anubis:{fp:.30,cl:.26,op:.26,ut:.18},   Dust2:{fp:.34,sn:.30,op:.26,en:.10},
  Train:{sn:.30,ut:.30,cl:.22,tr:.18},    Overpass:{ut:.30,cl:.26,tr:.24,op:.20}};
const mapScore=(a,perfil)=>{let s=0;for(const k in perfil)s+=(a[k]??0)*perfil[k];return s;};
// multiplicador de combate por mapa: 1 ± pouco. auto-centrado (média dos mults do jogador ≈ 1).
function mapMult(j,mapa){const a=j._eng||j;const perfil=MAPA_PERFIL[mapa];if(!perfil)return 1;
  if(a._mapBase===undefined){let s=0,n=0;for(const m in MAPA_PERFIL){s+=mapScore(a,MAPA_PERFIL[m]);n++;}a._mapBase=s/n;}
  const fit=mapScore(a,perfil)-a._mapBase; // >0 mapa favorece o perfil dele, <0 desfavorece
  return clamp(1+fit/CFG_SIM.MAPA_SCALE,1-CFG_SIM.MAPA_CAP,1+CFG_SIM.MAPA_CAP);}
const MAPAS_POOL=["Mirage","Inferno","Nuke","Ancient","Anubis","Dust2","Train","Overpass"];

// simula um mapa completo round a round; retorna placar, vencedor, timeline e stats por jogador
function simularMapa(A,B,fA,fB,mapaForcado){
  const C=CFG_SIM;
  const mapa=mapaForcado||MAPAS_POOL[Math.floor(rndF()*MAPAS_POOL.length)]; // mapa decidido ANTES (modula o combate)
  const a=prepTime(A,mapa),b=prepTime(B,mapa);
  const formaDiaA=gaussF()*C.FORMA_DIA,formaDiaB=gaussF()*C.FORMA_DIA;
  let pa=0,pb=0,mA=800,mB=800,lsA=0,lsB=0,r=0;
  let sA=0,sB=0; // sequências de vitória (momentum)
  const rounds=[];
  const ladoDe=(time,round)=>{const aCT=round<13;const ehA=time===A;return (ehA===aCT)?"CT":"TR";};
  const mediaSkill=t=>t.skills.reduce((s,v)=>s+v,0)/5;
  let half1=null;
  // CS2 (MR12): vence quem chega a 13 na regulação. Se empatar 12-12, vai pra
  // prorrogação e vence o primeiro a 16 (pode terminar 16-12 .. 16-15).
  const fim=()=>{const ot=pa>=12&&pb>=12; return ot?(pa>=16||pb>=16):(pa>=13||pb>=13);};
  while(!fim()){
    r++;
    if(r===13){half1=[pa,pb];lsA=0;lsB=0;sA=0;sB=0;mA=800;mB=800;} // reset economia/momentum no 2º tempo
    const pistol=(r===1||r===13);
    if(pistol){mA=800;mB=800;}
    const buyA=decidirBuy(mA,pistol),buyB=decidirBuy(mB,pistol);
    // força do round por time = média de skill × economia × lado × momentum − tilt + forma do dia
    const momA=clamp(sA*C.MOM_STEP,0,C.MOM_MAX),momB=clamp(sB*C.MOM_STEP,0,C.MOM_MAX);
    const tiltA=clamp((lsA-2)*C.TILT_STEP,0,C.TILT_MAX),tiltB=clamp((lsB-2)*C.TILT_STEP,0,C.TILT_MAX);
    const ladoBonusA=ladoDe(A,r)==="CT"?C.LADO_CT:0,ladoBonusB=ladoDe(B,r)==="CT"?C.LADO_CT:0;
    // base do round = mix de skill bruto individual e força efetiva do time (carrega química+treinador)
    const baseA=mediaSkill(a)*(1-C.PESO_EF)+(fA||mediaSkill(a))*C.PESO_EF;
    const baseB=mediaSkill(b)*(1-C.PESO_EF)+(fB||mediaSkill(b))*C.PESO_EF;
    const fRA=(baseA+ladoBonusA+formaDiaA)*(0.55+0.45*BUY[buyA])*(1+momA-tiltA);
    const fRB=(baseB+ladoBonusB+formaDiaB)*(0.55+0.45*BUY[buyB])*(1+momB-tiltB);
    let p=logistica(fRA,fRB,pistol?C.D_PISTOL:C.D_ROUND);
    const apertado=p>.38&&p<.62;
    // round apertado pode virar pelo melhor clutcher individual (vida própria)
    if(apertado)p=clamp(p+(Math.max(...a.cls)-Math.max(...b.cls))/100*C.CLUTCH_SWING,.05,.95);
    const venceA=rndF()<p;
    const venc=venceA?a:b,perd=venceA?b:a;
    const res=combateRound(venc,perd,{buyVenc:venceA?buyA:buyB,buyPerd:venceA?buyB:buyA}); // + contexto FA
    if(venceA){pa++;lsA=0;lsB++;sA++;sB=0;mA+=premio(true,buyA,0);mB+=premio(false,buyB,lsB);}
    else{pb++;lsB=0;lsA++;sB++;sA=0;mB+=premio(true,buyB,0);mA+=premio(false,buyA,lsA);}
    mA=Math.min(16000,mA);mB=Math.min(16000,mB);
    // snapshot do K-D acumulado dos 10 jogadores até este round (pro scoreboard ao vivo animar)
    const snapA=a.stats.map(s=>({k:s.k,d:s.d})),snapB=b.stats.map(s=>({k:s.k,d:s.d}));
    rounds.push({r,pa,pb,venceA,ladoA:ladoDe(A,r),ladoB:ladoDe(B,r),troca:(r===13),
      destaque:res.destaque,snapA,snapB});
  }
  // rating FALLEnANGELs por jogador (contextual: swing, eco, KAST, multi-kills)
  const totalR=pa+pb;
  const rate=stats=>stats.map(s=>{
    const rating=fallenAngels({...s.fa,totalRounds:totalR,impacto:s.impacto,fp:s.fp});
    return {nick:s.nick,k:s.k,d:s.d,a:s.a,rating:+rating.toFixed(2)};});
  return {placar:[pa,pb],vencedorNome:pa>pb?A.nome:B.nome,vencedor:pa>pb?A:B,rounds,
    half1,mapa,
    nomeA:A.nome,nomeB:B.nome,meuA:!!A.meu,meuB:!!B.meu,corA:A.cor,corB:B.cor,
    statsA:rate(a.stats),statsB:rate(b.stats),totalRounds:totalR};
}

/* ——— ENGINE · série best-of (MD1/MD3) —————————————— */
// série best-of (MD1 na suíça, MD3 nos playoffs); usa força do dia a cada mapa
function simularSerie(A,B,fdA,fdB,md){
  const need=Math.ceil(md/2);let wa=0,wb=0;const mapas=[];
  while(wa<need&&wb<need){
    const g=simularMapa(A,B,fdA(),fdB());
    mapas.push(g);g.vencedor===A?wa++:wb++; // por referência: robusto a times homônimos
  }
  return {vencedor:wa>wb?A:B,vencedorNome:wa>wb?A.nome:B.nome,placarSerie:[wa,wb],mapas};
}

const SPIN_MS=4000;
const WIN_INDEX=44;
const rnd=n=>Math.floor(Math.random()*n);
const pick=a=>a[rnd(a.length)];
const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const tierOf=o=>o>=22?"tier-h":o>=21?"tier-s":o>=18?"tier-1":o>=15?"tier-2":"tier-3";

/* ——— ÁUDIO · Web Audio sintetizado ————————————————— */
const Audio={ctx:null,mudo:false,
  init(){if(!this.ctx){try{this.ctx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}}
    if(this.ctx&&this.ctx.state==="suspended")this.ctx.resume();
    // iOS só libera o áudio se um som tocar DENTRO do gesto do usuário — buffer mudo de 1 amostra
    if(this.ctx&&!this._unlocked){try{const s=this.ctx.createBufferSource();s.buffer=this.ctx.createBuffer(1,1,22050);s.connect(this.ctx.destination);s.start(0);}catch(e){}this._unlocked=true;}},
  // tom curto e brilhante (moeda/crédito)
  _blip(f,t,vol=.1,dur=.08,type="square"){const ctx=this.ctx,o=ctx.createOscillator(),g=ctx.createGain();
    o.type=type;o.frequency.value=f;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g).connect(ctx.destination);o.start(t);o.stop(t+dur+.02);},
  // sino de cassino: parciais inarmônicas com cauda longa
  _bell(t,base,vol=.12){const ctx=this.ctx;[[1,1],[2.01,.5],[2.99,.32],[4.18,.2]].forEach(([m,a])=>{
    const o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";o.frequency.value=base*m;
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol*a,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+.9);
    o.connect(g).connect(ctx.destination);o.start(t);o.stop(t+.95);});},
  // cascata de moedas caindo: pings rápidos descendentes
  _coins(t,n=10,vol=.07){for(let i=0;i<n;i++){const f=2600-i*120+(Math.random()*200-100);
    this._blip(f,t+i*.045+Math.random()*.012,vol,.06,"triangle");}},
  // ka-CHUNK mecânico: reel travando (thunk grave + estalo do mecanismo)
  _clunk(t,vol=.13){const ctx=this.ctx;
    const o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";
    o.frequency.setValueAtTime(118,t);o.frequency.exponentialRampToValueAtTime(46,t+.10);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+.14);
    o.connect(g).connect(ctx.destination);o.start(t);o.stop(t+.16);
    const src=ctx.createBufferSource();src.buffer=this._nz();const lp=ctx.createBiquadFilter();lp.type="lowpass";lp.frequency.value=1300;
    const ng=ctx.createGain();ng.gain.setValueAtTime(vol*.85,t);ng.gain.exponentialRampToValueAtTime(.0001,t+.05);
    src.connect(lp).connect(ng).connect(ctx.destination);src.start(t);src.stop(t+.06);},
  // clink metálico: moeda batendo na bandeja (ruído por band-pass ressonante + parcial agudo)
  _clink(t,vol=.05,pitch=1){const ctx=this.ctx;
    const src=ctx.createBufferSource();src.buffer=this._nz();const bp=ctx.createBiquadFilter();bp.type="bandpass";bp.frequency.value=3100*pitch;bp.Q.value=7;
    const g=ctx.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+.05);
    src.connect(bp).connect(g).connect(ctx.destination);src.start(t);src.stop(t+.06);
    const o=ctx.createOscillator(),og=ctx.createGain();o.type="triangle";o.frequency.value=3500*pitch;
    og.gain.setValueAtTime(vol*.6,t);og.gain.exponentialRampToValueAtTime(.0001,t+.035);
    o.connect(og).connect(ctx.destination);o.start(t);o.stop(t+.05);},
  // bandeja de moedas: chuva metálica irregular que rareia (a parte viciante)
  _coinTray(t,n=26,vol=.05){let dt=0;for(let i=0;i<n;i++){const prog=i/n;
    this._clink(t+dt,vol*(0.55+Math.random()*0.6)*(1-prog*0.4),0.8+Math.random()*0.75);
    dt+=(.026+prog*.04)*(0.6+Math.random()*0.9);}},
  // sino metálico de slot antigo (parciais inarmônicas = clang)
  _bellMetal(t,vol=.1){const ctx=this.ctx;[[1,1],[2.76,.55],[5.4,.28],[8.9,.13]].forEach(([m,a])=>{
    const o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";o.frequency.value=640*m;
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol*a,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+.6);
    o.connect(g).connect(ctx.destination);o.start(t);o.stop(t+.65);});},
  // tick da roleta: click seco de reel + brilho metálico (bola/cilindro de cassino)
  _nz(){if(!this._noise){const ctx=this.ctx,len=Math.floor(ctx.sampleRate*.03);const b=ctx.createBuffer(1,len,ctx.sampleRate);const d=b.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3);this._noise=b;}return this._noise;},
  tick(pitch=1){if(this.mudo||!this.ctx)return;const ctx=this.ctx,t=ctx.currentTime;
    const src=ctx.createBufferSource();src.buffer=this._nz();
    const bp=ctx.createBiquadFilter();bp.type="bandpass";bp.frequency.value=1700+1700*pitch;bp.Q.value=1.4;
    const g=ctx.createGain();g.gain.setValueAtTime(.42,t);g.gain.exponentialRampToValueAtTime(.0001,t+.022);
    src.connect(bp).connect(g).connect(ctx.destination);src.start(t);src.stop(t+.03);
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
      o.connect(g).connect(this.ctx.destination);o.start(t+i*.16);o.stop(t+i*.16+.55);});},
  // round vencido: blip de moeda (meu=agudo brilhante, adversário=grave seco)
  // ponto marcado: pip macio e curto (sine), claro p/ meu, surdo p/ adversário — não cansa repetindo
  roundWin(meu){if(this.mudo||!this.ctx)return;const ctx=this.ctx,t=ctx.currentTime;
    const f=meu?720:380;const o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";
    o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*1.5,t+.04);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(meu?.05:.038,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+.12);
    o.connect(g).connect(ctx.destination);o.start(t);o.stop(t+.14);},
  // momento-chave: tensão de cassino (reels travando num grande prêmio)
  // destaque: realce macio (swell curto de triangle), sem buzz
  impacto(meu){if(this.mudo||!this.ctx)return;const ctx=this.ctx,t=ctx.currentTime;
    const o=ctx.createOscillator(),g=ctx.createGain();o.type="triangle";
    o.frequency.setValueAtTime(330,t);o.frequency.exponentialRampToValueAtTime(495,t+.12);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.06,t+.05);g.gain.exponentialRampToValueAtTime(.0001,t+.28);
    o.connect(g).connect(ctx.destination);o.start(t);o.stop(t+.3);},
  // fim de jogo: vitória = mini-jackpot (sinos+moedas); derrota = descida menor
  fimJogo(venci){if(this.mudo||!this.ctx)return;const t=this.ctx.currentTime;
    if(venci){[659,784,1047].forEach((f,i)=>this._bell(t+i*.1,f,.11));this._coins(t+.2,8,.06);}
    else [440,370,294].forEach((f,i)=>{const o=this.ctx.createOscillator(),g=this.ctx.createGain();
      o.type="triangle";o.frequency.value=f;const d=t+i*.14;g.gain.setValueAtTime(.0001,d);g.gain.exponentialRampToValueAtTime(.1,d+.03);g.gain.exponentialRampToValueAtTime(.0001,d+.5);
      o.connect(g).connect(this.ctx.destination);o.start(d);o.stop(d+.55);});}};

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

const teamCardHTML=(t,extra="")=>`<div class="tcard ${extra}" data-team="${esc(t.id)}" style="--col:${esc(t.cor)}">
  <div class="tcoloc">${esc(t.coloc)}</div><div class="tname">${esc(t.nome)}</div><div class="tcamp">${esc(t.camp)}</div></div>`;

const cardClass=p=>p.tipo==="coach"?"coachcard coach-"+p.caracSlug:"card "+tierOf(p.ovr);

const playerHTML=p=>`<div class="cmeta"><span>${esc(p.pais)}</span><span>${esc(p.time)}</span></div>
  <div class="ccore"><div class="ovr">${p.ovr}</div><div class="nick">${esc(p.nick)}</div><div class="starsig">${p.estrela?"STAR ★ PLAYER":""}</div></div>
  <div class="roles"><span class="role prim" style="--rc:${ROLE_COR[p.prim]}">${esc(p.prim)}</span><span class="role sec">${esc(p.sec)}</span></div>`;

const coachHTML=p=>`<div class="banner">Treinador</div>
  <div class="cmeta"><span>${esc(p.pais)}</span><span>${esc(p.time)}</span></div>
  <div class="ccore"><div class="ovr">${p.ovr}</div><div class="nick">${esc(p.nick)}</div></div>
  <div class="carac">${esc(p.carac)}</div>`;

const cardHTML=p=>p.tipo==="coach"?coachHTML(p):playerHTML(p);

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
  // usa os objetos do motor (_eng) p/ química real
  const eng=S.jogadores.map(j=>j._eng);
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

function pararAnimacao(){
  spinSession++;
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
    track.style.transition=`transform ${SPIN_MS}ms cubic-bezier(.10,.78,.12,1)`;
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
    setTimeout(()=>{if(sessao===spinSession)revelarTime(timeConfirmado,WIN_INDEX);},640);
  };

  const aoFim=e=>{
    if(e.target!==track||e.propertyName!=="transform")return;
    finalizar();
  };

  track.addEventListener("transitionend",aoFim);
  const fallback=setTimeout(finalizar,SPIN_MS+350);
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
}

function renderPicks(){
  if(!S.drawn){
    picksEl.innerHTML="";
    picksTag.hidden=true;
    picksNote.hidden=true;
    winnerPill.textContent="";
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

document.addEventListener("click",e=>{
  if(e.target.closest("#mutebtn,#rollbtn,#respinbtn,#resetbtn"))return; // botões têm handler próprio
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
  const js=cartas.map(p=>p._eng);
  const r=forcaTime(js,S.treinador?.carac||null,S.treinador?.ovr||null);
  return {time:{nome:"SEU TIME",cor:"#39d3ff",jogadores:cartas},nome:"SEU TIME",cor:"#39d3ff",camp:"",
    ef:r.efetiva,quim:r.quimica,v:0,d:0,vivo:true,hist:[],meu:true};
}
function iniciarTorneio(){
  const base=TEAMS.slice(0,15).map(t=>{const r=efT(t);
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
  Object.values(buckets).forEach(g=>{const a=[...g].sort(()=>rndF()-.5);
    for(let i=0;i<a.length-1;i+=2){const par=[a[i],a[i+1]];
      if(a[i].meu||a[i+1].meu)parDoJogador=par;else pares.push(par);}
    if(a.length%2)a[a.length-1]._bye=true;
  });
  // resolve os outros jogos (rápido, no fundo)
  const resolverPar=([x,y])=>{
    const xV=rndF()<logistica(forcaDoDia(x.ef,x.quim),forcaDoDia(y.ef,y.quim),CFG_SIM.D_MAPA);
    const vc=xV?x:y,pd=xV?y:x;vc.v++;pd.d++;vc.hist.push("V");pd.hist.push("D");
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
    const ctx=`Rodada ${TG.rodada} · Fase Suíça · você está ${meu.v}-${meu.d}`;
    fechar("suicaOverlay");
    abrirPartida(meu,adv,1,ctx,(venc)=>{
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
  const jogar=(a,b)=>{const r=simularSerie(a.time,b.time,fd(a),fd(b),3);r.vencedorSeed=r.vencedor===a.time?a:b;return r;};
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
const RITMO={base:260,preMomento:360,pausaMomento:1600,pausaForte:2200,troca:1000,inicio:500};
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
["pointerdown","touchend","keydown"].forEach(ev=>document.addEventListener(ev,()=>Audio.init(),{once:true,passive:true}));

idleTrack();
renderLineup();
renderPicks();
updateSpinUI();
