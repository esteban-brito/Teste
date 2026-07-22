# Contexto do projeto e roadmap de longo prazo

> Documento de continuidade para o responsável, novos programadores e agentes de IA.
> Leia este arquivo antes de planejar trabalho novo. Ele registra o estado conhecido,
> o caminho de profissionalização e a visão do futuro modo carreira de jogador.

## 1. Como interpretar este documento

As decisões estão classificadas assim:

- **Decidido:** contrato vigente; não mudar incidentalmente.
- **Recomendado:** direção técnica preferida, ainda executada gradualmente.
- **Aberto:** decisão de produto ou arquitetura que precisa ser confirmada antes
  de produzir comportamento definitivo.

Este documento não substitui as fontes especializadas:

- `AGENTS.md`: regras de trabalho, branch, invariantes e validação;
- `docs/next-steps.md`: sequência aprovada de auditoria individual, variância,
  campanha, balanceamento condicional e retomada;
- `docs/architecture.md`: arquitetura e dependências permitidas;
- `docs/formulas/`: roles, playstyles, OVR e química;
- `docs/testing.md`: estratégia e comandos de teste;
- `docs/realism-methodology.md`: IFCS, corpus real e nota de fidelidade 0–100;
- `docs/rating-balance-2026-07-20.md`: auditoria do rating e comparação controlada;
- `docs/fidelity-corpus.md`: contrato operacional de coleta e auditoria do corpus;
- `docs/adr/`: decisões arquiteturais;
- `docs/baseline.md`: baseline estatístico e estrutural;
- `docs/glossary.md`: vocabulário do domínio.

Quando houver divergência, código executável + testes + ADR aceito têm precedência.
Atualize este documento quando uma decisão aberta for fechada ou uma etapa do
roadmap for concluída.

## 2. Ponto exato de retomada

Estado registrado em 22 de julho de 2026:

- produto: **draft9-0**, jogo estático de navegador sobre Counter-Strike;
- repositório: `esteban-brito/Teste`;
- branch de trabalho: `sandbox-test`;
- `main`: intocável durante a profissionalização;
- último commit publicado no remoto:
  `d7b3200 feat(sandbox): mostra todos os desvios de rating`;
- branch local e `origin/sandbox-test` estavam sincronizadas e limpas antes da
  atualização documental desta retomada;
- Pages do sandbox: <https://esteban-brito.github.io/Teste/sandbox.html>;
- o E2E do jogo percorre draft, lineup, Suíça, playoffs, título e reinício;
- workflow do commit `d7b3200`: sucesso em validação e deploy;
- run do GitHub Actions: `29790112282`;
- última validação local completa: 17/17 suítes em 173,7 s, com 45.900 mapas
  e 941.838 rounds nos benchmarks;
- nenhuma mudança IFCS alterou motor, dados, configuração, RNG ou balanceamento;
- o alvo IFCS de 22/01/2026 a 07/07/2026 está congelado com fontes e hashes; a
  revisão 2 corrige a troca oficial de Train por Anubis antes da coleta;
- o extrator reproduziu duas vezes uma demo CS2 real; a prova FACEIT acadêmica
  valida o pipeline, mas não pertence ao corpus profissional;
- o primeiro mapa profissional elegível foi extraído duas vezes: FURIA 8–13
  Falcons no IEM Cologne Major 2026; o corpus está em 1/800 mapas e 1/6 eventos;
- o diagnóstico técnico preliminar marcou 96/100 em 4.000 mapas simulados
  (131/136 avaliações dentro das faixas); não é a nota IFCS oficial;
- ainda não existe corpus real auditado nem nota IFCS oficial;
- R1, a auditoria individual aprofundada, está versionada localmente no commit
  `b97b3d7`, sem alteração de motor ou balanceamento, mas ainda não foi publicada;
- o ADR 0002 foi aceito e a trilha estrutural P1 começou: `ATRIBUTOS`,
  `TIMES_DEF` e `PAISES_MAP` possuem cópias de migração em `src/data`, protegidas
  por paridade integral no `npm run check`;
- `bancada/times.js` e `bancada/snapshot.js` já consomem os novos módulos para
  dados crus; o snapshot deixou de manter um `new Function` próprio;
- os ADRs 0004 e 0005 foram aceitos. `tools/add-team.js` agora projeta uma nova
  adição nos módulos e em `game.js` pela mesma operação, preserva quebras de
  linha, valida paridade e restaura fontes/`elencos.html` em caso de falha;
- P2 começou pelas funções puras `rolePairReality`, `secondaryScore` e
  `roleStyleReality`, extraídas para `src/domain` e comparadas exatamente em
  11.319, 724.416 e 37.800 cenários, respectivamente. A auditoria rápida já
  consome as duas regras de realidade por dependência explícita; jogo, sandbox e
  simulador ainda usam o legado;
- `game.js` continua sendo a fonte de verdade executável e os módulos ainda são
  cópias transitórias. Não remover os blocos legados nem migrar navegador,
  sandbox, worker ou gerador sem a próxima prova de paridade;
- R2 continua sendo uma trilha científica/visual separada. Não combinar R2,
  modularização estrutural e balanceamento na mesma mudança.

Para retomar em uma sessão nova:

