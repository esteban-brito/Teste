/* bancada/suites/memoria.js - núcleo puro de MEMÓRIA (marcos, recordes, manchete, narrativa MVP).
   Contratos: determinismo total (mesmo mapa => mesma manchete; zero consumo de RNG), extração
   correta de marcos da perspectiva do MEU time, merge de recordes só quando o valor supera o
   atual, e prioridade correta das manchetes. Roda fixtures sintéticos + um mapa REAL semeado. */
const {X,T}=require("../lib/motor");
const {okMark}=require("../lib/common");

let failures=0;
const check=(ok,label)=>{console.log(`  ${okMark(!!ok)} ${label}`);if(!ok)failures++;};

console.log("— MEMÓRIA: marcos, recordes e narrativa —");

// ——— fixture sintético: mapa meu com clutch 1v3 vencido, virada e carry ———
const fx={
  placar:[13,10],half1:[4,8],mapa:"Inferno",totalRounds:23,
  nomeA:"Meu Time",nomeB:"Rivais",meuA:true,meuB:false,
  rounds:[
    {venceA:true,clutchX:3,clutchWon:true},   // clutch 1v3 do lado A (meu)
    {venceA:false,clutchX:4,clutchWon:true},  // clutch do ADVERSÁRIO — não pode virar meu marco
    {venceA:true,clutchX:2,clutchWon:false}   // clutch perdido — não conta
  ],
  statsA:[{nick:"alfa",k:30,d:14,a:5,rating:1.52,kast:.8,adr:101},
          {nick:"beta",k:12,d:15,a:9,rating:0.98,kast:.7,adr:64}],
  statsB:[{nick:"x",k:20,d:20,a:4,rating:1.1,kast:.7,adr:80}]
};

// coletarMarcos: perspectiva + valores
const m=X.coletarMarcos(fx);
check(m&&m.adv==="Rivais"&&m.venceu===true,"marcos: perspectiva do meu time (adv/vitória)");
check(m.kills.v===30&&m.kills.nick==="alfa","marcos: top de kills do mapa");
check(m.rating.v===1.52&&m.adr.v===101,"marcos: top de rating e ADR");
check(m.clutch&&m.clutch.v===3,"marcos: maior clutch é o MEU 1v3 (ignora o do adversário e o perdido)");
check(m.comeback&&m.comeback.v===4,"marcos: virada medida do intervalo (4-8 → vitória)");
check(m.margem&&m.margem.v===3,"marcos: margem de vitória");
check(X.coletarMarcos({...fx,meuA:false})===null,"marcos: mapa que não é meu retorna null");

// atualizarRecordes: só supera quando maior; lista de novos correta
const rec={};
const novos1=X.atualizarRecordes(rec,m,{data:"2026-07-24"});
check(novos1.length===6&&rec.kills.v===30&&rec.kills.data==="2026-07-24","recordes: primeira leva registra tudo com data");
const fraco={...m,kills:{v:10,nick:"beta"},rating:{v:1.0,nick:"beta"},adr:{v:50,nick:"beta"},clutch:null,margem:{v:1},comeback:null};
const novos2=X.atualizarRecordes(rec,fraco,{data:"2026-07-25"});
check(novos2.length===0&&rec.kills.v===30&&rec.kills.data==="2026-07-24","recordes: valores menores não sobrescrevem");
const forte={...m,kills:{v:34,nick:"alfa"}};
const novos3=X.atualizarRecordes(rec,forte,{data:"2026-07-26"});
check(novos3.length===1&&novos3[0].chave==="kills"&&rec.kills.v===34,"recordes: só o marco superado vira recorde novo");
check(X.atualizarRecordes(rec,null,{}).length===0,"recordes: marcos null é no-op");

// manchete: prioridade + determinismo + zero RNG
const m1=X.manchete(fx);
check(m1.tipo==="clutch"&&m1.texto.includes("1v3"),"manchete: clutch 1v3 tem prioridade máxima");
check(X.manchete(fx).texto===m1.texto,"manchete: determinística (mesmo mapa => mesmo texto)");
const semClutch={...fx,rounds:[]};
check(X.manchete({...semClutch,totalRounds:27}).tipo==="ot","manchete: OT vem antes de virada");
check(X.manchete(semClutch).tipo==="virada","manchete: virada (4-8 no intervalo, vitória)");
const semDrama={...semClutch,half1:[7,5]};
check(X.manchete(semDrama).tipo==="carry","manchete: carry (rating 1.52 do vencedor)");
const morno={...semDrama,statsA:[{nick:"alfa",k:15,d:14,a:3,rating:1.2,kast:.7,adr:80}]};
check(X.manchete({...morno,placar:[13,3]}).tipo==="atropelo","manchete: atropelo por margem ≥10");
check(X.manchete({...morno,placar:[13,11]}).tipo==="equilibrio","manchete: jogo apertado (margem ≤2)");
check(X.manchete({...morno,placar:[13,7]}).tipo==="padrao","manchete: caso padrão");

// narrativaMVP
const camp={mapasV:9,mapasD:0,ratings:{
  alfa:{r:[1.5,1.3,1.6],k:80,d:50,a:12},
  beta:{r:[1.0,1.1,0.9],k:40,d:55,a:20}}};
const nv=X.narrativaMVP(camp);
check(nv&&nv.nick==="alfa","narrativaMVP: elege o maior rating médio");
check(nv.texto.includes("1.47")&&nv.texto.includes("1.60"),"narrativaMVP: média e pico no texto");
check(nv.texto.includes("nenhum mapa perdido"),"narrativaMVP: campanha invicta celebrada");
check(X.narrativaMVP({ratings:{}})===null,"narrativaMVP: sem dados retorna null");

// ——— mapa REAL semeado: funções aguentam a saída verdadeira do motor sem RNG extra ———
X.srand(20260724);
const gReal=X.simularMapa({...T[0],meu:true},T[1],null,null,null,false);
X.srand(20260724);
const gRepet=X.simularMapa({...T[0],meu:true},T[1],null,null,null,false);
const mReal=X.coletarMarcos({...gReal,meuA:true,meuB:false});
const hReal=X.manchete(gReal),hRepet=X.manchete(gRepet);
check(mReal&&mReal.kills.v>0&&Number.isFinite(mReal.rating.v),"real: marcos extraídos de um mapa do motor");
check(hReal.texto.length>10&&hReal.texto===hRepet.texto,"real: manchete determinística sobre o motor semeado");

console.log(failures?`✗ ${failures} contrato(s) de memória falharam`:"✓ memória: marcos, recordes e narrativa fiéis");
process.exit(failures?1:0);
