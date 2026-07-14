/* bancada/estilo.js - valida a fidelidade dos PLAYSTYLES do modelo vs realidade.
   Le o playstyle que o motor da a cada jogador no CONTEXTO do seu elenco real
   (ja aplicado na construcao de X.TEAMS) e compara com o corpus de rotulos
   tolerantes (bancada/estilo-corpus.json).

   Chave = 'nome · camp' (mesmo esquema de role-corpus.json).
   Estilo e MAIS fuzzy que funcao: os 'aceitavel' sao generosos de proposito,
   entao a nota cheia e rara e o piso e folgado.

   Nota composta (0..1): certo=1.0 · aceitavel=0.6 · miss=0.
   INFORMATIVO por enquanto (nao entra no gate do run.js) — os rotulos ainda
   estao em validacao. Piso existe so pra sinalizar regressao grosseira.

   Uso: node bancada/estilo.js
*/
const {X}=require("./motor");
const CORPUS=require("./estilo-corpus.json");

const PISO=0.55; // estilo e subjetivo; gate folgado, so pega regressao clara

let cobertos=0,total=0,soma=0;
let hits=0,parciais=0,misses=0;
const detalhes=[];

X.TEAMS.forEach(t=>{
  const labels=CORPUS[`${t.nome} · ${t.camp}`]||{};
  t.jogadores.forEach(card=>{
    const e=card._eng;
    total++;
    const lab=labels[e.nome||e.nick];
    if(!lab)return;
    cobertos++;
    const eff=X.STYLE_LABEL(e.playstyle), acc=lab.aceitavel||[];
    let nota,tag;
    if(eff===lab.certo){nota=1.0;tag="ok";hits++;}
    else if(acc.includes(eff)){nota=0.6;tag="parcial";parciais++;}
    else{nota=0;tag="MISS";misses++;}
    soma+=nota;
    if(tag!=="ok")detalhes.push({key:`${e.nome||e.nick} @ ${t.nome}`,esperado:lab.certo,acc,teve:eff,tag,nota});
  });
});

const nota=cobertos?soma/cobertos:0;
console.log("— PLAYSTYLES REAIS (fidelidade de estilos vs corpus) —");
console.log(`  cobertura: ${cobertos}/${total} rotulados (${Math.round(cobertos/total*100)}%)`);
console.log(`  concordancia media (0..1): ${nota.toFixed(3)}   [piso ${PISO}, informativo]`);
console.log(`  cheios: ${hits} · parciais: ${parciais} · miss: ${misses}`);
if(detalhes.length){
  console.log("\n  divergencias (o que o corpus enxerga que o modelo nao):");
  detalhes.sort((a,b)=>a.nota-b.nota).forEach(d=>{
    const alvo=d.acc.length?`${d.esperado} (ac: ${d.acc.join("/")})`:d.esperado;
    console.log(`    ${d.tag.padEnd(7)} ${d.key.padEnd(26)} real=${alvo.padEnd(34)} motor=${d.teve}`);
  });
}
if(nota<PISO){
  console.log(`\n✗ fidelidade de estilos abaixo do piso (${nota.toFixed(3)}<${PISO}) — regressao clara`);
  process.exitCode=1;
}else{
  console.log(`\n✓ fidelidade de estilos dentro do piso`);
}
