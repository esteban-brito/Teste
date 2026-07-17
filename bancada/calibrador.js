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
  const E=new Function(engineSlice+"\nreturn {avaliarJogador,aplicarAvaliacaoContextual,distribuirRoles,forcaTime,ovrUnificado,rolePairReality,roleStyleReality,CFG_AVALIACAO,ROLE_PERFIL,ROLE_CONTRA,IGL_ROLE_AFIN,ROLE_RULES,STYLE_ROLE_FIT,STYLE_CONTRA,MAPAS_POOL,MAPA_LADO,srand,simularMapa,forcaDoDia,TEAMS,nmOVR,roleAfinidade,secondaryScore,NM_DEF,NM_COR,STYLE_LABEL,PLAYSTYLE_IDS,PLAYSTYLES,NM_AXES,STYLE_KEYS,SUBARQ};")();

  const m=sandboxSrc.match(/<script>([\s\S]*)<\/script>/);
  if(!m)throw new Error("nao encontrei o <script> do sandbox.html");
  let core=m[1];
  const iifeIdx=core.lastIndexOf("(async()=>{");
  if(iifeIdx>=0)core=core.slice(0,iifeIdx);
  core+=`
return {
  setup(engine){
    E=engine; ({nmOVR,STYLE_LABEL,PLAYSTYLE_IDS}=E);
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
  overrideBudget(ms){ Object.values(CALIB_STRATEGIES).forEach(s=>{ if(ms)s.maxMs=ms; }); },
  info(nome){ const p=POOLRAW.find(x=>x.nome===nome); if(!p)throw new Error("nao achei: "+nome);
    const ev=E.avaliarJogador({...p}); return {isIGL:!!ev.isIGL,ovr:Math.round(ev.ovr),style:STYLE_LABEL(ev.playstyle),r1:ev.role1||ev.combatRole,r2:ev.role2||ev.secundario}; },
  findCalibration, renderCalibResult, rolePairParts, deltasFor, scaleChanges, compareCalibration, CALIB_STRATEGIES,
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
  const igl=api.scaleChanges([{type:"igl",from:.5,to:.9}],1.5)[0].to;            // 0.5+0.4*1.5=1.1
  check(cont<=.8+1e-9&&nm>=.01-1e-9&&igl<=1+1e-9,`scaleChanges capa por tipo (stylecontra=${cont}≤.8, nm=${nm}≥.01, igl=${igl}≤1)`);
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
    api.loadByName("b1t"); api.setMode("ia");
    const goal={r1:"Rifler",style:"Trader"};
    let r=null,err=null; try{ r=await api.findCalibration(goal,null); }catch(e){ err=e; }
    const okOrGraceful=!err&&r&&(!r.ok||(api.rolePairParts(r.after).r1==="Rifler"&&api.STYLE_LABEL(r.after.playstyle)==="Trader"));
    check(!!okOrGraceful,`b1t {r1:Rifler+Trader}: não lança e, se ok, fecha função E estilo${err?": "+err.message:r&&r.ok?" (ok)":" (sem solução)"}`);
  }
  // [22] Coringa: não lança; se achar, o estilo é mesmo Coringa (limiar global NM_COR, não receita).
  {
    api.loadByName("KSCERATO"); api.setMode("ia");
    let r=null,err=null; try{ r=await api.findCalibration({style:"Coringa"},null); }catch(e){ err=e; }
    check(!err&&(!r.ok||api.STYLE_LABEL(r.after.playstyle)==="Coringa"),`Coringa não lança e, se ok, vira Coringa${err?": "+err.message:""}`);
  }
  console.log(failures?`✗ ${failures} checagem(ns) do calibrador falharam`:"✓ calibrador ok");
  process.exitCode=failures?1:0;
})();
