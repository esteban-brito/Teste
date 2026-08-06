/* bancada/suites/e2e-acessibilidade.js — o que nenhuma outra suíte olhava.
   ══════════════════════════════════════════════════════════════════════════════

   POR QUE EXISTE. As outras 25 suítes provam que o elemento EXISTE e que o fluxo AVANÇA.
   Nenhuma perguntava se o jogo emite erro de console, se alguma requisição volta
   4xx, ou se um teclado e um leitor de tela conseguem jogar. O `e2e-game-flow`
   chega perto — coleta `pageerror` e console `error` —, mas filtra de propósito
   `Failed to load resource` e `net::`, então um 404 real passava batido, e ele
   não olha acessibilidade nenhuma.

   O QUE ISSO ACHOU EM 04/08/2026, tudo reproduzível e tudo corrigido depois:

     1. o documento não tinha <h1> visível — o único estava dentro do <noscript>,
        que nunca renderiza com JS ligado;
     2. os cinco overlays declaravam `aria-modal="true"`, o que promete que o
        resto da página está inerte, e a promessa era vazia: o foco continuava no
        fundo ao abrir, sete botões do `.wrap` seguiam alcançáveis por Tab e
        Escape não fechava nada;
     3. o rótulo "Importar" do Hall embrulhava um `<input type=file hidden>`, e
        `hidden` não é focável: restaurar um backup era função só-de-mouse;
     4. o diálogo troca de controle sob o pé do usuário — "Iniciar partida" some
        ao entrar no mapa, "Pular" vira "Continuar" ao terminar —, e esconder o
        elemento focado jogava o foco no <body>, fora do modal.

   POR QUE NOS TRÊS VIEWPORTS. O achado 1 e o 3 são iguais em qualquer largura,
   mas alvo de toque só existe no dedo, e `overflow-x` só aparece no estreito.
   Uma guarda só vê a superfície em que roda — a mesma lição que deixou 135
   cartas tortas por meses.

   COMO ELE PODE FALHAR. A seção de provas sintéticas quebra o produto de
   propósito, dentro da página, e exige que o auditor acuse cada defeito. Sem
   isso, um auditor sempre verde passaria por cobertura. Não remova essas provas. */
const http=require("http");
const path=require("path");
const {spawn}=require("child_process");
const {chromium}=require("playwright");
const {ROOT,okMark,chromiumLaunchOptions}=require("../lib/common");

const TELAS=[
  {nome:"desktop",width:1440,height:900,toque:false},
  {nome:"tablet", width:760, height:1000,toque:true},
  {nome:"celular",width:390, height:844,toque:true},
];

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

/* O auditor roda DENTRO da página. Ele é uma string porque precisa ser injetado
   tanto no fluxo real quanto nas provas sintéticas, sem duplicar a lógica: se as
   duas usassem auditores diferentes, provar que um reprova não diria nada sobre
   o outro. */
