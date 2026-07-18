/* tools/verify-report.js — confere se um relatório do sandbox foi aplicado FIELMENTE no game.js.
   Uso: node tools/verify-report.js <relatorio.txt>
   Lê a seção "MUDANCAS FINAIS NO MOTOR" (valores) e "INTENCOES MONITORADAS" (classificações
   esperadas), carrega o game.js atual e checa: (1) cada peso bate o alvo do relatório; (2) cada
   jogador monitorado está classificado como o relatório diz. Só leitura — não altera nada.
   Pega na hora o tipo de erro que já nos mordeu (empate por arredondamento, valor mal editado). */
const fs=require("fs");
const path=require("path");
const {ROOT}=require("../bancada/common");

const reportPath=process.argv[2];
if(!reportPath){console.error("uso: node tools/verify-report.js <relatorio.txt>");process.exit(2);}

const src=fs.readFileSync(path.join(ROOT,"game.js"),"utf8").split("\n");
const cut=src.findIndex(l=>l.includes("// === UI START ==="));
const E=new Function(src.slice(0,cut).join("\n")+"\nreturn {avaliarJogador,STYLE_LABEL,TEAMS,NM_DEF,CFG_AVALIACAO,ROLE_CONTRA,IGL_ROLE_AFIN,ROLE_RULES,STYLE_CONTRA};")();
const ROOTS={NM_DEF:E.NM_DEF,CFG_AVALIACAO:E.CFG_AVALIACAO,ROLE_CONTRA:E.ROLE_CONTRA,IGL_ROLE_AFIN:E.IGL_ROLE_AFIN,ROLE_RULES:E.ROLE_RULES,STYLE_CONTRA:E.STYLE_CONTRA};

function getByPath(p){
  // ROLE_RULES.X.Y.w → ROLE_RULES[X][Y].w ; NM_DEF.X.w.Y → NM_DEF[X].w[Y] ; etc.
  const seg=p.split(".");let o=ROOTS[seg[0]];
  for(let i=1;i<seg.length&&o!=null;i++)o=o[seg[i]];
  return o;
}
function classify(nome){
  const pl=E.TEAMS.flatMap(t=>t.jogadores).map(j=>j._eng).find(e=>e.nome===nome);
  if(!pl)return null;const ev=E.avaliarJogador({...pl});
  return {r1:ev.role1||ev.combatRole,r2:ev.role2||ev.secundario,style:E.STYLE_LABEL(ev.playstyle),ovr:Math.round(ev.ovr)};
}

const txt=fs.readFileSync(reportPath,"utf8").split("\n");
let fails=0;
const section=name=>{const i=txt.findIndex(l=>l.includes(name));return i<0?[]:txt.slice(i+1).slice(0,txt.slice(i+1).findIndex(l=>l.startsWith("===")||l.trim()===""&&false)).filter(l=>l.trim());};

// (1) valores dos pesos
console.log("— VALORES (MUDANCAS FINAIS) —");
for(const l of txt){
  const m=l.match(/^([A-Za-z0-9_.\-]+):\s*(-?[\d.]+)\s*->\s*(-?[\d.]+)\s*$/);
  if(!m)continue;
  const [,p,,to]=m,cur=getByPath(p),target=+to;
  const ok=cur!=null&&Math.abs(cur-target)<5e-4;
  if(!ok){fails++;console.log(`  ✗ ${p}: game.js=${cur} esperado=${target}`);}
}

// (2) intenções: bloco "nome (time)" + linha "Atual: R1 / R2 · Style · OVR N"
console.log("— INTENÇÕES MONITORADAS —");
for(let i=0;i<txt.length;i++){
  const head=txt[i].match(/^([^\s(][^(]*?)\s*\(([^)]+)\)\s*$/);
  const atual=(txt[i+2]||"").match(/Atual:\s*(\S+)\s*\/\s*(\S+)\s*·\s*(\S+)\s*·\s*OVR\s*(\d+)/);
  if(head&&atual&&/Esperado:/.test(txt[i+1]||"")){
    const nome=head[1].trim(),[, r1,r2,style,ovr]=atual,c=classify(nome);
    const ok=c&&c.r1===r1&&c.r2===r2&&c.style===style&&c.ovr===+ovr;
    if(!ok)fails++;
    console.log(`  ${ok?"✓":"✗"} ${nome}: ${c?`${c.r1}/${c.r2}·${c.style}·${c.ovr}`:"ausente"} ${ok?"":`(esperado ${r1}/${r2}·${style}·${ovr})`}`);
  }
}

console.log(fails?`\n✗ ${fails} divergência(s) — relatório NÃO aplicado fielmente`:"\n✓ relatório aplicado fielmente");
process.exit(fails?1:0);
