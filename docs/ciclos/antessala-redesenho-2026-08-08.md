# Redesenho da antessala — 08/08/2026

> Ciclo sem tocar em dado, OVR, RNG ou balanceamento. A antessala é o **padrão de
> design do jogo** desde 07/08, então o que este documento estabelece vale para as
> telas que ainda vão herdar dela.

## 1. O que foi medido antes de mexer

A tela foi instrumentada no Chromium a 1440×900 e cada elemento visível teve
área, corpo, peso, raio e contraste coletados. Três achados são estruturais.

**A hierarquia estava invertida, e a ÁREA prova.** As quatro maiores áreas de
texto da tela:

| área | elemento | corpo/peso |
|---:|---|---|
| 10.843 px² | `▶ Com narração` | 14,7px / 700 |
| 10.571 px² | veredito *"Spirit favorito por 12"* | **9,6px / 400** |
| 8.611 px² | `Sem narração` | 12,2px / 700 |
| 8.127 px² | nota *"A narração comenta ao vivo…"* | 10,6px / 400 |

Numa tela cujo trabalho é criar tensão de confronto, o pódio era ocupado por dois
botões e uma legenda. O nome do adversário ficava em 2.646 px² — **3× menos que a
nota de rodapé que explicava um recurso opcional**. E o veredito, única frase que
diz o que está em jogo, era o terceiro menor corpo da tela; ele só aparecia grande
na coluna de área porque `flex:1` esticava a caixa a 813px. Isso é ar, não tinta.

**Não existia escala tipográfica — existiam treze corpos.** 36,8 · 30,4 · 24 ·
15,04 · 14,72 · 13,76 · 13,12 · 12,16 · 10,88 · 10,56 · 9,6 · 8,96 · 8. Cinco
deles dentro de uma janela de 3px. O olho não constrói hierarquia com degrau de
0,3px; ele lê "tudo médio" e desiste de ordenar.

**O ritmo era uniforme, e por isso não havia grupos.** `gap:30px` entregava
exatamente a mesma distância entre tudo — medido: 31 · 29 · 29 · 31. Consequência:
a barra de força não pertencia ao confronto, o mapa não pertencia ao confronto, e
o botão não se separava da informação. A lâmina ocupava 161px de 900 (18% da
altura) com 199px de nada abaixo.

**Geometria:** quatro raios (10px ×7, 18px ×3, 6px ×1, 20px ×1), sendo o de 6px
fora do sistema declarado, e `--r-peca` de 10px aplicado igualmente a um chip de
27px e a um botão de 51px de altura.

## 2. Dois defeitos reais, nenhum deles visível

**O divisor da barra de força não existia desde 01/08/2026.** A regra era
`border-right:2px solid var(--bg)`, e `--bg` foi removido do `:root` naquela data
na limpeza de tokens sem consumidor. `var()` indefinido invalida a shorthand no
tempo de valor computado, então o navegador devolve o inicial — medido,
`border-right` computava **`0px none`**. O comentário três linhas acima chamava o
sulco de essencial: *"cores de clube são dado, e dois azuis podem cair frente a
frente. Sem o sulco a barra sairia como bloco único."* Ele sumiu por uma semana e
nada acusou. `check-design-tokens` prova pares hex↔rgb e literais regredidos, mas
não prova `var()` apontando para token que não existe.

**Os dois nomes de time se sobrepunham no celular desde 07/08/2026.** Na captura
de base, "Time Test" aparece coberto por "immortals" e a era sai cortada como
"r Krakow 2017". Nenhuma prova funcional pega isso, porque todas perguntam *"o
texto está lá?"* e a resposta é sim: o nó existe, tem conteúdo e é `visible`. É a
regra 48 outra vez — só a captura denuncia.

## 3. Direção adotada

**"Corredor do palco"**: o momento não é a partida, é o corredor antes de entrar.
Silêncio tenso, pouca informação, muito peso.

A mistura, e o que cada sistema resolveu:

- **Liquid Glass** dá o material e a harmonia — mas corrigido. Ele é *uma camada
  funcional flutuando sobre conteúdo*, e o vidro estava pulverizado em cinco
  peças, o que anula o conceito;
- **Material 3 Expressive** entra por duas coisas que a linguagem da Apple não
  oferece: hierarquia por TAMANHO — autorizar um número gigante sem pedir
  desculpa — e física de movimento com massa, para a barra ter peso em vez de
  duração;
