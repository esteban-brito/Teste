# ADR 0002: separar dados crus de valores derivados

- Status: aceito
- Data: 2026-07-19
- Aceito em: 2026-07-20

## Contexto

Jogadores e times estão no mesmo arquivo das fórmulas que calculam role,
playstyle, OVR, química e força. A página de elencos mantém outra representação
gerada.

## Decisão

Manter em `src/data` somente entradas factuais que não são calculadas pelos
motores:

- jogador: `id` quando necessário para desambiguar, nome, país, atributos
  `fp/en/tr/op/cl/sn/ut`, rating de referência, colocação e intenção de IGL;
- elenco: identidade visual, campeonato/colocação, IDs dos cinco jogadores e
  identidade/país do treinador;
- mapas e demais metadados estáticos quando forem extraídos em etapa própria.

Role, role secundário, playstyle, subarquétipo, OVR do jogador, característica
e OVR do card do treinador, química e força são derivados pela API do domínio.
O nome e o país do treinador são dados crus; seus efeitos esportivos não são.

O contrato legado de identidade `id || nome` deve ser preservado durante a
extração. Novas entradas e dados persistidos precisam de ID explícito. Um
eventual backfill dos IDs implícitos será uma migração de schema separada, não
parte da movimentação inicial.

## Estratégia de migração

1. Copiar os registros para módulos ES com exports nomeados, sem renomear,
   reordenar, normalizar ou alterar valores.
2. Comparar registros completos, IDs resolvidos e ordem contra `game.js` por um
   teste de paridade determinístico. Enquanto essa prova existir e o consumidor
   não tiver migrado, `game.js` continua sendo a fonte de verdade executável.
3. Migrar um consumidor por mudança. Somente depois de jogo, sandbox, bancada,
   worker e gerador usarem a API pública, remover a cópia legada.

A duplicação transitória é permitida apenas enquanto estiver protegida por
paridade e identificada como etapa de migração. Não manter duas fontes editáveis
em paralelo. Artefatos gerados devem ser verificáveis e não editados à mão.

## Consequências

- Inclusão de times fica validável sem navegar pelo motor.
- IDs passam a ser contratos persistentes.
- O gerador de elencos precisa consumir a mesma API pública.
- A primeira extração aumenta temporariamente a duplicação, mas não muda o
  carregamento estático nem o comportamento do produto.
- Alterações de conteúdo ou balanceamento permanecem proibidas nos commits de
  movimentação e troca de consumidor.
