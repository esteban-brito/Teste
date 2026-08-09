# CLAUDE.md

Este é o ponto de entrada automático para o Claude neste repositório. Ele não
substitui as fontes de verdade: serve para impedir que uma nova sessão repita bugs
já entendidos ou declare o trabalho pronto sem prova suficiente.

## Antes de qualquer alteração

1. Leia `AGENTS.md` inteiro. Suas regras de branch, autonomia, separação entre
   refatoração e balanceamento e validação são obrigatórias e têm precedência.
2. Leia `docs/retomada-2026-08-05.md`, o handoff geral; depois leia
   `docs/project-context.md` e `docs/next-steps.md`.
3. Antes de tocar aplicação, estado ou UI, leia
   `docs/p5-aplicacao-ui-2026-07-29.md`.
4. Antes de tocar cartas, leia as regras 1–21 deste arquivo, as §14 e §20–§23 de
   `docs/cartas-design-2026-07-28.md`, `docs/card-portraits.md` e
   `docs/testing.md`.
5. Antes de procurar qualquer dado do projeto, leia `src/data/catalog.mjs`.

Branch de trabalho: `sandbox-test`. `main` permanece intocável sem pedido
explícito. Preserve mudanças preexistentes e confirme `git status` antes e depois.

## Prioridade do responsável: robustez antes de velocidade

O responsável prefere esperar a aceitar uma mudança frágil. Para este projeto:

- confiança vem de uma guarda que consegue falhar, não apenas de leitura de código;
- uma captura visual estável não prova que o layout está correto — duas execuções
  podem reproduzir o mesmo corte de texto;
- um teste verde local não encerra trabalho publicado: confirme também CI e deploy;
- uma falha remota não deve ser simplesmente reexecutada até passar. Leia o log,
  identifique a causa e elimine a flutuação;
- nunca relaxe tolerância, amostra, golden ou snapshot para obter verde;
- não misture correção visual/estrutural com dados, OVR, RNG ou balanceamento.

## Contratos que impedem a volta dos bugs das cartas

Fontes reais:

- `style.css`: geometria e aparência;
- `src/ui/game/card-view.mjs`: HTML puro das duas faces;
- `src/application/card-face.mjs`: única transição de frente/verso;
- `prototipo-cartas.html`: laboratório que importa os três artefatos reais;
- `bancada/suites/e2e-cartas.js`: prova geométrica e interativa no Chromium.

Regras não negociáveis:

1. Não crie uma segunda cópia de CSS, dados ou HTML no laboratório.
2. Nunca alterne `.flipped` diretamente. Use
   `setCardFlipped(card, showBack)`, que sincroniza classe, `data-face` e
   `aria-hidden`.
3. Somente a face visível pode receber ponteiro ou participar da árvore de
   acessibilidade. Cartas acionáveis precisam manter semântica de botão e teclado
   (Enter/Espaço).
4. Container queries não estilizam o próprio container pela medida dele. A
   densidade compacta consulta `.card`/`.coachcard`, mas aplica tokens em `.cfaces`,
   que é descendente.
5. Preserve a costura comprovada: 151 px usa densidade completa; 150 px e abaixo,
   compacta. O E2E mede 250/188/176/151/150/149/130/120 px.
6. Hover de carta só pode existir sob
   `@media (hover:hover) and (pointer:fine)`. Touch não pode deixar elevação ou aro
   presos. Teclado continua com `:focus-visible`.
7. `prefers-reduced-motion` deve eliminar a transição de flip e a holografia
   contínua.
8. O medidor deve reprovar estouro horizontal, recorte vertical e colisão entre
   regiões. Reticências declaradas são relatadas, não tratadas como defeito.
9. As provas sintéticas de nome impossível e colisão garantem que o medidor não
   esteja sempre verde. Não as remova.
10. O E2E precisa abrir também `index.html?e2e=1` em viewport móvel e provar
    proporção 5:7, ausência de overflow, modo Virar, reset e seleção normal.
11. O verso não contém `.c-vovr`, RTG nem pesos numéricos da receita. O OVR
    continua na frente e o rating continua no dado/motor; remover a exibição não
    autoriza apagar ou recalibrar nenhuma dessas informações. O verso **carrega**
    `.c-vid` — função principal e time sob o nick —, para não ser anônimo quando a
    carta está virada; `tools/check-game-view-modules.js` congela essa linha.
    O primeiro slot de estatística é o Firepower e é a âncora de leitura: corpo e
    trilho maiores que os outros três, por hierarquia, não por exceção.
12. Jogador e treinador compartilham `.c-vrod`. `camp` e `coloc` vêm da era do
    elenco, precisam existir nas duas categorias e permanecem visíveis inclusive
    na densidade compacta. Campeonato não usa reticências.
13. Carta não projeta halo: a superfície não tem `box-shadow` externo. O aro de
    raridade vive em `.card::after`, dentro dos limites da carta, com `--aro`
    (espessura) e `--aro-pintura` (material). **Não volte a usar
    `box-shadow:inset` para isso**: `inset` é pintado abaixo dos filhos e
    `.cfaces` cobre `inset:0` de forma opaca — foi assim que as faixas 1–3
    ficaram sem moldura visível. Também não há varredura de luz na entrada,
    holografia contínua, rotação ou overshoot acima de escala 1 nas animações de
    distribuição/encaixe.
14. Movimento usa os tokens centrais de `style.css`: hover 180 ms, flip 360 ms
    com fade de 180 ms, distribuição 400 ms e encaixe 280 ms, todos com a curva
    editorial. `prefers-reduced-motion` desliga transições e animações da carta.
15. O E2E exige, nas oito larguras, rodapé em 100% das cartas, tamanhos mínimos,
    contraste calculado de pelo menos 4,5:1 e ausência física dos nós removidos.
    Não substitua essas provas por uma captura bonita.
16. A geometria só é comparável depois de `Chakra Petch 700` carregar de fato.
    `document.fonts.ready` também resolve em falha; preserve o preload, a carga
    explícita e a asserção de `document.fonts.check` do laboratório/E2E.
17. **Vão vertical entre dois corpos diferentes mede-se na LETRA, nunca na
    caixa.** `Range.getBoundingClientRect()` devolve a caixa da FONTE, do
    `ascent` ao `descent`; a maiúscula ocupa só o miolo dela, e o espaço morto é
    proporcional ao corpo. Igualar caixas de corpos diferentes desiguala letras —
    foi assim que três assimetrias de 3 a 9 px passaram com o medidor cravando
    0,1 px. Use `letraInicio`/`letraFim` do laboratório, que tiram a métrica da
    fonte REAL de cada elemento e da string REALMENTE renderizada: a carta mistura
    Chakra Petch e Barlow, e uma constante única para tudo dá resultado errado.
    Para um elemento sozinho a caixa serve — `ascent − descent ≈ cap height`, e o
    erro fica em ~0,01em. Detalhe na §21 do design.
18. **O material do cromo é um só nas quatro características do treinador.** Cor
    de TEXTO pode ser saturada, porque ali saturação é identidade; SUPERFÍCIE não
    pode — metal é quase acromático com um tingimento. Os quatro
    `--c-<carac>-metal` têm croma normalizado em 0,087, o do gestor, que era o
    único que lia como metal. Não volte a servir `--cromo` de `var(--r)`.

## Ritual para qualquer mudança visual de carta

```text
npm run visual:capturar -- visual-antes
# faça a mudança primeiro no laboratório/artefatos reais
node bancada/suites/e2e-cartas.js
npm run visual:capturar -- visual-depois
npm run visual:comparar -- visual-antes visual-depois
```

Inspecione todas as imagens alteradas. Explique por que cada região mudou; estados
fora do escopo devem permanecer pixel a pixel idênticos. Depois rode a matriz de
`AGENTS.md`; para um marco amplo de cartas/UI, encerre com `npm run validate`.

Os E2E usam servidores efêmeros. Não escolha faixas que incluam portas bloqueadas
pelo Chromium: a porta 6000 gera `ERR_UNSAFE_PORT`. O fluxo principal usa
7000–7299; a causa e a regra permanente estão em `docs/testing.md`.

## Histórico: o checkpoint Tactical Editorial (30/07/2026)

`5ae9531`, `24f1aca` e `bf5d5e5` removeram halos, varredura de luz, holografia
contínua e overshoot, e padronizaram raridade, treinador, frente, verso e
movimento. **Tudo o que sobrou desse ciclo já está nas 16 regras acima** — não
repita os números daquele dia: o laboratório mudou de 145 para 153 casos e o
bloco `#proposta` deixou de existir. O relato completo fica em
`docs/cartas-design-2026-07-28.md`.

