/* SINAPSE — química de elenco e força efetiva.
   ══════════════════════════════════════════════════════════════════════════════
   Lê as funções e OVRs do PRISMA+ZÊNITE e mede como o time se LIGA: cobertura de
   pilares, saturação, egos e o efeito do treinador.

   Cópia de migração de game.js enquanto ele for a fonte executável; a paridade é
   provada por tools/check-team-chemistry-parity.js sobre os 17 elencos.

   TRÊS COISAS QUE SÃO CONTRATO:

   1. NÃO existe bônus aditivo. Um time perfeito chega a 100% por não ter
      penalidade nenhuma, nunca por acumular prêmios. Toda característica de
      treinador é MITIGADORA: recupera rumo a 100%, jamais acima.
   2. Comando é estrutural e vive FORA da resistência de talento: firepower alto
      recupera química ruim até um teto, mas não compra um caller.
   3. `quimicaPlaystyles` é chamada DENTRO de `quimicaComposicao`, e a ordem em
      que os alertas entram no array é observável na interface. */

import {styleId,styleTraits} from "../evaluation/style-identity.mjs";

export const CFG_PADRAO={
  TREINADOR_PLACAR:{Campeao:16,Final:14,Top4:13,Top8:12,Grupos:10},
  TREINADOR_STR:.14,
  TREINADOR_MIN:10,TREINADOR_MAX:20,IGL_FRACO_OVR:13,ESTRELA_LIMITE:2,
  TREINADOR_FORCA:{neutro:15,porPonto:.025},
  PEN:{semIGL:.25,iglFraco:.10,semAWP:.20,semAncora:.11,semIniciativa:.12,estrelaExtra:.07},
  QUIMICA_MIN:.50,QUIMICA_MAX:1.00,
  TALENTO:{refBruta:82,divisor:22,recMax:.45,teto:1.00},
  IDEAL:{IGL:1,AWPer:1,Lurker:1,Support:2,Entry:2,Rifler:3},
  DUREZA:{IGL:.08,AWPer:.07,Lurker:.04,Support:.04,Entry:.03,Rifler:.03},
  SAT_LEVE:.05,SEC_NOMINAL_PESO:.5,RIFLER_VERSATIL_ALIVIO:.5,
  FUNC_EGO:["Entry","Rifler","AWPer","Lurker"],
  RIFLER_INICIATIVA:.5,
  CARAC:{Gestor:{tetoEstrelasBonus:1,estrelaExtraPen:.04},
    Desenvolvedor:{cruRef:14,cruPorJogador:.05,cruTeto:.18},
    Estrategista:{corteEstrutura:.15,corteComando:.30},
    Motivador:{cortePenalidade:.30}},
  DERIVA:{SOMA_ESPERADA:{Campeao:85,Final:80,Top4:74,Top8:66,Grupos:56},
    DESENV_RESULTADO_MIN:["Campeao","Final","Top4"],LIMIAR:.3}
};

const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
/** Arredonda com viés: fracionário ≥.6 sobe, ≤.5 desce. */
const arred=x=>Math.floor(x+0.4);

/** OVR do treinador: o que o time conquistou + prestígio por liderar elenco
    acima do típico daquela conquista (nunca pune time fraco). */
export function ovrTreinador(somaOVR,colocacao,cfg=CFG_PADRAO){
  const base=cfg.TREINADOR_PLACAR[colocacao]??cfg.TREINADOR_MIN;
  const tip=cfg.DERIVA.SOMA_ESPERADA[colocacao]??70;
  const prestigio=cfg.TREINADOR_STR*Math.max(0,somaOVR-tip);
  return clamp(Math.round(base+prestigio),cfg.TREINADOR_MIN,cfg.TREINADOR_MAX);
}

