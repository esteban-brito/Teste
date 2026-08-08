/* bancada/suites/e2e-game-flow.js — contrato de navegador do jogo principal.
   Percorre roleta, montagem do elenco, suíça, playoffs e tela final pela UI real.
   A seleção de seed apenas torna o caminho vencedor reproduzível; não altera pesos,
   dados, quantidade de chamadas ao RNG do produto nem resultados persistidos. */
/* global TransitionEvent */
const http=require("http");
const path=require("path");
const {spawn}=require("child_process");
const {chromium}=require("playwright");
const {ROOT,okMark,chromiumLaunchOptions}=require("../lib/common");
const arrasto=require("../lib/arrasto");
const {entrarNoMajor}=require("../lib/major");

function waitServer(port,tries=50){
  return new Promise((resolve,reject)=>{
    const tick=n=>{
      const req=http.get({host:"127.0.0.1",port,path:"/index.html"},res=>{res.resume();resolve();});
      req.on("error",()=>{if(n<=0)reject(new Error("servidor não subiu"));else setTimeout(()=>tick(n-1),150);});
    };
    tick(tries);
  });
}

let failures=0;
function check(ok,label){console.log(`  ${okMark(!!ok)} ${label}`);if(!ok)failures++;}

/* Checa ANTES de girar. Com uma carta já sorteada o `.spinwrap` fica `gone` e
   `#rollbtn` deixa de ser clicável — quem re-sorteia nesse estado é `#respinbtn`.
   Sem isso, qualquer passo que deixe um sorteio pendente derruba a rodada
   seguinte com um timeout de clique que não diz nada sobre a causa. */
async function revealDraw(page,candidateSelector,candidateLabel){
  for(let attempt=0;attempt<12;attempt++){
    if(await page.locator(candidateSelector).count())return;
    if(await page.$("#respinbtn:not([hidden])"))await page.click("#respinbtn");
    else await page.click("#rollbtn");
    await page.waitForFunction(()=>document.getElementById("track").children.length>40,{timeout:3000});
    await page.$eval("#track",track=>track.dispatchEvent(new TransitionEvent("transitionend",{bubbles:true,propertyName:"transform"})));
    await page.waitForSelector("#picks [data-pick]",{state:"attached",timeout:3000});
    if(await page.locator(candidateSelector).count())return;
    await page.click("#respinbtn");
  }
  throw new Error(`não foi possível sortear ${candidateLabel} disponível`);
}

/* O GESTO VIVE EM `bancada/lib/arrasto.js` — 06/08/2026. Esta suíte usa a
   estratégia que ENQUADRA os dois alvos antes de medir e arrasta com MOUSE real:
   ela roda em desktop, e é aqui que a fidelidade ao dispositivo apontador fica
   provada. A suíte de acessibilidade usa a outra estratégia, por ponteiro de
   toque e auto-rolagem, que é o gesto do celular. */
const arrastarCarta=(page,origem,destino)=>arrasto.porMouseCentralizado(page,origem,destino);

/* ARRASTAR NÃO PODE SELECIONAR TEXTO — 06/08/2026, relatado pelo responsável:
   "quando eu clico e segura pra arrastar uma carta, ai meio que seleciona todas
   as palavras que tao na tela". Medido antes da correção: 1.801 caracteres
   num único gesto.

   TRÊS COISAS ESCONDIAM O DEFEITO, e as três deram verde em produto QUEBRADO:

     1. DISTÂNCIA CURTA. A variável é o quanto o ponteiro varre, não a velocidade
        do gesto: medido no código anterior, 24 px selecionam 0 caracteres,
        120 px selecionam 153 e 400 px selecionam 1.801;
     2. ANIMAÇÃO EM CURSO. Com `deal` rodando — `animation-delay` de até 275 ms —
        a caixa medida já mudou quando o ponteiro desce, e ele cai ao lado da
        carta, sobre fundo sem texto;
     3. ALVO FORA DA VIEWPORT. `boundingBox()` não rola a página, e depois do
        sorteio o produto chama `scrollIntoView` no `#picksTag`.

   O CONTROLE É OBRIGATÓRIO. "0 caracteres" também é o que devolve um ponteiro
   que não seleciona nada em lugar nenhum. Arrastar sobre o `.logo` tem de
   selecionar — e a partir da BORDA, porque no centro de um bloco de duas linhas
   o ponto cai no vão entre elas e não cruza glifo nenhum. */