## Carta canônica e retratos (31/07/2026) — estado vigente

A A refinada foi promovida e é a única carta do jogo e do laboratório. Não
existem `#proposta`, tecla P, A/B/C, referência `369c480` ou encaixe medido.

- jogador usa tipografia universal, bandeira/roles/time sempre visíveis e quatro
  stats; qualquer exceção individual reprova o E2E;
- recorte de runtime é fixo em `100% auto · 50% 12%`; novos retratos são
  normalizados como assets 5:7 antes de entrar;
- o campo cru `foto` contém asset-id e tem cobertura declarada no catálogo;
- `tools/check-card-portraits.js` valida formato, proporção, resolução, peso,
  referências e órfãos;
- `donk_kato24` é a referência e o molde visual da escada/matriz; a comparação
  mudou somente 9/21 estados com cartas e `npm run validate` fechou 25/25 em
  184,2 s;
- a próxima fatia visual é adicionar retratos pelo protocolo de
  `docs/card-portraits.md`, nunca criar CSS por jogador.

Refinamento final do mesmo dia, publicado em `7175c26`:

- nick e bandeira dividem a primeira linha; função principal ocupa a segunda;
  função secundária e time dividem a última, sem a bandeira encostar no time;
- os quatro stats do verso usam toda a largura útil e ocupam ao menos 35% da
  altura; campeonato/ano e colocação permanecem no rodapé reservado;
- a grade compacta usa tracking comum até 176 px e corpo comum reduzido até
  150 px para neutralizar diferenças FreeType/DirectWrite, sem exceção por nick;
- o E2E mede 153 cartas em 250/188/176/151/150/149/130/120 px e também trava
  alinhamento da bandeira, afastamento do time e ocupação dos stats;
- o deploy aplica cache-busting de conteúdo ao CSS do laboratório; a execução
  `30652005186` ficou verde e publicou o checkpoint;
- o registro completo daquele dia está em `docs/ciclos/retomada-2026-07-31.md`;
  as próximas grandes etapas migraram para `docs/retomada-2026-08-05.md`.

## Sessões de 01–02/08/2026 — o que mudou depois daquele checkpoint

A frente do treinador **voltou a ser a grade do jogador**, com duas linhas em vez
de três: nick + bandeira, depois característica + time. `coachFront` deixou de ter
template próprio e chama `frenteHtml`, então refino da frente do jogador chega ao
treinador de graça. O OVR subiu para o topo esquerdo, na posição exata do jogador;
a placa desceu para a base; o serrilhado saiu da frente e sobrevive no verso.
Isso **substitui** a §19.5 do design, que descrevia a frente replicando o verso.

Também entraram: o monograma do nick no campo sem retrato (80 dos 85 jogadores),
retratos refeitos pela grade de `docs/card-portraits.md` com a bancada
`recorte-retratos.html`, e o cromo de material único descrito na regra 17.

Duas lições desse ciclo estão nas regras 17 e 18 acima e detalhadas nas §20 e §21
do design. A mais cara: **uma compensação calibrada contra a régua errada não
conserta o desvio, ela o cria.** Os três `padding` de simetria da carta — frente
do treinador, verso do jogador, verso do treinador — todos pioravam o que diziam
corrigir, e todos passavam verdes.

Dívida declarada em aberto: o teto de `equilíbrio corpo/era do treinador` está em
2,5 px em vez de 1,5 px por causa de ~2,3 px de resíduo inexplicado na faixa
176/151 px. Ver §21.

## Sessão de 02–03/08/2026 — sistema de design, grade e a terceira régua

Ciclo inteiro sem tocar em dado, OVR, RNG ou balanceamento. Detalhes nas §22 e
§23 do design e em `docs/testing.md`.

### Três regras novas, não negociáveis

19. **A aresta visível do jogador é a DIAGONAL, não o topo da caixa da placa.**
    No eixo do nick ela corre `--corte-n × (1 − --pad) = 8,19%` da altura da placa
    abaixo dela; `--diag-k` guarda esse número. Só o treinador, com
    `clip-path:none`, tem caixa e aresta no mesmo lugar. Medir a placa do jogador
    pela caixa diz que sobra ar onde há folga estrutural — foi assim que a
    primeira versão desta fatia encolheu a placa e encostou o nick na diagonal.
    É a **terceira** vez que a régua errada engana neste componente: §18 trocou
    `getBoundingClientRect` por `Range`, §21 trocou a caixa da fonte pelo glifo,
    §22 troca a caixa da placa pela aresta. Antes de confiar numa medida,
    pergunte o que o OLHO usa como referência.
20. **As duas categorias centram a identidade na placa.** O jogador centra entre
    a diagonal e a base; o treinador, entre a caixa e a base. Nenhum dos dois é
    ancorado por aresta. A guarda de simetria roda nas DUAS categorias — ela
    nasceu dentro do ramo do treinador e por isso 135 cartas ficaram tortas sem
    ninguém ver. Uma guarda só vê o eixo que mede **e a categoria em que roda**.
21. **`.picks` e `.squad` são a mesma grade.** Mesmo `--grade-pad` e mesma caixa
    — inclusive a borda de 1 px, transparente no `.picks`, porque com
    `box-sizing:border-box` 2 px de diferença mudam o número de colunas. O número
    de colunas vem de `auto-fill` com piso de 120 px, que é a menor largura
    provada pelo E2E: **o produto não pode ir onde nada foi medido.** Não
    reintroduza media query de coluna — era ela que entregava carta de 105,7 px e
    um salto de 82% em um pixel de viewport.

### Sistema de cor

A paleta tinha 225 hex e 178 `rgba()` crus contra ~40 tokens, e não era ruído:
eram cores **concorrentes para o mesmo papel**. 121 literais viraram token sem
mudar um pixel; nenhuma cor foi consolidada, porque consolidar é decisão visível.
`tools/check-design-tokens.js` trava isso no `npm run check`.

Duas armadilhas medidas, ambas registradas em `docs/testing.md`:

- **`color-mix(in srgb,C p%,transparent)` NÃO é `rgba(C,p)` na tela.** É igual na
  álgebra e o Chromium arredonda diferente: 21 de 21 capturas deslocadas em
  1/255. Cor translúcida de token usa `rgba(var(--x-rgb),a)`, que é exato. Daí
  cada cor ter duas formas — e a guarda provar que as duas concordam;
- **um token pode guardar qualquer literal; uma propriedade normal não.** É o que
  deixa a escada de raridade manter `#3ec07e` sem virar `var(--t2-green)`: mesmo
  valor, papéis diferentes, e devem poder divergir.

### Cascata

33 declarações não chegavam à tela — base sobrescrita sem query no meio,
duplicatas byte a byte, um `border-radius` fantasma. Removidas sem mudar pixel.
E uma regra responsiva estava **morta**: `.swiss-col{min-width:138px}` do
`@media(max-width:640px)` vinha antes de um `172px` de topo com a mesma
especificidade, então o celular nunca recebeu a coluna estreita. Varra a folha
com essa pergunta ao mexer na camada de refinamento: ela vem DEPOIS das media
queries e ganha por ordem.

### Tokens removidos

`--b1`, `--b2`, `--b3` e os valores mortos de `--t3`/`--t4` em `.cfaces`. Provados
mortos **por mutação**, não por leitura: valores absurdos moviam 0 de 279 medidas
contra 156 do controle. O `:root` já tinha passado por essa limpeza em 01/08; a
geometria da carta não tinha.

## Sessão de 03/08/2026 — organização do repositório

Ciclo sem tocar em dado, OVR, RNG, balanceamento, CSS ou geometria. A comparação
visual fechou **21/21 idênticas**. O que mudou de lugar:

- `bancada/` saiu de 42 arquivos planos para `run.js` + `lib/` (6) + `suites/`
  (25) + `golden/` (3) + `ferramentas/` (7). Detalhe em `docs/testing.md`;
- `docs/dados/` recebeu os três JSONs congelados; `p2-modularizacao` foi para
  `docs/ciclos/`; `ADD_TEAM.md` virou `docs/add-team.md`;
- `requirements-fidelity.{in,lock}` foram para `tools/`;
- `npm run check` virou `tools/run-checks.js`;
- a suíte do worker, antes chamada `worker-calibrador.js`, virou
  `bancada/suites/calibrador-worker.test.js` — o nome antigo era quase homógrafo
  de `calibrador-worker.js`, o Worker de verdade que ela testa;
