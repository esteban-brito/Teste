# Bracket, comparador visual e o resíduo do gesto — 06/08/2026

Ciclo sem tocar em dado, OVR, RNG ou balanceamento. Três correções e uma
descoberta de método que vale mais que as três.

O pedido foi "investigue profundamente" antes de publicar os 8 commits locais. A
investigação achou quatro coisas; três viraram correção neste ciclo e a quarta
(refinada da tela inicial) continua aberta por ser decisão visível.

## 1. O comparador visual estava quebrado — e isso bloqueava todo o resto

**`tools/visual-regression.js` não completava o percurso desde `fccd2e1`.** Ele
travava sempre no mesmo ponto: logo depois de `03-versos`, no primeiro arrasto.
Sem erro, sem timeout, sem estado seguinte — pendurava em silêncio.

A causa é uma interação entre duas linhas que ninguém leu juntas:

```js
const CONGELAR=`*{animation-play-state:paused!important; …}`;
await page.addStyleTag({content:CONGELAR});          // capturar(), nunca removido
…
Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished…))  // arrastarCarta()
```

`addStyleTag` deixa o `<style>` na página **para sempre**. A partir da primeira
foto, portanto, toda animação do documento ficava pausada — inclusive a de
distribuição das cartas, que o arrasto espera terminar logo adiante. **`finished`
de uma animação pausada não resolve nunca**, e o `await` não tinha teto.

Por isso travava exatamente ali: `01-inicial` e `02-cartas` não têm arrasto
depois; `03-versos` é a primeira foto seguida de um `arrastarCarta`.

Duas correções, uma de causa e uma de robustez:

- `capturar()` remove o congelador depois da foto. Congelar é artefato da FOTO,
  não do percurso;
- `arrastarCarta()` só espera animação que **pode** terminar (`playState !==
  "paused"`). Esperar pelo que está pausado não é lentidão, é impasse.

**A lição de processo é a mais cara.** O commit `fccd2e1` se chama "o comparador
visual passa a arrastar" e descreve corretamente o que mudou — mas o comando
nunca foi rodado de ponta a ponta. Uma ferramenta que trava sem erro parece
apenas lenta, e o ritual obrigatório de `CLAUDE.md` estava inoperante sem que
nada acusasse.

## 2. O bracket dos Playoffs era a Suíça não curada

Quando `34dec67` tirou a Fase Suíça da fila encostada à esquerda, o quadro irmão
— mesmo overlay, mesmo `display:flex` — ficou com a doença inteira:

| | esquerda | direita | conteúdo / caixa |
|---|---:|---:|---|
| bracket · desktop | 20 px | **504 px** | 916 / 1440 |
| bracket · tablet | 20 px | **−129 px** | 869 / 760 |
| bracket · celular | 20 px | **−342 px** | 712 / 390 |
| *suíça · desktop* | *409* | *409* | *622 / 1440* |

No tablet, o que saía da janela era a coluna `champ-col` — **o troféu do Major**.
Havia `overflow:auto`, então nada se perdia de vez; perdia-se o enquadramento,
que é o mesmo critério pelo qual a Suíça foi corrigida.

A correção é a da Suíça, adaptada: `justify-content:center`, `flex-wrap:wrap` e
`align-content:safe center`. Aqui `wrap` não desmancha a leitura — as rodadas
quebram em ordem, e bracket empilhado é a convenção da tela estreita.

Depois: **262/262 · 50/50 · 27/27**, zero rolagem lateral, zero nó fora da janela.

### A guarda passou a rodar nos dois quadros e em três larguras

`auditarSuica` virou `auditarQuadro`, chamada para `#swissBoard` **e**
`#bracketBoard`. É a regra 20 outra vez — uma guarda só vê a categoria em que
roda, e esta nasceu dentro da Suíça.

