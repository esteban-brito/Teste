# ADR 0005: projeção legada de dados durante a migração

- Status: aceito
- Data: 2026-07-20

## Contexto

`src/data` já contém módulos ES paritários para jogadores, elencos e países,
mas o jogo, o sandbox e parte da bancada ainda executam os literais incorporados
em `game.js`. Remover esses blocos agora exigiria mudar a inicialização clássica,
o loader do sandbox e consumidores sensíveis numa única etapa.

O gerador `tools/add-team.js` atualmente escreve somente em `game.js`. Depois da
extração, uma nova adição feita assim deixa os módulos divergentes. Regerar todos
os registros por serialização também produziria um diff amplo e descartaria
comentários de curadoria que ainda não possuem representação estruturada.

## Decisão

Durante P1, novas adições entram por `tools/add-team.js`. O comando produz uma
única representação dos cinco jogadores e do elenco e projeta essas mesmas
linhas em:

- `src/data/players.mjs`;
- `src/data/teams.mjs`;
- os blocos legados correspondentes de `game.js`.

O comando reutiliza as âncoras que já existiam no gerador legado; elas continuam
sendo um contrato de edição, nunca um loader em runtime. Não criar novo parsing
de `<script>`, `new Function` ou avaliação de módulo para realizar a projeção.

Todos os conteúdos são calculados antes da primeira escrita. O comando mantém os
originais em memória e restaura fontes e artefato gerado se uma escrita ou
validação posterior falhar. `--dry-run` não escreve arquivo algum.

Após a projeção, são obrigatórios:

1. sintaxe de `game.js`;
2. paridade integral de jogadores, elencos e países;
3. regeneração de `elencos.html` pelo gerador existente;
4. lint de dados e cobertura dos 85+ IDs.

Esta decisão cobre somente adições realizadas pelo comando. Alterar manualmente
registros existentes em duas representações continua proibido. Até existir um
gerador completo que preserve a proveniência estruturada, mudanças desse tipo
precisam de trabalho próprio e comparação integral explícita.

Quando jogo, sandbox, worker, bancada e gerador consumirem módulos públicos, os
blocos incorporados serão removidos e esta projeção deixa de existir.

## Consequências

- novas adições não quebram silenciosamente a paridade de `src/data`;
- os registros e comentários atuais não sofrem reserialização em massa;
- três fontes físicas coexistem temporariamente, mas uma única operação produz
  cada adição;
- uma falha de validação não deve deixar fontes ou `elencos.html` parcialmente
  atualizados;
- o jogo estático continua sem build obrigatório durante P1.