- entraram `.gitattributes`, `.editorconfig` e `.nvmrc`; 37 arquivos foram de
  CRLF para LF e 4 perderam o BOM.

### Três regras novas

22. **Antes de mover arquivo, tire o caminho da contagem de `..`.** `common.js`
    definia `ROOT` como `__dirname + ".."`, e 16 caminhos em 12 arquivos
    dependiam da profundidade de quem os calculava — mover qualquer coisa
    reescreveria todos em silêncio. Hoje `ROOT` sobe até achar `package.json` e
    `GOLDEN` deriva dele. Fazer isso numa fatia separada, ANTES da mudança de
    pasta, é o que impede que organização vire mudança de comportamento.
23. **Reescrita de caminho em massa erra por borda, não por lógica.** Duas vezes
    no mesmo dia: o padrão `simulation-golden.js` casou como **prefixo** dentro
    do nome `simulation-golden.json`, mandando o golden para a pasta errada; e um
    script que tratava `./X` e `../docs/` passou
    batido nos cinco `../src/` — o segundo derrubou 16 suítes de uma vez porque
    `lib/motor.js` é a ponte que quase tudo importa. Antes de reescrever, enumere
    **todas** as formas que o caminho assume no repositório e ponha borda à
    direita do padrão. Depois varra o resultado por `..`, não por `require`.
24. **`ferramentas/` não é lixeira.** `classificacao.js` e `serie.js` se declaram
    no cabeçalho como bancadas fora do `run.js`, e a auditoria de órfãos de
    31/07/2026 registrou isso por escrito. Não estarem em `SUITE_GROUPS` não é
    esquecimento. Duas dependências cruzam pastas de propósito:
    `suites/dificuldade.js` → `ferramentas/campanha-major.js` e
    `ferramentas/r5-experiment.js` → `suites/auditoria.js`.

### O que ficou de fora, e por quê

Não é backlog esquecido; é escopo recusado com motivo:

- **mover o site para `web/`** — o workflow publica com `publish_dir: .` e faz
  `sed` de cache-busting; é migração de deploy, não faxina;
- **quebrar `sandbox.html`** — 4.206 linhas, com `<script>` inline de 3.465 e
  `<style>` de 702. É a maior dívida do repositório e merece ciclo com paridade
  provada;
- **unificar CJS → ESM** — `src/` é 48 `.mjs`; `bancada/` e `tools/` são 63
  `.js` CommonJS. São 63 arquivos de mudança lógica, que contaminariam qualquer
  commit de organização.

Observação lateral não tratada: `tools/` calcula a raiz do repositório 12 vezes,
com três nomes diferentes (`ROOT`, `RAIZ`, `root`) e dois métodos (`path.join` e
`path.resolve`), e mais 6 arquivos de `tools/` importam `ROOT` de
`bancada/lib/common.js`. Funciona, porque `tools/` não mudou de profundidade.

## Sessão de 04/08/2026 — documentação e a frente A da revisão

Ciclo sem tocar em dado, OVR, RNG, balanceamento ou geometria de carta. A
comparação visual fechou **21/21 idênticas** e a bancada foi de 25 para **26
suítes**.

**Documentação.** A raiz de `docs/` passou a ter exatamente um ponto de retomada,
que naquele dia era `docs/ciclos/retomada-2026-08-04.md`. O handoff de 31/07
virou evidência em `docs/ciclos/`. Aviso de "SUPERADO" dentro do arquivo não
resolvia nada — quem chega lê o ponteiro, não o aviso.

**Frente A da revisão do jogo.** Zero erro de console, zero exceção e zero
requisição falha nos três viewports. Quatro barreiras de acessibilidade achadas
e corrigidas, agora congeladas em `bancada/suites/e2e-acessibilidade.js` com doze
provas sintéticas.

### Três regras novas

25. **`aria-modal="true"` é uma PROMESSA de que o fundo está inerte, e quem a
    cumpre é `inert`.** Os cinco overlays declaravam a promessa e não a cumpriam:
    o foco ficava no fundo ao abrir, sete botões do `.wrap` seguiam alcançáveis
    por Tab e Escape não fechava nada. Prender foco com laço de JS é remendo;
    `inert` no `.wrap` faz o navegador tirar o fundo da ordem de foco. Ao abrir,
    foque o CONTÊINER, nunca o primeiro botão — em `finalOverlay` o primeiro
    botão é "Jogar novamente", e um Enter perdido reiniciaria a campanha. E
    Escape só pode fechar o que o mouse também fecha: ele clica o botão de fechar
    que já existe, por isso `finalOverlay`, que não tem um, fica de fora.
26. **Esconder o elemento focado joga o foco no `<body>`.** O diálogo troca de
    controle sob o pé do usuário — "Iniciar partida" some ao entrar no mapa,
    "Pular" vira "Continuar" ao terminar — e nas duas vezes o foco saía do modal
    para um fundo que está `inert`. A correção certa é guardar a **classe** do
    problema num `focusout` que devolve o foco ao diálogo, não remendar as duas
    trocas: a terceira troca chegaria sem guarda. Cuidado ao condicionar isso a
    `contains(activeElement)` — o blur de um elemento que virou `display:none`
    chega DEPOIS do seu código, então a checagem ainda enxerga o botão que vai
    sumir.
27. **Guarda que se defende do teste sintético parece guarda quebrada.** A prova
    de "foco fora do modal" falhou na primeira execução porque o `focusout` da
    regra 26 devolvia o foco antes de o auditor olhar — o produto desfazia o dano.
    Não relaxe a guarda para a prova passar: injete o defeito onde ela não
    alcança (ali, um `[role=dialog]` sintético, fora da lista que o listener
    vigia). A prova existe para testar o AUDITOR, não para vencer o produto.

### O que a frente A ensinou sobre as suítes existentes

`e2e-game-flow.js` coleta `pageerror` e console `error`, mas filtra
`Failed to load resource` e `net::` — então **404 real passava batido**, e
warnings nunca foram olhados. Filtro de ruído numa guarda é uma decisão que
envelhece: revise o que ele está escondendo antes de confiar no verde.

## Sessão de 05/08/2026 — a camada tática entrou em jogo

**`CFG_TATICA.ATIVA` está em 1.** `direcao` A|B virou **seis tipos de jogada** com
afinidade derivada dos atributos, e o canal que a leitura empurra deixou de ser
"acertar" e passou a ser **a qualidade da jogada que o adversário conseguiu
rodar**. Evidência, comparação pareada e as três hipóteses que a medição derrubou
estão em `docs/ciclos/tatica-tipo-de-jogada-2026-08-05.md`. **Leia antes de mexer
em qualquer constante da camada.**

`npm run validate` fechava 26/26 e 20/20 naquele dia; a contagem VIGENTE está na
tabela travada de `docs/retomada-2026-08-05.md`, porque este parágrafo já disse
"hoje são 21 checadores" depois de eles virarem 24 — número solto em prosa não
tem dono (regra 43). `dificuldade.js` fecha 4/4 em STRICT.
`Favorito gap 16+` 85,1 → 85,7 e `invicto` 4,2 → 4,5, os dois na direção
pré-declarada. `CT-round win%` não se moveu um décimo.

### Quatro regras novas, não negociáveis

28. **Parâmetro calibrado para um alfabeto de dois símbolos não transfere para
    seis.** Aconteceu duas vezes no mesmo dia: `nitidez` media contra o alfabeto
    OBSERVADO em vez do possível — com seis jogadas e três vistas, o uniforme
    virava 1/3 em vez de 1/6 e o CT ficava superconfiante em todo round inicial;
    e `MEIA_VIDA:4` dava **1,05 observação por jogada**, fazendo a confiança
    estacionar em 0,19 no round 3 e nunca subir. Ao ampliar um vocabulário,
    varra TODO parâmetro que conta ocorrência, não só a fórmula que você mexeu.
29. **Soma zero tem de valer na TAXA-BASE, não por evento.** Com dois rótulos o
    CT acertava metade e o ± se cancelava sozinho. Com seis jogadas ele erra
    cinco em cada seis, e premiar o T em todo erro com a magnitude do castigo lhe
    daria **+2/3 do canal** em vantagem sistemática — deslocamento de LADO
    disfarçado de leitura, contra o gate de `CT-round win%` em 47–54. Acertar
    custa (n−1) vezes o que errar alivia, e a guarda soma as n escolhas exigindo
    zero. Mudar o número de opções sem refazer essa conta desloca o jogo em
    silêncio.
