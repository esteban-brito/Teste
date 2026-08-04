/* Protege a matemática descritiva de R1 e os novos intervalos usados por R2. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {ROOT}=require("../bancada/lib/common");

function legacyDescribe(values){
  const sum=xs=>xs.reduce((total,value)=>total+value,0);
  const mean=xs=>xs.length?sum(xs)/xs.length:0;
  const quantile=(sorted,probability)=>{
    if(!sorted.length)return 0;
    const position=(sorted.length-1)*probability;
    const lower=Math.floor(position),upper=Math.ceil(position);
    if(lower===upper)return sorted[lower];
    return sorted[lower]+(sorted[upper]-sorted[lower])*(position-lower);
  };
  const rounded=(value,digits=6)=>Number.isFinite(value)?+value.toFixed(digits):null;
  const sorted=values.filter(Number.isFinite).slice().sort((a,b)=>a-b);
  if(!sorted.length)return {n:0,mean:null,median:null,stdDev:null,p05:null,p25:null,p75:null,p95:null,min:null,max:null};
  const average=mean(sorted);
  const variance=sorted.length>1?sum(sorted.map(value=>(value-average)**2))/(sorted.length-1):0;
  return {
    n:sorted.length,
    mean:rounded(average),
    median:rounded(quantile(sorted,.5)),
    stdDev:rounded(Math.sqrt(variance)),
    p05:rounded(quantile(sorted,.05)),
    p25:rounded(quantile(sorted,.25)),
    p75:rounded(quantile(sorted,.75)),
    p95:rounded(quantile(sorted,.95)),
    min:rounded(sorted[0]),
    max:rounded(sorted[sorted.length-1])
  };
}

function generatedSamples(){
  const values=[-1,0,1,2.5],samples=[[],[NaN],[Infinity],[1,NaN,2,Infinity]];
  for(let length=1;length<=6;length++){
    const total=values.length**length;
    for(let encoded=0;encoded<total;encoded++){
      let current=encoded;
      const sample=[];
      for(let index=0;index<length;index++){
        sample.push(values[current%values.length]);
        current=Math.floor(current/values.length);
      }
      samples.push(sample);
    }
  }
  return samples;
}

async function main(){
  const moduleUrl=pathToFileURL(path.join(ROOT,"src","domain","statistics","sample-summary.mjs")).href;
  const {describeSample,percentileRange,meanConfidenceInterval}=await import(moduleUrl);
  const samples=generatedSamples();

  samples.forEach((sample,index)=>{
    const before=sample.slice();
    assert.deepEqual(describeSample(sample),legacyDescribe(sample),`divergência na amostra ${index}`);
    assert.deepEqual(sample,before,`amostra ${index} foi alterada`);
  });

  assert.equal(meanConfidenceInterval([]),null,"IC vazio deve ser indisponível");
  assert.equal(meanConfidenceInterval([2]),null,"IC unitário deve ser indisponível");
  assert.deepEqual(meanConfidenceInterval([1,1]),[1,1],"IC constante deve colapsar na média");
  assert.deepEqual(meanConfidenceInterval([1,3]),[.04,3.96],"IC deve usar desvio amostral e z=1.96");
  assert.equal(percentileRange([]),null,"faixa vazia deve ser indisponível");
  assert.deepEqual(percentileRange([2]),{lower:2,upper:2},"faixa unitária deve colapsar no valor");
  assert.deepEqual(percentileRange(Array.from({length:100},(_,index)=>index+1)),{lower:10.9,upper:90.1},"P10–P90 deve delimitar os 80% centrais");
  assert.throws(()=>percentileRange([1,2],.9,.1),/intervalo válido/,"percentis invertidos devem falhar claramente");
  assert.throws(()=>describeSample(null),/array/,"entrada inválida deve falhar claramente");
  assert.throws(()=>meanConfidenceInterval([1,2],0),/positivo/,"z inválido deve falhar claramente");

  console.log(`sample summary parity: ok (${samples.length} amostras)`);
}

main().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
