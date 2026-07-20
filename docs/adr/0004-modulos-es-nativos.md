# ADR 0004: módulos ES nativos como destino

- Status: proposto
- Data: 2026-07-19

## Contexto

O navegador usa scripts clássicos; Node recorta e avalia fonte; o worker busca
texto de HTML e JavaScript. Isso cria contratos invisíveis.

## Decisão proposta

Adotar módulos ES nativos com exports nomeados e uma API pública por contexto,
sem exigir framework ou bundler. Browser, Node e worker devem importar o mesmo
código executável.

## Consequências

- `new Function`, regex de `<script>` e marcador de UI deixam de ser loaders.
- A migração deve ser incremental e coberta por testes de paridade.
- GitHub Pages continua adequado para servir a aplicação.

