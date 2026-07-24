/* bancada/common.js - helpers pequenos para as suites de validacao. */
const path=require("path");

const ROOT=path.join(__dirname,"..");
const ATTRS=["fp","en","tr","op","cl","sn","ut"];
const DISPLAY_ATTRS=["fp","en","tr","op","cl","ut","sn"];
const COLOCACOES=["Campeao","Final","Top4","Top8","Grupos"];

const mean=values=>values.reduce((sum,value)=>sum+value,0)/Math.max(1,values.length);
const pct=(num,den)=>100*num/Math.max(1,den);
const inRange=(value,min,max)=>value>=min&&value<=max;
const signed=value=>(value>=0?"+":"")+value.toFixed(2);
const secondsSince=start=>((Date.now()-start)/1000).toFixed(1);
const compactStats=player=>DISPLAY_ATTRS.map(attr=>player[attr]).join("/");

// Opções de launch dos E2E. CHROMIUM_EXECUTABLE (opt-in) aponta um Chromium local válido quando o
// cache do Playwright não bate com a versão fixada (ex.: container com browser pré-instalado).
// Sem a env, o comportamento é idêntico ao padrão; com caminho inválido, o launch segue falhando
// visível — nunca converte falta de browser em sucesso.
function chromiumLaunchOptions(){
  const options={headless:true};
  if(process.env.CHROMIUM_EXECUTABLE)options.executablePath=process.env.CHROMIUM_EXECUTABLE;
  return options;
}

function countBy(items,fn){
  return items.reduce((out,item)=>{
    const key=fn(item);
    out[key]=(out[key]||0)+1;
    return out;
  },{});
}

function sortedCountEntries(count,order=null){
  return Object.entries(count).sort((a,b)=>{
    if(order)return order.indexOf(a[0])-order.indexOf(b[0]);
    return b[1]-a[1]||String(a[0]).localeCompare(String(b[0]));
  });
}

function okMark(ok){
  return ok?"✓":"✗";
}

function printCheck(ok,name,value,range){
  console.log(`  ${okMark(ok)} ${name.padEnd(26)} ${String(value).padStart(6)}   [${range}]`);
}

function scheduledMatch(teams,selfIndex,roundIndex){
  if(teams.length<2)throw new Error("simulacao precisa de ao menos 2 times");
  if(!Number.isInteger(selfIndex)||selfIndex<0||selfIndex>=teams.length)throw new Error("indice de time invalido");
  const cycle=teams.length-1;
  const normalized=((roundIndex%cycle)+cycle)%cycle;
  const opponentIndex=(selfIndex+1+normalized)%teams.length;
  const team=teams[selfIndex],opponent=teams[opponentIndex];
  const swap=((roundIndex+selfIndex)&1)===1;
  return {team,opponent,a:swap?opponent:team,b:swap?team:opponent};
}

function teamNameFor(teams,player){
  const team=teams.find(item=>item.jogadores.some(card=>card._eng.id===player.id));
  return team?team.nome:"-";
}

module.exports={
  ROOT,ATTRS,DISPLAY_ATTRS,COLOCACOES,
  mean,pct,inRange,signed,secondsSince,compactStats,
  countBy,sortedCountEntries,
  okMark,printCheck,scheduledMatch,teamNameFor,chromiumLaunchOptions
};
