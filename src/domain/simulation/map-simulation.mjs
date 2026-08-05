/* PÓLVORA — orquestração round a round de um mapa.
   Cópia de migração de game.js; todas as dependências executáveis e tabelas
   entram pelo contrato `deps`, preservando ordem de operações e de RNG. */
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));

export function simularMapa(A,B,fA,fB,mapaForcado,leve,options,deps){
  const {cfg:C,mapasPool,mapaLado,buy,lossBonus,recompensaArma,tetoGrana,
    random,gaussian,prepTime,telemetryTeam,telemetrySchemaVersion,combatProfile,
    decidirCompra,pagarCompra,compraDoTime,logistica,combateRound,fallenAngels}=deps;
  /* Camada tática: só existe se a chave estiver ligada. Desligada, `tatica` é
     null e NENHUMA linha abaixo executa — nem uma amostra a mais do gerador,
     nem um campo a mais no round. É o que mantém o golden intacto. */
  const tatica=deps.tactics&&deps.tactics.ativa()?deps.tactics:null;
  const mapa=mapaForcado||mapasPool[Math.floor(random()*mapasPool.length)];
  const a=prepTime(A,mapa),b=prepTime(B,mapa);
  const telemetry=options&&options.telemetry?{schemaVersion:telemetrySchemaVersion,
    kind:"polvora-round-events",map:mapa,teams:{A:telemetryTeam(a),B:telemetryTeam(b)},rounds:[]}:null;
  const formaDiaA=gaussian()*C.FORMA_DIA,formaDiaB=gaussian()*C.FORMA_DIA;
  let pa=0,pb=0,lsA=0,lsB=0,r=0,sA=0,sB=0;
  const dinA=[800,800,800,800,800],dinB=[800,800,800,800,800];
  let armadoA=[false,false,false,false,false],armadoB=[false,false,false,false,false];
  const awperA=a.js.map(j=>combatProfile(j).activeCombatRole==="AWPer");
  const awperB=b.js.map(j=>combatProfile(j).activeCombatRole==="AWPer");
  const zerar=(dinheiro,valor)=>{for(let i=0;i<5;i++)dinheiro[i]=valor;};
  const creditar=(dinheiro,valor)=>{for(let i=0;i<5;i++)dinheiro[i]+=valor;};
  const rounds=[];
  const ladoDe=(time,round)=>{const ehA=time===A;
    const aCT=round<13?true:round<25?false:(Math.floor((round-25)/3)%2===0);
    return (ehA===aCT)?"CT":"TR";};
  const mediaSkill=t=>t.skills.reduce((s,v)=>s+v,0)/5;
  const baseA=mediaSkill(a)*(1-C.PESO_EF)+(fA||mediaSkill(a))*C.PESO_EF;
  const baseB=mediaSkill(b)*(1-C.PESO_EF)+(fB||mediaSkill(b))*C.PESO_EF;
  const openEdgeA=clamp((a.open-b.open)/C.OPEN_SCALE,-.12,.12);
  const pLadoMapa=(mapaLado[mapa]||0)*C.LADO_MAPA_P;
  const bonusCtA=C.LADO_CT+C.LADO_COMP*a.ctEdge,bonusTA=C.LADO_COMP*a.tEdge;
  const bonusCtB=C.LADO_CT+C.LADO_COMP*b.ctEdge,bonusTB=C.LADO_COMP*b.tEdge;
  let half1=null,compraAntA=null,compraAntB=null,venceuAntA=false,venceuAntB=false,alvo=13;
  const estadoTatico=tatica?tatica.iniciarMapa(a,b):null;
  while(pa<alvo&&pb<alvo){
    r++;
    if(r===13){half1=[pa,pb];lsA=0;lsB=0;sA=0;sB=0;zerar(dinA,800);zerar(dinB,800);
      armadoA=[false,false,false,false,false];armadoB=[false,false,false,false,false];}
    const pistol=(r===1||r===13);
    if(pistol){zerar(dinA,800);zerar(dinB,800);armadoA=[false,false,false,false,false];armadoB=[false,false,false,false,false];}
    if(r>=25&&(r-25)%3===0){zerar(dinA,10000);zerar(dinB,10000);
      armadoA=[false,false,false,false,false];armadoB=[false,false,false,false,false];lsA=0;lsB=0;}
    const planoA=decidirCompra(dinA,armadoA,pistol,lsA,awperA,{compra:compraAntB,venceu:venceuAntB},random,C),comprasA=planoA.compras;
    const planoB=decidirCompra(dinB,armadoB,pistol,lsB,awperB,{compra:compraAntA,venceu:venceuAntA},random,C),comprasB=planoB.compras;
    pagarCompra(dinA,armadoA,comprasA,planoA.extra);pagarCompra(dinB,armadoB,comprasB,planoB.extra);
    const buyA=compraDoTime(comprasA),buyB=compraDoTime(comprasB);
    const poderA=comprasA.reduce((soma,c)=>soma+buy[c],0)/5,poderB=comprasB.reduce((soma,c)=>soma+buy[c],0)/5;
    const momA=clamp(sA*C.MOM_STEP,0,C.MOM_MAX),momB=clamp(sB*C.MOM_STEP,0,C.MOM_MAX);
    const tiltA=clamp((sB-2)*C.TILT_STEP,0,C.TILT_MAX),tiltB=clamp((sA-2)*C.TILT_STEP,0,C.TILT_MAX);
    const ladoA=ladoDe(A,r),ladoB=ladoDe(B,r);
    const ladoBonusA=ladoA==="CT"?bonusCtA:bonusTA,ladoBonusB=ladoB==="CT"?bonusCtB:bonusTB;
    const fRA=(baseA+ladoBonusA+formaDiaA)*(0.42+0.58*poderA)*(1+momA-tiltA);
    const fRB=(baseB+ladoBonusB+formaDiaB)*(0.42+0.58*poderB)*(1+momB-tiltB);
    const pEdgeA=clamp(logistica(fRA,fRB,pistol?C.D_DUELO_PIST:C.D_DUELO)+(ladoA==="CT"?pLadoMapa:-pLadoMapa),.03,.97);
    const roundTrace=telemetry?{round:r,scoreBefore:[pa,pb],sides:{A:ladoA,B:ladoB},buys:{A:buyA,B:buyB}}:null;
    /* A decisão vem ANTES do combate e consome o gerador TÁTICO, nunca o do
       combate — é essa separação que deixa a sequência de duelos intacta. */
    const eco=classe=>classe==="eco"||classe==="pistol";
    const plano=tatica?tatica.planejar(estadoTatico,{ladoA,placarA:pa,placarB:pb,
      ecoA:eco(buyA),ecoB:eco(buyB),random:tatica.random}):null;
    const res=combateRound(a,b,{pEdgeA,
      openEdgeA:plano?openEdgeA+plano.ajusteOpenEdgeA:openEdgeA,
      ritmoBonus:plano?plano.ritmoBonus:0,plantBonusT:plano?plano.plantBonusT:0,
      buyA,buyB,comprasA,comprasB,aIsCT:ladoA==="CT",trace:roundTrace});
    const venceA=res.venceA;
    if(venceA){pa++;sA++;sB=0;creditar(dinA,res.premioV);creditar(dinB,lossBonus[Math.min(lsB,4)]);lsB=Math.min(lsB+1,4);lsA=Math.max(0,lsA-1);}
    else{pb++;sB++;sA=0;creditar(dinB,res.premioV);creditar(dinA,lossBonus[Math.min(lsA,4)]);lsA=Math.min(lsA+1,4);lsB=Math.max(0,lsB-1);}
    if(pa===alvo-1&&pb===alvo-1)alvo+=3;
    compraAntA=buyA;compraAntB=buyB;venceuAntA=venceA;venceuAntB=!venceA;
    if(res.plantado){const tÉA=ladoA!=="CT";if(tÉA){if(!venceA)creditar(dinA,C.PLANT_BONUS);}else if(venceA)creditar(dinB,C.PLANT_BONUS);}
    res.killsPorJogador.A.forEach((n,i)=>{dinA[i]+=n*recompensaArma[comprasA[i]];});
    res.killsPorJogador.B.forEach((n,i)=>{dinB[i]+=n*recompensaArma[comprasB[i]];});
    for(let i=0;i<5;i++){dinA[i]=Math.min(tetoGrana,dinA[i]);dinB[i]=Math.min(tetoGrana,dinB[i]);}
    const carrega=classe=>classe==="force"||classe==="full"||classe==="awp";
    armadoA=comprasA.map((classe,i)=>carrega(classe)&&res.vivosA.includes(i));
    armadoB=comprasB.map((classe,i)=>carrega(classe)&&res.vivosB.includes(i));
    const snapA=leve?null:a.stats.map(s=>({k:s.k,d:s.d})),snapB=leve?null:b.stats.map(s=>({k:s.k,d:s.d}));
    const registro={r,pa,pb,venceA,ladoA,ladoB,troca:(r===13),plantado:res.plantado,buyA,buyB,
      comprasA:[...comprasA],comprasB:[...comprasB],clutchX:res.clutchX,clutchWon:res.clutchWon,destaque:res.destaque,snapA,snapB};
    if(plano){
      // só existe com a camada ligada: desligada, o round mantém a forma antiga
      registro.tatica={direcaoA:plano.planoA.direcao,direcaoB:plano.planoB.direcao,
        ctAcertou:plano.ctAcertou,executouA:plano.planoA.executou,executouB:plano.planoB.executou,
        usouA:plano.planoA.leituraUsada,usouB:plano.planoB.leituraUsada,
        confA:plano.planoA.confianca,confB:plano.planoB.confianca};
      tatica.registrar(estadoTatico,venceA);   // cada lado observa o que o outro fez
    }
    rounds.push(registro);
    if(roundTrace){roundTrace.scoreAfter=[pa,pb];telemetry.rounds.push(roundTrace);}
  }
  const totalR=pa+pb;
  const rate=stats=>stats.map(s=>{const rating=fallenAngels({...s.fa,totalRounds:totalR,impacto:s.impacto,prim:s.prim,ovr:s.ovr,dmg:s.dmg,tradeK:s.tradeK});
    return {nick:s.nick,k:s.k,d:s.d,a:s.a,rating:+rating.toFixed(2),kast:+((s.fa.roundsKAST||0)/totalR).toFixed(3),adr:Math.round((s.dmg||0)/totalR)};});
  const result={placar:[pa,pb],vencedorNome:pa>pb?A.nome:B.nome,vencedor:pa>pb?A:B,rounds,half1,mapa,
    nomeA:A.nome,nomeB:B.nome,meuA:!!A.meu,meuB:!!B.meu,corA:A.cor,corB:B.cor,
    statsA:leve?[]:rate(a.stats),statsB:leve?[]:rate(b.stats),totalRounds:totalR};
  if(telemetry)result.telemetry=telemetry;
  return result;
}