const limparSelecao=page=>page.evaluate(()=>window.getSelection().removeAllRanges());
const tamanhoSelecao=page=>page.evaluate(()=>window.getSelection().toString().length);

/* Devolve o PICO de seleção durante o gesto, não o estado final: ela pode ser
   desfeita ao soltar e ainda assim ter piscado na tela do usuário. */
async function maiorSelecaoAoArrastar(page,locator,dx,dy,dmax=400,passo=25,daBorda=false){
  await locator.scrollIntoViewIfNeeded();
  const caixa=await locator.boundingBox();
  if(!caixa)throw new Error("auditoria de seleção: alvo sem caixa");
  /* Para VARRER texto é preciso partir da borda: no centro de um bloco de duas
     linhas o ponto cai no vão entre elas, e andar para a direita não cruza glifo
     nenhum — foi assim que o controle deu zero sem haver proteção alguma. Para
     testar a CARTA o centro é o certo: é de onde a mão pega. */
  const cx=daBorda?caixa.x+2:caixa.x+caixa.width/2;
  const cy=daBorda?caixa.y+caixa.height/4:caixa.y+caixa.height/2;
  await limparSelecao(page);
  await page.mouse.move(cx,cy);
  await page.mouse.down();
  let maior=0;
  for(let d=2;d<=dmax;d+=passo){
    await page.mouse.move(cx+dx*d,cy+dy*d);
    await page.waitForTimeout(16);
    const n=await tamanhoSelecao(page);
    if(n>maior)maior=n;
  }
  await page.mouse.up();
  await page.waitForTimeout(120);
  await limparSelecao(page);
  return maior;
}

async function auditarSelecaoNoArrasto(page){
  const logo=page.locator(".logo");
  const largura=(await logo.boundingBox()).width;
  const controle=await maiorSelecaoAoArrastar(page,logo,1,0,Math.round(largura*0.6),12,true);
  check(controle>0,
    `controle: arrastar sobre texto comum seleciona (${controle} caracteres — se der 0, o medidor está cego)`);

  const carta=page.locator("#picks .card[data-pick]").first();
  await arrasto.esperarAnimacaoDe(page,"#picks .card[data-pick]");
  /* O gesto sobe e vai para o lado, longe de qualquer slot: o arrasto é abortado
     e o estado do draft não muda, então esta auditoria não consome uma rodada. */
  const naCarta=await maiorSelecaoAoArrastar(page,carta,1,-1);
  check(naCarta===0,`arrastar carta não seleciona texto da página (${naCarta} caracteres selecionados)`);
}

/* `auditar` só na primeira rodada: a auditoria roda DEPOIS do sorteio e ANTES do
   arrasto de verdade, aproveitando as cartas que já estão na mesa. Sortear de
   novo só para ela quebraria o fluxo — com uma carta pendente o `.spinwrap` fica
   `gone`, e `revealDraw` não consegue mais clicar em `#rollbtn`. */
async function draftPlayer(page,slot,auditar){
  await revealDraw(page,"#picks .card[data-pick]:not(.taken):not(.dup)","um jogador");
  if(auditar)await auditarSelecaoNoArrasto(page);
  const pickId=await page.$$eval("#picks .card[data-pick]:not(.taken):not(.dup)",cards=>{
    const ordered=[...cards].sort((a,b)=>Number(b.querySelector(".ovr")?.textContent)-Number(a.querySelector(".ovr")?.textContent));
    return ordered[0]?.dataset.pick||null;
  });
  if(!pickId)throw new Error(`rodada ${slot+1} não ofereceu jogador disponível`);
  await arrastarCarta(page,`#picks [data-pick="${pickId}"]`,`#lineup [data-slot="${slot}"]`);
  await page.waitForFunction(expected=>document.getElementById("cnt").textContent===`${expected}/6`,slot+1);
}

