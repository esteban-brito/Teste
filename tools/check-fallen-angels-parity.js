/* Protege a decomposição somável de FALLEnANGELs contra qualquer alteração de
   pesos, clamps internos, defaults ou ordem aritmética. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {X}=require("../bancada/motor");
const {ROOT}=require("../bancada/common");

const BUYS=["full","force","eco","pistol",undefined];
const STATES=[[1,1],[1,5],[3,2],[5,1],[5,5],[0,3]];

function plain(value){
  return JSON.parse(JSON.stringify(value));
}

function deterministicEvents(){
  const events=[];
  for(let index=0;index<2048;index++){
    const rounds=[1,12,13,24,36][index%5];
    const killCount=index%6,deathCount=Math.min(rounds,(index*7)%Math.min(rounds+1,18));
    const kills=Array.from({length:killCount},(_,killIndex)=>{
      const state=STATES[(index+killIndex)%STATES.length];
      return {buyMatador:BUYS[(index+killIndex)%BUYS.length],buyVitima:BUYS[(index*3+killIndex)%BUYS.length],
        estadoMeu:state[0],estadoInim:state[1],roundGanho:(index+killIndex)%3!==0};
    });
    const mortes=Array.from({length:deathCount},(_,deathIndex)=>{
      const state=STATES[(index*5+deathIndex)%STATES.length];
      return {estadoMeu:state[0],estadoInim:state[1]};
    });
    events.push({totalRounds:rounds,kills,mortes,roundsKAST:(index*11)%(rounds+1),
      multi:{2:index%4,3:index%3,4:index%2,5:index%7===0?1:0},opK:index%6,opD:(index*3)%6,
      dmg:(index*137)%8000,tradeK:index%5,impacto:[.9,.955,1,1.065,1.2][index%5],
      prim:["AWPer","Rifler","Entry","Lurker","Support","IGL"][index%6],
      ovr:5+(index%18),ratingBase:.7+(index%120)/100});
  }
  return events;
}

async function main(){
  const moduleUrl=pathToFileURL(path.join(ROOT,"src","domain","simulation","fallen-angels.mjs")).href;
  const extracted=await import(moduleUrl);
  const events=deterministicEvents();

  events.forEach((event,index)=>{
    const before=JSON.stringify(event);
    const expectedComponents=plain(X.fallenAngelsComponents(event));
    const actualComponents=extracted.fallenAngelsComponents(event);
    assert.deepEqual(actualComponents,expectedComponents,`componentes divergiram no evento ${index}`);
    assert.equal(extracted.fallenAngels(event),X.fallenAngels(event),`rating divergiu no evento ${index}`);
    assert.equal(JSON.stringify(event),before,`evento ${index} foi alterado`);
  });

  console.log(`fallen angels parity: ok (${events.length} eventos)`);
}

main().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
