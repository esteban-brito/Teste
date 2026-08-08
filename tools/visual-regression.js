/* COMPARADOR VISUAL — prova que uma mudança de CSS/UI não alterou a aparência.
   ══════════════════════════════════════════════════════════════════════════════

   POR QUE EXISTE. O E2E prova que os elementos existem e que o fluxo funciona;
   nenhuma suíte percebia se algo tinha ficado feio ou quebrado na tela. Em
   29/07/2026, durante a fusão das três camadas de cascata do `style.css`, esta
   ferramenta pegou três mudanças visuais silenciosas que a leitura do código não
   pegou: o brilho das células de round reativado por um `!important` removido, o
   brilho interno da carta de treinador ressuscitado por um `box-shadow` de mesma
   especificidade, e a borda inferior dos overlays trocando de cor ao ser fundida.

   COMO USAR. Duas execuções e uma comparação:

     node tools/visual-regression.js capturar visual-antes
     …aplique a mudança…
     node tools/visual-regression.js capturar visual-depois
     node tools/visual-regression.js comparar visual-antes visual-depois

   `comparar` sai com código 1 se houver qualquer diferença, e informa a caixa
   envolvente e a primeira cor divergente de cada captura — o suficiente para
   recortar a região e olhar.

   NÃO EXISTEM IMAGENS DE REFERÊNCIA VERSIONADAS. Guardar PNGs no Git envelhece
   mal: toda mudança de design deliberada viraria um commit de binários. A prova
   é sempre entre duas execuções da mesma máquina, na mesma sessão de trabalho.
   As pastas de saída são ignoradas pelo Git.

   DETERMINISMO. Sem os três cuidados abaixo, duas capturas do MESMO código já
   diferem, e a ferramenta não vale nada:

     1. a roleta do draft usa `Math.random`, não o RNG semeado do simulador —
        então ele é substituído por um gerador previsível antes dos scripts da
        página;
     2. o Major consome o Mulberry32 da sessão — `srand` é fixado pela ponte
        `?e2e=1` antes de entrar na fase suíça;
     3. animações contínuas (holográfico, refletores) e de entrada (entrega da
        carta) são congeladas no MESMO quadro. O atraso é -10s, não zero: as de
        entrada duram menos de 1,2s e têm `fill-mode`, então -10s as deixa no
        quadro FINAL — que é o que a pessoa vê depois de assentar. Com um atraso
        perto de zero elas voltariam ao primeiro quadro e as cartas apareceriam
        desbotadas e tortas.

   Se uma captura ficar instável, compare duas execuções seguidas SEM mudar nada:
   é o teste da própria ferramenta, e ele deve dar diferença zero. */
const {spawn}=require("child_process");
const fs=require("fs");
const path=require("path");
const arrasto=require("../bancada/lib/arrasto");
const {entrarNoMajor}=require("../bancada/lib/major");

const RAIZ=path.resolve(__dirname,"..");
const PORTA=Number(process.env.VISUAL_PORT||5197);

const TELAS=[
  {nome:"desktop",width:1280,height:900},
  {nome:"tablet", width:760, height:1000},
  {nome:"celular",width:390, height:844},
];

const CONGELAR=`*,*::before,*::after{
  animation-play-state:paused!important;
  animation-delay:-10s!important;
  transition:none!important;
  caret-color:transparent!important}`;

const SEMENTE_DOM=`(()=>{let s=20260729%2147483647;
  Math.random=()=>{s=(s*16807)%2147483647;return (s-1)/2147483646;};})()`;
const SEMENTE_SIM=20260729;

function carregarPlaywright(){
  try{
    return require("playwright");
  }catch{
    console.error("visual-regression: Playwright não está instalado. Rode `npm ci`.");
    process.exit(1);
  }
}

/* Gira a roleta até o time sorteado conter o tipo de carta procurado. O draft é
   determinístico, então a quantidade de giros também é. */
