/* Robustez geométrica, visual e interativa da carta canônica.
   O laboratório monta o componente real e expõe uma única medição; esta suíte
   apenas dirige o navegador e prova que as guardas também sabem reprovar. */
const http=require("http");
const path=require("path");
const {spawn}=require("child_process");
const {chromium}=require("playwright");
const {okMark,chromiumLaunchOptions}=require("./common");

const LARGURAS=["250","188","176","151","150","149","130","120"];
const CARTAS_ESPERADAS=153;

function waitServer(port,tries=50){
  return new Promise((resolve,reject)=>{
    const tick=restantes=>{
      const req=http.get({host:"127.0.0.1",port,path:"/prototipo-cartas.html"},res=>{
        res.resume();resolve();});
      req.on("error",()=>restantes<=0?reject(new Error("servidor não subiu")):
        setTimeout(()=>tick(restantes-1),150));
    };
    tick(tries);
  });
}

let failures=0;
function check(ok,label){console.log(`  ${okMark(!!ok)} ${label}`);if(!ok)failures++;}

(async()=>{
  console.log("— E2E: CARTA CANÔNICA (laboratório + jogo) —");
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
    const fontState=await page.evaluate(async()=>{
      const descriptor="700 16px 'Chakra Petch'",sample="DONK OLOFMEISTER";
      const faces=await document.fonts.load(descriptor,sample);
      await document.fonts.ready;
      return {faces:faces.length,ready:document.fonts.check(descriptor,sample),status:document.fonts.status};
    });
    check(fontState.ready&&fontState.faces>0&&fontState.status==="loaded",
      `fonte canônica carregada antes da geometria (${fontState.faces} face(s) · ${fontState.status})`);
    if(!fontState.ready||fontState.faces===0)
      throw new Error("Chakra Petch 700 indisponível; geometria com fallback não é comparável");

    const cartas=await page.locator(".card,.coachcard").count();
    check(cartas===CARTAS_ESPERADAS,
      `laboratório monta as ${CARTAS_ESPERADAS} cartas reais e sintéticas (viu ${cartas})`);
    check(await page.locator("#cProposta,#cEncaixe,[data-layout-reference]").count()===0,
      "laboratório não preserva variante A/B, referência velha ou ajuste individual");
    check(await page.locator('link[rel="stylesheet"][href^="style.css"]').getAttribute("href")===
      "style.css?v=DEV","laboratório participa do cache-busting do CSS canônico");

    const referencia=await page.locator('#gRetratos .card[data-enquadramento="canonical"]').evaluate(card=>{
      const faces=card.querySelector(".cfaces"),foto=card.querySelector(".c-foto"),style=getComputedStyle(foto);
      return {quantas:card.parentElement.parentElement.querySelectorAll(".card").length,
        foto:faces.style.getPropertyValue("--foto"),size:style.backgroundSize,
        position:style.backgroundPosition,role2:!!card.querySelector(".c-role2"),team:!!card.querySelector(".c-team")};
    });
    check(referencia.quantas===1&&referencia.foto.includes("donk_kato24.webp")&&
      referencia.size.split(",")[2]?.trim()==="100%"&&referencia.position.includes("50% 12%")&&
      referencia.role2&&referencia.team,
    "Donk é a única referência e usa recorte canônico, role secundário e time explícitos");

    const cardState=await page.locator(".card").first().evaluate(card=>({
      role:card.getAttribute("role"),tabIndex:card.tabIndex,
      front:card.querySelector(".cfront")?.getAttribute("aria-hidden"),
      back:card.querySelector(".cback")?.getAttribute("aria-hidden"),
      frontPointer:getComputedStyle(card.querySelector(".cfront")).pointerEvents,
      backPointer:getComputedStyle(card.querySelector(".cback")).pointerEvents}));
    check(cardState.role==="button"&&cardState.tabIndex===0&&cardState.front==="false"&&
      cardState.back==="true"&&cardState.frontPointer!=="none"&&cardState.backPointer==="none",
    "carta inicia como botão, com uma única face acessível e interativa");
    check(errors.length===0,`laboratório carrega sem erro${errors.length?`: ${errors[0]}`:""}`);

    for(const largura of LARGURAS){
      await page.selectOption("#cLargura",largura);await page.waitForTimeout(75);
      const resultado=await page.evaluate(()=>{
        const audit=window.__LAB_MEDIR();
        const cards=[...document.querySelectorAll(".card")];
        const visible=element=>element&&getComputedStyle(element).display!=="none"&&
          getComputedStyle(element).visibility!=="hidden"&&element.getClientRects().length>0;
        const px=element=>parseFloat(getComputedStyle(element).fontSize);
        const ranges={};
        for(const selector of [".c-nick",".c-func",".c-role2",".c-vnick",".c-vestilo b"]){
          const values=cards.map(card=>px(card.querySelector(selector)));
          ranges[selector]=Math.max(...values)-Math.min(...values);
        }
        const minimums=[[".card .c-func",9],[".card .c-role2",7],[".c-vnick",11],[".c-vestilo small",7],
          [".c-st i",7],[".c-st b",9],[".c-vrod b",8],[".c-vrod span",7],[".c-vdesc",8]];
        const tooSmall=minimums.flatMap(([selector,minimum])=>
          [...document.querySelectorAll(selector)].filter(element=>visible(element)&&px(element)<minimum-.05)
            .map(element=>({selector,size:px(element),minimum,text:element.textContent.trim()})));
        const parseColor=value=>{
          const numbers=(value.match(/[\d.]+/g)||[]).map(Number);
          return value.startsWith("color(srgb")?numbers.slice(0,3).map(number=>number*255):numbers.slice(0,3);
        };
        const luminance=color=>{const linear=color.map(channel=>{const value=channel/255;
          return value<=.04045?value/12.92:((value+.055)/1.055)**2.4;});
          return .2126*linear[0]+.7152*linear[1]+.0722*linear[2];};
        const background=luminance([8,13,20]);
        const selectors=[".c-ovr small",".c-func",".c-role2",".c-team",".c-vnick",
          ".c-vestilo small",".c-vestilo b",".c-st i",".c-st b",".c-vrod b",".c-vrod span",".c-vdesc"];
        const lowContrast=selectors.flatMap(selector=>[...document.querySelectorAll(selector)]
          .filter(visible).map(element=>{const foreground=luminance(parseColor(getComputedStyle(element).color));
            return {selector,ratio:(Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05)};})
          .filter(result=>result.ratio<4.5));
        const first=cards[0],faces=getComputedStyle(first.querySelector(".cfaces"));
        const canonicalLayout=cards.every(card=>{
          const box=card.getBoundingClientRect(),nick=card.querySelector(".c-nick").getBoundingClientRect();
          const flag=card.querySelector(".c-flag").getBoundingClientRect();
          const team=card.querySelector(".c-team").getBoundingClientRect();
          const vstats=card.querySelector(".c-vstats").getBoundingClientRect();
          const stats=[...card.querySelectorAll(".c-st")];
          return Math.abs((flag.top+flag.bottom-nick.top-nick.bottom)/2)<=.4&&
            team.top-flag.bottom+.05>=Math.max(6,box.width*.055)&&
            vstats.height/box.height>=.35&&stats.every(stat=>{
              const statBox=stat.getBoundingClientRect();
              const trackBox=stat.querySelector(".c-trilho").getBoundingClientRect();
              return statBox.width/vstats.width>=.995&&trackBox.width/vstats.width>=.995;
            });
        });
        return {audit,ranges,tooSmall,lowContrast,
          placa:faces.getPropertyValue("--placa-n").trim(),
          allVisible:cards.every(card=>visible(card.querySelector(".c-flag"))&&
            visible(card.querySelector(".c-role2"))&&visible(card.querySelector(".c-team"))),
          fourStats:cards.every(card=>card.querySelectorAll(".c-st").length===4),
          canonicalLayout,
          individualScale:cards.filter(card=>/--(?:nick|carac)-esc/.test(card.querySelector(".cfaces").style.cssText)).length,
          externalShadow:cards.filter(card=>{const shadow=getComputedStyle(card).boxShadow;
            return shadow!=="none"&&!/\binset\s*$/.test(shadow);}).length};
      });
      const esperado=Number(largura)<=150?"28":Number(largura)<=176?"26":"24";
      const primeiraFalha=resultado.audit.falhas[0],primeiroRitmo=resultado.audit.ritmo[0];
      check(resultado.audit.falhas.length===0&&resultado.audit.ritmo.length===0&&
        resultado.audit.treinadoresAuditados===18,
        `${largura}px · geometria aprovada em ${resultado.audit.auditadas} jogadores + `+
        `${resultado.audit.treinadoresAuditados} coaches na mesma grade`+
        (primeiraFalha?` — ${primeiraFalha.nick}: ${primeiraFalha.campo} (${primeiraFalha.falta}px)`:"")+
        (primeiroRitmo?` — ${primeiroRitmo.nick}: ${primeiroRitmo.campo} (${primeiroRitmo.atual}${primeiroRitmo.unidade})`:""));
      check(resultado.placa===esperado&&resultado.allVisible&&resultado.fourStats&&resultado.canonicalLayout,
        `${largura}px · identidade alinhada e quatro stats ocupam toda a grade`);
      check(Object.values(resultado.ranges).every(range=>range<=.05)&&resultado.individualScale===0,
        `${largura}px · tipografia idêntica entre todos os jogadores`);
      check(resultado.tooSmall.length===0&&resultado.lowContrast.length===0,
        `${largura}px · tamanhos mínimos e contraste 4,5:1`+
        (resultado.tooSmall.length?` — ${resultado.tooSmall[0].selector} ${resultado.tooSmall[0].size}px`:"")+
        (resultado.lowContrast.length?` — ${resultado.lowContrast[0].selector} ${resultado.lowContrast[0].ratio.toFixed(2)}:1`:""));
      check(resultado.externalShadow===0,`${largura}px · nenhuma carta projeta halo externo`);
    }

    await page.selectOption("#cLargura","188");await page.waitForTimeout(75);
    const detectaTexto=await page.evaluate(()=>{
      const nick=document.querySelector(".card .c-nick"),original=nick.textContent;
      nick.textContent="NOMEIMPOSSIVELMENTELONGOPARACABER";
      const falhou=window.__LAB_MEDIR().falhas.some(falha=>falha.campo.startsWith("nick"));
      nick.textContent=original;return falhou;
    });
    check(detectaTexto,"medidor acusa texto que não cabe");
    const detectaReticencia=await page.evaluate(()=>{
      const stat=document.querySelector(".card .c-st i"),original=stat.textContent;
      stat.textContent="ATRIBUTO IMPOSSIVELMENTE LONGO";const audit=window.__LAB_MEDIR();stat.textContent=original;
      return audit.reticencias.some(item=>item.campo.startsWith("stat"))&&
        !audit.falhas.some(item=>item.campo.startsWith("stat"));
    });
    check(detectaReticencia,"medidor separa reticência declarada de estouro real");
    const detectaColisao=await page.evaluate(()=>{
      const func=document.querySelector(".card .c-func"),original=func.style.cssText;
      func.style.position="relative";func.style.top="-18px";
      const falhou=window.__LAB_MEDIR().falhas.some(falha=>falha.campo.includes("nick/função"));
      func.style.cssText=original;return falhou;
    });
    check(detectaColisao,"medidor acusa colisão vertical");
    const detectaPadrao=await page.evaluate(()=>{
      const card=document.querySelector(".card"),nick=card.querySelector(".c-nick"),flag=card.querySelector(".c-flag");
      const stat=card.querySelector(".c-st:last-child"),parent=stat.parentElement,next=stat.nextSibling;
      const firstStat=card.querySelector(".c-st"),nickStyle=nick.style.cssText;
      const flagStyle=flag.style.cssText,firstStatStyle=firstStat.style.cssText;
      nick.style.fontSize="8px";flag.style.display="none";firstStat.style.width="50%";stat.remove();
      const campos=window.__LAB_MEDIR().ritmo.map(item=>item.campo);
      nick.style.cssText=nickStyle;flag.style.cssText=flagStyle;firstStat.style.cssText=firstStatStyle;
      parent.insertBefore(stat,next);
      return campos;
    });
    check(["conteúdo frontal sempre visível","quatro slots de estatística",
      "ocupação horizontal dos stats","tipografia única · nick"]
      .every(campo=>detectaPadrao.includes(campo)),
    "gate acusa conteúdo oculto, trilho estreito, slot ausente e exceção tipográfica");
    /* As três provas abaixo cobrem buracos reais encontrados em 31/07/2026: o
       medidor ficava VERDE ao remover a clip-path, ao inverter a diagonal do
       verso, ao apagar o retrato e ao esconder conteúdo por opacidade. */
    const detectaDiagonal=await page.evaluate(()=>{
      const card=document.querySelector(".card");
      const placa=card.querySelector(".c-placa"),faixa=card.querySelector(".c-vfaixa");
      const medir=alvo=>valor=>{const antes=alvo.style.clipPath;alvo.style.clipPath=valor;
        const campos=window.__LAB_MEDIR().ritmo.map(item=>item.campo);alvo.style.clipPath=antes;return campos;};
      const semPlaca=medir(placa)("none");
      const versoInvertido=medir(faixa)("polygon(0 0,100% 0,100% 100%,0 60%)");
      const rotulo="diagonal legível na clip-path";
      return semPlaca.includes(rotulo)&&versoInvertido.includes(rotulo);
    });
    check(detectaDiagonal,"medidor acusa diagonal removida ou invertida");
    const detectaRetrato=await page.evaluate(()=>{
      const card=document.querySelector('#gRetratos .card[data-enquadramento="canonical"]');
      const foto=card.querySelector(".c-foto");
      const medir=(prop,valor)=>{const antes=foto.style[prop];foto.style[prop]=valor;
        const campos=window.__LAB_MEDIR().ritmo.map(item=>item.campo);foto.style[prop]=antes;return campos;};
      return medir("display","none").includes("retrato desenhado")&&
        medir("backgroundPosition","50% 0,50% 0,50% 40%,50% 0")
          .some(campo=>campo.startsWith("recorte canônico do retrato"));
    });
    check(detectaRetrato,"medidor acusa retrato ausente ou recortado fora do padrão");
    const detectaOpacidade=await page.evaluate(()=>{
      const flag=document.querySelector(".card .c-flag"),antes=flag.style.opacity;
      flag.style.opacity="0";
      const campos=window.__LAB_MEDIR().ritmo.map(item=>item.campo);
      flag.style.opacity=antes;
      return campos.includes("conteúdo frontal sempre visível");
    });
    check(detectaOpacidade,"medidor acusa conteúdo escondido por opacidade");
    const detectaEspelhoCoach=await page.evaluate(()=>{
      const coach=document.querySelector(".coachcard");
      const identidade=coach.querySelector(".c-identidade--coach"),baseAntes=identidade.style.bottom;
      identidade.style.bottom="7%";
      const frente=window.__LAB_MEDIR().ritmo.map(item=>item.campo);
      identidade.style.bottom=baseAntes;
      const descricao=coach.querySelector(".c-vdesc"),descAntes=descricao.style.top;
      descricao.style.top="55%";
      const verso=window.__LAB_MEDIR().ritmo.map(item=>item.campo);
      descricao.style.top=descAntes;
      /* Reencena o defeito real de 31/07/2026: com a função secundária oculta, o
         time voltava a ocupar só a primeira das duas colunas e parava no meio da
         carta. As guardas do treinador eram todas verticais e não viam nada. */
      const time=coach.querySelector(".c-team"),colunaAntes=time.style.gridColumn;
      time.style.gridColumn="1";
      const horizontal=window.__LAB_MEDIR().ritmo.map(item=>item.campo);
      time.style.gridColumn=colunaAntes;
      return frente.includes("grade compartilhada · identidade (base)")&&
        verso.includes("verso padronizado · início do corpo")&&
        horizontal.includes("grade compartilhada · time (direita)");
    });
    check(detectaEspelhoCoach,
      "medidor acusa coach fora da grade compartilhada, no eixo vertical ou horizontal");
    const detectaVersoCoach=await page.evaluate(()=>{
      const coach=document.querySelector(".coachcard");
      const linha=coach.querySelector(".c-vef"),displayAntes=linha.style.display;
      linha.style.display="none";
      const linhas=window.__LAB_MEDIR().ritmo.map(item=>item.campo);
      linha.style.display=displayAntes;
      /* Inchar o corpo empurra a última linha contra o rodapé: é a versão
         ancorada nas duas pontas que passou na colisão e ficou colada. */
      const corpo=coach.querySelector(".c-vdesc"),gapAntes=corpo.style.gap;
      corpo.style.gap="18%";
      const respiro=window.__LAB_MEDIR().ritmo.map(item=>item.campo);
      corpo.style.gap=gapAntes;
      return linhas.includes("verso padronizado · linhas de efeito")&&
        respiro.includes("verso padronizado · respiro antes do rodapé");
    });
    check(detectaVersoCoach,"medidor acusa linha de efeito sumida ou corpo colado no rodapé");
    check((await page.evaluate(()=>window.__LAB_MEDIR())).falhas.length===0&&
      (await page.evaluate(()=>window.__LAB_MEDIR())).ritmo.length===0,
    "medição volta ao verde depois das provas sintéticas");

    /* O OVR fica sobre o retrato; mede-se o pixel mais claro da zona com o texto
       escondido. A placa já protege a bandeira na nova posição. */
    async function contrasteOvr(card,{x=.06,y=.04,w=.39,h=.18}={}){
      await card.evaluate(c=>{c.querySelector(".c-ovr").style.visibility="hidden";});
      const png=await card.screenshot();
      await card.evaluate(c=>{c.querySelector(".c-ovr").style.visibility="";});
      return page.evaluate(async ({b64,x,y,w,h})=>{
        const img=await new Promise(resolve=>{const element=new window.Image();element.onload=()=>resolve(element);
          element.src="data:image/png;base64,"+b64;});
        const canvas=document.createElement("canvas");canvas.width=img.width;canvas.height=img.height;
        const context=canvas.getContext("2d",{willReadFrequently:true});context.drawImage(img,0,0);
        const data=context.getImageData(Math.round(img.width*x),Math.round(img.height*y),
          Math.round(img.width*w),Math.round(img.height*h)).data;
        const luminance=(r,g,b)=>{const channels=[r,g,b].map(channel=>{const value=channel/255;
          return value<=.04045?value/12.92:((value+.055)/1.055)**2.4;});
          return .2126*channels[0]+.7152*channels[1]+.0722*channels[2];};
        let maior=0;for(let i=0;i<data.length;i+=4)maior=Math.max(maior,luminance(data[i],data[i+1],data[i+2]));
        return +((1.05)/(maior+.05)).toFixed(2);
      },{b64:png.toString("base64"),x,y,w,h});
    }
    for(const largura of ["250","130"]){
      await page.selectOption("#cLargura",largura);await page.waitForTimeout(75);
      const ratio=await contrasteOvr(page.locator('#gRetratos .card[data-enquadramento="canonical"]'));
      check(ratio>=4.5,`${largura}px · OVR mantém 4,5:1 sobre o retrato real (${ratio}:1)`);
      const hally=page.locator('.coachcard[data-nick="hally"]')
        .filter({has:page.locator('.cfaces[style*="hally_kato24"]')}).first();
      const coachRatio=await contrasteOvr(hally);
      check(coachRatio>=4.5,
        `${largura}px · OVR do coach mantém 4,5:1 sobre o retrato real (${coachRatio}:1)`);
    }

    await page.selectOption("#cLargura","188");await page.waitForTimeout(75);
    const motion=await page.locator(".card").first().evaluate(card=>{
      const face=getComputedStyle(card.querySelector(".cface")),cardStyle=getComputedStyle(card);
      const holo=getComputedStyle(card,"::after").animationName;
      card.classList.add("deal");const dealAnimation=card.getAnimations().find(a=>a.animationName==="cardDealEditorial");
      const deal={name:getComputedStyle(card).animationName,frames:dealAnimation?.effect.getKeyframes()||[]};
      dealAnimation?.cancel();card.classList.remove("deal");
      card.classList.add("land");const landAnimation=card.getAnimations().find(a=>a.animationName==="cardLandEditorial");
      const land={name:getComputedStyle(card).animationName,frames:landAnimation?.effect.getKeyframes()||[]};
      landAnimation?.cancel();card.classList.remove("land");
      return {cardProperty:cardStyle.transitionProperty,faceProperty:face.transitionProperty,holo,deal,land};
    });
    const cleanFrames=[...motion.deal.frames,...motion.land.frames].every(frame=>{
      const transform=frame.transform||"";
      return !frame.boxShadow&&!/rotate/i.test(transform)&&
        [...transform.matchAll(/scale\(([^)]+)\)/g)].every(match=>Number(match[1])<=1);
    });
    check(motion.cardProperty==="transform"&&motion.faceProperty==="transform, opacity"&&
      motion.holo==="none"&&motion.deal.name==="cardDealEditorial"&&
      motion.land.name==="cardLandEditorial"&&cleanFrames,
    "movimento é curto, estático e limitado a transform/opacity");

    const firstCard=page.locator(".card").first();
    await firstCard.focus();await page.keyboard.press("Enter");
    let flip=await firstCard.evaluate(card=>({flipped:card.classList.contains("flipped"),face:card.dataset.face,
      front:card.querySelector(".cfront").getAttribute("aria-hidden"),
      back:card.querySelector(".cback").getAttribute("aria-hidden")}));
    check(flip.flipped&&flip.face==="back"&&flip.front==="true"&&flip.back==="false",
      "Enter sincroniza face visual e acessível");
    await page.keyboard.press(" ");
    flip=await firstCard.evaluate(card=>({flipped:card.classList.contains("flipped"),face:card.dataset.face}));
    check(!flip.flipped&&flip.face==="front","Espaço devolve a carta à frente");
    await page.emulateMedia({reducedMotion:"reduce"});
    check(await firstCard.evaluate(card=>getComputedStyle(card.querySelector(".cface")).transitionDuration
      .split(",").every(value=>parseFloat(value)===0)),"movimento reduzido desliga o flip animado");
    await page.emulateMedia({reducedMotion:"no-preference"});

    /* O componente no jogo real precisa manter os mesmos contratos. */
    await page.setViewportSize({width:390,height:844});
    await page.goto(`http://127.0.0.1:${port}/index.html?e2e=1`,{waitUntil:"load",timeout:20000});
    await page.click("#rollbtn");
    await page.waitForFunction(()=>document.getElementById("track").children.length>40,{timeout:3000});
    await page.$eval("#track",track=>track.dispatchEvent(new window.TransitionEvent("transitionend",
      {bubbles:true,propertyName:"transform"})));
    await page.waitForSelector("#picks [data-pick]",{state:"attached",timeout:4000});
    await page.waitForTimeout(650);
    const gameCards=await page.locator("#picks [data-pick]").evaluateAll(cards=>cards.map(card=>{
      const rect=card.getBoundingClientRect(),faces=card.querySelector(".cfaces");
      return {player:card.classList.contains("card"),role:card.getAttribute("role"),tabIndex:card.tabIndex,face:card.dataset.face,
        front:card.querySelector(".cfront")?.getAttribute("aria-hidden"),
        back:card.querySelector(".cback")?.getAttribute("aria-hidden"),
        placa:getComputedStyle(faces).getPropertyValue("--placa-n").trim(),
        flag:getComputedStyle(card.querySelector(".c-flag")).display,
        meta:getComputedStyle(card.querySelector(".c-meta")).display,
        stats:card.querySelectorAll(".c-st").length,ratio:rect.width/rect.height,
        left:rect.left,right:rect.right};
    }));
    const gamePage=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,
      clientWidth:document.documentElement.clientWidth}));
    check(gameCards.length>=5&&gameCards.every(card=>card.role==="button"&&card.tabIndex===0&&
      card.face==="front"&&card.front==="false"&&card.back==="true"),
    "jogo real inicia todas as cartas como botões na face correta");
    check(gameCards.filter(card=>card.player).every(card=>card.placa==="28"&&
      card.flag!=="none"&&card.meta!=="none"&&card.stats===4),
      "jogo real usa a mesma densidade canônica, sem ocultar conteúdo");
    check(gameCards.every(card=>Math.abs(card.ratio-5/7)<.01&&card.left>=0&&card.right<=gamePage.clientWidth)&&
      gamePage.scrollWidth<=gamePage.clientWidth,
    "cartas reais preservam 5:7 e não criam overflow horizontal");
    const gameCard=page.locator("#picks [data-pick]").first();
    await page.click("#flipModeBtn");await gameCard.focus();await page.keyboard.press("Enter");
    check(await gameCard.evaluate(card=>card.classList.contains("flipped")&&card.dataset.face==="back"),
      "modo Virar do jogo usa o mesmo controle de face");
    await page.click("#flipModeBtn");await gameCard.click();
    check(await gameCard.evaluate(card=>card.classList.contains("sel"))&&
      await page.locator(".slot.avail").count()>=1,"seleção normal continua funcional");
    check(errors.length===0,`laboratório e jogo terminam sem erro${errors.length?`: ${errors[0]}`:""}`);

    const touchContext=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,
      isMobile:true,hasTouch:true});
    const touchPage=await touchContext.newPage();
    await touchPage.goto(`http://127.0.0.1:${port}/prototipo-cartas.html`,{waitUntil:"networkidle"});
    const touchCard=touchPage.locator(".card").first();
    const before=await touchCard.evaluate(card=>({shadow:getComputedStyle(card).boxShadow,
      transform:getComputedStyle(card).transform,hover:matchMedia("(hover:hover) and (pointer:fine)").matches}));
    await touchCard.tap();await touchPage.waitForTimeout(80);
    const after=await touchCard.evaluate(card=>({shadow:getComputedStyle(card).boxShadow,
      transform:getComputedStyle(card).transform}));
    check(!before.hover&&before.shadow===after.shadow&&before.transform===after.transform,
      "toque não deixa elevação ou halo presos");
    await touchContext.close();

    console.log(failures?`✗ ${failures} checagem(ns) de carta falharam`:
      "✓ carta canônica aprovada nas oito larguras e no jogo real");
    return done(failures?1:0);
  }catch(error){
    console.log("  ✗ e2e de cartas abortou: "+(error.message||error));
    console.log("✗ e2e de robustez das cartas falhou");
    return done(1);
  }
})();
