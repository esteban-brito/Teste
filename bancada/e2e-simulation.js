/* bancada/e2e-simulation.js — contrato de navegador da aba Simular.
   Protege placar, confronto bilateral, amostra da liga, métricas profissionais,
   seed automática, rolagem e responsividade. Não altera nem recalibra o motor. */
const http=require("http");
const fs=require("fs");
const path=require("path");
const {spawn}=require("child_process");
const {chromium}=require("playwright");
const {okMark}=require("./common");
const CAMPAIGN_GOLDEN=require("./campaign-golden.json");

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

    await page.fill("#simRuns","1");
    await page.click("#runBatchBtn");
    await page.waitForSelector("#matchout .player-variance-table",{state:"attached",timeout:15000});
    const singleMapVariance=await page.evaluate(()=>({
      headers:[...document.querySelectorAll(".player-variance-table thead th")].map(cell=>cell.textContent.trim()),
      rows:[...document.querySelectorAll(".player-variance-table tbody tr")].map(row=>({
        cells:[...row.cells].map(cell=>cell.textContent.replace(/\s+/g," ").trim()),
        values:[...row.querySelectorAll("td[data-value]")].map(cell=>cell.dataset.value),
        sufficient:row.dataset.sufficient
      }))
    }));
    const expectedVarianceColumns=["Jogador","Time","Função","Hist.","Média","Mediana","DP","P5","P95","Mín.–Máx.","Faixa 80%","IC95%","Δ hist.","Mapas"];
    const validSingleMap=singleMapVariance.rows.every(row=>{
      const [historical,average,median,stdDev,p05,p95]=row.values.map(Number);
      const collapsed=`${average.toFixed(2)}–${average.toFixed(2)}`;
      return [historical,average,median,stdDev,p05,p95].every(Number.isFinite)&&average===median&&average===p05&&average===p95&&stdDev===0&&row.cells[9]===collapsed&&row.cells[10]===collapsed&&row.cells[11]==="—"&&row.sufficient==="false";
    });
    check(JSON.stringify(singleMapVariance.headers)===JSON.stringify(expectedVarianceColumns),"painel individual separa histórico, tendência, dispersão e incerteza");
    check(singleMapVariance.rows.length===10&&validSingleMap,"um mapa mantém 10 jogadores, estatísticas degeneradas válidas e aviso de amostra pequena");

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
        varianceRows:[...out.querySelectorAll(".player-variance-table tbody tr")].map(row=>({
          values:[...row.querySelectorAll("td[data-value]")].map(cell=>cell.dataset.value),
          sufficient:row.dataset.sufficient
        })),
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
    check(firstBatch.varianceRows.length===10&&firstBatch.varianceRows.every(row=>row.sufficient==="false"&&row.values.every(value=>value===""||Number.isFinite(Number(value)))),"lote curto expõe distribuições válidas sem esconder amostras pequenas");
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
        insufficientRows:out.querySelectorAll('.player-variance-table tbody tr[data-sufficient="false"]').length,
        ranges:[...out.querySelectorAll('.player-variance-table tbody tr[data-player-id]')].map(row=>[row.cells[9].textContent,row.cells[10].textContent].map(text=>text.split("–").map(Number))),
        samplePlayers:window.__e2e.simulation().players
      };
    });
    const proMetrics=["kpr","ct","plant","postplant","antieco","pistol","clutch1","clutch2","clutch3","kast","adr","ak","apr","ratingR","ratingMae","fav03","fav16"];
    check(/Amostra da liga · 17\/17 times/.test(league.text),"amostra da liga cobre os 17 times");
    check(proMetrics.every(key=>league.metrics.some(metric=>metric.key===key)),"painel cobre combate, lados, economia, clutches, rating e favoritos");
    check(league.metrics.every(metric=>/\b(ok|out|low)\b/.test(metric.state)),"cada métrica recebe diagnóstico ou amostra insuficiente");
    check(league.deltaRows===85,"painel de rating mostra todos os 85 jogadores da liga");
    check(league.insufficientRows===0,"amostra padrão da liga identifica corretamente a suficiência individual");
    check(league.ranges.length===85&&league.ranges.every(([[minimum,maximum],[p10,p90]])=>[minimum,p10,p90,maximum].every(Number.isFinite)&&minimum<=p10&&p10<=p90&&p90<=maximum),"extremos e faixa recorrente P10–P90 permanecem ordenados para os 85 jogadores");
    check(league.samplePlayers.length===85&&league.samplePlayers.every(player=>player.id&&player.maps===player.samples&&player.maps>=8&&player.maps<=11),"liga preserva as distribuições dos 85 jogadores sem perder exposições");
    check(/Fidelidade profissional\s+\d+\/\d+/.test(league.text)&&!/NaN|undefined|Infinity/.test(league.text),"nota de fidelidade da liga contém apenas valores válidos");

    await page.locator("details.sim-details").nth(1).evaluate(node=>{node.open=true;});
    const firstPlayerId="s1mple";
    await page.fill("#simPlayerSearch",firstPlayerId);
    let visiblePlayers=await page.locator('.player-variance-table tbody tr[data-player-id]').count();
    check(visiblePlayers===1&&await page.locator('.player-variance-table tbody tr[data-player-id]').first().getAttribute("data-player-id")===firstPlayerId,"busca por ID encontra exatamente o jogador solicitado");
    await page.fill("#simPlayerSearch","jogador-que-nao-existe");
    check(await page.locator('.player-variance-table tbody tr[data-player-id]').count()===0&&await page.locator(".player-empty").count()===1,"busca vazia informa ausência sem remover dados da amostra");
    await page.click("#simPlayerReset");
    check(await page.locator('.player-variance-table tbody tr[data-player-id]').count()===85,"limpar filtros restaura os 85 participantes");

    const firstTeamValue=await page.$eval("#simPlayerTeam",select=>select.options[1]?.value);
    await page.selectOption("#simPlayerTeam",firstTeamValue);
    visiblePlayers=await page.locator('.player-variance-table tbody tr[data-player-id]').count();
    check(visiblePlayers===5,"filtro de time isola os cinco jogadores da escalação histórica");
    await page.click("#simPlayerReset");
    await page.selectOption("#simPlayerRole","AWPer");
    const roleCells=await page.locator('.player-variance-table tbody tr[data-player-id] td:nth-child(3)').allTextContents();
    check(roleCells.length>0&&roleCells.every(role=>role.trim()==="AWPer"),"filtro de função mantém somente a função escolhida");
    const [csvDownload]=await Promise.all([page.waitForEvent("download"),page.click("#simPlayerExport")]);
    const csv=fs.readFileSync(await csvDownload.path(),"utf8"),csvLines=csv.trim().split(/\r?\n/);
    check(csv.charCodeAt(0)===0xfeff&&/^sandbox-player-ratings-league-seed--?\d+\.csv$/.test(csvDownload.suggestedFilename())&&csvLines[0].includes("historical_rating,current_reference_rating,simulated_mean")&&csvLines[0].includes("minimum,p10,p90,maximum"),"CSV inclui BOM, nome rastreável e schema estável");
    check(csvLines.length===roleCells.length+1&&csvLines.slice(1).every(line=>line.includes(",AWPer,")),"CSV exporta exatamente os jogadores visíveis após os filtros");
    const csvSafety=await page.evaluate(()=>[window.simCsvCell("=2+2"),window.simCsvCell('nome, "apelido"')]);
    check(csvSafety[0]==="'=2+2"&&csvSafety[1]==='"nome, ""apelido"""',"CSV neutraliza fórmulas e escapa campos compostos");
    await page.click("#simPlayerReset");
    await page.selectOption("#simPlayerSufficiency","small");
    check(await page.locator('.player-variance-table tbody tr[data-player-id]').count()===0,"filtro de amostra pequena respeita a suficiência da liga");
    await page.click("#simPlayerReset");
    await page.selectOption("#simPlayerSort","mean");
    await page.selectOption("#simPlayerDirection","asc");
    const orderedMeans=await page.locator('.player-variance-table tbody tr[data-player-id] td:nth-child(5)').evaluateAll(cells=>cells.map(cell=>Number(cell.dataset.value)));
    check(orderedMeans.every((value,index)=>index===0||orderedMeans[index-1]<=value),"ordenação crescente por média é estável e numérica");
    await page.click("#simPlayerReset");
    const compareBoxes=page.locator('[data-compare-player]');
    await compareBoxes.nth(0).check();
    await compareBoxes.nth(1).check();
    check(await page.locator("[data-compare-card]").count()===2,"comparação apresenta dois jogadores lado a lado");
    await compareBoxes.nth(2).click();
    check(await page.locator("[data-compare-card]").count()===2&&!await compareBoxes.nth(2).isChecked(),"comparação bloqueia um terceiro jogador sem perder a seleção válida");

    const leagueSeed=await page.evaluate(()=>window.__e2e.simulation().seed);
    await page.click("#runBatchBtn");
    await page.waitForSelector('#matchout [data-metric="postplant"]',{state:"attached",timeout:20000});
    const leagueSeedAgain=await page.evaluate(()=>window.__e2e.simulation().seed);
    check(leagueSeedAgain!==leagueSeed,"nova amostra da liga também recebe seed automática");
    check(await page.locator("[data-compare-card]").count()===0,"nova amostra limpa a comparação anterior");

    await page.$$eval("details.sim-details",nodes=>nodes.forEach(node=>{node.open=true;}));
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.waitForFunction(()=>window.scrollY===0);
    const canvasPoint=await page.$eval(".canvas-body",node=>{
      const rect=node.getBoundingClientRect(),x=Math.min(window.innerWidth-10,Math.max(10,rect.left+Math.min(200,rect.width/2))),y=Math.min(window.innerHeight-10,Math.max(10,rect.top+20));
      return {x,y,inside:Boolean(document.elementFromPoint(x,y)?.closest(".canvas-body"))};
    });
    await page.mouse.move(canvasPoint.x,canvasPoint.y);
    const scrollBefore=await page.evaluate(()=>window.scrollY);
    await page.mouse.wheel(0,600);
    await page.waitForTimeout(200);
    const scroll=await page.evaluate(()=>({windowY:window.scrollY,bodyOverflow:getComputedStyle(document.body).overflowY,canvasOverflow:getComputedStyle(document.querySelector(".canvas-body")).overflowY,scrollHeight:document.documentElement.scrollHeight,clientHeight:document.documentElement.clientHeight}));
    check(canvasPoint.inside&&scroll.windowY>scrollBefore&&scroll.bodyOverflow!=="hidden"&&scroll.canvasOverflow!=="auto",`rolagem do mouse sobre o canvas move a página sem criar scroll aninhado${scroll.windowY>scrollBefore?"":` (windowY=${scroll.windowY}, antes=${scrollBefore}, height=${scroll.scrollHeight}/${scroll.clientHeight}, body=${scroll.bodyOverflow}, canvas=${scroll.canvasOverflow})`}`);
    await page.setViewportSize({width:390,height:844});
    const mobileLayout=await page.evaluate(()=>({
      metricColumns:getComputedStyle(document.querySelector(".fidelity-grid")).gridTemplateColumns.trim().split(/\s+/).length,
      tableColumns:getComputedStyle(document.querySelector(".sim-breakdowns")).gridTemplateColumns.trim().split(/\s+/).length,
      controlColumns:getComputedStyle(document.querySelector(".player-controls")).gridTemplateColumns.trim().split(/\s+/).length,
      noOverflow:document.documentElement.scrollWidth<=document.documentElement.clientWidth
    }));
    check(mobileLayout.metricColumns===1&&mobileLayout.tableColumns===1&&mobileLayout.controlColumns<=2&&mobileLayout.noOverflow,"layout mobile empilha métricas, filtros e tabelas sem overflow horizontal");

    await page.setViewportSize({width:1440,height:700});
    await page.selectOption("#simScope","campaign");
    const campaignControls=await page.evaluate(()=>(
      {teams:[...document.querySelectorAll(".sim-team-field")].every(node=>getComputedStyle(node).display!=="none"),mapHidden:getComputedStyle(document.querySelector(".sim-map-field")).display==="none",runsHidden:getComputedStyle(document.querySelector(".sim-runs-field")).display==="none",button:document.getElementById("runBatchBtn").textContent.trim()}
    ));
    check(campaignControls.teams&&campaignControls.mapHidden&&campaignControls.runsHidden&&campaignControls.button==="Jogar MD3","campanha curta apresenta somente as decisões relevantes da MD3");
    await page.selectOption("#simA","0");
    await page.selectOption("#simB","1");
    await page.click("#runBatchBtn");
    await page.waitForSelector(".sim-campaign-score",{timeout:15000});
    const campaign=await page.evaluate(()=>({state:window.__e2e.simulation(),mapCards:document.querySelectorAll(".sim-campaign-map").length,fidelityScore:document.querySelectorAll(".fidelity-score").length,details:document.querySelectorAll("details.sim-details").length,text:document.getElementById("matchout").textContent}));
    const series=campaign.state.campaign,seriesMaps=series?.maps||[],orientations=seriesMaps.map(map=>map.orientation);
    check(campaign.state.scope==="campaign"&&series?.format==="MD3"&&seriesMaps.length>=2&&seriesMaps.length<=3&&series.winsA+series.winsB===seriesMaps.length&&Math.max(series.winsA,series.winsB)===2,"campanha encerra a MD3 exatamente quando um time vence dois mapas");
    check(new Set(seriesMaps.map(map=>map.map)).size===seriesMaps.length&&orientations.every((value,index)=>index===0||value!==orientations[index-1]),"campanha usa mapas sem repetição e alterna a orientação dos times");
    check(campaign.mapCards===seriesMaps.length&&campaign.state.maps===seriesMaps.length&&campaign.state.players.length===10&&campaign.state.players.every(player=>player.maps===seriesMaps.length&&player.samples===seriesMaps.length),"campanha preserva placares e uma amostra individual por mapa");
    check(campaign.fidelityScore===0&&campaign.details===1&&/não mede expectativa de longo prazo/.test(campaign.text)&&!/NaN|undefined|Infinity/.test(campaign.text),"campanha não se apresenta como benchmark de expectativa ou fidelidade");
    const goldenPage=await browser.newPage({viewport:{width:1280,height:720}});
    await goldenPage.goto(`http://127.0.0.1:${port}/sandbox.html?e2e=1&e2eSeed=${CAMPAIGN_GOLDEN.seed}`,{waitUntil:"load",timeout:20000});
    await goldenPage.waitForFunction(()=>window.__e2e&&window.__e2e.ready,{timeout:20000});
    await goldenPage.click('#modebar button[data-mode="simular"]');
    await goldenPage.selectOption("#simScope","campaign");
    await goldenPage.selectOption("#simA","0");
    await goldenPage.selectOption("#simB","1");
    await goldenPage.click("#runBatchBtn");
    await goldenPage.waitForSelector(".sim-campaign-score",{timeout:15000});
    const goldenCampaign=await goldenPage.evaluate(()=>{const state=window.__e2e.simulation();return {seed:state.seed,scope:state.scope,maps:state.maps,campaign:state.campaign};});
    await goldenPage.close();
    check(JSON.stringify(goldenCampaign)===JSON.stringify(CAMPAIGN_GOLDEN),"campanha MD3 preserva o golden completo por seed fixa");
    check(errors.length===0,`sem page-error no fluxo${errors.length?": "+errors[0]:""}`);

    console.log(failures?`✗ ${failures} checagem(ns) e2e falharam`:"✓ aba Simular preserva expectativa e separa a campanha curta");
    return done(failures?1:0);
  }catch(error){
    console.log("  ✗ e2e abortou: "+(error.message||error));
    console.log("✗ e2e da aba Simular falhou");
    return done(1);
  }
})();