30. **Empurrão simétrico num processo de PRIMEIRO SUCESSO não se cancela.**
    `1−∏(1−pᵢ)` é côncava, então ruído simétrico ABAIXA a média (Jensen).
    `ACERTO_PLANT` a .045 derrubava `Plant%` em 2,4 pontos sem que nada no
    parâmetro sugerisse viés. Todo empurrão por tique sobre plant, defuse ou
    contato tem essa propriedade — meça o agregado, nunca confie na simetria.
31. **Forma de atributo carrega força, e nenhuma codificação conserta isso.**
    Três encodings independentes deram `forma[rush] × força` de 0,779, 0,751 e
    0,782, porque forma determina distribuição de função e função já tem preço
    em `DUEL_CONVERSION` e `FRAG_ROLE`. Só grandezas **autocentradas dentro do
    próprio time** são neutras: `assinatura` (−0,118) e `vantagem` (−0,067).
    `forma` é diagnóstico e `check-tactics-layer.js` proíbe qualquer módulo da
    camada de lê-la. Premiar "rodar o próprio jogo" com afinidade absoluta seria
    pagar talento duas vezes.

### Duas lições de método, que valem fora da tática

- **Braço de controle é obrigatório quando o critério não é exógeno.** Com os
  três canais em ZERO, o contraste "acertou × errou" ainda dava −0,79 pp: o
  próprio `ctAcertou` correlaciona com o estado do round. Sem controle, seleção
  vira efeito.
- **Gate marginal reprovando pede AMOSTRA, não calibração.** Com `N=3000` o
  `Título` marcou 24,8% e cruzou o piso; com `N=12000` deu 26,5% contra 26,6% da
  baseline — efeito nenhum. Mexer numa constante ali teria calibrado contra
  ruído.

### O que NÃO refazer

Perseguir `leitura` até sair de nula na correlação parcial. O mecanismo **satura
perto de 3 pp** de diferenciação entre bom e mau leitor, mesmo dando ao melhor 18
rounds de scouting. O teto é estrutural, não de ajuste — e provavelmente está
certo assim: no CS real a leitura do IGL é efeito real e modesto.

## Sessão de 05/08/2026 — monograma da carta e Fase Suíça

Ciclo visual sem tocar em dado, OVR, RNG ou balanceamento. O monograma do campo
sem retrato tinha **três defeitos simultâneos** e **nenhuma guarda**; a Suíça
nunca enchia a tela. Relato e números em
`docs/ciclos/monograma-e-suica-2026-08-05.md`.

### Três regras novas

35. **`letter-spacing` sobra DEPOIS da última letra, e centrar caixa não é
    centrar tinta.** O flex centra a caixa de AVANÇO, que carrega esse espaço
    fantasma: com `-.05em` a tinta do monograma escorregava +2,83 px em média e
    até +5,25 px. Quando um elemento precisa parecer uniforme, **normalize a
    geometria em vez de centrar texto e torcer**: um `viewBox` que É a caixa que
    você quer centrada resolve os dois eixos sem métrica de fonte no layout e
    **sem constante de compensação** — que é o que a regra 21 já provou caro.
    `textLength`+`lengthAdjust="spacing"` iguala o avanço; `spacingAndGlyphs`
    não serve, porque troca inconsistência de tamanho por inconsistência de peso.
    Constante de forma sai da FONTE (`WM`, o par mais largo possível), nunca do
    dado — senão um time novo espreme o desenho em silêncio.
36. **`getBBox()` de `<text>` devolve a caixa EM no Chromium, não a tinta.**
    Altura fixa de 1,3em e topo em −41,49 para todo mundo. A primeira versão da
    guarda vertical media essa constante e reprovava sem defeito nenhum. Serve
    para largura, que é o que `textLength` governa; **não serve para altura**.
    É a quinta régua errada deste componente — §18 trocou `getBoundingClientRect`
    por `Range`, §21 trocou a caixa da fonte pelo glifo, §22 trocou a caixa da
    placa pela aresta, e agora a caixa da linha pela caixa-alta.
37. **Antes de consertar layout por gosto, calcule a FAIXA de conteúdo que ele
    pode receber.** A Suíça parecia vazia por acaso; a conta mostrou que num
    Suíço de 16 os grupos vivos de uma rodada têm sempre `vitórias+derrotas = R`,
    logo existem **no máximo 5 colunas** e 172 px fixos jamais enchem 1440. Não
    era caso de borda, era o estado permanente — e isso muda a correção de
    "ajustar espaçamento" para "trocar o modelo de layout".

**E a lição que atravessa as três:** `.c-mono` acumulou três defeitos ao mesmo
tempo porque **não tinha uma única prova**. Componente sem guarda não fica
parado; ele apodrece em silêncio, e captura bonita não denuncia desvio de 1 px,
margem assimétrica nem rolagem horizontal.

## Sessão de 06/08/2026 — bracket, comparador visual e o resíduo do gesto

Ciclo sem tocar em dado, OVR, RNG ou balanceamento. Relato em
`docs/ciclos/bracket-e-comparador-2026-08-06.md`.

### Três regras novas, não negociáveis

38. **Ferramenta que trava sem erro parece ferramenta lenta.**
    `tools/visual-regression.js` não completava o percurso desde `fccd2e1`:
    `capturar()` injetava `animation-play-state:paused` e **deixava o `<style>` na
    página**, e o `arrastarCarta()` seguinte esperava `getAnimations().finished`
    — que numa animação pausada **não resolve nunca**, sem teto de tempo. O
    ritual visual obrigatório deste arquivo estava inoperante e nada acusava,
    porque o commit que mexeu nele descrevia a mudança certa sem nunca ter rodado
    o comando de ponta a ponta. Estado global injetado numa página é do PERCURSO
    inteiro, não do passo que o injetou: se ele existe para a foto, some com ela.
    E toda espera que depende do relógio ou do compositor precisa poder desistir.
39. **Numa guarda responsiva, o meio é que reprova.** A correção do bracket
    passava nos dois extremos e falhava só no tablet: a 1440 px sobrava espaço,
    a 390 px a linha já tinha quebrado, e era a 760 px que a coluna do CAMPEÃO
    saía da janela. Guarda de duas larguras teria dado verde no defeito. Some-se
    isso à regra 20 — a guarda também precisa rodar em toda CATEGORIA, e
    `auditarSuica` só via a Suíça enquanto o quadro irmão apodrecia ao lado.
    E meça o que sai da JANELA, não o que sai da caixa: com `overflow:auto` o
    excedente continua no `scrollWidth`, então a caixa nunca denuncia o que o
    usuário só alcança arrastando a tela de lado.
40. **Um `MUDOU` na comparação visual não é prova de que VOCÊ mudou.** Quatro
    estados do tablet acusaram 4,4% a 22,5% de pixels alterados em telas que a
    fatia não tocava. Duas capturas do MESMO código deram 17/17 idênticas, e duas
    capturas do código ORIGINAL reproduziram **os mesmos quatro números exatos**:
    o ruído estava na primeira execução, não no trabalho. **Meça o piso de ruído
    antes de explicar um diff** — capturar duas vezes custa minutos, e sem isso o
    critério "estados fora do escopo devem permanecer pixel a pixel idênticos"
    faz você reescrever trabalho correto para perseguir variação da bancada.
    Cuidado também com o custo do TAMANHO do texto: a primeira redação do `#hint`
    era duas palavras mais longa, quebrou linha no tablet e, com captura
    `fullPage`, empurrou a página inteira.
41. **Laço de teste que conta QUADRO mede o relógio do teste, não a página.**
    `e2e-acessibilidade` falhava ~13% dos arrastos no celular, e a causa era uma
    corrida entre dois `requestAnimationFrame`: o do teste e o
    `pulsoAutoRolagem` do produto. Em fase, um quadro rende uma rolagem; fora de
    fase o avanço alterna `0, 7, 0, 7…` e o custo dobra — e a fase inicial muda a
    cada execução, o que faz o sintoma parecer aleatório. O teto de 240 iterações
    era insuficiente para o vão real: medido depois, o pico é **299**. Não suba o
    teto até passar; **troque a régua por PROGRESSO** — desista por N quadros
    consecutivos sem rolagem, que só ocorre se a página acabou ou o gesto morreu.
    E faça o laço **falhar alto**: o antigo saía em silêncio e soltava o ponteiro
    fora do alvo, o que virava um `waitForFunction` cego 30 s depois, longe da
    causa. Antes de suspeitar do gesto, meça a MARGEM de cada viewport — desktop
    e tablet usavam 2 e 9 dos 240, e só o celular vivia na borda.
