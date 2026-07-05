#!/usr/bin/env node
/* tools/add-team.js — adiciona um time ao jogo a partir de um bloco de texto simples.
   Insere os 5 jogadores no ATRIBUTOS e o time no TIMES_DEF (nas âncoras @jogadores/@times
   do game.js), regenera a Base de Elencos e roda o lint. Sem tocar em nada manualmente.

   Uso:  node tools/add-team.js caminho/do/time.txt
         node tools/add-team.js -   (lê do stdin)

   Formato esperado (o mesmo que você já manda no chat):
     NOME | CAMPEONATO | Colocação: Vice-campeão | Treinador: kakafu | País (Treinador): AUT | Cor: #e9edf3
      tabseN — País: GER | Rating: 1.18 | IGL: Não | Stats: FP: 90, EN: 33, TR: 13, OP: 82, CL: 46, SN: 84, UT: 89
      ... (5 jogadores)
   "Cor:" é opcional (se faltar, escolhe uma cor livre da paleta e avisa).
*/
const fs=require("fs"),path=require("path"),{execFileSync}=require("child_process");
const ROOT=path.join(__dirname,"..");const GAME=path.join(ROOT,"game.js");

// ——— normalizações ———
const PAIS={UK:"GBR",ENG:"GBR",UAE:"ARE",POR:"PRT",HOL:"NLD",NED:"NLD"}; // apelidos → ISO3 do jogo
const norm=p=>{p=(p||"").trim().toUpperCase();return PAIS[p]||p;};
const COLOC=t=>{t=(t||"").toLowerCase();
  if(/campe|winner|1º|1st/.test(t)&&!/vice/.test(t))return"Campeao";
  if(/vice|final|runner|2º|2nd/.test(t))return"Final";
  if(/semi|top ?4|3º|4º|3rd|4th/.test(t))return"Top4";
  if(/quart|top ?8|5º|6º|7º|8º/.test(t))return"Top8";
  return"Grupos";};
const yes=v=>/^(sim|s|yes|y|true|1)$/i.test((v||"").trim());
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]/g,"")||"t";
// paleta de reserva (evita colisão com cores já usadas); só entra se o usuário não mandar Cor:
const PALETA=["#5b8cff","#ff8a3d","#c86bff","#00c2a8","#ff5aa8","#7bd23c","#f0c020","#33c0ff","#ff6a5a","#9aa7b8"];

function parse(txt){
  const linhas=txt.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if(!linhas.length)throw new Error("entrada vazia");
  // — linha do time —
  const tp=linhas[0].split("|").map(s=>s.trim());
  const kv={};tp.slice(2).forEach(seg=>{const i=seg.indexOf(":");if(i>0)kv[seg.slice(0,i).trim().toLowerCase()]=seg.slice(i+1).trim();});
  const pick=(...ks)=>{for(const k of ks)for(const kk in kv)if(kk.includes(k))return kv[kk];};
  const time={nome:tp[0],camp:tp[1]||"",colocacao:COLOC(pick("coloca")),
    coach:pick("treina","coach")||null,coachPais:norm(pick("país (trein","pais (trein","país do trein","pais do trein")||pick("país trein","pais trein")),
    cor:(pick("cor","color")||"").trim()};
  // — jogadores —
  const jogadores=linhas.slice(1).map(l=>{
    const [nickRaw,resto]=l.split(/—|–| - /);
    if(!resto)throw new Error(`linha de jogador sem "—": ${l}`);
    const seg={};resto.split("|").forEach(s=>{const i=s.indexOf(":");if(i>0)seg[s.slice(0,i).trim().toLowerCase()]=s.slice(i+1).trim();});
    const stats={};(seg["stats"]||"").split(",").forEach(s=>{const m=s.match(/([a-z]{2})\s*:\s*(\d+)/i);if(m)stats[m[1].toLowerCase()]=+m[2];});
    return {nick:nickRaw.trim(),pais:norm(seg["país"]||seg["pais"]),rating:parseFloat(seg["rating"]),
      isIGL:yes(seg["igl"]),stats};
  });
  return {time,jogadores};
}

