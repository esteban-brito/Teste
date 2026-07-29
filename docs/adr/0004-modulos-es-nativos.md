# ADR 0004: módulos ES nativos como destino

- Status: aceito
- Data: 2026-07-19
- Aceito em: 2026-07-20

> Progresso em 2026-07-28: jogo, sandbox, worker e bancada já consomem módulos
> públicos; o marcador e o loader de `game.js` foram removidos. O loader interno
> do calibrador sobre o script inline de `sandbox.html` permanece como dívida.

## Contexto

O navegador usa scripts clássicos; Node recorta e avalia fonte; o worker busca
texto de HTML e JavaScript. Isso cria contratos invisíveis.

## Decisão

Adotar módulos ES nativos com exports nomeados e uma API pública por contexto,
sem exigir framework ou bundler. Browser, Node e worker devem importar o mesmo
código executável.

A migração começa com arquivos `.mjs` para não alterar globalmente a semântica
CommonJS das ferramentas e da bancada. Não adicionar `"type": "module"` ao
`package.json` durante essa transição. Cada consumidor muda separadamente e
mantém um adapter legado enquanto ainda houver dependência de script clássico.

O entrypoint do jogo continua clássico até que handlers, inicialização, sandbox
e worker tenham contratos explícitos. Mudar `index.html` para `type="module"`,
remover blocos de `game.js` ou alterar ordem de carregamento são etapas próprias,
com E2E e paridade de seed; não são consequência automática deste ADR.

Não introduzir novo parsing de `<script>`, `new Function` ou marcador textual
como mecanismo de módulos. Loaders legados existentes são removidos um a um,
somente depois que o consumidor usa imports reais.

## Consequências

- `new Function`, regex de `<script>` e marcador de UI deixam de ser loaders.
- A migração deve ser incremental e coberta por testes de paridade.
- GitHub Pages continua adequado para servir a aplicação.
- CommonJS e ES Modules coexistem temporariamente em fronteiras explícitas;
  ferramentas CommonJS podem usar `import()` para consumir `.mjs`.
- O repositório não passa a depender de build para executar o jogo estático.