**O tablet entrou porque era o único que reprovava.** Em 1440 sobrava espaço e em
390 a linha já tinha quebrado: os dois extremos passavam e o meio falhava. Uma
guarda de duas larguras teria dado verde no defeito que tirava o troféu da tela.

A guarda também mede **nós fora da JANELA**, não só a caixa: com `overflow:auto`
o excedente continua no `scrollWidth`, então medir a caixa não denuncia o que o
usuário só alcança arrastando a tela de lado.

Provada por mutação: revertido o CSS, ela acusa `20 e 504`, `20 e -129` com 5 nós
fora, `20 e -342` com 19 nós fora.

## 3. A interface ensinava o gesto que não existe mais

`136fc11` trocou selecionar-por-clique por arrastar, mas três strings ficaram na
linguagem antiga — e a pior delas é a que o leitor de tela anuncia:

- `#hint` (`aria-live="polite"`): *"…**escolha** 1 jogador por rodada"* e
  *"Time sorteado: X. **Escolha** 1 carta."*
- `#picksNote`, corrigido no commit: *"arraste até um slot para escalar"*

Os dois ficavam **na tela ao mesmo tempo**, dizendo coisas diferentes sobre o
mesmo gesto.

**Uma armadilha de tamanho, pega pela comparação visual.** A primeira redação
("…arraste 1 jogador por rodada até o seu elenco") era mais longa, quebrava em
duas linhas no tablet e, como a captura é `fullPage`, empurrava a página inteira
— 4% a 22% de pixels alterados em estados fora do escopo. A redação final tem
**exatamente o mesmo comprimento da antiga** (46 e 68 caracteres no pior caso
real do catálogo), medida em uma linha nos três viewports.

## 4. Resíduo morto do mesmo commit

Provado pela fonte, não por estado visitado:

- `.flipmode` — o botão "Virar cartas" não existe mais, e `e2e-cartas.js` já
  prova que `#flipModeBtn` sumiu. **Única classe órfã real de `style.css`**;
- `.sel` — `limparHighlights()` remove, `iluminarSlots()` adiciona só `.avail` e
  `.swp`; ninguém adiciona `.sel`;
- `--sel` inline em cada carta de `renderPicks()` — `.sel` era o único leitor.

**A varredura ingênua erra como `docs/` já avisava.** Um primeiro varredor acusou
18 órfãs; 17 eram falso positivo por concatenação (`fn-${slugFuncao(…)}`,
`coach-${caracSlug}`, `c-role2--${…}`). Procurar a string literal não encontra
classe montada em tempo de execução.

## 5. A descoberta de método: a primeira captura era um outlier

A comparação `visual-antes` × `visual-depois` acusou 4 estados do tablet com
**4,36% · 17,89% · 9,79% · 22,47%** de pixels alterados — em telas que minhas
mudanças não tocavam.

Antes de culpar o próprio trabalho, dois controles:

1. **duas capturas do MESMO código** (`visual-depois` × `visual-controle`):
   17/17 idênticas. O comparador **é** determinístico;
2. **duas capturas do código ORIGINAL** (`visual-antes` × `visual-antes2`),
   revertendo o produto por stash e mantendo só a ferramenta corrigida:
   reproduziu **os mesmos quatro números, exatos**.

Logo aquelas diferenças não eram do código. `visual-depois`, `visual-controle` e
`visual-antes2` concordam entre si; **`visual-antes`, a primeira execução, é o
outlier** — ela foi feita logo após uma limpeza de processos, e alguma condição
de máquina daquela execução mudou a renderização dos gradientes do tablet.

**Regra que sai disso: um `MUDOU` não é prova de que você mudou.** Antes de
explicar um diff visual, capture duas vezes o mesmo código e meça o piso de
ruído. Sem esse piso, o ritual do `CLAUDE.md` — *"estados fora do escopo devem
permanecer pixel a pixel idênticos"* — culpa a mudança por variação da bancada, e
o custo é reescrever trabalho correto.

### Comparação final, contra a régua limpa

