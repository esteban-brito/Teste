/* A MARCA VISUAL DOS MAPAS — contrato de 07/08/2026.
   ══════════════════════════════════════════════════════════════════════════════

   O pedido foi que a pessoa saiba qual mapa é "sem nem ler". Isso só se sustenta
   se três coisas forem verdade ao mesmo tempo, e nenhuma delas se vê olhando uma
   tela por vez:

     1. TODO mapa do pool tem marca. Um mapa novo entrando em `MAPAS_POOL` sem
        passar por `map-identity` cairia no neutro e ficaria indistinguível dos
        outros esquecidos;
     2. As cores são distinguíveis ENTRE SI. Sete manchas bonitas que se
        confundem duas a duas não cumprem o pedido;
     3. A tinta é legível sobre cada cor. É a regra 46 outra vez: contraste que
        depende de qual mapa foi sorteado só reprova de vez em quando, e o
        domínio inteiro cabe numa varredura. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");

const RAIZ=path.resolve(__dirname,"..");
const url=rel=>pathToFileURL(path.join(RAIZ,rel)).href;

/* Distância perceptual barata em CIELAB. Não é CIEDE2000, e não precisa ser: o
   que se quer aqui é um piso de "não confunde", não uma métrica de indústria
   gráfica. O piso foi calibrado medindo o par mais próximo que o olho ainda
   separa confortavelmente numa mancha pequena. */
function lab(hex){
  const s=String(hex).replace("#","");
  const [r,g,b]=[0,2,4].map(i=>parseInt(s.slice(i,i+2),16)/255)
    .map(c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4);
  const x=(0.4124*r+0.3576*g+0.1805*b)/0.95047;
  const y=(0.2126*r+0.7152*g+0.0722*b);
  const z=(0.0193*r+0.1192*g+0.9505*b)/1.08883;
  const f=t=>t>0.008856?Math.cbrt(t):(7.787*t)+16/116;
  return [116*f(y)-16,500*(f(x)-f(y)),200*(f(y)-f(z))];
}
const distancia=(a,b)=>{
  const [l1,a1,b1]=lab(a),[l2,a2,b2]=lab(b);
  return Math.hypot(l1-l2,a1-a2,b1-b2);
};

const PISO_DISTANCIA=18;   // separação mínima entre duas marcas
const PISO_CONTRASTE=4.5;  // WCAG AA para texto normal

