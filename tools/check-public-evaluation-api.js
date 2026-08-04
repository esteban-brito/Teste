const assert=require("node:assert/strict"),path=require("node:path"),fs=require("node:fs"),os=require("node:os");
const {execFileSync}=require("node:child_process"),{pathToFileURL}=require("node:url");
const {ROOT}=require("../bancada/lib/common");
const plain=v=>JSON.parse(JSON.stringify(v));
async function main(){
  const A=await import(pathToFileURL(path.join(ROOT,"src/public/evaluation-api.mjs")).href);
  assert.equal(Object.keys(A.POOL).length,85,"POOL público perdeu jogadores");
  assert.equal(A.TEAMS.length,17,"API pública perdeu elencos");
  ["NM_DEF","STYLE_CONTRA","PLAYSTYLE_IDS",
    "ROLE_PERFIL","ROLE_CONTRA","IGL_ROLE_AFIN","ROLE_RULES","CFG_AVALIACAO"].forEach(name=>
    assert.ok(A[name]&&typeof A[name]==="object",`${name} ausente da API pública`));
  ["avaliarJogador","aplicarAvaliacaoContextual","ovrUnificado","nmOVR","distribuirRoles",
    "forcaTime","rolePairReality","roleStyleReality","roleAfinidade","secondaryScore",
    "styleScoreTable","STYLE_LABEL","STYLE_RECIPE"].forEach(name=>assert.equal(typeof A[name],"function",`${name} ausente da API pública`));
  A.TEAMS.forEach(team=>{
    team.jogadores.forEach(card=>{
      assert.equal(card._eng,A.POOL[card._eng.id],`${team.nome}/${card.nick}: _eng perdeu identidade`);
      assert.equal(card.camp,team.camp,`${team.nome}/${card.nick}: campeonato saiu da era do elenco`);
      assert.equal(card.coloc,team.coloc,`${team.nome}/${card.nick}: colocação saiu da era do elenco`);
    });
    if(team.treinador){
      assert.equal(team.treinador.camp,team.camp,`${team.nome}/${team.treinador.nick}: campeonato não chegou à carta`);
      assert.equal(team.treinador.coloc,team.coloc,`${team.nome}/${team.treinador.nick}: colocação não chegou à carta`);
    }
  });
  [...A.PLAYSTYLE_IDS,"joker"].forEach(style=>
    assert.equal(A.styleLabel(style),A.STYLE_LABEL(style),`rótulo público de ${style} divergiu`));
  const novo=A.buildEvaluationState();assert.notEqual(novo.POOL,A.POOL,"rebuild precisa criar estado novo");
  assert.deepEqual(plain(novo),plain({POOL:A.POOL,TEAMS:A.TEAMS}),"rebuild público não é determinístico");
  const base=A.CFG_AVALIACAO.OVR_BASE;
  const antes=A.ATRIBUTOS.map(player=>A.avaliarJogador(player).ovr);
  try{
    A.CFG_AVALIACAO.OVR_BASE=base+4;
    assert.equal(A.CFG_AVALIACAO.OVR_BASE,base+4,"configuração pública não aceita calibração");
    const depois=A.ATRIBUTOS.map(player=>A.avaliarJogador(player).ovr);
    assert.ok(depois.some((ovr,index)=>ovr!==antes[index]),"calibração pública não chegou ao avaliador");
  }finally{A.CFG_AVALIACAO.OVR_BASE=base;}
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),"draft90-report-"));
  try{
    const report=path.join(temp,"report.txt");
    const card=A.TEAMS.flatMap(team=>team.jogadores).find(player=>player._eng.nome==="s1mple");
    assert.ok(card,"jogador de prova do relatório não encontrado");
    const ev=A.avaliarJogador({...card._eng});
    const atual=`${ev.role1||ev.combatRole} / ${ev.role2||ev.secundario} · ${A.STYLE_LABEL(ev.playstyle)} · OVR ${Math.round(ev.ovr)}`;
    fs.writeFileSync(report,[
      `CFG_AVALIACAO.OVR_MIN: 0 -> ${A.CFG_AVALIACAO.OVR_MIN}`,
      `${card._eng.nome} (${card.time})`,
      "Esperado: classificação pública atual",
      `Atual: ${atual}`,
      ""
    ].join("\n"),"utf8");
    execFileSync(process.execPath,[path.join(ROOT,"tools","verify-report.js"),report],{stdio:"pipe"});
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
  console.log("public evaluation API: ok (85 jogadores · 17 times · identidade conferida)");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
