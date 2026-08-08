# Clareza da tela do mapa — 07/08/2026

Ciclo sem tocar em dado, OVR, RNG ou balanceamento. O pedido do responsável, depois
de testar a build: *"achei razoável, tá difícil de identificar se sou CT ou TR,
entre outras coisas que precisam estar mais claras pro usuário."*

A queixa era exata, e a medição mostrou que ela era maior do que parecia: **a
informação que o jogador mais precisa para ler o mapa era a menor da tela.**

## 1. O diagnóstico, antes de tocar em nada

Medido em partida real, 1440×900, modo sem narração.

| pista | corpo | área |
|---|---:|---:|
| chip `CT`/`TR` no topo | 9,28 px | 686 px² |
| chip `CT`/`TR` na tabela | 8,32 px | 447 px² |
| nome do time | 19,2 px | 2.229 px² |
| placar | 60,8 px | 3.658 px² |
| **"Pular para o resultado"** | 12,16 px | **9.015 px²** |

Os dois chips de lado eram **os dois menores de 86 textos visíveis**. E o maior
elemento da tela, nos três viewports, era o botão que DESCARTA o conteúdo — área
é o que o olho usa para ordenar importância, e a ordem estava invertida.

Mais três achados que a varredura trouxe:

- **a virada do round 13 mudava 686 px², 0,05% da tela, sem aviso nenhum.** O
  evento mais importante do mapa acontecia trocando duas letras de 9 px;
- **informação que só existia em cor.** As cinco linhas do time do usuário eram
  marcadas apenas pela classe `.mine`, que se manifesta em ciano — **zero** delas
  dizia por escrito de quem era o time. As células do histórico de rounds também:
  0 de 5 com rótulo, `title` ou `aria-label`;
- **a antessala não menciona lado nem mapa**: 12 textos, nenhum dos dois.

## 2. A tabela ficava um lado ATRÁS do topo

Achado que não estava no pedido e é o pior da lista. `montarScoreboard` pintava o
`.ls-side-tag` uma única vez, e **nada mais o tocava**. A virada só atualizava os
chips do topo.

Ou seja, a partir do round 13 a tela dava **duas respostas diferentes** para "que
lado eu sou": o topo dizia `TR` e a tabela seguia dizendo `CT` para o mesmo time.
Quem estava confuso tinha razão de estar.

E `pularMapa` tinha a mesma doença por outro caminho: ele reconstruía placar e
strip, mas nunca virava os lados — pular um mapa que passou do round 13 terminava
mostrando o lado errado, e o erro sobrevivia na tela de resultado.

## 3. O que mudou

**O lado ficou legível e ganhou nome.** `CT` e `TR` não significam nada para quem
não joga CS; agora a sigla vem acompanhada de **Defesa** e **Ataque**, e o
`aria-label` entrega a frase inteira ao leitor de tela, que não deve ouvir "CT".
O chip do topo foi de 9,28 px / 686 px² para **11,52 px / 1.968 px²**; o da tabela,
de 8,32 px para **10,56 px**.

**A virada é anunciada.** Uma faixa curta abaixo da barra de progresso diz
*"Troca de lado · agora você ataca"* por 2,6 s. Ela fala de ESTADO, nunca de
decisão do motor — a fronteira da §11-bis é entre resultado e mecanismo, e lado é
resultado. `role="status"` e não `alert`: é informação, não urgência.

**Um lugar só define o lado dos quatro chips.** `definirLados` atualiza topo e
tabela juntos, e `virarLados` deriva o lado novo do `data-lado` que está na tela —
não de contar rounds e supor onde foi a troca. Pular o mapa passa pela mesma
função, com o lado do último round jogado.

**O dono do time virou texto.** O selo `VOCÊ` acompanha o nome do time na
antessala, no topo do mapa e na tabela. A cor ciano continua — ela é o canal
rápido; o selo é o canal que não depende de enxergá-la.

**Pular deixou de dominar a tela.** De 9.015 px² para **6.741 px²** (193×35). O
alvo continua confortável: a suíte de acessibilidade cobra 24 px com folga e o
menor alvo do jogo é o `#mutebtn` com 32 px — este ficou acima. `#matchContinue`
**não** encolheu, porque é a ação que segue o jogo.

## 4. O monograma reprovava contraste — e o defeito era sorteado