```powershell
cd C:\Users\esteb\Desktop\Teste
git switch sandbox-test
git status -sb
# use git pull --ff-only somente se o status estiver limpo e não houver commits locais
npm ci
npm run check
```

Antes de alterar motor, simulador ou calibrador, leia `AGENTS.md`, este arquivo,
`docs/next-steps.md`, `docs/architecture.md`, `docs/testing.md` e
`docs/glossary.md`. Execute a camada de testes correspondente. Nunca comece
reescrevendo o projeto.

## 3. Visão atual do produto

O jogo principal é um roguelike/draft de Counter-Strike:

1. o usuário sorteia times históricos;
2. escolhe cinco jogadores e um treinador;
3. observa roles, playstyles, OVR, química e força efetiva;
4. disputa um Major com fase suíça e playoffs;
5. tenta concluir a campanha invicta em 9–0.

O diferencial do projeto é representar o CS profissional real por motores
explicáveis, e não apenas por uma força única arbitrária. A fidelidade é medida
por benchmarks de combate, lados, objetivos, economia, clutches, rating e
assinaturas por função.

### Princípios de produto já estabelecidos

- **Decidido:** roles, role secundário, playstyles e OVR são derivados dos
  atributos; não são etiquetas independentes colocadas sem regra.
- **Decidido:** composição, conflitos, sinergias e treinador afetam química e
  força efetiva.
- **Decidido:** a simulação deve permanecer comparável ao CS profissional real.
- **Decidido:** o jogo principal deve continuar funcionando como site estático,
  sem backend ou build obrigatório.
- **Decidido:** mobile, acessibilidade e carregamento sem CDN fazem parte do
  produto, não são acabamento opcional.
- **Recomendado:** novos modos compartilham os mesmos motores em vez de criar
  versões paralelas das fórmulas.

## 4. Arquitetura executável atual

### Entradas principais

- `index.html` carrega `style.css` e `game.js`.
- `game.js` contém dados, motores, aplicação e UI, separados apenas pelo marcador
  `// === UI START ===`.
- `sandbox.html` é a bancada visual de tuning, auditoria e calibração.
- `calibrador-worker.js` paraleliza a busca do calibrador.
- `elencos.html` é um artefato gerado a partir dos dados e motores.
- `bancada/` executa caracterização, regressão, benchmark, IFCS e E2E.
- `bancada/fidelity-score.js` calcula a nota IFCS a partir de artefatos explícitos.
- `bancada/fidelity-corpus.js` valida proveniência, cobertura e auditoria do corpus.
- `tools/extract-fidelity-demo.py` extrai demos reais offline com Awpy; não faz
  parte do jogo e passou em uma prova repetida documentada, ainda separada do
  corpus profissional.

### Pipeline de domínio

```text
ATRIBUTOS + TIMES_DEF
        |
        v
PRISMA: afinidades -> role principal/secundário -> subarquétipo
        |
        v
ZÊNITE: identidade + atributos + rating -> playstyle + OVR
        |
        v
SINAPSE: elenco + cobertura + conflitos + treinador -> química/força
        |
        v
MARÉ: forma do jogador e da campanha
        |
        v
PÓLVORA + COFRE: rounds, combate, objetivo e economia
        |
        v
FALLEnANGELs: KAST, ADR, impacto, eco e rating pós-partida
```

### Fluxo de dados principal

```text
dados crus
  -> avaliação derivada de cada jogador
  -> pool visual e draft
  -> lineup do usuário
  -> química e força efetiva
  -> estado do Major
  -> simulação de mapa/série
  -> placar, estatísticas e rating
  -> progressão da campanha/interface
```

O sandbox, a bancada Node e o worker ainda recortam ou avaliam fonte para
reutilizar motores. Esse contrato implícito é uma dívida técnica importante.
O destino aceito é ES Modules nativos com exports nomeados, migrados por paridade.

## 5. Motores e invariantes que não podem mudar por acidente

### PRISMA

- calcula afinidades contínuas por função;
- escolhe role principal e secundário;
- considera custo de realidade para pares raros;
- distribui roles no contexto do time;
- pode alterar a leitura contextual sem alterar os atributos crus.

### ZÊNITE

- deriva playstyle e OVR;
- mantém OVR de jogador entre 5 e 22;
- contém curvas, saturações, clamps e regras específicas de IGL;
- arredondamentos e ordem das operações são comportamento.

### SINAPSE

- calcula cobertura de pilares, saturação, conflitos e sinergias;
- separa química bruta e efetiva;
- treinador mitiga partes específicas das penalidades;
- Coringa mitiga conflitos de estilo, não ausência de cobertura funcional;
- força efetiva depende de força bruta, química e treinador.

### MARÉ, PÓLVORA e COFRE

- forma introduz variância competitiva;
- o simulador consome RNG em uma ordem sensível;
- combate, vantagem de homem, plant, retake, clutch e economia interagem;
- adicionar uma chamada aleatória pode mudar toda a sequência posterior.

### FALLEnANGELs

- calcula rating contextual após a partida;
- utiliza produção, sobrevivência, KAST, ADR, impacto e contexto econômico;
- a correlação e o erro contra ratings reais são contratos de benchmark.

### Calibrador