`visual-antes2` × `visual-depois`: **11 de 21 mudaram**, todas explicadas.

- **9** são a faixa de 10 px da linha do `#hint`, nos três viewports × três
  estados — a mudança de texto, intencional;
- `desktop-05-suica` (10 px, 1 linha) e `desktop-07-mapa` (0,325%, barra de
  progresso e roundstrip): desvio máximo de **6 por canal**, conteúdo conferido
  idêntico imagem a imagem. É a classe de ruído sub-pixel já registrada em
  `docs/testing.md`.

Os 10 estados restantes ficaram idênticos — inclusive `04-elenco` a `07-mapa` no
tablet e no celular, que é onde uma regressão de layout apareceria.

## 5-bis. A corrida de `requestAnimationFrame` — o defeito mais caro do ciclo

Depois de tudo verde, `npm run test:all` reprovou `e2e-acessibilidade` com
`waitForFunction: Timeout 30000ms`. A execução seguinte passou. **Intermitente —
e o `CLAUDE.md` proíbe reexecutar até passar.**

A medição, com 15 arrastos por viewport:

| viewport | quadros usados (máx) | margem até o teto de 240 | vão | arrastos perdidos |
|---|---:|---:|---:|---:|
| desktop | 2 | 99% | 316 px | 0/15 |
| tablet | 9 | 96% | 448 px | 0/15 |
| **celular** | **240** | **0%** | **1266 px** | **2/15 (13%)** |

O celular vivia exatamente na borda. A primeira hipótese — oscilação, o passo
passando do ponto e o laço invertendo — **foi derrubada pela medição: zero
inversões**. O que a trilha mostrou foi outra coisa:

```
slot 0:  80 quadros ·   1 sem avanço   → av=7,7,7,7,7…
slot 1: 159 quadros ·  80 sem avanço   → av=0,7,0,7,0,7…
slot 2: 229 quadros · 115 sem avanço   → av=0,7,0,7,0,7…
```

**São dois laços de `requestAnimationFrame` disputando o mesmo relógio**: o do
teste e o `pulsoAutoRolagem` do produto. Enquanto estão em fase, cada quadro do
teste rende uma rolagem. Assim que saem de fase — e a fase inicial varia a cada
execução —, o teste gasta **dois quadros por rolagem efetiva**.

A conta fecha: 1.404 px de vão a **7 px por quadro** são ~200 quadros úteis, que
a desincronia dobra para ~400, contra um teto de 240. Medido depois da correção,
o pico real é **299 quadros** — acima do teto antigo, o que confirma que o limite
era insuficiente e o gesto nunca foi instável.

**A correção é trocar a régua, não afrouxá-la.** Contar iteração mede o relógio
do teste; contar progresso mede a página. O laço agora desiste por **90 quadros
consecutivos sem rolagem** — que só acontece se a página acabou ou o gesto morreu
— e o teto numérico vira mero antitravamento. E ele passou a **falhar alto**:
antes saía em silêncio e soltava o ponteiro onde o slot não estava, transformando
uma causa local num `waitForFunction` cego 30 segundos depois.

Depois: **0 arrastos perdidos em 25** por viewport, e `e2e-acessibilidade` passa
3/3 execuções seguidas.

**Isto era bloqueio de publicação.** A flutuação entrou com `136fc11`, um dos 8
commits locais, e teria deixado o CI vermelho ao acaso em metade das execuções.

## 5-ter. Segunda metade do ciclo — o gesto unificado e a tela inicial

O responsável autorizou as duas frentes que estavam em aberto: *"minha decisão é,
sim, faça. Absolutamente tudo."*

### O arrasto passou a viver em `bancada/lib/arrasto.js`

Eram **três implementações** do mesmo gesto — `e2e-acessibilidade.js`,
`e2e-game-flow.js` e `tools/visual-regression.js` —, e a correção da §5-bis teve
de ser escrita duas vezes.

