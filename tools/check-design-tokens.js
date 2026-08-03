/* Prova o SISTEMA DE COR de `style.css` — e a paleta que `elencos.html` copia.
   ══════════════════════════════════════════════════════════════════════════════

   POR QUE ISTO EXISTE. Até 02/08/2026 a folha tinha 225 hexadecimais e 178
   `rgba()` literais contra ~40 tokens. Não era ruído: eram cores CONCORRENTES
   para o mesmo papel. `--accent` (#ff6b2a) convivia com 26 usos crus de
   `rgba(255,90,31,…)` (#ff5a1f), e a mesma regra chegava a misturar os dois —
   `.slot.avail` tinha a borda num laranja e o `+` do filho no outro. O lado CT da
   tira de rounds era pintado por `var(--c-desenvolvedor)`, o token da
   CARACTERÍSTICA DE TREINADOR, igual por coincidência numérica: rebalancear a cor
   do Desenvolvedor repintava o placar.

   Nada disso quebrava teste nenhum, porque nenhum media isso.

   O QUE É COBRADO, e por quê cada coisa:

   1. PARES hex ↔ triplo RGB. Cada cor tokenizada existe em duas formas porque
      `color-mix(in srgb,C p%,transparent)` NÃO é bit-idêntico a `rgba(C,p)` no
      Chromium — medido, ele desloca a página inteira em 1/255. A forma
      `rgba(var(--x-rgb),a)` é exata, e o preço é a duplicação. Ela não é
      proibida: é verificada aqui.

   2. LITERAIS REGREDIDOS. Nenhuma das cores já tokenizadas pode voltar como
      literal cru. É o que impede a paleta de se dissolver de novo, uma regra
      nova por vez.

   3. PALETA COMPARTILHADA com `elencos.html`, que é autônomo e mantém a própria
      cópia. `check-roster-sync.js` já cobre as seis cores de função e os cortes
      de raridade; aqui vão as cores de chrome que o arquivo declara estarem
      "sincronizadas com style.css" e que ninguém conferia. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const RAIZ=path.join(__dirname,"..");
const css=fs.readFileSync(path.join(RAIZ,"style.css"),"utf8");
const roster=fs.readFileSync(path.join(RAIZ,"elencos.html"),"utf8");

const semComentario=texto=>texto.replace(/\/\*[\s\S]*?\*\//g,"");
const cssLimpo=semComentario(css);

/** Valor declarado de um token, em qualquer bloco. */
function token(fonte,nome){
  const achado=fonte.match(new RegExp(`${nome}\\s*:\\s*([^;}]+)`));
  return achado?achado[1].trim():null;
}

const hexParaTriplo=hex=>{
  const h=hex.replace("#","");
  const largo=h.length===3?h.split("").map(c=>c+c).join(""):h;
  return [0,2,4].map(i=>parseInt(largo.slice(i,i+2),16)).join(",");
};

/* ── 1 · cada par hex ↔ rgb denota a mesma cor ─────────────────────────────── */
function paresCoerentes(){
  const pares=[...cssLimpo.matchAll(/(--[a-z0-9-]+)-rgb\s*:\s*([\d\s,]+?)\s*[;}]/g)]
    .map(m=>[m[1],m[2].replace(/\s/g,"")]);
  assert.ok(pares.length>=10,`esperava ao menos 10 tokens -rgb, vi ${pares.length}`);
  let conferidos=0;
  for(const [nome,triplo] of pares){
    const hex=token(cssLimpo,nome+"\\s*(?!-rgb)");
    /* Nem todo triplo precisa de par hex: alguns papéis só existem translúcidos.
       Quando o par existe, ele TEM de bater. */
    if(!hex||!/^#[0-9a-fA-F]{3,6}$/.test(hex))continue;
    assert.equal(hexParaTriplo(hex),triplo,
      `${nome}: hex ${hex} e ${nome}-rgb ${triplo} são cores diferentes`);
    conferidos++;
  }
  assert.ok(conferidos>=8,`esperava ao menos 8 pares hex↔rgb conferidos, vi ${conferidos}`);
  return {pares:pares.length,conferidos};
}

