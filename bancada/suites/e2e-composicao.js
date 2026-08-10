/* bancada/suites/e2e-composicao.js — a antessala medida como COMPOSIÇÃO.
   ══════════════════════════════════════════════════════════════════════════════

   POR QUE EXISTE, e por que ela não é a `e2e-antessala`. Aquela mede MATERIAL:
   a foto chega, os mapas se distinguem, o texto tem contraste, as peças usam o
   mesmo sistema de vidro. Nada disso olha para onde as coisas ESTÃO. Num refino
   conduzido ao vivo em 09/08/2026, o responsável apontou três defeitos que a
   suíte de material atravessou verde:

     1. **letra cortada.** `.pm-name` tinha `line-height:1.02` junto do
        `overflow:hidden` que o `ellipsis` exige, e a caixa de linha ficava menor
        que a fonte: `scrollHeight` 29 contra `clientHeight` 25. O "p" de Spirit e
        o "y" de Vitality saíam decepados. Em "Time Teste" não aparecia nada — o
        defeito dependia do NOME sorteado (regra 46);
     2. **assimetria de 3,8px** entre o centro do brasão e o centro do bloco de
        texto, no celular, nos DOIS lados e em direções opostas — o que dobra o
        efeito na leitura;
     3. **número escorregando para o meio do card**, porque `.pm-info` é grid e
        ali quem alinha na horizontal é `justify-items`; `align-items` alinha no
        eixo de bloco e nunca fez nada.

   O QUE ELA MEDE, e por que cada régua é essa:

     · CORTE — `scrollWidth/scrollHeight` contra `client*` em quem esconde
       overflow. É o único sinal que denuncia texto decepado: o nó existe, tem
       conteúdo e é `visible`, então toda prova funcional passa (regra 48);
     · CENTRO DA TINTA — a caixa do TEXTO por `Range`, não a do bloco. Centrar
       caixa não é centrar tinta: o `letter-spacing` sobra depois da última letra
       e o flex centra o avanço, que carrega esse espaço fantasma (regra 35);
     · SIMETRIA DOS DOIS LADOS — folga do brasão à borda em cada metade, e o
       centro do brasão contra o centro do texto dentro de cada lado.

   FALSOS POSITIVOS DECLARADOS, que a guarda precisa ignorar de propósito:
   `.pm-fundo` transborda porque as PONTAS da diagonal são desenhadas fora da
   tela; e no celular as duas metades EMPILHAM, então comparar o eixo vertical
   de uma contra a outra não faz sentido. Ignorá-los é decisão, não conveniência
   — sem isso a guarda acusaria 13 defeitos que são o desenho.

   COMO ELA PODE FALHAR: a seção sintética injeta desvio de centro e corte
   vertical, e exige que o auditor acuse os dois. Guarda que nunca acusou nada
   não é cobertura. */
const http=require("http");
const path=require("path");
const {spawn}=require("child_process");
const {chromium}=require("playwright");
const {ROOT,okMark,chromiumLaunchOptions}=require("../lib/common");
const {entrarNoMajor}=require("../lib/major");

const TELAS=[
  {nome:"desktop",width:1440,height:900},
  {nome:"tablet", width:760, height:1024},
  {nome:"celular",width:390, height:844},
];
const DESVIO_MAX=1.5;   // px — abaixo disso é arredondamento de subpixel

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