function main(){
  const arg=process.argv[2];
  if(!arg){console.error("uso: node tools/add-team.js <arquivo.txt | ->");process.exit(2);}
  const txt=arg==="-"?fs.readFileSync(0,"utf8"):fs.readFileSync(arg,"utf8");
  const {time,jogadores}=parse(txt);
  const avisos=[];

  // validação básica antes de tocar no arquivo
  if(jogadores.length!==5)avisos.push(`${jogadores.length} jogadores (esperado 5)`);
  const ATTRS=["fp","en","tr","op","cl","sn","ut"];
  jogadores.forEach(j=>{ATTRS.forEach(a=>{const v=j.stats[a];if(typeof v!=="number"||v<0||v>100)throw new Error(`${j.nick}: atributo ${a.toUpperCase()}=${v} inválido (0–100)`);});
    if(!(j.rating>=0.5&&j.rating<=2.0))avisos.push(`${j.nick}: rating ${j.rating} fora de 0.5–2.0`);});
  if(!jogadores.some(j=>j.isIGL))avisos.push("nenhum IGL marcado");

  let game=fs.readFileSync(GAME,"utf8");
  if(!game.includes("//@jogadores")||!game.includes("//@times"))throw new Error("âncoras //@jogadores / //@times não encontradas no game.js");

  // IDs: se o nick já existe no pool, cria id único nick_timeslug
  const existentes=new Set([...game.matchAll(/\{(?:id:"([^"]+)",)?nome:"([^"]+)"/g)].map(m=>m[1]||m[2]));
  const ts=slug(time.nome);
  const keys=jogadores.map(j=>{
    let key=j.nick;
    if(existentes.has(key)){key=`${slug(j.nick)}_${ts}`;avisos.push(`nick "${j.nick}" já existe → id "${key}"`);}
    existentes.add(key);j._key=key;return key;
  });

  // cor: usa a informada; senão escolhe uma livre da paleta
  if(!time.cor){
    const usadas=new Set([...game.matchAll(/cor:"(#[0-9a-fA-F]{3,6})"/g)].map(m=>m[1].toLowerCase()));
    time.cor=PALETA.find(c=>!usadas.has(c.toLowerCase()))||PALETA[0];
    avisos.push(`sem Cor: informada → escolhida ${time.cor} (troque depois se quiser)`);
  }

  // monta as linhas
  const q=s=>`"${String(s).replace(/"/g,'\\"')}"`;
  const linhasJog=jogadores.map(j=>{const s=j.stats;const idp=j._key!==j.nick?`id:${q(j._key)},`:"";
    return `  {${idp}nome:${q(j.nick)},pais:${q(j.pais)},fp:${s.fp},en:${s.en},tr:${s.tr},op:${s.op},cl:${s.cl},sn:${s.sn},ut:${s.ut},rating:${j.rating},colocacao:${q(time.colocacao)},isIGL:${j.isIGL}},`;
  }).join("\n");
  const coachF=time.coach?`coach:${q(time.coach)},coachPais:${q(time.coachPais||"—")},`:"coach:null,";
  const linhaTime=`  {nome:${q(time.nome)},cor:${q(time.cor)},${coachF}camp:${q(time.camp)},colocacao:${q(time.colocacao)},jogadores:[${keys.map(q).join(",")}]},`;

  // insere nas âncoras
  game=game.replace("  //@jogadores",`  // ——— ${time.nome} · ${time.camp} (${time.colocacao}) ———\n${linhasJog}\n  //@jogadores`);
  game=game.replace("  //@times",`${linhaTime}\n  //@times`);
  fs.writeFileSync(GAME,game);

  // valida sintaxe, regenera elencos e roda o lint (fresh, em processos separados)
  execFileSync("node",["--check",GAME],{stdio:"inherit"});
  execFileSync("node",[path.join(ROOT,"bancada","roster.js")],{stdio:"inherit"});
  console.log("");
  try{execFileSync("node",[path.join(ROOT,"bancada","times.js")],{stdio:"inherit"});}catch(e){/* lint imprime e sai ≠0; segue pra mostrar avisos */}

  if(avisos.length){console.log("\n⚠ avisos:");avisos.forEach(a=>console.log("  · "+a));}
  console.log(`\n✓ ${time.nome} adicionado. Revise o resumo acima; depois: bancadas + smoke + deploy.`);
}
main();
