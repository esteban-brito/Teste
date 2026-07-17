/* bancada/calibrador.js - valida o Calibrador Inteligente (sandbox.html) contra o motor real.
   Carrega game.js + o <script> de sandbox.html do mesmo jeito que o navegador faria
   (fetch->new Function na pagina; aqui, leitura de arquivo->new Function), sem duplicar
   nenhuma logica - mesma tecnica usada por calibrator-worker.js.
   Cobre 2 regressoes ja corrigidas (deltasFor vazando teto, compareCalibration ignorando
   custo ponderado) e roda uma bateria pequena de buscas ponta-a-ponta pra garantir que
   nunca lanca excecao e que "ok=true" bate o objetivo de verdade.
   Uso: node bancada/calibrador.js
        CALIB_MS=9000 node bancada/calibrador.js   (busca "de verdade", bem mais lenta)
*/
const fs=require("fs");
const path=require("path");
const {ROOT,okMark}=require("./common");

const GAME_PATH=path.join(ROOT,"game.js");
const SANDBOX_PATH=path.join(ROOT,"sandbox.html");

function loadCalibrator(){
  const gameSrc=fs.readFileSync(GAME_PATH,"utf8");
  const sandboxSrc=fs.readFileSync(SANDBOX_PATH,"utf8");
  const linhas=gameSrc.split("\n");
  let cut=linhas.findIndex(l=>l.includes("// === UI START ==="));
  if(cut<0)cut=linhas.findIndex(l=>l.includes("document.getElementById"));
  if(cut<0)throw new Error("marcador de UI nao encontrado em game.js");
  const engineSlice=linhas.slice(0,cut).join("\n");
  const E=new Function(engineSlice+"\nreturn {avaliarJogador,aplicarAvaliacaoContextual,distribuirRoles,forcaTime,ovrUnificado,rolePairReality,roleStyleReality,CFG_AVALIACAO,ROLE_PERFIL,ROLE_CONTRA,IGL_ROLE_AFIN,ROLE_RULES,STYLE_ROLE_FIT,STYLE_CONTRA,MAPAS_POOL,MAPA_LADO,srand,simularMapa,forcaDoDia,TEAMS,nmOVR,styleScoreTable,roleAfinidade,secondaryScore,NM_DEF,NM_COR,STYLE_LABEL,PLAYSTYLE_IDS,PLAYSTYLES,NM_AXES,STYLE_KEYS,SUBARQ};")();

  const m=sandboxSrc.match(/<script>([\s\S]*)<\/script>/);
  if(!m)throw new Error("nao encontrei o <script> do sandbox.html");
  let core=m[1];
  const iifeIdx=core.lastIndexOf("(async()=>{");
  if(iifeIdx>=0)core=core.slice(0,iifeIdx);
  core+=`
return {
  setup(engine){
    E=engine; DEF={ROLE:clone(E.ROLE_PERFIL),NM:clone(E.NM_DEF),NM_COR:clone(E.NM_COR),CONTRA:clone(E.ROLE_CONTRA),IGL:clone(E.IGL_ROLE_AFIN),RULES:clone(E.ROLE_RULES),STYLE_FIT:clone(E.STYLE_ROLE_FIT),STYLE_CONTRA:clone(E.STYLE_CONTRA),CFG:clone(E.CFG_AVALIACAO)};
    ({nmOVR,STYLE_LABEL,PLAYSTYLE_IDS}=E);
    POOLRAW=[]; poolBySlot=new Map();
    E.TEAMS.forEach((t,ti)=>t.jogadores.forEach((j,pi)=>{const e=j._eng;
      const idx=POOLRAW.length;
      poolBySlot.set(\`\${ti}:\${pi}\`,idx);
      POOLRAW.push({...e,time:t.nome,ti,pi,isIGL:!!e.isIGL,colocacao:e.colocacao||"Campeao"});
    }));
  },
  loadByName(nome){
    loadedIdx=POOLRAW.findIndex(p=>p.nome===nome);
    if(loadedIdx<0)throw new Error("jogador nao encontrado no pool: "+nome);
    const p=POOLRAW[loadedIdx];
    Object.assign(state,{nome:p.nome,fp:p.fp,en:p.en,tr:p.tr,op:p.op,cl:p.cl,sn:p.sn,ut:p.ut,rating:p.rating,isIGL:p.isIGL,colocacao:p.colocacao});
  },
  setMode(mode){ calibMode=mode; },
  setSeed(seed){ searchSeedSalt=seed||0; },
  setStats(values){ Object.assign(state,values||{}); },
  overrideBudget(ms){ Object.values(CALIB_STRATEGIES).forEach(s=>{ if(ms)s.maxMs=ms; }); },
  info(nome){ const p=POOLRAW.find(x=>x.nome===nome); if(!p)throw new Error("nao achei: "+nome);
    const ev=E.avaliarJogador({...p}); return {isIGL:!!ev.isIGL,ovr:Math.round(ev.ovr),style:STYLE_LABEL(ev.playstyle),r1:ev.role1||ev.combatRole,r2:ev.role2||ev.secundario}; },
  findCalibration, reformulateStyleFromArchetype, renderCalibResult, rolePairParts, deltasFor, scaleChanges, compareCalibration, CALIB_STRATEGIES,
  getCurrent(){return mainPlayer();},
  ratingWeight(style){return E.NM_DEF[style]?.ratingWeight;},
  withChanges(changes,fn){const snap=configSnapshot();try{applyCalibChanges(changes);return fn(mainPlayer());}finally{restoreConfig(snap);}},
  applyResult(result){applyCalibChanges(result.changes||[]);registerCalibrationApplication(result);invalidateAllTeamEval();},
  regressions(){return sessionRegressions();},
  resetAll(){
    copyInto(E.ROLE_PERFIL,DEF.ROLE);copyInto(E.NM_DEF,DEF.NM);copyInto(E.NM_COR,DEF.NM_COR);
    copyInto(E.ROLE_CONTRA,DEF.CONTRA);copyInto(E.IGL_ROLE_AFIN,DEF.IGL);copyInto(E.ROLE_RULES,DEF.RULES);
    copyInto(E.STYLE_ROLE_FIT,DEF.STYLE_FIT);copyInto(E.STYLE_CONTRA,DEF.STYLE_CONTRA);copyInto(E.CFG_AVALIACAO,DEF.CFG);
    baseline=null;calibSession=null;calibLast=null;invalidateAllTeamEval();
  },
  get STYLE_LABEL(){ return STYLE_LABEL; }
};
`;
  const fakeDocument={getElementById:()=>null,createElement:()=>({}),querySelectorAll:()=>[]};
  const build=new Function("document","navigator","performance",core);
  const api=build(fakeDocument,{},performance);
  api.setup(E);
  return api;
}