const AUDITAR=desvioMax=>{
  const achados=[];
  const vis=el=>{const cs=getComputedStyle(el);
    return cs.display!=="none"&&cs.visibility!=="hidden"&&el.getBoundingClientRect().width>1;};
  /* As pontas da diagonal do fundo saem da tela de propósito. */
  const IGNORAR=/pm-fundo/;

  for(const el of document.querySelectorAll("#prematch *")){
    if(!vis(el)||IGNORAR.test(el.className||""))continue;
    const cs=getComputedStyle(el);
    const nome=el.className||el.id||el.tagName;
    if(/hidden|clip/.test(cs.overflowX)&&el.scrollWidth-el.clientWidth>1)
      achados.push({tipo:"corte-x",alvo:nome,
        det:`scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}`,
        txt:(el.textContent||"").trim().slice(0,22)});
    if(/hidden|clip/.test(cs.overflowY)&&el.scrollHeight-el.clientHeight>1)
      achados.push({tipo:"corte-y",alvo:nome,
        det:`scrollHeight ${el.scrollHeight} > clientHeight ${el.clientHeight}`
          +" — line-height menor que a fonte decepa descendentes",
        txt:(el.textContent||"").trim().slice(0,22)});
  }

  const centrados=[".pm-forca-leg",".pm-chip-r",".pm-chip-v",".prematch-modos .roll",
    ".pm-acao-sub",".pm-chip"];
  for(const sel of centrados)for(const el of document.querySelectorAll(sel)){
    if(!vis(el))continue;
    const cs=getComputedStyle(el);
    if(cs.textAlign!=="center"&&!/center/.test(cs.justifyContent||""))continue;
    const r=document.createRange();r.selectNodeContents(el);
    const t=r.getBoundingClientRect(),c=el.getBoundingClientRect();
    if(t.width<2)continue;
    const esq=t.left-(c.left+(parseFloat(cs.paddingLeft)||0));
    const dir=(c.right-(parseFloat(cs.paddingRight)||0))-t.right;
    if(Math.abs(esq-dir)>desvioMax)
      achados.push({tipo:"fora-de-centro",alvo:sel,
        det:`esquerda ${esq.toFixed(1)}px · direita ${dir.toFixed(1)}px`,
        txt:(el.textContent||"").trim().slice(0,22)});
  }

  const a=document.querySelector(".pm-lado--a"),b=document.querySelector(".pm-lado--b");
  if(a&&b){
    const ca=a.getBoundingClientRect(),cb=b.getBoundingClientRect();
    const ia=a.querySelector(".pm-crest").getBoundingClientRect();
    const ib=b.querySelector(".pm-crest").getBoundingClientRect();
    const folgaA=ia.left-ca.left,folgaB=cb.right-ib.right;
    if(Math.abs(folgaA-folgaB)>desvioMax)
      achados.push({tipo:"lados-assimetricos",alvo:".pm-lado",
        det:`brasão A a ${folgaA.toFixed(1)}px da borda · B a ${folgaB.toFixed(1)}px`,txt:""});
    const na=a.querySelector(".pm-name").getBoundingClientRect();
    const nb=b.querySelector(".pm-name").getBoundingClientRect();
    /* No celular as metades empilham; comparar o topo de uma com o da outra
       mediria a separação, que é o desenho. */
    if(window.innerWidth>640&&Math.abs(na.top-nb.top)>desvioMax)
      achados.push({tipo:"nomes-desalinhados",alvo:".pm-name",
        det:`topo A ${na.top.toFixed(1)} · topo B ${nb.top.toFixed(1)}`,txt:""});
  }

  for(const [nome,sel] of [["A",".pm-lado--a"],["B",".pm-lado--b"]]){
    const lado=document.querySelector(sel);if(!lado)continue;
    const cr=lado.querySelector(".pm-crest"),inf=lado.querySelector(".pm-info");
    if(!cr||!inf)continue;
    const rc=cr.getBoundingClientRect(),ri=inf.getBoundingClientRect();
    const dc=(rc.top+rc.bottom)/2,di=(ri.top+ri.bottom)/2;
    if(Math.abs(dc-di)>desvioMax)
      achados.push({tipo:"brasao-vs-texto",alvo:sel,
        det:`centro do brasão ${dc.toFixed(1)} · do texto ${di.toFixed(1)}`,txt:nome});
    /* A área de CONTEÚDO, não a caixa: as metades ocupam a mesma célula do grid
       e se separam por `padding` (`--pm-banda`). */
    const caixa=lado.getBoundingClientRect(),cl=getComputedStyle(lado);
    const topo=caixa.top+(parseFloat(cl.paddingTop)||0);
    const base=caixa.bottom-(parseFloat(cl.paddingBottom)||0);
    if(Math.abs((rc.top-topo)-(base-rc.bottom))>desvioMax)
      achados.push({tipo:"bloco-fora-do-centro",alvo:sel,
        det:`acima ${(rc.top-topo).toFixed(1)}px · abaixo ${(base-rc.bottom).toFixed(1)}px`,txt:nome});
  }
  return achados;
};

async function abrirAntessala(page,port){
  await page.goto(`http://127.0.0.1:${port}/index.html?e2e=1`,{waitUntil:"networkidle"});
  await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(()=>window.__DRAFT9_E2E__.srand(20260809));
  await page.click("#randombtn");
  await page.waitForFunction(()=>document.getElementById("cnt").textContent==="6/6",null,{timeout:25000});
  await entrarNoMajor(page);
  await page.click("#suicaAvancar");
  await page.waitForSelector("#prematchStart",{state:"visible",timeout:20000});
  /* Regra 47: `waitForSelector` dá "visível" com `opacity:0`. */
  await page.waitForFunction(()=>getComputedStyle(document.getElementById("prematch")).opacity==="1",
    null,{timeout:8000}).catch(()=>{});
  await page.waitForTimeout(1400);
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
    for(const tela of TELAS){
      const ctx=await browser.newContext({viewport:{width:tela.width,height:tela.height},deviceScaleFactor:1});
      const page=await ctx.newPage();
      await abrirAntessala(page,port);

      /* PROVAS SINTÉTICAS antes da medição real: injeta os dois defeitos que
         esta suíte nasceu para pegar e exige que o auditor acuse. */
      /* `text-indent`, e não `padding`: o auditor DESCONTA o padding da conta de
         propósito — recuo declarado é desenho, não desvio. O que ele precisa
         pegar é a tinta fora do centro DENTRO da área de conteúdo, que é o que
         o tracking sobrando produz de verdade (regra 35). */
      const quebra=await page.addStyleTag({content:
        ".pm-forca-leg{text-indent:26px}.pm-name{line-height:.6;overflow:hidden}"});
      await page.waitForTimeout(140);
      const sintetico=await page.evaluate(AUDITAR,DESVIO_MAX);
      check(sintetico.some(a=>a.tipo==="fora-de-centro"),
        `${tela.nome} · prova sintética — auditor acusa texto fora do centro`);
      check(sintetico.some(a=>a.tipo==="corte-y"),
        `${tela.nome} · prova sintética — auditor acusa letra cortada na vertical`);
      await quebra.evaluate(e=>e.remove());
      await page.waitForTimeout(140);

      const achados=await page.evaluate(AUDITAR,DESVIO_MAX);
      for(const a of achados)
        console.log(`    ✗ [${tela.nome}] ${a.tipo} — ${a.alvo}: ${a.det}${a.txt?"  «"+a.txt+"»":""}`);
      check(achados.length===0,`${tela.nome} · composição íntegra (${achados.length} achado(s))`);
      await ctx.close();
    }
    console.log(failures?`✗ ${failures} checagem(ns) de composição falharam`
      :"✓ antessala: nada cortado, texto centrado e os dois lados simétricos");
    return done(failures?1:0);
  }catch(error){
    console.log("  ✗ suíte abortou: "+(error.message||error));
    console.log("✗ e2e de composição falhou");
    return done(1);
  }
})();
