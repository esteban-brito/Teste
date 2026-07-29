# AGENTS.md

Este arquivo orienta pessoas e agentes de IA que trabalham neste repositório.
Comece por `docs/project-context.md`, que registra o ponto de retomada, roadmap
de profissionalização e a visão do modo Carreira de Jogador. Leia também
`docs/next-steps.md`, que registra a sequência aprovada para fidelidade individual,
laboratório e balanceamento. Leia ainda `docs/architecture.md`, `docs/testing.md`
e `docs/glossary.md` antes de alterar os motores.

## Escopo, autonomia e branch

- A branch de trabalho é `sandbox-test`.
- O responsável concede autorização persistente para trabalhar com autonomia na
  profissionalização do repositório nessa branch. Depois de ler o contexto e
  confirmar o estado real, escolha e execute a próxima fatia segura sem pedir
  permissão a cada arquivo ou etapa.
- Essa autonomia inclui investigar todo o repositório; criar, editar, mover,
  renomear e remover código, testes, documentação e pastas versionadas; executar
  ferramentas; criar commits coerentes; e fazer push de checkpoints verdes para
  `origin/sandbox-test`.
- O push para `sandbox-test` e o deploy automático de Pages disparado por ele
  estão autorizados quando as validações pertinentes estiverem verdes. Não é
  necessário renovar essa autorização em cada sessão.
- Limpeza é trabalho autorizado: remova legado, duplicações e arquivos órfãos
  quando busca de consumidores, histórico e testes demonstrarem que são
  dispensáveis. Prefira uma remoção rastreável em commit próprio e não preserve
  dívida morta apenas por cautela abstrata.
- Não interrompa uma sequência segura apenas para perguntar se pode continuar.
  Pare quando houver uma decisão de produto genuinamente aberta, conflito com
  mudanças do usuário, credencial/custo externo não autorizado ou falha que não
  possa ser explicada e corrigida dentro do escopo.
- `main` permanece intocável durante a profissionalização. Merge em `main`,
  troca/criação/remoção de branch, force-push, reescrita de histórico publicado
  e release manual exigem pedido explícito do responsável.
- Preserve mudanças preexistentes do usuário, inclua nos commits somente o
  trabalho pertinente e confirme `git status` antes e depois do trabalho.

## Regra mais importante

Não misture refatoração estrutural com mudança de balanceamento.

Uma refatoração deve preservar:

- todos os valores de `CFG_*`, receitas, pesos, thresholds e tabelas;
- ordem das operações, clamps e arredondamentos;
- quantidade e ordem das chamadas ao RNG;
- dados de jogadores, times e treinadores;
- classificações de role, role secundário, playstyle e OVR;
- química, força efetiva, rating e regras do torneio.

Mudanças deliberadas nesses itens exigem trabalho e commit separados, descritos
como balanceamento e acompanhados de comparação estatística.

## Antes de concluir que um dado não existe

**Leia `src/data/catalog.mjs`.** Ele lista todo dado do projeto: qual campo existe, em que
arquivo, sob que chave e cobrindo quantos dos 85 jogadores. `tools/check-data-catalog.js` prova
cada alegação e reprova a suíte quando o catálogo envelhece, então ele não mente.

Isso existe por causa de um erro real (28/07/2026): um agente afirmou três vezes que dados
existentes não existiam — `time`, `campeonato+ano` e `país completo` — porque procurou **num
arquivo** o que era pergunta sobre **o projeto**, chutou o nome do campo (`campeonato`, quando é
`camp`) e tratou "não achei" como "não existe". À época, os três estavam em
`TIMES_DEF` e `PAISES_MAP`; hoje os países vivem nas tabelas de chave declarada
`PAIS_JOGADOR` e `PAIS_TREINADOR`.

Regra: `grep` num arquivo não responde "isto existe no projeto?". O catálogo responde. Se o
catálogo não menciona o dado, aí sim ele não existe.

