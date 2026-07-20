/* bancada/e2e-simulation.js — contrato de navegador da aba Simular.
   Protege placar, confronto, amostra determinística da liga, métricas profissionais,
   fidelidade por função e repetibilidade por seed. Não altera nem recalibra o motor. */
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
    const page=await browser.newPage();
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
    await page.fill("#simSeed","2026");
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

    await page.fill("#simRuns","12");
    await page.click("#runBatchBtn");
    await page.waitForSelector("#matchout .fidelity-score",{timeout:15000});
    const firstBatch=await page.evaluate(()=>{
      const out=document.getElementById("matchout");
      const table=out.querySelector(".scoreboards table");
      return {
        text:out.textContent,
        normalized:out.innerText.replace(/\s+/g," ").trim(),
        macro:[...out.querySelectorAll(".stat-mini span")].map(node=>node.textContent.trim()),
        headers:table?[...table.querySelectorAll("thead th")].map(cell=>cell.textContent.trim()):[],
        rows:table?[...table.querySelectorAll("tbody tr")].map(row=>[...row.cells].map(cell=>cell.textContent.trim())):[],
        bands:[...out.querySelectorAll('[title^="real "]')].map(node=>({title:node.title,style:node.getAttribute("style")||""})),
        groups:out.querySelectorAll(".fidelity-group").length,
        breakdowns:out.querySelectorAll(".sim-breakdowns .sim-data-panel").length
      };
    });
    const macroText=firstBatch.macro.join(" ");
    const expectedRoleColumns=["Função","KPR","DPR","A/K","KAST","ADR"];
    check(["KPR","KAST","ADR","assists/mapa"].every(label=>macroText.includes(label)),"lote mostra fidelidade macro e assists/mapa");
    check(JSON.stringify(firstBatch.headers)===JSON.stringify(expectedRoleColumns),"breakdown possui colunas por função esperadas");
    check(firstBatch.rows.length===6,"breakdown cobre as 6 funções do confronto");
    check(firstBatch.bands.length>=9&&firstBatch.bands.every(band=>band.title.startsWith("real ")),"faixas reais aparecem nas métricas globais e por função");
    check(firstBatch.groups===4&&firstBatch.breakdowns===2,"layout agrupa métricas e equilibra os dois painéis de detalhe");
    check(!/NaN|undefined|Infinity/.test(firstBatch.text),"lote não contém valores inválidos");

    await page.click("#runBatchBtn");
    await page.waitForSelector("#matchout .fidelity-score",{timeout:15000});
    const secondBatch=await page.$eval("#matchout",node=>node.innerText.replace(/\s+/g," ").trim());
    check(secondBatch===firstBatch.normalized,"mesma seed e quantidade reproduzem o mesmo lote");

    await page.selectOption("#simScope","league");
    const leagueControls=await page.evaluate(()=>({
      teams:[...document.querySelectorAll(".sim-team-field")].every(node=>getComputedStyle(node).display==="none"),
      mapDisabled:document.getElementById("runMapBtn").disabled,
      mapHidden:document.getElementById("runMapBtn").hidden,
      batchAccent:document.getElementById("runBatchBtn").classList.contains("accent"),
      batchLabel:document.getElementById("runBatchBtn").textContent.trim()
    }));
    check(leagueControls.teams&&leagueControls.mapDisabled&&leagueControls.mapHidden&&leagueControls.batchAccent&&leagueControls.batchLabel==="Rodar amostra","modo liga exibe somente a ação primária relevante");
    await page.fill("#simRuns","36");
    await page.fill("#simSeed","3107");
    await page.click("#runBatchBtn");
    await page.waitForSelector('#matchout [data-metric="postplant"]',{timeout:20000});
    const league=await page.evaluate(()=>{
      const out=document.getElementById("matchout");
      return {
        text:out.textContent,
        normalized:out.innerText.replace(/\s+/g," ").trim(),
        metrics:[...out.querySelectorAll("[data-metric]")].map(node=>({key:node.dataset.metric,state:node.className})),
        deltaRows:out.querySelectorAll(".player-delta tbody tr").length
      };
    });
    const proMetrics=["kpr","ct","plant","postplant","antieco","pistol","clutch1","clutch2","clutch3","kast","adr","ak","apr","ratingR","ratingMae","fav03","fav16"];
    check(/Amostra da liga · 17\/17 times/.test(league.text),"amostra determinística cobre os 17 times");
    check(proMetrics.every(key=>league.metrics.some(metric=>metric.key===key)),"painel cobre combate, lados, economia, clutches, rating e favoritos");
    check(league.metrics.every(metric=>/\b(ok|out|low)\b/.test(metric.state)),"cada métrica recebe diagnóstico ou amostra insuficiente");
    check(league.deltaRows===8,"painel mostra os 8 maiores desvios individuais de rating");
    check(/Fidelidade profissional\s+\d+\/\d+/.test(league.text)&&!/NaN|undefined|Infinity/.test(league.text),"nota de fidelidade da liga contém apenas valores válidos");

    await page.click("#runBatchBtn");
    await page.waitForSelector('#matchout [data-metric="postplant"]',{timeout:20000});
    const leagueAgain=await page.$eval("#matchout",node=>node.innerText.replace(/\s+/g," ").trim());
    check(leagueAgain===league.normalized,"amostra da liga é integralmente reproduzível pela seed");
    await page.setViewportSize({width:390,height:844});
    const mobileLayout=await page.evaluate(()=>({
      metricColumns:getComputedStyle(document.querySelector(".fidelity-grid")).gridTemplateColumns.trim().split(/\s+/).length,
      tableColumns:getComputedStyle(document.querySelector(".sim-breakdowns")).gridTemplateColumns.trim().split(/\s+/).length,
      noOverflow:document.documentElement.scrollWidth<=document.documentElement.clientWidth
    }));
    check(mobileLayout.metricColumns===1&&mobileLayout.tableColumns===1&&mobileLayout.noOverflow,"layout mobile empilha métricas e tabelas sem overflow horizontal");
    check(errors.length===0,`sem page-error no fluxo${errors.length?": "+errors[0]:""}`);

    console.log(failures?`✗ ${failures} checagem(ns) e2e falharam`:"✓ aba Simular preserva placar, fidelidade e seed");
    return done(failures?1:0);
  }catch(error){
    console.log("  ✗ e2e abortou: "+(error.message||error));
    console.log("✗ e2e da aba Simular falhou");
    return done(1);
  }
})();
