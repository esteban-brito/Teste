/* Prova que a avaliação de jogador extraída reproduz o motor legado.
   ══════════════════════════════════════════════════════════════════════════
   É o fecha-bloco do PRISMA→ZÊNITE: compara o objeto de avaliação INTEIRO, não
   só o OVR. Campos como `estrela`, `combatRole` e `matchMargin` alimentam
   química, exposição e agressão — divergir neles muda 45.900 mapas sem mudar
   nenhum rótulo visível.

   `aplicarAvaliacaoContextual` MUTA a entrada de propósito. Aqui isso é provado,
   não proibido: o mesmo objeto tem de voltar, com os mesmos campos escritos. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {X}=require("../bancada/motor");
const {ROOT}=require("../bancada/common");

const PRECISAO=1e-12;
const plain=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));

function perto(atual,esperado,mensagem){
  assert.ok(Number.isFinite(atual),`${mensagem}: valor não finito (${atual})`);
  assert.ok(Math.abs(atual-esperado)<PRECISAO,`${mensagem}: ${atual} ≠ ${esperado}`);
}

async function main(){
  const url=pathToFileURL(path.join(ROOT,"src","domain","evaluation","player-evaluation.mjs")).href;
  const M=await import(url);

  const crus=Object.values(X.ATRIBUTOS);
  const sinteticos=[
    {nome:"vazio"},
    {nome:"zerado",fp:0,en:0,tr:0,op:0,cl:0,sn:0,ut:0,rating:0,colocacao:"Grupos"},
    {nome:"maximo",fp:100,en:100,tr:100,op:100,cl:100,sn:100,ut:100,rating:2.0,colocacao:"Campeao"},
    {nome:"iglCampeao",fp:40,en:50,tr:45,op:35,cl:60,sn:0,ut:80,rating:1.0,colocacao:"Campeao",isIGL:true},
    {nome:"iglGrupos",fp:40,en:50,tr:45,op:35,cl:60,sn:0,ut:80,rating:1.0,colocacao:"Grupos",isIGL:true},
    {nome:"coringa",fp:60,en:60,tr:60,op:60,cl:60,sn:60,ut:60,rating:1.1,colocacao:"Top4"},
    {nome:"baiter",fp:10,en:20,tr:15,op:30,cl:40,sn:0,ut:35,rating:.9,colocacao:"Grupos"},
    {nome:"statVazio",fp:95,en:90,tr:90,op:95,cl:95,sn:95,ut:95,rating:.85,colocacao:"Grupos"}
  ];
  const casos=[...crus,...sinteticos];

  const CAMPOS=["ovr","combatRole","role1","role2","playstyle","estrela",
    "primario","secundario","secForte","classe"];
  const NUMERICOS=["ovr","statScore","score","base","bonus","core","ratingWeight",
    "matchScore","matchMargin"];

  let comparacoes=0;
  casos.forEach((p,i)=>{
    const rotulo=p.id||p.nome||`caso ${i}`;

    // ── avaliarJogador: objeto inteiro ──────────────────────────────────
    const meu=M.avaliarJogador({...p}),legado=X.avaliarJogador({...p});
    CAMPOS.forEach(campo=>{
      assert.deepEqual(plain(meu[campo]),plain(legado[campo]),
        `${rotulo}: campo "${campo}" divergiu (${meu[campo]} ≠ ${legado[campo]})`);
      comparacoes++;
    });
    NUMERICOS.forEach(campo=>{
      const a=campo==="ovr"?meu.ovr:meu.style[campo],b=campo==="ovr"?legado.ovr:legado.style[campo];
      if(typeof b==="number"){perto(a,b,`${rotulo}: style.${campo}`);comparacoes++;}
    });
    // os seis eixos do estilo
    Object.keys(legado.style.s6).forEach(eixo=>{
      perto(meu.style.s6[eixo],legado.style.s6[eixo],`${rotulo}: s6.${eixo}`);
      comparacoes++;
    });

    // ── nmOVR por papel, incluindo estilo forçado ───────────────────────
    ["Rifler","AWPer","Entry","Support","Lurker"].forEach(role=>{
      const a=M.nmOVR(p,role),b=X.nmOVR(p,role);
      assert.equal(a.style,b.style,`${rotulo}: estilo em ${role}`);
      perto(a.ovr,b.ovr,`${rotulo}: OVR em ${role}`);
      perto(a.core,b.core,`${rotulo}: core em ${role}`);
      comparacoes+=3;
    });
    const forcado=M.nmOVR(p,"Rifler","Closer"),forcadoLegado=X.nmOVR(p,"Rifler","Closer");
    assert.equal(forcado.style,forcadoLegado.style,`${rotulo}: estilo forçado`);
    perto(forcado.ovr,forcadoLegado.ovr,`${rotulo}: OVR com estilo forçado`);
    comparacoes+=2;

    // ── ovrUnificado, inclusive o caminho do IGL ────────────────────────
    ["Rifler","IGL"].forEach(role=>{
      perto(M.ovrUnificado(role,p,"Support"),X.ovrUnificado(role,p,"Support"),
        `${rotulo}: ovrUnificado(${role})`);
      comparacoes++;
    });
  });

  /* ── a mutação é CONTRATO: prova que acontece e que é idêntica ───────── */
  const alvo={...crus[0],primario:"Rifler",secundario:"Entry"};
  const alvoLegado={...alvo};
  const devolvido=M.aplicarAvaliacaoContextual(alvo);
  const devolvidoLegado=X.aplicarAvaliacaoContextual(alvoLegado);
  assert.equal(devolvido,alvo,"aplicarAvaliacaoContextual deve devolver o MESMO objeto (muta)");
  assert.ok("ovr" in alvo&&"estrela" in alvo,"a mutação deve escrever ovr e estrela na entrada");
  // só os campos que ESTE ponto escreve. `classe`, `primario` e `secundario` são
  // de avaliarJogador — cobrá-los aqui compararia `undefined` com `undefined`.
  ["ovr","combatRole","role1","role2","playstyle","estrela"].forEach(campo=>{
    assert.deepEqual(plain(alvo[campo]),plain(alvoLegado[campo]),
      `mutação divergiu no campo "${campo}"`);
  });
  assert.equal(devolvidoLegado,alvoLegado,"o legado também devolve o mesmo objeto");

  /* ── invariantes de domínio ──────────────────────────────────────────── */
  const igl=M.avaliarJogador({fp:40,en:50,tr:45,op:35,cl:60,sn:0,ut:80,rating:1.0,
    colocacao:"Campeao",isIGL:true});
  assert.equal(igl.role1,"IGL","IGL precisa manter a função de comando");
  assert.equal(igl.role2,null,"IGL não tem role2 — a função de combate é combatRole");
  assert.ok(igl.combatRole,"IGL precisa de uma função de combate");
  assert.ok(igl.ovr<=M.CFG_PADRAO.IGL_TETO,`teto do IGL furado: ${igl.ovr}`);

  const campeao=M.avaliarJogador({fp:40,en:50,tr:45,op:35,cl:60,sn:0,ut:80,rating:1.0,
    colocacao:"Campeao",isIGL:true});
  const grupos=M.avaliarJogador({fp:40,en:50,tr:45,op:35,cl:60,sn:0,ut:80,rating:1.0,
    colocacao:"Grupos",isIGL:true});
  assert.ok(campeao.ovr>grupos.ovr,"colocação precisa valer OVR para o IGL");

  const forte=M.avaliarJogador({fp:99,en:60,tr:70,op:95,cl:70,sn:20,ut:60,rating:1.5,colocacao:"Campeao"});
  assert.equal(forte.estrela,forte.ovr>=M.CFG_NIVEL.ESTRELA_OVR,"estrela deve derivar do OVR");

  console.log(`player evaluation parity: ok (${comparacoes} comparações · ${casos.length} casos)`);
}

main().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