const AUDITOR=`((estado,tela,checarToque)=>{
  const achados=[];
  const desc=n=>{if(!n||!n.tagName)return String(n);
    let s=n.tagName.toLowerCase();
    if(n.id)s+="#"+n.id;else if(n.className&&typeof n.className==="string")s+="."+n.className.trim().split(/\\s+/).slice(0,2).join(".");
    const t=(n.textContent||"").trim().slice(0,24);return t?s+' "'+t+'"':s;};
  const add=(tipo,no,detalhe)=>achados.push({tela,estado,tipo,alvo:desc(no),detalhe});
  const visivel=n=>{if(!n.isConnected)return false;const r=n.getBoundingClientRect();
    if(r.width===0&&r.height===0)return false;const cs=getComputedStyle(n);
    return cs.display!=="none"&&cs.visibility!=="hidden";};
  /* Nome acessível aproximado. Não substitui a árvore real do navegador, mas
     cobre as formas que este produto usa: aria-label, labelledby, <label>, texto,
     alt de filho e title. */
  const nomeAcessivel=n=>{
    const al=n.getAttribute("aria-label");if(al&&al.trim())return al.trim();
    const lb=n.getAttribute("aria-labelledby");
    if(lb){const el=document.getElementById(lb);if(el&&(el.textContent||"").trim())return el.textContent.trim();}
    if(n.tagName==="INPUT"&&n.labels)for(const l of n.labels)if((l.textContent||"").trim())return l.textContent.trim();
    const txt=(n.innerText||n.textContent||"").trim();if(txt)return txt;
    const img=n.querySelector("img[alt]");if(img&&img.getAttribute("alt").trim())return img.getAttribute("alt").trim();
    const t=n.getAttribute("title");if(t&&t.trim())return t.trim();
    return "";};

  if(![...document.querySelectorAll("h1")].filter(visivel).length)
    add("sem-h1",document.body,"nenhum <h1> visível no documento");

  for(const n of document.querySelectorAll("button,a[href],input,select,textarea,[role=button],[role=link],[tabindex]")){
    if(!visivel(n)||n.getAttribute("aria-hidden")==="true"||n.type==="hidden")continue;
    if(!nomeAcessivel(n))add("sem-nome-acessivel",n,"controle visível sem nome acessível");
  }
  for(const n of document.querySelectorAll("img"))
    if(!n.hasAttribute("alt"))add("img-sem-alt",n,"img sem atributo alt");
  for(const n of document.querySelectorAll("input,select,textarea")){
    if(n.type==="hidden")continue;
    if(!nomeAcessivel(n))add("campo-sem-rotulo",n,"campo sem rótulo (type="+(n.type||n.tagName)+")");
  }
  const vistos={},dup=new Set();
  for(const n of document.querySelectorAll("[id]")){if(vistos[n.id])dup.add(n.id);else vistos[n.id]=1;}
  for(const id of dup)add("id-duplicado",document.getElementById(id),"id repetido: "+id);
  for(const n of document.querySelectorAll("[tabindex]")){
    const t=Number(n.getAttribute("tabindex"));if(t>0)add("tabindex-positivo",n,"tabindex="+t);}
  for(const n of document.querySelectorAll("[aria-hidden=true] button,[aria-hidden=true] a[href],[aria-hidden=true] input,[aria-hidden=true] [tabindex]:not([tabindex='-1'])"))
    add("focavel-em-aria-hidden",n,"focável dentro de aria-hidden=true");
  /* Rótulo visível cujo controle está hidden: clique de mouse funciona, Tab não
     alcança. Foi assim que "Importar" ficou inacessível pelo teclado. */
  for(const n of document.querySelectorAll("label")){
    if(!visivel(n))continue;
    const c=n.control||n.querySelector("input,select,textarea");if(!c)continue;
    if((c.hasAttribute("hidden")||getComputedStyle(c).display==="none")&&!n.hasAttribute("tabindex"))
      add("so-mouse",n,"label visível cujo controle não é alcançável por Tab");
  }
  for(const d of document.querySelectorAll("[role=dialog]")){
    if(d.hidden||!visivel(d))continue;
    if(!d.contains(document.activeElement))
      add("dialogo-sem-foco",d,"modal aberto com o foco fora dele (activeElement="+desc(document.activeElement)+")");
    if(!d.getAttribute("aria-label")&&!d.getAttribute("aria-labelledby"))
      add("dialogo-sem-nome",d,"diálogo sem aria-label nem aria-labelledby");
    if(!document.querySelector(".wrap").hasAttribute("inert"))
      add("fundo-nao-inerte",d,"aria-modal aberto com o .wrap ainda na ordem de foco");
  }
  const de=document.documentElement;
  if(de.scrollWidth>de.clientWidth+1)
    add("overflow-x",de,"scrollWidth "+de.scrollWidth+" > clientWidth "+de.clientWidth);
  // WCAG 2.2 AA pede 24x24 CSS px de alvo acionável; só faz sentido onde há dedo.
  if(checarToque){
    for(const n of document.querySelectorAll("button,a[href],[role=button],input:not([type=hidden])")){
      if(!visivel(n)||n.classList.contains("so-leitor"))continue;
      const r=n.getBoundingClientRect();
      if(r.width<24||r.height<24)add("alvo-de-toque",n,Math.round(r.width)+"x"+Math.round(r.height)+" < 24x24");
    }
  }
  return achados;
})`;

