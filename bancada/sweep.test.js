/* bancada/sweep.test.js — contratos do harness de varredura e do intervalo de proporção.

   Uma varredura só vale se os braços forem realmente pareados: mesma seed, mesma agenda, e
   nenhum estado atravessando de um braço para o outro. Sem essa prova, qualquer diferença
   medida entre dois valores de um parâmetro pode ser resíduo do braço anterior. */
const assert=require("node:assert/strict");
const {createHash}=require("node:crypto");
const {X,T}=require("./motor");
const {scheduledMatch}=require("./common");
const {varrer,controle,dentroDaFaixa,margemNaFaixa,valorDe,textoMetrica}=require("./sweep");
const {wilsonInterval,wilsonIntervalPercent,intervalsDisjoint,sampleSizeForMargin,Z95}=
  require("../src/domain/statistics/proportion-interval.mjs");

/* ─── 1. intervalo de Wilson contra valores de referência ────────────────── */
const perto=(valor,alvo,tol,rotulo)=>assert.ok(Math.abs(valor-alvo)<=tol,
  `${rotulo}: ${valor} não bate com ${alvo} (tolerância ${tol})`);

// 10/100 é o exemplo canônico do intervalo de Wilson: [0.0553, 0.1744].
const dez=wilsonInterval(10,100);
perto(dez.low,.055231,1e-5,"Wilson 10/100 inferior");
perto(dez.high,.174365,1e-5,"Wilson 10/100 superior");
// zero evento não colapsa o intervalo — é a diferença que importa quando o invicto é raro.
const zero=wilsonInterval(0,20);
assert.equal(zero.low,0,"Wilson com zero evento deveria ter piso zero");
perto(zero.high,.161117,1e-5,"Wilson 0/20 superior");
assert.ok(wilsonInterval(20,20).high<=1,"Wilson não pode ultrapassar 1");

// a propriedade que motivou escolher Wilson: nunca sai de [0,1] e sempre contém a estimativa.
X.srand(4242);
for(let caso=0;caso<2000;caso++){
  const total=1+Math.floor(X.rndF()*400),sucessos=Math.floor(X.rndF()*(total+1));
  const ic=wilsonInterval(sucessos,total);
  assert.ok(ic.low>=0&&ic.high<=1,`Wilson saiu de [0,1] em ${sucessos}/${total}`);
  assert.ok(ic.low<=ic.estimate&&ic.estimate<=ic.high,`Wilson não contém a estimativa em ${sucessos}/${total}`);
}

// precisão encolhe com sqrt(n): é o que justifica a amostra escolhida na suíte de dificuldade.
const largura=n=>wilsonIntervalPercent(Math.round(.05*n),n).margin;
assert.ok(largura(300)>largura(1000)&&largura(1000)>largura(3000),"margem deveria cair com a amostra");
perto(largura(3000),.78,.05,"margem em n=3000");
assert.ok(!intervalsDisjoint(wilsonIntervalPercent(5,300),wilsonIntervalPercent(15,300)),
  "300 campanhas não separam 1,7% de 5% — a suíte antiga era cega e o teste precisa registrar isso");
assert.ok(intervalsDisjoint(wilsonIntervalPercent(45,3000),wilsonIntervalPercent(150,3000)),
  "3000 campanhas deveriam separar 1,5% de 5%");
perto(sampleSizeForMargin(.05,.0078),3000,60,"amostra de planejamento para ±0,78 pp");
perto(Z95,1.96,1e-3,"z de 95%");

assert.throws(()=>wilsonInterval(3,2),/excedem a amostra/,"sucessos acima da amostra deveriam falhar");
assert.throws(()=>wilsonInterval(1.5,10),/inteiras/,"contagem fracionária deveria falhar");
assert.equal(wilsonInterval(0,0).estimate,null,"amostra vazia não tem estimativa");

