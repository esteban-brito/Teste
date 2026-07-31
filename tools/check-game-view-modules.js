/* Contrato dos renderizadores HTML puros e da interação acessível das cartas. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");

const ROOT=path.join(__dirname,"..");
const moduleUrl=(...parts)=>pathToFileURL(path.join(ROOT,"src","ui",...parts)).href;

async function main(){
  const [{escapeHtml},{createCardView},{setCardFlipped},{construirCartao},teamView,tournamentView,
    {scoreboardSideHtml},historyView]=await Promise.all([
    import(moduleUrl("shared","html.mjs")),
    import(moduleUrl("game","card-view.mjs")),
    import(pathToFileURL(path.join(__dirname,"..","src","application","card-face.mjs")).href),
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
  // Duas classes, dois canais: tier-* pinta a estrutura, fn-* colore o texto da função.
  assert.deepEqual([22,21,20,18,15,14].map(ovr=>view.cardClass({tipo:"player",ovr,prim:"AWPer"})),
    ["card tier-6 fn-awper","card tier-5 fn-awper","card tier-4 fn-awper",
      "card tier-3 fn-awper","card tier-2 fn-awper","card tier-1 fn-awper"],
    "faixas de raridade ou canal de função da carta mudaram");
  const rosterSource=fs.readFileSync(path.join(ROOT,"elencos.html"),"utf8");
  assert.ok(rosterSource.includes(
    'const t=o>=22?"6":o>=21?"5":o>=20?"4":o>=18?"3":o>=15?"2":"1";'),
  "Base de elencos divergiu das seis faixas canônicas da carta");
  // As bordas das faixas: 20 não pode cair em tier-1 nem 17 em tier-3.
  assert.equal(view.cardClass({tipo:"player",ovr:20,prim:"IGL"}),"card tier-4 fn-igl","borda 20/19 mudou");
  assert.equal(view.cardClass({tipo:"player",ovr:17,prim:"Support"}),"card tier-2 fn-support","borda 17/18 mudou");
  assert.deepEqual(["IGL","AWPer","Entry","Rifler","Lurker","Support"]
    .map(role=>view.cardClass({tipo:"player",ovr:18,prim:role}).split(" ")[2]),
  ["fn-igl","fn-awper","fn-entry","fn-rifler","fn-lurker","fn-support"],
  "slug de função da carta mudou");
  assert.equal(view.cardClass({tipo:"coach",caracSlug:"estrategista"}),"coachcard coach-estrategista",
    "classe visual do treinador mudou");

  const playerHtml=view.cardHTML({tipo:"player",ovr:22,pais:"BRA",time:"A&B",nick:'N"ick',estrela:true,
    camp:"<Major> 2024",coloc:"Campeao",prim:"AWPer",sec:"Support",secForte:true,
    _eng:{playstyle:"Closer",rating:1.28,fp:90,op:60,cl:80,ut:50}});
  assert.ok(playerHtml.includes("A&amp;B")&&playerHtml.includes("N&quot;ick")&&
    playerHtml.includes("&lt;Major&gt; 2024"),"campos da carta deixaram de escapar HTML");
  // Frente: três níveis de leitura e só três, mais o rodapé de contexto.
  assert.ok(playerHtml.includes('<div class="c-ovr">22<small>Overall</small>')&&
    playerHtml.includes('<div class="c-func">AWPer</div>')&&
    playerHtml.includes('<div class="c-nick">N&quot;ick</div>'),"hierarquia da frente da carta mudou");
  assert.ok(playerHtml.includes('class="c-identidade c-identidade--player"')&&
    playerHtml.includes('<span class="c-role2 c-role2--support">Support</span>')&&
    playerHtml.includes('<span class="c-team">A&amp;B</span>'),
  "estrutura de identidade da frente mudou");
  assert.ok(!playerHtml.includes("STAR")&&!playerHtml.includes("★"),"o selo de estrela voltou à carta");
  assert.ok(!playerHtml.includes('class="c-emblema"')&&!playerHtml.includes('class="c-tinta"'),
    "camadas gráficas removidas voltaram à carta");
  assert.ok(playerHtml.includes('class="c-foto"')&&playerHtml.includes('class="c-vinheta"'),
    "camada canônica de retrato saiu da carta");
  // Bandeira é SVG embutido, nunca emoji (o Windows não tem os glifos).
  assert.ok(playerHtml.includes('class="c-flag"')&&playerHtml.includes("data:image/svg+xml"),
    "bandeira da carta mudou de mecanismo");
  // Jogadores não recebem ajuste individual: uma tipografia única governa os 85.
  assert.ok(playerHtml.startsWith('<div class="cfaces"><div class="cface cfront"')&&
    !playerHtml.includes("--nick-esc")&&!playerHtml.includes("--carac-esc"),
  "jogador voltou a receber escala tipográfica individual");
  const photoHtml=view.cardHTML({tipo:"player",ovr:22,pais:"RUS",time:"Spirit",nick:"donk",
    foto:"donk_kato24",camp:"IEM Katowice 2024",coloc:"Campeao",prim:"Rifler",sec:"Entry",
    _eng:{playstyle:"Coringa",fp:100,op:97,cl:63,ut:35}});
  assert.ok(photoHtml.startsWith('<div class="cfaces" style="--foto:url(\'fotos/donk_kato24.webp\')"'),
    "retrato canônico deixou de ser projetado pelo ID cru");
  const unsafePhotoHtml=view.cardHTML({tipo:"player",ovr:22,pais:"RUS",time:"Spirit",nick:"donk",
    foto:"../fora');color:red",camp:"IEM Katowice 2024",coloc:"Campeao",prim:"Rifler",sec:"Entry",
    _eng:{playstyle:"Coringa",fp:100,op:97,cl:63,ut:35}});
  assert.ok(!unsafePhotoHtml.includes("--foto")&&!unsafePhotoHtml.includes("../fora"),
    "asset-id inseguro atravessou a fronteira do CSS");
  assert.ok(playerHtml.includes('class="cface cfront" aria-hidden="false"')&&
    playerHtml.includes('class="cface cback" aria-hidden="true"'),
  "faces da carta deixaram de declarar qual participa da acessibilidade");
  assert.equal(typeof setCardFlipped,"function","controle único de face da carta sumiu");
  const classes=new Set();
  const atributos={front:{},back:{}};
  const face=name=>({setAttribute:(key,value)=>{atributos[name][key]=value;}});
  const fakeCard={
    classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name)},dataset:{},
    querySelector:selector=>selector===".cfront"?face("front"):selector===".cback"?face("back"):null,
  };
  assert.equal(setCardFlipped(fakeCard,true),true);
  assert.ok(classes.has("flipped")&&fakeCard.dataset.face==="back"&&
    atributos.front["aria-hidden"]==="true"&&atributos.back["aria-hidden"]==="false",
  "virar a carta deixou classe, estado visual e acessibilidade dessincronizados");
  assert.equal(setCardFlipped(fakeCard,false),false);
  assert.ok(!classes.has("flipped")&&fakeCard.dataset.face==="front"&&
    atributos.front["aria-hidden"]==="false"&&atributos.back["aria-hidden"]==="true",
  "desvirar a carta deixou classe, estado visual e acessibilidade dessincronizados");
  const nomesLongos=[["curto",1],["pashaBicep",0.675],["pashaBiceps",0.675],["nomeMuitoComprido",0.5625]];
  nomesLongos.forEach(([nick,esperado])=>{
    const html=view.cardHTML({tipo:"coach",ovr:15,pais:"DEN",time:"T",nick,carac:"Gestor",caracSlug:"gestor"});
    assert.ok(html.includes(`--nick-esc:${esperado}`),`escala do nick mudou para "${nick}"`);
  });
  // Rótulo do verso: 13+ caracteres não cabem a 100%, 11–12 cabem justos.
  [["Gestor",1],["Estrategista",0.88],["Desenvolvedor",0.8]].forEach(([carac,esperado])=>{
    const html=view.cardHTML({tipo:"coach",ovr:15,pais:"DEN",time:"T",nick:"c",carac,caracSlug:"gestor"});
    assert.ok(html.includes(`--carac-esc:${esperado}`),`escala do rótulo do verso mudou para "${carac}"`);
  });
  // Verso: playstyle como espinha, atributos ordenados e era sempre presente.
  assert.ok(playerHtml.includes("Closer &lt;elite&gt;"),"label do playstyle mudou ou deixou de ser escapado");
  assert.ok(!playerHtml.includes("c-vovr")&&!playerHtml.includes("RTG")&&!playerHtml.includes("1.28"),
    "OVR ou rating voltou a ocupar o verso do jogador");
  assert.ok(playerHtml.includes("&lt;Major&gt; 2024")&&playerHtml.includes("Campeão"),
    "campeonato ou colocação saiu do verso");
  /* A linha de identidade existe para o verso não ser anônimo: virada a carta,
     ainda se sabe quem joga e por quem. Função e time, escapados, na mesma ordem. */
  assert.ok(/<div class="c-vid"><b>AWPer<\/b><span>A&amp;B<\/span><\/div>/.test(playerHtml),
    "linha de identidade do verso (função · time) mudou ou saiu");
  const statPositions=["Firepower","Clutch","Utilitário","Abertura"].map(label=>playerHtml.indexOf(label));
  assert.ok(statPositions.every(position=>position>=0)&&statPositions.every((position,index)=>index===0||position>statPositions[index-1]),
    "ordem peso × valor das estatísticas do verso mudou");
  assert.ok(!playerHtml.includes("<em>")&&playerHtml.includes('<u style="width:80%">'),
    "peso técnico voltou ao verso ou trilho da estatística mudou");
  assert.equal((playerHtml.match(/class="c-st"/g)||[]).length,4,
    "verso do jogador deixou de usar quatro slots canônicos");
  assert.deepEqual(recipeCalls,["closer"],"receita do playstyle deixou de ser consultada uma vez");
  // Coringa não tem receita: o verso diz isso em vez de mostrar barras vazias.
  const jokerHtml=view.cardHTML({tipo:"player",ovr:17,pais:"BRA",time:"T",nick:"j",camp:"C 2020",coloc:"Top4",
    prim:"Rifler",sec:"Entry",_eng:{playstyle:"Coringa",rating:1,fp:70,op:60,cl:50,ut:40}});
  assert.ok(jokerHtml.includes("Firepower")&&jokerHtml.includes("Abertura")&&!jokerHtml.includes("<em>."),
    "verso do Coringa deixou de cair nas estatísticas padrão sem peso");
  assert.equal((jokerHtml.match(/class="c-st"/g)||[]).length,4,
    "verso do Coringa deixou de usar quatro slots canônicos");

  // Treinador: mesmo esqueleto e mesmo rodapé de era; OVR existe só na frente.
  const coachHtml=view.cardHTML({tipo:"coach",ovr:18,pais:"DEN",time:"SK",nick:"zonic",
    camp:"ESL One Cologne 2016",coloc:"Campeao",carac:"Gestor",caracSlug:"gestor"});
  assert.ok(coachHtml.includes('<div class="c-ovr">18<small>Treinador</small>')&&
    coachHtml.includes('<div class="c-func">Gestor</div>')&&
    coachHtml.includes('class="c-identidade c-identidade--coach"'),"frente do treinador mudou");
  assert.ok(!coachHtml.includes("c-vovr")&&coachHtml.includes("ESL One Cologne 2016")&&
    coachHtml.includes("Campeão"),"verso do treinador perdeu padronização ou repetiu OVR");
  assert.ok(coachHtml.includes("Tolera +1 estrela")&&coachHtml.includes("7% → 4%"),
    "descrição do efeito do treinador mudou");
  assert.ok(!coachHtml.includes("c-vstats")&&coachHtml.includes("c-vdesc"),
    "verso do treinador deixou de ser a descrição do efeito");

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