/* O GIRO NÃO CONGELA O ELENCO — 06/08/2026, pedido do responsável: "quero que dê
   pra mexer nas coisas enquanto a roleta tá sorteando, mas não dá pra fazer
   nada". A trava era `if(S.spinning)return` no `pointerdown`, e valia para toda
   carta, inclusive as já escaladas.
   A prova exige que o giro AINDA ESTEJA em curso no momento da interação —
   senão ela não diz nada sobre o que queria provar. */
async function auditarInteracaoDuranteGiro(page){
  await page.click("#rollbtn");
  const girando=await page.waitForFunction(
    ()=>window.__DRAFT9_E2E__.getDraft().spinning===true,{timeout:5000})
    .then(()=>true).catch(()=>false);
  check(girando,"roleta entra em giro");

  const carta=page.locator('#lineup [data-move="0"]');
  const antes=await carta.getAttribute("data-face");
  await carta.click();
  await page.waitForTimeout(220);
  const depois=await carta.getAttribute("data-face");
  const aindaGirando=await page.evaluate(()=>window.__DRAFT9_E2E__.getDraft().spinning);
  check(aindaGirando,"o giro seguia em curso durante a interação (senão a prova é vazia)");
  check(antes!==depois,`carta já escalada vira durante o giro (${antes} → ${depois})`);

  await page.waitForFunction(()=>window.__DRAFT9_E2E__.getDraft().spinning===false,{timeout:15000});
  await page.waitForTimeout(300);
  await carta.click();  // desvira, para não alterar o estado do fluxo adiante
  await page.waitForTimeout(220);
}

async function draftCoach(page){
  await revealDraw(page,"#picks .coachcard[data-pick]:not(.taken)","um treinador");
  await arrastarCarta(page,"#picks .coachcard[data-pick]:not(.taken)",'#lineupCoach [data-slot="coach"]');
  await page.waitForFunction(()=>document.getElementById("cnt").textContent==="6/6");
}

// Busca uma seed curta em que o time do usuário vence o próximo mapa. Cada tentativa
// reinicia o Mulberry32; a seed escolhida é reinstalada antes de a UI simular o mapa real.
/* `proximo` diz se a previsão é para o mapa SEGUINTE da série.
   `MATCH.mapaIdx` só é incrementado dentro de `continuarPartida`, depois do
   clique — então prever antes do "Continuar" com o índice atual escolhia a seed
   olhando o mapa que ACABOU de ser jogado. Nos mapas 2 e 3 a previsão dizia
   "você vence" sobre uma partida que não ia acontecer, o jogador perdia a série
   e era eliminado; o sintoma chegava como o overlay dos playoffs nunca reabrir,
   duas fases adiante. */
async function seedWinningMap(page,proximo=false){
  return page.evaluate(avanca=>{
    const {srand,getMatch,forcaDoDia,simularMapa}=window.__DRAFT9_E2E__;
    for(let seed=1;seed<=500;seed++){
      srand(seed);
      const {A,B,mapas,mapaIdx}=getMatch();
      const fdA=forcaDoDia(A.ef,A.quim),fdB=forcaDoDia(B.ef,B.quim);
      const tA={...A.time,nome:A.nome,cor:A.cor,meu:A.meu};
      const tB={...B.time,nome:B.nome,cor:B.cor,meu:B.meu};
      /* O MAPA TEM DE SER O MESMO QUE O PRODUTO VAI JOGAR — 07/08/2026. Desde que
         a antessala passou a anunciar os mapas da série, eles são sorteados na
         abertura e o produto os passa como `mapaForcado`. Prever sem forçar
         simulava OUTRO mapa: a seed escolhida dava vitória num jogo que nunca
         aconteceria, e a série terminava do jeito errado — o sintoma chegava
         longe da causa, como um timeout em `#playoffAvancar`. */
      const game=simularMapa(tA,tB,fdA,fdB,mapas?.[mapaIdx+(avanca?1:0)]||undefined);
      /* Identidade por REFERÊNCIA, como o produto faz: o nome do clube é
         escolhido pelo jogador e pode coincidir com o do adversário. */
      if(game.vencedor===tA){srand(seed);return seed;}
    }
    throw new Error("nenhuma seed vencedora encontrada para o próximo mapa");
  },proximo);
}