- **Fluent 2** entra só pelo vocabulário de profundidade: o conteúdo se move, o
  vidro fica parado, e a diferença relativa é o sinal de que a lâmina está acima
  do lugar;
- **HUD tático de CS** é a espinha: tipografia condensada, caixa-alta reservada a
  rótulo de sistema, `tabular-nums`, e o laranja da marca preso a UMA coisa.

Referências que ancoram: o *tale of the tape* do boxe (dois nomes, um número
entre eles, nada mais), o lobby do Valorant pós-redesign (disciplina de remoção) e
o Apple Sports (o número como protagonista tipográfico, não como legenda).

## 4. O que mudou

**A barra de força virou a BASE da lâmina.** Era um bloco solto de 880×34 a 29px
do palco, com os números das pontas repetindo a 13px valores que já estavam 3×
maiores nos cards. Agora o segmento de cada time nasce exatamente sob o card dele
— e é esse alinhamento que dispensa rótulo.

**O veredito virou a segunda leitura da tela**, em caixa-alta e peso 800 no eixo
central da lâmina. Ele não ficou grande: tudo em volta encolheu.

**Saíram:** a nota de rodapé em vidro (a explicação passou para dentro do próprio
botão), os dois rótulos `FORÇA` (896 px² para nomear o que o desenho já diz) e os
dois números das pontas da barra.

**Os mapas subiram para a moldura**, junto do contexto. Num MD1 sobrava uma pílula
solta e minúscula sob um bloco grande; e o fundo inteiro da tela já veste a cor do
mapa, então o nome é confirmação, não descoberta — e confirmação pertence à
moldura.

**No celular a diagonal gira 90° e as metades empilham**, cada uma com a largura
inteira. É a prescrição da regra 48: falta largura e sobra altura, então empilha.

**O nível de vidro passou a significar PAPEL**, não só raio de desfoque: `alto` é
lâmina, `medio` é AÇÃO — o que se pressiona —, `raso` é APOIO. Chip e placa de
mapa desceram para `raso`.

## 5. As três correções que a medição impôs ao plano

Nenhuma delas veio de ler código; todas vieram de rodar.

1. **"Reduzir de cinco superfícies de vidro para duas" tornaria um nível órfão.**
   `--vidro-raso-*` tinha exatamente um consumidor: a nota que eu ia matar.
   Redefinir o SIGNIFICADO dos níveis resolve melhor do que cortar — e entrega
   uma regra que as próximas telas herdam.
2. **A barra confiava na cor do clube para separar os segmentos, e a primeira
   foto derrubou.** O time do jogador é preto, que `--time-traco` clareia até
   cinza; a Spirit já é clara. Dois cinzas encostados viram uma linha contínua, e
   a barra perde justamente a informação que existe para dar. Hoje quem está
   atrás RECUA: aceso × apagado independe da cor do dado, e de brinde diz quem é
   favorito antes de a frase ser lida.
3. **A escala nova quebrou o celular.** Subir o mínimo dos `clamp` agravou uma
   sobreposição que já existia. Mexer no piso de um `clamp` é mexer no telefone,
   e isso só aparece medindo a soma das peças contra a caixa.

E um erro de execução, pego pela guarda escrita na mesma manhã: dois `-->` órfãos
no `index.html`, criados por reescrita que errou na borda (regra 23).

## 6. Provas

- `npm run check` — 26/26; `npm run lint` limpo; `npm run test:e2e` completo,
  incluindo acessibilidade em três viewports × oito estados, zero achados;
- **comparação visual: 5 de 21 mudaram.** Três são as antessalas, nos três
  viewports (~31% dos pixels cada). Os outros dois são `07-mapa` com a assinatura
  exata do piso de ruído medido no mesmo dia em duas execuções de código
  idêntico — `rgb 44,24,23 → 45,25,24`, 2.745 px, 0,190%. **Os outros 16 estados
  ficaram pixel a pixel idênticos**: o redesenho não vazou para fora da tela;
- **fps com braço de controle** (regra 55): 60,3 com vidro contra 60,3 sem
  nenhum `backdrop-filter`, duas amostras de 3s por braço. Custo zero em repouso.

