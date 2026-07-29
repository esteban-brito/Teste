/* Contrato dos renderizadores HTML puros extraídos do entrypoint do jogo. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");

const moduleUrl=(...parts)=>pathToFileURL(path.join(__dirname,"..","src","ui",...parts)).href;

async function main(){
  const [{escapeHtml},{createCardView},{construirCartao},teamView,tournamentView,
    {scoreboardSideHtml},historyView]=await Promise.all([
    import(moduleUrl("shared","html.mjs")),
    import(moduleUrl("game","card-view.mjs")),
    import(moduleUrl("game","build-summary-view.mjs")),
    import(moduleUrl("game","team-view.mjs")),
    import(moduleUrl("game","tournament-view.mjs")),
    import(moduleUrl("game","match-view.mjs")),
    import(moduleUrl("game","history-view.mjs")),
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

  const alpha={nome:"A&B",cor:"#123",camp:"<Major>",ef:19,v:0,d:0,vivo:true,meu:true};
  const beta={nome:"Beta",cor:"#456",camp:"Liga",ef:17,v:0,d:0,vivo:true};
  assert.equal(teamView.teamMonogram("São-Paulo!"),"SO","monograma do time mudou");
  assert.ok(teamView.teamChipHtml(alpha,true).includes("team-chip loser")&&
    teamView.teamChipHtml(alpha,true).includes("A&amp;B"),"chip do time mudou ou perdeu escaping");
  assert.ok(teamView.teamChipHtml(null).includes("background:#2a3346")&&teamView.teamChipHtml(null).includes("?"),
    "placeholder de time pendente mudou");
  const liveHeader=teamView.liveTeamHeaderHtml(alpha,"ct","sideA");
  assert.ok(liveHeader.includes('id="sideA">CT')&&liveHeader.includes("&lt;Major&gt;"),
    "cabeçalho ao vivo do time mudou");
  assert.ok(teamView.prematchTeamHtml(alpha).includes("força <b>19</b>")&&
    teamView.prematchTeamHtml(alpha).includes("border-radius:18px"),"card da antessala mudou");

  const swiss=tournamentView.swissBoardHtml({times:[alpha,beta],classificados:[alpha],eliminados:[beta]});
  assert.ok(swiss.includes("swiss-colhead neutral\">0:0")&&swiss.includes("match mine")&&swiss.includes("A&amp;B"),
    "grupos ativos da Suíça mudaram");
  // As colunas finais mostram só quem já chegou; o contador guarda quantas vagas faltam.
  assert.equal((swiss.match(/qualified-slot/g)||[]).length,2,"colunas finais da Suíça voltaram a reservar vagas vazias");
  assert.ok(swiss.includes("qualified-slot mine")&&swiss.includes("elim-slot"),"slots finais da Suíça mudaram");
  assert.ok(swiss.includes(">Classificados<b class=\"swiss-count\">1/8</b>")&&
    swiss.includes(">Eliminados<b class=\"swiss-count\">1/8</b>"),"contador das colunas finais da Suíça mudou");
  const vazia=tournamentView.swissBoardHtml({times:[alpha],classificados:[],eliminados:[]});
  assert.ok(!vazia.includes("qualified-slot")&&(vazia.match(/swiss-col-vazio/g)||[]).length===2&&
    vazia.includes(">Classificados<b class=\"swiss-count\">0/8</b>"),"coluna final vazia da Suíça mudou");

  const seeds=Array.from({length:8},(_,index)=>({nome:`T${index}`,cor:`#00${index}`,meu:index===0}));
  const playoffs={quartas:[[seeds[0],seeds[7]],[seeds[3],seeds[4]],[seeds[1],seeds[6]],[seeds[2],seeds[5]]],
    semi:[null,null,null,null],final:[null,null],campeao:null,fase:0,res:{}};
  const quarters=tournamentView.bracketBoardHtml(playoffs);
  assert.equal((quarters.match(/ ativa/g)||[]).length,4,"quartas deixaram de marcar quatro séries ativas");
  assert.ok(quarters.includes("champ-wait")&&tournamentView.bracketSubtitle(playoffs).includes("quartas"),
    "estado inicial dos playoffs mudou");
  playoffs.res.q0={vencedorSeed:seeds[0],placarSerie:[2,0]};
  playoffs.semi=[seeds[0],seeds[3],seeds[1],seeds[2]];playoffs.fase=1;
  const semifinals=tournamentView.bracketBoardHtml(playoffs);
  assert.ok(semifinals.includes("series-row win")&&semifinals.includes('<span class="sc">2</span>'),
    "resultado do bracket mudou");
  playoffs.campeao=seeds[0];playoffs.fase=3;
  assert.ok(tournamentView.bracketBoardHtml(playoffs).includes("VOCÊ É CAMPEÃO")&&
    tournamentView.bracketSubtitle(playoffs)==="· campeão coroado","coroação do bracket mudou");

  const scoreboard=scoreboardSideHtml({name:"A&B",mine:true,side:"ct",color:'red"',stats:[{nick:"x<y"},{nick:"z"}]});
  assert.ok(scoreboard.includes("A&amp;B")&&scoreboard.includes("background:red&quot;")&&scoreboard.includes("x&lt;y"),
    "placar deixou de escapar identidade do time ou jogadores");
  assert.equal((scoreboard.match(/ls-row mine/g)||[]).length,2,"placar mudou a marcação do time do usuário");
  assert.ok(scoreboard.includes("K–D")&&scoreboard.includes("KAST")&&scoreboard.includes("ADR")&&scoreboard.includes("Rating"),
    "colunas iniciais do placar mudaram");

  const headline=historyView.headlineHtml({texto:"A < B"},[{nick:"N&",v:31,label:"kills <mapa>"}]);
  assert.ok(headline.includes("A &lt; B")&&headline.includes("N&amp; · ")&&headline.includes("kills &lt;mapa&gt;"),
    "manchete ou chips de recorde perderam escaping");
  const campaign={mapasV:9,mapasD:0,jornada:[{adv:"Vitality",meu:13,dele:3,venc:true}]};
  const ranking=[{nick:"ace<",r:1.24,k:30,d:10,a:5,best:1.5},{nick:"mate",r:.94,k:15,d:16,a:8,best:1.02}];
  const roster={"ace<":{primario:"AWPer",pais:"BR",ovr:22},mate:{primario:"Support",pais:"US",ovr:16}};
  const finalView=historyView.campaignFinalView({campaign,champion:true,ranking,roster,narrative:{texto:"Arco <invicto>"}});
  assert.equal(finalView.title,"CAMPEÃO DO MAJOR");
  assert.ok(finalView.sealsHtml.includes("9-0 INVICTO")&&finalView.mvpHtml.includes("ace&lt;")&&
    finalView.mvpHtml.includes("Arco &lt;invicto&gt;"),"selos ou MVP final mudaram");
  assert.ok(finalView.journeyHtml.includes("Vita")&&finalView.ratingsHtml.includes("md-g")&&
    finalView.ratingsHtml.includes("width:46%"),"jornada, medalha ou barra de rating mudou");
  assert.ok(finalView.recordsHtml.includes("9-0")&&finalView.recordsHtml.includes("1.50")&&
    finalView.recordsHtml.includes("+10"),"recordes do resumo final mudaram");
  assert.equal(historyView.campaignScoreHtml(9,0),"<b>9</b><span>—</span><b>0</b>","placar animado final mudou");
  assert.equal(historyView.campaignFinalView({campaign:{mapasV:0,mapasD:3,jornada:[]},champion:false,ranking:[],roster:{},narrative:null}).mvpHtml,null,
    "campanha sem ratings deixou de ocultar o MVP");

  const emptyHall=historyView.hallView({titulos:[],recordes:{},contadores:{titulos:0,invictos:0,campanhas:0}},{});
  assert.ok(emptyHall.titlesHtml.includes("Sua história começa")&&emptyHall.recordsHtml==="","estado vazio do Hall mudou");
  const fullHall=historyView.hallView({
    titulos:[{data:"2026-01-01",placar:"9-1",invicto:false,elenco:["old"],treinador:null,mvp:null},
      {data:"2026-07-29",placar:"9-0",invicto:true,elenco:["a&b"],treinador:"coach<",mvp:{nick:"ace",media:1.234}}],
    recordes:{rating:{v:1.567,nick:"ace<",adv:"A&B",mapa:"Mirage",data:"2026-07-29"}},
    contadores:{titulos:2,invictos:1,campanhas:4},
  },{rating:"Rating <mapa>"});
  assert.ok(fullHall.countersHtml.includes("2")&&fullHall.countersHtml.includes("9-0 invictos"),"contadores do Hall mudaram");
  assert.ok(fullHall.titlesHtml.indexOf("2026-07-29")<fullHall.titlesHtml.indexOf("2026-01-01")&&
    fullHall.titlesHtml.includes("a&amp;b")&&fullHall.titlesHtml.includes("coach&lt;"),"ordem ou escaping dos títulos mudou");
  assert.ok(fullHall.recordsHtml.includes("1.57")&&fullHall.recordsHtml.includes("Rating &lt;mapa&gt;")&&
    fullHall.recordsHtml.includes("ace&lt;"),"recordes do Hall mudaram");

  console.log("game view modules: ok (cartas · torneio · partida · final · Hall)");
}

main().catch(error=>{console.error(error);process.exitCode=1;});
