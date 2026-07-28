/* Prova cada alegação de src/data/catalog.mjs contra os dados reais.
   ══════════════════════════════════════════════════════════════════════════
   Um catálogo que pode mentir é pior que nenhum: dá confiança falsa. Aqui toda
   cobertura declarada é recontada, e a fronteira cru × derivado do ADR 0002 é
   verificada nos dois sentidos — dado cru PRECISA estar em `src/data`, e
   derivado NÃO PODE estar. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {X}=require("../bancada/motor");

const moduleUrl=file=>pathToFileURL(path.join(__dirname,"..","src","data",file)).href;
const idDe=p=>p.id||p.nome;

async function main(){
  const [cat,{ATRIBUTOS},{TIMES_DEF},{PAIS_JOGADOR,PAIS_TREINADOR}]=await Promise.all([
    import(moduleUrl("catalog.mjs")),
    import(moduleUrl("players.mjs")),
    import(moduleUrl("teams.mjs")),
    import(moduleUrl("countries.mjs"))
  ]);
  const {JOGADOR_CRU,ELENCO_CRU,JOGADOR_DERIVADO,TOTAIS,DIVERGENCIAS,FONTES}=cat;

  /* ── 1. cobertura declarada × cobertura real ───────────────────────────── */
  const conta=(lista,campo)=>lista.filter(r=>r[campo]!==undefined&&r[campo]!==null).length;

  for(const [campo,spec] of Object.entries(JOGADOR_CRU)){
    const real=conta(ATRIBUTOS,campo);
    assert.equal(real,spec.cobertura,
      `catálogo desatualizado: jogador.${campo} cobre ${real}, catálogo diz ${spec.cobertura}`);
  }
  for(const [campo,spec] of Object.entries(ELENCO_CRU)){
    const real=conta(TIMES_DEF,campo);
    assert.equal(real,spec.cobertura,
      `catálogo desatualizado: elenco.${campo} cobre ${real}, catálogo diz ${spec.cobertura}`);
  }

  /* ── 2. fronteira cru × derivado (ADR 0002), nos dois sentidos ─────────── */
  const camposCrusReais=new Set(ATRIBUTOS.flatMap(p=>Object.keys(p)));
  for(const campo of Object.keys(JOGADOR_CRU)){
    assert.ok(camposCrusReais.has(campo),
      `catálogo declara jogador.${campo} como cru, mas ele não existe em players.mjs`);
  }
  for(const campo of Object.keys(JOGADOR_DERIVADO)){
    assert.ok(!camposCrusReais.has(campo),
      `ADR 0002 violado: "${campo}" é derivado mas apareceu em src/data/players.mjs`);
  }
  // todo campo cru real precisa estar catalogado — nada entra sem ser declarado
  for(const campo of camposCrusReais){
    assert.ok(JOGADOR_CRU[campo],
      `campo "${campo}" existe em players.mjs e NÃO está no catálogo — declare-o`);
  }

  /* ── 3. os derivados existem mesmo no POOL ─────────────────────────────── */
  const amostra=X.POOL[Object.keys(X.POOL)[0]];
  for(const campo of Object.keys(JOGADOR_DERIVADO)){
    assert.ok(campo in amostra,
      `catálogo declara "${campo}" como derivado, mas o POOL não o produz`);
  }

  /* ── 4. totais ─────────────────────────────────────────────────────────── */
  const ids=ATRIBUTOS.map(idDe);
  const nomes=ATRIBUTOS.map(p=>p.nome);
  const paisesJogador=new Set(Object.values(X.POOL).map(p=>p.pais).filter(c=>c&&c!=="—"));
  const treinadores=TIMES_DEF.map(t=>t.coach).filter(Boolean);
  const paisesTreinador=new Set(TIMES_DEF.filter(t=>t.coach)
    .map(t=>t.coachPais||PAIS_TREINADOR[t.coach]).filter(Boolean));
  const campeonatos=new Set(TIMES_DEF.map(t=>t.camp));

  const esperado={
    jogadores:ATRIBUTOS.length,
    elencos:TIMES_DEF.length,
    campeonatosDistintos:campeonatos.size,
    treinadoresDistintos:new Set(treinadores).size,
    paisesDeJogador:paisesJogador.size,
    paisesTotais:new Set([...paisesJogador,...paisesTreinador]).size,
    idsExplicitos:ATRIBUTOS.filter(p=>p.id).length,
    nomesDuplicados:new Set(nomes.filter((n,i)=>nomes.indexOf(n)!==i)).size
  };
  for(const [chave,valor] of Object.entries(esperado)){
    assert.equal(TOTAIS[chave],valor,
      `catálogo desatualizado: TOTAIS.${chave} diz ${TOTAIS[chave]}, real é ${valor}`);
  }

  /* ── 5. invariantes de identidade (docs/architecture.md §Dados e identidade) */
  assert.equal(new Set(ids).size,ids.length,"IDs crus precisam ser únicos");
  assert.equal(Object.keys(X.POOL).length,ATRIBUTOS.length,"POOL precisa indexar todos os IDs crus");
  ATRIBUTOS.forEach(p=>assert.ok(X.POOL[idDe(p)],`POOL não indexa "${idDe(p)}"`));

  /* ── 5-bis. os espaços de nome do país seguem separados ────────────────
     A tabela única de antes misturava jogador, treinador e um nome de TIME.
     Esta trava impede a regressão: tabela de pessoa não aceita nome de time, e
     PAIS_JOGADOR só aceita ID cru. */
  const idsSet=new Set(ids);
  const nomesDeTime=new Set(TIMES_DEF.map(t=>t.nome));
  Object.keys(PAIS_JOGADOR).forEach(chave=>{
    assert.ok(idsSet.has(chave),`PAIS_JOGADOR["${chave}"] não é um ID cru`);
    assert.ok(!nomesDeTime.has(chave),`PAIS_JOGADOR["${chave}"] é nome de TIME`);
  });
  Object.keys(PAIS_TREINADOR).forEach(chave=>{
    assert.ok(!nomesDeTime.has(chave),`PAIS_TREINADOR["${chave}"] é nome de TIME`);
  });

  /* ── 6. as fontes declaradas existem e exportam o que o catálogo diz ───── */
  const exportado={jogadores:ATRIBUTOS,elencos:TIMES_DEF,paises:PAIS_JOGADOR};
  for(const [chave,fonte] of Object.entries(FONTES)){
    assert.ok(exportado[chave],`FONTES.${chave} não tem export correspondente`);
    assert.ok(fonte.arquivo&&fonte.exporta&&fonte.chave,`FONTES.${chave} incompleta`);
  }

  /* ── 7. cada divergência declarada continua sendo verdade ──────────────── */
  // Um conserto sem atualizar o catálogo é tão ruim quanto a divergência.
  const aindaVale={
    "camp-empacotado":()=>TIMES_DEF.every(t=>/^(.*?)\s(\d{4})$/.test(t.camp))&&
      !("evento" in TIMES_DEF[0]),
    "sem-foto":()=>!camposCrusReais.has("foto")
  };
  DIVERGENCIAS.forEach(d=>{
    const teste=aindaVale[d.id];
    assert.ok(teste,`divergência "${d.id}" não tem teste — adicione um`);
    assert.ok(teste(),`divergência "${d.id}" foi CORRIGIDA — remova-a do catálogo`);
  });

  console.log(`data catalog: ok (${TOTAIS.jogadores} jogadores · ${TOTAIS.elencos} elencos · `+
    `${TOTAIS.campeonatosDistintos} campeonatos · ${TOTAIS.paisesTotais} países · `+
    `${DIVERGENCIAS.length} divergências declaradas)`);
}

main().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
