const finite=value=>typeof value==="number"&&Number.isFinite(value);

export function sum(values){
  return values.reduce((total,value)=>total+value,0);
}

export function mean(values){
  return values.length?sum(values)/values.length:0;
}

export function quantileSorted(sortedValues,probability){
  if(!sortedValues.length)return 0;
  const position=(sortedValues.length-1)*probability;
  const lower=Math.floor(position),upper=Math.ceil(position);
  if(lower===upper)return sortedValues[lower];
  return sortedValues[lower]+(sortedValues[upper]-sortedValues[lower])*(position-lower);
}

export function rounded(value,digits=6){
  return finite(value)?+value.toFixed(digits):null;
}

function finiteSorted(values){
  if(!Array.isArray(values))throw new TypeError("amostra deve ser um array");
  return values.filter(finite).slice().sort((a,b)=>a-b);
}

function sampleVariance(values,average){
  return values.length>1?sum(values.map(value=>(value-average)**2))/(values.length-1):0;
}

export function describeSample(values){
  const sorted=finiteSorted(values);
  if(!sorted.length)return {n:0,mean:null,median:null,stdDev:null,p05:null,p25:null,p75:null,p95:null,min:null,max:null};
  const average=mean(sorted);
  return {
    n:sorted.length,
    mean:rounded(average),
    median:rounded(quantileSorted(sorted,.5)),
    stdDev:rounded(Math.sqrt(sampleVariance(sorted,average))),
    p05:rounded(quantileSorted(sorted,.05)),
    p25:rounded(quantileSorted(sorted,.25)),
    p75:rounded(quantileSorted(sorted,.75)),
    p95:rounded(quantileSorted(sorted,.95)),
    min:rounded(sorted[0]),
    max:rounded(sorted[sorted.length-1])
  };
}

export function meanConfidenceInterval(values,z=1.96){
  const sorted=finiteSorted(values);
  if(sorted.length<2)return null;
  if(!finite(z)||z<=0)throw new RangeError("z deve ser positivo e finito");
  const average=mean(sorted);
  const standardError=Math.sqrt(sampleVariance(sorted,average)/sorted.length);
  const margin=z*standardError;
  return [rounded(average-margin),rounded(average+margin)];
}
