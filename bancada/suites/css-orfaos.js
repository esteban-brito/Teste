/* bancada/suites/css-orfaos.js — o detector de órfãos que entende RUNTIME.
   ══════════════════════════════════════════════════════════════════════════════

   POR QUE EXISTE. É a FATIA 0 do plano de organização do código
   (`docs/ciclos/plano-organizacao-do-codigo.md`): antes de mover uma linha de
   `style.css`, é preciso saber o que na folha ainda tem consumidor. Sem isso,
   toda a fatia 2 é opinião — e este repositório já pagou por opinião: em 07/08
   remover a regra `.pm-id` com um script grudou o seletor seguinte no anterior,
   o nome do time do lado A ficou sem estilo, e NENHUMA guarda pegou.

   POR QUE AS TRÊS TENTATIVAS ANTERIORES FALHARAM, e por que esta não infere por
   texto. O plano registra as três, e todas morreram do mesmo mal — casar
   identidade no CÓDIGO-FONTE:

     1. casar `id="literal"` na marcação não basta: `sideA`/`sideB` são emitidos
        por `ladoChipHtml`, que recebe o id como ARGUMENTO — no template está
        `id="${id}"`. Terceiro falso positivo desse tipo no repositório;
     2. casar `$("literal")` no consumo também não: os overlays são consumidos
        por `OVERLAYS.map($)`, e nenhum aparece escrito à mão;
     3. e a correção óbvia — "toda string literal conta" — zerou os dois falsos
        acima e produziu 390 novos: `#Ataque`, `#Escape`, `#UTF-8`, `#pt-BR`.
        Guarda que acusa 390 identidades vivas não é conservadora, é RUÍDO, e
        ruído é o que faz alguém desligar a guarda.

   O CAMINHO QUE SOBRA, e que é o desta suíte: não inferir. CARREGAR a página no
   Chromium, percorrer o jogo inteiro, e coletar do DOM REAL toda identidade que
   existiu em algum momento. Identidade gerada em runtime deixa de ser problema
   de casador porque ela É gerada — `fn-${slugFuncao(…)}` chega ao DOM já
   resolvida. O MutationObserver é instalado ANTES da primeira navegação e
   guarda também o que aparece e SOME, que é o caso de `.dragging`, `.pop` e
   `.fechando`.

   POR QUE TRÊS BALDES, E NÃO "ÓRFÃ / NÃO ÓRFÃ". Um percurso não alcança tudo —
   `is-champ` e `is-elim` são exclusivas entre si, e nenhuma campanha visita as
   duas. Chamar de órfão o que o percurso não visitou seria a mesma família de
   ruído da tentativa 3. Então:

     · VIVA         — apareceu no DOM. Encerrado, não se discute;
     · NÃO VISITADA — não apareceu, mas o nome existe LITERAL numa fonte. É
                      lacuna de COBERTURA do percurso, e o número dela é a
                      medida honesta do quanto esta guarda ainda não vê;
     · GERADA       — não apareceu e não é literal, mas casa um prefixo de
                      template do repositório (`fn-`, `t${…}`). É o falso
                      positivo da auditoria de 06/08, onde 17 de 18 acusações
                      eram concatenação em runtime;
     · ÓRFÃ         — nenhuma das três. Só esta é candidata a remoção.

   COMO ELA PODE FALHAR. A seção de provas sintéticas injeta cada caso na folha
   LIDA (nunca no arquivo) e exige o balde certo para cada um: a órfã real tem
   de ser acusada, e a gerada, a literal e a viva têm de NÃO ser. Guarda sempre
   verde passa por cobertura sem ser cobertura.

   O QUE ELA NÃO É. Não é licença para apagar. O plano manda: remover morto só
   com prova por MUTAÇÃO, e nunca no mesmo commit da tokenização ou do
   reagrupamento. Esta suíte diz onde olhar — não decide. */
const http=require("http");
const fs=require("fs");
const path=require("path");
const {spawn}=require("child_process");
const {chromium}=require("playwright");
const {ROOT,okMark,chromiumLaunchOptions}=require("../lib/common");
const {entrarNoMajor}=require("../lib/major");
const arrasto=require("../lib/arrasto");

/* As fontes onde uma identidade da folha pode estar escrita à mão. `sandbox.html`
   e `elencos.html` entram porque `style.css` tem tokens e classes que eles
   consomem — `--r-awper`/`--r-igl` são o caso registrado no ciclo de 09/08 —, e
   deixá-los de fora transformaria consumo real em órfão. */
