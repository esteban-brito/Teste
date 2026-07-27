const finite=value=>typeof value==="number"&&Number.isFinite(value);

export const Z95=1.959963984540054;

function counts(successes,total){
  if(!Number.isInteger(successes)||!Number.isInteger(total))throw new TypeError("proporcao exige contagens inteiras");
  if(total<0||successes<0)throw new RangeError("proporcao nao aceita contagem negativa");
  if(successes>total)throw new RangeError(`sucessos (${successes}) excedem a amostra (${total})`);
  return {successes,total};
}

/* Intervalo de Wilson. Em p pequeno (o invicto vive em ~0,01–0,06) o intervalo normal
   simples subestima a incerteza e chega a produzir limite inferior negativo; o de Wilson
   permanece dentro de [0,1] e mantem cobertura proxima do nominal mesmo com poucos eventos. */
export function wilsonInterval(successes,total,z=Z95){
  counts(successes,total);
  if(!finite(z)||z<=0)throw new RangeError("z deve ser positivo e finito");
  if(!total)return {n:0,estimate:null,low:null,high:null,margin:null};
  const estimate=successes/total;
  const z2=z*z;
  const denominator=1+z2/total;
  const center=(estimate+z2/(2*total))/denominator;
  const half=(z/denominator)*Math.sqrt(estimate*(1-estimate)/total+z2/(4*total*total));
  // o intervalo contem p por construcao; os limites tambem aparam o ruido de ponto flutuante,
  // que nas bordas (zero evento ou amostra completa) deslocaria o limite para o lado errado.
  return {n:total,estimate,low:Math.min(estimate,Math.max(0,center-half)),
    high:Math.max(estimate,Math.min(1,center+half)),margin:half};
}

export function wilsonIntervalPercent(successes,total,z=Z95){
  const interval=wilsonInterval(successes,total,z);
  if(!interval.n)return interval;
  return {n:interval.n,estimate:100*interval.estimate,low:100*interval.low,
    high:100*interval.high,margin:100*interval.margin};
}

/* Duas proporcoes independentes sao distinguiveis quando os intervalos nao se tocam.
   E um criterio conservador: nao se tocarem implica diferenca significativa, o inverso
   nao vale. Serve para responder "esta amostra separa 1,5% de 4%?". */
export function intervalsDisjoint(a,b){
  if(!a||!b||a.n===0||b.n===0)return false;
  return a.high<b.low||b.high<a.low;
}

/* Amostra de planejamento pela aproximacao normal: n = z^2 p(1-p)/margem^2.
   Usada para dimensionar a suite antes de medir, nao para relatar resultado. */
export function sampleSizeForMargin(estimate,margin,z=Z95){
  if(!finite(estimate)||estimate<0||estimate>1)throw new RangeError("estimativa deve estar em [0,1]");
  if(!finite(margin)||margin<=0)throw new RangeError("margem deve ser positiva");
  return Math.ceil(z*z*estimate*(1-estimate)/(margin*margin));
}