/* ── 2 · cor tokenizada não pode voltar como literal ───────────────────────── */
function semLiteralRegredido(){
  const triplos=new Map();
  for(const m of cssLimpo.matchAll(/(--[a-z0-9-]+)-rgb\s*:\s*([\d\s,]+?)\s*[;}]/g))
    triplos.set(m[2].replace(/\s/g,""),m[1]);
  const ofensas=[];
  for(const m of cssLimpo.matchAll(/rgba\((\d+\s*,\s*\d+\s*,\s*\d+)\s*,/g)){
    const triplo=m[1].replace(/\s/g,"");
    if(triplos.has(triplo)){
      const linha=cssLimpo.slice(0,m.index).split("\n").length;
      ofensas.push(`linha ${linha}: rgba(${triplo},…) devia ser rgba(var(${triplos.get(triplo)}-rgb),…)`);
    }
  }
  /* Hex sólido das mesmas cores, fora da própria declaração do token. */
  for(const nome of triplos.values()){
    const hex=token(cssLimpo,nome+"\\s*(?!-rgb)");
    if(!hex||!/^#[0-9a-fA-F]{6}$/.test(hex))continue;
    const re=new RegExp(hex,"gi");
    for(const m of cssLimpo.matchAll(re)){
      /* A REGRA: um TOKEN pode guardar qualquer literal; uma propriedade normal
         não. Isso preserva os sistemas que têm paleta própria e coincidem em
         valor — a escada de raridade da carta usa `#3ec07e` em `--m-ink` e em
         `--aro-pintura`, e é o mesmo verde de `--t2-green` por coincidência, não
         por parentesco: a faixa 2 e o selo de classificado são papéis diferentes
         e devem poder divergir. Forçar `var(--t2-green)` ali codificaria a
         coincidência como se fosse intenção — o mesmo erro que já pintou o lado
         CT com o token da característica de treinador. */
      const trecho=cssLimpo.slice(Math.max(0,m.index-260),m.index);
      const abre=trecho.lastIndexOf("{"),ponto=trecho.lastIndexOf(";");
      const declaracao=trecho.slice(Math.max(abre,ponto)+1);
      if(/^\s*--[a-z0-9-]+\s*:/.test(declaracao))continue;
      const linha=cssLimpo.slice(0,m.index).split("\n").length;
      ofensas.push(`linha ${linha}: ${hex} devia ser var(${nome})`);
    }
  }
  assert.equal(ofensas.length,0,"cor tokenizada voltou como literal:\n  "+ofensas.join("\n  "));
  return triplos.size;
}

/* ── 3 · paleta que `elencos.html` declara copiar de `style.css` ───────────── */
function paletaCompartilhada(){
  const COMPARTILHADOS=["--panel2","--line","--accent","--cyan","--dim"];
  const rosterLimpo=semComentario(roster);
  for(const nome of COMPARTILHADOS){
    const naFolha=token(cssLimpo,nome+"\\b");
    const naLista=token(rosterLimpo,nome+"\\b");
    assert.ok(naFolha,`style.css não declara mais ${nome}`);
    assert.ok(naLista,`elencos.html não declara mais ${nome} — ele afirma copiar a paleta`);
    assert.equal(naLista.toLowerCase(),naFolha.toLowerCase(),
      `${nome} divergiu: style.css ${naFolha} · elencos.html ${naLista}`);
  }
  return COMPARTILHADOS.length;
}

function main(){
  const p=paresCoerentes();
  const tokenizadas=semLiteralRegredido();
  const compartilhados=paletaCompartilhada();
  console.log(`design tokens: ok (${p.conferidos} pares hex↔rgb · ${tokenizadas} cores sem literal solto · `+
    `${compartilhados} tokens compartilhados com elencos.html)`);
}
main();
