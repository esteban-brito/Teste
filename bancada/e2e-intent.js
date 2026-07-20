/* bancada/e2e-intent.js — teste de NAVEGADOR do fluxo paralelo de intenções.
   Fecha a lacuna que os testes de Node não alcançam: runCalibrationParallel usa Web Workers +
   DOM reais, e a guarda de aplicação vive num onclick. Aqui dirigimos a UI de verdade (carrega
   jogador → calibra → aplica intenção → calibra outro em modo IA/paralelo → aplica principal e
   alternativa) e checamos, pela seam read-only ?e2e, que a intenção anterior NUNCA regride.

   Não depende de forçar sinteticamente o ramo de recusa (isso seria não-determinístico); valida a
   GARANTIA ponta-a-ponta ("zero regressões após o caminho paralelo"), que é o que a auditoria pediu.

   Playwright e Chromium são dependências obrigatórias. Falta de infraestrutura é falha: um E2E
   pulado não comprova o contrato que esta suíte protege. */
const http=require("http");
const path=require("path");
const {spawn}=require("child_process");
const pw=require("playwright");
const {okMark}=require("./common");

function waitServer(port,tries=50){
  return new Promise((resolve,reject)=>{
    const tick=n=>{
      const req=http.get({host:"127.0.0.1",port,path:"/sandbox.html"},res=>{res.resume();resolve();});
      req.on("error",()=>{ if(n<=0)reject(new Error("servidor não subiu")); else setTimeout(()=>tick(n-1),150); });
    };
    tick(tries);
  });
}

let failures=0;
function check(ok,label){ console.log(`  ${okMark(!!ok)} ${label}`); if(!ok)failures++; }

(async()=>{
  console.log("— E2E: INTENÇÕES NO CAMINHO PARALELO (navegador) —");
  const port=5100+Math.floor(Math.random()*400);
  const server=spawn(process.execPath,[path.join(__dirname,"..","tools","serve-static.js")],
    {env:{...process.env,PORT:String(port)},stdio:"ignore"});
  let browser=null;
  const done=async code=>{ try{if(browser)await browser.close();}catch{} try{server.kill();}catch{} process.exitCode=code; };

  try{
    await waitServer(port);
    browser=await pw.chromium.launch({headless:true});

    const page=await browser.newPage();
    const errors=[];
    page.on("pageerror",e=>errors.push(String(e.message||e)));
    // erros de rede de recursos EXTERNOS (fontes do Google) são esperados offline e benignos —
    // conta só erro real de JS (pageerror acima) e console.error que não seja falha de recurso.
    page.on("console",m=>{ if(m.type()==="error"&&!/Failed to load resource|ERR_CONNECTION|ERR_NAME_NOT_RESOLVED|net::/.test(m.text()))errors.push("console:"+m.text()); });
    await page.goto(`http://127.0.0.1:${port}/sandbox.html?e2e=1`,{waitUntil:"load",timeout:20000});
    await page.waitForFunction(()=>window.__e2e&&window.__e2e.ready&&document.querySelectorAll("#loadSel option").length>5,{timeout:20000});

    // acha dois não-IGL distintos pelo texto das opções do seletor
    const opts=await page.$$eval("#loadSel option",os=>os.map(o=>({v:o.value,t:o.textContent})).filter(o=>o.v!==""));
    const pick=nome=>opts.find(o=>o.t.startsWith(nome+" "))?.v;
    const idxA=pick("mezii")??opts[0].v, idxB=pick("NiKo")??opts.find(o=>o.v!==idxA).v;

    // helper: carrega jogador pelo seletor real (dispara o onchange que monta a UI)
    const load=async v=>{ await page.selectOption("#loadSel",v); await page.waitForSelector("#calibSuggest",{timeout:8000}); };
    // helper: define Role2-alvo no select real (change → rebuild do calibrador)
    const setRole2=async r=>{ await page.selectOption("#calibRole2",r); await page.waitForSelector("#calibSuggest",{timeout:8000}); };
    // helper: roda a busca e espera o resultado (botão Aplicar aparece)
    const suggest=async()=>{
      await page.click("#calibSuggest");
      try{ await page.waitForSelector("#calibApply",{timeout:75000}); }
      catch(e){ const html=await page.$eval("#calibResult",n=>n.textContent.slice(0,220)).catch(()=>"(sem #calibResult)"); throw new Error(e.message+" | calibResult="+html,{cause:e}); }
    };

    // ── A: registra uma intenção de Role2 (alvo alcançável, medido: →Support) ──
    await load(idxA);
    const aBefore=await page.evaluate(()=>window.__e2e.player());
    await setRole2("Support");
    await suggest();
    await page.click("#calibApply");
    await page.waitForFunction(()=>window.__e2e.intentions()>=1,{timeout:8000});
    const intents=await page.evaluate(()=>window.__e2e.intentions());
    const aKept=await page.evaluate(()=>window.__e2e.player());
    check(intents>=1&&aKept.r2==="Support",`intenção de ${aBefore.nome} registrada (Role2→Support, ficou ${aKept.r2})`);
    const regAfterA=await page.evaluate(()=>window.__e2e.regressions().length);
    check(regAfterA===0,"nenhuma regressão logo após registrar a 1ª intenção");

    // ── B: calibra outro jogador em modo IA (busca PARALELA c/ workers) e aplica ──
    await load(idxB);
    await setRole2("Support");
    await suggest();
    // se o worker ofereceu alternativas, exercita a via de troca de alternativa antes de aplicar.
    // Elas ficam num <details> recolhido — abre o "Outras soluções válidas" antes de clicar "Usar".
    const exercitouAlt=(await page.$$("[data-calib-alt]")).length>0;
    if(exercitouAlt){
      await page.click("details.cr-fold summary").catch(()=>{});
      await page.click("[data-calib-alt]");
      await page.waitForSelector("#calibApply",{timeout:8000});
    }
    await page.click("#calibApply");
    await page.waitForTimeout(400); // deixa o onclick (revalidação + toast) concluir

    // ── GARANTIA: a intenção de A não pode ter regredido pelo caminho paralelo ──
    const reg=await page.evaluate(()=>window.__e2e.regressions());
    check(reg.length===0,`zero regressões após busca paralela + aplicação${reg.length?": "+reg.map(r=>r.nome+" ("+r.failed.join("/")+")").join(", "):""}`);
    check(errors.length===0,`sem page-error no fluxo${errors.length?": "+errors[0]:""}`);
    console.log(`  · alternativas de worker exercitadas: ${exercitouAlt?"sim":"não (nenhuma oferecida)"}`);

    console.log(failures?`✗ ${failures} checagem(ns) e2e falharam`:"✓ intenções sobrevivem ao caminho paralelo");
    return done(failures?1:0);
  }catch(err){
    console.log("  ✗ e2e abortou: "+(err.message||err));
    console.log("✗ e2e de intenções falhou");
    return done(1);
  }
})();