## Fontes de verdade atuais

- `docs/p5-aplicacao-ui-2026-07-29.md`: **ponto de retomada operacional do P5** —
  commits publicados, arquitetura atual, validações, contratos exatos de `S`,
  `TG`, `MP` e `MATCH`, trabalho adiado e próxima fatia segura. **Leia antes de
  alterar aplicação, estado ou UI do jogo.**
- `docs/p2-modularizacao-2026-07-28.md`: **relatório final do ciclo P2** (modularização
  por paridade) — o que saiu, os contratos descobertos, o mecanismo de prova de
  consumo de RNG e as armadilhas. **Leia antes de alterar os módulos extraídos.**
- `src/data/catalog.mjs`: **índice de todo dado do projeto** — fonte, chave, cobertura e a
  fronteira cru × derivado do ADR 0002. Comece por aqui ao procurar um dado.
- `docs/project-context.md`, seção **2-bis**: estado do ciclo de fidelidade da
  simulação (26-27/07/2026) — contratos novos, pendências abertas com causa medida
  e armadilhas. **Leia antes de tocar no simulador.**
- `src/public/evaluation-api.mjs`: composição pública de dados, avaliação e química.
- `src/public/simulation-api.mjs`: composição pública de RNG, simulação e narrativa.
- `src/application/audio.mjs`: efeito Web Audio isolado; não conhece estado esportivo.
- `src/infrastructure/persistence/progress-store.mjs`: progresso versionado,
  localStorage e backup JSON; falhas de storage não interrompem o jogo.
- `src/ui/game/*.mjs`: HTML puro de cartas, química, times, torneio, partida,
  campanha final e Hall; escaping compartilhado em `src/ui/shared/html.mjs`.
- `game.js`: aplicação, estado e interface; não contém motores ou dados crus.
- `bancada/motor.js`: ponte CommonJS fina para a mesma API pública.
- `sandbox.html`: interface e algoritmo do calibrador.
- `bancada/roster-snapshot.json`: classificação aprovada de cada ID de jogador.
- `bancada/fidelity-score.js`: matemática e agregação do IFCS.
- `bancada/fidelity-corpus.js`: schema, proveniência, auditoria e travas do corpus IFCS.
- `docs/fidelity-target.json`: população e época congeladas para a primeira medição.
- `docs/realism-methodology.md` e `docs/fidelity-corpus.md`: protocolo científico
  e operacional do IFCS; não substituem os contratos executáveis acima.
- `elencos.html`: artefato gerado; não editar os dados embutidos manualmente.

A fronteira arquitetural vigente está detalhada em `docs/architecture.md`.

**Quanto se pode andar de uma vez (revisto em 28/07/2026).** A regra antiga — "não antecipe
várias etapas numa única mudança" — protegia contra mudança *não medida*, mas na prática também
travava migração estrutural que é totalmente verificável. Os dois casos são diferentes:

- **Mudança não medida** (balanceamento, dados, regra nova) continua indo em fatia pequena, uma
  família de parâmetros por vez, com comparação pareada. Aqui a cautela é a única defesa.
- **Migração estrutural provada por paridade** pode ir em fatias maiores. Cada
  checkpoint deve fechar os invariantes pertinentes à superfície alterada,
  conforme a matriz abaixo. Se tocar em motor, API compartilhada ou RNG, isso
  inclui snapshot idêntico, golden bit a bit, `validate` 24/24 e consumo de RNG
  inalterado. Se tocar somente em aplicação/UI, use as guardas centrais e o E2E;
  rode a validação integral ao encerrar um marco amplo. Refatoração não muda
  resultado — se mudou, é bug da refatoração, e a fatia volta atrás.

O que não muda: fatia estrutural e fatia de balanceamento nunca dividem o mesmo commit, e um
número vermelho nunca é contornado ajustando golden ou relaxando suíte.

## Validação obrigatória