- recebe intenções de role, secundário, playstyle ou OVR;
- busca a menor alteração global capaz de satisfazer o alvo;
- distingue mudança material de dano de margem interna (`marginDamage`);
- mede colaterais fora do alvo;
- preserva intenções anteriores durante buscas posteriores;
- divide o espaço entre workers e suporta cancelamento cooperativo.

### Invariantes estruturais atuais

- 17 times e 85 jogadores;
- cinco jogadores por time;
- todos os IDs crus cobertos por `bancada/roster-snapshot.json`;
- Major com o time do usuário e 15 adversários;
- role labels canônicos: `AWPer`, `Rifler`, `Entry`, `Lurker`, `Support`, `IGL`;
- nenhuma refatoração altera pesos, thresholds, clamps, arredondamentos, dados ou
  consumo de RNG;
- `elencos.html` não é fonte de verdade e não deve receber dados manuais.

## 6. Estado atual da aba Simular

A modernização mais recente concentrou-se no sandbox. O estado publicado inclui:

- confronto de dois times e amostra round-robin dos 17 times;
- mapa único ou lotes de até 500 mapas;
- seed interna nova a cada clique em `Rodar mapa`, `Rodar lote` ou
  `Rodar amostra`;
- seed manual removida da interface;
- probabilidades dos dois times identificadas e complementares, somando 100%;
- intervalo de confiança de 95% para o lado A;
- resumo minimalista com KPR, KAST, ADR, CT win e plant;
- indicadores completos e tabelas avançadas em detalhes recolhidos;
- tabela de rating sem corte arbitrário: dez jogadores no confronto e 85 na
  amostra completa da liga;
- jogadores com amostra pequena permanecem visíveis, acompanhados da quantidade
  individual de mapas;
- suficiência mínima maior para eventos raros, rating e força do favorito;
- métricas sem amostra confiável ficam pendentes no diagnóstico legado do
  sandbox; isso não é a nota IFCS, cujo corpus insuficiente bloqueia publicação;
- rolagem pelo documento corrigida; o canvas não cria scroll aninhado;
- layout desktop e mobile sem overflow horizontal;
- times oficiais preparados uma vez por lote, sem reconstrução por mapa.

Ainda não estão implementados no painel individual: mediana, desvio-padrão,
percentis, intervalo de confiança por jogador, filtros e exportação. Também não
existe um modo campanha separado do lote de expectativa. Esses itens pertencem
a R1–R3 de `docs/next-steps.md` e não autorizam balanceamento incidental.

Medição local observada após a otimização: lote de 80 mapas em aproximadamente
70 ms na máquina de desenvolvimento. Isso é uma referência operacional, não um
limite de CI.

### Baseline individual profunda — R1

**Status:** versionada localmente no commit `b97b3d7`, ainda não publicada. A
saída rápida histórica foi preservada sem argumentos. O modo novo é explícito e
não participa da regressão rápida por padrão:

```powershell
node bancada/auditoria.js
node bancada/auditoria.js --deep
node bancada/auditoria.js --deep --format json
```

O protocolo padrão da auditoria profunda é:

- round-robin completo entre 17 elencos, com 136 confrontos por ciclo;
- oito ciclos, totalizando 1.088 mapas e 22.446 rounds na baseline registrada;
- 85/85 IDs crus, 128 mapas e os 16 elencos adversários por jogador;
- 16 exposições por jogador em cada um dos oito mapas canônicos;
- 64 exposições como lado A e 64 como lado B por jogador;
- troca de lados nos ciclos ímpares e rotação de mapa por confronto/ciclo;
- Mulberry32 reinicializado por confronto com seed derivada de uma base fixa;
- identificação por índice + ID do elenco, porque `Spirit` e `FURIA` possuem
  formações históricas distintas com o mesmo nome;
- verificação interna de cobertura, igualdade de exposição e preservação das
  classificações e atributos;
- relatório humano resumido e JSON determinístico com detalhamento por ID,
  time, mapa, role, playstyle, OVR e quartil de força do adversário.

Resultados descritivos da primeira execução aceita localmente:

| Medida | Resultado |
|---|---:|
| Pearson entre rating real e simulado | 0,943 |
| Spearman entre rating real e simulado | 0,923 |
| erro absoluto médio do rating | 0,053 |
| preservação do top 1 interno do elenco | 54,3% |
| sobreposição do top 3 interno do elenco | 79,6% |
| inversões internas de ordem | 11/167 |

Esses números são uma caracterização, não critérios de aprovação. O relatório
declara `diagnosticOnly: true` e não contém thresholds de passa/falha. Deltas,
caudas, inversões ou diferenças entre grupos não autorizam ajuste de pesos,
atributos ou fórmulas. Qualquer hipótese de balanceamento continua dependendo
do protocolo separado de `docs/next-steps.md`, comparação estatística e commit
próprio.

O JSON completo foi comparado entre duas execuções independentes e permaneceu
idêntico. No estado local após R1 passaram `npm run check`, `npm run lint`,
`npm run test:data`, `npm run test:regression` e `npm run test:benchmark`, sem
atualização de snapshot ou fixture golden.

### Commits que contam a história recente

- `f06662a`: modernização inicial da aba Simular;
- `d490e7b`: organização das suítes por nível;
- `e34076b`: snapshot completo por ID estável;
- `724ebb9`: documentação de arquitetura, fórmulas e invariantes;
- `6a7adf9`: contrato E2E da aba Simular;
- `2b3fece`: laboratório de fidelidade mais profundo;
- `db9b7bb`: alinhamento visual com o restante do jogo;
- `437abc7`: bilateralidade, seed automática, scroll, hierarquia visual,
  suficiência estatística e otimização do lote.
