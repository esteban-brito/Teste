/* Prova que a química de elenco extraída reproduz o motor legado.
   Compara os 17 elencos reais + cenários sintéticos, em todos os campos e com
   as quatro características de treinador. Os ALERTAS entram na comparação: a
   ordem deles é observável na interface. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {X}=require("../bancada/motor");
const {ROOT}=require("../bancada/common");

const CARACS=[null,"Gestor","Estrategista","Desenvolvedor","Motivador"];
const COLOCACOES=["Campeao","Final","Top4","Top8","Grupos"];

// O motor legado roda em outro realm (vm): seus arrays têm outro prototype e
// deepStrictEqual reprovaria mesmo com conteúdo idêntico. Normalizar antes.
const plain=v=>JSON.parse(JSON.stringify(v));

async function main(){
  const url=pathToFileURL(path.join(ROOT,"src","domain","chemistry","team-chemistry.mjs")).href;
  const M=await import(url);

  let comparacoes=0;

  /* ── ovrTreinador: toda colocação × faixa de soma ─────────────────────── */
  COLOCACOES.forEach(coloc=>{
    for(let soma=40;soma<=110;soma+=5){
      assert.equal(M.ovrTreinador(soma,coloc),X.ovrTreinador(soma,coloc),
        `ovrTreinador(${soma},${coloc})`);
      comparacoes++;
    }
  });

  /* ── os 17 elencos reais, com cada característica ─────────────────────── */
  const elencos=X.TEAMS.map(t=>({nome:t.nome,js:t.jogadores.map(j=>j._eng)}));
  elencos.forEach(({nome,js})=>{
    CARACS.forEach(carac=>{
      const meu=M.quimicaComposicao(js,carac),leg=X.quimicaComposicao(js,carac);
      ["quimica","quimicaSemCmd","penCmd"].forEach(campo=>{
        assert.equal(meu[campo],leg[campo],`${nome}/${carac}: ${campo} divergiu`);
        comparacoes++;
      });
      assert.deepEqual(meu.alertas,plain(leg.alertas),`${nome}/${carac}: alertas divergiram`);
      comparacoes++;

      const mp=M.quimicaPlaystyles(js,carac),lp=X.quimicaPlaystyles(js,carac);
      assert.equal(mp.mult,lp.mult,`${nome}/${carac}: mult de playstyles`);
      assert.deepEqual(mp.alertas,plain(lp.alertas),`${nome}/${carac}: alertas de playstyles`);
      comparacoes+=2;

      [null,10,15,20].forEach(ovrT=>{
        const mf=M.forcaTime(js,carac,ovrT),lf=X.forcaTime(js,carac,ovrT);
        ["bruta","quimica","fatorTreinador","efetiva"].forEach(campo=>{
          assert.equal(mf[campo],lf[campo],`${nome}/${carac}/treinador ${ovrT}: ${campo}`);
          comparacoes++;
        });
      });
    });
  });

  /* ── derivaCaracteristica sobre os 17 times ───────────────────────────── */
  X.TIMES_DEF.forEach(time=>{
    assert.equal(M.derivaCaracteristica(time,X.POOL),X.derivaCaracteristica(time,X.POOL),
      `derivaCaracteristica de ${time.nome}`);
    comparacoes++;
  });

  /* ── cenários sintéticos: os caminhos que os 17 elencos não cobrem ────── */
  const j=(o={})=>({ovr:17,primario:"Rifler",secundario:"Entry",secForte:true,
    playstyle:"playmaker",estrela:false,...o});
  const cenarios={
    "sem IGL":[j(),j(),j(),j(),j()],
    "IGL fraco":[j({primario:"IGL",secundario:"Support",ovr:11}),j(),j(),j(),j()],
    "sem AWP":[j({primario:"IGL",secundario:"Support"}),j(),j(),j(),j()],
    "AWP dupla cobertura":[j({primario:"IGL",secundario:"Support"}),
      j({secundario:"AWPer"}),j({secundario:"AWPer"}),j(),j()],
    "cinco estrelas":[j({estrela:true}),j({estrela:true}),j({estrela:true}),
      j({estrela:true}),j({estrela:true})],
    "saturado de riflers":[j({primario:"IGL",secundario:"AWPer"}),j(),j(),j(),j()],
    "elenco cru":[j({primario:"IGL",secundario:"AWPer",ovr:12}),j({ovr:12}),
      j({ovr:13}),j({ovr:14}),j({ovr:12})],
    "todos coringas":[j({primario:"IGL",secundario:"AWPer",playstyle:"joker"}),
      j({playstyle:"joker"}),j({playstyle:"joker"}),j({playstyle:"joker"}),j({playstyle:"joker"})]
  };
  Object.entries(cenarios).forEach(([nome,js])=>{
    CARACS.forEach(carac=>{
      const meu=M.quimicaComposicao(js,carac),leg=X.quimicaComposicao(js,carac);
      assert.equal(meu.quimica,leg.quimica,`cenário "${nome}"/${carac}: química`);
      assert.equal(meu.penCmd,leg.penCmd,`cenário "${nome}"/${carac}: penCmd`);
      assert.deepEqual(meu.alertas,plain(leg.alertas),`cenário "${nome}"/${carac}: alertas`);
      comparacoes+=3;
    });
  });

  /* ── invariantes de domínio ───────────────────────────────────────────── */
  const perfeito=M.quimicaComposicao([
    j({primario:"IGL",secundario:"AWPer",ovr:18}),j({primario:"AWPer"}),
    j({primario:"Entry"}),j({primario:"Support"}),j({primario:"Lurker"})]);
  assert.ok(perfeito.quimica<=M.CFG_PADRAO.QUIMICA_MAX,
    "química não pode passar de 100% — não existe bônus aditivo");

  // comando é estrutural: talento não compra um caller
  const semIgl=[j({ovr:22}),j({ovr:22}),j({ovr:22}),j({ovr:22}),j({ovr:22})];
  const f=M.forcaTime(semIgl,null,20);
  assert.ok(f.penCmd<1,"elenco sem IGL precisa carregar a penalidade de comando");
  assert.ok(f.quimica<M.CFG_PADRAO.QUIMICA_MAX,
    "firepower máximo não pode zerar a falta de comando");

  console.log(`team chemistry parity: ok (${comparacoes} comparações · ${elencos.length} elencos reais · ${Object.keys(cenarios).length} sintéticos)`);
}

main().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