const auditar=(pg,estado,tela,toque)=>
  pg.evaluate(`${AUDITOR}(${JSON.stringify(estado)},${JSON.stringify(tela)},${toque})`);

/* ——— navegação do fluxo real (mesmo caminho do e2e-game-flow) ——— */
async function revealDraw(pg,sel){
  for(let i=0;i<14;i++){
    await pg.click("#rollbtn");
    await pg.waitForFunction(()=>document.getElementById("track").children.length>40,{timeout:5000});
    await pg.$eval("#track",t=>t.dispatchEvent(new window.TransitionEvent("transitionend",{bubbles:true,propertyName:"transform"})));
    await pg.waitForSelector("#picks [data-pick]",{state:"attached",timeout:5000});
    if(await pg.locator(sel).count())return;
    await pg.click("#respinbtn");
  }
  throw new Error("não foi possível sortear "+sel);
}
/* ESCALAR É ARRASTAR desde 06/08/2026 — clicar VIRA a carta. Sem `steps`: o
   Chromium coalesce `pointermove` e entregava só o primeiro, abaixo do limiar de
   8 px, o que fazia o gesto não pegar de forma intermitente. */
/* global PointerEvent */
/* Duas das três telas rodam com `isMobile`/`hasTouch`, e ali `page.mouse` não
   reproduz o gesto do dedo. O produto ouve PONTEIRO, que é agnóstico de
   dispositivo, então o arrasto é disparado como ponteiro de TOQUE — é o gesto
   real do celular, não uma simulação de mouse. A fidelidade de entrada com
   ponteiro de mouse continua provada em `e2e-cartas.js` e `e2e-game-flow.js`. */
async function arrastarCarta(pg,origem,destino){
  await pg.locator(origem).evaluate(el=>
    Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))));
  await pg.evaluate(async({o,d})=>{
    const a=document.querySelector(o);
    if(!a||!document.querySelector(d))throw new Error(`arrasto sem alvo: ${o} → ${d}`);
    const p=(tipo,x,y)=>a.dispatchEvent(new PointerEvent(tipo,{bubbles:true,cancelable:true,
      clientX:x,clientY:y,pointerId:1,pointerType:"touch",isPrimary:true,
      button:0,buttons:tipo==="pointerup"?0:1}));
    const quadro=()=>new Promise(r=>requestAnimationFrame(r));
    const caixaDestino=()=>document.querySelector(d).getBoundingClientRect();
    const ra=a.getBoundingClientRect();
    const x0=ra.left+ra.width/2,y0=ra.top+ra.height/2;
    p("pointerdown",x0,y0);
    p("pointermove",x0+30,y0+20);        // já além do limiar de 8px
    /* NO CELULAR OS DOIS NÃO CABEM NA MESMA TELA — medido, 1.022 px de vão numa
       janela de 844. Levar o ponteiro à borda e deixar a AUTO-ROLAGEM do produto
       trazer o destino é o gesto real do dedo, e de quebra é o que prova que ela
       existe: sem auto-rolagem este laço nunca converge. */
    for(let i=0;i<240;i++){
      const rb=caixaDestino();
      if(rb.top>=0&&rb.bottom<=window.innerHeight)break;
      p("pointermove",x0,rb.top<0?24:window.innerHeight-24);
      await quadro();
    }
    const rb=caixaDestino();
    const x1=rb.left+rb.width/2,y1=rb.top+rb.height/2;
    p("pointermove",x1,y1);
    await quadro();
    p("pointerup",x1,y1);
  },{o:origem,d:destino});
}
async function draftPlayer(pg,slot){
  await revealDraw(pg,"#picks .card[data-pick]:not(.taken):not(.dup)");
  const id=await pg.$$eval("#picks .card[data-pick]:not(.taken):not(.dup)",cards=>
    [...cards].sort((a,b)=>Number(b.querySelector(".ovr")?.textContent)-Number(a.querySelector(".ovr")?.textContent))[0]?.dataset.pick||null);
  await arrastarCarta(pg,`#picks [data-pick="${id}"]`,`#lineup [data-slot="${slot}"]`);
  await pg.waitForFunction(e=>document.getElementById("cnt").textContent===`${e}/6`,slot+1);
}
async function draftCoach(pg){
  await revealDraw(pg,"#picks .coachcard[data-pick]:not(.taken)");
  await arrastarCarta(pg,"#picks .coachcard[data-pick]:not(.taken)",'#lineupCoach [data-slot="coach"]');
  await pg.waitForFunction(()=>document.getElementById("cnt").textContent==="6/6");
}

