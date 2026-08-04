/* bancada/lib/sweep.js — varredura pareada de uma constante do motor.

   Serve às duas perguntas abertas do ciclo: qual expoente de abertura faz a assinatura do
   Entry emergir, e qual alavanca move a campanha invicta. Antes deste arquivo, as varreduras
   eram feitas editando `game.js` à mão e não ficavam versionadas — a "grade de 18 combinações"
   do ciclo do relógio existe só como texto em doc, sem código que a reproduza.

   Contrato:
     · todo braço da varredura roda com a MESMA seed e a MESMA agenda; a única diferença entre
       braços é o valor do parâmetro (comparação pareada, regra R5 de docs/next-steps.md);
     · o valor original é restaurado mesmo se o braço lançar;
     · `medir` deve depender só de (seed, valor) — nenhum estado pode atravessar braços. O
       braço de controle (`controle`) prova isso repetindo o mesmo valor e exigindo igualdade.

   Uso como biblioteca:
     const {varrer,imprimirVarredura}=require("./sweep");
     const linhas=varrer({alvo:X.CFG_SIM,param:"AGR_ABRE",valores:[0,1,2],seed:31415,medir});
*/
const {X}=require("./motor");
const {wilsonIntervalPercent,intervalsDisjoint}=require("../../src/domain/statistics/proportion-interval.mjs");

// Uma métrica é um número puro ou uma proporção {sucessos,total} — esta última ganha IC95%.
const ehProporcao=valor=>!!valor&&typeof valor==="object"&&
  Number.isInteger(valor.sucessos)&&Number.isInteger(valor.total);

function intervaloDe(metrica){
  return ehProporcao(metrica)?wilsonIntervalPercent(metrica.sucessos,metrica.total):null;
}

function textoMetrica(metrica,casas=2){
  if(ehProporcao(metrica)){
    const ic=intervaloDe(metrica);
    if(!ic.n)return "—";
    return `${ic.estimate.toFixed(1)}% [${ic.low.toFixed(1)}–${ic.high.toFixed(1)}]`;
  }
  return typeof metrica==="number"?metrica.toFixed(casas):String(metrica);
}

/* Roda um braço: seed reposta, parâmetro escrito, medida colhida. */
function braco(alvo,param,valor,seed,medir){
  const inicio=Date.now();
  alvo[param]=valor;
  if(X.srand)X.srand(seed);
  const metricas=medir(valor);
  if(!metricas||typeof metricas!=="object")throw new TypeError("medir deve devolver um objeto de métricas");
  return {valor,metricas,segundos:(Date.now()-inicio)/1000};
}

function varrer({alvo,param,valores,seed,medir}){
  if(!alvo||typeof alvo!=="object")throw new TypeError("varredura exige o objeto de configuração");
  if(!(param in alvo))throw new Error(`parâmetro inexistente na configuração: ${param}`);
  if(!Array.isArray(valores)||!valores.length)throw new TypeError("varredura exige ao menos um valor");
  if(!Number.isInteger(seed))throw new TypeError("varredura exige seed inteira: braços pareados");
  if(typeof medir!=="function")throw new TypeError("varredura exige a função medir");
  const original=alvo[param];
  try{
    return valores.map(valor=>braco(alvo,param,valor,seed,medir));
  }finally{
    alvo[param]=original;
  }
}

/* Braço de controle: o mesmo valor medido duas vezes tem que dar exatamente a mesma coisa.
   Se der diferente, algum estado atravessa braços e a varredura inteira é inválida. */
function controle({alvo,param,valor,seed,medir}){
  const [primeiro,segundo]=varrer({alvo,param,valores:[valor,valor],seed,medir});
  const a=JSON.stringify(primeiro.metricas),b=JSON.stringify(segundo.metricas);
  return {igual:a===b,primeiro:primeiro.metricas,segundo:segundo.metricas};
}

/* Impressão: uma linha por braço, uma coluna por métrica. `alvo` (opcional) marca as linhas
   cuja métrica-chave cai na faixa pedida, para a escolha não sair do olho. */
function imprimirVarredura(linhas,{param,chave=null,faixa=null,casas=2}={}){
  const nomes=Object.keys(linhas[0].metricas);
  const largura=nomes.map(nome=>Math.max(nome.length,
    ...linhas.map(linha=>textoMetrica(linha.metricas[nome],casas).length)));
  console.log(`    ${param.padEnd(9)} ${nomes.map((nome,i)=>nome.padStart(largura[i])).join("  ")}`);
  linhas.forEach(linha=>{
    const marca=chave&&faixa?(dentroDaFaixa(linha.metricas[chave],faixa)?"✓":" "):" ";
    const celulas=nomes.map((nome,i)=>textoMetrica(linha.metricas[nome],casas).padStart(largura[i]));
    console.log(`  ${marca} ${String(linha.valor).padEnd(9)} ${celulas.join("  ")}`);
  });
}

function valorDe(metrica){
  if(!ehProporcao(metrica))return metrica;
  const ic=intervaloDe(metrica);
  return ic.n?ic.estimate:null;
}

function dentroDaFaixa(metrica,[min,max]){
  const valor=valorDe(metrica);
  return typeof valor==="number"&&valor>=min&&valor<=max;
}

/* Margem: o quanto a métrica sobra da borda mais próxima da faixa. Serve para não repetir o
   erro registrado no ciclo anterior — promover a gate um critério que passou por um fio. */
function margemNaFaixa(metrica,[min,max]){
  const valor=valorDe(metrica);
  if(typeof valor!=="number")return null;
  return Math.min(valor-min,max-valor);
}

module.exports={varrer,controle,imprimirVarredura,textoMetrica,valorDe,dentroDaFaixa,
  margemNaFaixa,intervaloDe,ehProporcao,intervalsDisjoint};