**Duas estratégias foram preservadas de propósito, porque provam coisas
diferentes:**

- `porAutoRolagem` — ponteiro de TOQUE, deixa a auto-rolagem do produto trazer o
  destino. É o gesto real do dedo no celular, e a única prova de que essa
  auto-rolagem existe: sem ela o laço nunca converge;
- `porMouseCentralizado` — enquadra os dois alvos por script e arrasta com MOUSE
  real. Não exercita a auto-rolagem, mas é imune ao vão e ao relógio, e prova a
  fidelidade ao dispositivo apontador.

Unificar as duas em uma trocaria uma cobertura pela outra. **O errado nunca foi
haver duas estratégias; era haver três implementações.**

### A tela inicial, contra os números do diagnóstico

| medida | antes | depois |
|---|---:|---:|
| vazio à esquerda da roleta (1440) | 475 px · 40% | **1 px · 0%** |
| fitas inteiras visíveis (1440) | 2 de 7 | **4 de 7** |
| área do link ÷ área da ação principal | 7,7× | **2,8×** |
| rolagem vazia · desktop | 55 px | **0** |
| rolagem vazia · tablet | 137 px | **30 px** |

Três mudanças, e nenhuma delas é ajuste de espaçamento:

1. **`.track.ocioso{padding:0}`.** O padding lateral existe para o GIRO — é ele
   que deixa `offsetParaCentralizar` levar qualquer fita ao marcador. Em repouso
   o transform é zero, então a fita 0 nascia no centro e a metade esquerda ficava
   vazia **por construção**. Zerar o padding só no estado ocioso enche a caixa
   sem tocar na matemática do giro: `sortear()` remove a classe e relê
   `paddingLeft` do estilo computado antes de calcular o destino;
2. **teto de largura nos links de navegação.** Área é o que o olho usa para
   ordenar importância, e a ordem estava invertida;
3. **os dois rótulos de seção viraram um.** "Hall da Fama" e "Base de elencos"
   repetiam o que o próprio link já diz em `.rl-t`, e cada um custava 44 px numa
   página que rolava vazia. Um rótulo — "Acervo" — com os dois links lado a lado
   por `auto-fit`/`minmax(260px,1fr)`, e **não** por media query, pela mesma
   razão da regra 21.

**A comparação visual acusou 21 de 21 por TAMANHO, não por pixel**: a página
encolheu 107 px no desktop e no tablet, 34 px no celular. Com captura `fullPage`,
mudar a altura do documento desloca todas as capturas, inclusive as de overlay —
e o comparador não diffa imagens de dimensões diferentes. Nesse caso o ritual só
fecha por **inspeção**, e as imagens foram conferidas uma a uma.

### Uma suspeita levantada e DERRUBADA pela medição

Na inspeção, o `⚄` do botão parecia uma caixa vazia de glifo ausente. A medição
diz que não: ele mede **12,32 px** contra **12,69 px** de um code point da área de
uso privado, que ninguém desenha. Largura própria significa que alguma fonte o
desenha — é o dado real, monocromático e pequeno na captura. **Não é defeito e
não foi mexido.** Fica registrado porque a próxima inspeção verá a mesma coisa.

## 5-quater. Dois defeitos de interação relatados ao testar

O responsável testou a build e apontou dois. Ambos vinham do ciclo do arrasto.

### Arrastar selecionava o texto da página

*"quando eu clico e segura pra arrastar uma carta, ai meio que seleciona todas as
palavras que tao na tela."* Medido: **1.801 caracteres** num único gesto.

O produto só entra em modo arrasto depois de 8 px, e nessa janela o navegador já
começou a seleção nativa. `touch-action:none` barrava o dedo e não dizia nada
sobre o mouse. Corrigido em três camadas: `user-select:none` na carta e no slot,
seleção desligada na página inteira enquanto o arrasto está ativo, e
`removeAllRanges()` para desfazer o que o navegador já iniciou.

