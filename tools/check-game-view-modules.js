/* Contrato dos renderizadores HTML puros extraídos do entrypoint do jogo. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");

const moduleUrl=(...parts)=>pathToFileURL(path.join(__dirname,"..","src","ui",...parts)).href;

async function main(){
  const [{escapeHtml},{createCardView},{construirCartao}]=await Promise.all([
    import(moduleUrl("shared","html.mjs")),
    import(moduleUrl("game","card-view.mjs")),
    import(moduleUrl("game","build-summary-view.mjs")),
  ]);

  assert.equal(escapeHtml(`&<>"'`),"&amp;&lt;&gt;&quot;'","escape HTML mudou o contrato existente");

  const recipeCalls=[];
  const view=createCardView({
    styleId:playstyle=>playstyle==="Coringa"?"joker":"closer",
    styleLabel:id=>id==="closer"?"Closer <elite>":"Coringa",
    styleRecipe:id=>{recipeCalls.push(id);return {ovrW:{cl:.5,fogo:.2,ut:.3,ab:.1}};},
  });
  assert.equal(view.teamCardHTML({id:'a"b',cor:"#f00",coloc:"1º",nome:"A&B",camp:"<Major>"},"dim"),
    `<div class="tcard dim" data-team="a&quot;b" style="--col:#f00">
  <div class="tcoloc">1º</div><div class="tname">A&amp;B</div><div class="tcamp">&lt;Major&gt;</div></div>`,
    "template do time mudou");
  assert.deepEqual([22,21,18,15,14].map(ovr=>view.cardClass({tipo:"player",ovr})),
    ["card tier-h","card tier-s","card tier-1","card tier-2","card tier-3"],
    "tiers visuais das cartas mudaram");
  assert.equal(view.cardClass({tipo:"coach",caracSlug:"estrategista"}),"coachcard coach-estrategista",
    "classe visual do treinador mudou");

  const playerHtml=view.cardHTML({tipo:"player",ovr:22,pais:"<BR>",time:"A&B",nick:'N"ick',estrela:true,
    prim:"AWPer",sec:"Support",secForte:true,
    _eng:{playstyle:"Closer",fp:90,op:60,cl:80,ut:50}});
  assert.ok(playerHtml.includes("&lt;BR&gt;")&&playerHtml.includes("A&amp;B")&&playerHtml.includes("N&quot;ick"),
    "campos da carta deixaram de escapar HTML");
  assert.ok(playerHtml.includes("STAR ★ PLAYER")&&playerHtml.includes("role sec forte"),
    "estrela ou função secundária forte sumiu da carta");
  assert.ok(playerHtml.includes("Closer &lt;elite&gt;"),"label do playstyle mudou ou deixou de ser escapado");
  const statPositions=["Firepower","Clutch","Utilitário","Abertura"].map(label=>playerHtml.indexOf(label));
  assert.ok(statPositions.every(position=>position>=0)&&statPositions.every((position,index)=>index===0||position>statPositions[index-1]),
    "ordem peso × valor das estatísticas do verso mudou");
  assert.deepEqual(recipeCalls,["closer"],"receita do playstyle deixou de ser consultada uma vez");

  const coachHtml=view.cardHTML({tipo:"coach",ovr:18,pais:"BR",time:"SK",nick:"zonic",carac:"Gestor",caracSlug:"gestor"});
  assert.ok(coachHtml.includes("Treinador")&&coachHtml.includes("Tolera +1 estrela")&&coachHtml.includes("7% → 4%"),
    "frente ou descrição do treinador mudou");

  const summary=construirCartao(["Comando +8%","AWP falta","Âncora −12%","2× Rifler −5%"],0);
  const order=["selo grave","selo leve","selo bonus","selo neutro"].map(marker=>summary.indexOf(marker));
  assert.ok(order.every(position=>position>=0)&&order.every((position,index)=>index===0||position>order[index-1]),
    "prioridade visual dos selos mudou");
  assert.ok(summary.includes("Âncora<b>−12%</b>")&&summary.includes("Saturação<b>−5%</b>")&&
    summary.includes("Comando<b>+8%</b>")&&summary.includes("AWP<b>—</b>"),
  "conteúdo dos selos mudou");
  assert.ok(summary.includes("Treinador<b>✓</b>"),"selo forte do treinador sem delta sumiu");
  assert.ok(construirCartao([],4).includes("Treinador<b>+4%</b>"),"bônus do treinador mudou");

  console.log("game view modules: ok (escape · cartas · versos · tiers · selos)");
}

main().catch(error=>{console.error(error);process.exitCode=1;});