- `c2be541`: contexto de profissionalização e visão do modo Carreira;
- `6148983`: E2E completo do jogo principal, publicado e aprovado na CI;
- `756aaf5`: metodologia IFCS 0–100;
- `0d04e29`: scorer puro e contratos matemáticos do IFCS;
- `8a9977b`: contrato auditável do corpus e extrator Awpy offline;
- `8932afd`: baseline técnica preliminar de 96/100 publicada;
- `d033476`: benchmark determinístico, bilateral e identificado pelos 85 IDs;
- `f9692a4`: golden completo do simulador por seed;
- `56c005b`: E2E do draft aguarda o tipo correto de card;
- `4103e52`: gerador de elencos volta a aceitar o arquivo CRLF;
- `626b7ed`: remove tiers por nome, reduz a compressão do rating com critérios
  numéricos e endurece as guardas individuais;
- `d7b3200`: lista todos os jogadores simulados no painel de desvios de rating.
- `b97b3d7`: auditoria individual profunda e determinística de R1;
- `06d2785`: aceita e detalha a fronteira entre dados crus e derivados;
- `5806a3d`, `8b9794b` e `5fbaf01`: extraem jogadores, elencos e países sob
  testes de paridade integral;
- `9fffde4` e `acb1a48`: migram o lint de elenco e o snapshot para os módulos de
  dados; o segundo remove o `new Function` próprio do snapshot.
- `2a20c0e` e `263b179`: aceitam módulos ES nativos e definem a projeção legada
  transitória dos dados;
- `e4653d7`: torna novas adições de time sincronizadas, validadas e reversíveis.
- `f57f05a` e `ace9f23`: extraem `rolePairReality` com paridade exaustiva e
  migram a análise de pares da auditoria para o módulo público.
- `d8b8480`: extrai `secondaryScore` com paridade exaustiva, sem migrar os
  consumidores clássicos.
- `9f090d8` e `8333faf`: extraem `roleStyleReality` com paridade exaustiva e
  migram a análise de estilos da auditoria para o módulo público.

O balanceamento deliberado está documentado em
`docs/rating-balance-2026-07-20.md`. A mudança posterior de tabela foi apenas de
interface e teste E2E. Ambos os commits estão publicados; qualquer trabalho novo
continua sujeito à autorização explícita de push.

## 7. Sistema de testes, CI e deploy

### Comandos

```text
npm run check             sintaxe e contrato de carregamento do sandbox
npm run lint              lint de jogo, sandbox, worker, bancada e ferramentas
npm run test:data         integridade dos dados
npm run test:regression   auditoria, snapshot, guardas históricas e golden por seed
npm run test:calibrator   calibrador, casos pesados e workers
npm run test:benchmark    realismo, assists, KDA e rating
npm run test:fidelity     contratos e scorer IFCS de fidelidade
npm run corpus:fidelity   selo e verificação do manifesto real IFCS
npm run test:e2e          jogo, calibrador e aba Simular no Chromium
npm run test:all          todas as 17 suítes
npm run validate          check + lint + todas as suítes
node bancada/auditoria.js auditoria rápida histórica de classificação
node bancada/auditoria.js --deep --format json
                           baseline individual determinística detalhada
```

O benchmark completo é deliberadamente demorado. Não reduzir amostras para
acelerar um resultado verde.

### Contratos já cobertos

- dados e IDs dos 85 jogadores;
- distribuição aprovada de roles e playstyles;
- reforma cirúrgica do drop;
- mudanças materiais versus margens internas;
- busca, custo, intenções, partições e cancelamento do calibrador;
- realismo de KPR, lados, plants, economia, pistols e clutches;
- assists e assinaturas por função;
- K/D/KAST/ADR por função;
- correlação e erro do rating;
- placar, bilateralidade, seed automática, suficiência, scroll e responsividade
  da aba Simular;
- draft, lineup, Suíça, playoffs, tela final e reinício do jogo principal;
- matemática, monotonicidade, incerteza, cobertura e caps do scorer IFCS;
- schema, hashes, mínimos, splits, auditoria determinística e holdout do corpus;
- erros de página e valores inválidos.

### CI e Pages

`.github/workflows/deploy-pages.yml` reage a pushes em `sandbox-test`:

1. checkout;
2. Node 20;
3. `npm ci`;
4. instalação do Chromium;
5. check, lint e bancada completa;
6. deploy da raiz em `gh-pages` apenas se a validação passar.

O deploy aplica cache-busting de conteúdo a `style.css` e `game.js` no
`index.html`. O sandbox é publicado como arquivo estático junto com o jogo.

## 8. Objetivo de profissionalização

Prioridades definidas pelo responsável, nesta ordem:

1. organização;
2. padronização;
3. legibilidade e manutenção;
4. compreensão por IAs e novos programadores;
5. otimização;
6. redução de dívida técnica.

### Restrições do trabalho