/* QUADROS DO MAJOR — composição, não decoração. Num Suíço de 16 com 3 vitórias/3
   derrotas os grupos vivos de uma rodada R têm sempre vitórias+derrotas = R,
   então existem no máximo 3 grupos + Classificados + Eliminados = 5 colunas.
   Com colunas fixas encostadas à esquerda a tela NUNCA enchia: 880 px vazios à
   direita na rodada 0 (61% da largura) e conteúdo estourando a altura ao mesmo
   tempo, mais rolagem horizontal no celular com "ELIMINADOS" cortado.
   A guarda mede as duas margens e a rolagem — nenhuma das três aparecia em
   captura, e por isso o defeito viveu sem ninguém notar.

   RODA NOS DOIS QUADROS — 06/08/2026. A primeira versão media só a Suíça, e o
   bracket dos Playoffs, que vive no overlay irmão com o mesmo `display:flex`,
   ficou com a doença inteira depois que a Suíça foi curada: 504 px vazios à
   direita no desktop, e no tablet a coluna do CAMPEÃO 129 px fora da janela. É a
   regra 20 outra vez — uma guarda só vê a categoria em que roda.

   E MEDE TRÊS LARGURAS, não duas. O tablet entrou porque foi a única onde o
   troféu saía da tela: 1440 sobrava espaço e 390 já tinha quebrado a linha, então
   os dois extremos passavam e o meio reprovava. */
const QUADROS=[
  {board:"swissBoard",colunas:".swiss-col",nome:"suíça"},
  {board:"bracketBoard",colunas:".bracket-round",nome:"bracket"},
];
const LARGURAS=[{w:1440,h:900,nome:"desktop"},{w:760,h:1000,nome:"tablet"},{w:390,h:844,nome:"celular"}];

async function auditarQuadro(page,quadro){
  const medir=()=>page.evaluate(({board,colunas})=>{
    const el=document.getElementById(board);
    const cols=[...el.querySelectorAll(colunas)].filter(c=>c.getBoundingClientRect().width>0);
    const r=el.getBoundingClientRect();
    const caixas=cols.map(c=>c.getBoundingClientRect());
    return {colunas:cols.length,
      esquerda:cols.length?Math.min(...caixas.map(b=>b.left))-r.left:0,
      direita:cols.length?r.right-Math.max(...caixas.map(b=>b.right)):0,
      rolaHorizontal:el.scrollWidth>el.clientWidth+1,
      docRolaHorizontal:document.documentElement.scrollWidth>window.innerWidth+1,
      /* Fora da JANELA, não da caixa: com `overflow:auto` o conteúdo excedente
         continua existindo no scrollWidth, então medir só a caixa não denuncia o
         que o usuário não alcança sem arrastar a tela de lado. */
      foraDaJanela:[...el.querySelectorAll("*")].filter(n=>{
        const b=n.getBoundingClientRect();
        return b.width>0&&(b.right>window.innerWidth+1||b.left<-1);}).length};
  },{board:quadro.board,colunas:quadro.colunas});

  for(const tela of LARGURAS){
    await page.setViewportSize({width:tela.w,height:tela.h});
    await page.waitForFunction(w=>window.innerWidth===w,tela.w);
    const m=await medir();
    /* QUADRO SEM COLUNA NÃO É QUADRO DESCENTRADO — é quadro que não está na tela.
       As duas coisas reprovavam com a mesma mensagem ("margens 0 e 0px"), e a
       falha lida como defeito de layout quando na verdade a medição pegou o
       overlay fechado. Falhar alto aqui é o que aponta para a causa: quem chamou
       auditou cedo demais. */
    if(!m.colunas)throw new Error(
      `auditoria do quadro "${quadro.nome}" (${tela.nome}) não achou coluna visível`
      +` — o overlay provavelmente ainda não abriu`);
    check(m.colunas>0&&Math.abs(m.esquerda-m.direita)<2,
      `${quadro.nome} centrada no ${tela.nome} (margens ${m.esquerda.toFixed(0)} e ${m.direita.toFixed(0)}px, ${m.colunas} colunas)`);
    check(!m.rolaHorizontal&&!m.docRolaHorizontal&&m.foraDaJanela===0,
      `${quadro.nome} no ${tela.nome} cabe na largura sem rolagem lateral${m.foraDaJanela?` (${m.foraDaJanela} nós fora da janela)`:""}`);
  }
  await page.setViewportSize({width:1440,height:900});
  await page.waitForFunction(()=>window.innerWidth===1440);
}
const auditarSuica=page=>auditarQuadro(page,QUADROS[0]);
const auditarBracket=page=>auditarQuadro(page,QUADROS[1]);