async function main(){
  const {MAPA_MARCA,marcaDoMapa}=await import(url("src/ui/shared/map-identity.mjs"));
  const {contraste}=await import(url("src/ui/shared/contrast.mjs"));
  const {MAPAS_POOL}=await import(url("src/domain/simulation/simulation-config.mjs"));

  /* 1 — COBERTURA. */
  for(const mapa of MAPAS_POOL)
    assert.ok(MAPA_MARCA[mapa],`o mapa "${mapa}" está no pool e não tem marca visual`);
  for(const mapa of Object.keys(MAPA_MARCA))
    assert.ok(MAPAS_POOL.includes(mapa),`"${mapa}" tem marca visual e não está mais no pool (órfão)`);

  /* 2 — DISTINGUIBILIDADE, par a par. */
  let pior={d:Infinity,par:null};
  for(let i=0;i<MAPAS_POOL.length;i++)
    for(let j=i+1;j<MAPAS_POOL.length;j++){
      const [a,b]=[MAPAS_POOL[i],MAPAS_POOL[j]];
      const d=distancia(MAPA_MARCA[a].cor,MAPA_MARCA[b].cor);
      if(d<pior.d)pior={d,par:`${a}×${b}`};
    }
  assert.ok(pior.d>=PISO_DISTANCIA,
    `as marcas de ${pior.par} estão a ${pior.d.toFixed(1)} de distância; o piso é ${PISO_DISTANCIA}`);

  /* 3 — CONTRASTE DA TINTA sobre cada cor. */
  let piorContraste={c:Infinity,mapa:null};
  for(const mapa of MAPAS_POOL){
    const {cor,tinta}=marcaDoMapa(mapa);
    const c=contraste(cor,tinta);
    if(c<piorContraste.c)piorContraste={c,mapa};
  }
  assert.ok(piorContraste.c>=PISO_CONTRASTE,
    `a tinta sobre ${piorContraste.mapa} dá ${piorContraste.c.toFixed(2)}:1, abaixo de ${PISO_CONTRASTE}`);

  /* 4 — O AMBIENTE NÃO PODE CUSTAR LEGIBILIDADE.
     Cada mapa tinge o fundo da antessala e da partida com `ceu`→`chao`. Sobre
     esse fundo continua havendo o texto do corpo (`--txt`) e o texto secundário
     (`--dim`), e os dois precisam continuar legíveis nos SETE ambientes — é a
     regra 46: contraste que depende de qual mapa caiu só reprova de vez em
     quando, e aqui o domínio inteiro cabe numa varredura. */
  const TXT="#f3f7fb",DIM="#9aa8ba";
  let piorAmbiente={c:Infinity,onde:null};
  for(const mapa of MAPAS_POOL){
    const {ceu,chao}=MAPA_MARCA[mapa];
    for(const [nome,fundo] of [["céu",ceu],["chão",chao]]){
      for(const [rot,tinta,piso] of [["corpo",TXT,4.5],["apoio",DIM,4.5]]){
        const c=contraste(fundo,tinta);
        if(c<piorAmbiente.c)piorAmbiente={c,onde:`${rot} sobre o ${nome} de ${mapa}`};
        assert.ok(c>=piso,
          `${rot} sobre o ${nome} de ${mapa} dá ${c.toFixed(2)}:1, abaixo de ${piso}`);
      }
    }
  }

  /* 4-bis — A COR DO MAPA COMO TEXTO SOBRE O PRÓPRIO AMBIENTE.
     Desde 07/08/2026 o nome do mapa da vez é escrito NA cor do mapa, sobre o
     fundo daquele mesmo mapa — dois valores que vêm do mesmo par e podem se
     aproximar sem que ninguém perceba ao ajustar um deles. É o caso clássico de
     regressão silenciosa: mexer no `ceu` para separar dois ambientes pode apagar
     o nome do mapa em cima dele. */
  let piorNome={c:Infinity,mapa:null};
  for(const mapa of MAPAS_POOL){
    const {ceu,chao}=MAPA_MARCA[mapa];
    for(const fundo of [ceu,chao]){
      const c=contraste(marcaDoMapa(mapa).nome,fundo);
      if(c<piorNome.c)piorNome={c,mapa};
      assert.ok(c>=PISO_CONTRASTE,
        `o nome de ${mapa} sobre o próprio ambiente dá ${c.toFixed(2)}:1`);
    }
  }

  /* 5 — E OS AMBIENTES PRECISAM SER DISTINGUÍVEIS ENTRE SI, senão "o mapa
     transforma a interface" vira sete telas iguais com um chip diferente. O piso
     é menor que o das marcas porque fundo escuro tem pouca margem de croma —
     mas não pode ser zero, que é o que aconteceria com um fundo só. */
  let piorAmbientePar={d:Infinity,par:null};
  for(let i=0;i<MAPAS_POOL.length;i++)
    for(let j=i+1;j<MAPAS_POOL.length;j++){
      const [a,b]=[MAPAS_POOL[i],MAPAS_POOL[j]];
      const d=distancia(MAPA_MARCA[a].ceu,MAPA_MARCA[b].ceu);
      if(d<piorAmbientePar.d)piorAmbientePar={d,par:`${a}×${b}`};
    }
  assert.ok(piorAmbientePar.d>=4,
    `os ambientes de ${piorAmbientePar.par} são quase idênticos (${piorAmbientePar.d.toFixed(1)})`);

  /* 6 — MAPA DESCONHECIDO não quebra a tela. */
  const fallback=marcaDoMapa("MapaQueNaoExiste");
  assert.ok(fallback.cor&&fallback.tinta&&fallback.ceu&&fallback.chao,
    "mapa fora do catálogo não devolveu marca utilizável");

  console.log(`map identity: ok (${MAPAS_POOL.length} mapas`
    +` · marcas a ${pior.d.toFixed(1)} (${pior.par})`
    +` · tinta ${piorContraste.c.toFixed(2)}:1`
    +` · ambiente ${piorAmbiente.c.toFixed(2)}:1`
    +` · nome sobre ambiente ${piorNome.c.toFixed(2)}:1)`);
}

main().catch(error=>{console.error(error);process.exitCode=1;});
