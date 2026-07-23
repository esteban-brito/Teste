const finite=value=>typeof value==="number"&&Number.isFinite(value);
const sum=values=>values.reduce((total,value)=>total+value,0);
const mean=values=>values.length?sum(values)/values.length:0;
const rounded=(value,digits=6)=>finite(value)?+value.toFixed(digits):null;

function quantile(sortedValues,probability){
  if(!sortedValues.length)return null;
  const position=(sortedValues.length-1)*probability;
  const lower=Math.floor(position),upper=Math.ceil(position);
  if(lower===upper)return sortedValues[lower];
  return sortedValues[lower]+(sortedValues[upper]-sortedValues[lower])*(position-lower);
}

function sampleVariance(values,average){
  return values.length>1?sum(values.map(value=>(value-average)**2))/(values.length-1):0;
}

function finiteValues(values,label){
  if(!Array.isArray(values))throw new TypeError(`${label} deve ser um array`);
  if(values.some(value=>!finite(value)))throw new TypeError(`${label} contem valor nao finito`);
  return values;
}

export function distributionSummary(values){
  const sorted=finiteValues(values,"distribuicao").slice().sort((a,b)=>a-b);
  if(!sorted.length)return {n:0,mean:null,stdDev:null,p001:null,p01:null,p05:null,p50:null,p95:null,p99:null,p999:null,min:null,max:null};
  const average=mean(sorted);
  return {
    n:sorted.length,mean:rounded(average),stdDev:rounded(Math.sqrt(sampleVariance(sorted,average))),
    p001:rounded(quantile(sorted,.001)),p01:rounded(quantile(sorted,.01)),p05:rounded(quantile(sorted,.05)),
    p50:rounded(quantile(sorted,.5)),p95:rounded(quantile(sorted,.95)),p99:rounded(quantile(sorted,.99)),
    p999:rounded(quantile(sorted,.999)),min:rounded(sorted[0]),max:rounded(sorted[sorted.length-1])
  };
}

function indexed(rows,keyOf,label){
  if(!Array.isArray(rows))throw new TypeError(`${label} deve ser um array`);
  const out=new Map();
  rows.forEach((row,index)=>{
    const key=String(keyOf(row,index));
    if(out.has(key))throw new Error(`${label} possui chave duplicada: ${key}`);
    out.set(key,row);
  });
  return out;
}

function confidenceInterval(values){
  if(values.length<2)return null;
  const average=mean(values);
  const margin=1.96*Math.sqrt(sampleVariance(values,average)/values.length);
  return [rounded(average-margin),rounded(average+margin)];
}

export function comparePairedMetric(beforeRows,afterRows,options){
  const {keyOf,blockOf,valueOf}=options||{};
  if(typeof keyOf!=="function"||typeof blockOf!=="function"||typeof valueOf!=="function"){
    throw new TypeError("comparacao pareada exige keyOf, blockOf e valueOf");
  }
  const before=indexed(beforeRows,keyOf,"baseline"),after=indexed(afterRows,keyOf,"candidato");
  if(before.size!==after.size)throw new Error(`cobertura pareada diverge: ${before.size}/${after.size}`);
  const beforeValues=[],afterValues=[],deltas=[],byBlock=new Map();
  before.forEach((beforeRow,key)=>{
    const afterRow=after.get(key);
    if(!afterRow)throw new Error(`candidato sem observacao: ${key}`);
    const beforeBlock=String(blockOf(beforeRow)),afterBlock=String(blockOf(afterRow));
    if(beforeBlock!==afterBlock)throw new Error(`bloco pareado diverge em ${key}: ${beforeBlock}/${afterBlock}`);
    const beforeValue=valueOf(beforeRow),afterValue=valueOf(afterRow);
    if(!finite(beforeValue)||!finite(afterValue))throw new Error(`metrica nao finita em ${key}`);
    const delta=afterValue-beforeValue;
    beforeValues.push(beforeValue);afterValues.push(afterValue);deltas.push(delta);
    const block=byBlock.get(beforeBlock)||[];block.push(delta);byBlock.set(beforeBlock,block);
  });
  const blockDeltas=Array.from(byBlock.values(),values=>mean(values));
  return {
    observations:before.size,blocks:byBlock.size,
    before:distributionSummary(beforeValues),after:distributionSummary(afterValues),
    observationMeanDelta:rounded(mean(deltas)),blockMeanDelta:rounded(mean(blockDeltas)),
    blockDeltaCi95:confidenceInterval(blockDeltas),
    maxAbsoluteObservationDelta:rounded(deltas.reduce((maximum,delta)=>Math.max(maximum,Math.abs(delta)),0))
  };
}