async function revelar(page,seletor){
  for(let tentativa=0;tentativa<40;tentativa++){
    if(await page.$(seletor))return;
    if(await page.$("#respinbtn:not([hidden])"))await page.click("#respinbtn");
    await page.click("#rollbtn");
    await page.waitForSelector("#picks [data-pick]",{state:"attached",timeout:8000});
    await page.waitForTimeout(900);
  }
  throw new Error(`visual-regression: a roleta nunca revelou ${seletor}`);
}

/* O GESTO VIVE EM `bancada/lib/arrasto.js` — 06/08/2026. Estava copiado aqui e
   em duas suítes; a correção da corrida de rAF (regra 41) teve de ser escrita
   duas vezes, e esta cópia era a que travava a captura no `04-elenco`. */
const arrastarCarta=(page,origem,destino)=>arrasto.porAutoRolagem(page,origem,destino);

async function capturar(page,destino,nome){
  const congelador=await page.addStyleTag({content:CONGELAR});
  await page.waitForTimeout(120);
  await page.screenshot({path:path.join(destino,nome+".png"),fullPage:true});
  await congelador.evaluate(el=>el.remove());
}

async function percorrer(page,tela,destino){
  const nomear=etapa=>`${tela.nome}-${etapa}`;

  await capturar(page,destino,nomear("01-inicial"));

  await page.click("#rollbtn");
  await page.waitForSelector(".picks .card",{timeout:15000});
  await page.waitForTimeout(1400);
  await capturar(page,destino,nomear("02-cartas"));

  /* Clicar VIRA desde 06/08/2026 — não existe mais modo. Virar todas e voltar
     todas mantém o estado `03-versos` comparável entre execuções. */
  for(const carta of await page.$$(".picks .card,.picks .coachcard"))await carta.click();
  await page.waitForTimeout(700);
  await capturar(page,destino,nomear("03-versos"));
  for(const carta of await page.$$(".picks .card,.picks .coachcard"))await carta.click();
  await page.waitForTimeout(400);

  for(let slot=0;slot<5;slot++){
    await revelar(page,"#picks .card[data-pick]:not(.taken):not(.dup)");
    const id=await page.$$eval("#picks .card[data-pick]:not(.taken):not(.dup)",
      cards=>cards[0].getAttribute("data-pick"));
    await arrastarCarta(page,`#picks [data-pick="${id}"]`,`#lineup [data-slot="${slot}"]`);
    await page.waitForFunction(n=>document.getElementById("cnt").textContent===`${n}/6`,slot+1);
  }
  await revelar(page,"#picks .coachcard[data-pick]:not(.taken)");
  await arrastarCarta(page,"#picks .coachcard[data-pick]:not(.taken)",'#lineupCoach [data-slot="coach"]');
  await page.waitForFunction(()=>document.getElementById("cnt").textContent==="6/6");
  await page.waitForTimeout(600);
  await capturar(page,destino,nomear("04-elenco"));

  await page.evaluate(semente=>window.__DRAFT9_E2E__.srand(semente),SEMENTE_SIM);
  await entrarNoMajor(page);
  await page.waitForTimeout(400);
  await capturar(page,destino,nomear("05-suica"));

  await page.click("#suicaAvancar");
  await page.waitForSelector("#matchOverlay",{state:"visible",timeout:20000});
  await page.waitForSelector("#prematchStart",{state:"visible"});
  await page.waitForTimeout(400);
  await capturar(page,destino,nomear("06-antessala"));

  await page.click("#prematchStart");
  await page.waitForSelector("#matchSkip",{state:"visible",timeout:20000});
  await page.click("#matchSkip");
  await page.waitForSelector("#matchContinue",{state:"visible",timeout:20000});
  await page.waitForTimeout(500);
  await capturar(page,destino,nomear("07-mapa"));
}

