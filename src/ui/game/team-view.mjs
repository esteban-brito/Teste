import {escapeHtml as esc} from "../shared/html.mjs";
import {canais,fundoParaSiglaBranca,clarearAte,TINTA_CLARA} from "../shared/contrast.mjs";

export const teamMonogram=name=>name.replace(/[^A-Za-z0-9]/g,"").slice(0,2).toUpperCase();

/* A COR vem do dado e por isso viaja inline; a GEOMETRIA é do CSS e fica lá.

   Até 02/08/2026 `prematchTeamHtml` emitia `width:74px;height:74px;font-size:1.5rem;
   border-radius:18px` — os MESMOS quatro valores já declarados em
   `.pm-team .team-mono`. Duas fontes da verdade para uma medida, e nenhuma guarda
   olhando: mexer no CSS deixava o inline vencendo, por especificidade, sem nada
   reclamar. O tamanho da antessala continua onde sempre esteve, no CSS. */
/* Um fallback só. Havia dois — `#2a3346` para slot vazio do bracket e `#888` para
   time sem cor —, mas `cor` cobre os 17 elencos (provado por `check-data-catalog`),
   então o segundo caminho nunca foi alcançado. */
const COR_AUSENTE="#2a3346";
/* A SIGLA É SEMPRE BRANCA e quem cede é o FUNDO — 07/08/2026. A cor do clube é
   escurecida só o quanto for preciso para o branco passar o piso de contraste,
   o que preserva o matiz: o clube perde luz, não identidade. Ver
   `fundoParaSiglaBranca` em `../shared/contrast.mjs`. */
const monoHtml=team=>{
  const cor=team?.cor||COR_AUSENTE;
  return `<div class="team-mono" style="background:${esc(fundoParaSiglaBranca(cor))};color:${TINTA_CLARA}">`+
    `${team?teamMonogram(team.nome):"?"}</div>`;
};

export function teamChipHtml(team,loser){
  if(!team)return `<div class="team-chip">${monoHtml(null)}<span class="tn">—</span></div>`;
  return `<div class="team-chip${loser?" loser":""}">${monoHtml(team)}<span class="tn">${esc(team.nome)}</span></div>`;
}

/* O chip de lado ganhou o nome POR EXTENSO ao lado da sigla — 07/08/2026. "CT" e
   "TR" sozinhos eram os dois menores textos da tela do mapa (8,32 px e 9,28 px,
   contra 60,8 px do placar) e não dizem nada a quem não joga CS. O `data-lado`
   existe para o CSS pintar sem depender da ordem das classes, e o `aria-label`
   entrega a frase inteira ao leitor de tela, que não deve ouvir "CT". */
const LADO_EXTENSO={ct:"Defesa",tr:"Ataque"};
const conteudoLado=side=>`<b class="lado-sigla">${side.toUpperCase()}</b>`+
  `<span class="lado-extenso">${esc(LADO_EXTENSO[side]||"")}</span>`;
const rotuloLado=side=>`${LADO_EXTENSO[side]||""} (${side.toUpperCase()})`;

export function ladoChipHtml(side,{id,classe="sb-side"}={}){
  return `<span class="${classe} ${side}" data-lado="${side}"`+
    `${id?` id="${id}"`:""} aria-label="${esc(rotuloLado(side))}">${conteudoLado(side)}</span>`;
}

/* Troca o lado de um chip JÁ NA TELA, na virada do round 13.
   Existe porque a virada era feita com `el.textContent="TR"`, que apagava a
   estrutura interna do chip — sigla e nome por extenso — e deixava o elemento
   com um texto solto a partir dali. Quem monta o HTML tem de ser quem o
   atualiza, senão as duas verdades divergem no primeiro estado que ninguém
   testou. */
export function aplicarLado(el,side,classe="sb-side"){
  if(!el)return;
  el.className=`${classe} ${side}`;
  el.dataset.lado=side;
  el.setAttribute("aria-label",rotuloLado(side));
  el.innerHTML=conteudoLado(side);
}

export function liveTeamHeaderHtml(team,side,sideElementId){
  return monoHtml(team)+
    `<div class="sb-info"><span class="sb-name">${esc(team.nome)}</span>${team.camp?`<span class="sb-camp">${esc(team.camp)}</span>`:""}${ladoChipHtml(side,{id:sideElementId})}</div>`;
}

/* O CARD DA ANTESSALA — reformulado em 07/08/2026, a pedido: *"tá muito feio e
   simples"*. O que ele tinha era um monograma, um nome e um número soltos numa
   caixa neutra; o que faltava era IDENTIDADE — o clube não aparecia em lugar
   nenhum além de duas letras.

   Agora o card VESTE a cor do time, como os blocos do scoreboard: a cor viaja
   inline porque é dado, e o CSS a usa para o brasão, a moldura e o véu de fundo.
   A força ganhou rótulo próprio e corpo de número grande — ela é a única
   grandeza comparável entre os dois lados e estava do tamanho de uma legenda. */
/* A ESCALA MUDOU com o palco em diagonal: o nome do clube passou a ser a
   primeira leitura, e a força o número que se lê logo em seguida. Antes tudo
   vivia entre 1,3 e 1,8 rem — nada dominava, e sem dominante não há ordem de
   leitura. Agora há degraus reais: nome, força, era. */
/* O RÓTULO "FORÇA" SAIU — 08/08/2026. Ele era emitido DUAS vezes, uma por lado,
   a 8,96px, ocupando 448px² cada para nomear o que o desenho já diz. Quem
   carrega o significado agora é o VEREDITO, na base da lâmina: "Spirit favorito
   por 12" informa que os dois números são uma comparação de força, em português,
   uma vez só e no eixo central — em vez de duas legendas minúsculas repetindo a
   mesma palavra nas pontas. É a regra 53: diante de um rótulo pequeno, a
   pergunta não é como aumentá-lo, é que elemento já existente pode dizer aquilo. */