- não recomendar nem executar reescrita completa;
- não mudar balanceamento durante refatoração estrutural;
- não misturar comportamento novo com movimentação/renome/formatação;
- usar etapas pequenas, reversíveis e verificadas;
- criar caracterização antes de extrair um comportamento ainda invisível;
- manter o Pages funcional ao fim de cada etapa;
- preservar a experiência atual enquanto novos modos são adicionados.

## 9. Estrutura de pastas final sugerida

Esta é direção, não autorização para mover tudo de uma vez:

```text
src/
  data/
    players.js
    teams.js
    coaches.js
    maps.js
  domain/
    evaluation/
      roles.js
      playstyles.js
      ovr.js
    chemistry/
    simulation/
      rng.js
      combat.js
      economy.js
      match.js
    rating/
    tournament/
    career/
  application/
    draft/
    major/
    sandbox/
    career/
  ui/
    shared/
    game/
    sandbox/
    career/
  infrastructure/
    workers/
    persistence/
    generated/
apps/
  game/
  sandbox/
  career/
tests/
  unit/
  integration/
  regression/
  benchmark/
  e2e/
docs/
  adr/
  formulas/
```

### Dependências desejadas

```text
UI -> aplicação -> domínio <- dados
 |        |
 +------> infraestrutura
```

Domínio não conhece DOM, HTML, CSS, worker ou estado global. Renderizadores não
recalculam regra de negócio. Worker e processo principal importam a mesma API.

## 10. Roadmap estrutural incremental

### Etapa P0 — preservar o baseline

**Status:** parcialmente concluída e segura. E2E, metodologia, alvo congelado,
scorer, contrato do corpus e prova do extrator estão implementados; coleta
profissional auditada e primeira baseline IFCS estão pendentes.

- manter documentação, snapshot e grupos de teste atualizados;
- manter os goldens completos por seed antes e durante a movimentação do simulador;
- manter o E2E concluído do fluxo principal: draft, lineup, Suíça e playoffs;
- separar benchmark de desempenho do benchmark de realismo.
- concluir o IFCS por etapas: adquirir/auditar o corpus profissional e gerar a
  primeira baseline sem tuning no mesmo commit.

Aceitação: nenhuma classificação, estatística ou sequência aprovada muda.

### Etapa P1 — contratos e dados crus

**Risco:** seguro a moderado.

**Status:** em andamento. ADR 0002 aceito; jogadores, elencos e países extraídos
sob paridade; lint, snapshot e `add-team` já usam a nova fronteira. Os blocos de
`game.js` continuam necessários para consumidores clássicos.

- aceitar ou revisar ADR 0002;
- extrair dados crus sem extrair fórmulas no mesmo commit;
- tornar IDs explícitos obrigatórios para persistência;
- fazer gerador de elencos consumir a API pública;
- validar schemas na entrada.

Aceitação: snapshot e artefato gerado idênticos.

### Etapa P2 — módulos ES de avaliação

**Risco:** moderado.

**Status:** iniciada. ADR 0004 aceito; `rolePairReality`, `secondaryScore` e
`roleStyleReality` são as primeiras funções puras extraídas. As duas regras de
realidade possuem um consumidor Node migrado; o restante de PRISMA/ZÊNITE ainda
permanece em `game.js`.

- aceitar ou revisar ADR 0004;
- extrair primeiro funções puras de roles, secundário, playstyles e OVR;
- manter adapter legado para `game.js`, sandbox e bancada;
- remover loaders por recorte somente após todos os consumidores migrarem.

Aceitação: paridade de todos os 85 jogadores e mesmos outputs por seed.

### Etapa P3 — química e força

**Risco:** moderado.

- isolar composição, pilares, sinergias, conflitos e treinador;
- tornar entrada/saída explícitas;
- adicionar unitários para clamps, saturações e mitigadores;
- preservar mutações contextuais de `distribuirRoles` até haver contrato puro.

Aceitação: mesmas químicas e forças para fixtures representativas e snapshot.

### Etapa P4 — RNG, simulação e rating

**Risco:** arriscado.

- injetar adapter do Mulberry32 sem mudar consumo;
- preservar os golden tests já capturados de eventos completos;
- separar forma, combate, economia, mapa e rating em commits distintos;
- medir desempenho sem alterar a distribuição estatística.

Aceitação: goldens por seed idênticos e benchmarks dentro das faixas.

### Etapa P5 — aplicação e estado

**Risco:** moderado a arriscado.

- separar estado do draft, Major, áudio e futura carreira;
- usar comandos/reducers pequenos sem framework obrigatório;
- tornar timers, DOM, áudio e persistência efeitos explícitos;
- impedir que renderização escreva regras de domínio.

Aceitação: E2E completo do jogo principal sem regressão visual ou funcional.

### Etapa P6 — sandbox, calibrador e workers

**Risco:** arriscado.

- fazer sandbox importar módulos públicos;
- separar UI da busca e da análise de colaterais;
- compartilhar a mesma API entre worker e thread principal;
- remover `new Function`, parsing de `<script>` e contratos por comentário.

Aceitação: intenções, Pareto, `marginDamage`, cancelamento e E2E preservados.

### Etapa P7 — padronização e dívida residual

**Risco:** seguro se fragmentado.

- nomes consistentes e exports nomeados;
- constantes e configurações centralizadas por domínio, não num arquivo global;
- erros tipados/estruturados e validação nas fronteiras;
- comentários sobre decisão, não tradução de linha;
- documentação e ADRs atualizados no mesmo commit que conclui cada migração;
- remoção de duplicação apenas depois de caracterizar os dois caminhos.

