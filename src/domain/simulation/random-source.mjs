/* Fonte de azar reproduzível do simulador. O estado é privado por instância para
   permitir sessões independentes; consumidores recebem rndF/gaussF explicitamente. */
export function createMulberry32(seed){
  let state=seed===undefined?(Math.random()*4294967296)>>>0:(seed>>>0)||1;
  const srand=value=>{state=(value>>>0)||1;};
  const rndF=()=>{let t=state+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);
    t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};
  const gaussF=()=>{let u=0,v=0;while(u===0)u=rndF();while(v===0)v=rndF();
    return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};
  return {srand,rndF,gaussF};
}
