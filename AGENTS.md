# AGENTS.md

Este arquivo orienta pessoas e agentes de IA que trabalham neste repositório.
Comece por `docs/project-context.md`, que registra o ponto de retomada, roadmap
de profissionalização e a visão do modo Carreira de Jogador. Leia também
`docs/architecture.md`, `docs/testing.md` e `docs/glossary.md` antes de alterar
os motores.

## Escopo e branch

- A branch de trabalho é `sandbox-test`.
- `main` é intocável durante a profissionalização estrutural.
- Não faça push, merge ou alteração de branch sem pedido explícito do responsável.
- Preserve mudanças preexistentes e confirme `git status` antes e depois do trabalho.

## Regra mais importante

Não misture refatoração estrutural com mudança de balanceamento.

Uma refatoração deve preservar:

- todos os valores de `CFG_*`, receitas, pesos, thresholds e tabelas;
- ordem das operações, clamps e arredondamentos;
- quantidade e ordem das chamadas ao RNG;
- dados de jogadores, times e treinadores;
- classificações de role, role secundário, playstyle, subarquétipo e OVR;
- química, força efetiva, rating e regras do torneio.

Mudanças deliberadas nesses itens exigem trabalho e commit separados, descritos
como balanceamento e acompanhados de comparação estatística.

## Fontes de verdade atuais

- `game.js`, antes de `// === UI START ===`: motores e dados executáveis.
- `game.js`, depois do marcador: aplicação, estado e interface do jogo.
- `sandbox.html`: interface e algoritmo do calibrador.
- `bancada/roster-snapshot.json`: classificação aprovada de cada ID de jogador.
- `bancada/fidelity-score.js`: matemática e agregação do IFCS.
- `bancada/fidelity-corpus.js`: schema, proveniência, auditoria e travas do corpus IFCS.
- `docs/realism-methodology.md` e `docs/fidelity-corpus.md`: protocolo científico
  e operacional do IFCS; não substituem os contratos executáveis acima.
- `elencos.html`: artefato gerado; não editar os dados embutidos manualmente.

Essa disposição é legado. O destino arquitetural está em
`docs/architecture.md`; não antecipe várias etapas numa única mudança.

## Validação obrigatória

Instale o lockfile com `npm ci`. Para uma alteração documental, rode pelo menos
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

`npm run test:all` e `npm run bench` executam as mesmas 16 suítes, na ordem
histórica. O benchmark completo é demorado; não reduza amostras ou limites para
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
