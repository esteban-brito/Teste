/* bancada/e2e-cartas.js — ROBUSTEZ GEOMÉTRICA E INTERATIVA DAS CARTAS
   ══════════════════════════════════════════════════════════════════════════════

   POR QUE ESTA SUÍTE EXISTE. Em 29/07/2026 a escala de nome das cartas estava
   MORTA no jogo: `--t2` era declarado em `.card`, mas o card-view põe
   `--nick-esc` em `.cfaces`, que é filha — e substituição de custom property
   acontece no elemento onde a propriedade é declarada, então o fallback 1 valia
   sempre. Os 100 nicks renderizavam a 16cqw, e `olofmeister` e `pashaBiceps`
   eram cortados no meio da letra, 28px além da borda.

   Nada pegou isso, e a razão é estrutural: `check-game-view-modules.js` compara
   STRINGS, e o comparador visual compara DUAS EXECUÇÕES DO MESMO CÓDIGO — um
   nome permanentemente cortado é estável, logo invisível para ele. Faltava uma
   guarda que medisse GEOMETRIA.

   COMO ELA MEDE. O laboratório (`prototipo-cartas.html`) renderiza 145 cartas
   com os módulos e o CSS reais e expõe `window.__LAB_MEDIR`. Esta suíte chama a
   MESMA função no estado publicado e na proposta A/B, nas cinco larguras reais e
   nos três pontos da costura compacta. Mede largura, recorte vertical e colisão
   entre regiões. Uma implementação, dois usos: instrumento para desenhar e
   portão para publicar.

   Em 30/07/2026 a guarda passou a abrir também o jogo real no celular e a provar
   semântica de botão, teclado, sincronização frente/verso, reduced motion e
   ausência de hover preso em touch. Também injeta falhas sintéticas para provar
   que o medidor acusa geometria ruim e distingue reticências deliberadas. */
const http=require("http");
const path=require("path");
const {spawn}=require("child_process");
const {chromium}=require("playwright");
const {okMark,chromiumLaunchOptions}=require("./common");

/* Cinco larguras reais: roleta, desktop de 6 colunas, celular de 2, celular de 3
   e tablet de 3. Além delas, 151/150/149 protegem a costura exata da
   densidade compacta. Um bug de container query pode passar em 176 e 130 e
   ainda quebrar justamente na troca entre os dois layouts. */
const LARGURAS=["250","188","176","151","150","149","130","120"];
const CARTAS_ESPERADAS=145;   /* 85 jogadores + 15 treinadores + as sínteses do lab */

function waitServer(port,tries=50){
  return new Promise((resolve,reject)=>{
    const tick=n=>{
      const req=http.get({host:"127.0.0.1",port,path:"/prototipo-cartas.html"},res=>{res.resume();resolve();});
      req.on("error",()=>{if(n<=0)reject(new Error("servidor não subiu"));else setTimeout(()=>tick(n-1),150);});
    };
    tick(tries);
  });
}

let failures=0;
function check(ok,label){console.log(`  ${okMark(!!ok)} ${label}`);if(!ok)failures++;}

