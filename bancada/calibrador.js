/* bancada/calibrador.js - suíte funcional rápida do calibrador real. */
const fs=require("fs");
const path=require("path");
const {ROOT,okMark}=require("./common");
const {loadCalibrator}=require("./calibrador-loader");
const SANDBOX_PATH=path.join(ROOT,"sandbox.html");

let failures=0;
function check(ok,label){
  console.log(`  ${okMark(ok)} ${label}`);
  if(!ok)failures++;
}

console.log("— CALIBRADOR INTELIGENTE (sandbox.html) —");
(async()=>{
const api=await loadCalibrator();

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


// Reforma estrutural do drop: default global, sem pin individual.
{
  const info=api.info("drop");
  // R2 do drop é curado no sandbox (hoje Support); a reforma trava R1=Rifler + Facilitador + OVR14.
  check(info.r1==="Rifler"&&info.style==="Facilitador"&&info.ovr===14,
    `drop default = Rifler · Facilitador · 14 (${info.r1}/${info.r2} · ${info.style} · ${info.ovr})`);
}
// Colateral MATERIAL e margem latente não podem ser misturados nem receber punição dupla.
{
  const target={key:"0:0",roleChanged:true,styleChanged:true,dOvr:1,rareWorsened:false,materialChanged:true,marginDamage:0};
  const steel={key:"1:0",roleChanged:true,styleChanged:false,dOvr:0,rareWorsened:false,materialChanged:true,marginDamage:.02};
  const soft=Array.from({length:10},(_,i)=>({key:`2:${i}`,roleChanged:false,styleChanged:false,dOvr:0,rareWorsened:false,materialChanged:false,softAffected:true,marginDamage:.01,dReality:0}));
  const diff={players:[target,steel,...soft],teams:[]},sum=api.summarizeDiff(diff,"0:0"),metrics=api.calibrationMetrics([],diff,"0:0");
  check(sum.collateralPlayers===1&&sum.collateralSoftPlayers===10&&sum.players===2,
    `colateral separa 1 mudança real de 10 margens (${sum.collateralPlayers}/${sum.collateralSoftPlayers})`);
  check(metrics.changed===2&&metrics.marginDamage>.1,"custo conta 2 mudanças materiais e preserva dano de margem separado");
}

// Workers: protocolo cooperativo de partição/cancelamento deve estar presente no artefato real.
{
  const workerSrc=fs.readFileSync(path.join(ROOT,"calibrador-worker.js"),"utf8");
  const sandboxSrc=fs.readFileSync(SANDBOX_PATH,"utf8");
  check(workerSrc.includes('job.type==="cancel"'),"worker aceita cancelamento cooperativo");
  check(workerSrc.includes("partitionIndex")&&sandboxSrc.includes("partitionCount:workers.length"),"workers recebem partições distintas do espaço de busca");
}
// bateria ponta-a-ponta: nunca lanca excecao; quando ok=true, o resultado bate o goal de
// verdade (revalidado contra rolePairParts/STYLE_LABEL, nao so confiando no proprio "ok").
const CASOS=[
  {nome:"yuurih",mode:"ia",goal:{r1:"",r2:"",style:"Ancora"}},
  {nome:"Boombl4",mode:"ia",goal:{r1:"",r2:"Rifler",style:""}}, // R2 curado do Boombl4 já é Entry → alvo Rifler pra a busca fazer trabalho real (separação material×margem)
  {nome:"karrigan",mode:"realista",goal:{r1:"IGL",r2:"Entry",style:""}},
  {nome:"NiKo",mode:"realista",goal:{r1:"",r2:"",style:"Cerebral"}},
];
const budgetMs=+(process.env.CALIB_MS||1500);
api.overrideBudget(budgetMs);

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
      let renderErr=null,rendered="";
      try{ rendered=api.renderCalibResult(result,caso.goal); }
      catch(e){ renderErr=e; }
      check(!renderErr,`${caso.nome} [${caso.mode}] renderCalibResult nao lanca excecao${renderErr?": "+renderErr.message:""}`);
      if(caso.nome==="Boombl4"&&result.diff){ // result.diff só falta em alreadyMet — guarda contra curadoria futura
        const sum=api.summarizeDiff(result.diff,result.targetKey);
        const material=sum.collateralPlayers,soft=sum.collateralSoftPlayers,inflado=material+soft;
        // O nº EXATO de material/margens depende da solução que a busca acha (varia por timing). Validamos
        // o PRINCÍPIO, não a solução: há margens latentes (soft>0), contadas SEPARADAS do material
        // (minoria), e a UI NÃO as infla no total de "jogadores que mudam junto" — o bug do print do Boombl4.
        check(soft>0&&material<=soft,`Boombl4→Rifler separa material de margens (${material}/${soft})`);
        const reSoft=new RegExp(`${soft} ${soft===1?"margem interna afetada":"margens internas afetadas"}`);
        const reInflado=new RegExp(`${inflado} jogadores mudam junto`);
        check(reSoft.test(rendered)&&!reInflado.test(rendered),
          `UI mostra ${soft} margens à parte, sem inflar material pra ${inflado}`);
      }
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
  // Alavancas semânticas: partindo do modelo legado (glue desligado), a IA recupera o perfil
  // Rifler/Entry + Facilitador 14 do drop com somente os knobs contextuais e zero colateral material.
  {
    api.resetAll();api.loadByName("drop");api.setMode("ia");
    api.applyChanges([
      {type:"cfg",key:"RIFLER_GLUE_MAX",from:7,to:0},
      {type:"cfg",key:"FAC_GLUE_MAX",from:.35,to:0}
    ]);
    const legacy=api.getCurrent();
    api.overrideBudget(Math.max(2500,budgetMs));
    // R2 do drop é curado (não travamos). O que importa: com glue off o drop NÃO é o Facilitador
    // reformado, e a IA recupera Rifler·Facilitador·14 só com os knobs contextuais.
    let r=null,err=null;try{r=await api.findCalibration({r1:"Rifler",style:"Facilitador",ovr:14},null,{firstValid:true,skipBeam:true,skipCombined:true});}catch(e){err=e;}
    api.overrideBudget(budgetMs);
    const parts=r&&r.after?api.rolePairParts(r.after):{};
    const ci=r?.costInfo||{};
    check(legacy.style!=="Facilitador"&&!err&&r&&r.ok&&parts.r1==="Rifler"&&api.STYLE_LABEL(r.after.playstyle)==="Facilitador"&&Math.round(r.after.ovr)===14,
      `IA semântica recupera drop Rifler · Facilitador · 14${err?": "+err.message:""}`);
    check((ci.collateralRoleChanges||0)===0&&(ci.collateralStyleChanges||0)===0&&(ci.collateralOvrShifts||0)===0,
      `reforma semântica do drop tem zero colateral material (${ci.collateralRoleChanges||0}/${ci.collateralStyleChanges||0}/${ci.collateralOvrShifts||0})`);
    api.resetAll();
  }
  // Qualidade separada da identidade: subir o drop para 15 usa knobs do Facilitador, não OVR_BASE global.
  {
    api.resetAll();api.loadByName("drop");api.setMode("ia");api.overrideBudget(Math.max(4000,budgetMs));
    let r=null,err=null;try{r=await api.findCalibration({style:"Facilitador",ovr:15},null);}catch(e){err=e;}
    api.overrideBudget(budgetMs);
    const globalOvr=(r?.changes||[]).some(c=>c.type==="ovrparam");
    check(!err&&r?.ok&&api.STYLE_LABEL(r.after.playstyle)==="Facilitador"&&Math.round(r.after.ovr)===15&&!globalOvr,
      `drop OVR 15 preserva identidade e evita parâmetro global${err?": "+err.message:""}`);
    check((r?.costInfo?.collateralOvrShifts||0)<=5,
      `OVR do Facilitador usa ajuste local de baixo colateral (${r?.costInfo?.collateralOvrShifts||0})`);
    api.resetAll();
  }
  // REGRESSÃO (auditoria P0): secondaryScore(primary,secondary,p,scores) lê scores[secondary];
  // goalDistance/goalRobustness chamavam sem o mapa → crash em alvo de Role2 de NÃO-IGL. A bateria
  // só cobria Role2 de IGL (Boombl4/karrigan, primary=null → usa roleAfinidade), então passava
  // batido. Aqui: um não-IGL contra CADA função como Role2 — nenhuma pode lançar exceção.
  {
    api.overrideBudget(300);
    let threw=null;
    for(const r2 of ["AWPer","Rifler","Entry","Lurker","Support"]){
      api.resetAll();api.loadByName("NiKo");api.setMode("realista");
      try{ await api.findCalibration({r2},null); }catch(e){ threw=`${r2} → ${e.message}`; break; }
    }
    api.overrideBudget(budgetMs);
    check(!threw,`Role2 de não-IGL nunca lança (crash de secondaryScore)${threw?": "+threw:""}`);
  }
  // CAPACIDADE (não só segurança): a IA precisa FECHAR de fato um Role2 de não-IGL. mezii→Support
  // é alcançável no orçamento representativo (medido); revalida o r2 final contra o alvo.
  {
    api.resetAll();api.loadByName("mezii");api.setMode("ia");api.overrideBudget(Math.max(6000,budgetMs));
    let r=null,err=null; try{ r=await api.findCalibration({r2:"Support"},null); }catch(e){ err=e; }
    api.overrideBudget(budgetMs);
    const ok=!err&&r&&r.ok&&api.rolePairParts(r.after).r2==="Support";
    check(!!ok,`mezii {r2:Support}: IA FECHA Role2 de não-IGL${err?": "+err.message:r&&r.ok?" ("+api.rolePairParts(r.after).r2+")":" (sem solução)"}`);
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
  console.log(failures?`✗ ${failures} checagem(ns) do calibrador falharam`:"✓ calibrador ok");
  process.exitCode=failures?1:0;
})().catch(error=>{console.error(error);process.exitCode=1;});