42. **Vazio grande na tela costuma ser estrutura, não espaçamento.** A roleta
    ociosa mostrava 475 px de nada à esquerda — 40% da largura —, e a causa não
    era margem: `.track` tem `padding:0 calc(50% − var(--tw)/2)` porque o GIRO
    precisa dele para levar qualquer fita ao marcador, e em repouso, com
    transform zero, a fita 0 nasce no centro. Um estado que não usa a mecânica
    pode desligá-la — `.track.ocioso{padding:0}` — em vez de compensar com
    número. Vale também para a hierarquia: **área é o que o olho usa para ordenar
    importância**, e dois links de consulta com 74.340 px² contra 9.678 px² da
    ação central invertem a leitura por mais bonita que a página esteja. Meça
    área antes de discutir estilo.
    **E rótulo que repete o conteúdo do próprio bloco é altura desperdiçada**:
    "Hall da Fama" e "Base de elencos" diziam o que o link já dizia, e custavam
    44 px cada numa página que rolava vazia.

**Nota sobre o ritual visual nessas mudanças:** quando a fatia altera a ALTURA da
página, a comparação acusa 21 de 21 por **TAMANHO** e não diffa pixel nenhum —
`fullPage` desloca tudo, inclusive as capturas de overlay. Ali o ritual só fecha
por inspeção imagem a imagem; não confunda esse "21 de 21" com regressão.

## Sessão de 07/08/2026 — o número que a documentação declara sobre SI MESMA

43. **Todo número vigente precisa de dono, e o dono é a FONTE que o produz.**
    `check-doc-measurements.js` existia desde 31/07 justamente porque afirmação
    sobre o repositório envelhece sem ninguém reclamar — mas ele só media LINHA
    DE ARQUIVO. A outra classe de número, a contagem do próprio aparato de
    validação, seguia sem guarda: quando o `check-live-commentary` entrou no
    `npm run check`, "20/20 checadores" sobreviveu em **cinco lugares**
    (`CLAUDE.md`, o handoff, o relato do ciclo e duas vezes no
    `project-context.md`), junto com "25/25 suítes" quando já eram 26 e um
    `game.js` de 882 linhas que hoje tem 1.307. Hoje a marca
    `<!-- contagem-verificada -->` conta na fonte — `CHECADORES` de
    `tools/run-checks.js` e `SUITE_GROUPS` de `bancada/run.js` —, nunca num
    número guardado à parte, que envelheceria junto com a prosa. Grandeza
    desconhecida é ERRO e não linha ignorada, pela mesma razão que
    `run-checks.js` recusa descobrir checador por glob: nome digitado errado
    viraria cobertura ausente em silêncio.
    **Corolário sobre número histórico:** `game.js` caiu para 882 no piso do P5 e
    hoje tem 1.307 porque VOLTOU a crescer com funcionalidade — arrasto, elenco
    aleatório, narração. Um número que descreve um marco passado fica na prosa
    com a data; o que descreve hoje vai para a tabela. Não trave história e não
    deixe o presente sem prova.
44. **Casador escrito antes de olhar o literal erra na abertura, não na lógica.**
    A primeira versão de `blocoBalanceado` contava só `[` e `]` — e `SUITE_GROUPS`
    é um objeto, que abre com `{`. Ela nunca fechava a âncora e teria estourado no
    primeiro uso. É a regra 23 num eixo novo: antes de escrever o que LÊ outro
    artefato, abra o artefato e veja a forma **real** dos dois casos, não a do
    caso que você tinha na cabeça.

## Sessão de 07/08/2026 — clareza da tela do mapa

Relato em `docs/ciclos/clareza-da-tela-do-mapa-2026-08-07.md`.

45. **Quem MONTA a peça tem de ser quem a ATUALIZA.** O chip de lado nascia em
    `match-view`/`team-view` e era virado no round 13 por um
    `el.textContent="TR"` dentro do `game.js` — duas verdades sobre a mesma peça.
    Resultado: a estrutura interna do chip era apagada na virada, e o chip da
    TABELA, que só o módulo montava, **nunca virava**. A partir do round 13 a tela
    dava duas respostas para "que lado eu sou": topo `TR`, tabela `CT`. Hoje
    `aplicarLado` mora ao lado de `ladoChipHtml` e `definirLados` toca os quatro
    chips de uma vez. Corolário: **todo caminho alternativo precisa passar pela
    mesma função** — `pularMapa` reconstruía placar e strip e deixava os lados na
    primeira metade, e ninguém via porque o erro só aparece depois do round 13.
46. **Defeito que depende de dado SORTEADO não aparece numa amostra — varra o
    DOMÍNIO.** O monograma pinta a sigla sobre a cor do clube, e com tinta fixa
    dois dos 17 times ficavam abaixo de 4,5:1 (G2 4,01 e Astralis 4,16). A
    varredura de uma partida acusou no desktop e não acusou no tablet nem no
    celular — não porque o viewport mudasse nada, mas porque **o adversário era
    outro**. Ao medir qualquer coisa que dependa de dado sorteado, itere o
    catálogo inteiro em vez de confiar na tela que apareceu. E quando a correção
    for escolher entre opções, **prove que a escolha resolve TODOS os casos**:
    aqui, alternar entre as duas cores da paleta ainda deixava Astralis em 4,35:1,
    e só as pontas puras fecharam o piso.
47. **`waitForSelector` dá "visível" com `opacity:0`.** Ele olha caixa e
    `visibility`, não opacidade — e a antessala entra com transição de 300 ms.
    Medir ali devolve a tela inteira como invisível e parece defeito grave. É a
    régua errada outra vez, agora no eixo do TEMPO: espere o estado que você vai
    medir, não o estado que o framework chama de pronto.
48. **`min-width:0` num item de flex troca TRUNCAR por SUMIR.** Ao crescer o chip
    de lado e somar o selo `VOCÊ`, a identidade do time passou a pedir ~217 px num
    bloco de 154 px no celular; `.ls-team` tinha `min-width:0`, e o nome foi
    espremido a largura **zero** — nem reticências apareceram. Nenhuma prova
    funcional pegou, porque todas perguntavam *"o texto está lá?"* e a resposta é
    SIM: o nó existe, tem conteúdo e é `visible`. **Só a captura denuncia** — foi
    o ritual visual, imagem a imagem, que achou. Quando faltar largura e sobrar
    altura, EMPILHE em vez de encolher: cortar informação para caber é a última
    saída, não a primeira. E ao adicionar qualquer coisa a uma linha apertada,
    meça a soma das peças contra a caixa antes de confiar no verde.
49. **Texto livre do jogador que o motor compara vira risco de MOTOR, não de
    layout.** O nome do clube deixou de ser a constante `"SEU TIME"` e passou a
    ser digitado. Só que `game.js` conta a série com
    `jogo.vencedorNome===A.nome`: dois times homônimos no mesmo Major mandam o
    placar para o lado errado — e "NAVI" e "FURIA" são os primeiros nomes que
    qualquer jogador tenta. **Antes de abrir um campo de texto, procure onde
    aquele valor é COMPARADO**, não só onde é exibido. A correção coube no
    orçamento existente (17 elencos para 15 vagas, então dá para excluir dois
    homônimos) e não gastou uma chamada de RNG a mais, porque filtra a lista já
    embaralhada em vez de sortear de novo. `check-team-identity.js` trava a
    conta: hoje o máximo de repetições no catálogo é 2 e a folga é 2 — **está no
    limite**, e a guarda avisa antes de estourar.
    Corolário de persistência: **campo novo não entra no `valido()` do save.**
    Exigi-lo recusaria todo progresso gravado antes dele e apagaria títulos e
    recordes de quem já jogava.
50. **Caixa que se dimensiona pelo conteúdo mente sobre simetria.** Os dois cards
    da antessala mediam 196×189 e 219×213 — 23 px de diferença — e a causa não
    era espaçamento: o adversário tem campeonato e o time do jogador não tem
    nenhum, então o flex dava tamanhos diferentes a conteúdos naturalmente
    desiguais. Num confronto, isso faz a partida parecer desequilibrada antes de
    começar. `1fr auto 1fr` com `stretch` iguala os dois eixos sem reservar linha
    falsa nem inventar texto de preenchimento.
