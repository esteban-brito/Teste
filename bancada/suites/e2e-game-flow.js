/* bancada/suites/e2e-game-flow.js — contrato de navegador do jogo principal.
   Percorre roleta, montagem do elenco, suíça, playoffs e tela final pela UI real.
   A seleção de seed apenas torna o caminho vencedor reproduzível; não altera pesos,
   dados, quantidade de chamadas ao RNG do produto nem resultados persistidos. */
/* global TransitionEvent */
const http=require("http");
const path=require("path");
const {spawn}=require("child_process");
const {chromium}=require("playwright");
const {ROOT,okMark,chromiumLaunchOptions}=require("../lib/common");

function waitServer(port,tries=50){
  return new Promise((resolve,reject)=>{
    const tick=n=>{
      const req=http.get({host:"127.0.0.1",port,path:"/index.html"},res=>{res.resume();resolve();});
      req.on("error",()=>{if(n<=0)reject(new Error("servidor não subiu"));else setTimeout(()=>tick(n-1),150);});
    };
    tick(tries);
  });
}

let failures=0;
function check(ok,label){console.log(`  ${okMark(!!ok)} ${label}`);if(!ok)failures++;}

async function revealDraw(page,candidateSelector,candidateLabel){
  for(let attempt=0;attempt<12;attempt++){
    await page.click("#rollbtn");
    await page.waitForFunction(()=>document.getElementById("track").children.length>40,{timeout:3000});
    await page.$eval("#track",track=>track.dispatchEvent(new TransitionEvent("transitionend",{bubbles:true,propertyName:"transform"})));
    await page.waitForSelector("#picks [data-pick]",{state:"attached",timeout:3000});
    if(await page.locator(candidateSelector).count())return;
    await page.click("#respinbtn");
  }
  throw new Error(`não foi possível sortear ${candidateLabel} disponível`);
}

async function draftPlayer(page,slot){
  await revealDraw(page,"#picks .card[data-pick]:not(.taken):not(.dup)","um jogador");
  const pickId=await page.$$eval("#picks .card[data-pick]:not(.taken):not(.dup)",cards=>{
    const ordered=[...cards].sort((a,b)=>Number(b.querySelector(".ovr")?.textContent)-Number(a.querySelector(".ovr")?.textContent));
    return ordered[0]?.dataset.pick||null;
  });
  if(!pickId)throw new Error(`rodada ${slot+1} não ofereceu jogador disponível`);
  await page.locator(`#picks [data-pick="${pickId}"]`).click();
  await page.locator(`#lineup [data-slot="${slot}"].avail`).click();
  await page.waitForFunction(expected=>document.getElementById("cnt").textContent===`${expected}/6`,slot+1);
}

async function draftCoach(page){
  await revealDraw(page,"#picks .coachcard[data-pick]:not(.taken)","um treinador");
  await page.locator("#picks .coachcard[data-pick]:not(.taken)").click();
  await page.locator('#lineupCoach [data-slot="coach"].avail').click();
  await page.waitForFunction(()=>document.getElementById("cnt").textContent==="6/6");
}

// Busca uma seed curta em que o time do usuário vence o próximo mapa. Cada tentativa
// reinicia o Mulberry32; a seed escolhida é reinstalada antes de a UI simular o mapa real.
async function seedWinningMap(page){
  return page.evaluate(()=>{
    const {srand,getMatch,forcaDoDia,simularMapa}=window.__DRAFT9_E2E__;
    for(let seed=1;seed<=500;seed++){
      srand(seed);
      const {A,B}=getMatch();
      const fdA=forcaDoDia(A.ef,A.quim),fdB=forcaDoDia(B.ef,B.quim);
      const tA={...A.time,nome:A.nome,cor:A.cor,meu:A.meu};
      const tB={...B.time,nome:B.nome,cor:B.cor,meu:B.meu};
      const game=simularMapa(tA,tB,fdA,fdB);
      if(game.vencedorNome===A.nome){srand(seed);return seed;}
    }
    throw new Error("nenhuma seed vencedora encontrada para o próximo mapa");
  });
}