Quando as dependências ainda não estiverem instaladas ou o lockfile tiver mudado,
instale-as com `npm ci`. Não reinstale nem repita uma suíte longa sem mudança na
superfície coberta. Para uma alteração documental, rode pelo menos
`npm run check`. Para código:

```text
npm run check
npm run lint
npm run test:data
npm run test:regression
npm run test:calibrator   # se tocar no sandbox/calibrador/worker
npm run test:benchmark    # se tocar em avaliação, química ou simulação
npm run test:fidelity     # se tocar no scorer, corpus ou metodologia IFCS
npm run test:e2e          # se tocar no jogo ou na interface do calibrador
```

`npm run test:all` e `npm run bench` executam as mesmas 24 suítes, na ordem
histórica. Use `npm run validate` para alterações em motores/APIs compartilhadas
e para fechar marcos estruturais amplos. O benchmark completo é demorado; agrupe
mudanças coerentes antes de executá-lo, mas não reduza amostras ou limites para
obter um resultado verde.

## Snapshot e arquivos gerados

- Nunca rode `npm run snapshot:update` para esconder uma regressão.
- Antes de atualizar o snapshot, explique cada diferença e confirme que a
  mudança de classificação é intencional.
- O snapshot deve cobrir todos os IDs de `ATRIBUTOS`; cobertura parcial é erro.
- `elencos.html` é regenerado por `bancada/roster.js` enquanto a arquitetura
  legada existir.
- Demos `.dem`, saídas `processed/`, material `private-audit/`, credenciais e
  cookies nunca entram no Git.
- O extrator IFCS usa `.venv-fidelity` isolada e `requirements-fidelity.lock`.
  A validação Node não instala Awpy nem substitui a prova com uma demo real.
- Não edite `package-lock.json` à mão.

## Convenções para código novo

- Funções e variáveis: `camelCase`; constantes imutáveis: `UPPER_SNAKE_CASE`.
- Preserve labels canônicos do domínio: `AWPer`, `Rifler`, `Entry`, `Lurker`,
  `Support`, `IGL` e os IDs de playstyle.
- Prefira funções puras no domínio e dependências passadas explicitamente.
- Domínio não deve importar DOM, HTML, CSS, Web Worker ou estado de interface.
- Não introduza novo `eval`, `new Function`, parsing de `<script>` ou contrato
  baseado em comentário. Os usos existentes são dívida técnica em migração.
- Novos módulos devem ter exports nomeados e uma API pública pequena.
- Comentários devem explicar decisões, invariantes ou origem de números, não
  apenas repetir o código.

## Disciplina de mudança

- Um commit deve ter uma responsabilidade verificável.
- Faça primeiro movimentação/extracão sem renomear; renomeie depois.
- Não combine formatação em massa com alteração lógica.
- Para RNG e simulador, compare resultados completos usando seeds fixas.
- Se um teste estatístico mudar, registre amostra, resultado anterior, resultado
  novo e justificativa antes de aceitar a diferença.

### Orçamento acumulado: duas guardas que drenam sem ninguém ver

`Favorito gap 16+` e o `invicto` do elenco draftado respondem à **mesma alavanca** — quanta
zebra o jogo permite — e em **sentidos opostos**. Toda etapa de balanceamento gasta um pouco de
um dos dois, e nenhuma etapa isolada parece errada.

Em 28/07/2026 isso custou caro: `Favorito gap 16+` foi de 86,8% para 82,2% em quatro etapas,
todas medidas e aprovadas uma a uma, até ficar a 0,2 pp do piso e abaixo dos 85–90% que o CS
real sustenta. Ninguém estava somando.

**Regra:** toda etapa de balanceamento reporta os dois números **antes e depois**, junto — como
já se faz com a contagem de jogadores alterados. Um sem o outro não decide nada.

A curva completa das quatro faixas de diferença de força sai em `bancada/realismo.js`; a
dificuldade, com IC95%, em `bancada/dificuldade.js`.
