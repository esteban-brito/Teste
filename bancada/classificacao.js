/* bancada/classificacao.js — o medidor da reformulação de funções e playstyles.

   `snapshot.js` reprova qualquer deriva, linha a linha. Isso serve de trava, mas não serve
   para CONDUZIR uma reformulação: ele não diz quantos jogadores mudaram, nem o que mudou em
   cada um, nem se a identidade ficou mais nítida ou mais borrada.

   Esta ferramenta mede as DUAS coisas que a reformulação persegue ao mesmo tempo:

     1. ESTABILIDADE — quantos dos 85 mudam de classificação contra o snapshot aprovado,
        separado por tipo de mudança (função primária, secundária, playstyle, OVR);
     2. NITIDEZ — a margem com que cada playstyle é decidido, ou seja, a distância entre o
        1º e o 2º estilo colocado.

   A nitidez importa porque a classificação hoje é decidida no quarto decimal: medido em
   28/07/2026, 45 dos 85 jogadores estavam a menos de 0,05 de virar outro estilo, e um deles
   a 0,0000. Um modelo assim embaralha identidades a cada recalibragem, e o rótulo informa
   menos do que aparenta. Reformular só "padronizando" os pesos sem olhar a margem trocaria
   um conjunto de rótulos frágeis por outro.

   NÃO é uma suíte e não entra no `run.js`: o gate de deriva continua sendo o `snapshot.js`.
   Esta é a bancada de trabalho da reformulação — como `r5-experiment.js` é para o rating.

   Uso:  node bancada/classificacao.js
         CLASSIFICACAO_LIMITE=20 node bancada/classificacao.js   (limite acordado com o dono)
         node bancada/classificacao.js --frageis 20              (lista os N mais frágeis) */
const fs=require("fs");
const path=require("path");
const {X}=require("./motor");
const {mean,okMark}=require("./common");

const SNAP=path.join(__dirname,"roster-snapshot.json");
// Teto de mudanças acordado com o responsável em 28/07/2026: até ~20 dos 85 podem trocar de
// classificação numa reformulação. Acima disso, a reformulação não passa — ver docs do ciclo.
const LIMITE=+(process.env.CLASSIFICACAO_LIMITE||20);
const idx=process.argv.indexOf("--frageis");
const N_FRAGEIS=idx>=0?+(process.argv[idx+1]||10):10;

/* O snapshot guarda uma string "Função/Secundária·Estilo·OVR". Separar em campos é o que
   permite dizer QUE TIPO de mudança aconteceu, em vez de só "essa linha mudou". */
function partes(linha){
  if(typeof linha!=="string")return null;
  const [funcoes="",estilo="",ovr=""]=linha.split("·");
  const [primaria="",secundaria=""]=funcoes.split("/");
  return {primaria,secundaria,estilo,ovr};
}

const atual={},rotulos={},margens=[];
X.TEAMS.forEach(time=>time.jogadores.forEach(carta=>{
  const p=carta._eng,id=p.id||p.nome,ev=X.avaliarJogador({...p});
  rotulos[id]=`${time.nome}/${p.nome}`;
  // mesma composição do snapshot.js: a comparação tem que ser maçã com maçã
  atual[id]=`${ev.role1||ev.combatRole}/${ev.role2||ev.secundario}·${X.STYLE_LABEL(ev.playstyle)}·${Math.round(ev.ovr)}`;
  // a margem vem do estado CONTEXTUAL (o que o jogo usa): styleMatch guarda matchMargin
  const m=p.style&&p.style.matchMargin;
  margens.push({nick:p.nick||p.nome,id,estilo:X.STYLE_ID(p.playstyle),margem:typeof m==="number"?m:null});
}));

const total=Object.keys(atual).length;
console.log(`— CLASSIFICAÇÃO (${total} jogadores) —\n`);