51. **Classe que sobra num contêiner vira moldura em volta dos filhos.**
    `#pmMapa` nasceu como a própria placa do mapa, com `class="pm-mapa"`. Quando
    virou LISTA de placas, a classe ficou onde estava e desenhou um retângulo em
    volta dos retângulos — o defeito que o responsável recusou em palavras
    (*"tem um bloco dentro do outro, tipo um retângulo dentro do outro"*). Eu
    tinha acabado de escrever "sem caixa dentro de caixa" no comentário do CSS e
    **recriei o defeito na mesma fatia**, porque reli a folha e não o HTML.
    Ao promover um elemento de peça a CONTÊINER, tire dele a classe da peça — e
    quando a tela mostrar uma moldura que o CSS não explica, meça o
    `getComputedStyle` do nó, em vez de reler o seletor.
52. **Elemento que perde o consumidor sai; não fica "por via das dúvidas".** A
    sigla de duas letras dos mapas entrou e saiu no mesmo dia. Mantê-la sem uso
    seria código morto com aparência de API — e este repositório já provou por
    mutação, em 02/08, que valor morto atravessa meses sem ninguém notar.
53. **Quando ÁREA pode carregar a informação, o rótulo é dívida.** A tela do mapa
    dizia o lado três vezes: chip no topo, chip na tabela e nada mais. De manhã a
    correção foi AUMENTAR os chips — de 8,32 px para 10,56 px —, e à tarde o
    responsável mostrou o caminho melhor: *"e se eles ficassem inteiramente nas
    cores de CT ou TR? […] quanto mais visual, design, e menos texto, melhor"*.
    O bloco do scoreboard tem centenas de vezes a área do chip e não precisa de
    palavra nenhuma; na virada, os dois trocam de cor ao mesmo tempo, no meio da
    tela. **A primeira pergunta diante de um rótulo pequeno não é "como aumento",
    é "que elemento já existe que poderia dizer isso por forma ou cor?"**
    O limite: não deixe a informação existir SÓ em cor. O chip do topo continua
    com nome por extenso e `aria-label`; o que saiu foi a repetição, não o canal
    textual. E o dono do time migrou de matiz para RELEVO — o ciano teria apagado
    justamente o lado que o bloco passou a mostrar.

## Sessão de 08/08/2026 — redesenho da antessala

Relato e medições em `docs/ciclos/antessala-redesenho-2026-08-08.md`.

57. **`var()` apontando para token REMOVIDO invalida a declaração inteira, e o
    defeito é invisível.** `.pm-forca-a` declarava `border-right:2px solid
    var(--bg)`; `--bg` saiu do `:root` em 01/08 na limpeza de tokens sem
    consumidor, e a partir dali a shorthand ficou inválida no tempo de valor
    computado — medido, ela computava `0px none`. O divisor que o comentário
    logo acima chamava de essencial não existia havia uma semana. Nenhuma guarda
    pega: `check-design-tokens` prova pares hex↔rgb e literais regredidos, não
    prova referência a token inexistente. **Ao remover um token, varra os
    consumidores por `var(--nome)` antes de apagar** — e prefira que o vão seja
    estrutura (um `gap` que mostra o fundo) a ser uma cor que pode ficar
    indefinida.
58. **Separação que depende de cor de DADO pode sumir por luminância, não só por
    matiz.** A barra de força separava os dois times pela cor de cada clube. O
    time do jogador é preto, que `--time-traco` clareia até cinza; um adversário
    claro ao lado disso vira uma linha contínua, e a barra perde exatamente a
    informação que existe para dar. O sulco de 2px não salva — dois cinzas
    continuam dois cinzas. **O canal seguro é ACESO × APAGADO**: quem está atrás
    recua em opacidade, o que independe de qualquer par do catálogo e ainda diz
    quem é favorito por forma, antes de a frase ser lida. É a mesma família da
    regra 46: quando o dado é sorteado, prove no domínio inteiro, não na tela que
    apareceu.
59. **Mexer no PISO de um `clamp()` é mexer no celular, e só a captura mostra.**
    A escala nova subiu os mínimos de `--fs-hero` e `--fs-titulo`; no desktop nada
    mudou, e em 390px os dois nomes de time passaram a se sobrepor. A
    sobreposição já existia antes — vinha publicada desde 07/08 — porque toda
    prova funcional pergunta *"o texto está lá?"* e a resposta é sim: o nó existe,
    tem conteúdo e é `visible`. Quando faltar largura e sobrar altura, a resposta
    é a da regra 48: **EMPILHE**, não encolha. Aqui a diagonal do palco girou 90°
    e as metades passaram a dividir o eixo vertical — o vocabulário sobrevive, só
    muda o eixo.

60. **Quando um material não aparece, o suspeito é a ORDEM DA PILHA, não o valor
    do filtro.** O `backdrop-filter` da antessala vivia em `.pm-palco`, e as duas
    `.pm-lado` pintavam o próprio gradiente por cima dele: o vidro estava embaixo
    de duas camadas de tinta, amostrando quase nada. Pior, o `clip-path` das
    metades — que existia só para desenhar a diagonal — cria contexto de
    empilhamento e PRENDIA o conteúdo abaixo do material, então nem subir o texto
    era possível. Quatro rodadas trocando cor não consertam uma ordem de camada.
    A pilha correta é a da Apple e tem três níveis: **campo de cor → lâmina →
    conteúdo**. Diagonal se faz com parada dura de gradiente, não com recorte,
    justamente porque recorte custa um contexto de empilhamento. E a aresta que o
    desfoque comer volta como linha no fundo do PRÓPRIO pseudo-elemento, que é
    pintado depois do filtro.
61. **Estrutura e movimento são a mesma decisão quando a revelação é material.**
    A lâmina entra cega e LIMPA, descobrindo os times por trás — e isso só existe
    porque o vidro está ENTRE o campo e o conteúdo. Com a pilha antiga, embaçar a
    lâmina não esconderia nada, porque não havia nada atrás dela. Antes de
    inventar uma animação, pergunte se a estrutura permite que ela signifique
    alguma coisa.
62. **Instrumentação decide o que você conserta.** Construí medição de área,
    tipografia e contraste, e os três melhoraram; materialidade não tinha número
    no ferramental, então virou argumento — e argumento é onde preservei o
    esqueleto existente por ele estar "aprovado". Confundir deferência ao
    histórico com disciplina é o modo silencioso de entregar refino quando foi
    pedida reconstrução. **Quando faltar régua para um eixo, construa a régua**:
    aqui foi fotografar a tela com e sem o filtro e contar o delta máximo de
    canal — 6/255 antes, 33/255 depois, mesmo custo de GPU.

**E a lição de método do ciclo:** as três correções que mudaram o plano não
vieram de ler código — vieram de RODAR. "Reduzir para duas superfícies de vidro"
teria deixado um nível do sistema órfão; a barra só se revelou ilegível na
primeira foto; e a escala só quebrou onde ninguém olha. Um plano de design é uma
hipótese, e a captura é o experimento.

## Sessão de 08/08/2026 (noite) — a antessala vira vidro, e o que isso ensinou

Relato e números na §1-septies de `docs/retomada-2026-08-05.md`. O fundo passou a
ser foto real do CS2 (`docs/map-art.md`), e nasceu `bancada/suites/e2e-antessala.js`.

63. **LIQUID GLASS NÃO É UM EFEITO QUE SE ADICIONA — É O QUE SOBRA QUANDO SE TIRA
    O RESTO.** Passei três rodadas SOMANDO camadas ao palco (lente de junção,
    anel de borda, véu por lado, bisel em tudo) e o material ficava pior a cada
    uma. O responsável apontou o `.np-card` da narração: *"é MINIMALISTA e
    realmente parece liquid glass"*. Ele é um retângulo, uma borda fina, uma
    sombra e conteúdo nítido. Cada camada nova rouba do material a chance de
    aparecer, porque o olho lê material por CONTRASTE com o que está em volta —
    e camada nenhuma é contraste, é competição. Quando um material não convencer,
    a primeira pergunta é o que REMOVER, não o que somar.
64. **NÍVEL DE VIDRO NÃO PODE SIGNIFICAR RAIO DE DESFOQUE.** O sistema tinha três
    níveis com três desfoques (12, 14 e 22px), quatro raios e três opacidades de
    borda — e o resultado foi descrito como *"todos os liquid glass parecem
    diferentes em cada bloco, cada barra, cada botão"*. Estava certo: três
    desfoques são três MATERIAIS. Hoje o desfoque e a borda são os mesmos na tela
    inteira — é isso que faz as peças lerem como recortes da mesma placa — e o
    que distingue os níveis é só a DENSIDADE do fundo.
    **Corolário:** densidade alta é TINTA, não vidro. O nível de apoio estava a
    58–70% de opacidade numa peça de uma linha de texto; a 22–34% a foto
    atravessa e a peça vira vidro. O que faz vidro parecer vidro é ver a cor de
    trás, desfocada e saturada, ATRAVÉS dele.