(async()=>{
  console.log("— E2E: ROBUSTEZ DAS CARTAS (laboratório + jogo) —");
  const port=6300+Math.floor(Math.random()*300);
  const server=spawn(process.execPath,[path.join(__dirname,"..","tools","serve-static.js")],
    {env:{...process.env,PORT:String(port)},stdio:"ignore"});
  let browser=null;
  const done=async code=>{
    try{if(browser)await browser.close();}catch{}
    try{server.kill();}catch{}
    process.exitCode=code;
  };
  try{
    await waitServer(port);
    browser=await chromium.launch(chromiumLaunchOptions());
    const context=await browser.newContext({viewport:{width:1400,height:1000},deviceScaleFactor:1});
    const page=await context.newPage();
    const errors=[];
    page.on("pageerror",error=>errors.push(error.message));
    page.on("console",message=>{if(message.type()==="error")errors.push(message.text());});

    await page.goto(`http://127.0.0.1:${port}/prototipo-cartas.html`,{waitUntil:"networkidle"});
    await page.waitForFunction(()=>typeof window.__LAB_MEDIR==="function",{timeout:15000});
    await page.evaluate(()=>document.fonts.ready);

    const cartas=await page.evaluate(()=>document.querySelectorAll(".card,.coachcard").length);
    check(cartas===CARTAS_ESPERADAS,
      `laboratório monta as ${CARTAS_ESPERADAS} cartas pelos módulos reais (viu ${cartas})`);
    check(errors.length===0,`laboratório carrega sem erro de página${errors.length?": "+errors[0]:""}`);

    /* A proposta começa DESLIGADA: primeiro se prova o jogo publicado. */
    const proposta=await page.isChecked("#cProposta");
    check(!proposta,"medição roda com a proposta desligada (estado publicado do jogo)");

    const cardState=await page.locator(".card").first().evaluate(card=>({
      role:card.getAttribute("role"),tabIndex:card.tabIndex,
      frontHidden:card.querySelector(".cfront")?.getAttribute("aria-hidden"),
      backHidden:card.querySelector(".cback")?.getAttribute("aria-hidden"),
      frontPointer:getComputedStyle(card.querySelector(".cfront")).pointerEvents,
      backPointer:getComputedStyle(card.querySelector(".cback")).pointerEvents,
    }));
    check(cardState.role==="button"&&cardState.tabIndex===0,
      "carta do laboratório expõe interação por teclado e semântica de botão");
    check(cardState.frontHidden==="false"&&cardState.backHidden==="true"&&
      cardState.frontPointer!=="none"&&cardState.backPointer==="none",
    "só a face visível participa da interação e da árvore de acessibilidade");

    const invalidText=await page.locator(".card,.coachcard").evaluateAll(cards=>
      cards.filter(card=>/\b(?:undefined|NaN|Infinity)\b/.test(card.textContent||""))
        .map(card=>card.dataset.nick||"—"));
    check(invalidText.length===0,
      `nenhuma carta renderiza valor inválido${invalidText.length?`: ${invalidText[0]}`:""}`);

    /* O QUE REPROVA E O QUE NÃO REPROVA. Reprova texto que VAZA a caixa ou é
       decapitado — nick, função e rótulo do verso, que não têm reticências. NÃO
       reprova campo com `text-overflow:ellipsis` declarado no CSS (campeonato, nick
       do verso, nome de stat): ali cortar é a decisão de design, e "DreamHack
       Cluj-Napoca 2015" não caberia em fonte nenhuma. Essa distinção existe porque a
       primeira versão desta suíte reprovou a CI sem defeito algum: a métrica da
       fonte no Linux é alguns pixels mais larga que no Windows e cruzou o limite das
       reticências lá, não aqui. Estouro real tem folga de dezenas de pixels, então
       não é sensível a plataforma. */
    for(const largura of LARGURAS){
      if(!await page.locator(`#cLargura option[value="${largura}"]`).count())
        await page.locator("#cLargura").evaluate((select,value)=>{
          const option=document.createElement("option");option.value=value;option.textContent=value;
          select.appendChild(option);
        },largura);
      await page.selectOption("#cLargura",largura);
      await page.waitForTimeout(120);
      const {total,falhas,reticencias}=await page.evaluate(()=>window.__LAB_MEDIR());
      check(falhas.length===0,
        `${largura}px · ${total} cartas sem falha de geometria`+
        (reticencias.length?` (${reticencias.length} com reticências declaradas)`:"")+
        (falhas.length?` — ${falhas.length} falha(s), 1ª: ${falhas[0].nick} `+
          `${falhas[0].campo} "${falhas[0].texto}" falta ${falhas[0].falta}px`:""));
      if(falhas.length)for(const falha of falhas.slice(0,8))
        console.log(`      ${falha.nick} · ${falha.campo} · "${falha.texto}" · `+
          `falta ${falha.falta}px · passa a borda ${falha.passa>0?falha.passa+"px":"—"}`);

      const density=await page.locator(".card").first().evaluate(card=>{
        const faces=card.querySelector(".cfaces"),faceStyle=getComputedStyle(faces);
        return {width:card.getBoundingClientRect().width,
          placaN:faceStyle.getPropertyValue("--placa-n").trim(),
          b2:faceStyle.getPropertyValue("--b2").trim(),
          t3:faceStyle.getPropertyValue("--t3").trim(),
          meta:getComputedStyle(card.querySelector(".c-meta")).display};
      });
      const compacta=Number(largura)<=150;
      check(compacta
        ? density.placaN==="32"&&density.b2==="6%"&&density.t3==="7cqw"&&density.meta==="none"
        : density.placaN==="38"&&density.meta!=="none",
      `${largura}px · tokens da densidade ${compacta?"compacta":"completa"} realmente aplicados`);
    }

    /* O laboratório é a bancada da próxima mudança. As propostas ainda não
       aprovadas não podem apodrecer enquanto o jogo evolui. */
    await page.check("#cProposta");
    for(const largura of LARGURAS){
      await page.selectOption("#cLargura",largura);await page.waitForTimeout(80);
      const audit=await page.evaluate(()=>window.__LAB_MEDIR());
      check(audit.falhas.length===0,
        `${largura}px · proposta continua sem falha geométrica${audit.falhas.length?` (${audit.falhas[0].campo})`:""}`);
    }
    await page.uncheck("#cProposta");

    /* Clique e teclado têm de manter classe visual, ponteiro e aria-hidden em
       sincronia. Testar só a classe deixaria leitores de tela presos na face
       errada; testar só aria deixaria a animação visual divergente. */
    const firstCard=page.locator(".card").first();
    await firstCard.focus();await page.keyboard.press("Enter");
    let flip=await firstCard.evaluate(card=>({flipped:card.classList.contains("flipped"),
      front:card.querySelector(".cfront")?.getAttribute("aria-hidden"),
      back:card.querySelector(".cback")?.getAttribute("aria-hidden"),
      frontPointer:getComputedStyle(card.querySelector(".cfront")).pointerEvents,
      backPointer:getComputedStyle(card.querySelector(".cback")).pointerEvents}));
    check(flip.flipped&&flip.front==="true"&&flip.back==="false"&&
      flip.frontPointer==="none"&&flip.backPointer!=="none",
    "Enter vira a carta e troca a única face interativa/acessível");
    await page.keyboard.press(" ");
    flip=await firstCard.evaluate(card=>({flipped:card.classList.contains("flipped"),
      front:card.querySelector(".cfront")?.getAttribute("aria-hidden"),
      back:card.querySelector(".cback")?.getAttribute("aria-hidden")}));
    check(!flip.flipped&&flip.front==="false"&&flip.back==="true",
      "Espaço devolve a carta à frente sem dessincronizar acessibilidade");

    await page.emulateMedia({reducedMotion:"reduce"});
    const reduced=await firstCard.evaluate(card=>({
      faceTransition:getComputedStyle(card.querySelector(".cface")).transitionDuration,
      holoAnimation:getComputedStyle(card,"::after").animationName}));
    check(reduced.faceTransition.split(",").every(value=>parseFloat(value)===0)&&
      reduced.holoAnimation==="none",
    "movimento reduzido desliga flip e holografia contínua");
    await page.emulateMedia({reducedMotion:"no-preference"});

    /* As provas sintéticas rodam a 188px porque abaixo de 150px a densidade compacta
       ESCONDE o rodapé do verso (`.c-vrod`), e caixa oculta não mede nada. */
    await page.selectOption("#cLargura","188");
    await page.waitForTimeout(120);

    /* O medidor precisa ser capaz de ACUSAR: sem esta prova, "zero estouros" pode
       significar apenas que a medição parou de funcionar. */
    const detecta=await page.evaluate(()=>{
      const nick=document.querySelector(".card .c-nick");
      if(!nick)return null;
      const original=nick.textContent;
      nick.textContent="NOMEIMPOSSIVELMENTELONGOPARACABER";
      const {falhas}=window.__LAB_MEDIR();
      nick.textContent=original;
      return falhas.some(f=>f.campo.startsWith("nick"));
    });
    check(detecta===true,"medidor detecta um nome que não cabe (prova de que ele mede)");

    /* E a distinção também é testada: campo com reticências declaradas entra no
       relatório, nunca na reprovação. Sem esta prova, a suíte volta a ficar vermelha
       em outra plataforma por uma decisão de design. */
    const separa=await page.evaluate(()=>{
      const rodape=document.querySelector(".card .c-vrod b");
      if(!rodape)return null;
      const original=rodape.textContent;
      rodape.textContent="CAMPEONATO DE NOME ABSURDAMENTE LONGO 2026";
      const {falhas,reticencias}=window.__LAB_MEDIR();
      rodape.textContent=original;
      return {reprovou:falhas.some(f=>f.campo.startsWith("campeonato")),
        relatou:reticencias.some(f=>f.campo.startsWith("campeonato"))};
    });
    check(separa&&separa.relatou&&!separa.reprovou,
      "campo com reticências declaradas é relatado, não reprovado");

    const detectaColisao=await page.evaluate(()=>{
      const func=document.querySelector(".card .c-func");if(!func)return null;
      const original=func.style.bottom;func.style.bottom="17%";
      const {falhas}=window.__LAB_MEDIR();func.style.bottom=original;
      return falhas.some(f=>f.campo.includes("colisão nick/função"));
    });
    check(detectaColisao===true,
      "medidor detecta colisão vertical mesmo quando os dois textos cabem na largura");

    const limpo=await page.evaluate(()=>window.__LAB_MEDIR().falhas.length);
    check(limpo===0,"medição volta a zero depois da prova sintética");

    /* O laboratório usa o mesmo HTML/CSS, mas o ENVELOPE interativo nasce em
       `game.js`. Uma passagem curta no jogo real impede que role, teclado ou
       sincronização de face existam apenas na bancada. */
    await page.setViewportSize({width:390,height:844});
    await page.goto(`http://127.0.0.1:${port}/index.html?e2e=1`,{waitUntil:"load",timeout:20000});
    await page.click("#rollbtn");
    await page.waitForFunction(()=>document.getElementById("track").children.length>40,{timeout:3000});
    await page.$eval("#track",track=>track.dispatchEvent(new window.TransitionEvent("transitionend",
      {bubbles:true,propertyName:"transform"})));
    await page.waitForSelector("#picks [data-pick]",{state:"attached",timeout:4000});
    await page.waitForTimeout(650); /* termina o `deal`; transform alteraria a caixa medida */

    const gameCards=await page.locator("#picks [data-pick]").evaluateAll(cards=>cards.map(card=>{
      const rect=card.getBoundingClientRect(),faces=card.querySelector(".cfaces");
      return {role:card.getAttribute("role"),tabIndex:card.tabIndex,face:card.dataset.face,
        front:card.querySelector(".cfront")?.getAttribute("aria-hidden"),
        back:card.querySelector(".cback")?.getAttribute("aria-hidden"),
        placaN:getComputedStyle(faces).getPropertyValue("--placa-n").trim(),
        ratio:rect.width/rect.height,left:rect.left,right:rect.right};
    }));
    check(gameCards.length>=5&&gameCards.every(card=>card.role==="button"&&card.tabIndex===0),
      "jogo real expõe todas as cartas disponíveis como botões de teclado");
    check(gameCards.every(card=>card.face==="front"&&card.front==="false"&&
      card.back==="true"&&card.placaN==="32"),
      "jogo real inicia na frente e aplica densidade compacta no celular");
    const gamePage=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,
      clientWidth:document.documentElement.clientWidth}));
    const gameGeometry=gameCards.every(card=>Math.abs(card.ratio-5/7)<.01&&
      card.left>=0&&card.right<=gamePage.clientWidth)&&gamePage.scrollWidth<=gamePage.clientWidth;
    check(gameGeometry,"cartas reais preservam proporção e não criam overflow horizontal no celular"+
      (gameGeometry?"":` (${JSON.stringify({cards:gameCards,page:gamePage})})`));

    const gameCard=page.locator("#picks [data-pick]").first();
    await page.click("#flipModeBtn");await gameCard.focus();await page.keyboard.press("Enter");
    let gameFlip=await gameCard.evaluate(card=>({flipped:card.classList.contains("flipped"),
      face:card.dataset.face,
      front:card.querySelector(".cfront")?.getAttribute("aria-hidden"),
      back:card.querySelector(".cback")?.getAttribute("aria-hidden")}));
    check(gameFlip.flipped&&gameFlip.face==="back"&&gameFlip.front==="true"&&gameFlip.back==="false",
      "modo Virar do jogo sincroniza a face visual e acessível pelo teclado");
    await page.click("#flipModeBtn");
    gameFlip=await gameCard.evaluate(card=>({flipped:card.classList.contains("flipped"),
      face:card.dataset.face,
      front:card.querySelector(".cfront")?.getAttribute("aria-hidden"),
      back:card.querySelector(".cback")?.getAttribute("aria-hidden")}));
    check(!gameFlip.flipped&&gameFlip.face==="front"&&gameFlip.front==="false"&&gameFlip.back==="true",
      "sair do modo Virar devolve todas as cartas à frente");
    await gameCard.click();
    check(await gameCard.evaluate(card=>card.classList.contains("sel"))&&
      await page.locator(".slot.avail").count()>=1,
    "endurecimento de acessibilidade preserva a seleção normal da carta");
    check(errors.length===0,`laboratório e jogo terminam sem erro de página${errors.length?": "+errors[0]:""}`);

    const touchContext=await browser.newContext({viewport:{width:390,height:844},
      deviceScaleFactor:1,isMobile:true,hasTouch:true});
    const touchPage=await touchContext.newPage();
    await touchPage.goto(`http://127.0.0.1:${port}/prototipo-cartas.html`,
      {waitUntil:"networkidle",timeout:20000});
    const touchCard=touchPage.locator(".card").first();
    const touchBefore=await touchCard.evaluate(card=>({boxShadow:getComputedStyle(card).boxShadow,
      transform:getComputedStyle(card).transform,
      hoverFine:matchMedia("(hover:hover) and (pointer:fine)").matches}));
    await touchCard.tap();await touchPage.waitForTimeout(80);
    const touchAfter=await touchCard.evaluate(card=>({boxShadow:getComputedStyle(card).boxShadow,
      transform:getComputedStyle(card).transform}));
    const touchStable=!touchBefore.hoverFine&&touchBefore.boxShadow===touchAfter.boxShadow&&
      touchBefore.transform===touchAfter.transform;
    check(touchStable,"toque não deixa elevação ou aro de hover presos na carta"+
      (touchStable?"":` (${JSON.stringify({touchBefore,touchAfter})})`));
    await touchContext.close();

    console.log(failures
      ?`✗ ${failures} checagem(ns) de robustez falharam`
      :"✓ cartas sem falha geométrica nas oito larguras e nos dois estados do laboratório");
    return done(failures?1:0);
  }catch(error){
    console.log("  ✗ e2e de cartas abortou: "+(error.message||error));
    console.log("✗ e2e de robustez das cartas falhou");
    return done(1);
  }
})();