## 11. Nova visão: modo carreira de jogador

### Status da ideia

**Aberto e ainda não implementado.** A visão inicial do responsável é criar um
modo no qual o usuário cria o próprio jogador e vive uma carreira individual,
em contraste com o modo atual centrado em montar um elenco e vencer um Major.

Nome provisório: **Carreira de Jogador**.

### Fantasia central

O usuário cria uma identidade competitiva e acompanha sua transformação de
promessa em jogador profissional. Suas escolhas moldam atributos e trajetória,
mas a identidade esportiva continua sendo interpretada pelos mesmos motores do
draft9-0. O jogo deve mostrar não só “subiu de nível”, mas *como* o jogador está
mudando: role, secundário, playstyle, OVR, encaixe coletivo, forma e rating.

### Decisões recomendadas desde o início

- o jogador criado nasce como **dados crus**, não como card com resultados
  derivados gravados manualmente;
- PRISMA e ZÊNITE calculam role, role secundário, playstyle e OVR;
- SINAPSE calcula seu encaixe em cada elenco;
- MARÉ, PÓLVORA, COFRE e FALLEnANGELs simulam suas partidas e ratings;
- o modo carreira não ganha uma cópia simplificada ou incompatível dos motores;
- balanceamento de progressão fica separado do balanceamento do simulador;
- o modo atual continua disponível e não vira dependência da carreira;
- o primeiro release pode ser inteiramente local, usando persistência no
  navegador e exportação/importação de save.

### Fluxo de criação recomendado

1. identidade: nick, nome opcional, país, avatar/cor e mão dominante se isso
   tiver efeito apenas cosmético;
2. intenção: função desejada ou fantasia de jogo usada como orientação, não como
   override permanente do motor;
3. perfil inicial: distribuir um orçamento limitado entre `fp`, `en`, `tr`,
   `op`, `cl`, `sn` e `ut`;
4. prévia ao vivo: afinidades, provável role principal/secundário, playstyle e
   OVR calculados pelos motores reais;
5. validação: impedir valores fora do limite, orçamento excedido e combinações
   impossíveis;
6. confirmação: criar ID persistente próprio e iniciar a carreira.

Uma alternativa é o usuário escolher um arquétipo inicial e depois ajustar
poucos pontos. Isso reduz paralisia de escolha e produz perfis plausíveis. A
decisão entre “sliders livres”, “arquétipos” ou modelo híbrido está **aberta**.

### Loop de carreira proposto

```text
criar jogador
  -> entrar em academia/time inicial
  -> definir foco de treino e objetivo
  -> simular/jogar calendário
  -> receber minutos, estatísticas, rating e feedback
  -> evoluir atributos e reputação
  -> disputar posição, receber propostas e trocar de time
  -> jogar campeonatos e construir legado
  -> repetir por temporadas
```

### Sistemas candidatos

- criação e identidade do jogador;
- treino com escolhas e custo de oportunidade;
- forma, confiança e fadiga;
- titularidade e adequação ao elenco;
- objetivos de partida/temporada;
- calendário, campeonatos e temporadas;
- contratos, propostas e transferências;
- relação com treinador e estabilidade do time;
- reputação, conquistas e legado;
- histórico estatístico por mapa, evento, time e temporada;
- lesões somente se acrescentarem decisões interessantes e forem configuráveis;
- aposentadoria e resumo final da carreira.

Nem todos pertencem ao MVP.

### MVP recomendado

O primeiro corte deve provar a fantasia sem construir um simulador de vida:

1. criar e salvar um jogador;
2. mostrar sua avaliação real pelos motores;
3. inseri-lo num elenco controlado/selecionado;
4. simular um pequeno calendário ou uma temporada curta;
5. escolher foco de treino entre rodadas;
6. registrar estatísticas, rating e evolução;
7. concluir a temporada com um resumo e permitir continuar.

Fora do primeiro MVP: multiplayer, backend, mercado global complexo, diálogos
procedurais extensos, dezenas de ligas e reescrita do simulador.

### Progressão sem quebrar o motor

O modo carreira deve alterar os atributos crus do jogador por regras próprias de
progressão. Depois de cada alteração, todos os derivados são recalculados.

Regras recomendadas:

- treino melhora eixos específicos, não “+1 OVR” direto;
- ganhos possuem custo crescente e limite coerente;
- tempo de jogo, performance e qualidade de treino influenciam desenvolvimento;
- resultados de uma partida não devem causar saltos grandes isoladamente;
- role ou playstyle podem mudar organicamente quando afinidades cruzam margens;
- a interface deve avisar quando uma identidade está perto de mudar;
- regressão por idade/fadiga, se existir, age em atributos e tem limites claros;
- seeds e versão do save tornam resultados investigáveis;
- mudanças de progressão recebem seus próprios testes e benchmarks, separados
  das faixas de realismo do combate.

### Modelo de estado inicial sugerido

Isto é contrato conceitual, não código definitivo:

```js
{
  schemaVersion: 1,
  careerId: "uuid-ou-id-local",
  createdAt: "ISO-8601",
  player: {
    id: "career:...",
    identity: { nick, name, country, visual },
    rawAttributes: { fp, en, tr, op, cl, sn, ut, rating, isIGL },
    development: { age, potential, trainingFocus, fatigue, confidence }
  },
  context: {
    season,
    date,
    teamId,
    contract,
    reputation,
    objectives
  },
  history: {
    teams: [],
    matches: [],
    seasons: [],
    achievements: []
  },
  rng: { algorithmVersion, seed, state }
}
```

Não persistir como fonte de verdade: role, secundário, playstyle, OVR, química,
força efetiva e rating de cada partida. Esses valores podem aparecer em
snapshots históricos, acompanhados da versão do motor, mas o estado atual deve
ser derivado.

### Persistência

**Recomendado:** adapter versionado com:

- `localStorage` ou IndexedDB atrás de uma interface pequena;
- autosave atômico em pontos seguros;
- slots manuais;
- exportação/importação JSON;
- `schemaVersion` e migrações explícitas;
- validação completa antes de carregar;
- backup do save anterior antes de migrar;
- nenhuma função de domínio lendo diretamente o navegador.

### Arquitetura do modo carreira

```text
src/domain/career/
  progression.js
  training.js
  contracts.js
  season.js
  objectives.js

src/application/career/
  create-career.js
  career-store.js
  career-commands.js
  career-view-model.js

src/infrastructure/persistence/
  career-save.js
  career-migrations.js

src/ui/career/
  creator.js
  dashboard.js
  matchday.js
  history.js
```

Esses diretórios só devem nascer quando a primeira fatia vertical precisar
deles. Não criar árvore vazia nem mover o repositório inteiro antes do protótipo.

### Testes necessários para a carreira

- unitários de orçamento e validação do criador;
- paridade do jogador criado com PRISMA/ZÊNITE;
- unitários de progressão, treino, limites e transições de identidade;
- serialização, carregamento, corrupção e migração de save;
- integração carreira -> elenco -> química -> simulação -> rating;
- determinismo por seed em uma temporada curta;
- E2E: criar jogador, salvar, recarregar, simular, treinar e continuar;
- acessibilidade do criador e dashboard;
- benchmark para saves longos e históricos grandes;
- teste que prove que o modo carreira não altera o snapshot do elenco histórico.

### Fases seguras de implementação

#### C0 — descoberta e ADR

- fechar fantasia, escopo do MVP e decisões abertas;
- escrever ADR do modo carreira e contrato de persistência;
- desenhar wireflow simples;
- nenhuma mudança de comportamento.

#### C1 — API de avaliação estável

- extrair/encapsular avaliação de um jogador sem DOM;
- receber atributos crus e retornar derivados;
- cobrir com jogadores históricos e sintéticos.

#### C2 — estado e save

- definir schema versionado;
- implementar reducer/comandos puros;
- adapter local de save e import/export;
- ainda sem temporada completa.

#### C3 — criador de jogador

- entregar uma página ou rota experimental isolada;
- orçamento, arquétipos/sliders e prévia real dos motores;
- criar, salvar, recarregar e excluir carreira com confirmação.

#### C4 — primeira temporada vertical

- inserir jogador num elenco controlado;
- calendário curto, simulação, estatísticas e rating;
- treino entre partidas e resumo de temporada.

#### C5 — profundidade de carreira

- contratos, propostas, disputa por posição, reputação e objetivos;
- histórico multi-temporada;
- balanceamento próprio, em commits separados.

#### C6 — acabamento

- narrativa, conquistas, sons, responsividade, acessibilidade e desempenho;
- telemetria apenas se houver decisão explícita de privacidade e infraestrutura.

### Quando começar

**Recomendação atual:** não implementar a carreira inteira dentro do monólito.
Também não é necessário esperar toda a profissionalização terminar. O melhor
ponto é depois de existir:

1. contrato E2E do fluxo principal (**cumprido**);
2. API estável e testada para avaliar um jogador a partir de atributos crus;
3. adapter de RNG injetável ou pelo menos goldens suficientes;
4. contrato versionado de persistência.

Nesse momento, C2/C3 podem avançar como fatia isolada enquanto o restante do
monólito continua sendo extraído gradualmente.

## 12. Decisões abertas para o responsável

Não presumir respostas sem conversar:

1. A carreira começa em academia, time fraco, seletiva ou escolha livre?
2. O usuário controla somente treino/decisões ou também ações durante partidas?
3. O jogador escolhe uma role desejada, um arquétipo ou distribui tudo livremente?
4. O mundo usa apenas os 17 times históricos atuais ou temporadas fictícias?
5. Times e jogadores envelhecem/evoluem junto com o protagonista?
6. A carreira tem fim obrigatório, aposentadoria opcional ou modo infinito?
7. Contratos e transferências devem ser centrais ou leves?
8. Existe dificuldade? Ela afeta progressão, decisões adversárias ou ambos?
9. Saves serão exclusivamente locais no primeiro momento?
10. A experiência vive dentro do `index.html` ou começa numa entrada
    experimental separada como `career.html`?
11. Qual deve ser a faixa de OVR inicial e o ritmo desejado de progressão?
12. Falha esportiva pode encerrar a carreira ou sempre há recuperação?

## 13. Primeiro conjunto de trabalho recomendado ao retomar