65. **VIDRO PRECISA DE CONTEÚDO ESTRUTURADO ATRÁS, e copiar valores não transporta
    isso.** O `.np-card` flutua sobre o SCOREBOARD, que continua nítido em volta
    dele; a lâmina da antessala cobria o card inteiro e desfocava o próprio campo
    de cor — uma camada chapada que só existia debaixo dela. Copiei os valores do
    `.np-card` (gradiente, ângulo animado, sombra) e não adiantou, porque o que
    faltava era a CONDIÇÃO, não o material. É o defeito de 6/255 da regra 60
    sobrevivendo numa forma nova, e a saída foi deixar a foto ATRAVESSAR o card.
66. **`background` em keyframe é shorthand e REESCREVE todas as camadas.** A linha
    de 2px da costura já tinha sido removida do `::after` e voltava pelo
    `pmRevela`, ainda no ângulo antigo, depois de a divisão já ter virado
    vertical. Ao remover uma camada de um elemento animado, varra os keyframes
    dele — eles carregam a declaração inteira, não o delta.
67. **Duas fórmulas que se cancelam num valor específico são assimetria com hora
    marcada.** Os paddings das metades eram `104% − corte` e `4% + corte`: iguais
    só quando o corte é exatamente 50%. Com o favorito em 58% um lado ganhava 8%
    a mais — e o defeito era invisível justamente no EMPATE, que é o caso em que
    se olha para conferir. Recuo simétrico sai do mesmo número, sempre.
68. **Camada chapada não separa cores; ela SOMA o mesmo em todo pixel.** O banho
    de cor por mapa governa duas grandezas em sentidos opostos — mais forte
    distingue os sete mapas e SUBSTITUI a foto; mais fraco mostra a foto e apaga
    a diferença. Medido: .50 dá 5 achados, .72 dá 15. Não existe valor que zere
    os dois, e perseguir o número é calibrar contra um conflito estrutural. A
    saída é multiplicar em vez de somar. **Antes de calibrar, verifique se as
    duas métricas que você quer satisfazer não são a mesma alavanca em sentidos
    opostos.**
69. **Cor que é FUNÇÃO de um fundo não viaja para outro fundo.** `--mapa-nome` é
    clareada para ser legível sobre o AMBIENTE do mapa; usei-a no chip, cujo
    fundo é vidro, e reprovou nos 21 casos (3,25–3,97:1). É a regra 46 numa forma
    nova: a função continua valendo, o argumento é que mudou.

**E a lição de método:** dos seis erros de CSS deste ciclo, cinco eram escrever
por intenção LOCAL num sistema que resolve por efeito GLOBAL — ordem de camada,
`filter` agindo no elemento inteiro, contexto shrink-to-fit do pai, cascata. O
pior não foi limitação: inventei um breakpoint de 560px e um ângulo de 195°
quando 640px e 172° estavam escritos no mesmo arquivo. **Antes de escrever
qualquer regra IRMÃ de uma existente — variante responsiva, estado, override —,
leia a original.** Isso teria evitado três dos seis.

## Sessão de 09/08/2026 — o gel de mapa, a faxina da antessala e a rede de movimento

Ciclo sem tocar em dado, OVR, RNG ou balanceamento. Três frentes pedidas na
mesma sessão: fechar o conflito banho × foto, revisar a antessala linha por
linha e caçar bugs de transição. `e2e-antessala` saiu de **5 achados para 0**
sem que um piso fosse tocado, e ganhou 2 provas sintéticas (8 no total).
`check-reduced-motion.js` entrou no `npm run check`, que foi de 27 para 28.

### Cinco regras novas, não negociáveis

70. **CAMADA CHAPADA GOVERNA DUAS GRANDEZAS EM SENTIDOS OPOSTOS; TROQUE A
    OPERAÇÃO, NÃO O NÚMERO.** O banho de cor do mapa somava o mesmo em todo
    pixel: mais forte separava os sete mapas e apagava a foto, mais fraco fazia
    o inverso. `mix-blend-mode:overlay` deixa de somar e passa a MODULAR — onde
    a foto é escura ele multiplica, onde é clara ele clareia —, e as duas
    medidas sobem JUNTAS: croma 5,2 → 13,4 e foto 24 → 79 no desktop. É também a
    leitura correta do pedido: *"cor específica pra cada mapa, como um filtro"* —
    filtro fotográfico é gel, e gel é multiplicativo.
    **Duas recusas medidas, não as repita.** `mix-blend-mode:color` parece a
    escolha óbvia (separa croma de luminância por definição) e PIORA o croma:
    5,1 no desktop, 2,8 no celular. A causa é que o banho antigo não só tingia,
    ele CLAREAVA, e croma em sRGB é limitado pela luminância — devolvendo a
    luminância à foto a tela cai de 36,7 para 23,2 e a cor não tem mais onde
    caber. `multiply` escurece demais e `color-burn` destrói a tela.
    **E saturação tem teto**: 1,7 dá croma 13,1 no celular; 2,2 derruba para 6,0,
    porque Anubis e Dust2 clipam no mesmo canal e voltam a colidir.
71. **TOKEN QUE SÓ EXISTE COMO FALLBACK DE `var()` NÃO É TOKEN, E TOKEN CITADO
    SÓ EM COMENTÁRIO É PIOR.** `--vidro-base` foi criado em 08/08 com racional
    escrito, e as duas únicas menções a ele na folha eram comentários AFIRMANDO
    que estava aplicado. Nenhuma regra o chamava. A proteção de contraste que a
    folha prometia não existia — e é por isso que `.pm-chip-r` vivia a 4,88:1
    contra um piso de 4,5, passando por 8 centésimos sem que nada explicasse a
    margem. É a regra 57 pelo avesso: lá um `var()` apontava para token removido
    e invalidava a declaração; aqui o token existe, a prosa o cita, e ninguém o
    consome. Outros três — `--pm-col`, `--pm-acao-w`, `--mapa-blur` — viviam como
    `var(--x, valor)`, com o número real no segundo argumento: parecem ponto de
    ajuste do sistema e não são, porque mudar exige achar cada consumidor.
    **Ao varrer custom properties, separe o fantasma legítimo** — `--mapa-*`,
    `--time-*`, `--pm-corte`, `--x0/--x1` são injetados por `game.js` em runtime
    — **do fantasma real, e tire os comentários antes de casar**: `--b1` aparece
    seis vezes na folha, todas em arqueologia, e um casador ingênuo manda a
    próxima sessão caçar um bug que não existe.
72. **PREFERÊNCIA DE ACESSIBILIDADE HONRADA PELA METADE PODE INVERTER DE SINAL.**
    `mostrarTela()` põe `.tela-in` nas duas telas do diálogo. Medido no
    navegador: com movimento normal a antessala tinha a classe e NÃO a animação
    — `animation` é shorthand e `.prematch{animation:luzPasseia}` tem a mesma
    especificidade vindo depois. Com `prefers-reduced-motion:reduce` aquela regra
    some, `.tela-in` deixa de ser atropelada, e a antessala vira a ÚNICA tela da
    aplicação com fade de entrada. **A preferência LIGAVA uma animação em vez de
    desligá-la.** Defeito que não aparece em captura nem em prova funcional —
    ele só existe para quem tem a preferência ligada, e ninguém do time tem.
    A varredura mostrou que era sistêmico: **30 declarações de `animation` fora
    de qualquer guarda**, quatro delas INFINITAS. A rede global no fim da folha
    resolve todas de uma vez, e ela usa duração desprezível — **nunca
    `animation:none`**, que descartaria o quadro final das animações com
    `fill-mode:both` e apagaria o pódio da tela final. `check-reduced-motion.js`
    trava a rede, as três propriedades, o alcance a pseudo-elementos e a posição
    dela como última palavra (ela ganha por ORDEM, não por especificidade).