let failures=0;
function check(ok,label){
  console.log(`  ${okMark(ok)} ${label}`);
  if(!ok)failures++;
}

console.log("— CALIBRADOR INTELIGENTE (sandbox.html) —");
const api=loadCalibrator();

// achado #1 (corrigido): deltasFor nao pode devolver deltas acima do teto pedido.
{
  const over=api.deltasFor(0.12).filter(d=>d>0.12+1e-9);
  check(over.length===0,`deltasFor(0.12) respeita o teto (vazou: ${over.join(",")||"nenhum"})`);
}

// achado #4 (corrigido): compareCalibration decide por custo total primeiro; prioridade so
// desempata quando os custos estao quase empatados. Antes, 1 colateral a mais bastava pra
// perder mesmo com custo 4x menor.
{
  const strategy=api.CALIB_STRATEGIES.ia;
  const pior={cost:50,costInfo:{collateralRoleChanges:0,teamChanges:5,rareWorsened:3,realityPenalty:2,ovrImpact:10,styleChanges:1,deltaCost:8,changed:6}};
  const melhor={cost:12,costInfo:{collateralRoleChanges:1,teamChanges:0,rareWorsened:0,realityPenalty:0,ovrImpact:1,styleChanges:0,deltaCost:1,changed:1}};
  const melhorVence=api.compareCalibration(pior,melhor,strategy)>0;
  check(melhorVence,"compareCalibration escolhe o custo total menor mesmo com 1 colateral a mais");
}

// [22/clamps] scaleChanges reaplica os limites por tipo mesmo em fator>1 (extrapolação): não
// deixa peso negativo, contra>0.8, igl fora de [-1,1]. Antes escapava e gerava config inválida.
{
  const cont=api.scaleChanges([{type:"stylecontra",from:.5,to:.75}],1.5)[0].to; // 0.5+0.25*1.5=0.875
  const nm=api.scaleChanges([{type:"nm",from:.2,to:.05}],1.5)[0].to;             // 0.2-0.15*1.5=-0.025
  const igl=api.scaleChanges([{type:"igl",from:.5,to:.9}],1.5)[0].to;
  const lean=api.scaleChanges([{type:"cfg",key:"AWP_LEAN",from:.2,to:.4}],2)[0].to;
  const rating=api.scaleChanges([{type:"rating",style:"Closer",from:1,to:1.8}],2)[0].to;
  check(cont<=.8+1e-9&&nm>=.01-1e-9&&igl<=1+1e-9&&lean<=.4+1e-9&&rating<=2+1e-9,`scaleChanges capa por tipo (contra=${cont}, nm=${nm}, igl=${igl}, lean=${lean}, rating=${rating})`);
}