/* ─── 1. ESTABILIDADE ────────────────────────────────────────────────────── */
if(!fs.existsSync(SNAP)){
  console.log("  sem snapshot aprovado — rode: npm run snapshot:update");
}else{
  const aprovado=JSON.parse(fs.readFileSync(SNAP,"utf8"));
  const chaves=new Set([...Object.keys(aprovado),...Object.keys(atual)]);
  const contagem={primaria:0,secundaria:0,estilo:0,ovr:0};
  const tocados=[];
  for(const chave of chaves){
    if(aprovado[chave]===atual[chave])continue;
    const antes=partes(aprovado[chave]),depois=partes(atual[chave]);
    const campos=[];
    if(!antes||!depois)campos.push(antes?"sumiu":"novo");
    else{
      if(antes.primaria!==depois.primaria){contagem.primaria++;campos.push("função");}
      if(antes.secundaria!==depois.secundaria){contagem.secundaria++;campos.push("secundária");}
      if(antes.estilo!==depois.estilo){contagem.estilo++;campos.push("estilo");}
      if(antes.ovr!==depois.ovr){contagem.ovr++;campos.push("OVR");}
    }
    tocados.push({chave,campos,antes:aprovado[chave]||"(novo)",depois:atual[chave]||"(sumiu)"});
  }
  console.log("  MUDANÇAS contra o snapshot aprovado");
  console.log(`    função primária ${String(contagem.primaria).padStart(3)}`);
  console.log(`    função secundária ${String(contagem.secundaria).padStart(1)}`);
  console.log(`    playstyle       ${String(contagem.estilo).padStart(3)}`);
  console.log(`    OVR             ${String(contagem.ovr).padStart(3)}`);
  const dentro=tocados.length<=LIMITE;
  console.log(`    jogadores tocados ${String(tocados.length).padStart(2)} de ${total}   [limite acordado: ${LIMITE}]  ${okMark(dentro)}`);
  if(tocados.length){
    console.log("\n  QUEM MUDOU (cada um precisa de explicação antes de regravar o snapshot)");
    tocados.sort((a,b)=>b.campos.length-a.campos.length).forEach(t=>{
      console.log(`    ${(rotulos[t.chave]||t.chave).padEnd(22)} [${t.campos.join("+")}]`);
      console.log(`      ${t.antes}  ->  ${t.depois}`);
    });
  }
}

/* ─── 2. NITIDEZ ─────────────────────────────────────────────────────────── */
const comMargem=margens.filter(m=>m.margem!==null).sort((a,b)=>a.margem-b.margem);
console.log(`\n  NITIDEZ DA IDENTIDADE (distância entre o 1º e o 2º estilo colocado)`);
if(!comMargem.length)console.log("    nenhuma margem disponível");
else{
  const vals=comMargem.map(m=>m.margem);
  const mediana=vals[Math.floor(vals.length/2)];
  console.log(`    média ${mean(vals).toFixed(4)} · mediana ${mediana.toFixed(4)} · mínima ${vals[0].toFixed(4)} · máxima ${vals[vals.length-1].toFixed(4)}`);
  const faixas=[.01,.02,.05,.10];
  console.log("    a um empurrão de virar de estilo:");
  faixas.forEach(f=>{
    const n=vals.filter(v=>v<f).length;
    console.log(`      margem < ${f.toFixed(2)}: ${String(n).padStart(3)} jogador(es)  ${(100*n/vals.length).toFixed(0)}%`);
  });
  console.log(`\n    os ${N_FRAGEIS} mais frágeis (os primeiros a virar em qualquer mudança de receita):`);
  comMargem.slice(0,N_FRAGEIS).forEach(m=>
    console.log(`      ${m.nick.padEnd(16)} ${m.estilo.padEnd(13)} ${m.margem.toFixed(4)}`));
}

/* ─── 3. DISTRIBUIÇÃO ────────────────────────────────────────────────────── */
// perfis.js exige MIN_JOGADORES=3 por estilo para o critério daquele estilo valer. Um estilo
// que cai abaixo disso não reprova nada — ele SOME da validação, o que é pior: a suíte fica
// verde tendo deixado de checar. Por isso a distribuição é parte do medidor.
const MIN_PERFIS=3;
const porFuncao={},porEstilo={};
X.TEAMS.forEach(t=>t.jogadores.forEach(c=>{
  const p=c._eng;
  porFuncao[p.primario]=(porFuncao[p.primario]||0)+1;
  const id=X.STYLE_ID(p.playstyle);
  porEstilo[id]=(porEstilo[id]||0)+1;
}));
console.log("\n  DISTRIBUIÇÃO");
console.log("    função primária: "+Object.entries(porFuncao).sort((a,b)=>b[1]-a[1])
  .map(([k,v])=>`${k} ${v}`).join(" · "));
const estilos=Object.entries(porEstilo).sort((a,b)=>b[1]-a[1]);
console.log("    playstyle:");
estilos.forEach(([k,v])=>{
  const aviso=v<MIN_PERFIS?`  ✗ abaixo de ${MIN_PERFIS}: critério de ${k} sai da validação`
    :v===MIN_PERFIS?`  ~ no limite de ${MIN_PERFIS}`:"";
  console.log(`      ${k.padEnd(14)}${String(v).padStart(3)}${aviso}`);
});
const semAmostra=estilos.filter(([,v])=>v<MIN_PERFIS).length;
if(semAmostra)console.log(`    ${semAmostra} estilo(s) sem amostra para validar — não pioram sem que alguém veja`);
