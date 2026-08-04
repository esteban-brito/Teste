# CLAUDE.md

Este é o ponto de entrada automático para o Claude neste repositório. Ele não
substitui as fontes de verdade: serve para impedir que uma nova sessão repita bugs
já entendidos ou declare o trabalho pronto sem prova suficiente.

## Antes de qualquer alteração

1. Leia `AGENTS.md` inteiro. Suas regras de branch, autonomia, separação entre
   refatoração e balanceamento e validação são obrigatórias e têm precedência.
2. Leia `docs/retomada-2026-08-04.md`, o handoff geral; depois leia
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
  as próximas grandes etapas migraram para `docs/retomada-2026-08-04.md`.

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

**Documentação.** A raiz de `docs/` passou a ter exatamente um ponto de retomada:
`docs/retomada-2026-08-04.md`. O handoff de 31/07 virou evidência em
`docs/ciclos/`. Aviso de "SUPERADO" dentro do arquivo não resolvia nada — quem
chega lê o ponteiro, não o aviso.

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
