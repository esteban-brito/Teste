/* bancada/suites/e2e-intent.js — teste de NAVEGADOR do editor e do fluxo paralelo de intenções.
   Protege rascunho/aplicação por jogador no editor. Fecha ainda a lacuna que os testes de Node não alcançam: runCalibrationParallel usa Web Workers +
   DOM reais, e a guarda de aplicação vive num onclick. Aqui dirigimos a UI de verdade (carrega
   jogador → calibra → aplica intenção → calibra outro em modo IA/paralelo → aplica principal e
   alternativa) e checamos, pela seam read-only ?e2e, que a intenção anterior NUNCA regride.

   Não depende de forçar sinteticamente o ramo de recusa (isso seria não-determinístico); valida a
   GARANTIA ponta-a-ponta ("zero regressões após o caminho paralelo"), que é o que a auditoria pediu.

   Playwright e Chromium são dependências obrigatórias. Falta de infraestrutura é falha: um E2E
   pulado não comprova o contrato que esta suíte protege. */
const http=require("http");
const fs=require("fs");
const path=require("path");
const {spawn}=require("child_process");
const pw=require("playwright");
const {ROOT,okMark,chromiumLaunchOptions}=require("../lib/common");

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
  const server=spawn(process.execPath,[path.join(ROOT,"tools","serve-static.js")],
    {env:{...process.env,PORT:String(port)},stdio:"ignore"});
  let browser=null;
  const done=async code=>{ try{if(browser)await browser.close();}catch{} try{server.kill();}catch{} process.exitCode=code; };

  try{
    await waitServer(port);
    browser=await pw.chromium.launch(chromiumLaunchOptions());

    const page=await browser.newPage();
    const errors=[];
    page.on("pageerror",e=>errors.push(String(e.message||e)));
    // erros de rede de recursos EXTERNOS (fontes do Google) são esperados offline e benignos —
    // conta só erro real de JS (pageerror acima) e console.error que não seja falha de recurso.
    page.on("console",m=>{ if(m.type()==="error"&&!/Failed to load resource|ERR_CONNECTION|ERR_NAME_NOT_RESOLVED|net::/.test(m.text()))errors.push("console:"+m.text()); });
    await page.goto(`http://127.0.0.1:${port}/sandbox.html?e2e=1`,{waitUntil:"load",timeout:20000});
    await page.waitForFunction(()=>window.__e2e&&window.__e2e.ready&&document.querySelectorAll("#loadSel option").length>5,{timeout:20000});

    // acha jogadores pelo seletor real
    const opts=await page.$$eval("#loadSel option",os=>os.map(o=>({v:o.value,t:o.textContent})).filter(o=>o.v!==""));
    const pick=nome=>opts.find(o=>o.t.startsWith(nome+" "))?.v;
    // O jogador A precisa ter Role2 DIFERENTE do alvo, senão o calibrador responde "já atingido"
    // e não há o que aplicar. Era o mezii até 28/07/2026; a padronização de funções o deixou em
    // Entry/Support, tornando o alvo trivial. bLitz é IGL/Entry com utilitária 98 — Support é
    // alcançável e não está cumprido. Se este teste voltar a falhar em #calibApply, é esta linha:
    // escolha alguém cujo Role2 atual não seja Support.
    const idxA=pick("bLitz")??opts[0].v, idxB=pick("NiKo")??opts.find(o=>o.v!==idxA).v;

    // ── EDITOR: rascunho por jogador, aplicação explícita, exportação e restauração ──
    const idxKenny=pick("kennyS"),idxNbk=pick("NBK-");
    await page.selectOption("#loadSel",idxKenny);
    await page.click('#modebar button[data-mode="editar"]');
    await page.waitForSelector("#editorApply");
    const originalFp=Number(await page.inputValue("#n_fp")),editedFp=originalFp-9;
    await page.fill("#n_fp",String(editedFp));
    const draftState=await page.evaluate(()=>window.__e2e.editor());
    const editorLayout=await page.evaluate(()=>({
      labels:[...document.querySelectorAll(".field-c label")].map(node=>node.textContent.trim()),
      ranges:[...document.querySelectorAll('.field-c input[type="range"]')].map(node=>node.getBoundingClientRect().width),
      numberBeforeRange:[...document.querySelectorAll(".field-c")].every(row=>row.querySelector(".num")?.compareDocumentPosition(row.querySelector('input[type="range"]'))&window.Node.DOCUMENT_POSITION_FOLLOWING)
    }));
    check(draftState.drafts===1&&draftState.applied.length===0&&draftState.current.applied.fp===originalFp&&draftState.current.draft.fp===editedFp,"editor separa rascunho da versão aplicada");
    check(editorLayout.labels.includes("FIREPOWER")&&editorLayout.labels.includes("RATING DE REFERÊNCIA")&&editorLayout.numberBeforeRange&&editorLayout.ranges.every(width=>width<=521),"editor mostra nomes completos, número antes do slider e trilhos limitados");
    await page.selectOption("#loadSel",idxNbk);
    await page.selectOption("#loadSel",idxKenny);
    check(Number(await page.inputValue("#n_fp"))===editedFp,"rascunho sobrevive à troca de jogador");
    await page.click("#editorApply");
    const appliedKenny=await page.evaluate(()=>window.__e2e.editor());
    check(appliedKenny.drafts===0&&appliedKenny.applied.length===1&&appliedKenny.current.applied.fp===editedFp,"Aplicar preserva a edição de kennyS pelo ID");

    await page.selectOption("#loadSel",idxNbk);
    const originalUt=Number(await page.inputValue("#n_ut")),editedUt=Math.min(100,originalUt+7);
    await page.fill("#n_ut",String(editedUt));
    await page.click("#editorApply");
    const appliedTwo=await page.evaluate(()=>window.__e2e.editor());
    check(appliedTwo.applied.length===2&&appliedTwo.current.applied.ut===editedUt,"aplicações de dois jogadores coexistem na bancada");
    const [jsonDownload]=await Promise.all([page.waitForEvent("download"),page.click("#editorExport")]);
    const exportPayload=JSON.parse(fs.readFileSync(await jsonDownload.path(),"utf8"));
    check(jsonDownload.suggestedFilename()==="sandbox-player-overrides.json"&&exportPayload.schemaVersion===1&&exportPayload.players.length===2&&exportPayload.players.every(player=>player.id&&player.original&&player.edited&&player.changes.length),"JSON exporta IDs, originais, editados e diferenças");

    await page.selectOption("#loadSel",idxKenny);
    await page.click("#editorRestore");
    const restored=await page.evaluate(()=>window.__e2e.editor());
    check(restored.applied.length===1&&restored.current.applied.fp===originalFp,"Restaurar original remove somente a edição do jogador atual");
    await page.selectOption("#loadSel",idxNbk);
    await page.fill("#n_ut",String(Math.max(0,editedUt-3)));
    await page.click("#editorDiscard");
    const discarded=await page.evaluate(()=>window.__e2e.editor());
    check(discarded.drafts===0&&discarded.current.applied.ut===editedUt,"Descartar recupera a última versão aplicada");
    await page.setViewportSize({width:390,height:844});
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),"editor permanece sem overflow no celular");
    await page.setViewportSize({width:1280,height:720});
    await page.click('#modebar button[data-mode="relatorio"]');
    check(/atributos aplicados/i.test(await page.locator("#reportbox").innerText())&&/NBK-/.test(await page.locator("#reportbox").innerText()),"relatório registra atributos aplicados por jogador");
    await page.click("#resetWorkbenchBtn");
    check((await page.evaluate(()=>window.__e2e.editor())).applied.length===0,"Resetar tudo também limpa edições de jogadores");

    // Reabre uma sessão limpa para o contrato histórico do calibrador.
    await page.reload({waitUntil:"load"});
    await page.waitForFunction(()=>window.__e2e&&window.__e2e.ready&&document.querySelectorAll("#loadSel option").length>5,{timeout:20000});

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