**A guarda me enganou três vezes, e as três davam verde contra o produto
QUEBRADO:**

1. **distância curta** — a variável é o quanto o ponteiro varre, não a velocidade
   do gesto: 24 px selecionam 0, 120 px selecionam 153, 400 px selecionam 1.801.
   A primeira versão andava 24 px;
2. **animação em curso** — com `deal` rodando, a caixa medida já mudou quando o
   ponteiro desce, e ele cai ao lado da carta, sobre fundo sem texto;
3. **alvo fora da viewport** — `boundingBox()` não rola a página, e depois do
   sorteio o produto chama `scrollIntoView` no `#picksTag`.

E o CONTROLE é obrigatório: "0 caracteres" também é o que devolve um ponteiro que
não seleciona nada em lugar nenhum. Ele arrasta sobre o `.logo` **a partir da
borda** — no centro de um bloco de duas linhas o ponto cai no vão entre elas.

### O giro da roleta congelava o elenco

*"quero que dê pra mexer nas coisas enquanto a roleta tá sorteando, mas não dá
pra fazer nada."* A trava era `if(S.spinning)return` no `pointerdown` e no
`keydown`, e valia para **toda** carta — inclusive as já escaladas, que não têm
relação com o sorteio em curso.

Para as cartas do sorteio ela era **redundante**: `#picks` fica vazio enquanto
gira, e o ramo `ehPick` já exige `S.drawn`, que só existe depois que a fita para.
Removida, a line volta a aceitar virar e trocar de posição durante o giro, e o
estado sobrevive ao giro terminar no meio da interação.

A guarda exige que o giro **ainda esteja em curso** no momento da interação —
sem isso ela não diria nada sobre o que pretende provar. Reintroduzida a trava,
ela acusa: `front → front`.

**Um efeito colateral útil:** `revealDraw` passou a checar o candidato ANTES de
girar. Com uma carta pendente o `.spinwrap` fica `gone` e `#rollbtn` deixa de ser
clicável — quem re-sorteia ali é `#respinbtn`. Sem isso, qualquer passo que deixe
um sorteio pendente derrubava a rodada seguinte com um timeout de clique que não
apontava para a causa. Aconteceu duas vezes nesta sessão.

## 5-quinquies. Narração ao vivo opcional (06–07/08) — a maior fatia do ciclo

O responsável pediu uma antessala para escolher **com ou sem narração**, com
dupla narrando 3 a 5 rounds sorteados, ligada a jogadores, táticas e clutchs — e
um modo limpo "zerado". Isso **revogou em parte** a decisão de 05/08, e a emenda
está na §11-bis de `docs/project-context.md` com três condições cumulativas:
opt-in explícito, modo limpo equivalente, motor intocado.

Entregue em `src/domain/narrative/live-commentary.mjs` + `map-callouts.mjs`,
com `tools/check-live-commentary.js` no `npm run check` (21 checadores agora).

### Quatro rodadas de feedback, e o que cada uma corrigiu

**1ª — "muito rápido, quero que o round congele e fique destacado, liquid glass".**
O round narrado passou a PARAR o jogo: painel de vidro (`backdrop-filter`) sobre
o mapa, com o NÚMERO do round grande e um rótulo do momento. O fps foi medido
porque este projeto já perdeu a partida ao vivo para 31 fps por `backdrop-filter`
em 29/07: deu **60 contra 59,6** do modo limpo — o caso é o oposto daquele, painel
pequeno sobre fundo visível.

**2ª — "parece que uma pessoa tá matando bots, tudo genérico".** Estava certo: eu
usava só `destaque` e placar. Passou a usar `snapA`/`snapB`, que trazem kills e
mortes dos DEZ jogadores; o delta contra o round anterior diz quem abriu, quem
confirmou e quem resistiu. A guarda agora **exige** dois nomes num round de dois
protagonistas, e que o time perdedor também seja nomeado.

