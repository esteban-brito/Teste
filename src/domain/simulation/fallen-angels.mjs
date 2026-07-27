/* FALLEnANGELs extraído mecanicamente de game.js. Valores, clamps internos e
   ordem de soma são contrato até um futuro commit explícito de balanceamento. */
const WIN_PROBABILITY={"5v5":.50,"5v4":.74,"5v3":.88,"5v2":.95,"5v1":.99,
  "4v5":.26,"4v4":.50,"4v3":.73,"4v2":.87,"4v1":.95,
  "3v5":.12,"3v4":.27,"3v3":.50,"3v2":.72,"3v1":.86,
  "2v5":.05,"2v4":.13,"2v3":.28,"2v2":.50,"2v1":.70,
  "1v5":.01,"1v4":.05,"1v3":.13,"1v2":.27,"1v1":.50};
const ECO_MULTIPLIER={full:{full:1,force:.9,eco:.62,pistol:.55},force:{full:1.18,force:1,eco:.78,pistol:.68},
  eco:{full:1.6,force:1.3,eco:1,pistol:.85},pistol:{full:1.55,force:1.25,eco:.95,pistol:1}};
const CONFIG={BASE:.614,W_EK:.385,W_SURV:.160,W_KAST:.240,W_MULTI:.042,W_SWING:.10,PESO_MORTE:.95,PESO_OPEN:.216,
  W_ADR:.0019,ADR_REF:76,W_TRADE:.075,OPEN_D_W:.6,IMP_OVR:.012,IGL_SIS:.015};

const winProbability=(mine,opponent)=>mine<=0?0:opponent<=0?1:
  (WIN_PROBABILITY[`${Math.min(mine,5)}v${Math.min(opponent,5)}`]??.5);
const killSwing=(mine,opponent)=>winProbability(mine,opponent-1)-winProbability(mine,opponent);
const deathSwing=(mine,opponent)=>winProbability(mine-1,opponent)-winProbability(mine,opponent);
const ecoMultiplier=(killerBuy,victimBuy)=>(ECO_MULTIPLIER[killerBuy]&&ECO_MULTIPLIER[killerBuy][victimBuy])||1;

export function fallenAngelsComponents(event){
  const C=CONFIG,R=event.totalRounds||1;
  const ekpr=event.kills.reduce((sum,kill)=>sum+ecoMultiplier(kill.buyMatador,kill.buyVitima),0)/R;
  const survPR=1-(event.mortes.length/R);
  const kast=(event.roundsKAST||0)/R;
  const multi=event.multi||{};
  const multiScore=((multi[2]||0)+(multi[3]||0)*2.2+(multi[4]||0)*4+(multi[5]||0)*7)/R;
  let swing=0;
  event.kills.forEach(kill=>{if(kill.roundGanho)swing+=killSwing(kill.estadoMeu,kill.estadoInim);});
  event.mortes.forEach(death=>{swing+=deathSwing(death.estadoMeu,death.estadoInim)*C.PESO_MORTE;});
  const opening=((event.opK||0)-(event.opD||0)*C.OPEN_D_W)/R*C.PESO_OPEN;
  const adr=(event.dmg||0)/R;
  const damage=(adr-C.ADR_REF)*C.W_ADR;
  const trade=(event.tradeK||0)/R*C.W_TRADE;
  const effectiveImpact=(event.impacto??1)*(1+C.IMP_OVR*((event.ovr??16)-16));
  const system=event.prim==="IGL"?C.IGL_SIS:0;
  return {
    base:C.BASE,
    economyAdjustedKills:ekpr*C.W_EK*effectiveImpact,
    survival:survPR*C.W_SURV,
    kast:kast*C.W_KAST,
    multikill:multiScore*C.W_MULTI,
    swing:(swing/R)*C.W_SWING,
    opening,
    damage,
    trade,
    system
  };
}

export function fallenAngels(event){
  const components=fallenAngelsComponents(event);
  return components.base+components.economyAdjustedKills+components.survival+components.kast+
    components.multikill+components.swing+components.opening+components.damage+components.trade+
    components.system;
}