async function percorrer(browser,tela,port,ruido){
  const pg=await browser.newPage({viewport:{width:tela.width,height:tela.height},
    reducedMotion:"reduce",isMobile:tela.toque,hasTouch:tela.toque});
  const tag=`[${tela.nome}] `;
  const achados=[];
  pg.on("pageerror",e=>ruido.erros.push(tag+String(e&&e.message||e)));
  pg.on("console",m=>{const t=m.type();
    if(t==="error"||t==="warning")ruido.console.push(tag+t+": "+m.text().slice(0,220));});
  pg.on("requestfailed",r=>ruido.rede.push(tag+"requestfailed "+r.url()+" "+((r.failure()||{}).errorText||"")));
  pg.on("response",r=>{if(r.status()>=400)ruido.rede.push(tag+"HTTP"+r.status()+" "+r.url());});
  const auditarEstado=async estado=>achados.push(...await auditar(pg,estado,tela.nome,tela.toque));

  await pg.goto(`http://127.0.0.1:${port}/index.html?e2e=1`,{waitUntil:"load",timeout:30000});
  await pg.waitForTimeout(400);
  await auditarEstado("inicial");

  for(let slot=0;slot<5;slot++)await draftPlayer(pg,slot);
  await draftCoach(pg);
  await auditarEstado("elenco-cheio");

  await pg.click("#suicabtn");
  await pg.waitForSelector("#suicaOverlay",{state:"visible",timeout:8000});
  await pg.waitForTimeout(300);
  await auditarEstado("suica");

  // Escape precisa fechar, devolver o foco à origem e liberar o fundo.
  await pg.keyboard.press("Escape");
  await pg.waitForTimeout(340);
  const teclado=await pg.evaluate(()=>({
    fechou:document.getElementById("suicaOverlay").hidden||document.getElementById("suicaOverlay").classList.contains("fechando"),
    foco:document.activeElement.id,
    fundoLiberado:!document.querySelector(".wrap").hasAttribute("inert")
  }));
  check(teclado.fechou,`${tela.nome} · Escape fecha o diálogo`);
  check(teclado.foco==="suicabtn",`${tela.nome} · foco volta ao controle de origem (${teclado.foco||"nenhum"})`);
  check(teclado.fundoLiberado,`${tela.nome} · fundo deixa de ser inerte ao fechar`);

  await pg.click("#suicabtn");
  await pg.waitForSelector("#suicaOverlay",{state:"visible",timeout:8000});
  let voltas=0,abriuPartida=false;
  while(voltas<10&&!abriuPartida){
    if(await pg.locator("#suicaPlayoffs").isVisible())break;
    await pg.click("#suicaAvancar");voltas++;
    await pg.waitForTimeout(600);
    if(await pg.locator("#prematchStart").isVisible())abriuPartida=true;
  }
  if(abriuPartida){
    await auditarEstado("antessala");
    await pg.click("#prematchStart");
    await pg.waitForSelector("#matchSkip",{state:"visible",timeout:15000});
    await auditarEstado("mapa-ao-vivo");        // "Iniciar partida" acabou de sumir
    await pg.click("#matchSkip");
    await pg.waitForSelector("#matchContinue",{state:"visible",timeout:10000});
    await auditarEstado("mapa-terminado");      // "Pular" acabou de virar "Continuar"
    await pg.click("#matchClose");
    await pg.waitForTimeout(300);
  }
  check(abriuPartida,`${tela.nome} · fluxo chega a uma partida do jogador`);

  for(const [ov,btn] of [["suicaOverlay","suicaFechar"],["playoffOverlay","playoffFechar"]]){
    if(await pg.$eval("#"+ov,o=>!o.hidden&&!o.classList.contains("fechando")))await pg.click("#"+btn);
    await pg.waitForTimeout(280);
  }
  await pg.click("#hallBtn");
  await pg.waitForSelector("#hallOverlay",{state:"visible",timeout:8000});
  await pg.waitForTimeout(250);
  await auditarEstado("hall");
  await pg.click("#hallFechar");
  await pg.waitForTimeout(300);
  await auditarEstado("tudo-fechado");

  /* O gate de 24x24 é o padrão do WCAG, mas passar POR 0,0 px não é passar: em
     04/08/2026 o botão de mudo media exatamente 24,0 no Windows e 22 no FreeType
     do CI, então o verde local era sorte. A folga tem de cobrir a diferença de
     plataforma MEDIDA, que ali foi de 2 px — por isso o piso de 2. */
  if(tela.toque){
    const menor=await pg.evaluate(()=>[...document.querySelectorAll("button,a[href],[role=button]")]
      .filter(n=>{const r=n.getBoundingClientRect();const cs=getComputedStyle(n);
        return (r.width||r.height)&&cs.display!=="none"&&!n.hasAttribute("hidden")&&!n.classList.contains("so-leitor");})
      .map(n=>{const r=n.getBoundingClientRect();
        return {el:n.tagName.toLowerCase()+(n.id?"#"+n.id:""),lado:Math.min(r.width,r.height)};})
      .sort((x,y)=>x.lado-y.lado)[0]||null);
    const folga=menor?menor.lado-24:0;
    check(menor&&folga>=2,
      `${tela.nome} · menor alvo de toque com folga sobre 24px: ${menor?menor.el:"—"} `+
      `${menor?menor.lado.toFixed(1):"?"}px (folga ${folga.toFixed(1)}px, mínimo 2)`);
  }

  await pg.close();
  return achados;
}