/** Sinergias e conflitos entre playstyles do elenco. */
export function quimicaPlaystyles(jogadores,caracTreinador=null){
  const qtd={};jogadores.map(j=>styleId(j.playstyle)).forEach(e=>{qtd[e]=(qtd[e]||0)+1;});
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
  if(temCoringa&&qtd.aggressive){const b=.02;quimica+=b;sinergias++;alertas.push(`Coringa + Opener +${Math.round(b*100)}%`);}
  if(temCoringa&&qtd.cerebral){const b=.03;quimica+=b;sinergias++;alertas.push(`Coringa + Cerebral +${Math.round(b*100)}%`);}

  const avgPace=jogadores.reduce((s,j)=>s+(styleTraits(j.playstyle).pace||0),0)/Math.max(1,jogadores.length);
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

/** Cobertura de pilares, saturação e egos. Devolve química com e sem comando. */
export function quimicaComposicao(jogadores,caracTreinador=null,cfg=CFG_PADRAO){
  const C=cfg,car=caracTreinador?(C.CARAC[caracTreinador]??{}):{},alertas=[];
  // IGLs acumulam DUAS funções (IGL + role 2). A cobertura considera a role 2 de
  // TODOS os IGLs; o de maior OVR lidera. Assim independe da ordem dos slots.
  const igls=jogadores.filter(j=>j.primario==="IGL");
  const melhorIgl=igls.reduce((b,j)=>(!b||j.ovr>b.ovr)?j:b,null);
  const temPrim=fn=>jogadores.some(j=>j.primario===fn)||igls.some(j=>j.secundario===fn);
  const nSec=fn=>jogadores.filter(j=>j.secundario===fn&&j.primario!==fn)
    .reduce((s,j)=>s+(j.secForte?1:C.SEC_NOMINAL_PESO),0);
  const nSecRaw=fn=>jogadores.filter(j=>j.secundario===fn&&j.primario!==fn).length;

  const crus=car.cruRef!=null?jogadores.filter(j=>j.ovr<=car.cruRef).length:0;
  let corteFrac=car.cortePenalidade||0;
  if(car.corteEstrutura)corteFrac=Math.max(corteFrac,car.corteEstrutura);
  if(car.cruPorJogador&&crus>0)corteFrac=Math.max(corteFrac,Math.min(car.cruTeto,crus*car.cruPorJogador));
  const corte=1-corteFrac;
  const corteIGL=car.corteComando?(1-car.corteComando):1;

  let mult=1;
  // pilar com 3 estados: primário | 2+ com a função 2 (dupla cobertura) | parcial | ausente
  const pilar=(nome,pen,temP,secs,secsRaw)=>{
    if(temP){alertas.push(`${nome}`);return;}
    if(secsRaw>=2){alertas.push(`${nome} (dupla cobertura)`);return;}
    if(secs>0){const p=pen*Math.pow(0.5,secs)*corte;mult*=(1-p);alertas.push(`${nome} secundária −${Math.round(p*100)}%`);return;}
    mult*=(1-pen*corte);alertas.push(`${nome} falta −${Math.round(pen*corte*100)}%`);
  };

  const isIglFraco=melhorIgl&&melhorIgl.ovr<C.IGL_FRACO_OVR;
  let penCmd=1;  // comando é estrutural: aplicado FORA da resistência de talento
  if(!melhorIgl){penCmd=1-C.PEN.semIGL*corteIGL;alertas.push(`Comando falta −${Math.round(C.PEN.semIGL*corteIGL*100)}%`);}
  else if(isIglFraco){penCmd=1-C.PEN.iglFraco*corteIGL;alertas.push(`Comando fraco −${Math.round(C.PEN.iglFraco*corteIGL*100)}%`);}
  else alertas.push("Comando");

  pilar("AWP",C.PEN.semAWP,temPrim("AWPer"),nSec("AWPer"),nSecRaw("AWPer"));
  pilar("Âncora",C.PEN.semAncora,temPrim("Lurker")||temPrim("Support"),
    nSec("Lurker")+nSec("Support"),nSecRaw("Lurker")+nSecRaw("Support"));
  // Iniciativa: Entry abre o round (completo); Rifler é fogo sem abertura (parcial)
  if(temPrim("Entry")){alertas.push("Iniciativa");}
  else if(nSecRaw("Entry")>=2){alertas.push("Iniciativa (dupla cobertura)");}
  else if(temPrim("Rifler")){
    const eSec=nSec("Entry");
    const fator=eSec>0?C.RIFLER_INICIATIVA*Math.pow(0.5,eSec):C.RIFLER_INICIATIVA;
    const p=C.PEN.semIniciativa*fator*corte;mult*=(1-p);
    alertas.push(`Iniciativa ${eSec>0?"parcial":"limitada"} −${Math.round(p*100)}%`);
  }
  else pilar("Iniciativa",C.PEN.semIniciativa,false,nSec("Entry")+nSec("Rifler"),nSecRaw("Entry")+nSecRaw("Rifler"));

  let satTotal=0;
  ["IGL","AWPer","Lurker","Support","Entry","Rifler"].forEach(fn=>{
    let n=jogadores.filter(j=>j.primario===fn).length+igls.filter(j=>j.secundario===fn).length;
    if(fn==="Rifler"){
      const vers=jogadores.filter(j=>j.primario==="Rifler"&&["Entry","Lurker","Support"].includes(j.secundario)).length;
      n-=vers*C.RIFLER_VERSATIL_ALIVIO;
    }
    const excesso=Math.max(0,n-C.IDEAL[fn]);
    if(excesso>0){const p=excesso*C.DUREZA[fn]*corte;satTotal+=p;mult*=(1-p);
      alertas.push(`${n}× ${fn} −${Math.round(p*100)}%`);}
  });

  // só funções de holofote geram atrito de ego (IGL/Support servem, não disputam)
  const nEstrelasEgo=jogadores.filter(j=>j.estrela&&C.FUNC_EGO.includes(j.primario)).length;
  const limiteEstrelas=C.ESTRELA_LIMITE+(car.tetoEstrelasBonus||0);
  const extras=Math.max(0,nEstrelasEgo-limiteEstrelas);
  if(extras>0){const pe=(car.estrelaExtraPen??C.PEN.estrelaExtra)*corte;mult*=Math.pow(1-pe,extras);
    alertas.push(`Estrelas (${nEstrelasEgo}) −${Math.round(pe*extras*100)}%`);}
  else alertas.push(`Estrelas (${nEstrelasEgo})`);

  const ps=quimicaPlaystyles(jogadores,caracTreinador);
  mult*=ps.mult;
  ps.alertas.forEach(a=>alertas.push(a));

  const temPilares=melhorIgl&&melhorIgl.ovr>=C.IGL_FRACO_OVR&&temPrim("AWPer")&&
    (temPrim("Lurker")||temPrim("Support"))&&(temPrim("Entry")||temPrim("Rifler"));
  alertas.push(temPilares&&nEstrelasEgo<=limiteEstrelas&&satTotal<=C.SAT_LEVE?"Estrutura":"Estrutura falta");
  if(car.cruPorJogador&&crus>0)alertas.push(`Desenvolvimento (${crus} cru${crus>1?"s":""})`);

  const quimSemCmd=Math.max(C.QUIMICA_MIN,Math.min(C.QUIMICA_MAX,mult));
  return {quimica:+Math.max(C.QUIMICA_MIN,Math.min(C.QUIMICA_MAX,mult*penCmd)).toFixed(3),
    quimicaSemCmd:+quimSemCmd.toFixed(3),penCmd:+penCmd.toFixed(3),alertas};
}

/** Força efetiva: soma de OVR × química × fator do treinador. */
export function forcaTime(jogadores,caracTreinador=null,ovrDoTreinador=null,cfg=CFG_PADRAO){
  const C=cfg,bruta=jogadores.reduce((s,j)=>s+j.ovr,0);
  const q=quimicaComposicao(jogadores,caracTreinador,cfg);
  const tf=C.TREINADOR_FORCA;
  const fatorT=ovrDoTreinador!=null?1+(ovrDoTreinador-tf.neutro)*tf.porPonto:1;
  // Talento resiste à química ruim: firepower alto preenche parte do buraco, até
  // recMax. Nunca tudo — e comando fica de fora (não se compra um caller).
  const tal=C.TALENTO;
  const resist=clamp((bruta-tal.refBruta)/tal.divisor,0,1)*tal.recMax;
  const baseEf=Math.min(tal.teto,q.quimicaSemCmd+(1-q.quimicaSemCmd)*resist);
  const quimicaEf=+Math.max(C.QUIMICA_MIN,Math.min(C.QUIMICA_MAX,baseEf*q.penCmd)).toFixed(3);
  return {bruta,...q,quimica:quimicaEf,fatorTreinador:fatorT,
    efetiva:arred(bruta*quimicaEf*fatorT)};
}

/** Característica do treinador derivada do elenco e da conquista. */
export function derivaCaracteristica(time,POOL,cfg=CFG_PADRAO){
  const D=cfg.DERIVA,js=time.jogadores.map(n=>POOL[n]);
  const ovrs=js.map(j=>j.ovr);
  const min=Math.min(...ovrs),max=Math.max(...ovrs);
  const soma=ovrs.reduce((a,b)=>a+b,0),media=soma/js.length;
  const estrelas=js.filter(j=>j.estrela);
  const igl=js.find(j=>j.primario==="IGL");
  const temFn=fn=>js.some(j=>j.primario===fn)||(!!igl&&igl.secundario===fn);
  const pilares=!!igl&&igl.ovr>=cfg.IGL_FRACO_OVR&&temFn("AWPer")&&(temFn("Lurker")||temFn("Support"));
  const score={
    Gestor:estrelas.length>=2?Math.max(0,estrelas.reduce((s,j)=>s+(j.ovr-17),0)-3):0,
    Desenvolvedor:D.DESENV_RESULTADO_MIN.includes(time.colocacao)
      ?Math.max(0,13-min)+Math.max(0,media-min-2.5)*.5:0,
    // estrelas puxam para longe do Estrategista: caller que gerencia egos vira Motivador/Gestor
    Estrategista:(pilares?2:0)-estrelas.length*1.05-Math.max(0,(max-min)-5)*.3,
    Motivador:(D.SOMA_ESPERADA[time.colocacao]-soma)/5
  };
  const [carac,val]=Object.entries(score).sort((a,b)=>b[1]-a[1])[0];
  return val>=D.LIMIAR?carac:"Motivador";
}
