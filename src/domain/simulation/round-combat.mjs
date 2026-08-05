/* PÓLVORA — resolução de um round como sequência de eventos sobre o relógio.
   Configuração, RNG, médias da liga e prêmios entram explicitamente; ordem de
   operações, mutações e chamadas ao gerador são contrato de paridade. */
import {telemetryPlayerId} from "./simulation-telemetry.mjs";

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export const ASSIST_SLOTS=[[1,2,3,4],[0,2,3,4],[0,1,3,4],[0,1,2,4],[0,1,2,3]];

/** Calcula as referências zero-centradas na ordem canônica dos 85 jogadores. */
export function computeCombatMeans(players,deps){
  const {preservationValue,tradeContextProfile,assistContextProfile}=deps;
  const preservationMean=players.reduce((sum,player)=>sum+preservationValue(player),0)/players.length;
  const tradeSum=players.reduce((sum,player)=>{const value=tradeContextProfile(player);
    sum.readiness+=value.readiness;sum.tradeability+=value.tradeability;return sum;
  },{readiness:0,tradeability:0});
  const tradeContextMean={readiness:tradeSum.readiness/players.length,
    tradeability:tradeSum.tradeability/players.length};
  const assistUtilityMean=players.reduce((sum,player)=>
    sum+assistContextProfile(player).utility,0)/players.length;
  return {preservationMean,tradeContextMean,assistUtilityMean};
}

function utilityLoad(team,alive,purchases,cfg,assistUtilityMean){
  if(!alive.length)return 1;
  let sum=0;
  for(const index of alive)sum+=(cfg.UTIL_COMPRA[purchases[index]]??0)*
    (team.assistContext[index].utility/assistUtilityMean);
  return sum/alive.length;
}

// Buffer compartilhado no hot path, limitado aos cinco jogadores vivos.
const PICK_WEIGHTS=[0,0,0,0,0];

