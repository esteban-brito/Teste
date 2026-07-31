/* Prova que `elencos.html` e a carta canônica contam a mesma história visual.

   POR QUE ISTO EXISTE. `elencos.html` mantém a PRÓPRIA cópia das cores de função e
   dos cortes de raridade — ele é uma página autônoma, não importa `style.css`. O
   comentário no arquivo já avisava que as duas precisam andar juntas, mas nada
   verificava. Em 31/07/2026 a faixa 3 virou cobre na carta e continuou âmbar na
   lista: o mesmo jogador aparecia com raridades diferentes em duas telas, e a
   suíte inteira ficou verde.

   O QUE É COBRADO. As seis cores de função, que o próprio `elencos.html` declara
   serem "idênticas às da carta canônica", e os seis cortes de OVR. A COR de cada
   faixa não é cobrada: a lista pinta um selo pequeno com texto por cima e precisa
   de contraste próprio, então ela usa um tom da mesma família, não o mesmo hex. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const ROOT=path.join(__dirname,"..");
const css=fs.readFileSync(path.join(ROOT,"style.css"),"utf8");
const roster=fs.readFileSync(path.join(ROOT,"elencos.html"),"utf8");
const cardView=fs.readFileSync(path.join(ROOT,"src","ui","game","card-view.mjs"),"utf8");

const FUNCOES=["igl","awper","entry","rifler","lurker","support"];

/** Cor de função declarada em `style.css`, por `.card.fn-<slug>{--r:#hex`. */
function corDaCarta(slug){
  const achado=css.match(new RegExp(`\\.card\\.fn-${slug}\\{--r:(#[0-9a-fA-F]{3,8})`));
  assert.ok(achado,`style.css não declara mais a cor da função ${slug}`);
  return achado[1].toLowerCase();
}

/** Cor de função declarada em `elencos.html`, por `Nome:{c:"#hex"`. */
function corDaLista(nome){
  const achado=roster.match(new RegExp(`${nome}:\\{c:"(#[0-9a-fA-F]{3,8})"`));
  assert.ok(achado,`elencos.html não declara mais a cor da função ${nome}`);
  return achado[1].toLowerCase();
}

/** Cortes de OVR na forma [limite, faixa], do maior para o menor. */
function cortes(fonte,regex){
  return [...fonte.matchAll(regex)].map(m=>[Number(m[1]),Number(m[2])]);
}

function main(){
  const NOME_DE={igl:"IGL",awper:"AWPer",entry:"Entry",rifler:"Rifler",
    lurker:"Lurker",support:"Support"};
  for(const slug of FUNCOES){
    assert.equal(corDaLista(NOME_DE[slug]),corDaCarta(slug),
      `cor da função ${slug} divergiu entre style.css e elencos.html`);
  }

  /* `tierOf`: ovr>=22?"tier-6":ovr>=21?… — pares (limite, faixa). */
  const naCarta=cortes(cardView,/ovr>=(\d+)\?"tier-(\d)"/g);
  /* `tierVars`: o>=22?"6":o>=21?"5":… */
  const naLista=cortes(roster,/o>=(\d+)\?"(\d)"/g);
  assert.ok(naCarta.length>=5,"não consegui ler os cortes de tierOf em card-view.mjs");
  assert.deepEqual(naLista,naCarta,
    "cortes de raridade divergiram entre card-view.mjs e elencos.html");

  console.log(`roster sync: ok (${FUNCOES.length} cores de função · `+
    `${naCarta.length} cortes de raridade)`);
}

main();