async function finishUserSeries(page){
  await page.waitForSelector("#matchOverlay",{state:"visible",timeout:10000});
  await page.waitForSelector("#prematchStart",{state:"visible",timeout:5000});
  await seedWinningMap(page);
  await page.click("#prematchStart");
  let maps=0;

  while(maps<3){
    await page.waitForSelector("#matchSkip",{state:"visible",timeout:10000});
    await page.click("#matchSkip");
    await page.waitForSelector("#matchContinue",{state:"visible",timeout:5000});
    maps++;

    const scoreboard=await page.evaluate(()=>({
      rows:document.querySelectorAll("#liveScore .ls-row").length,
      ratings:[...document.querySelectorAll("#liveScore .ls-rate")].map(node=>node.textContent.trim()),
      score:[Number(document.getElementById("sbScoreA").textContent),Number(document.getElementById("sbScoreB").textContent)]
    }));
    check(scoreboard.rows===10&&scoreboard.ratings.every(value=>Number.isFinite(Number(value))),`mapa ${maps} fecha com 10 jogadores e ratings válidos`);
    check(scoreboard.score.some(value=>value>=13),`mapa ${maps} fecha com placar válido`);

    await seedWinningMap(page);
    await page.click("#matchContinue");
    await page.waitForFunction(()=>{
      const overlay=document.getElementById("matchOverlay");
      const skip=document.getElementById("matchSkip");
      return overlay.hidden||overlay.classList.contains("fechando")||!skip.hidden;
    },{timeout:10000});
    const closed=await page.$eval("#matchOverlay",overlay=>overlay.hidden||overlay.classList.contains("fechando"));
    if(closed)return maps;
  }
  throw new Error("série excedeu três mapas");
}