/* ——— provas sintéticas: o auditor precisa saber REPROVAR ——— */
async function provasSinteticas(browser,port){
  const pg=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:"reduce"});
  await pg.goto(`http://127.0.0.1:${port}/index.html?e2e=1`,{waitUntil:"load",timeout:30000});
  const acusa=async(rotulo,tipo,quebrar)=>{
    await pg.evaluate(quebrar);
    const achados=await auditar(pg,"sintetico","desktop",true);
    const pegou=achados.some(a=>a.tipo===tipo);
    check(pegou,`prova sintética · auditor acusa ${rotulo}`);
    await pg.reload({waitUntil:"load"});   // desfaz o dano antes da próxima prova
  };

  await acusa("documento sem h1","sem-h1",
    ()=>{document.querySelector("h1.logo").remove();});
  await acusa("controle sem nome acessível","sem-nome-acessivel",
    ()=>{const b=document.getElementById("mutebtn");b.removeAttribute("aria-label");b.removeAttribute("title");b.textContent="";});
  await acusa("img sem alt","img-sem-alt",
    ()=>{const i=document.createElement("img");i.src="og-image.png";document.querySelector(".wrap").appendChild(i);});
  await acusa("id duplicado","id-duplicado",
    ()=>{const d=document.createElement("div");d.id="hint";document.querySelector(".wrap").appendChild(d);});
  await acusa("tabindex positivo","tabindex-positivo",
    ()=>{document.getElementById("rollbtn").setAttribute("tabindex","3");});
  await acusa("focável dentro de aria-hidden","focavel-em-aria-hidden",
    ()=>{const w=document.createElement("div");w.setAttribute("aria-hidden","true");
      w.innerHTML='<button>invisível ao leitor</button>';document.querySelector(".wrap").appendChild(w);});
  await acusa("rótulo só-de-mouse","so-mouse",
    ()=>{const l=document.createElement("label");l.textContent="Falso";
      l.innerHTML+='<input type="file" hidden>';document.querySelector(".wrap").appendChild(l);});
  await acusa("alvo de toque menor que 24x24","alvo-de-toque",
    ()=>{const b=document.createElement("button");b.textContent="x";
      b.style.cssText="width:12px;height:12px;padding:0;font-size:6px";document.querySelector(".wrap").appendChild(b);});
  await acusa("overflow horizontal","overflow-x",
    ()=>{const d=document.createElement("div");d.style.cssText="width:4000px;height:4px";
      document.body.appendChild(d);document.body.style.overflowX="visible";});
  // Os três do diálogo dependem de um modal ABERTO.
  await pg.evaluate(()=>{const d=document.getElementById("hallOverlay");d.hidden=false;
    document.querySelector(".wrap").setAttribute("inert","");d.focus();});
  await acusa("diálogo sem nome acessível","dialogo-sem-nome",
    ()=>{document.getElementById("hallOverlay").removeAttribute("aria-labelledby");});
  /* Este defeito NÃO pode ser injetado nos overlays reais: o `focusout` de
     `game.js` devolve o foco ao diálogo antes de o auditor olhar — a guarda do
     produto desfaz o dano, que é exatamente o que ela existe para fazer. Um
     diálogo sintético, fora da lista que aquele listener vigia, prova a lógica
     do auditor sem lutar contra a correção. */
  await acusa("modal aberto com foco fora dele","dialogo-sem-foco",
    ()=>{const d=document.createElement("div");
      d.setAttribute("role","dialog");d.setAttribute("aria-label","sintético");
      d.style.cssText="position:fixed;inset:20% 20%;background:#111";
      document.body.appendChild(d);
      document.querySelector(".wrap").setAttribute("inert","");
      document.getElementById("hallFechar").blur();document.body.focus();});
  await pg.evaluate(()=>{const d=document.getElementById("hallOverlay");d.hidden=false;
    document.querySelector(".wrap").setAttribute("inert","");d.focus();});
  await acusa("aria-modal com fundo ainda focável","fundo-nao-inerte",
    ()=>{document.querySelector(".wrap").removeAttribute("inert");});

  // e o auditor precisa VOLTAR ao verde depois de todo o dano ser desfeito
  const limpo=await auditar(pg,"pos-provas","desktop",true);
  check(limpo.length===0,`auditoria volta ao verde depois das provas sintéticas${limpo.length?": "+limpo[0].tipo:""}`);
  await pg.close();
}

