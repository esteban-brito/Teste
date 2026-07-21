/* PRISMA: custo contextual de combinar role primário e secundário.
   Extração mecânica de game.js; valores e ordem das operações são contrato. */
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

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function rolePairReality(primary,secondary,player){
  if(!primary||!secondary||primary===secondary)return {cost:0,label:"natural",reasons:[]};
  const reasons=[],key=`${primary}/${secondary}`;
  let cost=ROLE_PAIR_BASE[key]??.14;
  const en=player.en||0,fp=player.fp||0,tr=player.tr||0,op=player.op||0,cl=player.cl||0,ut=player.ut||0,sn=player.sn||0;
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