## 6-bis. A SEGUNDA rodada — reconstrução estrutural do card (mesmo dia)

O responsável levou a tela a uma revisão externa e trouxe a nota: **6,5**. A
crítica dizia que o card era *reskin, não redesign* — mesmo retângulo, mesmo
split diagonal, mesmos quadrados de logo, só a cor mudando; sem vidro real, sem
elevação, sem concentricidade, sem especular. **Ela estava certa, e a causa era
de PILHA, não de paleta.**

**O diagnóstico que faltava.** O `backdrop-filter` estava em `.pm-palco`, e as
duas `.pm-lado` pintavam o próprio gradiente POR CIMA dele. O vidro ficava
embaixo de duas camadas de tinta — e o `clip-path` das metades, além de recortar,
cria contexto de empilhamento, o que PRENDIA o conteúdo abaixo do material.
Quatro rodadas trocando cor não iam consertar uma ordem de camada. A prova de
mutação media 6/255 de delta máximo, e eu tinha atribuído isso só ao fundo liso.

**O card virou três camadas de verdade:**

| z | camada | o que é |
|---|---|---|
| 0 | `.pm-palco::before` | CAMPO — as duas cores de clube num gradiente de **parada dura**. A diagonal deixou de ser `clip-path` e virou um *stop* |
| 1 | `.pm-palco::after` | LÂMINA — o vidro, que amostra a cor dos times **e** a malha do ambiente. Aqui moram o desfoque, o especular e a costura |
| 2 | conteúdo | brasões, nomes e números **acima** do vidro, nítidos |

**O que isso destravou:**

- **refração real**: delta máximo de canal foi de **6/255 → 33/255** pelo mesmo
  custo de GPU;
- **especular de verdade**: um gradiente que corre pela superfície — aceso na
  quina superior esquerda, apagando no meio, pegando luz na base. Linha branca de
  opacidade única lê como borda; gradiente lê como reflexo;
- **concentricidade**: `--r-crest` deixou de ser 18px cravados e passou a ser
  `--r-lamina − --e-2`. Curvatura derivada, não escolhida;
- **a costura voltou como ARESTA DO VIDRO**: com o campo atrás da lâmina, o
  desfoque de 22px transformava a parada dura em ~44px de névoa e a diagonal
  sumia. A linha agora é pintada no fundo do próprio pseudo-elemento, ou seja
  DEPOIS do desfoque — nítida sobre o borrão, como a junção de duas placas;
- **a revelação**: a lâmina entra **cega** (`--vidro-alto-cego`, desfoque alto e
  saturação baixa) e LIMPA, descobrindo os times por trás. Só é possível porque o
  vidro está entre o campo e o conteúdo — com a pilha antiga, embaçar a lâmina
  não esconderia nada. **Estrutura e movimento viraram a mesma decisão.**

**A guarda de vidro pegou meu erro no caminho:** o keyframe da revelação
declarava `blur(30px) saturate(70%)` na mão, e ela reprovou. O estado cego virou
token — número de desfoque escrito à mão dentro de um keyframe é exatamente como
um sistema começa a divergir.

**Por que eu tinha convergido em cor.** Três razões, e a terceira é a que
importa: otimizei para o que sabia medir (área, tipografia, contraste tinham
instrumentação; materialidade não tinha número, então virou argumento);
confundi disciplina com deferência ao que estava "aprovado" em 07/08, tratando a
estrutura como restrição em vez de como o objeto sob revisão; e **nunca verifiquei
o que o vidro estava amostrando**. Lição para o próximo ciclo visual: *quando um
material não aparece, o suspeito não é o valor do filtro — é a ordem da pilha.*

## 7. O que NÃO foi feito, e por quê

- **não** voltaram a placa grande de mapa, a sigla de duas letras, os selos
  `VOCÊ` nem os rótulos "Vão jogar em" — as quatro são recusas registradas;
- **não** entrou nada que explique o MOTOR. Força, favoritismo e mapa são
  RESULTADO, que a §11-bis autoriza; tática, leitura e repertório continuam
  dentro da IA;
- o vão vertical restante (~200px acima e abaixo em 1440×900) é `justify-content:
  center` num overlay, e foi mantido de propósito: centrar é a decisão correta
  para um diálogo modal, e encher a altura pediria inflar componentes sem
  informação nova.