73. **CLASSE DE ANIMAÇÃO POSTA NA MONTAGEM DISPARA EM MASSA NA REMONTAGEM.**
    `addCelula` carimbava `pop` em toda célula criada, e `pularMapa` recria a
    tira inteira: pular fazia ~24 células estourarem no mesmo quadro. O salto
    existe para quem NÃO quer esperar a animação round a round. O defeito estava
    só no CAMINHO — a tela final era a certa —, e por isso ninguém tinha olhado.
    Animação de entrada é da REPRODUÇÃO; montagem em lote passa `false`.
74. **MEDIR CUSTO DE COMPOSIÇÃO EM `headless` SEM GPU MEDE O APARELHO ERRADO.**
    O Playwright rasteriza por software (SwiftShader) por padrão, e nesse regime
    os DOIS braços caíram para ~24 fps — o material acusando 1,9 fps a menos que
    o controle, o que sugeriria um custo que não existe. Com GPU e vsync: **60,3
    contra 60,1**, diferença de 0,2. E sem vsync o número perde sentido no outro
    extremo (602 contra 368, com o material "mais rápido"). A pergunta certa é
    *"a tela sustenta a taxa do monitor?"*, e ela só se responde com GPU ligada e
    limite de quadro ATIVO.

### O que a faxina achou, e o que ela NÃO mexeu

Removidos por prova de ausência de consumidor: `#pmMapa` (duas regras de CSS
para um elemento que saiu do HTML em 08/08) e quatro blocos de prosa descrevendo
peças que já não existem; `--fs-nota`, `--mov-massa` e `--d-barra`. Uma varredura
dos 30 seletores da antessala contra HTML e JS achou exatamente um órfão.
**Ficaram** `--gold-glow`, `--line-base`, `--line-panel` e `--mine`, que parecem
órfãos e são as metades hex de pares que `check-design-tokens` exige; e
`--r-awper`/`--r-igl` e irmãos, consumidos por `sandbox.html` e `history-view`.

**Uma tentativa foi medida e revertida:** células de chip iguais (`flex:1 1 0`).
No celular, com 5 itens e piso de 88px, cabem 4 por linha — o quinto ficava
sozinho ocupando 356px, um chip quebrava em duas linhas e a faixa crescia de 91
para 101px. Célula igual só funciona quando o número de itens divide a largura,
e cinco não divide 358px.

### Nota sobre o ritual visual: o piso de ruído é INTERMITENTE

`antes-1 × antes-2` deu **21/21 idênticas**; `depois × depois-2`, com o mesmo
código, deu **6 de 21**, sendo quatro no tablet com 4,7% a 74,8% dos pixels. As
imagens são visualmente IGUAIS — mesmo elenco, mesma tipografia —, e o desvio
está espalhado pela área do gradiente do `body`, com ~7/255: é dithering de
gradiente do Chromium. A regra 40 continua valendo e ganha um corolário: **um
piso de ruído medido em ZERO não prova que a próxima execução também será zero.**
Quando um estado fora do escopo acusar diferença, recapture e veja se ela se
INVERTE — foi assim que o resíduo de `celular-07-mapa` (+1/255 em 0,3%) se
revelou ruído.

## A ANTESSALA É O PADRÃO DE DESIGN — decisão de 07/08/2026

O responsável elegeu a antessala da partida como referência de estilo para o jogo
inteiro: *"vou usar ela como um padrão de estilo, css, design e tudo mais pra todo
o jogo"*. As próximas telas herdam dela, uma por vez. Detalhe na §1-quinquies de
`docs/retomada-2026-08-05.md` e na §10 do relato do ciclo.

54. **Padrão que vive como número repetido não é padrão.** O vidro da antessala
    virou token em três níveis — `--vidro-alto/medio/raso-*` —, e a diferença
    entre eles é DISTÂNCIA DO OLHO: lâmina principal, peça sobre ela, apoio.
    `tools/check-glass-system.js` cobra que as superfícies de referência
    consumam os tokens; se uma voltar a declarar vidro na mão, o padrão já
    divergiu. **Quantas são NÃO se escreve aqui** — o número está na tabela
    travada de `docs/retomada-2026-08-05.md` §1, sob `superficies-de-vidro`, e
    sai da lista real do checador desde 09/08/2026. Esta linha dizia "seis"
    quando a guarda media cinco, foi "corrigida" para cinco quando ela media
    três, e só parou de envelhecer quando ganhou dono (regra 43). É a lição da
    tokenização de cor de 02–03/08 aplicada a superfície —
    documentação que promete cobertura que não existe é pior que
    nenhuma, porque a próxima sessão confia nela. A sexta superfície de vidro do
    jogo é `.np-card`, o palco da narração, e ela declara `blur(16px)
    saturate(1.3)` na mão. A guarda hoje trava esse número em 1: vidro novo na
    mão reprova, e migrar `.np-card` também reprova — porque baixar a dívida é
    mudança de PIXEL e tem de vir no commit que a explica, com fps medido.
55. **`backdrop-filter` custa, e o custo é por TELA, não por efeito.** Em 29/07
    ele derrubou a partida ao vivo para 31 fps e foi removido dos overlays; a
    antessala com vidro em tudo mede **61,2 fps contra 60,6 do controle**. A
    diferença não é o filtro — é a condição: superfície PEQUENA sobre fundo
    ESTÁTICO. Antes de levar o vidro a uma tela nova, meça o fps dela com um
    braço de controle sem filtro; sem o par, 60 fps não diz se está bom ou se a
    máquina não passa de 60.
    E **todo `backdrop-filter` precisa do par `-webkit-`**: sem ele o efeito
    simplesmente não existe no Safari, o aparelho cujo visual foi pedido como
    referência.
56. **Forma diferente para conteúdo do mesmo nível é o que faz uma faixa parecer
    bagunçada** — mesmo alinhada. O contexto da antessala tinha uma pílula com
    título, selo e subtítulo dentro, ao lado de outra com rótulo e número: dois
    objetos distintos para informações equivalentes. Padronizar não é igualar
    tudo; é usar o MESMO objeto e deixar a diferença ser só ênfase.

## Decisão de produto fechada em 04/08/2026 — raso na mão, profundo por baixo

**Veto de mapa não existe e não vai existir**, nem como tela jogável nem como
fase automática de ban/pick. E, mais amplo que isso: **toda complexidade nova
vive DENTRO da simulação** — nenhuma pode cobrar um clique, uma tela ou uma
decisão a mais do jogador. O laço é sortear → escolher carta → jogar, e ele não
cresce.

A afinidade de mapa que já existe (`MAP_PROFILES`, `MAPA_LADO`) continua valendo
dentro do motor por `mapMultiplier`: o que está proibido é a **fase de escolha**,
não o efeito do mapa.

**Emenda de 05/08/2026: exibição passiva TAMBÉM está fora.** Este parágrafo dizia
que mostrar o que o motor decidiu era "permitido e desejável, porque informa sem
cobrar". O responsável revisou diante de uma implementação pronta e verde — a
antessala descrevendo os dois elencos pela camada tática — e recusou: *"prefiro
que fique só dentro da IA do jogo mesmo"*. Foi desfeita sem publicar.

O critério, então, **não é o custo de clique**. Uma tela que não cobra nada
continua fora se o que ela faz é explicar o motor. Estão proibidos dossiê de
adversário, placar ao vivo narrando a decisão do round, manchete falando de
tática e fechamento de mapa explicando o mapa. Continuam valendo placar, rating,
stats e a manchete atual: a fronteira é entre **resultado** e **mecanismo**.
Detalhe na §11-bis de `docs/project-context.md`.

**Emenda de 06/08/2026 — a narração OPCIONAL entra.** O responsável pediu uma
antessala para escolher com ou sem narração, com dupla de narradores comentando
3 a 5 rounds sorteados por mapa, ligada a jogadores, táticas e clutchs. Isso
revoga em parte o parágrafo acima, que proibia nominalmente "placar ao vivo
narrando a decisão do round". A revogação tem **três condições cumulativas**, e
fora delas o veto continua de pé:

1. **opt-in explícito** do jogador naquela partida;
2. **modo limpo equivalente**, sem perda de jogo — e ele é o padrão de
   referência, não o degradado. No modo limpo até a manchete pós-mapa sai;
3. **motor intocado**: nem uma chamada de RNG a mais, nem um resultado
   diferente. A narração LÊ `registro`; nunca escreve nele.

O que foi recusado em 05/08 era um briefing obrigatório ANTES da partida, para
todo mundo. Isto é entretenimento que o jogador pede, durante o jogo, sobre o que
já aconteceu. `registro.tatica` deixa de ser "sem consumidor de propósito", mas o
consumidor é opcional por contrato — e a guarda cobra isso.
