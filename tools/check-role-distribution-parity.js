/* Prova que o passe de time extraído reproduz o motor legado.
   ══════════════════════════════════════════════════════════════════════════
   Diferente dos outros checadores deste bloco: `distribuirRoles` NÃO é função
   pura — ele muta os jogadores em contexto de elenco. Então a prova é feita
   sobre ELENCOS INTEIROS, com dois clones independentes dos mesmos atributos
   crus, e compara o estado final dos cinco jogadores de cada time.

   Cobre também as três regras que só aparecem em elenco: o teto por função, a
   AWP forçada como segunda, e a AWP órfã. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {X}=require("../bancada/motor");
const {ROOT}=require("../bancada/common");

const CAMPOS=["primario","secundario","secForte","role1","role2","combatRole","ovr","playstyle","estrela"];
const clone=p=>({...p});

async function main(){
  const url=pathToFileURL(path.join(ROOT,"src","domain","evaluation","role-distribution.mjs")).href;
  const {distribuirRoles,capRole}=await import(url);

  const porId=Object.fromEntries(Object.values(X.ATRIBUTOS).map(p=>[p.id||p.nome,p]));

  /* ── os 17 elencos reais ──────────────────────────────────────────────── */
  let comparacoes=0,elencos=0;
  X.TIMES_DEF.forEach(time=>{
    const crus=time.jogadores.map(id=>porId[id]);
    assert.ok(crus.every(Boolean),`elenco ${time.nome} tem jogador inexistente`);

    const meus=crus.map(clone),legados=crus.map(clone);
    const devolvido=distribuirRoles(meus);
    X.distribuirRoles(legados);

    assert.equal(devolvido,meus,"distribuirRoles deve devolver o MESMO array (muta)");

    meus.forEach((jogador,i)=>{
      CAMPOS.forEach(campo=>{
        assert.deepEqual(jogador[campo],legados[i][campo],
          `${time.nome}/${jogador.nome}: "${campo}" divergiu `+
          `(${jogador[campo]} ≠ ${legados[i][campo]})`);
        comparacoes++;
      });
    });

    /* as três regras de elenco, verificadas no resultado */
    const contagem={};
    meus.filter(j=>!j.isIGL).forEach(j=>{contagem[j.primario]=(contagem[j.primario]||0)+1;});
    Object.entries(contagem).forEach(([role,n])=>{
      assert.ok(n<=capRole(role),`${time.nome}: ${n} primários em ${role} (teto ${capRole(role)})`);
    });
    assert.ok(meus.some(j=>j.primario==="AWPer"||j.secundario==="AWPer"),
      `${time.nome}: elenco sem ninguém de AWP`);
    elencos++;
  });

  /* ── idempotência: re-rodar não pode mover nada ───────────────────────── */
  const amostra=X.TIMES_DEF[0].jogadores.map(id=>clone(porId[id]));
  distribuirRoles(amostra);
  const depoisDeUma=amostra.map(j=>CAMPOS.map(c=>j[c]).join("|"));
  distribuirRoles(amostra);
  amostra.forEach((j,i)=>{
    assert.equal(CAMPOS.map(c=>j[c]).join("|"),depoisDeUma[i],
      `${j.nome}: distribuirRoles não é idempotente`);
  });

  /* ── elencos sintéticos: as regras sob pressão ────────────────────────── */
  const sintetico=(...js)=>js.map((j,i)=>({nome:`s${i}`,rating:1.1,colocacao:"Top8",
    fp:50,en:50,tr:50,op:50,cl:50,sn:0,ut:50,isIGL:false,...j}));

  const cenarios={
    "cinco AWPers":sintetico({sn:95},{sn:94},{sn:93},{sn:92},{sn:91}),
    "ninguem de AWP":sintetico({sn:0,fp:80},{sn:0,en:80},{sn:0,ut:80},{sn:0,cl:80},{sn:0,tr:80}),
    "cinco entries":sintetico({en:90,op:85},{en:89,op:84},{en:88,op:83},{en:87,op:82},{en:86,op:81}),
    "todos identicos":sintetico({},{},{},{},{}),
    "com IGL":sintetico({isIGL:true,ut:85},{sn:90},{en:80},{cl:80},{fp:80})
  };

  Object.entries(cenarios).forEach(([nome,elenco])=>{
    const meus=elenco.map(clone),legados=elenco.map(clone);
    distribuirRoles(meus);
    X.distribuirRoles(legados);
    meus.forEach((jogador,i)=>{
      CAMPOS.forEach(campo=>{
        assert.deepEqual(jogador[campo],legados[i][campo],
          `cenário "${nome}", jogador ${i}: "${campo}" divergiu `+
          `(${jogador[campo]} ≠ ${legados[i][campo]})`);
        comparacoes++;
      });
    });
    assert.ok(meus.some(j=>j.primario==="AWPer"||j.secundario==="AWPer"),
      `cenário "${nome}": ninguém ficou de AWP`);
    elencos++;
  });

  console.log(`role distribution parity: ok (${comparacoes} comparações · ${elencos} elencos)`);
}

main().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
