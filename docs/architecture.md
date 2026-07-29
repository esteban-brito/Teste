# Arquitetura

## Estado atual

O draft9-0 é uma aplicação estática, sem backend e sem dependências de runtime.
`index.html` carrega `style.css` e `game.js`. O arquivo `game.js` contém duas
regiões separadas pelo marcador `// === UI START ===`:

1. motores, dados e simulação;
2. estado, renderização, eventos e fluxo do jogo.

O sandbox carrega o texto de `game.js` e avalia a primeira região. O worker e a
bancada Node repetem esse mecanismo. Portanto, o marcador funciona hoje como
uma API implícita e frágil.

O IFCS é infraestrutura de validação offline, não parte do runtime. O scorer e o
contrato de corpus são módulos Node puros em `bancada/`; o extrator Python/Awpy
transforma demos reais em artefatos auditáveis fora do navegador. Nenhuma dessas
ferramentas pode ser importada por `game.js` ou virar uma segunda implementação
das regras do domínio.

A estatística descritiva de amostras vive em
`src/domain/statistics/sample-summary.mjs`. O módulo não conhece DOM, sandbox ou
auditoria: recebe arrays explícitos e fornece média, quantis, dispersão e IC95%.
O sandbox carrega essa API por módulo ES e a auditoria profunda a importa no
caminho Node, evitando duas fórmulas para o mesmo conceito.

As primeiras fronteiras puras da simulação vivem em `src/domain/simulation/`:
`combat-profile.mjs` descreve a leitura corrente de função e multiplicadores;
`exposure-profile.mjs` calcula pesos relativos de contato por função efetiva,
atributos, lado e fase; `preservation-value.mjs` calcula o valor abstrato usado
na decisão coletiva de save; `trade-context.mjs` expõe prontidão coletiva e
possibilidade de troca da vítima; `assist-context.mjs` expõe a utilidade
disponível para assistência; `fallen-angels.mjs` decompõe o rating em
parcelas somáveis; `player-form.mjs` descreve a forma individual e de campanha;
`team-form.mjs` aplica à força efetiva a oscilação uniforme controlada pela
química; `duel-weights.mjs` separa vitória do duelo de volume de frag;
`team-preparation.mjs` monta os vetores de combate, afinidades de mapa e de lado
com caches e gerador explícitos;
`round-combat.mjs` resolve contatos, objetivo, save, clutch, assistências e KAST
por dependências explícitas; `simulation-telemetry.mjs` observa esses eventos sem
consumir RNG;
`economy.mjs` preserva decisão coletiva, loadout individual, carrego e drop de
arma; e `map-simulation.mjs` orquestra troca de lados, OT, economia, combate,
telemetria e placar de cada round por dependências explícitas;
`series-simulation.mjs` fecha séries sem repetir mapas. Enquanto
o entrypoint clássico não migrar para módulos,
`game.js` mantém adapters legados protegidos por paridade exata. Essas fronteiras
não autorizam balanceamento implícito.

`random-source.mjs` encapsula o Mulberry32 em instâncias independentes, preservando
as sequências uniforme e gaussiana bit a bit. A composição pública de simulação
deve possuir uma instância por sessão e passá-la explicitamente aos motores.

A primeira composição pública vive em `src/public/evaluation-api.mjs`. Ela monta
`POOL` e `TEAMS` a partir dos dados crus e dos módulos PRISMA, ZÊNITE e SINAPSE,
preserva a referência compartilhada dos jogadores distribuídos e oferece uma
visão única das configurações calibráveis. Os três consumidores Node de avaliação
(`tools/verify-report.js`, harness de workers e loader do calibrador) já usam essa
API sem recortar `game.js`. O sandbox e o bootstrap do worker real permanecem na
fronteira legada da Fase 6; `bancada/motor.js` permanece como adapter das suítes
clássicas até a composição pública de simulação estar completa.

## Pipeline do domínio

```text
ATRIBUTOS + TIMES_DEF
        |
        v
PRISMA: afinidade -> role primário/secundário -> papel de combate do IGL
        |
        v
ZÊNITE: playstyle + OVR
        |
        v
POOL / TEAMS avaliados
        |
        v
SINAPSE: composição + playstyles + treinador -> química e força
        |
        v
MARÉ: forma de jogador e campanha
        |
        v
PÓLVORA + COFRE: combate, objetivos e economia
        |
        v
FALLEnANGELs: rating contextual pós-partida
```

