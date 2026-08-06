/* Robustez geométrica, visual e interativa da carta canônica.
   O laboratório monta o componente real e expõe uma única medição; esta suíte
   apenas dirige o navegador e prova que as guardas também sabem reprovar. */
const http=require("http");
const path=require("path");
const {spawn}=require("child_process");
const {chromium}=require("playwright");
const {ROOT,okMark,chromiumLaunchOptions}=require("../lib/common");

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
  const server=spawn(process.execPath,[path.join(ROOT,"tools","serve-static.js")],
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
        /* `.coachcard .c-func` entra com piso próprio: a característica usa um
           corpo menor que o da função do jogador porque é mais longa, e sem piso
           declarado ela ficaria livre para encolher sem ninguém reclamar. */
        const minimums=[[".card .c-func",9],[".coachcard .c-func",8],
          [".card .c-role2",7],[".c-vnick",11],[".c-vestilo small",7],
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
        /* O fundo era fixo em `[8,13,20]`, o escuro da carta, porque até então
           todo texto vivia direto sobre ele. A faixa cromada do rótulo do
           treinador tem fundo próprio e claro, e a régua fixa acusava 1,03:1 num
           rótulo que na tela é perfeitamente legível. Agora o fundo é procurado
           no elemento e nos ancestrais; quem não declarar nenhum continua sendo
           medido contra o escuro da carta, como antes. Isto não afrouxa a prova:
           ela passa a medir o par que o olho enxerga. */
        const CARTA_ESCURA=[8,13,20];
        const fundoDe=element=>{
          for(let no=element;no&&no.nodeType===1;no=no.parentElement){
            const bruto=getComputedStyle(no).backgroundColor;
            const canais=(bruto.match(/[\d.]+/g)||[]).map(Number);
            const alfa=bruto.startsWith("rgba")?canais[3]:1;
            if(canais.length>=3&&alfa>0)return parseColor(bruto);
          }
          return CARTA_ESCURA;
        };
        const selectors=[".c-ovr small",".c-func",".c-role2",".c-team",".c-vnick",
          ".c-vestilo small",".c-vestilo b",".c-st i",".c-st b",".c-vrod b",".c-vrod span",".c-vdesc"];
        const lowContrast=selectors.flatMap(selector=>[...document.querySelectorAll(selector)]
          .filter(visible).map(element=>{const foreground=luminance(parseColor(getComputedStyle(element).color));
            const background=luminance(fundoDe(element));
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
      /* A escada da placa foi remedida em 02/08/2026 para abraçar a tinta da
         identidade — era 24/26/28, herdada de quando a frente eram três âncoras
         absolutas. Os números saem de medição: tinta + dois respiros dentro da
         faixa 3%–6% que a guarda de simetria cobra nas duas categorias. */
      const esperado=Number(largura)<=150?"26.5":"24.5";
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
    /* Reescrito em 01/08/2026 junto com a nova frente do treinador. As injeções
       mudaram porque o contrato mudou: não se prova mais que a frente replica o
       verso, e sim que a identidade mora DENTRO da placa, que o OVR ocupa a mesma
       posição do jogador e que o serrilhado não voltou à frente. */
    const detectaEspelhoCoach=await page.evaluate(()=>{
      const coach=document.querySelector(".coachcard");
      const campos=()=>window.__LAB_MEDIR().ritmo.map(item=>item.campo);
      /* O bloco é `position:static` dentro do flex da placa, então deslocá-lo
         exige `relative` — mexer em `top` sozinho não moveria nada, e a prova
         passaria sem nunca ter empurrado a identidade para fora. */
      const nickFrente=coach.querySelector(".cfront .c-nick"),estiloNick=nickFrente.style.cssText;
      nickFrente.style.position="relative";nickFrente.style.top="-40px";
      const foraDaPlaca=campos();
      nickFrente.style.cssText=estiloNick;
      const ovr=coach.querySelector(".cfront .c-ovr"),estiloOvr=ovr.style.cssText;
      ovr.style.top="42%";
      const ovrTorto=campos();
      ovr.style.cssText=estiloOvr;
      const fio=coach.querySelector(".cfront .c-fio"),estiloFio=fio.style.cssText;
      fio.style.display="block";
      const serrilhadoDeVolta=campos();
      fio.style.cssText=estiloFio;
      const descricao=coach.querySelector(".c-vdesc"),descAntes=descricao.style.top;
      descricao.style.top="55%";
      const verso=campos();
      descricao.style.top=descAntes;
      /* A frente troca o rótulo pela característica. Se ela voltar a dizer
         "Treinador", as duas faces passam a repetir a mesma informação e o bloco
         da frente perde a razão de existir. */
      const rotulo=coach.querySelector(".cfront .c-func"),textoAntes=rotulo.textContent;
      rotulo.textContent="Treinador";
      const duplicado=campos();
      rotulo.textContent=textoAntes;
      return foraDaPlaca.includes("identidade na base do treinador · nick entra na placa")&&
        ovrTorto.includes("OVR do treinador igual ao do jogador · topo")&&
        serrilhadoDeVolta.includes("régua serrilhada do treinador · fora da frente")&&
        verso.includes("verso padronizado · início do corpo")&&
        duplicado.includes("frente replica o verso · rótulo trocado");
    });
    check(detectaEspelhoCoach,
      "medidor acusa identidade fora da placa, OVR torto, serrilhado de volta ou rótulo repetido");
    const detectaVersoCoach=await page.evaluate(()=>{
      const coach=document.querySelector(".coachcard");
      const linha=coach.querySelector(".c-vef"),displayAntes=linha.style.display;
      linha.style.display="none";
      const linhas=window.__LAB_MEDIR().ritmo.map(item=>item.campo);
      linha.style.display=displayAntes;
      /* Reencena o layout que de fato falhou: ancorar frase e números nas duas
         pontas da reserva. Ele passava na guarda de colisão — que só reprova
         sobreposição — com a última linha a 2,4 px do rodapé. */
      const corpo=coach.querySelector(".c-vdesc"),alinhamentoAntes=corpo.style.justifyContent;
      corpo.style.justifyContent="space-between";
      const respiro=window.__LAB_MEDIR().ritmo.map(item=>item.campo);
      corpo.style.justifyContent=alinhamentoAntes;
      return linhas.includes("verso padronizado · linhas de efeito")&&
        respiro.includes("verso padronizado · respiro antes do rodapé");
    });
    check(detectaVersoCoach,"medidor acusa linha de efeito sumida ou corpo colado no rodapé");
    check((await page.evaluate(()=>window.__LAB_MEDIR())).falhas.length===0&&
      (await page.evaluate(()=>window.__LAB_MEDIR())).ritmo.length===0,
    "medição volta ao verde depois das provas sintéticas");

    /* ——— MONOGRAMA DO CAMPO VAZIO ———————————————————————————————————————
       Ele não tinha guarda nenhuma até 05/08/2026, e foi por isso que três
       defeitos conviveram sem ninguém ver: a tinta caía +2,83 px à direita em
       média (pior caso +5,25 px), subia 0,93 px, e o tamanho aparente variava
       1,88× entre `TI` e `SW`. Estas provas congelam a geometria nova E as duas
       constantes de que ela depende — se a fonte mudar por baixo delas, aqui
       reprova. */
    const mono=await page.evaluate(()=>{
      const cv=document.createElement("canvas").getContext("2d");
      cv.font='700 1000px "Chakra Petch"';
      /* Constantes que `card-view.mjs` congelou, remedidas na fonte REAL.
         H I E T F são planos: O e S têm overshoot e mediriam alto demais. */
      const cap=["H","I","E","T","F"].map(c=>cv.measureText(c).actualBoundingBoxAscent/1000);
      const capDigito=["0","1","9"].map(c=>cv.measureText(c).actualBoundingBoxAscent/1000);
      const alfabeto=[..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"];
      const larguras=alfabeto.map(c=>cv.measureText(c).width/1000).sort((a,b)=>b-a);
      const parMaisLargo=larguras[0]+larguras[1];

      const itens=[];
      for(const el of document.querySelectorAll("#gElencos .c-mono")){
        const caixa=el.getBoundingClientRect();
        if(caixa.width<40)continue;
        const svg=el.querySelector("svg");
        if(!svg){itens.push({semSvg:true});continue;}
        const s=svg.getBoundingClientRect();
        const carta=el.closest(".card,.coachcard").getBoundingClientRect();
        /* O AVANÇO do texto, em unidades do viewBox. Medir a caixa do <svg>
           seria tautológico — ela vem do CSS e é igual por construção. O que
           precisa ser provado é que o texto DENTRO dela foi mesmo normalizado.
           `getBBox()` de <text> devolve a caixa EM no Chromium (altura fixa de
           1,3em, topo em −41,49), não a tinta: serve para a largura, que é o que
           `textLength` governa, e não serve para altura nenhuma. */
        const vb=svg.viewBox.baseVal;
        const texto=svg.querySelector("text");
        const bb=texto.getBBox();
        itens.push({texto:el.textContent.trim(),
          desvioH:(s.left+s.width/2)-(caixa.left+caixa.width/2),
          desvioV:(s.top+s.height/2)-(caixa.top+caixa.height/2),
          largura:s.width,altura:s.height,fracaoCarta:s.height/carta.width,
          avancoLargura:bb.width,avancoCentro:(bb.x+bb.width/2)-vb.width/2,
          base:Number(texto.getAttribute("y")),
          corpo:Number(texto.getAttribute("font-size")),vbAltura:vb.height});
      }
      return {cap,capDigito,parMaisLargo,itens,vbLargura:238.9};
    });
    const capMedida=mono.cap.reduce((s,v)=>s+v,0)/mono.cap.length;
    /* A caixa-alta É o viewBox: se ela mudar, a base do texto deixa de cair em
       y=100 e a letra volta a ficar torta na vertical. */
    check(Math.abs(capMedida-0.7031)<0.002,
      `caixa-alta da fonte continua 0,7031em (medido ${capMedida.toFixed(4)})`);
    /* Dígito e letra compartilham a caixa-alta — é o que dispensa exceção para
       `91`, `S1`, `B1`, `N0` e `M0`. */
    check(mono.capDigito.every(v=>Math.abs(v-capMedida)<0.002),
      "dígito e letra continuam com a mesma caixa-alta");
    /* `WM` é o par mais largo POSSÍVEL em A-Z0-9. A constante sai da FONTE e não
       do dado: assim, adicionar um time novo não pode espremer o monograma. */
    check(mono.parMaisLargo<=1.68+1e-6,
      `par mais largo do alfabeto continua cabendo em 1,68em (medido ${mono.parMaisLargo.toFixed(4)})`);

    check(mono.itens.length>0&&!mono.itens.some(i=>i.semSvg),
      `os ${mono.itens.length} monogramas usam geometria normalizada`);
    const desvioMax=Math.max(...mono.itens.map(i=>Math.max(Math.abs(i.desvioH),Math.abs(i.desvioV))));
    check(desvioMax<0.1,`caixa do monograma centrada nos dois eixos (pior desvio ${desvioMax.toFixed(3)}px)`);
    /* A prova que NÃO é tautológica: o avanço de todos os pares tem de ser o
       mesmo. A sintética abaixo mostra que, sem `textLength`, isto volta a
       1,75× — então a asserção mede o mecanismo, não a própria constante. */
    const avancos=mono.itens.map(i=>i.avancoLargura);
    const espalhamento=Math.max(...avancos)/Math.min(...avancos);
    check(espalhamento<1.02,
      `avanço dos ${mono.itens.length} monogramas é uniforme (${espalhamento.toFixed(3)}× do menor ao maior; a tinta variava 1,88×)`);
    const foraDoEixo=Math.max(...mono.itens.map(i=>Math.abs(i.avancoCentro)));
    check(foraDoEixo<mono.vbLargura*0.02,
      `texto centrado no eixo do viewBox (pior ${foraDoEixo.toFixed(1)} de ${mono.vbLargura} unidades)`);
    /* O QUE SUSTENTA A CENTRAGEM VERTICAL: o viewBox tem de SER a caixa-alta.
       Com a base em y=100 e o corpo valendo 100/cap, o topo da maiúscula cai em
       zero e centrar o elemento passa a centrar a LETRA — a régua da §21. Esta
       conta liga a constante do código à fonte medida acima; se uma das duas
       andar sozinha, o topo sai de zero e aqui reprova. */
    const topoDaCaixaAlta=mono.itens.map(i=>i.base-capMedida*i.corpo);
    const topoMax=Math.max(...topoDaCaixaAlta.map(Math.abs));
    check(topoMax<1,
      `viewBox É a caixa-alta: topo da maiúscula em ${topoMax.toFixed(2)} de ${mono.itens[0].vbAltura} unidades`);
    /* O tamanho não pode ter mudado junto com a centragem: 46cqw × 0,7031 era a
       caixa-alta de antes, e continua sendo. */
    const fracao=mono.itens[0].fracaoCarta;
    check(Math.abs(fracao-0.3234)<0.004,
      `caixa-alta segue em 32,3% da largura da carta (medido ${(fracao*100).toFixed(2)}%)`);

    /* PROVA SINTÉTICA — sem ela as asserções acima poderiam estar sempre verdes.
       Reencena o defeito antigo tirando a normalização e confere que o
       espalhamento volta a explodir. */
    const detectaMonoSolto=await page.evaluate(()=>{
      const alvos=[...document.querySelectorAll("#gElencos .c-mono")]
        .filter(el=>el.getBoundingClientRect().width>=40);
      const medir=()=>alvos.map(el=>el.querySelector("text").getBBox().width);
      const antes=alvos.map(el=>el.querySelector("text").getAttribute("textLength"));
      alvos.forEach(el=>el.querySelector("text").removeAttribute("textLength"));
      const soltos=medir();
      alvos.forEach((el,i)=>el.querySelector("text").setAttribute("textLength",antes[i]));
      const voltou=medir();
      const razao=v=>Math.max(...v)/Math.min(...v);
      return {solto:razao(soltos),normal:razao(voltou)};
    });
    check(detectaMonoSolto.solto>1.5&&detectaMonoSolto.normal<1.06,
      `prova sintética · sem normalização a tinta volta a variar ${detectaMonoSolto.solto.toFixed(2)}×, `+
      `e a medição volta a ${detectaMonoSolto.normal.toFixed(3)}×`);

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
      /* Desde 01/08/2026 o OVR do treinador ocupa a MESMA posição do OVR do
         jogador, então ele usa a MESMA zona — e essa igualdade é o ponto. A zona
         anterior era `y:.65 h:.22`, recortada para um OVR que morava na base e
         precisava parar antes do cromo claro da faixa. Mantê-la aqui mediria o
         rodapé e devolveria 1,05:1 sobre um número que está no topo. */
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
        /* `#picks` traz jogadores E treinadores, e o treinador não tem mais
           bandeira nem faixa de contexto na frente. A asserção abaixo já filtra
           por `card.player`; aqui basta não estourar ao coletar. */
        flag:card.querySelector(".c-flag")?getComputedStyle(card.querySelector(".c-flag")).display:"ausente",
        meta:card.querySelector(".c-meta")?getComputedStyle(card.querySelector(".c-meta")).display:"ausente",
        stats:card.querySelectorAll(".c-st").length,ratio:rect.width/rect.height,
        left:rect.left,right:rect.right};
    }));
    const gamePage=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,
      clientWidth:document.documentElement.clientWidth}));
    check(gameCards.length>=5&&gameCards.every(card=>card.role==="button"&&card.tabIndex===0&&
      card.face==="front"&&card.front==="false"&&card.back==="true"),
    "jogo real inicia todas as cartas como botões na face correta");
    /* A densidade é DERIVADA da largura medida, não cravada por viewport. Antes
       esta linha exigia a densidade compacta a 390 px, e isso só era verdade
       porque a grade entregava 105,7 px ali — abaixo do piso que a suíte prova.
       Com a grade corrigida a carta tem 168 px e a densidade é a completa;
       cravar um valor por viewport transformaria uma correção em reprovação. */
    const densidadeEsperada=largura=>largura<=150?"26.5":"24.5";
    const larguraReal=await page.locator("#picks .card").first()
      .evaluate(card=>card.getBoundingClientRect().width);
    check(gameCards.filter(card=>card.player)
      .every(card=>card.placa===densidadeEsperada(larguraReal)&&
      card.flag!=="none"&&card.meta!=="none"&&card.stats===4),
      "jogo real usa a mesma densidade canônica, sem ocultar conteúdo");
    check(gameCards.every(card=>Math.abs(card.ratio-5/7)<.01&&card.left>=0&&card.right<=gamePage.clientWidth)&&
      gamePage.scrollWidth<=gamePage.clientWidth,
    "cartas reais preservam 5:7 e não criam overflow horizontal");

    /* AS DUAS GRADES SÃO A MESMA GRADE, E A CARTA NUNCA CAI ABAIXO DO PISO.

       As oito larguras acima provam a CARTA; nenhuma provava a GRADE que decide
       essa largura no jogo. Medido em 02/08/2026, antes da correção: `.picks` e
       `.lineup` nunca coincidiam — 4,3 px de diferença no desktop e até 13 px a
       320 px, porque `.squad` tem padding e borda e `.picks` não tinha nenhum
       dos dois. Em três faixas de viewport as duas caíam em DENSIDADES
       diferentes, com a carta escolhida e a escalada lado a lado em corpos
       diferentes. E a escada 6→3→2 colunas entregava 105,7 px a 641 px e a
       375 px — abaixo dos 120 px que esta suíte prova —, com o `.squad`
       transbordando e o `overflow-x:hidden` do body escondendo.

       O piso é 120 px porque é a menor largura medida acima: abaixo dela nada
       está provado, então o produto não pode ir. */
    const PISO=120;
    const grades=[];
    for(const largura of [1280,1024,900,860,820,700,680,660,560,540,440,420,390,360,320]){
      await page.setViewportSize({width:largura,height:900});
      await page.waitForTimeout(60);
      grades.push({largura,...await page.evaluate(()=>{
        const coluna=el=>{const v=getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean);
          return {n:v.length,w:+parseFloat(v[0]).toFixed(2)};};
        const picks=document.getElementById("picks"),squad=document.querySelector(".squad");
        const carta=document.querySelector("#picks .card,#picks .coachcard");
        const doc=document.documentElement;
        return {picks:coluna(picks),squad:coluna(squad),
          carta:carta?+carta.getBoundingClientRect().width.toFixed(2):null,
          docOver:doc.scrollWidth-doc.clientWidth,squadOver:squad.scrollWidth-squad.clientWidth};
      })});
    }
    const grade=grades.find(g=>Math.abs(g.picks.w-g.squad.w)>.5||g.picks.n!==g.squad.n||
      g.picks.w<PISO||(g.carta!==null&&Math.abs(g.carta-g.picks.w)>.5)||
      g.docOver>0||g.squadOver>0);
    check(!grade,`bancada e elenco compartilham a mesma coluna, nunca abaixo de ${PISO}px`+
      (grade?` — ${grade.largura}px: picks ${grade.picks.n}×${grade.picks.w} · `+
        `squad ${grade.squad.n}×${grade.squad.w} · carta ${grade.carta} · `+
        `overflow ${grade.docOver}/${grade.squadOver}`:""));
    /* Sem penhasco: trocar de coluna não pode dobrar a carta. O pior salto medido
       é o 3→2 colunas, inerente à razão entre elas; o layout antigo saltava 82%
       em UM pixel de viewport, ao ir de 6 para 3 de uma vez. */
    const saltos=grades.slice(1).map((g,i)=>({de:grades[i].largura,para:g.largura,
      razao:g.picks.w/grades[i].picks.w}));
    const penhasco=saltos.find(s=>s.razao>1.55||s.razao<1/1.55);
    check(!penhasco,"nenhuma troca de coluna dobra a largura da carta"+
      (penhasco?` — ${penhasco.de}px→${penhasco.para}px muda ${((penhasco.razao-1)*100).toFixed(0)}%`:""));
    await page.setViewportSize({width:390,height:844});
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
