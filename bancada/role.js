/* bancada/role.js - FASE 0 do corpus de funcoes reais.
   Roda distribuirRoles no CONTEXTO de cada elenco real (ja aplicado na
   construcao de X.TEAMS) e compara a funcao de combate que o motor da a
   cada jogador com um rotulo TOLERANTE do que ele jogou de verdade.

   Nao e (ainda) um gate: mede a concordancia atual do modelo com as
   funcoes reais - um numero que hoje ninguem sabe. Rotulo por nome@time
   (a funcao e contextual: o mesmo nick em epocas diferentes pode divergir).

   Esquema do rotulo: { certo, aceitavel:[...], proibido:[...] }
   - certo     = funcao de combate consensual (credito cheio)
   - aceitavel = leituras que gente seria defende (credito parcial)
   - proibido  = seria absurdo (penalidade)
   IGL e curado (isIGL): valida-se o SECUNDARIO (funcao de combate), nunca a lideranca.

   Uso: node bancada/role.js
*/
const {X}=require("./motor");

// Primeiro corte: so casos que eu defenderia. Jogador sem rotulo entra como
// "nao coberto" (aparece na cobertura, nao na nota). Conjuntos tolerantes
// abertos onde a funcao real e genuinamente flex.
const LABELS={
  // NAVI (Stockholm 2021)
  "s1mple@NAVI":{certo:"AWPer",proibido:["Support"]},
  "electroNic@NAVI":{certo:"Rifler",aceitavel:["Entry"]},
  "b1t@NAVI":{certo:"Entry",aceitavel:["Rifler","Lurker"]},
  "Perfecto@NAVI":{certo:"Support",aceitavel:["Lurker"]},
  "Boombl4@NAVI":{certo:"Support",aceitavel:["Rifler"]}, // IGL -> valida secundario
  // Outsiders (Rio 2022)
  "Jame@Outsiders":{certo:"AWPer"}, // IGL + AWP passivo
  "FL1T@Outsiders":{certo:"Rifler",aceitavel:["Lurker","Entry"]},
  "fame@Outsiders":{certo:"Entry",aceitavel:["Rifler"]},
  "n0rb3r7@Outsiders":{certo:"Support"},
  "Qikert@Outsiders":{certo:"Entry",aceitavel:["Support"]},
  // FURIA (Rio 2022)
  "KSCERATO@FURIA":{certo:"Rifler",aceitavel:["Lurker"]},
  "yuurih@FURIA":{certo:"Support",aceitavel:["Rifler","Lurker"]},
  "saffee@FURIA":{certo:"AWPer"},
  "arT@FURIA":{certo:"Entry"}, // IGL entry-fragger agressivo (caso classico)
  "drop@FURIA":{certo:"Support",aceitavel:["Entry"]},
  // SK (Cologne 2016)
  "coldzera@SK":{certo:"Lurker",aceitavel:["Rifler"],proibido:["AWPer"]},
  "FalleN@SK":{certo:"AWPer"}, // IGL + AWP
  "fer@SK":{certo:"Entry",aceitavel:["Rifler"]},
  "fnx@SK":{certo:"Rifler",aceitavel:["Entry"]},
  "TACO@SK":{certo:"Support",proibido:["AWPer"]},
  // Vitality (Budapest 2025)
  "ZywOo@Vitality":{certo:"AWPer"},
  "ropz@Vitality":{certo:"Lurker",aceitavel:["Rifler"]},
  "mezii@Vitality":{certo:"Support",aceitavel:["Rifler"]},
  "flameZ@Vitality":{certo:"Entry",aceitavel:["Rifler"]},
  "apEX@Vitality":{certo:"Support",aceitavel:["Entry"]}, // IGL entry-support
  // Spirit (Budapest 2025)
  "donk@Spirit":{certo:"Rifler",aceitavel:["Entry"]},
  "sh1ro@Spirit":{certo:"AWPer"},
  "chopper@Spirit":{certo:"Support",aceitavel:["Rifler"]},
  // MongolZ
  "mzinho@MongolZ":{certo:"Rifler",aceitavel:["Entry"]},
  "910@MongolZ":{certo:"AWPer"},
  // EnVyUs (2016)
  "kennyS@EnVyUs":{certo:"AWPer"},
  "NBK-@EnVyUs":{certo:"Support",aceitavel:["Lurker","Rifler"]},
  "Happy@EnVyUs":{certo:"Rifler",aceitavel:["Lurker"]}, // IGL
  "apEX@EnVyUs":{certo:"Entry",aceitavel:["Rifler"]},
  "kioShiMa@EnVyUs":{certo:"Support",aceitavel:["Rifler"]},
  // Cloud9 (Boston 2018)
  "tarik@Cloud9":{certo:"Rifler",aceitavel:["Entry"]}, // IGL
  "autimatic@Cloud9":{certo:"Rifler",aceitavel:["Lurker"]},
  "RUSH@Cloud9":{certo:"Entry",aceitavel:["Support"]},
  "Skadoodle@Cloud9":{certo:"AWPer"},
  "Stewie2K@Cloud9":{certo:"Entry",aceitavel:["Rifler"]},
  // FaZe
  "NiKo@FaZe":{certo:"Rifler",proibido:["Support"]},
  "rain@FaZe":{certo:"Entry",aceitavel:["Rifler"]},
  "GuardiaN@FaZe":{certo:"AWPer"},
  "olofmeister@FaZe":{certo:"Lurker",aceitavel:["Entry","Rifler"]},
  "karrigan@FaZe":{certo:"Support",aceitavel:["Entry","Lurker"]}, // IGL
  // Astralis (Blast/Major era)
  "device@Astralis":{certo:"AWPer"},
  "Xyp9x@Astralis":{certo:"Support",aceitavel:["Lurker"]},
  "Magisk@Astralis":{certo:"Rifler",aceitavel:["Entry"]},
  "dupreeh@Astralis":{certo:"Entry",aceitavel:["Rifler"]},
  "gla1ve@Astralis":{certo:"Support",aceitavel:["Rifler"]}, // IGL
  // G2
  "m0NESY@G2":{certo:"AWPer"},
  "jks@G2":{certo:"Rifler",aceitavel:["Lurker"]},
  "NiKo@G2":{certo:"Rifler",aceitavel:["Entry"]},
  "huNter-@G2":{certo:"Rifler",aceitavel:["Entry"]},
  "HooXi@G2":{certo:"Support"}, // IGL
  // Virtus.pro (classico)
  "pashaBiceps@Virtus.pro":{certo:"Rifler",aceitavel:["Entry","AWPer"]},
  "NEO@Virtus.pro":{certo:"Rifler",aceitavel:["Support","Lurker"]},
  "Snax@Virtus.pro":{certo:"Rifler",aceitavel:["Lurker","Entry"]},
  "byali@Virtus.pro":{certo:"Entry",aceitavel:["Rifler","AWPer"]},
  "TaZ@Virtus.pro":{certo:"Support",aceitavel:["Rifler"]}, // IGL
  // BIG
  "smooya@BIG":{certo:"AWPer"},
  "gob b@BIG":{certo:"Support"}, // IGL
  "tabseN@BIG":{certo:"Rifler",aceitavel:["AWPer","Lurker"]}
};

