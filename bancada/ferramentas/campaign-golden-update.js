/* bancada/ferramentas/campaign-golden-update.js - regenera bancada/golden/campaign-golden.json.

   O fixture trava a campanha MD3 do sandbox por seed fixa e é verificado por
   bancada/suites/e2e-simulation.js. Ele NÃO tem atualização automática de propósito: só
   deve ser regenerado quando uma mudança de balanceamento deliberada explicar o
   novo resultado. Rodar isto para esconder regressão viola o AGENTS.md.

   Uso: node bancada/ferramentas/campaign-golden-update.js */
const fs=require("fs");
const http=require("http");
const path=require("path");
const {spawn}=require("child_process");
const {chromium}=require("playwright");
const {ROOT,GOLDEN,chromiumLaunchOptions}=require("../lib/common");

const FIXTURE_PATH=path.join(GOLDEN,"campaign-golden.json");
const atual=JSON.parse(fs.readFileSync(FIXTURE_PATH,"utf8"));

// mesmo servidor estático do E2E — reusar evita divergir do ambiente que valida o fixture
function waitServer(port,tries=50){
  return new Promise((resolve,reject)=>{
    const tick=n=>{
      const req=http.get({host:"127.0.0.1",port,path:"/sandbox.html"},res=>{res.resume();resolve();});
      req.on("error",()=>{if(n<=0)reject(new Error("servidor não subiu"));else setTimeout(()=>tick(n-1),150);});
    };
    tick(tries);
  });
}

async function main(){
  const port=5500+Math.floor(Math.random()*400);
  const server=spawn(process.execPath,[path.join(ROOT,"tools","serve-static.js")],
    {env:{...process.env,PORT:String(port)},stdio:"ignore"});
  await waitServer(port);
  const browser=await chromium.launch(chromiumLaunchOptions());
  try{
    const page=await browser.newPage({viewport:{width:1280,height:720}});
    await page.goto(`http://127.0.0.1:${port}/sandbox.html?e2e=1&e2eSeed=${atual.seed}`,{waitUntil:"load",timeout:20000});
    await page.waitForFunction(()=>window.__e2e&&window.__e2e.ready,{timeout:20000});
    await page.click('#modebar button[data-mode="simular"]');
    await page.selectOption("#simScope","campaign");
    await page.selectOption("#simA","0");
    await page.selectOption("#simB","1");
    await page.click("#runBatchBtn");
    await page.waitForSelector(".sim-campaign-score",{timeout:15000});
    const novo=await page.evaluate(()=>{const state=window.__e2e.simulation();
      return {seed:state.seed,scope:state.scope,maps:state.maps,campaign:state.campaign};});

    if(JSON.stringify(novo)===JSON.stringify(atual)){
      console.log("✓ campaign-golden.json já está atualizado (nada a fazer)");
      return;
    }
    console.log("— campanha MD3 da seed",atual.seed,"—");
    console.log(`  antes: ${atual.campaign.winsA}-${atual.campaign.winsB} em ${atual.maps} mapa(s) · ${atual.campaign.maps.map(m=>`${m.map} ${m.scoreA}-${m.scoreB}`).join(" | ")}`);
    console.log(`  agora: ${novo.campaign.winsA}-${novo.campaign.winsB} em ${novo.maps} mapa(s) · ${novo.campaign.maps.map(m=>`${m.map} ${m.scoreA}-${m.scoreB}`).join(" | ")}`);
    fs.writeFileSync(FIXTURE_PATH,JSON.stringify(novo,null,2)+"\n");
    console.log("✓ fixture regravado explicitamente");
  }finally{
    try{await browser.close();}catch{/* já fechado */}
    try{server.kill();}catch{/* já encerrado */}
  }
}

main().catch(error=>{console.error(error);process.exitCode=1;});
