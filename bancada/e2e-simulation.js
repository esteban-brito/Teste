/* bancada/e2e-simulation.js — contrato de navegador da aba Simular.
   Protege placar, confronto bilateral, amostra da liga, métricas profissionais,
   seed automática, rolagem e responsividade. Não altera nem recalibra o motor. */
const http=require("http");
const path=require("path");
const {spawn}=require("child_process");
const {chromium}=require("playwright");
const {okMark}=require("./common");

function waitServer(port,tries=50){
  return new Promise((resolve,reject)=>{
    const tick=n=>{
      const req=http.get({host:"127.0.0.1",port,path:"/sandbox.html"},res=>{res.resume();resolve();});
      req.on("error",()=>{if(n<=0)reject(new Error("servidor não subiu"));else setTimeout(()=>tick(n-1),150);});
    };
    tick(tries);
  });
}

let failures=0;
function check(ok,label){console.log(`  ${okMark(!!ok)} ${label}`);if(!ok)failures++;}

(async()=>{
  console.log("— E2E: ABA SIMULAR (mapa + lote) —");
  const port=5500+Math.floor(Math.random()*400);
  const server=spawn(process.execPath,[path.join(__dirname,"..","tools","serve-static.js")],
    {env:{...process.env,PORT:String(port)},stdio:"ignore"});
  let browser=null;
  const done=async code=>{try{if(browser)await browser.close();}catch{}try{server.kill();}catch{}process.exitCode=code;};

  try{
    await waitServer(port);
    browser=await chromium.launch({headless:true});
    const page=await browser.newPage({viewport:{width:1440,height:700}});
    const errors=[];
    page.on("pageerror",error=>errors.push(String(error.message||error)));
    page.on("console",message=>{
      if(message.type()==="error"&&!/Failed to load resource|ERR_CONNECTION|ERR_NAME_NOT_RESOLVED|net::/.test(message.text())){
        errors.push("console:"+message.text());
      }
    });

    await page.goto(`http://127.0.0.1:${port}/sandbox.html?e2e=1`,{waitUntil:"load",timeout:20000});
    await page.waitForFunction(()=>window.__e2e&&window.__e2e.ready,{timeout:20000});
    await page.click('#modebar button[data-mode="simular"]');
    await page.waitForSelector("#runMapBtn",{timeout:8000});

    await page.selectOption("#simA","0");
    await page.selectOption("#simB","1");
    await page.selectOption("#simMap","Mirage");
    await page.click("#runMapBtn");
    await page.waitForSelector("#matchout .scoreboards table",{timeout:10000});

    const map=await page.evaluate(()=>{
      const tables=[...document.querySelectorAll("#matchout .scoreboards table")];
      const headers=tables.map(table=>[...table.querySelectorAll("thead th")].map(cell=>cell.textContent.trim()));
      const rows=tables.map(table=>[...table.querySelectorAll("tbody tr")].map(row=>[...row.cells].map(cell=>cell.textContent.trim())));
      return {headers,rows,text:document.getElementById("matchout").textContent};
    });
    const expectedPlayerColumns=["K","D","A","KAST","ADR","Rating"];
    const allMapRows=map.rows.flat();
    const validMapValues=allMapRows.every(row=>row.length===7&&/^\d+%$/.test(row[4])&&Number.isFinite(Number(row[5]))&&Number.isFinite(Number(row[6])));
    check(map.headers.length===2&&map.rows.every(rows=>rows.length===5),"placar contém 2 times e 5 jogadores por time");
    check(map.headers.every(headers=>JSON.stringify(headers.slice(1))===JSON.stringify(expectedPlayerColumns)),"colunas K/D/A/KAST/ADR/Rating estão padronizadas");
    check(validMapValues,"KAST, ADR e Rating estão preenchidos com valores válidos");
    check(!/NaN|undefined|Infinity/.test(map.text),"placar do mapa não contém valores inválidos");
    const mapSeed=await page.evaluate(()=>window.__e2e.simulation().seed);
    const hasSeedControl=await page.locator("#simSeed").count();
    check(Number.isInteger(mapSeed)&&mapSeed>0&&!hasSeedControl,"mapa usa seed automática sem expor controle manual");

    await page.fill("#simRuns","3");
    await page.click("#runBatchBtn");
    await page.waitForSelector("#matchout .fidelity-score",{timeout:15000});
    const firstBatch=await page.evaluate(()=>{
      const out=document.getElementById("matchout");
      const table=out.querySelector(".scoreboards table");
      return {
        text:out.textContent,
        core:[...out.querySelectorAll(".sim-core-item")].map(node=>node.textContent.replace(/\s+/g," ").trim()),
        sides:[...out.querySelectorAll(".sim-side")].map(node=>({name:node.querySelector(".sim-side-name")?.textContent.trim(),pct:Number(node.querySelector(".sim-side-pct")?.textContent.replace("%",""))})),
        headers:table?[...table.querySelectorAll("thead th")].map(cell=>cell.textContent.trim()):[],
        rows:table?[...table.querySelectorAll("tbody tr")].map(row=>[...row.cells].map(cell=>cell.textContent.trim())):[],
        bands:[...out.querySelectorAll('[title^="real "]')].map(node=>({title:node.title,style:node.getAttribute("style")||""})),
        groups:out.querySelectorAll(".fidelity-group").length,
        breakdowns:out.querySelectorAll(".sim-breakdowns .sim-data-panel").length,
        deltaRows:out.querySelectorAll(".player-delta tbody tr").length,
        details:[...out.querySelectorAll("details.sim-details")].map(node=>node.open),
        samplePlayers:window.__e2e.simulation().players
      };
    });
    const coreText=firstBatch.core.join(" ");
    const expectedRoleColumns=["Função","KPR","DPR","A/K","KAST","ADR"];
    check(["KPR","KAST","ADR","CT win","Plant"].every(label=>coreText.includes(label)),"resumo mantém somente os cinco indicadores centrais");
    check(firstBatch.sides.length===2&&firstBatch.sides.every(side=>side.name&&Number.isFinite(side.pct))&&firstBatch.sides.reduce((sum,side)=>sum+side.pct,0)===100,"confronto identifica os dois times e porcentagens complementares");
    check(JSON.stringify(firstBatch.headers)===JSON.stringify(expectedRoleColumns),"breakdown possui colunas por função esperadas");
    check(firstBatch.rows.length===6,"breakdown cobre as 6 funções do confronto");
    check(firstBatch.deltaRows===10,"painel de rating mostra os 10 jogadores do confronto");
    check(firstBatch.samplePlayers.length===10&&firstBatch.samplePlayers.every(player=>player.id&&player.maps===3&&player.samples===3),"lote preserva uma amostra por mapa para cada jogador");
    check(firstBatch.bands.length>=9&&firstBatch.bands.every(band=>band.title.startsWith("real ")),"faixas reais aparecem nas métricas globais e por função");
    check(firstBatch.groups===4&&firstBatch.breakdowns===2&&firstBatch.details.length===2&&firstBatch.details.every(open=>!open),"detalhes completos permanecem disponíveis e fechados por padrão");
    check(!/NaN|undefined|Infinity/.test(firstBatch.text),"lote não contém valores inválidos");
    const firstSeed=await page.evaluate(()=>window.__e2e.simulation().seed);

    await page.click("#runBatchBtn");
    await page.waitForSelector("#matchout .fidelity-score",{timeout:15000});
    const secondSeed=await page.evaluate(()=>window.__e2e.simulation().seed);
    check(Number.isInteger(firstSeed)&&firstSeed>0&&Number.isInteger(secondSeed)&&secondSeed>0&&secondSeed!==firstSeed,"cada clique em rodar lote gera uma nova seed");

    await page.selectOption("#simScope","league");
    const leagueControls=await page.evaluate(()=>({
      teams:[...document.querySelectorAll(".sim-team-field")].every(node=>getComputedStyle(node).display==="none"),
      mapDisabled:document.getElementById("runMapBtn").disabled,
      mapHidden:document.getElementById("runMapBtn").hidden,
      batchAccent:document.getElementById("runBatchBtn").classList.contains("accent"),
      batchLabel:document.getElementById("runBatchBtn").textContent.trim()
    }));
    check(leagueControls.teams&&leagueControls.mapDisabled&&leagueControls.mapHidden&&leagueControls.batchAccent&&leagueControls.batchLabel==="Rodar amostra","modo liga exibe somente a ação primária relevante");
    await page.fill("#simRuns","80");
    await page.click("#runBatchBtn");
    await page.waitForSelector('#matchout [data-metric="postplant"]',{state:"attached",timeout:20000});
    const league=await page.evaluate(()=>{
      const out=document.getElementById("matchout");
      return {
        text:out.textContent,
        metrics:[...out.querySelectorAll("[data-metric]")].map(node=>({key:node.dataset.metric,state:node.className})),
        deltaRows:out.querySelectorAll(".player-delta tbody tr").length,
        samplePlayers:window.__e2e.simulation().players
      };
    });
    const proMetrics=["kpr","ct","plant","postplant","antieco","pistol","clutch1","clutch2","clutch3","kast","adr","ak","apr","ratingR","ratingMae","fav03","fav16"];
    check(/Amostra da liga · 17\/17 times/.test(league.text),"amostra da liga cobre os 17 times");
    check(proMetrics.every(key=>league.metrics.some(metric=>metric.key===key)),"painel cobre combate, lados, economia, clutches, rating e favoritos");
    check(league.metrics.every(metric=>/\b(ok|out|low)\b/.test(metric.state)),"cada métrica recebe diagnóstico ou amostra insuficiente");
    check(league.deltaRows===85,"painel de rating mostra todos os 85 jogadores da liga");
    check(league.samplePlayers.length===85&&league.samplePlayers.every(player=>player.id&&player.maps===player.samples&&player.maps>=8&&player.maps<=11),"liga preserva as distribuições dos 85 jogadores sem perder exposições");
    check(/Fidelidade profissional\s+\d+\/\d+/.test(league.text)&&!/NaN|undefined|Infinity/.test(league.text),"nota de fidelidade da liga contém apenas valores válidos");

    const leagueSeed=await page.evaluate(()=>window.__e2e.simulation().seed);
    await page.click("#runBatchBtn");
    await page.waitForSelector('#matchout [data-metric="postplant"]',{state:"attached",timeout:20000});
    const leagueSeedAgain=await page.evaluate(()=>window.__e2e.simulation().seed);
    check(leagueSeedAgain!==leagueSeed,"nova amostra da liga também recebe seed automática");

    await page.$eval("details.sim-details",node=>{node.open=true;});
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.locator(".sim-core").hover();
    await page.mouse.wheel(0,600);
    await page.waitForTimeout(100);
    const scroll=await page.evaluate(()=>({windowY:window.scrollY,bodyOverflow:getComputedStyle(document.body).overflowY,canvasOverflow:getComputedStyle(document.querySelector(".canvas-body")).overflowY}));
    check(scroll.windowY>0&&scroll.bodyOverflow!=="hidden"&&scroll.canvasOverflow!=="auto","rolagem do mouse move a página sem criar scroll aninhado no canvas");
    await page.setViewportSize({width:390,height:844});
    const mobileLayout=await page.evaluate(()=>({
      metricColumns:getComputedStyle(document.querySelector(".fidelity-grid")).gridTemplateColumns.trim().split(/\s+/).length,
      tableColumns:getComputedStyle(document.querySelector(".sim-breakdowns")).gridTemplateColumns.trim().split(/\s+/).length,
      noOverflow:document.documentElement.scrollWidth<=document.documentElement.clientWidth
    }));
    check(mobileLayout.metricColumns===1&&mobileLayout.tableColumns===1&&mobileLayout.noOverflow,"layout mobile empilha métricas e tabelas sem overflow horizontal");
    check(errors.length===0,`sem page-error no fluxo${errors.length?": "+errors[0]:""}`);

    console.log(failures?`✗ ${failures} checagem(ns) e2e falharam`:"✓ aba Simular preserva placar, fidelidade, seed automática e rolagem");
    return done(failures?1:0);
  }catch(error){
    console.log("  ✗ e2e abortou: "+(error.message||error));
    console.log("✗ e2e da aba Simular falhou");
    return done(1);
  }
})();