// Workers: protocolo cooperativo de partição/cancelamento deve estar presente no artefato real.
{
  const workerSrc=fs.readFileSync(path.join(ROOT,"calibrator-worker.js"),"utf8");
  const sandboxSrc=fs.readFileSync(SANDBOX_PATH,"utf8");
  check(workerSrc.includes('job.type==="cancel"'),"worker aceita cancelamento cooperativo");
  check(workerSrc.includes("partitionIndex")&&sandboxSrc.includes("partitionCount:workers.length"),"workers recebem partições distintas do espaço de busca");
}
// bateria ponta-a-ponta: nunca lanca excecao; quando ok=true, o resultado bate o goal de
// verdade (revalidado contra rolePairParts/STYLE_LABEL, nao so confiando no proprio "ok").
const CASOS=[
  {nome:"yuurih",mode:"ia",goal:{r1:"",r2:"",style:"Ancora"}},
  {nome:"Boombl4",mode:"ia",goal:{r1:"",r2:"Entry",style:""}},
  {nome:"karrigan",mode:"realista",goal:{r1:"IGL",r2:"Entry",style:""}},
  {nome:"NiKo",mode:"realista",goal:{r1:"",r2:"",style:"Cerebral"}},
];
const budgetMs=+(process.env.CALIB_MS||1500);
api.overrideBudget(budgetMs);