async function comandoCapturar(destino){
  const {chromium}=carregarPlaywright();
  fs.mkdirSync(destino,{recursive:true});
  const servidor=spawn(process.execPath,["tools/serve-static.js"],
    {cwd:RAIZ,env:{...process.env,PORT:String(PORTA)},stdio:"ignore"});
  await new Promise(resolve=>setTimeout(resolve,600));
  const browser=await chromium.launch();
  try{
    for(const tela of TELAS){
      const contexto=await browser.newContext({viewport:{width:tela.width,height:tela.height},deviceScaleFactor:1});
      const page=await contexto.newPage();
      await page.addInitScript(SEMENTE_DOM);
      await page.goto(`http://127.0.0.1:${PORTA}/index.html?e2e=1`,{waitUntil:"networkidle"});
      await page.evaluate(()=>document.fonts.ready);
      await percorrer(page,tela,destino);
      await contexto.close();
    }
  }finally{
    await browser.close();
    servidor.kill();
  }
  const total=fs.readdirSync(destino).filter(nome=>nome.endsWith(".png")).length;
  console.log(`visual-regression: ${total} capturas em ${destino}`);
}

async function comandoComparar(pastaA,pastaB){
  const {chromium}=carregarPlaywright();
  const uri=arquivo=>"data:image/png;base64,"+fs.readFileSync(arquivo).toString("base64");
  const browser=await chromium.launch();
  const page=await browser.newPage();
  let divergentes=0,comparadas=0;
  try{
    for(const nome of fs.readdirSync(pastaA).filter(item=>item.endsWith(".png"))){
      const gemeo=path.join(pastaB,nome);
      if(!fs.existsSync(gemeo)){console.log(`  AUSENTE   ${nome}`);divergentes++;continue;}
      comparadas++;
      const r=await page.evaluate(async ([a,b])=>{
        const carregar=src=>new Promise(resolve=>{const img=new window.Image();img.onload=()=>resolve(img);img.src=src;});
        const [ia,ib]=await Promise.all([carregar(a),carregar(b)]);
        if(ia.width!==ib.width||ia.height!==ib.height)
          return {dimensao:`${ia.width}x${ia.height} vs ${ib.width}x${ib.height}`};
        const canvas=document.createElement("canvas");
        canvas.width=ia.width;canvas.height=ia.height;
        const ctx=canvas.getContext("2d",{willReadFrequently:true});
        ctx.drawImage(ia,0,0);const da=ctx.getImageData(0,0,canvas.width,canvas.height).data;
        ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(ib,0,0);
        const db=ctx.getImageData(0,0,canvas.width,canvas.height).data;
        let x0=Infinity,y0=Infinity,x1=-1,y1=-1,pixels=0,primeiro=null;
        for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
          const i=(y*canvas.width+x)*4;
          if(da[i]!==db[i]||da[i+1]!==db[i+1]||da[i+2]!==db[i+2]){
            pixels++;
            if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
            if(!primeiro)primeiro={x,y,antes:[da[i],da[i+1],da[i+2]],depois:[db[i],db[i+1],db[i+2]]};
          }
        }
        return pixels?{pixels,caixa:`x ${x0}-${x1} · y ${y0}-${y1}`,primeiro,total:canvas.width*canvas.height}:{pixels:0};
      },[uri(path.join(pastaA,nome)),uri(gemeo)]);
      if(r.dimensao){console.log(`  TAMANHO   ${nome}: ${r.dimensao}`);divergentes++;continue;}
      if(!r.pixels)continue;
      divergentes++;
      console.log(`  MUDOU     ${nome}: ${r.pixels} px (${(r.pixels/r.total*100).toFixed(3)}%) · ${r.caixa}`);
      console.log(`            1º px (${r.primeiro.x},${r.primeiro.y}) rgb ${r.primeiro.antes} → ${r.primeiro.depois}`);
    }
  }finally{
    await browser.close();
  }
  if(divergentes){
    console.log(`visual-regression: ${divergentes} de ${comparadas} capturas mudaram`);
    process.exitCode=1;
    return;
  }
  console.log(`visual-regression: ${comparadas}/${comparadas} idênticas`);
}

const [comando,...args]=process.argv.slice(2);
if(comando==="capturar"&&args[0])comandoCapturar(args[0]);
else if(comando==="comparar"&&args[0]&&args[1])comandoComparar(args[0],args[1]);
else{
  console.error("uso: node tools/visual-regression.js capturar <pasta>");
  console.error("     node tools/visual-regression.js comparar <pastaA> <pastaB>");
  process.exit(1);
}