**3ª — "nada de analise, quero narração em tempo real".** As três vozes de
estúdio foram removidas. Ficou `momento`, em três tempos: ONDE (callout do mapa
real), SITUAÇÃO (1vX, bomba no chão), DESFECHO. O exemplo do responsável define
o formato: *"flame segue pelo duto e vai até o bomb B, é 1x4 com a bomba
plantada […] e é hs, clutch perfeito de flame!"*

**4ª — "3 é o limite, não tem mínimo, e emocionante é ele GANHAR".** A seleção
deixou de ser sorteio e virou **mérito**: `pontuarRound` dá peso a clutch ganho,
ace, eco que rouba round e placar apertado, **subtrai** quando é o usuário que
perde o clutch, e multiplica por 1,35 quando o time é dele. Piso de emoção 45,
teto de 3, **mínimo zero** — mapa morno não narra nada. A seleção não consome
aleatoriedade: o mesmo mapa destaca sempre os mesmos momentos.

### Bugs achados por medição, não por olhar

- **o painel abria VAZIO** por meio segundo (5 de 73 amostras): o respiro
  acontecia depois de abrir. Agora acontece antes — quando o painel entra, a
  primeira fala já está nele;
- **o painel ficava PRESO** ao pular o mapa, e de novo no fim: `pularMapa`
  cancelava o timer que o fecharia, e `finalizarReproducao` o reabria para o
  fechamento sem nada fechá-lo. Hoje o fechamento fala e sai em 4,2 s;
- **português quebrado**: "por a garagem", "no o A". Os callouts guardam o artigo
  (o gênero é do lugar, não da frase), então a frase precisa contrair —
  `pelo()`, `no()`, `pro()`, `da()`. A guarda varre os 7 mapas × 4 situações ×
  12 variantes.

### Também nesta fatia

- **botão de elenco aleatório** (5+1 de uma vez): pool embaralhado numa passada,
  não tentativa-e-erro — são 85 jogadores para 77 nicks, e um laço sem teto
  travaria. Medido: 40/40 sorteios válidos e distintos, pior caso 150 ms;
- **o giro da roleta não congela mais o elenco**: a trava `if(S.spinning)return`
  valia para toda carta, inclusive as já escaladas, e era redundante para as do
  sorteio (`#picks` fica vazio girando);
- **curva de ritmo do mapa**: `sin(pos·π)` deixa o primeiro e o último round em
  620 ms e o miolo em 241 ms. Senoidal e não linear porque rampa reta se percebe
  como três velocidades; o seno não tem quina.

### Técnicas atuais aplicadas — as que removem código

`@starting-style` + `transition-behavior:allow-discrete` (entrada e saída do
painel sem JS, e `hidden` voltou a ser fonte única de verdade); `@property`
tipando o ângulo do gradiente, que é o que torna o brilho do vidro animável;
`toSorted`/`?.`; `text-wrap:pretty`. **`@layer` foi recusado**: a cascata desta
folha tem armadilhas documentadas e camada de refinamento que vence por ordem.

## 6. Estado ao fim do ciclo

- `npm run validate` verde: **26/26 suítes** e **21/21 checadores** — o vigésimo
  primeiro é o `check-live-commentary`, que entrou nesta fatia;
- guarda nova provada por mutação nos dois quadros e nas três larguras;
- `e2e-acessibilidade` passa 3/3 execuções seguidas; 0 arrastos perdidos em 25
  por viewport;
- comparação visual contra a régua limpa: 11 de 21 mudaram, todas explicadas;
- `style.css` foi de 1720 para **1881** linhas e `game.js` de 1082 para **1307**.
  A versão anterior desta linha dizia "1720 para 1732", medida quando só o
  bracket tinha entrado; as fatias do gesto, da tela inicial e da narração vieram
  depois e nada as remediu. **Número de fim de ciclo se mede no fim do ciclo** —
  este ficou meio dia desatualizado dentro do próprio relato.