const FONTES=["index.html","elencos.html","sandbox.html","prototipo-cartas.html",
  "recorte-retratos.html","game.js","calibrador-worker.js"];

/* A DÍVIDA TRAVADA, como já se faz com o vidro e com as contagens de doc.
   Igualdade EXATA, não teto: uma órfã nova reprova, e resolver uma órfã também
   reprova até que a lista seja atualizada no mesmo commit que a removeu. Teto
   frouxo deixaria a lista envelhecer sozinha, que é o defeito da regra 43. */
const ORFAS_CONHECIDAS={
  classes:[],
  ids:[]
};

function waitServer(port,tries=60){
  return new Promise((resolve,reject)=>{
    const tick=n=>{
      const req=http.get({host:"127.0.0.1",port,path:"/index.html"},res=>{res.resume();resolve();});
      req.on("error",()=>{if(n<=0)reject(new Error("servidor não subiu"));else setTimeout(()=>tick(n-1),150);});
    };tick(tries);
  });
}

let failures=0;
function check(ok,label){console.log(`  ${okMark(!!ok)} ${label}`);if(!ok)failures++;}

/* ── 1 · O QUE A FOLHA DECLARA ─────────────────────────────────────────────
   Um parser de verdade, e não um regex sobre o arquivo cru, por duas razões
   medidas neste repositório:

   · COMENTÁRIO NÃO É SELETOR (regra 71). `--b1` aparece seis vezes em
     `style.css`, todas em arqueologia, e um casador ingênuo mandaria a próxima
     sessão caçar um bug que não existe. Aqui o mesmo vale para `.pm-mapa`, que
     a faxina de 09/08 removeu e cujos comentários citam pelo nome;
   · DECLARAÇÃO NÃO É SELETOR. `background:url(#x)`, `content:".d"` e
     `grid-area:.a` estão dentro de bloco e não declaram identidade nenhuma.

   O estado é uma PILHA porque `@media` contém regras enquanto `@keyframes`
   contém quadros: `from`, `to` e `50%` não são seletores, e o prelúdio de um
   quadro nunca traz identidade. */