O calibrador observa esse pipeline, cria snapshots, mede margens e procura
alterações de configuração que satisfaçam intenções com o menor dano colateral.

## Fronteiras desejadas

- **Dados:** valores crus e definições de times. Não conhece DOM nem regras de
  renderização.
- **Domínio:** avaliação, química, simulação, torneio e calibração. Funções puras
  sempre que possível.
- **Aplicação:** coordena draft, lineup, partidas e sessões de calibração.
- **Interface:** transforma estado em DOM e converte eventos em comandos.
- **Infraestrutura:** workers, servidor de desenvolvimento, geração de artefatos
  e deploy.

O mapa final de diretórios e a ordem de migração estão no plano de
profissionalização aprovado. Cada extração deve manter uma camada de
compatibilidade até a suíte confirmar paridade.

## Dependências permitidas

```text
apps/ui ----------> application ----------> domain
   |                      |                    ^
   |                      v                    |
   +--------------> infrastructure            data

tests podem importar qualquer API pública, mas não devem recortar fonte.

extrator offline -> corpus derivado -> scorer IFCS
```

- `domain` não importa `ui`, `application` ou `infrastructure`.
- `data` contém valores; validação de schema pode depender de contratos, não de
  UI.
- workers chamam a mesma API pública usada pelo processo principal.
- renderizadores recebem view models prontos e não recalculam regras de negócio.
- jogo e UI não importam Awpy, demos, corpus privado ou scorer IFCS.
- scorer IFCS consome contratos e artefatos explícitos; não lê DOM nem estado global.

## Estado atual do jogo

- `S`: draft, cartas escolhidas, treinador e interação da roleta.
- `TG`: campeonato, suíça, playoffs e resultados.
- `Audio`: contexto Web Audio e preferências de som.

Esses objetos são globais ao script e mutados por controllers e renderizadores.
O destino é um store pequeno, sem framework, com estados de draft e torneio
separados e efeitos explícitos para DOM, timers e áudio.

## Dados e identidade

`ATRIBUTOS` possui um ID explícito quando o mesmo nick aparece em outra era.
Caso contrário, `nome` é o ID. `POOL` indexa pelo ID cru. Os cards visuais têm
IDs sequenciais (`p0`, `p1`...), adequados ao DOM, mas não à persistência ou a
snapshots. Testes e artefatos persistentes devem usar o ID cru.

## Pontos de atenção

1. Uma chamada adicional ao RNG muda toda a simulação subsequente.
2. Ordem de inserção de objetos influencia desempates em classificação.
3. Arredondamentos de OVR, química e força fazem parte do comportamento.
4. `distribuirRoles` aplica contexto de time e muta avaliações dos jogadores.
5. O calibrador diferencia mudança material de deterioração de margem interna.
6. `elencos.html` contém dados gerados e pode divergir da fonte.

## Próxima evolução do laboratório

O plano aprovado está em `docs/next-steps.md`. A auditoria individual R1 e a
apresentação de variância R2 estão concluídas sem tocar no motor. R3 começou com
uma MD3 isolada, orquestrada pelo sandbox sobre os mesmos motores de mapa.

Essas duas leituras não devem virar motores paralelos:

- **expectativa:** agrega muitos mapas para medir convergência;
- **campanha:** coordena uma sequência competitiva curta usando os mesmos motores.

O contrato inicial da campanha deriva três mapas únicos da seed, alterna a
orientação dos times, mantém uma força de forma por série e encerra no segundo
mapa vencido. `bancada/campaign-golden.json` protege a orquestração observável;
o golden completo do simulador continua protegendo os mapas internamente.

Busca, filtros, comparação e exportação pertencem à interface/aplicação.
Percentis e intervalos são calculados pelo módulo estatístico puro a partir das
amostras preservadas pela aplicação. Uma futura extração precisa preservar IDs,
agenda, lados, seeds e resultados aprovados antes de remover os loaders legados.