A fonte canônica da sequência é `docs/next-steps.md`. Ordem resumida:

1. R1 concluída localmente: auditoria individual profunda versionada sem tocar
   no motor ou balanceamento; publicação continua dependendo de pedido explícito;
2. R2: mostrar média, mediana, desvio-padrão, percentis e incerteza no sandbox,
   consumindo os conceitos validados em R1 sem duplicar fórmulas;
3. R3: definir e implementar campanha separada da expectativa de muitos mapas;
4. R4: auditar AWPer, sobrevivência e playstyle por critérios numéricos;
5. R5/R6: balancear somente se houver evidência e validar integralmente;
6. aprimorar usabilidade do laboratório;
7. continuar a modularização por paridade: P1 possui dados e projeção legada;
   P2 deve começar por uma única fronteira pura do PRISMA;
8. completar corpus e primeira nota IFCS oficial;
9. preparar Carreira de Jogador sobre APIs estáveis, RNG contratado e save
   versionado.

`secondaryScore` e `roleStyleReality` já foram caracterizadas e extraídas sem
puxar `afinidades`, distribuição contextual ou classificação completa. Antes da
próxima extração estrutural, caracterizar uma única nova fronteira pura do PRISMA
e manter a mudança isolada.
`game.js` permanece fonte executável para consumidores clássicos; a projeção do
ADR 0005 impede divergência em novas adições. R2 pode avançar separadamente
quando priorizada. Antes de congelar thresholds de cauda ou ranking, revisar a
baseline atual. Cada etapa deve ser um commit pequeno ou uma sequência curta com
responsabilidade verificável; não misturar auditoria, interface, refatoração e
balanceamento.

## 14. Dívidas e riscos conhecidos

- `game.js` e `sandbox.html` são grandes e concentram responsabilidades;
- sandbox, Node e worker dependem de loaders frágeis por texto;
- estado global mistura domínio, aplicação e efeitos;
- não existe ainda persistência versionada adequada para uma carreira;
- goldens completos do simulador por seed existem; qualquer mudança deliberada
  exige explicação estatística antes da atualização do fixture;
- o scorer e o contrato de corpus IFCS existem; o alvo de 22/01/2026 a
  07/07/2026 está congelado e o extrator foi provado com uma demo real, mas
  ainda faltam adquirir, extrair e auditar os dados profissionais antes da nota;
- configurações ainda vivem próximas de dados e implementação;
- `elencos.html` pode divergir se não for regenerado;
- alterações no RNG produzem regressões amplas e difíceis de diagnosticar;
- histórico ilimitado de carreira pode crescer demais no navegador;
- evolução do protagonista pode quebrar fidelidade se alterar outputs derivados
  diretamente ou reutilizar thresholds do combate como regras de progressão;
- um modo novo dentro do monólito aumentaria muito a dívida antes das extrações
  mínimas recomendadas.

## 15. O que deve permanecer como está por enquanto

- funcionamento estático e sem framework obrigatório;
- branch `sandbox-test` como área de trabalho;
- `main` intocável até decisão explícita;
- motores, pesos e faixas atuais;
- labels canônicos de roles e IDs de playstyle;
- Mulberry32 e ordem atual de consumo do RNG;
- snapshot completo por ID cru;
- suíte estatística com tamanho real;
- deploy condicionado à validação;
- sandbox como ferramenta de diagnóstico que não aplica mudanças sozinho;
- modo draft/Major como experiência existente, mesmo após nascer a carreira.

## 16. Regras para qualquer IA futura

- leia `AGENTS.md` e este documento antes de editar;
- verifique branch, status e mudanças do usuário;
- não trate recomendações deste arquivo como comportamento já implementado;
- não invente resposta para decisões marcadas como abertas;
- não proponha reescrita completa;
- não altere balanceamento para facilitar refatoração ou teste;
- não reduza benchmark para ganhar tempo;
- não chame o diagnóstico legado do sandbox de nota IFCS;
- não publique nota IFCS sem corpus real auditado, cobertura e intervalo;
- não atualize snapshot para esconder regressão;
- não persista derivados como fonte de verdade da carreira;
- não crie um segundo conjunto de fórmulas para o jogador criado;
- explique claramente qualquer mudança no RNG, save ou schema;
- mantenha commits pequenos e dê ao responsável uma forma concreta de testar.

## 17. Critério de sucesso de longo prazo

O projeto estará profissionalizado quando:

- dados, domínio, aplicação, UI e infraestrutura tiverem fronteiras claras;
- browser, Node e worker importarem os mesmos módulos públicos;
- o jogo principal e a carreira tiverem E2E completos;
- fórmulas e configurações forem localizáveis e documentadas;
- saves forem versionados, validáveis e migráveis;
- um novo programador ou IA conseguir localizar uma regra sem vasculhar HTML;
- otimizações forem medidas sem mudar a distribuição esportiva;
- o draft/Major continuar estável;
- o modo Carreira de Jogador usar os motores reais e oferecer uma progressão
  legível, investigável e divertida por várias temporadas.

## 18. Resumo em uma frase

Preservar o simulador fiel e o draft atual, modularizar por paridade e, sobre
essa base, criar uma carreira em que o usuário desenvolve um jogador próprio
cujos atributos são interpretados pelos mesmos motores de identidade, equipe e
partida do draft9-0.
