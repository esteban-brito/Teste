/* Prova que a classificação de função extraída reproduz o motor legado.
   ══════════════════════════════════════════════════════════════════════════
   Compara o par [primária, secundária] E a flag `secForte` — a flag entra na
   química, então divergir nela muda força de time sem mudar o rótulo visível.

   Cobre também os EMPATES: a ordem de ROLES_COMBATE decide desempate porque
   `sort` é estável, e isso é contrato (docs/architecture.md §Pontos de atenção). */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {X}=require("../bancada/motor");
const {ROOT}=require("../bancada/common");

async function main(){
  const url=pathToFileURL(path.join(ROOT,"src","domain","evaluation","role-classification.mjs")).href;
  const {classificar,roleSecundarioSeguro}=await import(url);

  const jogadores=Object.values(X.POOL);
  const sinteticos=[
    {},{isIGL:true},
    {fp:0,en:0,tr:0,op:0,cl:0,sn:0,ut:0},                  // empate total: desempate por ordem
    {fp:50,en:50,tr:50,op:50,cl:50,sn:50,ut:50},           // empate no meio
    {fp:100,en:100,tr:100,op:100,cl:100,sn:100,ut:100},
    {fp:100,en:100,tr:100,op:100,cl:100,sn:100,ut:100,isIGL:true},
    {en:90,op:85,ut:88,tr:80},                             // candidato a Entry/Support (paradoxo)
    {en:88,op:70,cl:86,fp:60},                             // candidato a Entry/Lurker (paradoxo)
    {sn:95,fp:80,op:75},
    {ut:95,tr:85,en:40}
  ];
  const casos=[...jogadores,...sinteticos];

  let comparacoes=0;
  casos.forEach((p,i)=>{
    const antes=JSON.stringify(p);

    const meu=classificar(p),legado=X.classificar?X.classificar(p):null;
    if(legado){
      assert.deepEqual([meu[0],meu[1]],[legado[0],legado[1]],
        `classificação do caso ${i} divergiu (${meu[0]}/${meu[1]} ≠ ${legado[0]}/${legado[1]})`);
      assert.equal(!!meu.secForte,!!legado.secForte,`secForte do caso ${i} divergiu`);
      comparacoes+=2;
    }

    // roleSecundarioSeguro: com secundária válida, ausente e igual à primária
    const prim=meu[0];
    assert.equal(roleSecundarioSeguro(prim,"Rifler",p),
      X.roleSecundarioSeguro(prim,"Rifler",p),`secundário explícito do caso ${i}`);
    assert.equal(roleSecundarioSeguro(prim,null,p),
      X.roleSecundarioSeguro(prim,null,p),`secundário ausente do caso ${i}`);
    assert.equal(roleSecundarioSeguro(prim,prim,p),
      X.roleSecundarioSeguro(prim,prim,p),`secundário igual à primária no caso ${i}`);
    comparacoes+=3;

    assert.equal(JSON.stringify(p),antes,`entrada ${i} foi mutada`);
  });

  /* ── o formato legado é contrato ──────────────────────────────────────── */
  const amostra=classificar(jogadores[0]);
  assert.ok(Array.isArray(amostra),"classificar deve devolver ARRAY (formato legado)");
  assert.equal(amostra.length,2,"classificar deve devolver exatamente [primária, secundária]");
  assert.equal(typeof amostra.secForte,"boolean","secForte deve ser boolean");

  /* ── invariantes de domínio ───────────────────────────────────────────── */
  const igl=classificar({fp:60,en:60,ut:60,isIGL:true});
  assert.equal(igl[0],"IGL","IGL precisa ser a função primária de quem comanda");
  assert.equal(igl.secForte,true,"IGL sempre tem secundária forte (é a função de combate real)");
  assert.notEqual(amostra[0],amostra[1],"primária e secundária não podem coincidir");

  /* A classificação INDIVIDUAL tem de bater com `avaliarJogador` sobre os
     atributos CRUS. Não se compara contra o POOL: `distribuirRoles` aplica
     contexto de time e MUTA as avaliações (docs/architecture.md §Pontos de
     atenção, item 4), então POOL.role1 é a função no elenco, não a classificação
     individual. Comparar as duas acusa divergência onde há só contexto — foi o
     que este checador fez na primeira versão, em 6 jogadores. */
  const crus=Object.values(X.ATRIBUTOS);
  const divergentes=crus.filter(bruto=>{
    const avaliado=X.avaliarJogador({...bruto});
    const c=classificar(bruto);
    return c[0]!==avaliado.primario||c[1]!==avaliado.secundario;
  });
  assert.equal(divergentes.length,0,
    `classificação divergiu de avaliarJogador em: ${divergentes.map(p=>p.id||p.nome).join(", ")}`);
  comparacoes+=crus.length;

  console.log(`role classification parity: ok (${comparacoes} comparações · ${casos.length} casos)`);
}

main().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
