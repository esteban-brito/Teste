/* Prova que a afinidade de função extraída reproduz o motor legado.
   ══════════════════════════════════════════════════════════════════════════
   Três frentes:
   1. os 85 jogadores reais, função por função;
   2. entradas degeneradas (vazio, atributos faltando, IGL, extremos);
   3. TABELAS CALIBRADAS — o motivo de o módulo receber as tabelas por parâmetro.
      Se ele espelhasse constantes, divergiria em silêncio assim que o calibrador
      mexesse em ROLE_PERFIL/ROLE_CONTRA/ROLE_RULES. Aqui isso é testado. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {X}=require("../bancada/motor");
const {ROOT}=require("../bancada/common");

const PRECISAO=1e-12;

function perto(atual,esperado,mensagem){
  assert.ok(Number.isFinite(atual),`${mensagem}: valor não finito (${atual})`);
  assert.ok(Math.abs(atual-esperado)<PRECISAO,`${mensagem}: ${atual} ≠ ${esperado}`);
}

// O motor legado roda em outro realm (vm): normalizar antes de comparar.
const plain=v=>JSON.parse(JSON.stringify(v));

async function main(){
  const url=pathToFileURL(path.join(ROOT,"src","domain","evaluation","role-affinity.mjs")).href;
  const M=await import(url);

  // As tabelas do módulo têm de ser iguais às do motor, valor a valor.
  assert.deepEqual(plain(M.ROLE_PERFIL),plain(X.ROLE_PERFIL),"ROLE_PERFIL divergiu");
  assert.deepEqual(plain(M.ROLE_CONTRA),plain(X.ROLE_CONTRA),"ROLE_CONTRA divergiu");
  assert.deepEqual(plain(M.IGL_ROLE_AFIN),plain(X.IGL_ROLE_AFIN),"IGL_ROLE_AFIN divergiu");
  assert.deepEqual(plain(M.ROLE_RULES),plain(X.ROLE_RULES),"ROLE_RULES divergiu");
  assert.deepEqual(M.ROLES_COMBATE,["AWPer","Rifler","Entry","Lurker","Support"],
    "ordem canônica das funções mudou (afeta desempate de classificação)");

  const jogadores=Object.values(X.POOL);
  const sinteticos=[
    {},{isIGL:true},
    {fp:0,en:0,tr:0,op:0,cl:0,sn:0,ut:0},
    {fp:100,en:100,tr:100,op:100,cl:100,sn:100,ut:100},
    {fp:100,en:100,tr:100,op:100,cl:100,sn:100,ut:100,isIGL:true},
    {fp:73,ut:90,tr:60},                       // gatilho do SUP_FRAG
    {fp:71,ut:90,tr:60},                       // logo abaixo do gatilho
    {en:90,op:20,fp:20},                       // Entry sem apoio: limite e piso mordem
    {fp:60,en:60,ut:60},                       // generalista puro
    {fp:60,en:60,ut:60,op:90}                  // generalista com especialidade
  ];
  const casos=[...jogadores,...sinteticos];

  let comparacoes=0;
  casos.forEach((p,i)=>{
    const antes=JSON.stringify(p);
    M.ROLES_COMBATE.forEach(role=>{
      perto(M.roleAfinidade(role,p),X.roleAfinidade(role,p),`afinidade ${role} do caso ${i}`);
      comparacoes++;
    });
    const meu=M.afinidades(p),legado=X.afinidades(p);
    M.ROLES_COMBATE.forEach(role=>{
      perto(meu[role],legado[role],`afinidades()[${role}] do caso ${i}`);
      comparacoes++;
    });
    assert.equal(JSON.stringify(p),antes,`entrada ${i} foi mutada`);
  });

  /* ── tabelas CALIBRADAS: o módulo tem de seguir a tabela injetada ────────
     Mexe numa cópia, roda o legado com a mesma mudança, e compara. É o cenário
     do sandbox, onde o calibrador procura ajustes nessas mesmas tabelas. */
  const originais={
    ROLE_PERFIL:plain(X.ROLE_PERFIL),ROLE_CONTRA:plain(X.ROLE_CONTRA),
    IGL_ROLE_AFIN:plain(X.IGL_ROLE_AFIN),ROLE_RULES:plain(X.ROLE_RULES)
  };
  try{
    X.ROLE_PERFIL.Rifler.afin.fp=.61;
    X.ROLE_CONTRA.Lurker.en=.22;
    X.ROLE_RULES.Entry.entradaSemAbertura.w=.9;

    const injetadas={
      ROLE_PERFIL:X.ROLE_PERFIL,ROLE_CONTRA:X.ROLE_CONTRA,
      IGL_ROLE_AFIN:X.IGL_ROLE_AFIN,ROLE_RULES:X.ROLE_RULES,
      ROLE_IDENT:M.ROLE_IDENT,CFG:M.CFG_PADRAO
    };
    jogadores.slice(0,25).forEach((p,i)=>{
      M.ROLES_COMBATE.forEach(role=>{
        perto(M.roleAfinidade(role,p,injetadas),X.roleAfinidade(role,p),
          `afinidade calibrada ${role} do jogador ${i}`);
        comparacoes++;
      });
    });
  }finally{
    // restaura SEMPRE: outras suítes deste processo dependem das tabelas originais
    X.ROLE_PERFIL.Rifler.afin.fp=originais.ROLE_PERFIL.Rifler.afin.fp;
    X.ROLE_CONTRA.Lurker.en=originais.ROLE_CONTRA.Lurker.en;
    X.ROLE_RULES.Entry.entradaSemAbertura.w=originais.ROLE_RULES.Entry.entradaSemAbertura.w;
  }
  assert.deepEqual(plain(X.ROLE_PERFIL),originais.ROLE_PERFIL,"tabela não foi restaurada");

  // invariante de domínio: a afinidade tem de separar perfis opostos
  const awper={sn:95,fp:70,op:80},suporte={ut:90,tr:70,en:55};
  assert.ok(M.roleAfinidade("AWPer",awper)>M.roleAfinidade("AWPer",suporte),
    "afinidade de AWPer não separou sniper de suporte");
  assert.ok(M.roleAfinidade("Support",suporte)>M.roleAfinidade("Support",awper),
    "afinidade de Support não separou suporte de sniper");

  console.log(`role affinity parity: ok (${comparacoes} comparações · ${casos.length} casos · tabelas calibradas)`);
}

main().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
