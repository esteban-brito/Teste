# CLAUDE.md

Este é o ponto de entrada automático para o Claude neste repositório. Ele não
substitui as fontes de verdade: serve para impedir que uma nova sessão repita bugs
já entendidos ou declare o trabalho pronto sem prova suficiente.

## Antes de qualquer alteração

1. Leia `AGENTS.md` inteiro. Suas regras de branch, autonomia, separação entre
   refatoração e balanceamento e validação são obrigatórias e têm precedência.
2. Leia `docs/project-context.md` e `docs/next-steps.md`.
3. Antes de tocar aplicação, estado ou UI, leia
   `docs/p5-aplicacao-ui-2026-07-29.md`.
4. Antes de tocar cartas, leia a seção 11 de
   `docs/cartas-design-2026-07-28.md` e `docs/testing.md`.
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

## Checkpoint comprovado de 30/07/2026

- `5ae9531`: densidade compacta corrigida, faces acessíveis, hover touch seguro e
  laboratório ampliado;
- `24f1aca`: flutuação de CI por porta insegura eliminada;
- laboratório: 145 renderizações/casos, oito larguras, estado atual e proposta;
- comparação visual: 21 capturas; apenas seis estados compactos de celular/tablet
  mudaram, e as outras 15 permaneceram idênticas;
- validação local: 25/25 suítes verdes;
- CI e deploy: workflow `30523360771` verde;
- nenhuma alteração em dados, OVR, raridade, snapshot, golden, RNG ou
  balanceamento.

Se o repositório tiver avançado, trate este checkpoint como histórico e confirme o
estado real. As guardas executáveis e os documentos especializados continuam sendo
a fonte de verdade.