/* O CAMPEONATO SAIU DO CARD — 08/08/2026.
   Ele existia num lado só: o adversário vem do catálogo e tem era de elenco, o
   time do jogador é criado e nunca vai ter. O resultado era um desnível que
   nenhuma regra de CSS conserta, porque não é espaçamento — é CONTAGEM DE
   LINHAS. Medido na captura: com três linhas de um lado e duas do outro, e cada
   bloco centrado por si, o nome ficava 10px fora e o número 9px fora. Os
   brasões batiam só porque têm altura fixa.
   A regra 50 já proibia a saída fácil (reservar linha falsa ou inventar texto de
   preenchimento). Sobra igualar de verdade: os dois lados passam a ter as mesmas
   duas linhas, e aí nome e número alinham sem ninguém alinhá-los.
   A informação não era essencial aqui — a antessala responde "quem joga e quanto
   vale", não a biografia do elenco. */
/* `--nome-ch` É O QUE PERMITE O NOME ENCOLHER EM VEZ DE QUEBRAR — 09/08/2026.
   O card do confronto é estreito de propósito, e o lado do jogador fica mais
   estreito ainda sempre que o adversário é favorito, porque a divisão É a
   proporção de força. Nesse espaço, "Time Teste" já quebrava em duas linhas — e
   o nome do clube é DIGITADO, com até 18 caracteres, então o pior caso nem
   sequer está no catálogo.

   Container query sozinha não resolve: `cqi` sabe a largura disponível, mas não
   sabe quantas letras precisam caber nela, e por isso encolheria "FURIA" tanto
   quanto "CAMPEONATO BRASIL". Medir no DOM resolveria, ao custo de um laço de
   layout a cada montagem. O comprimento é a única coisa que falta ao CSS, e
   quem o conhece é quem monta a peça (regra 45) — daí ele viajar como variável.

   Fica no elemento, e não numa classe por faixa de tamanho: faixa criaria
   degraus visíveis entre um nome de 9 e um de 10 letras. */
export function prematchTeamHtml(team){
  const nome=team?.nome||"";
  return `<div class="pm-crest">${monoHtml(team)}</div>`
    +`<div class="pm-info" style="--nome-ch:${Math.max(1,nome.length)}">`
    +`<div class="pm-name">${esc(nome)}</div>`
    +`<div class="pm-ef"><b>${team.ef}</b></div>`
    +`</div>`;
}

/** Canais "r,g,b" da cor do clube — a forma que `rgba(var(--x),a)` consome.
    Existe porque o CAMPO de cor da antessala é uma camada só, com uma parada
    dura entre os dois clubes: ela precisa das DUAS cores ao mesmo tempo, e
    `estiloDoTime` só sabe falar de um time por vez. */
export function canaisDoTime(team){
  return canais(team?.cor||COR_AUSENTE).join(",");
}

/** Estilo do card: a cor do clube e os canais dela, para véu e moldura.
    Os canais vêm de `contrast.mjs` porque hex de três dígitos precisa ser
    expandido — a primeira versão desta função não expandia e devolvia `NaN` no
    canal azul, que num `rgba()` simplesmente não pinta. */
export function estiloDoTime(team){
  const cor=team?.cor||COR_AUSENTE;
  /* `--time-traco` é a cor do clube TRAZIDA À LUZ o quanto for preciso para se
     ver sobre o fundo escuro do jogo. Ela existe desde 07/08/2026, quando o time
     do jogador passou a ser PRETO a pedido do responsável: preto puro é perfeito
     no brasão — 21:1 com a sigla branca — e invisível em tudo o mais, porque o
     número da força, a faixa do topo e o segmento da barra também usam a cor do
     clube e vivem sobre painel escuro.
     Clarear preserva o matiz; para o preto, que não tem matiz, o resultado é o
     cinza claro que a escala produz. A cor CHEIA continua valendo onde ela é
     fundo. */
  /* O FUNDO DE REFERÊNCIA SUBIU EM 08/08/2026. `--time-traco` era clareado
     contra `#0b0f15`, o painel escuro do jogo — e desde que a antessala ganhou a
     foto do mapa por baixo do campo, o fundo real ficou bem mais claro que isso.
     O número da força media 4,08–4,17:1 em Inferno e Ancient, abaixo do piso.
     O número de referência é `#232c3b`, medido: é o campo do CELULAR com a foto
     atrás, que é o caso mais claro dos três viewports — no desktop o palco é
     mais largo e o scrim pesa mais. Calibrar pelo desktop deixava o celular em
     4,17:1. A cor do clube não muda: `--time-traco` é só a versão dela trazida
     à luz para virar TEXTO. `e2e-antessala` mede isso nos sete mapas × três
     viewports, que é o domínio inteiro. */
  /* O ALVO É 5,2 e não 4,5, e a folga não é preguiça: `clarearAte` calcula
     contra uma cor CHAPADA, e o fundo real é a foto do mapa variando por trás do
     campo. Calibrar no limite deixava os sete mapas entre 4,28 e 4,47 — todos
     reprovando por pouco, cada um por um motivo diferente. A margem absorve a
     variação do dado, que é o que a regra 46 pede quando o fundo é sorteado. */
  return `--time-cor:${cor};--time-rgb:${canais(cor).join(",")}`
    +`;--time-traco:${clarearAte(cor,"#232c3b",7.6)}`;
}
