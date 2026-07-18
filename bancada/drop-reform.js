/* bancada/drop-reform.js — guarda estrutural da reformulação baseada no drop.
   Garante que os novos conceitos são globais, mas cirúrgicos no elenco atual:
   Rifler generalista + Facilitador glue + qualidade (ovrW) separada da identidade. */
const {X}=require("./motor");
const {okMark}=require("./common");

let failures=0;
function check(ok,label){console.log(`  ${okMark(!!ok)} ${label}`);if(!ok)failures++;}
const rawOf=e=>({nome:e.nome,nick:e.nick||e.nome,fp:e.fp,en:e.en,tr:e.tr,op:e.op,cl:e.cl,sn:e.sn,ut:e.ut,rating:e.rating,isIGL:!!e.isIGL,colocacao:e.colocacao});
function snapshot(){
  const rows=[];
  X.TEAMS.forEach((team,ti)=>{
    const players=team.jogadores.map(j=>X.avaliarJogador(rawOf(j._eng)));
    X.distribuirRoles(players);
    const final=players.map(p=>X.aplicarAvaliacaoContextual({...p,primario:p.primario,secundario:p.secundario}));
    final.forEach((p,pi)=>rows.push({key:`${ti}:${pi}`,team:team.nome,nome:p.nome,r1:p.role1||p.combatRole,r2:p.role2||p.secundario||p.combatRole,style:X.STYLE_LABEL(p.playstyle),ovr:p.ovr}));
  });
  return rows;
}
function withLegacy(fn){
  const C=X.CFG_AVALIACAO,fac=X.NM_DEF.Facilitador;
  const oldRole=C.RIFLER_GLUE_MAX,oldFac=C.FAC_GLUE_MAX,oldOvr=fac.ovrW;
  try{C.RIFLER_GLUE_MAX=0;C.FAC_GLUE_MAX=0;delete fac.ovrW;return fn();}
  finally{C.RIFLER_GLUE_MAX=oldRole;C.FAC_GLUE_MAX=oldFac;if(oldOvr)fac.ovrW=oldOvr;}
}

console.log("— REFORMA DROP: RIFLER GENERALISTA + FACILITADOR —");
const legacy=withLegacy(snapshot),current=snapshot(),before=new Map(legacy.map(x=>[x.key,x]));
const material=current.filter(x=>{const b=before.get(x.key);return b.r1!==x.r1||b.r2!==x.r2||b.style!==x.style||b.ovr!==x.ovr;});
const drop=current.find(x=>x.nome==="drop"&&x.team==="FURIA");
check(!!drop,"drop existe no elenco FURIA");
// R2 do drop é curado no sandbox (hoje Support) — a essência da reforma é R1=Rifler + Facilitador +
// OVR14 (generalista + glue + ovrW). Não travamos R2, que é valor que o dono muda de propósito.
check(drop&&drop.r1==="Rifler",`drop vira Rifler (${drop&&drop.r1}/${drop&&drop.r2})`);
check(drop&&drop.style==="Facilitador",`drop vira Facilitador (${drop&&drop.style})`);
check(drop&&drop.ovr===14,`drop fica OVR 14 (${drop&&drop.ovr})`);
// o glue é um mecanismo GERAL: além do drop, cobre os Facilitadores de equilíbrio curados (fnx, gla1ve).
// Guarda: o efeito da reforma fica CONFINADO a quem termina Facilitador (seu domínio) e inclui o drop.
check(material.some(x=>x.nome==="drop")&&material.every(x=>x.style==="Facilitador"),`reforma confinada ao domínio Facilitador (${material.map(x=>x.nome).join(", ")||"nenhuma"})`);

const dropRaw=rawOf(X.TEAMS.flatMap(t=>t.jogadores).find(j=>j._eng.nome==="drop")._eng);
const dropRole=X.avaliarJogador({...dropRaw}).combatRole;
const dropNm=X.nmOVR(dropRaw,dropRole);
const scores=X.styleScoreTable(dropNm.s6,dropRole);
const fac=scores.find(x=>X.STYLE_LABEL(x.id)==="Facilitador"),runner=scores.find(x=>x.id!==fac?.id);
check(fac&&runner&&fac.score>runner.score&&fac.score-runner.score>.015,`Facilitador vence com margem útil (${fac&&runner?(fac.score-runner.score).toFixed(3):"-"})`);

const strong={...dropRaw,nome:"Facilitador forte",fp:48,en:52,tr:55,op:30,cl:38,ut:88,rating:1.12};
const strongEv=X.avaliarJogador(strong);
check(X.STYLE_LABEL(strongEv.playstyle)==="Facilitador",`perfil glue forte continua Facilitador (${X.STYLE_LABEL(strongEv.playstyle)})`);
check(strongEv.ovr>drop.ovr,`trade/utility superiores elevam qualidade (${strongEv.ovr}>${drop.ovr})`);

const entry={...dropRaw,nome:"Entry especialista",fp:72,en:84,tr:48,op:70,cl:30,ut:44,rating:1.18};
const entryEv=X.avaliarJogador(entry);
check(entryEv.role1==="Entry"&&X.STYLE_LABEL(entryEv.playstyle)!=="Facilitador",`especialista continua Entry e não vira Facilitador (${entryEv.role1}/${X.STYLE_LABEL(entryEv.playstyle)})`);

console.log(failures?`✗ ${failures} guarda(s) da reforma falharam`:"✓ reforma do drop está cirúrgica e generalizável");
process.exit(failures?1:0);
