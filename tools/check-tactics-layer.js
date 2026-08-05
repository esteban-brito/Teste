/* Prova os contratos da camada tática — a que DECIDE.
   ══════════════════════════════════════════════════════════════════════════════

   POR QUE ISTO EXISTE. `src/domain/tactics/` conclui coisas fortes: que a FaZe é
   o time mais rápido e menos estruturado da liga, que a BIG é a mais lenta e
   estruturada, que um adversário previsível pode ser lido. Essas conclusões só
   valem se ninguém as tiver digitado, e se o modelo souber também estar errado.

   O risco não é teórico: escrever "esse time é agressivo" é a forma mais natural
   de "melhorar" um modelo tático, e é a mesma curadoria que já foi banida do
   motor quando `TIER_LENDA` e `TIER_STAR` saíram por serem baseados em nome.

   A guarda ataca por dois lados, porque um só não basta:

     ESTÁTICO   — nenhum nick nem nome de elenco pode aparecer no CÓDIGO de
                  nenhum módulo da camada. Comentários são varridos antes, de
                  propósito: citar um jogador para explicar um conceito é
                  legítimo, ramificar por ele não é.
     DINÂMICO   — trocar TODOS os nicks e nomes de elenco não pode mover nenhum
                  eixo. Se o estático falhar por uma grafia não prevista, este
                  pega.

   A CHAVE DESLIGADA É O CONTRATO. Desde 04/08/2026 a camada está ligada ao
   motor, mas `CFG_TATICA.ATIVA` sai de fábrica em 0: nenhuma linha dela executa,
   nenhuma amostra de RNG a mais é consumida, e `simulation-golden` continua bit
   a bit idêntico. Este checador exige que continue assim.

   LIGAR A CHAVE É BALANCEAMENTO, não configuração de conveniência: muda o
   resultado das partidas e exige commit próprio, comparação pareada nas mesmas
   seeds e os dois indicadores acumulados (`Favorito gap 16+` e `invicto`)
   reportados antes e depois, juntos. Ao ligá-la, ATUALIZE esta asserção na MESMA
   fatia — ela é um marco deliberado, não um obstáculo. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {execFileSync}=require("node:child_process");
const {pathToFileURL}=require("node:url");
const {ROOT}=require("../bancada/lib/common");

const CAMADA="src/domain/tactics";
const EIXOS=["ritmo","estrutura","utilitaria","leitura","dependencia"];

/** Tira comentários de bloco e de linha: o que resta é código executável. */
function apenasCodigo(fonte){
  return fonte.replace(/\/\*[\s\S]*?\*\//g,"").replace(/\/\/.*$/gm,"");
}

/* Nomes com menos de 3 caracteres ficam de fora: "G2", "SK" e "BIG" casariam com
   ruído sem provar nada, e um atalho por nome usaria o nome inteiro de qualquer
   forma. As bordas evitam o falso positivo por prefixo — a mesma armadilha que
   fez `.rating` casar dentro de `.ratingImpact` numa busca deste mesmo dia. */
function nomesNoCodigo(fonte,nomes){
  const codigo=apenasCodigo(fonte);
  return nomes.filter(nome=>nome&&nome.length>=3&&
    new RegExp(`(?<![\\w])${nome.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}(?![\\w])`).test(codigo));
}

const versionados=()=>execFileSync("git",["ls-files","--cached","--others","--exclude-standard"],
  {cwd:ROOT,encoding:"utf8"}).trim().split("\n").map(l=>l.trim()).filter(Boolean);

/** Módulos da camada, descobertos no disco: um arquivo novo entra coberto. */
function modulosDaCamada(){
  const dir=path.join(ROOT,CAMADA);
  if(!fs.existsSync(dir))return [];
  return fs.readdirSync(dir).filter(nome=>nome.endsWith(".mjs")).sort()
    .map(nome=>`${CAMADA}/${nome}`);
}

/* Consumidores DECLARADOS: quem pode importar a camada sem quebrar a Fase 0.
   Cada entrada precisa de motivo, no espírito de `REFERENCIAS_DECLARADAS` em
   check-doc-links e de `DIVERGENCIAS` no catálogo — exceção sem motivo escrito
   apodrece e vira permissão permanente que ninguém revisa.

   O critério é único: o arquivo OBSERVA a camada sem que o jogo mude por isso.
   Uma bancada de trabalho lê a identidade para medir; ela não simula diferente
   por causa disso, e `snapshot`/`simulation-golden` continuam provando. */
const CONSUMIDORES_DECLARADOS=new Map([
  ["bancada/ferramentas/tatica-baseline.js",
    "bancada de caracterização: lê a identidade para medir o que ela explica hoje, "+
    "e não alimenta o motor com ela. Ver docs/ciclos/tatica-baseline-2026-08-04.md"],
  ["src/public/simulation-api.mjs",
    "compõe a sessão tática e o fluxo de RNG PRÓPRIO dela, derivado do seed da "+
    "sessão. Sem fluxo separado, ligar a decisão consumiria amostras do combate"]
]);

/* `map-simulation.mjs` NÃO entra na lista acima, e a ausência é informação: ele
   não importa a camada, recebe `deps.tactics` por injeção, como todo o resto do
   domínio. O que precisa ser provado ali é outra coisa — que o uso está fechado
   por chave —, e isso é asserção de comportamento, não de caminho. */
const MOTOR="src/domain/simulation/map-simulation.mjs";

/** Quem importa a camada hoje, fora dela mesma, de tools/ e dos declarados. */
function consumidores(){
  return versionados().filter(arquivo=>{
    if(!/\.(mjs|js|html)$/.test(arquivo))return false;
    if(arquivo.startsWith(CAMADA)||arquivo.startsWith("tools/"))return false;
    if(CONSUMIDORES_DECLARADOS.has(arquivo))return false;
    const absoluto=path.join(ROOT,arquivo);
    if(!fs.existsSync(absoluto))return false;
    return fs.readFileSync(absoluto,"utf8").includes("tactics/");
  });
}

/** A exceção também é dívida: quando o arquivo declarado some ou deixa de
    importar a camada, a entrada tem de sair — senão vira porta aberta. */
function declaracoesObsoletas(){
  return [...CONSUMIDORES_DECLARADOS.keys()].filter(arquivo=>{
    const absoluto=path.join(ROOT,arquivo);
    if(!fs.existsSync(absoluto))return true;
    return !fs.readFileSync(absoluto,"utf8").includes("tactics/");
  });
}

function autoteste(){
  assert.deepEqual(nomesNoCodigo("const x=1; // s1mple manda",["s1mple"]),[],
    "nick citado em COMENTÁRIO não pode ser acusado");
  assert.deepEqual(nomesNoCodigo("/* o caso do s1mple */ const x=1;",["s1mple"]),[],
    "nick citado em comentário de BLOCO não pode ser acusado");
  assert.deepEqual(nomesNoCodigo('if(j.nick==="s1mple")return 9;',["s1mple"]),["s1mple"],
    "nick usado no CÓDIGO precisa ser acusado");
  assert.deepEqual(nomesNoCodigo("const s1mpleton=1;",["s1mple"]),[],
    "prefixo dentro de outra palavra não é uso do nick");
  assert.deepEqual(nomesNoCodigo("const x=1;",["Spirit"]),[],
    "código limpo não pode ser acusado");
}

/* ——— identidade tática ——— */
function provarIdentidade(M,A){
  ["teamIdentityRaw","computeIdentityMeans","teamIdentity","teamAggression"].forEach(nome=>
    assert.equal(typeof M[nome],"function",`${nome} ausente do módulo de identidade`));

  const elencos=A.TEAMS.map(time=>time.jogadores);
  const medias=M.computeIdentityMeans(elencos);
  const perfis=elencos.map(elenco=>M.teamIdentity(elenco,medias));

  const antes=JSON.parse(JSON.stringify(elencos[0].map(carta=>carta._eng)));
  assert.deepEqual(M.teamIdentityRaw(elencos[0]),M.teamIdentityRaw(elencos[0]),
    "identidade tática não é determinística");
  assert.deepEqual(JSON.parse(JSON.stringify(elencos[0].map(carta=>carta._eng))),antes,
    "identidade tática MUTOU o jogador que recebeu");

  const quase=(a,b,rotulo)=>EIXOS.forEach(eixo=>assert.ok(Math.abs(a[eixo]-b[eixo])<1e-12,
    `${rotulo}: eixo ${eixo} mudou (${a[eixo]} vs ${b[eixo]})`));
  quase(M.teamIdentityRaw(elencos[0]),M.teamIdentityRaw([...elencos[0]].reverse()),
    "a ordem dos cinco jogadores mudou a identidade");

  const anonimo=elencos.map((elenco,ti)=>elenco.map((carta,pi)=>({
    ...carta,nick:`X${ti}_${pi}`,nome:`X${ti}_${pi}`,
    _eng:{...carta._eng,nick:`X${ti}_${pi}`,nome:`X${ti}_${pi}`,id:`X${ti}_${pi}`}
  })));
  const mediasAnon=M.computeIdentityMeans(anonimo);
  anonimo.forEach((elenco,i)=>quase(M.teamIdentity(elenco,mediasAnon),perfis[i],
    `elenco ${i} mudou de identidade só por trocar os nicks`));

  EIXOS.forEach(eixo=>{
    const media=perfis.reduce((soma,p)=>soma+p[eixo],0)/perfis.length;
    assert.ok(Math.abs(media)<1e-12,`eixo ${eixo} não está zero-centrado (média ${media})`);
  });

  const semIgl=elencos[0].map(carta=>({...carta,_eng:{...carta._eng,isIGL:false,primario:"Rifler"}}));
  assert.equal(M.teamIdentityRaw(semIgl).leitura,0,
    "sem IGL, leitura precisa ser exatamente 0 — o time não lê pior, ele não tem quem leia");
  return elencos.length;
}

/* ——— modelo do oponente ——— */
function provarModelo(O){
  ["criarModeloOponente","esquecerTudo","observar","crenca","palpite","meiaVidaEfetiva"]
    .forEach(nome=>assert.equal(typeof O[nome],"function",`${nome} ausente do modelo do oponente`));

  // sem evidência, o modelo diz "não sei" — nunca um palpite qualquer
  const vazio=O.criarModeloOponente();
  assert.equal(O.palpite(vazio,"CT","direcao"),null,
    "sem observação, o palpite precisa ser null e não um chute");
  assert.equal(O.crenca(vazio,"CT","direcao").confianca,0,"crença vazia com confiança > 0");

  // determinismo
  const a=O.criarModeloOponente(),b=O.criarModeloOponente();
  for(let i=0;i<7;i++){
    const valor=i%3===0?"B":"A";
    O.observar(a,"TR",{direcao:valor});O.observar(b,"TR",{direcao:valor});
  }
  assert.deepEqual(O.crenca(a,"TR","direcao"),O.crenca(b,"TR","direcao"),
    "modelo do oponente não é determinístico");

  // os dois lados não se contaminam
  assert.equal(O.palpite(a,"CT","direcao"),null,
    "observação no TR vazou para a memória de CT — os dois lados são jogos diferentes");

  // adversário PREVISÍVEL vira leitura; IMPREVISÍVEL não
  const previsivel=O.criarModeloOponente(),caotico=O.criarModeloOponente();
  for(let i=0;i<12;i++){
    O.observar(previsivel,"TR",{direcao:"A"});
    O.observar(caotico,"TR",{direcao:i%2?"A":"B"});
  }
  const cPrev=O.crenca(previsivel,"TR","direcao"),cCaos=O.crenca(caotico,"TR","direcao");
  assert.equal(cPrev.moda,"A","adversário que sempre vai no mesmo lugar precisa ser lido");
  assert.ok(cPrev.confianca>.60,
    `adversário previsível deu confiança baixa (${cPrev.confianca.toFixed(3)})`);
  assert.ok(cCaos.confianca<.15,
    `adversário 50/50 foi "lido" com confiança ${cCaos.confianca.toFixed(3)} — quem mistura não pode ser lido`);

  // O MODELO ESQUECE: mudou o padrão, a crença antiga apodrece
  const virou=O.criarModeloOponente();
  for(let i=0;i<10;i++)O.observar(virou,"TR",{direcao:"A"});
  assert.equal(O.crenca(virou,"TR","direcao").moda,"A","padrão inicial não foi aprendido");
  for(let i=0;i<6;i++)O.observar(virou,"TR",{direcao:"B"});
  assert.equal(O.crenca(virou,"TR","direcao").moda,"B",
    "o modelo não esqueceu: seis rounds do padrão novo não venceram dez do antigo");

  // quem lê melhor reage mais rápido, dentro de limites plausíveis
  const rapido=O.meiaVidaEfetiva(1),lento=O.meiaVidaEfetiva(-1),neutro=O.meiaVidaEfetiva(0);
  assert.ok(rapido<neutro&&neutro<lento,"o eixo `leitura` não encurta a meia-vida");
  assert.ok(rapido>=O.CFG_PADRAO.MEIA_VIDA_MIN&&lento<=O.CFG_PADRAO.MEIA_VIDA_MAX,
    "meia-vida efetiva saiu dos limites plausíveis");

  // esquecerTudo preserva a identidade do objeto
  const ref=O.criarModeloOponente();
  O.observar(ref,"CT",{direcao:"A"});
  assert.equal(O.esquecerTudo(ref),ref,"esquecerTudo trocou o objeto em vez de limpá-lo");
  assert.equal(O.palpite(ref,"CT","direcao"),null,"esquecerTudo não limpou a memória");
}

/* ——— decisão de round ——— */
function provarPlano(P){
  ["planejarRound","confrontoDePlanos","mixagem","fidelidade"].forEach(nome=>
    assert.equal(typeof P[nome],"function",`${nome} ausente da decisão de round`));

  // gerador determinístico próprio do teste: as asserções são estatísticas e
  // precisam ser reproduzíveis sem depender do RNG do produto.
  const lcg=semente=>()=>{semente=(semente*1664525+1013904223)>>>0;return semente/4294967296;};
  const amostrar=(n,fn)=>{const r=lcg(12345);const saida=[];for(let i=0;i<n;i++)saida.push(fn(r));return saida;};
  const fracao=(lista,teste)=>lista.filter(teste).length/lista.length;

  assert.throws(()=>P.planejarRound({identidade:{},lado:"TR"}),/gerador/,
    "planejar sem gerador precisa falhar alto, não sortear escondido");

  // sem crença, a direção é moeda honesta — o time não finge saber
  const semCrenca=amostrar(600,random=>P.planejarRound({
    identidade:{},lado:"TR",crenca:null,contexto:{},random}));
  const pA=fracao(semCrenca,p=>p.direcao==="A");
  assert.ok(Math.abs(pA-.5)<.07,`sem crença a direção não é moeda honesta (A em ${(pA*100).toFixed(1)}%)`);
  assert.ok(semCrenca.every(p=>!p.leituraUsada),"plano sem crença marcou leitura como usada");

  /* OS DOIS LADOS sem crença. Cobrir só o TR deixou passar um estouro real: o
     ramo do CT lia `crenca.moda` sem checar, e "CT sem leitura" é o estado do
     round 1 de TODO mapa. Uma guarda só vê a superfície em que roda. */
  for(const lado of ["CT","TR"]){
    const cego=amostrar(400,random=>P.planejarRound({identidade:{},lado,crenca:null,contexto:{},random}));
    const p=fracao(cego,x=>x.direcao==="A");
    assert.ok(Math.abs(p-.5)<.08,`${lado} sem crença não é moeda honesta (A em ${(p*100).toFixed(1)}%)`);
    assert.ok(cego.every(x=>x.direcao==="A"||x.direcao==="B"),`${lado} sem crença devolveu direção inválida`);
  }
  for(const lado of ["CT","TR"]){
    const semModa=()=>P.planejarRound({identidade:{},lado,crenca:{moda:null,confianca:.9},
      contexto:{},random:()=>.5});
    assert.doesNotThrow(semModa,`${lado} estoura quando a crença existe mas não tem moda`);
  }

  // com crença forte: o CT COINCIDE, o T DIVERGE — o sentido muda com o lado
  const crenca={moda:"A",confianca:.9};
  const identidadeFirme={estrutura:1,leitura:0};
  const ct=amostrar(600,random=>P.planejarRound({
    identidade:identidadeFirme,lado:"CT",crenca,contexto:{},random}));
  const tr=amostrar(600,random=>P.planejarRound({
    identidade:identidadeFirme,lado:"TR",crenca,contexto:{},random}));
  assert.ok(fracao(ct,p=>p.direcao==="A")>.60,
    "o CT não concentrou onde acredita que o T vai — acertar, no CT, é coincidir");
  assert.ok(fracao(tr,p=>p.direcao==="B")>.60,
    "o T não evitou o lado que acredita fechado — acertar, no T, é divergir");

  /* O PISO DE CONFIANÇA, medido EXATO e não por proxy estatístico. A primeira
     versão amostrava a direção com confiança .05 e exigia desvio menor que 7 pp
     — mas o desvio, se o piso fosse ignorado, seria de 2 pp. O teste não
     conseguia ver o defeito que dizia cobrir, e só descobri isso ao injetá-lo.
     Tolerância maior que o efeito é uma asserção que não sabe reprovar. */
  const piso=P.CFG_PADRAO.CONF_MIN;
  const fixo=()=>.5;
  assert.equal(P.planejarRound({identidade:{},lado:"CT",
    crenca:{moda:"A",confianca:piso-1e-6},contexto:{},random:fixo}).leituraUsada,false,
    "abaixo do piso de confiança o time apostou na leitura");
  assert.equal(P.planejarRound({identidade:{},lado:"CT",
    crenca:{moda:"A",confianca:piso+1e-6},contexto:{},random:fixo}).leituraUsada,true,
    "acima do piso de confiança o time ignorou a leitura");
  assert.equal(P.planejarRound({identidade:{},lado:"CT",
    crenca:{moda:"A",confianca:piso-1e-6},contexto:{},random:fixo}).aposta,0,
    "abaixo do piso a aposta precisa ser exatamente 0");

  // estrutura decide se o plano vira realidade
  const solto=amostrar(500,random=>P.planejarRound({
    identidade:{estrutura:-1},lado:"TR",crenca:null,contexto:{},random}));
  const firme=amostrar(500,random=>P.planejarRound({
    identidade:{estrutura:1},lado:"TR",crenca:null,contexto:{},random}));
  assert.ok(fracao(solto,p=>!p.executou)>fracao(firme,p=>!p.executou)+.15,
    "time sem estrutura precisa falhar a execução com mais frequência que um estruturado");

  // quem lê melhor também mistura melhor, e os limites seguram os extremos
  assert.ok(P.mixagem({leitura:1})>P.mixagem({leitura:-1}),
    "o eixo `leitura` não aumenta a imprevisibilidade deliberada");
  [-9,0,9].forEach(v=>{
    assert.ok(P.mixagem({leitura:v})>=0&&P.mixagem({leitura:v})<=1,"mixagem saiu de [0,1]");
    assert.ok(P.fidelidade({estrutura:v})>0&&P.fidelidade({estrutura:v})<1,"fidelidade saiu de (0,1)");
  });

  // o confronto empurra os botões do motor, e o empurrão é LIMITADO
  const planoT={direcao:"A",tempo:"rapido",comprometimento:"stack",utilitaria:"gastar"};
  const acertou=P.confrontoDePlanos(planoT,{direcao:"A",tempo:"lento",comprometimento:"stack",utilitaria:"guardar"});
  const errou=P.confrontoDePlanos(planoT,{direcao:"B",tempo:"lento",comprometimento:"stack",utilitaria:"guardar"});
  assert.equal(acertou.ctAcertou,true,"stack no mesmo lado não foi contado como acerto do CT");
  assert.ok(acertou.vantagemAberturaT<0&&errou.vantagemAberturaT>0,
    "acertar a leitura precisa doer no T, e errar precisa abrir espaço para ele");
  for(const r of [acertou,errou]){
    assert.ok(Math.abs(r.vantagemAberturaT)<=.06&&Math.abs(r.vantagemPlantT)<=.05&&
      Math.abs(r.ritmoContato)<=.17,
      "o confronto de planos passou de um empurrão: isso viraria um motor paralelo");
  }
  assert.deepEqual(P.confrontoDePlanos(null,null).ctAcertou,false,
    "confronto sem planos precisa devolver neutro, não quebrar");
}

async function main(){
  autoteste();
  const modulos=modulosDaCamada();
  assert.ok(modulos.length>=2,"camada tática sumiu do disco");

  const A=await import(pathToFileURL(path.join(ROOT,"src/public/evaluation-api.mjs")).href);
  const nomes=[...new Set([...Object.values(A.POOL).map(j=>j.nick),...A.TEAMS.map(t=>t.nome)])];

  // ——— ESTÁTICO: nenhum nome, nenhuma aleatoriedade, em módulo NENHUM ———
  for(const modulo of modulos){
    const fonte=fs.readFileSync(path.join(ROOT,modulo),"utf8");
    const curadoria=nomesNoCodigo(fonte,nomes);
    assert.deepEqual(curadoria,[],
      `${modulo} ramifica por nome — isso é curadoria: ${curadoria.join(", ")}`);
    /* `Math.random` é proibido na camada INTEIRA: ele não é injetável e por isso
       não é reproduzível por seed. Já sortear de um gerador RECEBIDO é legítimo
       em `round-plan.mjs` e só nele — escolher sob incerteza é a decisão em si.
       Identidade descreve, modelo conclui, plano aposta. */
    assert.ok(!/Math\.random/.test(apenasCodigo(fonte)),
      `${modulo} usa Math.random: a tática precisa ser reproduzível por seed, `+
      `então o gerador entra por parâmetro`);
    if(!modulo.endsWith("round-plan.mjs")){
      assert.ok(!/\brandom\(/.test(apenasCodigo(fonte)),
        `${modulo} sorteia: só a decisão de round pode, porque escolher sob `+
        `incerteza é a decisão. Identidade descreve e modelo conclui.`);
    }
  }

  const M=await import(pathToFileURL(path.join(ROOT,`${CAMADA}/team-identity.mjs`)).href);
  const O=await import(pathToFileURL(path.join(ROOT,`${CAMADA}/opponent-model.mjs`)).href);
  const P=await import(pathToFileURL(path.join(ROOT,`${CAMADA}/round-plan.mjs`)).href);
  const elencos=provarIdentidade(M,A);
  provarModelo(O);
  provarPlano(P);

  // ——— A CHAVE SAI DE FÁBRICA DESLIGADA ———
  const cfgTatica=(await import(pathToFileURL(path.join(ROOT,`${CAMADA}/tactics-config.mjs`)).href)).CFG_TATICA;
  assert.ok(!cfgTatica.ATIVA,
    "CFG_TATICA.ATIVA saiu de fábrica LIGADA. Ligar a camada muda o resultado das "+
    "partidas: é balanceamento, com commit próprio, comparação pareada nas mesmas "+
    "seeds e `Favorito gap 16+` + `invicto` reportados antes e depois.");

  /* O fluxo tático precisa continuar SEPARADO do combate. Se `seedTatico` virar
     identidade, os dois geradores andam juntos e a decisão passa a deslocar os
     duelos — que é exatamente o que a arquitetura existe para impedir. */
  const {seedTatico}=await import(pathToFileURL(path.join(ROOT,`${CAMADA}/tactics-config.mjs`)).href);
  for(const s of [1,7,12345,4294967295]){
    assert.notEqual(seedTatico(s),s>>>0,`seed tático coincidiu com o do combate em ${s}`);
    assert.equal(seedTatico(s),seedTatico(s),"seed tático não é determinístico");
  }

  /* O motor só toca a camada atrás da chave. Sem este portão, uma edição futura
     poderia chamar a decisão incondicionalmente e o golden só acusaria depois —
     aqui a intenção fica congelada no ponto exato onde ela mora. */
  const motor=apenasCodigo(fs.readFileSync(path.join(ROOT,MOTOR),"utf8"));
  assert.ok(/deps\.tactics&&deps\.tactics\.ativa\(\)\?deps\.tactics:null/.test(motor),
    `${MOTOR} deixou de fechar a camada tática atrás de ativa(): com a chave `+
    `desligada nenhuma linha dela pode executar`);
  assert.ok(!/\btatica\.(planejar|registrar|iniciarMapa)\(/.test(motor)||
    /const tatica=deps\.tactics/.test(motor),
    `${MOTOR} chama a tática sem passar pelo portão`);

  // ——— consumidores: exatamente os declarados, cada um com motivo ———
  const obsoletas=declaracoesObsoletas();
  assert.deepEqual(obsoletas,[],
    `consumidor declarado não importa mais a camada (ou sumiu); remova de `+
    `CONSUMIDORES_DECLARADOS: ${obsoletas.join(", ")}`);
  const usos=consumidores();
  assert.deepEqual(usos,[],
    `a camada tática ganhou consumidor(es) não declarado(s): ${usos.join(", ")}. `+
    `Declare cada um em CONSUMIDORES_DECLARADOS com o motivo, e rode o golden `+
    `para provar que a chave desligada continua não mudando nada.`);

  console.log(`tactics layer: ok (${modulos.length} módulos · ${elencos} elencos · `+
    `${EIXOS.length} eixos zero-centrados · modelo esquece e admite não saber · `+
    `chave desligada · ${CONSUMIDORES_DECLARADOS.size} consumidores declarados)`);
}

main();
