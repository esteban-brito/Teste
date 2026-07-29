/* BANDEIRAS — os 22 países que existem no motor, como SVG embutido.
   ══════════════════════════════════════════════════════════════════════════════

   NÃO SÃO EMOJI, e isso não é preferência: o Windows não traz os glifos de
   bandeira, então `🇧🇷` renderiza as duas letras "BR" no lugar do desenho. Um
   jogo que roda no navegador de qualquer um não pode depender disso.

   São 20 países de jogador (o POOL resolve país para os 85 combinando o campo
   cru com PAIS_JOGADOR) mais CAN e AUT, que só aparecem em treinador.

   SIMPLIFICADAS DE PROPÓSITO. A bandeira sai com cerca de 14 px de largura; o
   que se lê nesse tamanho é geometria e cor, não detalhe. USA tem 12 estrelas em
   vez de 50 — o número de listras é que importa para reconhecer. GBR, AUS, CAN,
   ISR, MNG, BIH, KAZ, SVK e BLR seguem a mesma regra.

   Isto é asset de interface, não dado de domínio: não pertence a `src/data`. */

/* As aspas simples PRECISAM virar %27: `encodeURIComponent` deixa `'` intacto, e
   o SVG usa aspas simples nos atributos. Sem isso o `url('…')` do CSS termina no
   meio da imagem, a regra fica inválida e a bandeira some sem erro nenhum — foi
   exatamente o que aconteceu no protótipo. */