O relatório de rating segue marcando `Título (elenco draftado) 24,8%` contra o
piso de 25. **Não é regressão deste ciclo**: é exatamente o número já registrado
no `CLAUDE.md` como ruído de amostra com `N=3000` — com `N=12000` dá 26,5% contra
26,6% da baseline. Gate marginal pede amostra, não calibração.

## 6-bis. O rescaldo de 07/08 — a contagem que ninguém tinha dono

Ao conferir o estado antes de publicar, cinco números vigentes estavam errados, e
**todos pelo mesmo motivo**: o `check-live-commentary` entrou no `npm run check`
nesta mesma fatia, e nada no repositório sabia que "20 checadores" tinha dono.

| onde | dizia | é |
|---|---:|---:|
| `CLAUDE.md` §05/08 | 20 checadores | 21 |
| `docs/retomada-2026-08-05.md` §1 | 20 checadores | 21 |
| §6 deste arquivo | 20 checadores | 21 |
| `docs/project-context.md` | 20 checadores · 25 suítes | 21 · 26 |
| `docs/project-context.md` | `game.js` 882 linhas | 1.307 |

O handoff também dizia **"working tree limpo"** e apontava `origin/sandbox-test`
para `c6a57df`, quando origin está em `d87c184` com 8 commits locais à frente e o
ciclo inteiro por commitar. É a seção que o próprio arquivo declara como a que
mais envelhece — e envelheceu.

**A correção não é editar os cinco.** `check-doc-measurements.js` ganhou uma
segunda marca, `<!-- contagem-verificada -->`, que conta a grandeza na FONTE que
a produz: `CHECADORES` em `tools/run-checks.js` e `SUITE_GROUPS` em
`bancada/run.js`. Guardar o número em outro lugar só moveria o problema.

Provada por mutação, quatro vezes — inclusive no cenário real:

```text
✓ doc diz 20 checadores quando são 21    → retomada:48 diz 20; tem 21
✓ doc diz 25 suítes quando são 26        → retomada:49 diz 25; tem 26
✓ doc declara grandeza que ninguém conta → "retratos" não é contável
✓ um checador NOVO entra em run-checks   → retomada:48 diz 21; tem 22
```

A quarta é a que importa: ela injeta em `run-checks.js` exatamente o que
aconteceu de verdade e prova que, daqui em diante, a documentação cai junto.

**Um erro meu no caminho, registrado porque é a regra 23 num eixo novo:** a
primeira versão do casador contava só `[` e `]`, e `SUITE_GROUPS` abre com `{` —
nunca teria fechado a âncora. Escrevi o parser antes de olhar a forma real dos
dois literais que ele precisa ler. Virou a regra 44 do `CLAUDE.md`.

## 7. O que ficou aberto, e por quê

**A refinada visual da tela inicial** (§3.6-bis da retomada) continua aberta:
mudar a forma da roleta é decisão visível e precisa ser pedida. O diagnóstico foi
remedido neste ciclo e **dois números do handoff anterior estavam errados** — ver
a seção corrigida.

**Nada da investigação ficou sem diagnóstico.** O `TimeoutError` intermitente do
celular, que a princípio parecia merecer fatia própria, era a mesma corrida de
`requestAnimationFrame` da §5-bis e foi corrigido aqui.

**Fica em aberto, como observação e não como tarefa:** existem hoje **três
implementações do mesmo arrasto sintético** — `e2e-acessibilidade.js`,
`visual-regression.js` e `e2e-game-flow.js`. As duas primeiras usam a
auto-rolagem do produto (e por isso provam que ela existe); a terceira centra os
dois alvos antes de medir e nunca sofreu com o teto. A correção da §5-bis teve de
ser aplicada **duas vezes**, e a próxima também terá. Unificar é um refactor de
bancada com paridade a provar, não um item de faxina.