async function finishUserSeries(page){
  await page.waitForSelector("#matchOverlay",{state:"visible",timeout:10000});
  await page.waitForSelector("#prematchStart",{state:"visible",timeout:5000});
  await seedWinningMap(page);
  await page.click("#prematchStart");
  let maps=0;

  while(maps<3){
    await page.waitForSelector("#matchSkip",{state:"visible",timeout:10000});
    await page.click("#matchSkip");
    await page.waitForSelector("#matchContinue",{state:"visible",timeout:5000});
    maps++;

    const scoreboard=await page.evaluate(()=>({
      rows:document.querySelectorAll("#liveScore .ls-row").length,
      ratings:[...document.querySelectorAll("#liveScore .ls-rate")].map(node=>node.textContent.trim()),
      score:[Number(document.getElementById("sbScoreA").textContent),Number(document.getElementById("sbScoreB").textContent)]
    }));
    check(scoreboard.rows===10&&scoreboard.ratings.every(value=>Number.isFinite(Number(value))),`mapa ${maps} fecha com 10 jogadores e ratings válidos`);
    check(scoreboard.score.some(value=>value>=13),`mapa ${maps} fecha com placar válido`);

    await seedWinningMap(page,true); // o próximo mapa da série, não o que acabou
    await page.click("#matchContinue");
    await page.waitForFunction(()=>{
      const overlay=document.getElementById("matchOverlay");
      const skip=document.getElementById("matchSkip");
      return overlay.hidden||overlay.classList.contains("fechando")||!skip.hidden;
    },{timeout:10000});
    const closed=await page.$eval("#matchOverlay",overlay=>overlay.hidden||overlay.classList.contains("fechando"));
    if(closed)return maps;
  }
  throw new Error("série excedeu três mapas");
}