export function combateRound(a,b,ctx,deps){
  const {cfg:C,random,gaussian,preservationMean,tradeContextMean,assistUtilityMean,
    premioVitoria,premioObjetivo}=deps;
  const vivA=[0,1,2,3,4],vivB=[0,1,2,3,4];
  const mata=(arr,i)=>arr.splice(arr.indexOf(i),1);
  const comprasA=ctx.comprasA||[ctx.buyA,ctx.buyA,ctx.buyA,ctx.buyA,ctx.buyA];
  const comprasB=ctx.comprasB||[ctx.buyB,ctx.buyB,ctx.buyB,ctx.buyB,ctx.buyB];
  const buyA=ctx.buyA,buyB=ctx.buyB;
  const trace=ctx.trace||null;
  const before=trace?[a,b].map(team=>team.stats.map(stat=>({
    k:stat.k,d:stat.d,a:stat.a,dmg:stat.dmg,tradeK:stat.tradeK,kast:stat.fa.roundsKAST
  }))):null;
  if(trace)trace.events=[];
  const roundKills=[];
  const pick=(arr,fn)=>{let total=0;for(let i=0;i<arr.length;i++){
    PICK_WEIGHTS[i]=fn(arr[i]);total+=PICK_WEIGHTS[i];
  }
    total=total||1;
    let roll=random()*total;
    for(let i=0;i<arr.length;i++)if((roll-=PICK_WEIGHTS[i])<0)return arr[i];
    return arr[arr.length-1];
  };
  const classeEco=classe=>classe==="awp"?"full":classe;
  function duelo(venc,vivV,comprasV,perd,vivP,comprasP,opening,trade,phase,victimSide){
    const expK=opening?C.EXP_OPEN:C.EXP_KILL;
    const tilt=i=>opening?Math.max(.25,1+C.W_OP_KILL*((venc.ops[i]-50)/50)):
      trade?Math.max(.25,1+C.W_TR_KILL*((venc.trs[i]-50)/50)):1;
    const ladoMatador=opening?sideOf(venc):null;
    const abertura=opening?i=>Math.pow(venc.exposure[i].opening[ladoMatador],C.AGR_ABRE):()=>1;
    const embalo=i=>1+C.MOM_HEAT*Math.max(0,venc.stats[i].k-venc.stats[i].d);
    const ki=pick(vivV,i=>Math.pow(Math.max(venc.frags[i],8),expK)*tilt(i)*abertura(i)*embalo(i));
    const vi=pick(vivP,i=>Math.pow(Math.max(perd.frags[i],8),C.CONTACT_VOLUME_EXP[phase])*
      perd.exposure[i][phase][victimSide]);
    const rec={estadoMeu:vivV.length,estadoInim:vivP.length,
      buyMatador:classeEco(comprasV[ki]),buyVitima:classeEco(comprasP[vi]),roundGanho:true};
    rec._ki=ki;
    venc.stats[ki].fa.kills.push(rec);roundKills.push({team:venc,rec});
    venc.stats[ki].k++;venc.stats[ki]._kRound++;venc.stats[ki]._contribRound=true;
    venc.stats[ki].dmg+=C.ADR_SCALE*(C.ADR_KILL+random()*40);
    if(trade)venc.stats[ki].tradeK++;
    const mo={estadoMeu:vivP.length,estadoInim:vivV.length};
    perd.stats[vi].fa.mortes.push(mo);perd.stats[vi].d++;
    perd.stats[vi].dmg+=C.ADR_SCALE*random()*C.ADR_VIT;
    if(opening){venc.stats[ki].fa.opK++;perd.stats[vi].fa.opD++;}
    let ai=null;
    const assistSlots=ASSIST_SLOTS[ki],assistPresence=i=>vivV.includes(i)?1:C.ASSIST_DEAD_W;
    const assistPresenceTotal=assistSlots.reduce((sum,i)=>sum+assistPresence(i),0);
    const assistUtility=assistSlots.reduce((sum,i)=>
      sum+venc.assistContext[i].utility*assistPresence(i),0)/assistPresenceTotal;
    const assistChance=C.ASSIST_CHANCE*(opening?C.ASSIST_OPEN_MULT:1)+
      C.ASSIST_CONTEXT*(assistUtility-assistUtilityMean);
    if(random()<assistChance){
      ai=pick(assistSlots,i=>(C.ASSIST_BASE+C.ASSIST_UT_W*(venc.stats[i].ut||40))*assistPresence(i));
      venc.stats[ai].a++;venc.stats[ai].fa.assists++;venc.stats[ai]._contribRound=true;
      venc.stats[ai].dmg+=C.ADR_SCALE*(C.ADR_AST+random()*30);
    }
    if(trace){
      const killerTeam=venc===a?"A":"B",victimTeam=perd===a?"A":"B";
      trace.events.push({sequence:trace.events.length+1,type:"kill",opening:!!opening,trade:!!trade,
        killer:{team:killerTeam,index:ki,id:telemetryPlayerId(venc,ki),buy:comprasV[ki]},
        victim:{team:victimTeam,index:vi,id:telemetryPlayerId(perd,vi),buy:comprasP[vi]},
        assist:ai===null?null:{team:killerTeam,index:ai,id:telemetryPlayerId(venc,ai)},
        victimTraded:false,kastTradeCredit:false});
    }
    return vi;
  }
  const aCT=ctx.aIsCT;
  const ctVence=()=>aCT?"A":"B",tVence=()=>aCT?"B":"A";
  const sideOf=team=>team===a?(aCT?"CT":"TR"):(aCT?"TR":"CT");
  const preservationEdge=(team,alive)=>alive.reduce((sum,index)=>
    sum+team.preservation[index],0)/alive.length-preservationMean;
  const tradeChance=(team,alive,victimIndex)=>{const readiness=alive.reduce((sum,index)=>
    sum+team.tradeContext[index].readiness,0)/alive.length;
    return C.TRADE_CHANCE+C.TRADE_CONTEXT*((readiness-tradeContextMean.readiness)+
      (team.tradeContext[victimIndex].tradeability-tradeContextMean.tradeability));
  };
  let primeira=true,fim=null;
  let plantado=false,relogio=0,pp=0,metodo=null,saveTeam=null;
  let clutch=null;
  const idxT=aCT?vivB:vivA,timeT=aCT?b:a;
  const agrT=idxT.reduce((sum,i)=>sum+(timeT.agr[i]||0),0)/Math.max(1,idxT.length);
  /* `ctx.ritmoBonus` é o empurrão da camada tática no ritmo do round. Ausente,
     soma zero e a aritmética é bit a bit a mesma — é isso que permite ligar a
     camada sem invalidar o golden enquanto a chave estiver desligada. */
  const ritmo=clamp(1+C.CONTATO_AGR*agrT+gaussian()*C.CONTATO_RITMO+(ctx.ritmoBonus||0),
    C.CONTATO_MIN,C.CONTATO_MAX);
  const LIMITE=C.RND_SEGUNDOS+C.BOMBA_SEGUNDOS;
  while(vivA.length>0&&vivB.length>0&&fim===null&&relogio<LIMITE){
    relogio+=C.TICK;
    const desvantagem=Math.abs(vivA.length-vivB.length);
    const pContato=clamp(C.CONTATO_BASE*ritmo*(plantado?C.CONTATO_POS:1)*
      (1-C.CONTATO_DESV*desvantagem),.01,.95);
    if(random()<pContato){
      let p=ctx.pEdgeA;
      if(primeira)p=clamp(p+ctx.openEdgeA,.03,.97);
      if(plantado)p=clamp(p+(aCT?-C.POST_EDGE:C.POST_EDGE),.03,.97);
      if(vivA.length===1&&vivB.length>1)p=clamp(p+Math.pow(vivB.length-1,C.CLUTCH_EXP)*C.CLUTCH_X+
        ((a.cls[vivA[0]]||45)-50)/100*C.CLUTCH_DUEL,.03,.97);
      if(vivB.length===1&&vivA.length>1)p=clamp(p-Math.pow(vivA.length-1,C.CLUTCH_EXP)*C.CLUTCH_X-
        ((b.cls[vivB[0]]||45)-50)/100*C.CLUTCH_DUEL,.03,.97);
      const aWins=random()<p;
      const venc=aWins?a:b,perd=aWins?b:a,vivV=aWins?vivA:vivB,vivP=aWins?vivB:vivA;
      const compV=aWins?comprasA:comprasB,compP=aWins?comprasB:comprasA;
      const phase=primeira?"opening":plantado?"postplant":"preplant";
      const vi=duelo(venc,vivV,compV,perd,vivP,compP,primeira,false,phase,sideOf(perd));
      const victimEvent=trace?trace.events[trace.events.length-1]:null;
      mata(aWins?vivB:vivA,vi);
      primeira=false;
      const vVnow=aWins?vivA:vivB,vPnow=aWins?vivB:vivA;
      if(vPnow.length>0&&vVnow.length>1&&random()<tradeChance(perd,vPnow,vi)){
        const vi2=duelo(perd,vPnow,compP,venc,vVnow,compV,false,true,phase,sideOf(venc));
        mata(aWins?vivA:vivB,vi2);
        const kastTradeCredit=random()<C.KAST_TRADE_P;
        if(kastTradeCredit)perd.stats[vi]._contribRound=true;
        if(victimEvent){victimEvent.victimTraded=true;victimEvent.kastTradeCredit=kastTradeCredit;}
      }
      if(vivA.length===0||vivB.length===0)break;
      if(!clutch){
        if(vivA.length===1)clutch={aLone:true,x:vivB.length};
        else if(vivB.length===1)clutch={aLone:false,x:vivA.length};
      }
    }
    const vivT=aCT?vivB:vivA,vivCT=aCT?vivA:vivB,buyT=aCT?buyB:buyA,buyCT=aCT?buyA:buyB;
    const timeT=aCT?b:a,timeCT=aCT?a:b,compT=aCT?comprasB:comprasA,compCT=aCT?comprasA:comprasB;
    if(!plantado){
      if(vivCT.length-vivT.length>=2){const eco=buyT==="eco"||buyT==="force"||buyT==="pistol";
        const losingTeam=aCT?b:a;
        if(random()<(eco?C.SAVE_BASE:C.SAVE_BASE*.35)+(vivCT.length-vivT.length)*C.SAVE_MEN+
          C.SAVE_VALUE*preservationEdge(losingTeam,vivT)){
          fim=ctVence();metodo="tempo";saveTeam=tVence();break;
        }
      }
      const fracao=relogio/C.RND_SEGUNDOS;
      // `ctx.plantBonusT` idem: comprometimento de utilitária decidido pela tática.
      const pPlant=clamp(C.PLANT_BASE+fracao*C.PLANT_TEMPO+(vivT.length-vivCT.length)*C.PLANT_MEN+
        C.UTIL_PLANT*(utilityLoad(timeT,vivT,compT,C,assistUtilityMean)-
          utilityLoad(timeCT,vivCT,compCT,C,assistUtilityMean))+(ctx.plantBonusT||0),0,.92);
      if(random()<pPlant){plantado=true;pp=0;}
      else if(relogio>=C.RND_SEGUNDOS){fim=ctVence();metodo="tempo";break;}
    }else{
      pp+=C.TICK;
      if(vivT.length-vivCT.length>=2){const eco=buyCT==="eco"||buyCT==="force"||buyCT==="pistol";
        const losingTeam=aCT?a:b;
        if(random()<(eco?C.SAVE_BASE:C.SAVE_BASE*.35)+(vivT.length-vivCT.length)*C.SAVE_MEN+
          C.SAVE_VALUE*preservationEdge(losingTeam,vivCT)){
          fim=tVence();metodo="detona";saveTeam=ctVence();break;
        }
      }
      if(vivCT.length>=vivT.length&&random()<C.DEFUSE_BASE+
        Math.max(0,vivCT.length-vivT.length)*C.DEFUSE_MEN+
        C.UTIL_RETAKE*(utilityLoad(timeCT,vivCT,compCT,C,assistUtilityMean)-
          utilityLoad(timeT,vivT,compT,C,assistUtilityMean))){
        fim=ctVence();metodo="defuse";break;
      }
      if(pp>=C.BOMBA_SEGUNDOS){fim=tVence();metodo="detona";break;}
    }
  }
  const venceA=fim!==null?fim==="A":vivA.length>0;
  const vencT=venceA?a:b,vivVfinal=venceA?vivA:vivB;
  roundKills.forEach(kill=>{kill.rec.roundGanho=(kill.team===vencT);});
  let mvp=0;
  for(let i=1;i<5;i++)if((vencT.stats[i]._kRound||0)>(vencT.stats[mvp]._kRound||0))mvp=i;
  const destaque=vencT.stats[mvp].nick;
  [a,b].forEach((team,side)=>{const alive=side===0?vivA:vivB;team.stats.forEach((stat,index)=>{
    const roundKillsCount=stat._kRound||0;
    if(roundKillsCount>=2)stat.fa.multi[roundKillsCount]=(stat.fa.multi[roundKillsCount]||0)+1;
    const vivo=alive.includes(index);
    if(stat._contribRound||vivo){
      stat.fa.roundsKAST++;
      if(roundKillsCount===0)stat.dmg+=C.ADR_SCALE*random()*C.ADR_CHIP;
    }
    stat._kRound=0;stat._contribRound=false;
  });});
  let kA=0,kB=0;
  roundKills.forEach(kill=>{kill.team===a?kA++:kB++;});
  const killsJogA=[0,0,0,0,0],killsJogB=[0,0,0,0,0];
  roundKills.forEach(kill=>{const index=kill.rec._ki;
    if(index!=null)(kill.team===a?killsJogA:killsJogB)[index]++;
  });
  const clutchWon=clutch?(clutch.aLone?venceA:!venceA):null;
  if(!metodo)metodo=plantado?(venceA===aCT?"defuse":"detona"):"elim";
  if(trace){
    const wasTraded={A:[false,false,false,false,false],B:[false,false,false,false,false]};
    const tradeCredit={A:[false,false,false,false,false],B:[false,false,false,false,false]};
    trace.events.forEach(event=>{
      if(event.victimTraded)wasTraded[event.victim.team][event.victim.index]=true;
      if(event.kastTradeCredit)tradeCredit[event.victim.team][event.victim.index]=true;
    });
    const finishPlayers=(team,teamCode,alive,buy,base)=>team.stats.map((stat,index)=>{
      const kills=stat.k-base[index].k,deaths=stat.d-base[index].d,assists=stat.a-base[index].a;
      const survived=alive.includes(index),traded=tradeCredit[teamCode][index];
      return {index,id:telemetryPlayerId(team,index),
        side:teamCode==="A"?(aCT?"CT":"TR"):(aCT?"TR":"CT"),buy,kills,deaths,assists,
        damage:+(stat.dmg-base[index].dmg).toFixed(6),tradeKills:stat.tradeK-base[index].tradeK,
        survived,saved:saveTeam===teamCode&&survived,wasTraded:wasTraded[teamCode][index],
        kastCredit:stat.fa.roundsKAST-base[index].kast,
        kastComponents:{kill:kills>0,assist:assists>0,survived,traded}};
    });
    trace.result={winner:venceA?"A":"B",planted:plantado,method:metodo,saveTeam,
      survivors:{A:vivA.length,B:vivB.length},
      clutch:clutch?{team:clutch.aLone?"A":"B",opponents:clutch.x,won:clutchWon}:null};
    trace.players={A:finishPlayers(a,"A",vivA,buyA,before[0]),
      B:finishPlayers(b,"B",vivB,buyB,before[1])};
  }
  const premioV=(metodo==="defuse"||metodo==="detona")?premioObjetivo:premioVitoria;
  return {venceA,sobreviventes:vivVfinal.length,destaque,plantado,metodo,premioV,
    killsA:kA,killsB:kB,killsPorJogador:{A:killsJogA,B:killsJogB},
    vivosA:[...vivA],vivosB:[...vivB],clutchX:clutch&&clutch.x,clutchWon};
}
