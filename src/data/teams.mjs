/* Cópia de migração das definições cruas de elencos.
   Enquanto game.js ainda for consumidor, tools/check-raw-team-parity.js
   impede divergência integral entre as duas representações. */
export const TIMES_DEF=[
  {nome:"NAVI",cor:"#ffd400",coach:"B1ad3",camp:"Stockholm Major 2021",colocacao:"Campeao",jogadores:["s1mple","electroNic","b1t","Perfecto","Boombl4"]},
  /* ROXO desde 07/08/2026, a pedido. O `#39d3ff` anterior era IDÊNTICO à cor do
     time do jogador: em ~6% dos confrontos os dois cards saíam da mesma cor e só
     o selo `VOCÊ` os separava. O tom foi escolhido por medição — 22,2 de
     distância do roxo do Spirit e 4,81:1 de contraste com a tinta do monograma. */
  {nome:"Outsiders",cor:"#7c4dff",coach:"dastan",camp:"Rio Major 2022",colocacao:"Campeao",jogadores:["Jame","FL1T","fame","n0rb3r7","Qikert"]},
  {nome:"FURIA",cor:"#00e676",coach:"guerri",camp:"Rio Major 2022",colocacao:"Top4",jogadores:["KSCERATO","yuurih","saffee","arT","drop"]},
  {nome:"SK",cor:"#ff5a1f",coach:"dead",camp:"Cologne Major 2016",colocacao:"Campeao",jogadores:["coldzera","FalleN","fer","fnx","TACO"]},
  {nome:"Vitality",cor:"#f5d020",coach:"XTQZZZ",camp:"Budapest Major 2025",colocacao:"Campeao",jogadores:["ZywOo","ropz","mezii","flameZ","apEX"]},
  {nome:"Spirit",cor:"#b06cff",coach:"hally",camp:"Budapest Major 2025",colocacao:"Top4",jogadores:["donk","sh1ro","tN1R","zweih","chopper"]},
  {nome:"MongolZ",cor:"#ff3b54",coach:"maaRaa",camp:"Budapest Major 2025",colocacao:"Top8",jogadores:["mzinho","bLitz","910","controlez","Techno"]},
  {nome:"EnVyUs",cor:"#00b4a0",coach:null,camp:"DreamHack Cluj-Napoca 2015",colocacao:"Campeao",jogadores:["kennyS","NBK-","Happy","apEX_envy","kioShiMa"]},
  {nome:"Cloud9",cor:"#00aeef",coach:"valens",camp:"ELEAGUE Major Boston 2018",colocacao:"Campeao",jogadores:["tarik","autimatic","RUSH","Skadoodle","Stewie2K"]},
  {nome:"FaZe",cor:"#e43d30",coach:"RobbaN",camp:"ESL One New York 2017",colocacao:"Campeao",jogadores:["NiKo","rain","GuardiaN","olofmeister","karrigan"]},
  {nome:"Astralis",cor:"#e2231a",coach:"zonic",camp:"IEM Katowice 2019",colocacao:"Campeao",jogadores:["device","Xyp9x","Magisk","dupreeh","gla1ve"]},
  {nome:"Immortals",cor:"#00c2a8",coach:"zakk",camp:"PGL Major Krakow 2017",colocacao:"Final",jogadores:["kNgV-","HEN1","LUCAS1","boltz","steel"]},
  {nome:"G2",cor:"#e4002b",coach:"Swani",camp:"IEM Sydney 2023",colocacao:"Top4",jogadores:["m0NESY","jks","NiKo_g2","huNter-","HooXi"]},
  {nome:"Spirit",cor:"#7d8aa0",coach:"hally",coachFoto:"hally_kato24",camp:"IEM Katowice 2024",colocacao:"Campeao",jogadores:["donk_kato24","sh1ro_kato24","zont1x","magixx","chopper_kato24"]},
  {nome:"FURIA",cor:"#1faa59",coach:"sidde",camp:"IEM Chengdu 2025",colocacao:"Campeao",jogadores:["FalleN_furia25","YEKINDAR","yuurih_furia25","KSCERATO_furia25","molodoy"]},
  {nome:"Virtus.pro",cor:"#f0a020",coach:null,camp:"EMS One Katowice 2014",colocacao:"Campeao",jogadores:["pashaBiceps","NEO","Snax","byali","TaZ"]},
  {nome:"BIG",cor:"#e9edf3",coach:"kakafu",coachPais:"AUT",camp:"ESL One Cologne 2018",colocacao:"Final",jogadores:["tabseN","nex","tiziaN","smooya","gob b"]},
  //@times — o gerador (tools/add-team.js) insere novos times ACIMA desta linha
];