O monograma pinta a sigla do clube sobre a cor do clube, e a cor é **dado**: 17
valores que ninguém escolheu pensando em legibilidade. Com a tinta fixa em
`#0a0d13`, dois times ficavam abaixo do piso de 4,5:1 da WCAG — **G2 (#e4002b) em
4,01:1** e **Astralis (#e2231a) em 4,16:1**.

**Por isso ele durou: o adversário é sorteado.** A mesma tela passava ou reprovava
dependendo de quem apareceu, e uma varredura de uma partida só tem 2 chances em 17
de ver cada caso. Foi o que aconteceu na primeira medição — o desktop acusou
4,15:1 e os outros dois viewports não acusaram nada, porque os adversários eram
outros.

A correção escolhe a tinta POR COR, comparando os dois contrastes reais. E as
tintas são as pontas puras, o que a medição exigiu:

```text
tinta fixa #0a0d13 .............. pior 4,01:1 · 2 reprovam
tinta fixa #f3f7fb .............. pior 1,09:1 · 16 reprovam
melhor de #0a0d13 / #f3f7fb ..... pior 4,35:1 · 1 reprova   (Astralis)
melhor de #000 / #fff ........... pior 4,68:1 · 0 reprovam
```

Escolher entre as duas cores da paleta **não bastava**. Os 4 níveis que separam
`#0a0d13` de `#000` são imperceptíveis no monograma e valem exatamente a margem
que faltava.

## 5. O que a bancada aprendeu

Três guardas foram atualizadas conscientemente, porque o contrato mudou de
propósito — e as três ficaram **mais fortes** do que eram:

- `check-game-view-modules` passou a cobrar sigla, nome por extenso, `data-lado`
  e `aria-label` no chip; o selo de dono presente no time do usuário **e ausente
  no adversário**; e a tinta do monograma acompanhando cores clara e escura;
- `check-game-entrypoint` passou a exigir o import de `aplicarLado`. Ele existe
  para que **quem monta o chip seja quem o atualiza** — a versão anterior trocava
  o lado com `el.textContent="TR"` de dentro do `game.js`, o que apagava a
  estrutura interna montada no módulo de view.

## 6. O ritual visual pegou uma regressão que a medição funcional não pegava

Piso de ruído medido antes de julgar qualquer diff, como manda a regra 40: duas
capturas do MESMO código deram **2 de 21**, ambas em `07-mapa`, com desvio de
**1 por canal**. Tudo acima disso é trabalho meu.

A comparação contra a régua limpa deu **9 de 21** — e a inspeção imagem a imagem
encontrou um defeito que **nenhuma prova funcional acusava**, porque todas elas
mediam presença e coerência, não largura:

**No celular, o nome do time sumiu da tabela.** O chip maior mais o selo `VOCÊ`
passaram a pedir ~217 px num bloco de 154 px. Como `.ls-team` carrega
`min-width:0`, o flex **não truncou — espremeu a largura ZERO**: "SEU TIME" e
"Immortals" desapareceram por completo, e reticências nem chegaram a aparecer.

| | antes | depois da fatia | corrigido |
|---|---:|---:|---:|
| largura do nome (celular) | 71,7 px | **0 px** | **71,7 px** |

A correção não corta informação: no celular a identidade **quebra em duas
linhas**. Altura é o recurso que sobra numa tela que já rola; largura é o que
falta. O nome por extenso do lado ficou preservado nos três viewports.

**A lição:** `min-width:0` num item de flex troca "truncar" por "sumir", e uma
guarda que pergunta *"o texto está lá?"* responde SIM enquanto o usuário não vê
nada — o nó existe, tem conteúdo e é `visible`. Só a captura denuncia.

### As nove capturas, explicadas

- **3× `06-antessala`** (4,2–6,2%): o selo alargou o card do time do usuário e o
  flex reposicionou os dois. Conteúdo idêntico, posição diferente;
- **3× `07-mapa`** (0,96% · 1,06% · 22,3%): chips maiores, selo e botão de pular
  menor. O número do celular é alto porque a captura é `fullPage` e empilhar a
  identidade aumentou a altura do documento, deslocando tudo abaixo;
- **3× `05-suica`** (~1.136 px, ~0,1%): **estado fora do escopo, e explicado** —
  é a tinta do monograma. O pixel vai de `rgb(191,24,20)` para claro exatamente
  nos times vermelhos que reprovavam contraste. Nenhum outro estado mudou.

A inspeção também confirmou a correção do defeito principal de forma visível: na
captura antiga, um mapa **já encerrado** exibia os chips no lado da primeira
metade; agora exibe o lado final.

## 7. O nome do clube, e a antessala

Segundo pedido do responsável no mesmo dia: *"uma coisa que ta feia é a antesala,
e o nome do time ser SEU TIME, deveria poder escolher o nome do time antes de
qualquer coisa."*

### O que estava feio, medido

| | desktop | tablet | celular |
|---|---:|---:|---:|
| a antessala ocupa | **18,8%** da caixa | 27,7% | 54,3% |
| ar acima / abaixo | 246 px | 296 px | 169 px |
| **assimetria entre os cards** | **23 px** | 10 px | 20 px |

A assimetria não era espaçamento: o flex dimensionava cada card pelo CONTEÚDO, e
os conteúdos são desiguais **por natureza** — o adversário tem campeonato e o time
do jogador não tem nenhum. Um card de confronto que muda de tamanho conforme o
texto de dentro faz a partida parecer desequilibrada antes de começar.

`grid-template-columns:1fr auto 1fr` com `align-items:stretch` iguala os dois
eixos sem reservar linha falsa nem inventar texto de preenchimento. Medido
depois: **314,8×213 nos dois, diferença de 0,0 px**.

### O nome deixou de ser constante

`montarMeuTime()` cravava `nome:"SEU TIME"`. Agora o nome nasce num campo do HUD
— **antes de qualquer coisa**, visível desde a primeira tela e editável a
qualquer momento —, é normalizado por `src/application/team-identity.mjs` e vive
no progresso, junto de títulos e recordes.

Três decisões que valem registro:

- **o padrão é `placeholder`, não valor gravado.** Se o jogador apagar tudo, o
  campo volta a ficar vazio: gravar "SEU TIME" faria o padrão parecer uma escolha
  dele, e o Hall registraria títulos de um clube que ele nunca nomeou;
- **`nomeDoTime` NÃO entra em `valido()`.** Um progresso salvo antes de hoje não
  tem o campo; exigi-lo recusaria o save e apagaria o histórico de quem já
  jogava. A guarda cobra exatamente esse caso;
- **grava no `blur` e no Enter, nunca por tecla.** Salvar a cada letra escreveria
  no `localStorage` a cada digitação e registraria nomes pela metade.

### O nome virou identidade, e identidade colide

Este é o ponto que transforma um campo de texto em risco de motor. `game.js`
conta a série com `jogo.vencedorNome===A.nome`, e `simularMapa` devolve o
vencedor pelo NOME. **Dois times homônimos no mesmo Major mandam o placar para o
lado errado** — e "NAVI" e "FURIA" são os primeiros nomes que qualquer jogador
tenta.

Enquanto o nome era fixo, isso não podia acontecer. Agora pode, e a correção cabe
no orçamento que já existia: são **17 elencos para 15 vagas** de NPC, então dá
para tirar DOIS sem faltar time. `iniciarTorneio` remove primeiro os homônimos e
só depois o de maior sobreposição de elenco — **sem uma chamada de RNG a mais**,
porque filtra a lista já embaralhada em vez de sortear de novo.

`tools/check-team-identity.js` trava a conta: se algum nome do catálogo passar a
se repetir mais de duas vezes, remover todos os homônimos deixaria menos de 15
NPC e o Major encolheria em silêncio. Hoje o máximo é 2 e a folga é 2 — **está no
limite**, e a guarda avisa antes de estourar.

Medido no jogo real: com o clube chamado "navi", o quadro do Major mostra **1**
time com esse nome, não 2.

## 8. O mapa entra em cena — portão do nome, série anunciada e ambiente

Três pedidos encadeados no fim do dia, e o terceiro corrigiu o primeiro.

### O portão do nome

O campo saiu do HUD e virou passo obrigatório na entrada do Major: *"se deixar
ali as pessoas esquecem de escolher, deixe impossível da pessoa passar sem
escolher o nome"*. O botão nasce desabilitado, só-espaços não habilita, e o aviso
de colisão com o catálogo aparece **enquanto se digita**, não na confirmação.

**Escape não fecha o portão**, e isso não é exceção: ele não tem botão de fechar,
e a regra 25 diz que Escape só faz o que o mouse faz. É o mesmo desenho do
`finalOverlay`.

Custo colateral, pago: o portão quebrou as **três** travessias do Major que
existiam. Elas passaram a viver em `bancada/lib/major.js`, pela mesma razão que
o arrasto virou `lib/arrasto.js` em 06/08 — o errado nunca foi haver três
consumidores, era haver três implementações.

E `seedWinningMap` teve de mudar junto: ela previa o vencedor simulando **sem** o
mapa forçado, enquanto o produto passou a jogar o mapa pré-sorteado. Previsão e
jogo divergiam, e o sintoma chegava como `Timeout` em `#playoffAvancar` — longe
da causa.

### A série inteira anunciada, e um defeito de brinde

A antessala passou a mostrar TODOS os mapas do confronto. Para isso eles são
sorteados na abertura da série — e sortear de uma vez é o que permite garantir
que **não se repitam**, exatamente como `simularSerie` faz no motor desde sempre.
A UI, que chamava `simularMapa` sem `mapaForcado`, podia jogar o mesmo mapa duas
vezes num MD3.

**A ordem de consumo do RNG mudou**, e isso está declarado no código: era
`fdA · fdB · mapa` por mapa; passou a ser os `md` sorteios na abertura e
`fdA · fdB` por mapa jogado. Não é constante nova nem viés — mesmas grandezas,
mesma distribuição —, mas é consequência necessária de anunciar o mapa antes de
jogá-lo, e ninguém deve descobrir isso lendo um diff.

### O ambiente, depois de uma recusa

A primeira versão da "marca do mapa" era cor + sigla de duas letras. Foi
recusada: *"era mais sobre o mapa transformar a interface, o fundo, etc."* — e
depois, sobre a peça em si: *"não gostei do quadradinho […] tem um bloco dentro
do outro, tipo um retângulo dentro do outro"*.

O que ficou:

- cada mapa carrega **três** cores — marca, `ceu` e `chao` —, e o fundo da
  antessala e da partida vira o gradiente do lugar, com um facho na cor da marca
  e vinheta na base. Nenhuma imagem;
- **a sigla foi removida**, não desativada: sem consumidor seria código morto;
- o mapa da vez é uma **placa sólida na cor dele** com o rótulo "Vão jogar em";
  os outros da série ficam em contorno, com "Se houver 2º/3º mapa".

**A guarda achou o que o olho não acharia.** `check-map-identity` mede a
distância entre todos os pares de ambiente e reprovou duas vezes: Mirage×Dust2 a
**2,4** e depois Mirage×Inferno a **3,5** — telas que seriam indistinguíveis. A
saída foi puxar cada um para o que ele é (terracota, tijolo, poeira sob sol
alto). Hoje o pior par está em **6,9**, e o texto do corpo mantém no mínimo
**6,62:1** sobre os sete ambientes.

**E o retângulo dentro do retângulo tinha causa exata:** o contêiner `#pmMapa`
carregava `class="pm-mapa"`, resíduo de quando ele *era* a placa. Virou moldura
em volta das placas. Eu tinha acabado de escrever "sem caixa dentro de caixa" no
comentário do CSS e recriei o defeito na mesma fatia, porque reli a folha e não o
HTML. Achado pelo `getComputedStyle` do nó, não pelo seletor. Virou a regra 51.

### Fluidez, com causa medida

O pedido foi *"deixe a simulação mais fluida, a narração também"*. Quatro causas
concretas, nenhuma delas "gosto":

| o que estava duro | causa | correção |
|---|---|---|
| barra de progresso | `transition .3s` fixo contra round de **241 ms** — ela nunca alcançava | recebe a duração real do round, em curva linear |
| tira de rounds | overshoot **1,4×** treze vezes seguidas no miolo | 1,12× — assentar, não explodir |
| placar | overshoot **1,3×** num número de 60 px | 1,16× |
| narração | **2.600 ms fixos** por fala, curta ou longa | tempo de leitura: piso + ~17 ms/caractere, e 2.600 vira TETO |

A curva de ritmo também ganhou expoente 1,6: `1-sin(pos·π)` sozinha desacelerava
cedo demais e o mapa demorava a engatar. As pontas seguem lentas — que é o efeito
dramático — e o miolo chega antes.

### Um defeito de acessibilidade que eu mesmo criei

Ao mover o campo do HUD para o portão, ele perdeu o `<label for=...>` e ficou sem
nome acessível — `placeholder` não conta, some ao digitar. A suíte de
acessibilidade pegou (`campo-sem-rotulo`) antes de qualquer humano.

## 9. A tira de rounds e os blocos — quando a forma substitui o texto

Dois pedidos no fim do dia, e os dois apontam para a mesma ideia: *"quanto mais
visual, design, e menos texto, melhor"*.

### O round narrado parou de expandir

*"Quando congelar a tela pra narração não quero que aquele quadradinho expanda."*
Ele crescia **1,9×** — e só assim o número do round dentro dele, de 5 px, ficava
legível. Mas o número era **redundante**: o palco da narração já mostra "Round N"
em corpo grande, logo acima. Tirando a escala, o número saiu junto, e o destaque
virou LUZ — aro e brilho —, que não empurra vizinho nem muda a geometria da tira
no meio da leitura. Medido: célula narrada **9×20, igual à vizinha**,
`transform:none`.

### A tira dizia o lado, não o dono

Achado ao mexer nela: `addCelula` guardava só o LADO vencedor. **Os lados trocam
no round 13**, então a mesma cor significava times diferentes nas duas metades do
mapa — e não dava para contar os próprios rounds, que é a única pergunta que se
faz a uma tira dessas.

A cor continua sendo o lado, porque é o vocabulário do CS; o que mudou é o PESO:
round seu em cheio, round do adversário apagado. Num placar de 3–2, lê-se três
barras fortes contra duas fracas sem contar nada.

E viraram **barras em pé**: a tira é uma sequência temporal, e barra lê como
sequência enquanto quadrado lê como grade.

### Os blocos do scoreboard vestiram o lado

O pedido: *"e se eles ficassem inteiramente nas cores de CT ou TR? e alternasse
na troca de half. Aí não precisa escrever nada do tipo TR Ataque CT Defesa."*

**Isso corrigiu, pela forma, o que de manhã eu tinha corrigido por tamanho.** A
primeira metade deste ciclo aumentou os chips de lado — 8,32 px → 10,56 px na
tabela. A resposta melhor era não ter chip ali: o bloco tem centenas de vezes a
área e não precisa de palavra nenhuma. Na virada, os dois blocos trocam de cor ao
mesmo tempo, no meio da tela. Virou a regra 53.

Três cuidados que a mudança exigiu:

- **o tingimento é baixo** — dentro do bloco vivem dez linhas de estatística com
  texto claro. A força vem da borda e da faixa do topo, que são as partes sem
  texto por cima;
- **o dono migrou de matiz para relevo.** O ciano do `.mine` pintava o bloco; se
  continuasse, apagaria justamente o lado que o bloco passou a mostrar. Hoje o
  time do jogador se anuncia por sombra, pelo selo `VOCÊ` e pelo nome em ciano;
- **o texto do lado NÃO sumiu do produto.** Ele continua no chip do topo, com
  nome por extenso e `aria-label`. Tirar dos dois lugares deixaria a informação
  só em cor.

O `side` de `scoreboardSideHtml` ficou sem consumidor e saiu junto — regra 52.

## 10. A antessala virou o SISTEMA DE DESIGN do jogo

O fim do dia foi uma sequência de recusas até a reformulação total. O responsável
fechou assim: *"quero deixar a antessala perfeita, absoluta, pq vou usar ela como
um padrão de estilo, css, design e tudo mais pra todo o jogo […] mas o foco agora
é na antessala, depois vamos pras outras telas."*

**Isso muda o estatuto da tela.** Ela não é mais uma tela: é a referência que as
próximas vão herdar.

### O diagnóstico que motivou a reformulação

*"Isso aqui tá péssimo, monte um plano de reformulação total."* O que estava
errado não eram detalhes:

- **a composição era uma LISTA, não um confronto** — quatro blocos empilhados no
  centro, mesmo peso, mesmo respiro. Layout de formulário;
- **a escala tipográfica era plana**: nome 1,3 rem, força 1,75, mapa 1,32, VS
  1,8. Tudo entre 1,3 e 1,8 — nada dominava, então não havia primeira leitura;
- **o ambiente do mapa quase não aparecia**, apesar das três cores por mapa.

### O que a reformulação fez

**Palco em diagonal.** Os dois times ocupam METADES OPOSTAS da mesma área,
cortadas por `clip-path`. Ocupar a mesma célula é o que faz a diagonal ser uma
costura, e não a borda de cada um — duas caixas vizinhas deixariam um vão. O VS
vive na costura.

**O mapa saiu da marca d'água.** A primeira versão pôs o nome gigante a 13% de
opacidade atrás de tudo, e foi recusada: *"tá muito difícil de ler"*. Virou uma
faixa legível no topo do palco — ordem de leitura: onde, depois quem. E o FUNDO
da antessala puxa a cor do mapa muito mais que o da partida, o que ela pode
fazer porque aqui todo texto vive dentro de lâminas de vidro, com fundo próprio.

**Chips padronizados.** A faixa de contexto tinha duas peças de formatos
diferentes para informações do mesmo nível — uma pílula com título, selo e
subtítulo dentro, e outra com rótulo mais número. Forma diferente para conteúdo
equivalente é o que faz uma faixa parecer bagunçada por mais alinhada que esteja.
Hoje todo item é o MESMO objeto e a diferença é só ênfase.

**Os selos `VOCÊ` saíram**, a pedido: *"eu sei qual time eu sou"*. Eles existiam
como canal textual porque o dono do time era marcado só por cor. A guarda foi
invertida — hoje ela cobra que o selo NÃO volte, para que uma sessão futura não o
"restaure" achando que se perdeu.

### O sistema de vidro — o que fica para as outras telas

Um padrão que vive como números repetidos em cada regra não é padrão: é
coincidência que dura até o próximo ajuste. Então o vidro virou TOKEN, em três
níveis cuja diferença é DISTÂNCIA DO OLHO, não gosto:

| nível | onde | desfoque |
|---|---|---|
| `--vidro-alto-*` | a lâmina principal de uma tela (o palco) | 22px |
| `--vidro-medio-*` | peças sobre ela (chips, botões, faixas) | 14px |
| `--vidro-raso-*` | apoio (notas, trilhos) | 12px |

Mais a escala de raios `--r-lamina` / `--r-peca` / `--r-pilula`.

`tools/check-glass-system.js` trava cinco coisas: os tokens existem; as CINCO
superfícies da antessala os consomem (se alguma voltar a declarar vidro na mão, o
padrão divergiu); quantas superfícies do jogo ainda estão FORA do sistema; todo
`backdrop-filter` tem o par `-webkit-`; e o aviso de medir fps não some do bloco
de tokens.

> **Correção de 08/08/2026.** Este parágrafo dizia SEIS superfícies, e a guarda
> media cinco — a sexta superfície de vidro do jogo é o `.np-card` do palco da
> narração, que declara `blur(16px) saturate(1.3)` na mão e nunca entrou no
> sistema. Afirmar cobertura maior que a real é o defeito que a regra 43 já
> cobrava para contagem de checador, agora numa grandeza nova. A guarda passou a
> travar a dívida em 1: superfície nova na mão reprova, e migrar `.np-card`
> também reprova, porque baixar esse número muda pixel e pede fps medido.

**O prefixo não é preciosismo:** sem ele o vidro simplesmente não existe no
Safari — o aparelho cujo visual foi pedido como referência.

**E o fps foi medido, porque este projeto tem cicatriz disso.** Em 29/07 um
`backdrop-filter` derrubou a tela da partida para 31 fps e foi removido dos
overlays. A antessala com vidro em TUDO mede **61,2 fps contra 60,6 do controle
sem filtro** — perda dentro do ruído. A condição que a torna aceitável está
escrita no bloco de tokens: superfície pequena sobre fundo estático.
**Antes de levar o vidro a uma tela nova, meça o fps DELA** — uma tela em
movimento não é a antessala.

### Dois defeitos meus, achados por medição

- **`estiloDoTime` devolvia `NaN`** no canal azul para hex de três dígitos, e
  `NaN` num `rgba()` não pinta nada — a tela ficaria sem cor sem ninguém
  reclamar. A expansão de hex agora é uma só, em `contrast.mjs`;
- **o nome do time do lado A ficou sem estilo.** Ao remover a regra `.pm-id` num
  script, o seletor `.pm-name` grudou no anterior e virou `.pm-lado--b .pm-name`.
  Regra 23 outra vez: reescrita em massa erra por borda.

### A cor do Outsiders

Era `#39d3ff` — **idêntica** à do time do jogador. Em ~6% dos confrontos os dois
lados saíam da mesma cor. Virou roxo `#7c4dff`, escolhido por medição: 22,2 de
distância do roxo do Spirit e 4,81:1 de contraste com a tinta do monograma.
O golden foi atualizado e o diff tem **duas linhas, ambas a cor** — nenhum
resultado de simulação mudou.

## 11. Um falso alarme, registrado porque a próxima varredura vai reencontrá-lo

A antessala nasce com `opacity:0`. A primeira varredura leu isso como "a tela
inteira está invisível" e quase virou defeito relatado. Medida a evolução, ela
sobe a 1 em ~300 ms **nos dois modos de movimento** — é a transição de entrada, e
`waitForSelector` dá "visível" com opacidade zero porque olha caixa e
`visibility`, não opacidade.

Não é defeito do produto; é régua errada de novo. A varredura passou a esperar
`opacity === 1` antes de medir.