function combatRole(e){return e.isIGL?e.secundario:e.primario;}

let cobertos=0,total=0,soma=0;
let hits=0,parciais=0,secundarios=0,misses=0,violacoes=0;
const detalhes=[];

X.TEAMS.forEach(t=>{
  t.jogadores.forEach(card=>{
    const e=card._eng;
    total++;
    const nome=e.nome||e.nick;
    const key=`${nome}@${t.nome}`;
    const lab=LABELS[key];
    if(!lab)return;
    cobertos++;
    const eff=combatRole(e);
    const acc=lab.aceitavel||[], prob=lab.proibido||[];
    let nota,tag;
    if(eff===lab.certo){nota=1.0;tag="ok";hits++;}
    else if(acc.includes(eff)){nota=0.6;tag="parcial";parciais++;}
    else if(!e.isIGL&&lab.certo===e.secundario){nota=0.4;tag="2a-funcao";secundarios++;}
    else if(prob.includes(eff)){nota=-1;tag="PROIBIDO";violacoes++;}
    else{nota=0;tag="MISS";misses++;}
    soma+=nota;
    if(tag!=="ok")detalhes.push({key,esperado:lab.certo,acc,teve:eff,tag,nota});
  });
});

const nota=cobertos?soma/cobertos:0;
console.log("— FUNCOES REAIS (FASE 0 · corpus parcial) —");
console.log(`  cobertura: ${cobertos}/${total} jogadores rotulados (${Math.round(cobertos/total*100)}%)`);
console.log(`  concordancia media (0..1): ${nota.toFixed(3)}`);
console.log(`  cheios: ${hits} · parciais: ${parciais} · 2a-funcao: ${secundarios} · miss: ${misses} · proibido: ${violacoes}`);
console.log("\n  divergencias (o que o corpus enxerga que o modelo nao):");
detalhes.sort((a,b)=>a.nota-b.nota).forEach(d=>{
  const alvo=d.acc.length?`${d.esperado} (ac: ${d.acc.join("/")})`:d.esperado;
  console.log(`    ${d.tag.padEnd(9)} ${d.key.padEnd(24)} real=${alvo}  motor=${d.teve}`);
});