function identidadeDeclarada(css){
  const semComentario=css.replace(/\/\*[\s\S]*?\*\//g,"");
  const classes=new Map(),ids=new Map();
  const pilha=[];
  let prelu="",linha=1;

  /* O `;` zera o prelúdio em QUALQUER contexto, e não só dentro de bloco.
     At-rule sem bloco — `@import url(…);`, `@charset "UTF-8";` — termina em
     ponto e vírgula, e sem isto ela ficaria acumulada no buffer até o `{`
     seguinte, entrando na conta como se fosse parte daquele seletor. Hoje a
     folha não tem nenhuma e o efeito seria zero; a armadilha é para o dia em
     que tiver. Seletor nunca contém `;`, então zerar sempre é seguro. */
  const contexto=()=>pilha.length?pilha[pilha.length-1]:"raiz";
  const registrar=(prelúdio,ondeLinha)=>{
    /* Strings e parênteses saem antes: `[data-x="a.b"]` e `:not(.a)` são casos
       diferentes — o primeiro é dado, o segundo é identidade REFERENCIADA e
       precisa contar, senão `.a` viraria órfã por ser usada só em negação. */
    const limpo=prelúdio.replace(/"[^"]*"|'[^']*'/g,"");
    for(const m of limpo.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g))
      if(!classes.has(m[1]))classes.set(m[1],ondeLinha);
    for(const m of limpo.matchAll(/#(-?[_a-zA-Z][\w-]*)/g))
      if(!ids.has(m[1]))ids.set(m[1],ondeLinha);
  };

  for(let i=0;i<semComentario.length;i++){
    const c=semComentario[i];
    if(c==="\n")linha++;
    if(c==="{"){
      const p=prelu.trim();
      const linhaDoPrelúdio=linha-(prelu.match(/\n/g)||[]).length;
      if(/^@(media|supports|container|layer|scope|document)\b/i.test(p))pilha.push("regras");
      else if(/^@keyframes\b/i.test(p))pilha.push("quadros");
      else if(/^@/.test(p))pilha.push("declaracoes");
      else{
        /* Só conta como seletor quem está onde SELETOR pode estar. Dentro de
           `@keyframes` o prelúdio é `0%`/`from`; dentro de um bloco de
           declarações, nada — a folha não usa aninhamento nativo, e se um dia
           usar, este ramo o trata como seletor de propósito. */
        if(contexto()!=="quadros")registrar(p,linhaDoPrelúdio);
        pilha.push("declaracoes");
      }
      prelu="";
    }else if(c==="}"){pilha.pop();prelu="";}
    else if(c===";")prelu="";   // ver a nota abaixo
    else prelu+=c;
  }
  return {classes,ids};
}

/* ── 2 · O QUE O NAVEGADOR REALMENTE MONTOU ────────────────────────────────
   Instalado por `addInitScript`, ou seja, ANTES de qualquer script da página:
   identidade que nasce e morre no primeiro quadro — `.pop` do round, `.fechando`
   do overlay — não existiria para uma varredura feita depois. */
const COLETOR=`(()=>{
  const cls=new Set(),ids=new Set();
  window.__IDENT__={cls,ids};
  const anotar=el=>{
    if(!el||el.nodeType!==1)return;
    if(el.id)ids.add(el.id);
    const c=el.getAttribute&&el.getAttribute("class");
    if(c)for(const n of c.split(/\\s+/))if(n)cls.add(n);
  };
  const varrer=raiz=>{
    if(!raiz)return;
    anotar(raiz);
    if(raiz.querySelectorAll)for(const el of raiz.querySelectorAll("*"))anotar(el);
  };
  window.__VARRER__=()=>varrer(document.documentElement);
  const mo=new MutationObserver(muts=>{
    for(const m of muts){
      if(m.type==="attributes")anotar(m.target);
      else for(const n of m.addedNodes)varrer(n);
    }
  });
  const ligar=()=>{
    if(!document.documentElement)return setTimeout(ligar,0);
    varrer(document.documentElement);
    mo.observe(document.documentElement,
      {subtree:true,childList:true,attributes:true,attributeFilter:["class","id"]});
  };
  ligar();
})()`;

/* ── 3 · O PERCURSO ────────────────────────────────────────────────────────
   Um laço TOLERANTE, e não a travessia roteirizada da `e2e-game-flow`. A
   diferença é deliberada: aquela suíte precisa que o jogador VENÇA (ela instala
   uma seed vencedora por mapa para poder afirmar "campeão do Major"), e aqui
   vencer não importa — importa VISITAR. Um laço que clica o que estiver na tela
   atravessa a campanha inteira sem depender do resultado, e de brinde não
   quebra quando o balanceamento muda. */
async function percorrerOJogo(page,port){
  await page.goto(`http://127.0.0.1:${port}/index.html?e2e=1`,{waitUntil:"networkidle"});
  await page.evaluate(()=>document.fonts.ready);

  /* A seed entra antes do draft, e não antes do Major como nas outras suítes —
     mas ela NÃO torna o percurso determinístico, e isso é do produto:
     `game.js:28` define `rnd` sobre `Math.random` CRU, e o comentário da linha
     1060 declara a escolha ("é o mesmo canal que a roleta do draft já usa").
     `srand` governa a simulação, não a roleta.

     MEDIDO em quatro execuções: 298 a 310 classes vistas, com `tier-*`,
     `bonus`/`leve`/`grave` e `is-champ`/`is-elim` entrando e saindo conforme o
     elenco sorteado e o fim da campanha. Semear aqui reduz a faixa; não a
     fecha, e fechá-la exigiria mudar o produto para servir ao teste.

     POR QUE ISSO NÃO CONTAMINA O VEREDITO: tudo que oscila é escrito à mão em
     `src/ui`, então cai em "não visitada", nunca em órfã — as órfãs deram 0 nas
     quatro. Se um dia esta suíte falhar de forma INTERMITENTE, é aqui que se
     olha: alguma classe passou a existir só em runtime, sem literal e sem
     prefixo, e o balde dela depende do sorteio do dia. */
  await page.evaluate(()=>window.__DRAFT9_E2E__.srand(20260809));

  /* Draft: sortear, VIRAR as cartas (clicar vira desde 06/08), arrastar uma à
     mão para colher o gesto — `.dragging`, `.over`, `.taken` só existem durante
     ele — e completar o resto com o botão de elenco aleatório, que é 1 clique. */
  await page.click("#rollbtn");
  await page.waitForSelector(".picks .card",{timeout:20000});
  await page.waitForTimeout(1200);
  for(const carta of await page.$$(".picks .card,.picks .coachcard"))await carta.click();
  await page.waitForTimeout(500);
  for(const carta of await page.$$(".picks .card,.picks .coachcard"))await carta.click();
  await page.waitForTimeout(300);

  const alvo=await page.$('#picks .card[data-pick]:not(.taken):not(.dup)');
  if(alvo){
    const id=await alvo.getAttribute("data-pick");
    await arrasto.porAutoRolagem(page,`#picks [data-pick="${id}"]`,'#lineup [data-slot="0"]')
      .catch(()=>{});
  }
  await page.click("#randombtn");
  await page.waitForFunction(()=>document.getElementById("cnt").textContent==="6/6",null,{timeout:25000});

  await entrarNoMajor(page);   // atravessa o portão do nome — `nomeOverlay`

  const visivel=async sel=>page.locator(sel).isVisible().catch(()=>false);
  /* CLIQUE TOLERANTE, e é a regra 41 outra vez. Entre o `isVisible()` e o
     `click()` a tela avança sozinha — o overlay que estava aberto fecha com
     transição —, e aí o Playwright fica 30 s esperando um botão que já não
     existe, estourando longe da causa. Teto curto e desistência silenciosa
     devolvem o controle ao laço, que simplesmente tenta o próximo estado.
     O teto de passos é que garante o fim; nenhum clique isolado é obrigatório. */
  const clicar=async sel=>{
    try{await page.click(sel,{timeout:2500});return true;}
    catch{return false;}
  };
  let passos=0,narrados=0;
  while(passos++<300){
    if(await visivel("#finalOverlay"))break;

    /* A PRIMEIRA partida vai NARRADA, para que `.np-card` e o palco da narração
       entrem no DOM. As outras vão limpas: os dois caminhos existem, e um
       percurso que só conhece um deixaria metade da tela sem visita. */
    if(await visivel("#prematchStart")){
      if(await clicar(narrados++===0?"#prematchNarrado":"#prematchStart"))continue;
    }
    if(await visivel("#matchSkip")&&await clicar("#matchSkip"))continue;
    if(await visivel("#matchContinue")&&await clicar("#matchContinue"))continue;
    if(await visivel("#suicaPlayoffs")&&await clicar("#suicaPlayoffs"))continue;
    if(await visivel("#playoffAvancar")&&await clicar("#playoffAvancar"))continue;
    if(await visivel("#suicaAvancar")&&await clicar("#suicaAvancar"))continue;
    await page.waitForTimeout(200);
  }

  const chegouAoFim=await visivel("#finalOverlay");
  await page.waitForTimeout(600);
  if(chegouAoFim){
    await page.click("#finalVoltar").catch(()=>{});
    await page.waitForTimeout(400);
  }
  /* O Hall só tem conteúdo depois de uma campanha, e é a última tela do jogo
     que ninguém mais visita. */
  await page.click("#hallBtn").catch(()=>{});
  await page.waitForSelector("#hallOverlay",{state:"visible",timeout:8000}).catch(()=>{});
  await page.waitForTimeout(400);
  await page.click("#hallFechar").catch(()=>{});
  await page.waitForTimeout(200);

  await page.evaluate(()=>window.__VARRER__());
  const visto=await page.evaluate(()=>({
    cls:[...window.__IDENT__.cls],ids:[...window.__IDENT__.ids]
  }));
  return {visto,chegouAoFim};
}

/* ── 4 · OS TRÊS FILTROS QUE EVITAM O RUÍDO ────────────────────────────────
   Borda à direita E à esquerda no casador de literal: sem elas `.pm-ef` casaria
   dentro de `pm-efeito` e uma órfã real passaria por viva. É a regra 23, que
   nasceu de um padrão casando como PREFIXO dentro de outro nome. */
function apareceLiteral(nome,fontes){
  const re=new RegExp(`(?<![\\w-])${nome.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}(?![\\w-])`);
  return fontes.some(f=>re.test(f));
}

/* Os prefixos que o código CONCATENA. `fn-${slugFuncao(…)}` e `coach-${caracSlug}`
   são os dois casos que a auditoria de 06/08 registrou, e foram 17 dos 18
   falsos positivos daquele dia. Um nome da folha que comece por um destes pode
   ter sido gerado, e acusá-lo seria repetir o erro conhecido. */
function prefixosGerados(fontes){
  const pre=new Set();
  for(const f of fontes){
    for(const m of f.matchAll(/([\w-]{2,})\$\{/g))pre.add(m[1]);          // `fn-${…}`
    for(const m of f.matchAll(/["'`]([\w-]{2,})["'`]\s*\+/g))pre.add(m[1]); // "fn-"+x
  }
  return [...pre];
}

function classificar(declarado,visto,fontes,prefixos){
  const baldes={vivas:[],naoVisitadas:[],geradas:[],orfas:[]};
  for(const nome of declarado.keys()){
    if(visto.has(nome)){baldes.vivas.push(nome);continue;}
    if(apareceLiteral(nome,fontes)){baldes.naoVisitadas.push(nome);continue;}
    if(prefixos.some(p=>nome.startsWith(p)&&nome.length>p.length)){baldes.geradas.push(nome);continue;}
    baldes.orfas.push(nome);
  }
  return baldes;
}

/* ── 5 · PROVAS SINTÉTICAS ─────────────────────────────────────────────────
   Cada uma injeta um caso na folha LIDA — nunca no arquivo — e exige o balde
   certo. As três primeiras testam que o auditor ACUSA o que deve e CALA sobre o
   que não deve; a quarta prova que ele volta ao verde. */
function provasSinteticas(cssReal,visto,fontes,prefixos){
  const orfasReais=new Set(classificar(identidadeDeclarada(cssReal).classes,visto,fontes,prefixos).orfas);
  const novasOrfas=css=>{
    const b=classificar(identidadeDeclarada(css).classes,visto,fontes,prefixos);
    return b.orfas.filter(n=>!orfasReais.has(n));
  };

  const orfa=cssReal+"\n.zz-orfa-sintetica-9x{color:red}\n";
  check(novasOrfas(orfa).includes("zz-orfa-sintetica-9x"),
    "prova sintética · auditor acusa classe sem consumidor nenhum");

  /* Identidade GERADA em runtime: um nome que nenhuma fonte escreve à mão, mas
     que casa um prefixo concatenado real do repositório. Se o auditor a acusar,
     ele repetiu o falso positivo de 06/08 e não serve.
     O prefixo é CRAVADO em `fn-`, e não escolhido pelo primeiro da lista: ele é
     o caso real — `fn-${slugFuncao(card.prim)}` em `card-view.mjs` — e um alvo
     sorteado faria a prova testar qualquer coisa no dia em que a detecção de
     prefixos regredisse. Por isso a presença dele é checada primeiro: sem o
     alvo, a prova não provou nada. */
  check(prefixos.includes("fn-"),
    "prova sintética · detector enxerga o prefixo concatenado `fn-` de card-view");
  const gerada=cssReal+"\n.fn-zzsintetico{color:red}\n";
  check(!novasOrfas(gerada).includes("fn-zzsintetico"),
    "prova sintética · auditor NÃO acusa identidade concatenada (fn-${…})");

  /* Um nome que o percurso não visitou mas que existe LITERAL numa fonte é
     lacuna de cobertura, não órfã. `finalTitulo` está em `game.js`. */
  const literal=cssReal+"\n.finalTitulo{color:red}\n";
  check(!novasOrfas(literal).includes("finalTitulo"),
    "prova sintética · auditor NÃO acusa nome escrito à mão numa fonte");

  /* E o comentário não declara nada: o nome de uma classe REMOVIDA continua
     citado em prosa na folha, e casá-lo ressuscitaria a arqueologia como
     dívida — foi o que a regra 71 registrou com `--b1`. */
  const emComentario=cssReal+"\n/* a antiga .zz-so-em-prosa-9x saiu em 09/08 */\n";
  check(!novasOrfas(emComentario).includes("zz-so-em-prosa-9x"),
    "prova sintética · auditor NÃO acusa nome que só existe em comentário");

  check(novasOrfas(cssReal).length===0,
    "auditoria volta ao verde depois das provas sintéticas");
}

(async()=>{
  const port=7000+Math.floor(Math.random()*300);   // 6000 é ERR_UNSAFE_PORT no Chromium
  const server=spawn(process.execPath,[path.join(ROOT,"tools","serve-static.js")],
    {env:{...process.env,PORT:String(port)},stdio:"ignore"});
  let browser=null;
  const done=async code=>{try{if(browser)await browser.close();}catch{}try{server.kill();}catch{}process.exitCode=code;};

  try{
    await waitServer(port);
    browser=await chromium.launch(chromiumLaunchOptions());
    const ctx=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
    await ctx.addInitScript(COLETOR);
    const page=await ctx.newPage();

    const {visto,chegouAoFim}=await percorrerOJogo(page,port);
    await ctx.close();

    const cssReal=fs.readFileSync(path.join(ROOT,"style.css"),"utf8");
    const fontes=FONTES.map(f=>{
      try{return fs.readFileSync(path.join(ROOT,f),"utf8");}catch{return "";}
    }).concat(lerModulos(path.join(ROOT,"src")));
    const prefixos=prefixosGerados(fontes);

    const declarado=identidadeDeclarada(cssReal);
    const vistoCls=new Set(visto.cls),vistoIds=new Set(visto.ids);
    const cls=classificar(declarado.classes,vistoCls,fontes,prefixos);
    const ids=classificar(declarado.ids,vistoIds,fontes,prefixos);

    console.log(`  · folha declara ${declarado.classes.size} classes e ${declarado.ids.size} ids`);
    console.log(`  · DOM real montou ${vistoCls.size} classes e ${vistoIds.size} ids no percurso`);
    console.log(`  · classes: ${cls.vivas.length} vivas · ${cls.naoVisitadas.length} não visitadas `
      +`· ${cls.geradas.length} geradas · ${cls.orfas.length} órfãs`);
    console.log(`  · ids: ${ids.vivas.length} vivos · ${ids.naoVisitadas.length} não visitados `
      +`· ${ids.geradas.length} gerados · ${ids.orfas.length} órfãos`);
    /* "oscila" no rótulo é literal: este número varia entre execuções por causa
       da roleta não semeada do produto — ver a nota da seed. Ele é um mapa de
       onde o percurso não chega, não uma medida para comparar entre dias. */
    if(cls.naoVisitadas.length)
      console.log(`  · cobertura pendente, oscila (${cls.naoVisitadas.length}): `
        +cls.naoVisitadas.slice().sort().join(" "));

    /* A DIREÇÃO INVERSA — classe que o jogo MONTA e a folha nunca estiliza.
       É o outro lado do mesmo ciclo, e é onde estão os dois achados que a fatia
       1 deixou registrados para a fatia 2: `.pm-topo`, sem uma única regra na
       folha, e `.sb-a`, emitida por `reproduzirMapa` enquanto só `.sb-b` tem
       estilo. Nenhum dos dois aparece na varredura de cima, porque lá a
       pergunta é a inversa — e foi por isso que ficaram meses sem dono.
       NÃO é travada em lista: classe sem regra é legítima como gancho de JS ou
       de teste, e travar o número obrigaria a declarar dezenas de ganchos vivos
       como dívida. Aqui ela é diagnóstico para a fatia 2. */
    const semRegra=[...vistoCls].filter(n=>!declarado.classes.has(n)).sort();
    console.log(`  · no DOM sem NENHUMA regra na folha (${semRegra.length}): ${semRegra.join(" ")}`);

    check(chegouAoFim,"percurso atravessa a campanha inteira até a tela final");
    check(vistoCls.size>150,`percurso montou identidade suficiente para julgar (${vistoCls.size} classes)`);

    for(const n of cls.orfas)console.log(`    · classe órfã: .${n} (style.css:${declarado.classes.get(n)})`);
    for(const n of ids.orfas)console.log(`    · id órfão: #${n} (style.css:${declarado.ids.get(n)})`);

    const igual=(a,b)=>{
      const x=[...a].sort(),y=[...b].sort();
      return x.length===y.length&&x.every((v,i)=>v===y[i]);
    };
    check(igual(cls.orfas,ORFAS_CONHECIDAS.classes),
      `classes órfãs são exatamente as ${ORFAS_CONHECIDAS.classes.length} declaradas na lista travada`);
    check(igual(ids.orfas,ORFAS_CONHECIDAS.ids),
      `ids órfãos são exatamente os ${ORFAS_CONHECIDAS.ids.length} declarados na lista travada`);

    provasSinteticas(cssReal,vistoCls,fontes,prefixos);

    console.log(failures?`✗ ${failures} checagem(ns) do detector de órfãos falharam`
      :"✓ detector de órfãos: identidade da folha conferida contra o DOM real do jogo");
    return done(failures?1:0);
  }catch(error){
    console.log("  ✗ suíte abortou: "+(error.message||error));
    console.log("✗ detector de órfãos falhou");
    return done(1);
  }
})();

/* Lê `src/**` inteiro: os módulos de UI emitem a maior parte da marcação do
   jogo, e é neles que vive a identidade escrita à mão que o percurso pode não
   alcançar. */
function lerModulos(dir){
  const out=[];
  for(const item of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,item.name);
    if(item.isDirectory())out.push(...lerModulos(p));
    else if(item.name.endsWith(".mjs"))out.push(fs.readFileSync(p,"utf8"));
  }
  return out;
}