(async()=>{
  console.log("— E2E: JOGO PRINCIPAL (draft + Major completo) —");
  /* 5900–6199 incluía a porta 6000, bloqueada pelo Chromium como unsafe. O
     sorteio raro derrubava o CI antes de abrir o jogo, sem testar produto algum. */
  const port=7000+Math.floor(Math.random()*300);
  const server=spawn(process.execPath,[path.join(ROOT,"tools","serve-static.js")],
    {env:{...process.env,PORT:String(port)},stdio:"ignore"});
  let browser=null;
  const done=async code=>{try{if(browser)await browser.close();}catch{}try{server.kill();}catch{}process.exitCode=code;};

  try{
    await waitServer(port);
    browser=await chromium.launch(chromiumLaunchOptions());
    const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:"reduce"});
    const errors=[];
    page.on("pageerror",error=>errors.push(String(error.message||error)));
    page.on("console",message=>{
      if(message.type()==="error"&&!/Failed to load resource|ERR_CONNECTION|ERR_NAME_NOT_RESOLVED|net::/.test(message.text())){
        errors.push("console:"+message.text());
      }
    });

    await page.goto(`http://127.0.0.1:${port}/index.html?e2e=1`,{waitUntil:"load",timeout:20000});
    for(let slot=0;slot<5;slot++)await draftPlayer(page,slot);
    await draftCoach(page);

    const lineup=await page.evaluate(()=>({
      players:document.querySelectorAll("#lineup [data-move]").length,
      coaches:document.querySelectorAll('#lineupCoach [data-move="coach"]').length,
      resultHidden:document.getElementById("result").hidden,
      values:["rBruta","rQuim","rEfet"].map(id=>document.getElementById(id).textContent),
      majorHidden:document.getElementById("majorSection").hidden
    }));
    check(lineup.players===5&&lineup.coaches===1,"draft preenche cinco jogadores e um treinador");
    check(!lineup.resultHidden&&lineup.values.every(value=>value&&!/—|NaN|undefined/.test(value)),"lineup completo exibe força, química e força efetiva");
    check(!lineup.majorHidden,"Major é liberado somente após o elenco completo");

    await page.click("#suicabtn");
    await page.waitForSelector("#suicaOverlay",{state:"visible",timeout:5000});
    check(await page.locator("#swissBoard .match").count()===16,"fase suíça começa com 16 times");

    let swissRounds=0,totalMaps=0;
    while(!(await page.locator("#suicaPlayoffs").isVisible())&&swissRounds<10){
      const before=await page.locator("#suicaSub").textContent();
      await page.click("#suicaAvancar");
      swissRounds++;
      const hasMatch=await page.locator("#prematchStart").isVisible();
      if(hasMatch)totalMaps+=await finishUserSeries(page);
      await page.waitForFunction(previous=>document.getElementById("suicaSub").textContent!==previous||!document.getElementById("suicaPlayoffs").hidden,before,{timeout:10000});
    }
    check(await page.locator("#suicaPlayoffs").isVisible(),"suíça conclui e libera os playoffs");
    check(await page.locator("#swissBoard .qualified-slot.mine:not(.elim-slot)").count()===1,"time do usuário termina entre os oito classificados");

    await page.click("#suicaPlayoffs");
    await page.waitForSelector("#playoffOverlay",{state:"visible",timeout:5000});
    const phases=["quartas de final","semifinais","grande final"];
    for(const phase of phases){
      const subtitle=(await page.locator("#playoffSub").textContent()).toLowerCase();
      check(subtitle.includes(phase),`bracket chega a ${phase}`);
      await page.click("#playoffAvancar");
      totalMaps+=await finishUserSeries(page);
    }

    await page.waitForSelector("#finalOverlay",{state:"visible",timeout:10000});
    const final=await page.evaluate(()=>({
      title:document.getElementById("finalTitulo").textContent.trim(),
      seals:document.getElementById("finalSelos").textContent,
      ratings:document.querySelectorAll("#finalRatings .fr-row").length,
      journey:document.querySelectorAll("#finalJornada .jt").length,
      invalid:document.getElementById("finalOverlay").textContent.match(/NaN|undefined|Infinity/)
    }));
    check(final.title==="CAMPEÃO DO MAJOR"&&final.seals.includes("CAMPEÃO"),"campanha completa termina com o título do Major");
    check(final.ratings===5&&final.journey===totalMaps,"resumo final cobre os cinco jogadores e todos os mapas disputados");
    check(!final.invalid&&errors.length===0,`fluxo completo não produz valores inválidos nem page-error${errors.length?": "+errors[0]:""}`);

    // MEMÓRIA: título e recordes persistem no localStorage, com narrativa do MVP na tela final
    const memoria=await page.evaluate(()=>{
      const d=JSON.parse(localStorage.getItem("draft90.progresso.v1")||"null");
      return {salvo:!!d,titulos:d?d.titulos.length:0,campanhas:d?d.contadores.campanhas:0,
        recordes:d?Object.keys(d.recordes).length:0,killsRec:d&&d.recordes.kills?d.recordes.kills.v:0,
        narrativa:(document.querySelector("#finalMvpCard .mvp-narrativa")||{}).textContent||""};
    });
    check(memoria.salvo&&memoria.titulos===1&&memoria.campanhas===1,"título campeão entra no progresso persistente");
    check(memoria.recordes>=3&&memoria.killsRec>0,"recordes do clube capturados da campanha");
    check(memoria.narrativa.length>20,"tela final conta a narrativa do MVP da campanha");

    await page.click("#finalVoltar");
    await page.waitForFunction(()=>document.getElementById("cnt").textContent==="0/6"&&document.getElementById("majorSection").hidden);
    check(await page.locator("#lineup [data-move]").count()===0,"jogar novamente limpa campanha e elenco");

    // MEMÓRIA: sobrevive ao reload e alimenta o Hall da Fama pela UI real
    await page.reload({waitUntil:"networkidle"});
    await page.click("#hallBtn");
    await page.waitForSelector("#hallOverlay",{state:"visible"});
    const hall=await page.evaluate(()=>({
      titulos:document.querySelectorAll("#hallTitulos .hall-titulo").length,
      recordes:document.querySelectorAll("#hallRecordes .hall-rec").length,
      contadores:document.getElementById("hallContadores").textContent,
      invalido:!!document.getElementById("hallOverlay").textContent.match(/NaN|undefined|Infinity/)
    }));
    check(hall.titulos===1&&hall.recordes>=3&&!hall.invalido,"Hall da Fama mostra o título e os recordes após reload");
    check(hall.contadores.includes("1")&&hall.contadores.includes("títulos"),"contadores do Hall refletem a campanha");
    await page.click("#hallFechar");

    console.log(failures?`✗ ${failures} checagem(ns) e2e falharam`:"✓ jogo principal preserva draft, Major e reinício completo");
    return done(failures?1:0);
  }catch(error){
    console.log("  ✗ e2e abortou: "+(error.message||error));
    console.log("✗ e2e do jogo principal falhou");
    return done(1);
  }
})();