(async()=>{
  for(const caso of CASOS){
    api.loadByName(caso.nome);
    api.setMode(caso.mode);
    let result=null,err=null;
    try{ result=await api.findCalibration(caso.goal,null); }
    catch(e){ err=e; }
    check(!err,`${caso.nome} [${caso.mode}] nao lanca excecao${err?": "+err.message:""}`);
    // [27] modo IA DEVE achar solução (é a busca "acha qualquer coisa"); realista pode recusar
    // legitimamente um alvo implausível (é conservador de propósito), então não exigimos ok nele.
    if(caso.mode==="ia")check(!err&&result&&result.ok,`${caso.nome} [ia] a IA ACHOU solucao (nao devolveu ok:false)`);
    if(!err&&result.ok){
      const parts=api.rolePairParts(result.after);
      const styleLabel=api.STYLE_LABEL(result.after.playstyle);
      const bateR1=!caso.goal.r1||parts.r1===caso.goal.r1;
      const bateR2=!caso.goal.r2||parts.r2===caso.goal.r2;
      const bateStyle=!caso.goal.style||styleLabel===caso.goal.style;
      check(bateR1&&bateR2&&bateStyle,`${caso.nome} [${caso.mode}] ok=true realmente bate o objetivo`);
      let renderErr=null;
      try{ api.renderCalibResult(result,caso.goal); }
      catch(e){ renderErr=e; }
      check(!renderErr,`${caso.nome} [${caso.mode}] renderCalibResult nao lanca excecao${renderErr?": "+renderErr.message:""}`);
    }
  }
  // [22] alvos DETERMINISTICAMENTE impossíveis: falham rápido com mensagem clara (a IA só mexe em pesos).
  const feas=async(nome,goal)=>{ api.loadByName(nome); api.setMode("ia");
    try{ return await api.findCalibration(goal,null); }catch(e){ return {threw:e}; } };
  {
    const igl=await feas("karrigan",{ovr:22}); // teto do IGL é 21
    check(!igl.threw&&igl.infeasible&&/21/.test(igl.message||""),`IGL ovr22 → impossível ("${String(igl.message||igl.threw||"").slice(0,45)}")`);
    let iglHtml; try{ iglHtml=api.renderCalibResult(igl,{ovr:22}); }catch(e){ iglHtml="ERRO:"+e.message; }
    check(/Impossível/.test(iglHtml)&&/21/.test(iglHtml),"a mensagem de impossível RENDERIZA (não cai no genérico)");
    const rr=await feas("ZywOo",{r1:"Entry",r2:"Entry"});
    check(!rr.threw&&!!rr.infeasible,"Role1==Role2 → impossível");
    const bt=await feas("ZywOo",{style:"Baiter"});
    check(!bt.threw&&!!bt.infeasible,"estilo Baiter → impossível (é definido por stats)");
  }
  // [22] alvo de OVR: a IA acha e o OVR EXIBIDO bate o alvo.
  {
    const inf=api.info("mezii"), alvo=Math.min(21,inf.ovr+1);
    api.loadByName("mezii"); api.setMode("ia");
    const r=await api.findCalibration({ovr:alvo},null);
    check(!!(r&&r.ok&&Math.round(r.after.ovr)===alvo),`mezii ovr ${inf.ovr}→${alvo}: ok e OVR bate (${r&&r.ok?Math.round(r.after.ovr):r&&r.message})`);
  }
  // [22] alvo já atingido: retorno imediato, sem sugerir mudança.
  {
    const inf=api.info("yuurih"); api.loadByName("yuurih"); api.setMode("ia");
    const r=await api.findCalibration({style:inf.style},null);
    check(!!(r&&r.alreadyMet&&(!r.changes||!r.changes.length)),`yuurih já é ${inf.style} → alreadyMet sem mudanças`);
  }
  // [22] objetivo COMBINADO {estilo(segura)+OVR}: fecha as DUAS dimensões juntas.
  {
    const inf=api.info("electroNic"), alvo=Math.min(21,inf.ovr+1);
    api.loadByName("electroNic"); api.setMode("ia");
    const r=await api.findCalibration({style:inf.style,ovr:alvo},null);
    const ok=r&&r.ok&&api.STYLE_LABEL(r.after.playstyle)===inf.style&&Math.round(r.after.ovr)===alvo;
    check(!!ok,`electroNic {${inf.style}+ovr${alvo}}: fecha estilo E ovr (${r&&r.ok?api.STYLE_LABEL(r.after.playstyle)+"/"+Math.round(r.after.ovr):r&&r.message})`);
  }
  // objetivo estrutural de 2 dimensões (função + estilo): não lança e, se ok, fecha AS DUAS
  // (guarda de regressão pra objetivo combinado — nunca devolve ok com só uma dimensão batida).
  {
    // mesmo caso pesado (AWPer→função+estilo): a 1500ms o resultado é loteria de seed, então
    // roda no orçamento representativo (ver nota no bloco de estabilidade abaixo). O que se
    // verifica aqui é a GUARDA: se devolver ok, as DUAS dimensões batem de verdade.
    api.loadByName("b1t"); api.setMode("ia"); api.overrideBudget(Math.max(6000,budgetMs));
    const goal={r1:"Rifler",style:"Trader"};
    let r=null,err=null; try{ r=await api.findCalibration(goal,null); }catch(e){ err=e; }
    api.overrideBudget(budgetMs);
    const ok=!err&&r&&r.ok&&api.rolePairParts(r.after).r1==="Rifler"&&api.STYLE_LABEL(r.after.playstyle)==="Trader";
    check(!!ok,`b1t {r1:Rifler+Trader}: IA FECHA função E estilo${err?": "+err.message:r&&r.ok?" (ok)":" (sem solução)"}`);
  }
  // [22] Coringa: não lança; se achar, o estilo é mesmo Coringa (limiar global NM_COR, não receita).
  {
    api.loadByName("KSCERATO"); api.setMode("ia");
    let r=null,err=null; try{ r=await api.findCalibration({style:"Coringa"},null); }catch(e){ err=e; }
    check(!err&&(!r.ok||api.STYLE_LABEL(r.after.playstyle)==="Coringa"),`Coringa não lança e, se ok, vira Coringa${err?": "+err.message:""}`);
  }
  // Coringa atual consegue sair do hard gate por NM_COR e assumir um estilo normal.
  {
    api.resetAll();api.loadByName("Skadoodle");api.setMode("ia");
    const before=api.getCurrent();
    let r=null,err=null;try{r=await api.findCalibration({style:"Playmaker"},null);}catch(e){err=e;}
    check(api.STYLE_LABEL(before.playstyle)==="Coringa"&&!err&&r&&r.ok&&api.STYLE_LABEL(r.after.playstyle)==="Playmaker",`Skadoodle Coringa → Playmaker destrava o gate sem curadoria${err?": "+err.message:r&&r.message?": "+r.message:""}`);
  }
  // Baiter já existente pode manter a identidade e calibrar OVR; só CRIAR Baiter é impossível.
  {
    api.resetAll();api.loadByName("Skadoodle");api.setMode("ia");
    api.setStats({nome:"Baiter sintético",fp:40,en:35,tr:42,op:38,cl:55,sn:44,ut:36,rating:1,isIGL:false});
    const before=api.getCurrent(),target=Math.min(21,Math.round(before.ovr)+1);
    let r=null,err=null;try{r=await api.findCalibration({style:"Baiter",ovr:target},null);}catch(e){err=e;}
    check(api.STYLE_LABEL(before.playstyle)==="Baiter"&&!err&&r&&!r.infeasible&&r.ok&&api.STYLE_LABEL(r.after.playstyle)==="Baiter"&&Math.round(r.after.ovr)===target,`Baiter atual mantém estilo e muda OVR ${Math.round(before.ovr)}→${target}${err?": "+err.message:r&&r.message?": "+r.message:""}`);
    api.resetAll();
  }
  // Intenções aplicadas viram restrições rígidas para calibrações seguintes.
  {
    api.resetAll();api.setMode("ia");
    api.loadByName("mezii");const base=api.getCurrent(),target=Math.min(21,Math.round(base.ovr)+1);
    const first=await api.findCalibration({ovr:target},null);if(first?.ok)api.applyResult(first);
    api.loadByName("Boombl4");const second=await api.findCalibration({r2:"Entry"},null);if(second?.ok)api.applyResult(second);
    api.loadByName("mezii");const kept=Math.round(api.getCurrent().ovr)===target;
    check(!!(first?.ok&&second?.ok&&kept&&api.regressions().length===0),`intenção anterior de OVR é preservada após calibrar outro jogador (OVR ${target})`);
    api.resetAll();
  }

  // ratingWeight é funcional no OVR, mas não muda a identidade do playstyle.
  {
    api.loadByName("NiKo");const before=api.getCurrent(),style=api.STYLE_LABEL(before.playstyle),rw=api.ratingWeight(style);
    const after=api.withChanges([{type:"rating",style,from:rw,to:Math.min(2,rw+.5)}],p=>p);
    check(api.STYLE_LABEL(after.playstyle)===style&&after.style.ratingWeight>rw,`ratingWeight de ${style} altera nível sem trocar identidade`);
  }
  // estabilidade entre seeds: a capacidade não pode depender de uma única rolagem feliz.
  // Este é o caso multiobjetivo mais PESADO (AWPer trocando função E estilo ao mesmo tempo).
  // O default do bench (1500ms) é ~5% do orçamento real da IA (maxMs=28000): nesse tempo a
  // busca mal começa e o resultado vira loteria de seed. Aqui medimos o que o rótulo diz —
  // ESTABILIDADE ENTRE SEEDS — num orçamento representativo do produto. A asserção segue
  // estrita: os 3 seeds precisam fechar Rifler+Trader de fato.
  {
    const stabilityMs=Math.max(6000,budgetMs);
    api.overrideBudget(stabilityMs);
    const runs=[];
    for(const seed of [17,7919,15838]){api.resetAll();api.loadByName("b1t");api.setMode("ia");api.setSeed(seed);runs.push(await api.findCalibration({r1:"Rifler",style:"Trader"},null));}
    api.overrideBudget(budgetMs);
    const all=runs.every(r=>r&&r.ok&&api.rolePairParts(r.after).r1==="Rifler"&&api.STYLE_LABEL(r.after.playstyle)==="Trader");
    check(all,`multiobjetivo permanece solucionável em 3 seeds (${runs.map(r=>r?.ok?"ok":"falha").join(", ")})`);
    api.setSeed(0);api.resetAll();
  }
  // modo arquétipo: Jame ensina a definição global de Closer; exige solução e estabilidade sintética.
  {
    api.loadByName("Jame");api.setMode("ia");
    let r=null,err=null;try{r=await api.reformulateStyleFromArchetype("Closer",{},null);}catch(e){err=e;}
    check(!err&&r&&r.ok&&api.STYLE_LABEL(r.after.playstyle)==="Closer",`Jame como arquétipo reaprende Closer${err?": "+err.message:r&&r.message?": "+r.message:""}`);
    if(r&&r.ok){
      check((r.archetypeInfo?.synthetic||0)>=.5&&r.archetypeInfo?.lost<=3,`arquétipo valida holdout sintético e preserva Closers (synth ${Math.round((r.archetypeInfo?.synthetic||0)*100)}%, perdidos ${r.archetypeInfo?.lost})`);
      const recipe=r.archetypeInfo?.afterRecipe||{},sum=Object.values(recipe).reduce((a,b)=>a+b,0);
      const noPin=(r.changes||[]).every(c=>["nm","stylecontra","cfg","rating","ovrparam"].includes(c.type));
      check(Math.abs(sum-1)<1e-3&&noPin,`arquétipo produz receita normalizada (Σ=${sum.toFixed(3)}) e zero pin individual`);
    }
  }
  console.log(failures?`✗ ${failures} checagem(ns) do calibrador falharam`:"✓ calibrador ok");
  process.exitCode=failures?1:0;
})();