(async()=>{
  console.log("— E2E: JOGO PRINCIPAL (draft + Major completo) —");
  /* 5900–6199 incluía a porta 6000, bloqueada pelo Chromium como unsafe. O
     sorteio raro derrubava o CI antes de abrir o jogo, sem testar produto algum. */
  const port=7000+Math.floor(Math.random()*300);
  const server=spawn(process.execPath,[path.join(ROOT,"tools","serve-static.js")],
    {env:{...process.env,PORT:String(port)},stdio:"ignore"});
  let browser=null;
  const done=async code=>{try{if(browser)await browser.close();}catch{}try{server.kill();}catch{}process.exitCode=code;};

  try{
    await waitServer(port);
    browser=await chromium.launch(chromiumLaunchOptions());
    const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:"reduce"});
    const errors=[];
    page.on("pageerror",error=>errors.push(String(error.message||error)));
    page.on("console",message=>{
      if(message.type()==="error"&&!/Failed to load resource|ERR_CONNECTION|ERR_NAME_NOT_RESOLVED|net::/.test(message.text())){
        errors.push("console:"+message.text());
      }
    });

    await page.goto(`http://127.0.0.1:${port}/index.html?e2e=1`,{waitUntil:"load",timeout:20000});
    for(let slot=0;slot<5;slot++){
      await draftPlayer(page,slot,slot===0);
      if(slot===0)await auditarInteracaoDuranteGiro(page);
    }
    await draftCoach(page);

    const lineup=await page.evaluate(()=>({
      players:document.querySelectorAll("#lineup [data-move]").length,
      coaches:document.querySelectorAll('#lineupCoach [data-move="coach"]').length,
      resultHidden:document.getElementById("result").hidden,
      values:["rBruta","rQuim","rEfet"].map(id=>document.getElementById(id).textContent),
      majorHidden:document.getElementById("majorSection").hidden
    }));
    check(lineup.players===5&&lineup.coaches===1,"draft preenche cinco jogadores e um treinador");
    check(!lineup.resultHidden&&lineup.values.every(value=>value&&!/—|NaN|undefined/.test(value)),"lineup completo exibe força, química e força efetiva");
    check(!lineup.majorHidden,"Major é liberado somente após o elenco completo");

    /* O Major passa pelo PORTÃO DO NOME desde 07/08/2026. A travessia vive em
       `lib/major.js` porque três suítes fazem o mesmo percurso. */
    await entrarNoMajor(page);
    check(await page.locator("#swissBoard .match").count()===16,"fase suíça começa com 16 times");
    await auditarSuica(page);

    let swissRounds=0,totalMaps=0;
    while(!(await page.locator("#suicaPlayoffs").isVisible())&&swissRounds<10){
      const before=await page.locator("#suicaSub").textContent();
      await page.click("#suicaAvancar");
      swissRounds++;
      const hasMatch=await page.locator("#prematchStart").isVisible();
      if(hasMatch)totalMaps+=await finishUserSeries(page);
      await page.waitForFunction(previous=>document.getElementById("suicaSub").textContent!==previous||!document.getElementById("suicaPlayoffs").hidden,before,{timeout:10000});
    }
    check(await page.locator("#suicaPlayoffs").isVisible(),"suíça conclui e libera os playoffs");
    check(await page.locator("#swissBoard .qualified-slot.mine:not(.elim-slot)").count()===1,"time do usuário termina entre os oito classificados");

    await page.click("#suicaPlayoffs");
    await page.waitForSelector("#playoffOverlay",{state:"visible",timeout:5000});
    /* Duas medições, não uma: a coluna do campeão muda de largura ao ser coroada
       ("aguardando…" contra o nome do time mais o selo), e é justamente ela que
       saía da janela no tablet. Medir só o estado inicial deixaria o pior caso
       de fora. */
    await auditarBracket(page);
    const phases=["quartas de final","semifinais","grande final"];
    for(const phase of phases){
      /* ESPERA O OVERLAY VOLTAR ANTES DE LER QUALQUER COISA.
         `#playoffSub` responde `textContent` mesmo com o overlay `hidden`, então
         a checagem de fase passava com o quadro ainda fechado — e o que vinha
         depois media um bracket invisível (0 colunas) e esbarrava num
         `#playoffAvancar` que ainda não era clicável, virando 30 s de timeout
         longe da causa. Entre uma fase e outra o overlay some durante a série e
         reabre com transição; ler nesse vão é corrida, não defeito de produto. */
      await page.waitForSelector("#playoffOverlay",{state:"visible",timeout:10000})
        .catch(async erro=>{
          /* O overlay também não volta quando o jogador é ELIMINADO — ali o
             produto vai para a tela final, de propósito. Sem esta distinção o
             teste acusava "overlay não abriu" e escondia a causa real, que é a
             série ter sido perdida quando a suíte inteira pressupõe vitória. */
          const eliminado=await page.locator("#finalOverlay").isVisible().catch(()=>false);
          throw new Error(eliminado
            ? `o jogador foi ELIMINADO antes de "${phase}" — a seed vencedora não valeu para todos os mapas da série`
            : erro.message);
        });
      const subtitle=(await page.locator("#playoffSub").textContent()).toLowerCase();
      check(subtitle.includes(phase),`bracket chega a ${phase}`);
      if(phase==="grande final")await auditarBracket(page);
      await page.click("#playoffAvancar");
      totalMaps+=await finishUserSeries(page);
    }

    await page.waitForSelector("#finalOverlay",{state:"visible",timeout:10000});
    const final=await page.evaluate(()=>({
      title:document.getElementById("finalTitulo").textContent.trim(),
      seals:document.getElementById("finalSelos").textContent,
      ratings:document.querySelectorAll("#finalRatings .fr-row").length,
      journey:document.querySelectorAll("#finalJornada .jt").length,
      invalid:document.getElementById("finalOverlay").textContent.match(/NaN|undefined|Infinity/)
    }));
    check(final.title==="CAMPEÃO DO MAJOR"&&final.seals.includes("CAMPEÃO"),"campanha completa termina com o título do Major");
    check(final.ratings===5&&final.journey===totalMaps,"resumo final cobre os cinco jogadores e todos os mapas disputados");
    check(!final.invalid&&errors.length===0,`fluxo completo não produz valores inválidos nem page-error${errors.length?": "+errors[0]:""}`);

    // MEMÓRIA: título e recordes persistem no localStorage, com narrativa do MVP na tela final
    const memoria=await page.evaluate(()=>{
      const d=JSON.parse(localStorage.getItem("draft90.progresso.v1")||"null");
      return {salvo:!!d,titulos:d?d.titulos.length:0,campanhas:d?d.contadores.campanhas:0,
        recordes:d?Object.keys(d.recordes).length:0,killsRec:d&&d.recordes.kills?d.recordes.kills.v:0,
        narrativa:(document.querySelector("#finalMvpCard .mvp-narrativa")||{}).textContent||""};
    });
    check(memoria.salvo&&memoria.titulos===1&&memoria.campanhas===1,"título campeão entra no progresso persistente");
    check(memoria.recordes>=3&&memoria.killsRec>0,"recordes do clube capturados da campanha");
    check(memoria.narrativa.length>20,"tela final conta a narrativa do MVP da campanha");

    await page.click("#finalVoltar");
    await page.waitForFunction(()=>document.getElementById("cnt").textContent==="0/6"&&document.getElementById("majorSection").hidden);
    check(await page.locator("#lineup [data-move]").count()===0,"jogar novamente limpa campanha e elenco");

    // MEMÓRIA: sobrevive ao reload e alimenta o Hall da Fama pela UI real
    await page.reload({waitUntil:"networkidle"});
    await page.click("#hallBtn");
    await page.waitForSelector("#hallOverlay",{state:"visible"});
    const hall=await page.evaluate(()=>({
      titulos:document.querySelectorAll("#hallTitulos .hall-titulo").length,
      recordes:document.querySelectorAll("#hallRecordes .hall-rec").length,
      contadores:document.getElementById("hallContadores").textContent,
      invalido:!!document.getElementById("hallOverlay").textContent.match(/NaN|undefined|Infinity/)
    }));
    check(hall.titulos===1&&hall.recordes>=3&&!hall.invalido,"Hall da Fama mostra o título e os recordes após reload");
    check(hall.contadores.includes("1")&&hall.contadores.includes("títulos"),"contadores do Hall refletem a campanha");
    await page.click("#hallFechar");

    console.log(failures?`✗ ${failures} checagem(ns) e2e falharam`:"✓ jogo principal preserva draft, Major e reinício completo");
    return done(failures?1:0);
  }catch(error){
    console.log("  ✗ e2e abortou: "+(error.message||error));
    if(error.stack)console.log(error.stack.split("\n").slice(0,6).join("\n"));
    console.log("✗ e2e do jogo principal falhou");
    return done(1);
  }
})();