(async()=>{
  console.log("— E2E: ACESSIBILIDADE, CONSOLE E REDE (3 viewports) —");
  const port=7000+Math.floor(Math.random()*300);   // 6000 é ERR_UNSAFE_PORT no Chromium
  const server=spawn(process.execPath,[path.join(ROOT,"tools","serve-static.js")],
    {env:{...process.env,PORT:String(port)},stdio:"ignore"});
  let browser=null;
  const done=async code=>{try{if(browser)await browser.close();}catch{}try{server.kill();}catch{}process.exitCode=code;};

  try{
    await waitServer(port);
    browser=await chromium.launch(chromiumLaunchOptions());
    const ruido={erros:[],console:[],rede:[]};
    const achados=[];
    for(const tela of TELAS)achados.push(...await percorrer(browser,tela,port,ruido));

    for(const a of achados)console.log(`    ✗ [${a.tela}/${a.estado}] ${a.tipo} — ${a.alvo}: ${a.detalhe}`);
    check(achados.length===0,`nenhuma barreira de acessibilidade em 3 viewports × 8 estados (${achados.length} achado(s))`);
    for(const e of ruido.erros)console.log("    ✗ "+e);
    for(const c of ruido.console)console.log("    ✗ "+c);
    for(const r of ruido.rede)console.log("    ✗ "+r);
    check(ruido.erros.length===0,"nenhuma exceção não capturada no fluxo completo");
    check(ruido.console.length===0,"nenhum error/warning de console no fluxo completo");
    check(ruido.rede.length===0,"nenhuma requisição falha ou 4xx/5xx no fluxo completo");

    await provasSinteticas(browser,port);

    console.log(failures?`✗ ${failures} checagem(ns) de acessibilidade falharam`
      :"✓ jogo acessível por teclado e leitor de tela em desktop, tablet e celular");
    return done(failures?1:0);
  }catch(error){
    console.log("  ✗ suíte abortou: "+(error.message||error));
    console.log("✗ e2e de acessibilidade falhou");
    return done(1);
  }
})();
