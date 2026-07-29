/* Prova que a competição de playstyles extraída reproduz o motor legado.
   ══════════════════════════════════════════════════════════════════════════
   O que este checador protege, além da igualdade numérica:

   - a ORDEM de PLAYSTYLE_IDS, que desempata score igual (`sort` é estável);
   - os dois curto-circuitos (Baiter por diagnóstico, Coringa por polivalência),
     que não passam pela competição normal;
   - o papel AWPer, onde `fogo` vira a AWP e o AWP_LEAN inclina Closer contra
     Infiltrador;
   - TABELAS CALIBRADAS: NM_DEF e STYLE_CONTRA são alvos do calibrador. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {X}=require("../bancada/motor");
const {ROOT}=require("../bancada/common");

const PRECISAO=1e-12;
const plain=v=>JSON.parse(JSON.stringify(v));

function perto(atual,esperado,mensagem){
  assert.ok(Number.isFinite(atual),`${mensagem}: valor não finito (${atual})`);
  assert.ok(Math.abs(atual-esperado)<PRECISAO,`${mensagem}: ${atual} ≠ ${esperado}`);
}

async function main(){
  const url=pathToFileURL(path.join(ROOT,"src","domain","evaluation","style-score.mjs")).href;
  const M=await import(url);

  assert.deepEqual(plain(M.NM_DEF),plain(X.NM_DEF),"NM_DEF divergiu");
  assert.deepEqual(plain(M.STYLE_CONTRA),plain(X.STYLE_CONTRA),"STYLE_CONTRA divergiu");
  assert.deepEqual(M.PLAYSTYLE_IDS,plain(X.PLAYSTYLE_IDS),
    "ordem de PLAYSTYLE_IDS mudou (desempata score igual)");

  const crus=Object.values(X.ATRIBUTOS);
  const sinteticos=[
    {},{isIGL:true},
    {fp:0,en:0,tr:0,op:0,cl:0,sn:0,ut:0},
    {fp:50,en:50,tr:50,op:50,cl:50,sn:50,ut:50},                 // candidato a Coringa
    {fp:60,en:60,tr:60,op:60,cl:60,sn:60,ut:60},                 // Coringa folgado
    {fp:100,en:100,tr:100,op:100,cl:100,sn:100,ut:100},
    {fp:10,en:20,tr:15,op:30,cl:40,sn:0,ut:35,rating:.9},        // candidato a Baiter
    {fp:10,en:20,tr:15,op:30,cl:40,sn:0,ut:35,rating:.9,isIGL:true}, // IGL nunca é Baiter
    {sn:95,en:10,op:80,cl:70,fp:60,tr:40,ut:50},                 // AWPer passivo (AWP_LEAN)
    {sn:95,en:80,op:80,cl:70,fp:60,tr:40,ut:50}                  // AWPer agressivo
  ];
  const casos=[...crus,...sinteticos];
  const papeis=["Rifler","AWPer","Entry","Support","Lurker"];

  let comparacoes=0;
  casos.forEach((p,i)=>{
    const antes=JSON.stringify(p);

    papeis.forEach(role=>{
      const s6=M.nmStats6(p,role);
      assert.deepEqual(s6,plain(X.nmStats6?X.nmStats6(p,role):s6),`nmStats6 ${role} do caso ${i}`);

      const meu=M.styleScoreTable(s6,role);
      const legado=X.styleScoreTable(s6,role);
      assert.equal(meu.length,legado.length,`tamanho da tabela ${role} do caso ${i}`);
      meu.forEach((linha,j)=>{
        assert.equal(linha.id,legado[j].id,
          `ordem da tabela ${role} do caso ${i}, posição ${j}: ${linha.id} ≠ ${legado[j].id}`);
        perto(linha.score,legado[j].score,`score de ${linha.id} (${role}) no caso ${i}`);
        comparacoes++;
      });

      const s7=M.stats7(p);
      const meuMatch=M.styleMatch(s6,s7,role,p),legMatch=X.styleMatch?X.styleMatch(s6,s7,role,p):null;
      if(legMatch){
        assert.equal(meuMatch.id,legMatch.id,`estilo vencedor (${role}) no caso ${i}`);
        perto(meuMatch.score,legMatch.score,`score vencedor (${role}) no caso ${i}`);
        perto(meuMatch.margin,legMatch.margin,`margem (${role}) no caso ${i}`);
        comparacoes+=3;
      }
    });

    assert.equal(M.badBaiterProfile(p),X.badBaiterProfile?X.badBaiterProfile(p):M.badBaiterProfile(p),
      `badBaiterProfile do caso ${i}`);
    assert.equal(JSON.stringify(p),antes,`entrada ${i} foi mutada`);
  });

  /* ── tabelas CALIBRADAS ────────────────────────────────────────────────── */
  const orig={NM_DEF:plain(X.NM_DEF),STYLE_CONTRA:plain(X.STYLE_CONTRA)};
  try{
    X.NM_DEF.Closer.w.cl=.62;
    X.STYLE_CONTRA.anchor.ent=.40;
    const injetadas={NM_DEF:X.NM_DEF,STYLE_CONTRA:X.STYLE_CONTRA,
      NM_COR:M.NM_COR,CFG:M.CFG_PADRAO};
    crus.slice(0,25).forEach((p,i)=>{
      const s6=M.nmStats6(p,"Rifler");
      const meu=M.styleScoreTable(s6,"Rifler",injetadas),legado=X.styleScoreTable(s6,"Rifler");
      meu.forEach((linha,j)=>{
        assert.equal(linha.id,legado[j].id,`ordem calibrada do jogador ${i}, posição ${j}`);
        perto(linha.score,legado[j].score,`score calibrado de ${linha.id} no jogador ${i}`);
        comparacoes++;
      });
    });
  }finally{
    X.NM_DEF.Closer.w.cl=orig.NM_DEF.Closer.w.cl;
    X.STYLE_CONTRA.anchor.ent=orig.STYLE_CONTRA.anchor.ent;
  }
  assert.deepEqual(plain(X.NM_DEF),orig.NM_DEF,"NM_DEF não foi restaurado");
  assert.deepEqual(plain(X.STYLE_CONTRA),orig.STYLE_CONTRA,"STYLE_CONTRA não foi restaurado");

  /* ── invariantes de domínio ───────────────────────────────────────────── */
  assert.ok(!M.styleScoreTable(M.nmStats6({fp:60},"Rifler"),"Rifler").some(s=>s.id==="baiter"),
    "Baiter não pode aparecer na competição normal (é diagnóstico)");
  assert.equal(M.badBaiterProfile({fp:10,en:20,tr:15,op:30,cl:40,sn:0,ut:35,rating:.9,isIGL:true}),
    false,"IGL nunca é Baiter — stat fraco é sacrifício de função");
  const polivalente=M.jokerProfile(M.stats7({fp:60,en:60,tr:60,op:60,cl:60,sn:60,ut:60}));
  assert.equal(polivalente.ok,true,"perfil uniforme deveria ser Coringa");

  console.log(`style score parity: ok (${comparacoes} comparações · ${casos.length} casos × ${papeis.length} papéis · tabelas calibradas)`);
}

main().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
