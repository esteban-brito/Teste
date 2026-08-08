/* Tinta legível sobre uma cor vinda do DADO.
   ══════════════════════════════════════════════════════════════════════════════

   POR QUE ISTO EXISTE. O monograma do time pinta a sigla sobre a cor do clube, e
   a cor do clube é dado — 17 valores que ninguém escolheu pensando em legibilidade.
   Com a tinta fixa em `#0a0d13`, medido em 07/08/2026, DOIS times reprovavam o
   piso de 4,5:1 da WCAG: G2 (#e4002b) em 4,01:1 e Astralis (#e2231a) em 4,16:1.

   E o defeito era INTERMITENTE, que é por que ele durou: o adversário é sorteado,
   então a mesma tela passava ou reprovava dependendo de quem apareceu. Uma
   varredura de uma partida só tem 2/17 de chance de ver cada caso.

   A correção não é escolher outra tinta fixa — nenhuma serve para #e9edf3 (BIG) e
   #e2231a (Astralis) ao mesmo tempo. É escolher POR COR, comparando os dois
   contrastes reais e ficando com o maior.

   QUEM VARRE O DOMÍNIO É `tools/check-team-identity.js`: ele mede os 17 clubes,
   não uma amostra, e reprova se algum ficar abaixo do piso. Isto está escrito
   aqui porque até 07/08/2026 este comentário citava um `check-team-monogram.js`
   que NUNCA existiu — a única prova real eram três cores pontuais em
   `check-game-view-modules.js`, escolhidas à mão. Comentário que promete guarda
   é pior que comentário nenhum: ele faz a próxima sessão confiar no que não
   está sendo medido.

   E AS TINTAS SÃO AS PONTAS PURAS, o que não é preciosismo — é o que a medição
   exigiu. Com as cores da paleta (`#0a0d13` e `--txt` `#f3f7fb`), escolher a
   melhor das duas ainda deixava Astralis em 4,35:1, abaixo do piso. Medido:

       tinta fixa #0a0d13 .... pior 4,01:1 · 2 reprovam
       tinta fixa #f3f7fb .... pior 1,09:1 · 16 reprovam
       melhor de #0a0d13/#f3f7fb ......... 1 reprova  (Astralis 4,35)
       melhor de #000/#fff ... pior 4,68:1 · 0 reprovam

   Os 4 níveis que separam `#0a0d13` de `#000` são imperceptíveis no monograma e
   valem exatamente a margem que faltava. */

/** Tintas disponíveis: as duas pontas puras. Ver a medição acima — a paleta
    intermediária não fecha o piso para os dois vermelhos do catálogo. */
export const TINTA_ESCURA="#000000";
export const TINTA_CLARA="#ffffff";

/* EXPORTADO porque a expansão do hex curto erra em silêncio quando duplicada:
   `#123` sem expandir vira `18,3,NaN`, e `NaN` num `rgba()` não pinta nada —
   a tela fica sem cor e nada reclama. Foi assim que `estiloDoTime` nasceu
   quebrado em 07/08/2026, pego pela guarda de views. */
export const canais=hex=>{
  const s=String(hex).replace("#","").trim();
  const largo=s.length===3?[...s].map(c=>c+c).join(""):s;
  return [0,2,4].map(i=>parseInt(largo.slice(i,i+2),16));
};

/** Luminância relativa da WCAG 2.x. */
export function luminancia(hex){
  const linear=c=>{c/=255;return c<=0.03928?c/12.92:((c+0.055)/1.055)**2.4;};
  const [r,g,b]=canais(hex);
  return 0.2126*linear(r)+0.7152*linear(g)+0.0722*linear(b);
}

/** Razão de contraste entre duas cores, na ordem que for. */
export function contraste(a,b){
  const [alto,baixo]=[luminancia(a),luminancia(b)].sort((x,y)=>y-x);
  return (alto+0.05)/(baixo+0.05);
}

/* COMPARA OS DOIS, não decide por limiar de luminância. Um limiar único erra na
   faixa média — é a mesma armadilha da régua errada que este projeto já pagou
   cinco vezes: a pergunta não é "a cor é clara?", é "qual das duas tintas o OLHO
   distingue melhor sobre ela?". */
const hex2=n=>Math.round(Math.max(0,Math.min(255,n))).toString(16).padStart(2,"0");

export function tintaLegivel(cor){
  return contraste(cor,TINTA_ESCURA)>=contraste(cor,TINTA_CLARA)
    ? TINTA_ESCURA : TINTA_CLARA;
}

/* A SIGLA DO CLUBE É SEMPRE BRANCA — 07/08/2026, decisão do responsável:
   *"gostei da sigla do time em branco, quero isso em todos os times, nada de
   preto nisso"*.

   Isso INVERTE o problema que `tintaLegivel` resolvia. Antes a tinta se adaptava
   à cor; agora a tinta é fixa e quem cede é o FUNDO. Sem isso, branco sobre
   NAVI (#ffd400) dá 1,43:1 e sobre BIG (#e9edf3) dá 1,17:1 — ilegível.

   ESCURECER PRESERVA O MATIZ. Multiplicar os canais por um fator mantém a
   proporção entre eles, então o vermelho continua vermelho e o amarelo continua
   amarelo: o clube não perde identidade, perde luz. Medido no catálogo, o pior
   caso é BIG, que precisa de −52% — e é justamente a cor que nunca conviveria
   com texto branco, um branco-acinzentado. */
export function fundoParaSiglaBranca(cor,piso=4.5){
  /* Devolve a cor ORIGINAL quando ela já passa — inclusive na forma curta que o
     dado usa. Reconstruir o hex sempre trocaria `#123` por `#112233`: mesma cor
     na tela, string diferente no atributo, e a guarda que prova "a cor do time
     viaja inline" deixaria de reconhecê-la. */
  /* Valor que não é hex volta INTACTO. Ele nunca vem do catálogo — `cor` cobre
     os 17 elencos —, mas mastigá-lo aqui destruiria a prova de escaping do
     placar, que usa `red"` de propósito para verificar que aspas viram `&quot;`.
     Função de cor que "conserta" entrada inválida esconde o defeito de quem a
     passou. */
  if(!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(cor).trim()))return cor;
  if(contraste(cor,TINTA_CLARA)>=piso)return cor;
  const [r,g,b]=canais(cor);
  for(let p=2;p<=100;p+=2){
    const t=p/100;
    const c=`#${hex2(r*(1-t))}${hex2(g*(1-t))}${hex2(b*(1-t))}`;
    if(contraste(c,TINTA_CLARA)>=piso)return c;
  }
  return "#000000";
}

/* CLAREIA uma cor até ela passar o piso de contraste sobre um fundo, mantendo o
   MATIZ. Existe porque a marca de um mapa é usada como texto sobre o ambiente
   daquele mesmo mapa — dois valores da mesma família, que naturalmente se
   aproximam: Inferno (#c4472f) sobre o próprio tijolo dava 3,66:1.
   Misturar com branco preserva o matiz e só sobe a luminância, que é
   exatamente a grandeza que o contraste cobra. Devolve a cor original quando
   ela já passa, e para no branco se nem ele bastar — não há passo seguinte. */
export function clarearAte(cor,fundo,piso=4.5){
  const [r,g,b]=canais(cor);
  for(let p=0;p<=100;p+=4){
    const t=p/100;
    const c=`#${hex2(r+(255-r)*t)}${hex2(g+(255-g)*t)}${hex2(b+(255-b)*t)}`;
    if(contraste(c,fundo)>=piso)return c;
  }
  return "#ffffff";
}