const svg=(...partes)=>"data:image/svg+xml,"+encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 20'>${partes.join("")}</svg>`)
  .replace(/'/g,"%27");

const faixasH=(...cores)=>cores.map((cor,i)=>
  `<rect y='${i*20/cores.length}' width='30' height='${20/cores.length}' fill='${cor}'/>`).join("");

const faixasV=(...cores)=>cores.map((cor,i)=>
  `<rect x='${i*30/cores.length}' width='${30/cores.length}' height='20' fill='${cor}'/>`).join("");

/* Cruz nórdica: a haste vertical fica deslocada para a tralha, como nas originais. */
const nordica=(fundo,cruz,interna)=>
  `<rect width='30' height='20' fill='${fundo}'/>`+
  `<rect x='9' width='5' height='20' fill='${cruz}'/><rect y='7.5' width='30' height='5' fill='${cruz}'/>`+
  (interna?`<rect x='10.5' width='2' height='20' fill='${interna}'/><rect y='9' width='30' height='2' fill='${interna}'/>`:"");

export const BANDEIRA={
  POL:svg(faixasH("#fff","#dc143c")),
  UKR:svg(faixasH("#0057b7","#ffd700")),
  RUS:svg(faixasH("#fff","#0039a6","#d52b1e")),
  GER:svg(faixasH("#000","#dd0000","#ffce00")),
  LVA:svg("<rect width='30' height='20' fill='#9e3039'/><rect y='8' width='30' height='4' fill='#fff'/>"),
  DEN:svg(nordica("#c8102e","#fff")),
  SWE:svg(nordica("#006aa7","#fecc00")),
  NOR:svg(nordica("#ef2b2d","#fff","#00205b")),
  BRA:svg("<rect width='30' height='20' fill='#009c3b'/>"+
    "<path d='M15 2.4 27.6 10 15 17.6 2.4 10Z' fill='#ffdf00'/>"+
    "<circle cx='15' cy='10' r='4.4' fill='#002776'/>"+
    "<path d='M10.9 8.4a12 12 0 0 1 8.4 2.2 4.4 4.4 0 0 1-.3 1.3 11 11 0 0 0-8.4-2.2Z' fill='#fff'/>"),
  GBR:svg("<rect width='30' height='20' fill='#012169'/>"+
    "<path d='M0 0 30 20M30 0 0 20' stroke='#fff' stroke-width='4'/>"+
    "<path d='M0 0 30 20M30 0 0 20' stroke='#c8102e' stroke-width='2'/>"+
    "<path d='M15 0v20M0 10h30' stroke='#fff' stroke-width='6.6'/>"+
    "<path d='M15 0v20M0 10h30' stroke='#c8102e' stroke-width='4'/>"),
  AUS:svg("<rect width='30' height='20' fill='#012169'/>"+
    "<path d='M0 0 15 10M15 0 0 10' stroke='#fff' stroke-width='2.4'/>"+
    "<path d='M7.5 0v10M0 5h15' stroke='#fff' stroke-width='3.6'/>"+
    "<path d='M7.5 0v10M0 5h15' stroke='#c8102e' stroke-width='2'/>"+
    "<circle cx='21' cy='14' r='1.5' fill='#fff'/><circle cx='25' cy='6' r='1' fill='#fff'/>"+
    "<circle cx='26' cy='12' r='1' fill='#fff'/><circle cx='22' cy='5' r='.9' fill='#fff'/>"),
  BIH:svg("<rect width='30' height='20' fill='#002395'/>"+
    "<path d='M8 0 26 0 26 20Z' fill='#fecb00'/>"+
    "<path d='M7 2h1.6l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5Z' fill='#fff'/>"+
    "<circle cx='13' cy='9' r='1' fill='#fff'/><circle cx='17' cy='14' r='1' fill='#fff'/>"),
  SVK:svg(faixasH("#fff","#0b4ea2","#ee1c25")+
    "<path d='M6 6h7v6c0 2.6-3.5 4-3.5 4S6 14.6 6 12Z' fill='#ee1c25' stroke='#fff' stroke-width='1'/>"),
  KAZ:svg("<rect width='30' height='20' fill='#00afca'/>"+
    "<circle cx='16' cy='9' r='3.4' fill='#fec50c'/>"+
    "<path d='M9 16h14' stroke='#fec50c' stroke-width='1.2'/>"),
  AUT:svg(faixasH("#ed2939","#fff","#ed2939")),
  EST:svg(faixasH("#0072ce","#000","#fff")),
  FRA:svg(faixasV("#002395","#fff","#ed2939")),
  BLR:svg("<rect width='30' height='20' fill='#c8313e'/>"+
    "<rect y='13' width='30' height='7' fill='#4aa657'/>"+
    "<rect width='5' height='20' fill='#fff'/>"+
    "<path d='M1 2h3v2H1Zm0 5h3v2H1Zm0 5h3v2H1Zm0 5h3v2H1Z' fill='#c8313e'/>"),
  CAN:svg("<rect width='30' height='20' fill='#fff'/>"+
    "<rect width='7.5' height='20' fill='#d52b1e'/><rect x='22.5' width='7.5' height='20' fill='#d52b1e'/>"+
    "<path d='M15 4l1.2 3 2.4-1-.9 3.2 2.3.4-2.6 2.1.5 1.6-2.7-.7.3 3.4h-1l.3-3.4-2.7.7.5-1.6L10 9.6l2.3-.4L11.4 6l2.4 1Z' fill='#d52b1e'/>"),
  ISR:svg("<rect width='30' height='20' fill='#fff'/>"+
    "<rect y='2.6' width='30' height='2.4' fill='#0038b8'/><rect y='15' width='30' height='2.4' fill='#0038b8'/>"+
    "<path d='M15 6.6l3.2 5.6h-6.4Zm0 6.8l3.2-5.6h-6.4Z' fill='none' stroke='#0038b8' stroke-width='.9'/>"),
  MNG:svg(faixasV("#c4272f","#015197","#c4272f")+
    "<circle cx='5' cy='6.4' r='1.5' fill='#f9cf02'/>"+
    "<path d='M3.6 9.2h2.8v1H3.6Zm0 2h2.8v1H3.6Zm0 2h2.8v1H3.6Z' fill='#f9cf02'/>"),
  // 13 listras e um cantão: o número certo de listras importa mais que as 50 estrelas
  USA:svg("<rect width='30' height='20' fill='#fff'/>"+
    Array.from({length:7},(_,i)=>`<rect y='${i*20/13*2}' width='30' height='${20/13}' fill='#b22234'/>`).join("")+
    "<rect width='12' height='10.8' fill='#3c3b6e'/>"+
    "<g fill='#fff'>"+[2,5,8].flatMap(y=>[2,5,8,11].map(x=>
      `<circle cx='${x}' cy='${y}' r='.7'/>`)).join("")+"</g>"),
};

/** Data URI da bandeira, ou string vazia quando o país não tem desenho. */
export const bandeiraDe=pais=>BANDEIRA[pais]||"";
