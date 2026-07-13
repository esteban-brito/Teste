/* bancada/role.js - valida a fidelidade das FUNCOES do modelo vs realidade.
   Roda distribuirRoles no CONTEXTO de cada elenco real (ja aplicado na
   construcao de X.TEAMS) e compara a funcao de combate que o motor da a
   cada jogador com o corpus de rotulos tolerantes (bancada/role-corpus.json,
   fonte unica compartilhada com o painel do sandbox).

   Chave = 'nome · camp' (a funcao e contextual: ha dois FURIA e dois Spirit).
   IGL e curado (isIGL): valida-se o SECUNDARIO (funcao de combate).

   Nota composta (0..1): certo=1.0 · aceitavel=0.6 · 2a-funcao=0.4 · miss=0 · proibido=-1.
   Gate leve: falha so se a concordancia cair abaixo de PISO (regressao clara).

   Uso: node bancada/role.js
*/
const {X}=require("./motor");
const CORPUS=require("./role-corpus.json");

const PISO=0.70; // piso de regressao (atual ~0.82); corpus e parcialmente subjetivo, entao o gate e folgado

function combatRole(e){return e.isIGL?e.secundario:e.primario;}

let cobertos=0,total=0,soma=0;
let hits=0,parciais=0,secundarios=0,misses=0,violacoes=0;
const detalhes=[];

X.TEAMS.forEach(t=>{
  const labels=CORPUS[`${t.nome} · ${t.camp}`]||{};
  t.jogadores.forEach(card=>{
    const e=card._eng;
    total++;
    const lab=labels[e.nome||e.nick];
    if(!lab)return;
    cobertos++;
    const eff=combatRole(e), acc=lab.aceitavel||[], prob=lab.proibido||[];
    let nota,tag;
    if(eff===lab.certo){nota=1.0;tag="ok";hits++;}
    else if(acc.includes(eff)){nota=0.6;tag="parcial";parciais++;}
    else if(!e.isIGL&&lab.certo===e.secundario){nota=0.4;tag="2a-funcao";secundarios++;}
    else if(prob.includes(eff)){nota=-1;tag="PROIBIDO";violacoes++;}
    else{nota=0;tag="MISS";misses++;}
    soma+=nota;
    if(tag!=="ok")detalhes.push({key:`${e.nome||e.nick} @ ${t.nome}`,esperado:lab.certo,acc,teve:eff,tag,nota});
  });
});

const nota=cobertos?soma/cobertos:0;
console.log("— FUNCOES REAIS (fidelidade de roles vs corpus) —");
console.log(`  cobertura: ${cobertos}/${total} rotulados (${Math.round(cobertos/total*100)}%)`);
console.log(`  concordancia media (0..1): ${nota.toFixed(3)}   [piso ${PISO}]`);
console.log(`  cheios: ${hits} · parciais: ${parciais} · 2a-funcao: ${secundarios} · miss: ${misses} · proibido: ${violacoes}`);
if(detalhes.length){
  console.log("\n  divergencias (o que o corpus enxerga que o modelo nao):");
  detalhes.sort((a,b)=>a.nota-b.nota).forEach(d=>{
    const alvo=d.acc.length?`${d.esperado} (ac: ${d.acc.join("/")})`:d.esperado;
    console.log(`    ${d.tag.padEnd(9)} ${d.key.padEnd(26)} real=${alvo}  motor=${d.teve}`);
  });
}
if(nota<PISO||violacoes>0){
  console.log(`\n✗ fidelidade de roles abaixo do piso (${nota.toFixed(3)}<${PISO}) ou com violacao`);
  process.exitCode=1;
}else{
  console.log("\n✓ fidelidade de roles dentro do piso");
}
