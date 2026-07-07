/* bancada/common.js - helpers pequenos para as suites de validacao. */
const path=require("path");

const ROOT=path.join(__dirname,"..");
const ATTRS=["fp","en","tr","op","cl","sn","ut"];
const COLOCACOES=["Campeao","Final","Top4","Top8","Grupos"];

const mean=values=>values.reduce((sum,value)=>sum+value,0)/Math.max(1,values.length);
const pct=(num,den)=>100*num/Math.max(1,den);
const inRange=(value,min,max)=>value>=min&&value<=max;
const signed=value=>(value>=0?"+":"")+value.toFixed(2);
const secondsSince=start=>((Date.now()-start)/1000).toFixed(1);

function okMark(ok){
  return ok?"✓":"✗";
}

function printCheck(ok,name,value,range){
  console.log(`  ${okMark(ok)} ${name.padEnd(26)} ${String(value).padStart(6)}   [${range}]`);
}

function pickOpponent(teams,self){
  if(teams.length<2)throw new Error("simulacao precisa de ao menos 2 times");
  let opponent=self;
  while(opponent===self)opponent=teams[Math.floor(Math.random()*teams.length)];
  return opponent;
}

module.exports={ROOT,ATTRS,COLOCACOES,mean,pct,inRange,signed,secondsSince,okMark,printCheck,pickOpponent};