/* ─── 2. o harness: pareamento, isolamento e restauração ─────────────────── */
const MAPAS=24;
// medida curta e determinística: a digital cobre o placar de todos os jogadores dos dois times,
// então qualquer mudança em QUEM fraga aparece, mesmo sem mudar os agregados.
function medirCurto(){
  const hash=createHash("sha256");
  let kills=0,rounds=0,vitoriasA=0;
  for(let m=0;m<MAPAS;m++){
    const {a,b}=scheduledMatch(T,m%T.length,m);
    const g=X.simularMapa(a,b,X.forcaDoDia(a.ef,a.quim),X.forcaDoDia(b.ef,b.quim));
    rounds+=g.totalRounds;
    if(g.vencedor===a)vitoriasA++;
    [g.statsA,g.statsB].forEach(stats=>stats.forEach(s=>{kills+=s.k;hash.update(`${s.k}/${s.d}/${s.a}|`);}));
  }
  return {digital:hash.digest("hex").slice(0,16),kills,rounds,vitoriasA:{sucessos:vitoriasA,total:MAPAS}};
}

const ORIGINAL=X.CFG_SIM.W_OP_KILL;
const repetido=controle({alvo:X.CFG_SIM,param:"W_OP_KILL",valor:ORIGINAL,seed:31415,medir:medirCurto});
assert.ok(repetido.igual,`braços idênticos divergiram — há estado atravessando a varredura:\n${
  JSON.stringify(repetido.primeiro)}\n${JSON.stringify(repetido.segundo)}`);

// o parâmetro precisa realmente chegar ao motor: mudar o peso muda quem fraga, com a mesma seed.
const linhas=varrer({alvo:X.CFG_SIM,param:"W_OP_KILL",valores:[0,.5],seed:31415,medir:medirCurto});
assert.notEqual(linhas[0].metricas.digital,linhas[1].metricas.digital,
  "mudar o parâmetro não mudou nada: a varredura não estava escrevendo na configuração");
assert.equal(X.CFG_SIM.W_OP_KILL,ORIGINAL,"a varredura não restaurou o valor original");

assert.throws(()=>varrer({alvo:X.CFG_SIM,param:"W_OP_KILL",valores:[.9],seed:1,
  medir:()=>{throw new Error("falha proposital");}}),/falha proposital/);
assert.equal(X.CFG_SIM.W_OP_KILL,ORIGINAL,"a varredura não restaurou o valor após uma falha");

assert.throws(()=>varrer({alvo:X.CFG_SIM,param:"NAO_EXISTE",valores:[1],seed:1,medir:medirCurto}),
  /parâmetro inexistente/,"parâmetro inexistente deveria falhar cedo");
assert.throws(()=>varrer({alvo:X.CFG_SIM,param:"W_OP_KILL",valores:[1],seed:1.5,medir:medirCurto}),
  /seed inteira/,"seed não inteira quebra o pareamento e deveria falhar");

/* ─── 3. leitura da faixa e da margem ────────────────────────────────────── */
const proporcao={sucessos:45,total:1000};
perto(valorDe(proporcao),4.5,1e-9,"leitura de proporção");
assert.ok(dentroDaFaixa(proporcao,[4,6]),"4,5% deveria estar na faixa 4–6");
perto(margemNaFaixa(proporcao,[4,6]),.5,1e-9,"margem até a borda mais próxima");
assert.ok(margemNaFaixa({sucessos:41,total:1000},[4,6])<margemNaFaixa(proporcao,[4,6]),
  "margem deveria denunciar quem passou por um fio");
assert.match(textoMetrica(proporcao),/4\.5% \[/,"proporção deveria sair com intervalo");

console.log("— HARNESS DE VARREDURA —");
console.log(`  ✓ Wilson bate com a referência e nunca sai de [0,1] (2000 casos aleatórios)`);
console.log(`  ✓ 300 campanhas não separam 1,7% de 5%; 3000 separam 1,5% de 5%`);
console.log(`  ✓ braços pareados com a mesma seed: digital ${repetido.primeiro.digital} repetida`);
console.log(`  ✓ parâmetro chega ao motor e é restaurado, inclusive após falha`);
console.log("✓ varredura pareada e intervalo de proporção sob contrato");
