# CLAUDE.md

Este é o ponto de entrada automático para o Claude neste repositório. Ele não
substitui as fontes de verdade: serve para impedir que uma nova sessão repita bugs
já entendidos ou declare o trabalho pronto sem prova suficiente.

## Antes de qualquer alteração

1. Leia `AGENTS.md` inteiro. Suas regras de branch, autonomia, separação entre
   refatoração e balanceamento e validação são obrigatórias e têm precedência.
2. Leia `docs/retomada-2026-07-31.md`, o handoff geral mais recente; depois leia
   `docs/project-context.md` e `docs/next-steps.md`.
3. Antes de tocar aplicação, estado ou UI, leia
   `docs/p5-aplicacao-ui-2026-07-29.md`.
4. Antes de tocar cartas, leia `docs/retomada-2026-07-31.md`, a seção 14 de
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
- `bancada/e2e-cartas.js`: prova geométrica e interativa no Chromium.

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

## Ritual para qualquer mudança visual de carta

```text
npm run visual:capturar -- visual-antes
# faça a mudança primeiro no laboratório/artefatos reais
node bancada/e2e-cartas.js
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
- a retomada completa e as próximas grandes etapas estão em
  `docs/retomada-2026-07-31.md`.
