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

   COMO ELA MEDE. O laboratório (`prototipo-cartas.html`) renderiza 156 cartas
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
/* 100 reais (85 jogadores + 15 treinadores) + 7 da escada (6 faixas + treinador)
   + 36 da matriz (6 faixas × 6 funções) + 9 casos de layout + 4 comparadores de
   enquadramento/composição. */
const CARTAS_ESPERADAS=156;

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
    const framing=await page.locator("#gRetratos .card[data-enquadramento]").evaluateAll(cards=>
      cards.map(card=>({id:card.dataset.enquadramento,
        size:getComputedStyle(card).getPropertyValue("--foto-size").trim(),
        x:getComputedStyle(card).getPropertyValue("--foto-x").trim(),
        y:getComputedStyle(card).getPropertyValue("--foto-y").trim()})));
    check(JSON.stringify(framing)===JSON.stringify([
      {id:"a",size:"100% auto",x:"50%",y:"12%"},
      {id:"a-anterior",size:"100% auto",x:"50%",y:"12%"},
      {id:"b",size:"116% auto",x:"70%",y:"28%"},
      {id:"c",size:"132% auto",x:"75%",y:"30%"},
    ]),"laboratório compara A refinado, A anterior e os dois enquadramentos históricos");
    check(await page.locator('#gRetratos .card[data-enquadramento="a-anterior"]'+
      '[data-layout-reference="true"]').count()===1,
    "composição anterior está marcada como referência, não como candidata");
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
       decapitado — nick, função, campeonato e rótulo do verso, que não têm
       reticências. NÃO reprova contexto secundário ou nome de stat com
       `text-overflow:ellipsis` declarado no CSS: ali cortar é decisão de design.
       Essa distinção existe porque a
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

    /* A proposta visual está ativa e ainda não foi promovida. Ela precisa cumprir as
       mesmas guardas geométricas do estado publicado em todas as larguras. */
    await page.check("#cProposta");
    const composicoes=[];
    for(const esperado of [
      {largura:"250",placa:.34,contexto:.035,funcao:.08,nick:.157},
      {largura:"130",placa:.30,contexto:null,funcao:.045,nick:.121},
    ]){
      const {largura}=esperado;
      await page.selectOption("#cLargura",largura);await page.waitForTimeout(80);
      const medido=await page.locator('#gRetratos .card[data-enquadramento="a"]').evaluate(card=>{
        const faces=card.querySelector(".cfaces"),altura=faces.getBoundingClientRect().height;
        const proporcao=selector=>{
          const estilo=getComputedStyle(card.querySelector(selector));
          return estilo.display==="none"?null:parseFloat(estilo.bottom)/altura;
        };
        return {placa:card.querySelector(".c-placa").getBoundingClientRect().height/altura,
          contexto:proporcao(".c-meta"),funcao:proporcao(".c-func"),nick:proporcao(".c-nick")};
      });
      const campos=["placa","contexto","funcao","nick"];
      composicoes.push({largura,medido,esperado,
        ok:campos.every(campo=>esperado[campo]===null
          ?medido[campo]===null:Math.abs(medido[campo]-esperado[campo])<.002)});
    }
    const composicaoOk=composicoes.every(item=>item.ok);
    check(composicaoOk,
      "A refinado preserva mais retrato que o jogo e recupera a grade nas duas densidades"+
      (composicaoOk?"":` — ${JSON.stringify(composicoes)}`));
    await page.selectOption("#cLargura","188");await page.waitForTimeout(80);
    const comparacaoA=await page.locator('#gRetratos .card[data-enquadramento^="a"]').evaluateAll(cards=>
      Object.fromEntries(cards.map(card=>{const faces=card.querySelector(".cfaces"),fs=getComputedStyle(faces);
        const px=sel=>parseFloat(getComputedStyle(card.querySelector(sel)).fontSize);
        return [card.dataset.enquadramento,{placa:fs.getPropertyValue("--placa-n").trim(),
          b1:fs.getPropertyValue("--b1").trim(),hierarquia:px(".c-vestilo b")/px(".c-vnick"),
          reserva:parseFloat(getComputedStyle(card.querySelector(".c-vrod")).minHeight)}];})));
    check(comparacaoA.a?.placa==="34"&&comparacaoA.a?.b1==="3.5%"&&
      comparacaoA.a?.hierarquia>=1.14&&comparacaoA.a?.reserva>=26&&
      comparacaoA["a-anterior"]?.placa==="32"&&comparacaoA["a-anterior"]?.b1==="2.8%"&&
      comparacaoA["a-anterior"]?.hierarquia<1.05&&comparacaoA["a-anterior"]?.reserva===0,
    "comparador conserva o A anterior e isola placa, margem, hierarquia e reserva do refinado"+
      (comparacaoA.a?.placa==="34"?"":` — ${JSON.stringify(comparacaoA)}`));
    for(const largura of LARGURAS){
      await page.selectOption("#cLargura",largura);await page.waitForTimeout(80);
      const audit=await page.evaluate(()=>window.__LAB_MEDIR());
      check(audit.falhas.length===0&&audit.ritmo.length===0,
        `${largura}px · proposta sem falha geométrica ou editorial`+
        (audit.falhas.length?` (geometria: ${audit.falhas[0].campo} em `+
          `${audit.falhas[0].nick}, falta ${audit.falhas[0].falta}px, fonte `+
          `${audit.falhas[0].fonte})`:"")+
        (audit.ritmo.length?` (grade: ${audit.ritmo[0].campo} em ${audit.ritmo[0].nick}, `+
          `${audit.ritmo[0].atual}${audit.ritmo[0].unidade} / `+
          `${audit.ritmo[0].regra} ${audit.ritmo[0].limite}${audit.ritmo[0].unidade})`:""));

      const standards=await page.evaluate(()=>{
        const cards=[...document.querySelectorAll(".card,.coachcard")];
        const visible=element=>element&&getComputedStyle(element).display!=="none"&&
          getComputedStyle(element).visibility!=="hidden";
        const px=element=>parseFloat(getComputedStyle(element).fontSize);
        const minimums=[[".c-vnick",10],[".c-vestilo small",7],[".c-st i",7],[".c-st b",9],
          [".c-vrod b",8],[".c-vrod span",7],[".c-vdesc",8]];
        const tooSmall=minimums.flatMap(([selector,minimum])=>
          [...document.querySelectorAll(selector)].filter(element=>visible(element)&&px(element)<minimum-.05)
            .map(element=>({selector,size:px(element),minimum,text:element.textContent.trim()})));
        const footers=cards.map(card=>card.querySelector(".c-vrod"));
        const missingFooter=footers.filter(footer=>!visible(footer)||!footer.textContent.trim()).length;
        const ratingNodes=document.querySelectorAll(".c-vovr").length;
        const weightNodes=document.querySelectorAll(".c-st em").length;
        const externalShadows=cards.filter(card=>{
          const shadow=getComputedStyle(card).boxShadow;
          return shadow!=="none"&&!/\binset\s*$/.test(shadow);
        }).length;

        const parseColor=value=>{
          const numbers=(value.match(/[\d.]+/g)||[]).map(Number);
          if(value.startsWith("color(srgb"))return numbers.slice(0,3).map(number=>number*255);
          return numbers.slice(0,3);
        };
        const luminance=color=>{
          const linear=color.map(channel=>{const value=channel/255;
            return value<=.04045?value/12.92:((value+.055)/1.055)**2.4;});
          return .2126*linear[0]+.7152*linear[1]+.0722*linear[2];
        };
        const background=luminance([8,13,20]);
        const contrastSelectors=[".c-ovr small",".c-func",".c-meta",".c-vnick",".c-vestilo small",
          ".c-vestilo b",".c-st i",".c-st b",".c-vrod b",".c-vrod span",".c-vdesc"];
        const lowContrast=contrastSelectors.flatMap(selector=>
          [...document.querySelectorAll(selector)].filter(visible).map(element=>{
            const foreground=luminance(parseColor(getComputedStyle(element).color));
            const ratio=(Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05);
            return {selector,ratio,text:element.textContent.trim()};
          }).filter(result=>result.ratio<4.5));
        return {missingFooter,ratingNodes,weightNodes,externalShadows,tooSmall,lowContrast};
      });
      check(standards.missingFooter===0&&standards.ratingNodes===0&&standards.weightNodes===0,
        `${largura}px · verso reserva espaço só para identidade, stats e campeonato`+
        (standards.missingFooter?` (${standards.missingFooter} rodapé(s) ausente(s))`:"")+
        (standards.ratingNodes?` (${standards.ratingNodes} rating(s) ainda no HTML)`:"")+
        (standards.weightNodes?` (${standards.weightNodes} peso(s) ainda no HTML)`:""));
      check(standards.tooSmall.length===0&&standards.lowContrast.length===0,
        `${largura}px · texto importante respeita tamanho mínimo e contraste 4,5:1`+
        (standards.tooSmall.length?` (1º: ${standards.tooSmall[0].selector} ${standards.tooSmall[0].size}px)`:"")+
        (standards.lowContrast.length?` (1º contraste: ${standards.lowContrast[0].selector} `+
          `${standards.lowContrast[0].ratio.toFixed(2)}:1)`:""));
      check(standards.externalShadows===0,
        `${largura}px · nenhuma carta projeta halo externo`+
        (standards.externalShadows?` (${standards.externalShadows} falha(s))`:""));
    }

    /* O gate editorial também precisa provar que sabe reprovar. As nove
       deformações vivem apenas durante esta avaliação e são restauradas pelo
       `cssText` original antes de qualquer outra medição. */
    await page.selectOption("#cLargura","188");await page.waitForTimeout(80);
    const detectaGrade=await page.locator('#gRetratos .card[data-enquadramento="a"]').evaluate(card=>{
      const alvos=[card.querySelector(".cfaces"),card.querySelector(".c-nick"),
        card.querySelector(".c-vestilo"),card.querySelector(".c-vestilo b"),
        card.querySelector(".c-vrod"),card.querySelector(".c-vfaixa"),
        card.querySelector(".c-func"),card.querySelector(".c-flag"),
        card.querySelector(".c-vstats")];
      const originais=alvos.map(el=>el.style.cssText);
      const [faces,nick,estilo,rotulo,rodape,faixa,funcao,flag,stats]=alvos;
      faces.style.setProperty("--b1","1%");
      nick.style.bottom="22%";
      estilo.style.top="20%";
      rotulo.style.fontSize=getComputedStyle(card.querySelector(".c-vnick")).fontSize;
      rodape.style.minHeight="0";
      faixa.style.clipPath="polygon(0 0,100% 0,100% 90%,0 100%)";
      funcao.style.left="12%";
      flag.style.top="9%";
      stats.style.top="55%";stats.style.bottom="10%";
      const campos=window.__LAB_MEDIR().ritmo.filter(f=>f.nick===(card.dataset.nick||"—"))
        .map(f=>f.campo);
      alvos.forEach((el,index)=>{el.style.cssText=originais[index];});
      return campos;
    });
    const camposGrade=["respiro inferior · frente","respiro inferior · verso",
      "respiro diagonal · frente","respiro diagonal · verso","inclinação frente/verso",
      "hierarquia playstyle/nick","equilíbrio stats/era","eixo lateral compartilhado",
      "alinhamento OVR/bandeira"];
    check(camposGrade.every(campo=>detectaGrade.includes(campo)),
      "medidor acusa margem, diagonais, hierarquia, equilíbrio e eixos degradados"+
      (camposGrade.every(campo=>detectaGrade.includes(campo))?"":` — viu ${detectaGrade.join(", ")}`));
    const gradeLimpa=await page.evaluate(()=>window.__LAB_MEDIR().ritmo.length);
    check(gradeLimpa===0,"grade editorial volta a zero depois da prova sintética");

    /* CONTRASTE SOBRE RETRATO — a checagem acima calcula contraste contra um
       fundo FIXO escuro, e esse modelo deixa de valer na carta que tem foto: o
       OVR e a bandeira ficam direto sobre o campo, sem placa por baixo, e cada
       retrato traz o proprio padrao de luz. Um rosto claro ali reprovaria na
       tela e passaria na guarda.

       Aqui se mede o que esta PINTADO: fotografa a carta com o texto escondido,
       varre as duas zonas e pega o pixel mais claro — o pior caso para texto
       branco. Esconder o texto e obrigatorio; sem isso o pixel mais claro da
       zona e o proprio numero e a medicao mede a si mesma. */
    const ZONAS=[["OVR",.06,.04,.45,.22],["bandeira",.60,.03,.95,.16]];
    for(const largura of ["250","130"]){
      await page.selectOption("#cLargura",largura);
      await page.waitForTimeout(140);
      const comFoto=page.locator('.card[style*="--foto"],.coachcard[style*="--foto"]');
      const quantas=await comFoto.count();
      if(!quantas){
        check(true,`${largura}px · nenhuma carta com retrato nesta pagina (nada a medir)`);
        continue;
      }
      const piores=[];
      for(let i=0;i<quantas;i++){
        const carta=comFoto.nth(i);
        const nick=await carta.evaluate(c=>c.dataset.nick||"—");
        await carta.evaluate(c=>{for(const s of [".c-ovr",".c-flag"]){
          const el=c.querySelector(s);if(el)el.style.visibility="hidden";}});
        const png=await carta.screenshot();
        await carta.evaluate(c=>{for(const s of [".c-ovr",".c-flag"]){
          const el=c.querySelector(s);if(el)el.style.visibility="";}});
        const medido=await page.evaluate(async([b64,zonas])=>{
          const img=await new Promise(res=>{const i=new window.Image();i.onload=()=>res(i);
            i.src="data:image/png;base64,"+b64;});
          const cv=document.createElement("canvas");cv.width=img.width;cv.height=img.height;
          const cx=cv.getContext("2d",{willReadFrequently:true});cx.drawImage(img,0,0);
          const lum=c=>{const l=c.map(ch=>{const v=ch/255;
            return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
            return .2126*l[0]+.7152*l[1]+.0722*l[2];};
          return zonas.map(([nome,x0,y0,x1,y1])=>{
            const d=cx.getImageData(Math.round(img.width*x0),Math.round(img.height*y0),
              Math.round(img.width*(x1-x0)),Math.round(img.height*(y1-y0))).data;
            let maior=-1;
            for(let p=0;p<d.length;p+=4){const L=lum([d[p],d[p+1],d[p+2]]);if(L>maior)maior=L;}
            return {nome,razao:+((1.05)/(maior+.05)).toFixed(2)};
          });
        },[png.toString("base64"),ZONAS]);
        for(const m of medido)if(m.razao<4.5)piores.push(`${nick} ${m.nome} ${m.razao}:1`);
      }
      check(piores.length===0,
        `${largura}px · ${quantas} carta(s) com retrato mantem 4,5:1 no OVR e na bandeira`+
        (piores.length?` — ${piores[0]}`:""));
    }

    /* PROVA DE QUE A MEDICAO ACUSA, e de qual e a margem real do escurecimento.
       Sem ela, "nenhuma carta reprovou" pode significar apenas que a amostragem
       parou de funcionar. Duas injecoes no mesmo pixel branco, o pior retrato
       concebivel: com o escurecimento do campo, tem de PASSAR; sem ele, tem de
       REPROVAR. A primeira mede a folga do desenho, a segunda mede o detector. */
    await page.selectOption("#cLargura","250");
    await page.waitForTimeout(140);
    const prova=await page.evaluate(async()=>{
      const carta=document.querySelector('.card[style*="--foto"]');
      if(!carta)return null;
      const foto=carta.querySelector(".cfront .c-foto");
      const original=foto.style.backgroundImage;
      const lum=c=>{const l=c.map(ch=>{const v=ch/255;
        return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
        return .2126*l[0]+.7152*l[1]+.0722*l[2];};
      const medir=()=>{
        const cs=getComputedStyle(foto);
        /* recria as camadas num canvas do mesmo tamanho e amostra a zona do OVR */
        const r=foto.getBoundingClientRect();
        const cv=document.createElement("canvas");cv.width=Math.round(r.width);cv.height=Math.round(r.height);
        const cx=cv.getContext("2d");
        cx.fillStyle="#fff";cx.fillRect(0,0,cv.width,cv.height);
        if(cs.backgroundImage.includes("linear-gradient")&&!cs.backgroundImage.startsWith("linear-gradient(rgb(255")){
          const g=cx.createLinearGradient(0,0,0,cv.height);
          g.addColorStop(0,"rgba(3,6,11,.90)");g.addColorStop(.14,"rgba(3,6,11,.74)");
          g.addColorStop(.26,"rgba(3,6,11,.48)");g.addColorStop(.36,"rgba(3,6,11,.14)");
          g.addColorStop(.46,"rgba(3,6,11,0)");
          cx.fillStyle=g;cx.fillRect(0,0,cv.width,cv.height);
        }
        const d=cx.getImageData(Math.round(cv.width*.06),Math.round(cv.height*.04),
          Math.round(cv.width*.39),Math.round(cv.height*.18)).data;
        let maior=-1;
        for(let p=0;p<d.length;p+=4){const L=lum([d[p],d[p+1],d[p+2]]);if(L>maior)maior=L;}
        return +((1.05)/(maior+.05)).toFixed(2);
      };
      const comEscurecimento=medir();
      foto.style.backgroundImage="linear-gradient(rgb(255,255,255),rgb(255,255,255))";
      const semEscurecimento=medir();
      foto.style.backgroundImage=original;
      return {comEscurecimento,semEscurecimento};
    });
    check(prova&&prova.semEscurecimento<4.5,
      `medicao acusa retrato sem escurecimento (${prova?prova.semEscurecimento:"?"}:1)`);
    check(prova&&prova.comEscurecimento>=4.5,
      `escurecimento aguenta o pior retrato possivel — branco puro (${prova?prova.comEscurecimento:"?"}:1)`);

    await page.selectOption("#cLargura","188");
    const motion=await page.locator(".card").first().evaluate(card=>{
      const face=getComputedStyle(card.querySelector(".cface")),cardStyle=getComputedStyle(card);
      const holo=getComputedStyle(card,"::after").animationName;
      card.classList.add("deal");const deal=getComputedStyle(card);
      const dealAnimation=card.getAnimations().find(animation=>animation.animationName==="cardDealEditorial");
      const dealState={name:deal.animationName,duration:deal.animationDuration,
        frames:dealAnimation?.effect.getKeyframes()||[]};
      dealAnimation?.cancel();card.classList.remove("deal");
      card.classList.add("land");const land=getComputedStyle(card);
      const landAnimation=card.getAnimations().find(animation=>animation.animationName==="cardLandEditorial");
      const landState={name:land.animationName,duration:land.animationDuration,
        frames:landAnimation?.effect.getKeyframes()||[]};
      landAnimation?.cancel();card.classList.remove("land");
      return {cardProperty:cardStyle.transitionProperty,cardDuration:cardStyle.transitionDuration,
        faceProperty:face.transitionProperty,faceDuration:face.transitionDuration,holo,
        deal:dealState,land:landState};
    });
    const cleanFrames=[...motion.deal.frames,...motion.land.frames].every(frame=>{
      const transform=frame.transform||"";
      const scales=[...transform.matchAll(/scale\(([^)]+)\)/g)].map(match=>Number(match[1]));
      return !frame.boxShadow&&!/rotate/i.test(transform)&&scales.every(scale=>scale<=1);
    });
    check(motion.cardProperty==="transform"&&motion.cardDuration==="0.18s"&&
      motion.faceProperty==="transform, opacity"&&motion.faceDuration==="0.36s, 0.18s"&&
      motion.holo==="none"&&motion.deal.name==="cardDealEditorial"&&motion.deal.duration==="0.4s"&&
      motion.land.name==="cardLandEditorial"&&motion.land.duration==="0.28s"&&cleanFrames,
    "cartas usam movimento curto, estático e limitado a transform/opacity"+
      (motion.holo!=="none"?` (holo: ${motion.holo})`:""));
    const proposalCard=page.locator(".card").first();
    await proposalCard.hover();await page.waitForTimeout(220);
    const hover=await proposalCard.evaluate(card=>({shadow:getComputedStyle(card).boxShadow,
      transform:getComputedStyle(card).transform}));
    check(/\binset\s*$/.test(hover.shadow)&&hover.transform!=="none",
      "hover eleva discretamente sem reintroduzir halo externo");
    await page.mouse.move(0,0);
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

    /* As provas sintéticas rodam a 188px para terem ampla folga entre defeito
       injetado e variação subpixel entre plataformas. */
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

    /* E a distinção também é testada: um nome de atributo com reticências
       declaradas entra no relatório, nunca na reprovação. O campeonato deixou de
       usar reticências e agora precisa permanecer integralmente legível. */
    const separa=await page.evaluate(()=>{
      const stat=document.querySelector(".card .c-st i");
      if(!stat)return null;
      const original=stat.textContent;
      stat.textContent="ATRIBUTO IMPOSSIVELMENTE LONGO";
      const {falhas,reticencias}=window.__LAB_MEDIR();
      stat.textContent=original;
      return {reprovou:falhas.some(f=>f.campo.startsWith("stat")),
        relatou:reticencias.some(f=>f.campo.startsWith("stat"))};
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
        shadow:getComputedStyle(card).boxShadow,
        sheen:getComputedStyle(card.querySelector(".cfront"),"::before").content,
        ratio:rect.width/rect.height,left:rect.left,right:rect.right};
    }));
    check(gameCards.length>=5&&gameCards.every(card=>card.role==="button"&&card.tabIndex===0),
      "jogo real expõe todas as cartas disponíveis como botões de teclado");
    check(gameCards.every(card=>card.face==="front"&&card.front==="false"&&
      card.back==="true"&&card.placaN==="32"),
      "jogo real inicia na frente e aplica densidade compacta no celular");
    check(gameCards.every(card=>/\binset\s*$/.test(card.shadow)&&card.sheen==="none"),
      "jogo real não reintroduz halo ou varredura de luz na entrada das cartas");
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
