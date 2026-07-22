/* PRISMA: custo contextual de combinar role e playstyle.
   Extração mecânica de game.js; valores e ordem das operações são contrato. */
const STYLE_KEYS={aggressive:"Opener",spacetaker:"Spacetaker",trader:"Trader",playmaker:"Playmaker",infiltrator:"Infiltrador",baiter:"Baiter",clutcher:"Closer",support:"Facilitador",cerebral:"Cerebral",anchor:"Ancora"};
const PLAYSTYLE_LABELS={aggressive:"Opener",spacetaker:"Spacetaker",trader:"Trader",playmaker:"Playmaker",infiltrator:"Infiltrador",baiter:"Baiter",clutcher:"Closer",support:"Facilitador",cerebral:"Cerebral",anchor:"Ancora"};
const PLAYSTYLE_IDS=Object.keys(PLAYSTYLE_LABELS);
const STYLE_ID=x=>x==="Coringa"||x==="joker"?"joker":(PLAYSTYLE_IDS.find(id=>id===x||STYLE_KEYS[id]===x||PLAYSTYLE_LABELS[id]===x)||x);
const ROLE_STYLE_BASE={
  Entry:{anchor:.46,support:.30,cerebral:.26,clutcher:.22,infiltrator:.18,trader:.12},
  Support:{aggressive:.28,spacetaker:.24,playmaker:.14,infiltrator:.12,baiter:.10},
  Lurker:{aggressive:.18,spacetaker:.14,trader:.12,support:.10},
  AWPer:{support:.16,anchor:.14,trader:.10},
  Rifler:{baiter:.18,anchor:.10},
  IGL:{aggressive:.16,spacetaker:.12,baiter:.12}
};

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function roleStyleReality(role,style,player){
  const id=STYLE_ID(style),reasons=[];
  let cost=(ROLE_STYLE_BASE[role]&&ROLE_STYLE_BASE[role][id])||0;
  const en=player.en||0,fp=player.fp||0,tr=player.tr||0,op=player.op||0,cl=player.cl||0,ut=player.ut||0,sn=player.sn||0;
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
