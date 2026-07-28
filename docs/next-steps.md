# Plano de retomada — fidelidade individual e evolução do laboratório

> Fonte canônica dos próximos passos aprovada em 21 de julho de 2026 e
> sincronizada com o estado publicado em 22 de julho de 2026.
> Este documento registra o raciocínio que deve sobreviver entre sessões. Ele
> não autoriza balanceamento imediato e não substitui `AGENTS.md`.

## 1. Estado publicado na origem deste plano

- branch de trabalho: `sandbox-test`;
- `main`: intocável;
- commit publicado: `69ce197 docs(context): record prisma style extraction`;
- Pages: <https://esteban-brito.github.io/Teste/sandbox.html>;
- GitHub Actions: execução `29944917615`, validação e deploy aprovados;
- commit anterior de balanceamento:
  `626b7ed balance(sim): remove curadoria e descomprime ratings`;
- última validação integral registrada: 17/17 suítes, 45.900 mapas e 941.838
  rounds;
- corpus IFCS: 1/800 mapas profissionais e 1/6 eventos; ainda não existe nota
  IFCS oficial.

## 2. Diretriz do responsável

O projeto deve buscar realismo e fidelidade ao Counter-Strike profissional por
meio de fórmulas gerais, dados, estatística e comportamento emergente. Não usar:

- bônus, penalidades ou exceções por nick;
- tiers manuais de jogadores;
- tratamento específico por ID, time ou época para forçar um resultado;
- ajuste visual que esconda uma distorção do motor;
- atualização de snapshot ou golden para silenciar uma regressão.

É aceitável que um jogador supere ou fique abaixo de seu rating histórico em um
confronto. O que precisa ser protegido é a distribuição plausível, a hierarquia
em amostras adequadas e a ausência de viés sistemático.

## 3. Diagnóstico que originou o trabalho

O responsável observou no sandbox que, em lotes de 491 mapas, os ratings de
jogadores como s1mple, electroNic e 910 convergiam repetidamente para valores
parecidos, mesmo ao atualizar a página. Também observou confrontos em que a
probabilidade coletiva favorecia fortemente um time, mas a leitura individual
parecia incompatível com a expectativa.

O veredito técnico foi:

- a aleatoriedade por mapa funcionava;
- médias de 491 mapas quase constantes eram matematicamente esperadas, pois o
  erro-padrão cai aproximadamente com `1/sqrt(n)`;
- a apresentação da variância no sandbox era insuficiente;
- os ratings históricos extremos estavam excessivamente comprimidos;
- a validação era boa no agregado, mas fraca para proteger indivíduos.

## 4. Trabalho já concluído — não repetir

### Caracterização e auditoria

- golden completo do simulador por seed, cobrindo rounds, economia, objetivos,
  clutches, destaques e os dez jogadores;
- auditoria determinística, bilateral e identificada pelos 85 IDs crus;
- adversários determinísticos e agenda mais balanceada;
- invariância a nome: trocar somente o nick não muda resultados numéricos;
- E2E completo do jogo e da aba Simular.

### Balanceamento já publicado

- remoção de `TIER_LENDA` e `TIER_STAR` baseados em nomes;
- substituição por critérios numéricos derivados do rating observado;
- redução da compressão entre ratings baixos e extremos;
- correlação real×sim de 0,853 para 0,946;
- MAE de 0,071 para 0,052;
- inclinação real→sim de 0,706 para 0,998;
- maior erro individual de 0,30 para 0,18;
- métricas macro preservadas dentro das faixas aprovadas.

### Interface já publicada

- a tabela de desvios não corta mais nos oito primeiros;
- confronto A × B mostra os dez jogadores simulados;
- auditoria da liga mostra os 85 jogadores quando todos participaram;
- jogadores com amostra pequena não são escondidos;
- a coluna `Mapas` informa o tamanho individual da amostra;
- a ordenação permanece por desvio absoluto decrescente;
- nenhum cálculo de rating foi alterado por essa mudança visual.

### Refinamento concluído em 23 de julho de 2026

- o painel principal passa a priorizar rating, K/D, KPR, DPR, assistências por
  round, KAST e ADR;
- cada jogador mostra função primária e secundária; para IGL, a secundária é o
  papel de combate;
- filtros, ordenação, comparação e CSV conhecem as duas funções e as novas
  métricas;
- desvio-padrão e IC95% saem das colunas principais, mas continuam disponíveis
  na comparação, na visualização acessível e no CSV;
- a mudança acumula saídas já produzidas por cada mapa e não altera motor,
  fórmulas, RNG, balanceamento, snapshot ou golden;

### Editor de atributos concluído em 23 de julho de 2026

- cada jogador mantém rascunho e versão aplicada separados pelo ID cru;
- `Aplicar ao laboratório` torna a edição visível em Time, Simular e Calibrar;
- trocar de jogador não perde rascunhos nem aplicações anteriores;
- descarte, restauração individual, reset global, relatório e exportação JSON
  possuem contratos explícitos;
- a interface usa nomes completos, número antes do slider e trilhos limitados;
- aplicações valem apenas na sessão e não modificam dados ou motores do
  repositório.

## 5. Lacunas atuais

O benchmark ainda protege principalmente média, correlação, inclinação, MAE e
erro máximo. Isso não basta para detectar todos os problemas possíveis:

- caudas ruins podem coexistir com uma média boa;
- a ordem dos jogadores dentro de um time pode se inverter sistematicamente;
- top players podem perder hierarquia sem romper o MAE global;
- a interface agora mostra a oscilação de mapa para mapa, mas a campanha curta
  ainda não possui contrato próprio;
- o lote longo representa expectativa, não uma campanha competitiva curta;
- o possível excesso de sobrevivência de certos perfis de AWPer ainda não foi
  isolado por decomposição de componentes;
- o corpus profissional ainda é insuficiente para validar essas distribuições
  como uma nota científica oficial.

## 6. Sequência obrigatória dos próximos trabalhos

### Etapa R1 — auditoria individual aprofundada, sem balanceamento

**Status:** concluída e publicada em `b97b3d7`, com relatório determinístico e
diagnóstico sem thresholds de aprovação.

Objetivo: tornar a bancada capaz de reprovar uma mudança que pareça boa no
agregado, mas distorça jogadores ou funções.

Adicionar, por ID cru:

- erro assinado e absoluto;
- média, mediana e desvio-padrão do rating por mapa;
- P5, P25, P75 e P95;
- intervalo de confiança da média;
- erro P90, P95 e máximo entre os 85 jogadores;
- viés por role, faixa de rating e força do adversário;
- correlação de ranking global;
- preservação de top players;
- inversões de pares dentro de cada time e tamanho dessas inversões.

Os thresholds novos não devem ser inventados antes de medir o baseline atual.
Primeiro produzir uma caracterização, revisar a distribuição e só então congelar
guardas justificadas em um commit separado.

Aceitação:

- todos os 85 IDs cobertos;
- mesma agenda, lados e seeds em comparações pareadas;
- relatório reproduzível;
- nenhuma alteração em `CFG_*`, fórmulas ou RNG;
- teste sintético prova que a auditoria detecta hierarquia individual degradada
  mesmo quando a média global permanece aceitável.

### Etapa R2 — variância individual no sandbox

**Status:** concluída no ciclo iniciado após `69ce197`, sem alteração de motor,
dados, configuração, RNG, snapshot ou golden.

Objetivo: mostrar o que a média de 491 mapas esconde.

Para cada jogador, exibir ou disponibilizar:

- função primária e secundária;
- kills, deaths, assists, K/D, KPR, DPR, assistências por round, KAST e ADR;
- média e mediana;
- desvio-padrão;
- P5 e P95;
- extremos absolutos e faixa recorrente P10–P90;
- intervalo de confiança da média;
- rating histórico, delta e mapas;
- aviso de amostra pequena.

Não confundir conceitos:

- desvio-padrão mede oscilação entre mapas;
- percentis descrevem a distribuição observada;
- intervalo de confiança mede a precisão da média;
- delta mede distância da referência histórica.

Usabilidade entregue:

- busca por jogador;
- filtros por time, role e suficiência;
- ordenação por qualquer métrica;
- comparação lado a lado;
- exportação CSV segura e rastreável do conjunto filtrado;
- painel visual em escala comum para comparar P10–P90, P5–P95, extremos, média,
  mediana e referência histórica;
- legenda completa, coluna explícita para selecionar a comparação e ajuda
  estatística recolhível;
- lote destacado como ação principal e aderência às faixas sem aparência de
  nota oficial;
- largura integral e cabeçalho/identidade fixos no desktop;
- comparação vazia recolhida e linhas convertidas em cards no celular;
- todos os jogadores continuam acessíveis, sem curadoria visual.

Aceitação:

- confronto mostra dez jogadores mesmo com lote pequeno;
- liga mostra todos os jogadores que participaram;
- resultados numéricos da simulação não mudam;
- E2E cobre visualizações, colunas, filtros, ordenação, comparação recolhida,
  amostra pequena, ausência de overflow e cards mobile;
- nenhuma nova chamada ao RNG.

Evidência registrada:

- matemática compartilhada com R1 em
  `src/domain/statistics/sample-summary.mjs`, coberta por 5.464 amostras de
  paridade;
- auditoria profunda reproduzida duas vezes com SHA-256
  `d9faccb428073b8191640c1a78830340b58f30d1ebdbeb91f60d0d43160bee8d` e
  2.273.746 bytes;
- E2E cobre dez jogadores, 85 jogadores, amostra pequena, filtros, ordenação,
  comparação, visual por jogador, download CSV, segurança do CSV, rolagem,
  identidade fixa no desktop e layouts intermediário/mobile;
- redesenho visual preserva a auditoria profunda em SHA-256
  `d9faccb428073b8191640c1a78830340b58f30d1ebdbeb91f60d0d43160bee8d` e
  2.273.746 bytes;
- `npm run validate` aprovado após o refinamento final em 17/17 suítes e 180,3 s.

### Etapa R3 — separar expectativa de campanha

**Status:** em andamento. O primeiro recorte executável é uma MD3 independente
entre dois times escolhidos; a distribuição entre muitas campanhas permanece
para a próxima fatia.

**Decisão de retomada em 22/07/2026:** congelar o design aprovado do sandbox e
fazer da repetição de muitas MD3 a próxima mudança funcional. Não misturar essa
entrega com novo polimento visual, modularização ou balanceamento.

Objetivo: responder duas perguntas diferentes sem misturá-las.

**Expectativa de longo prazo:** o lote atual, com centenas de mapas, usado para
convergência e balanceamento. Deve deixar claro que estabilidade entre execuções
é esperada.

**Campanha:** sequência curta e competitivamente plausível, usada para mostrar
o que uma pessoa pode vivenciar no jogo. A unidade inicial foi fechada como uma
série MD3 isolada, menor e mais auditável que um Major ou temporada.

Contrato implementado da primeira fatia:

- dois times escolhidos pelo usuário e primeiro a dois mapas;
- dois ou três mapas únicos, derivados deterministicamente da seed;
- orientação dos times alternada entre mapas;
- forma de cada time sorteada uma vez e mantida durante a série;
- placar da série e placares de cada mapa;
- diagnóstico individual disponível, sempre marcado como amostra pequena;
- golden próprio em `bancada/campaign-golden.json`;
- separação visual explícita: a MD3 não se apresenta como expectativa ou nota
  de fidelidade e não altera o Major do jogo principal.

O modo campanha deve definir explicitamente:

- estrutura e quantidade de partidas;
- adversários, mapas e lados;
- se e como a forma persiste entre partidas;
- unidade do resultado: campanha, série ou mapa;
- distribuição entre muitas campanhas repetidas;
- relação com o Major já existente.

Saída mínima da próxima fatia:

- controle explícito da quantidade de campanhas, incluindo 100 e 500;
- vitórias de série por time e frequências de `2–0`, `2–1`, `1–2` e `0–2`;
- quantidade média de mapas por série e frequência de cada mapa;
- separação inequívoca entre estatística por mapa e por campanha;
- leitura de consistência individual entre séries sem esconder participantes;
- seed reproduzível, golden dedicado e E2E de desktop, tablet e celular.

Aceitação:

- rótulos e explicações não permitem interpretar 491 mapas como uma temporada;
- expectativa preserva o comportamento atual;
- campanha possui contrato determinístico por seed;
- goldens próprios antes de qualquer otimização ou balanceamento;
- nenhuma duplicação paralela dos motores.

Ainda falta em R3:

- repetir muitas campanhas e mostrar a distribuição de 2–0/2–1 e vencedores;
- decidir se haverá histórico persistente de séries no laboratório;
- avaliar uma evolução posterior para temporada curta sem acoplar o Major atual.

### Etapa R4 — auditoria de AWPer, sobrevivência e playstyle

**Status:** R4.1 e R4.2 concluídas; diagnóstico para o gate de R5 em andamento.
A auditoria profunda separa função primária, função de combate efetiva, par
primária/secundária, vitória/derrota, lado e compra do time. A telemetria opcional
reconcilia K/D/A/KAST/ADR por round com o resultado final e preserva resultado e
consumo de RNG por igualdade profunda no golden. O relatório valida cobertura
dos 85 IDs, resultados e todas as partições. Arma, inventário e compra individual
continuam indisponíveis e não devem ser inferidos do estado econômico do time.
Evidência reproduzível: `docs/role-fidelity-audit-2026-07-23.md`.

Objetivo: verificar, sem presumir culpa, se algum perfil recebe rating alto por
produzir ou por ser excessivamente recompensado por sobreviver.

Medir por role e perfil numérico:

- KPR, DPR, ADR, KAST e rating;
- frequência de sobrevivência;
- relação produção/sobrevivência;
- impacto em vitória e derrota;
- CT e TR separados;
- adversários fortes e fracos;
- contribuição dos componentes disponíveis do rating final;
- distribuição, não apenas média.

Não usar jogadores citados pelo responsável como alvo de regra. Eles servem
somente como casos de reprodução e leitura humana.

Aceitação:

- relatório determina se o viés existe, onde nasce e quais perfis afeta;
- conclusão distingue problema do simulador, problema do rating e simples
  consequência da composição/confronto;
- nenhuma mudança de balanceamento no commit da auditoria.

Achados do gate:

- AWPer não possui comportamento de save distintivo no modelo atual;
- chance de morte trocada e crédito de KAST são praticamente iguais entre roles;
- IGL primário não é grupo de combate homogêneo e deve ser estratificado pelo
  papel secundário;
- rounds eco existem; sua ausência não explica o ADR observado;
- qualquer R5 precisa definir alvos antes/depois sem condições por jogador.

### Etapa R5 — balanceamento condicional

Só executar se R4 comprovar um problema material.

**Status em 23/07/2026:** R5.0–R5.1 e R5.2 concluídas. O
manifesto congelado está em `docs/r5-experiment.json` e a arquitetura completa
em `docs/r5-plan.md`. A captura de desenvolvimento cobre 1.088 mapas e 10.880
player-maps; baseline contra baseline deve produzir deltas e IC95% exatamente
zero antes de qualquer candidato. R5.2 removeu isoladamente os pisos/tetos duros
de forma e rating, sem novo ponto de RNG e sem tuning tático; a evidência está em
`docs/r5-tail-balance-2026-07-23.md`. O responsável decidiu que o corpus IFCS de
800 mapas não será pré-requisito deste ciclo; certificação oficial permanece
futura e nenhuma faixa por role será inventada. R5.4 foi concluída por paridade
exata e R5.5 ativou a função secundária já classificada dos IGLs sem criar pesos.
Evidências em `docs/r5-structural-extraction-2026-07-23.md` e
`docs/r5-effective-role-balance-2026-07-23.md`. A etapa de exposição da R5.6
também foi concluída: contato agora depende de atributos, função efetiva, lado
e fase, com evidência em `docs/r5-exposure-balance-2026-07-23.md`. O candidato
separado de save também foi concluído, zero-centrado e sem alegar inventário;
evidência em `docs/r5-save-balance-2026-07-23.md`. R5.7a concluiu a oportunidade
contextual de trade sem inflar a taxa global; detalhes em
`docs/r5-trade-balance-2026-07-23.md`. R5.7b concluiu a assistência contextual
por utilidade disponível, com APR global estável e separação maior dos
facilitadores; detalhes em `docs/r5-assist-balance-2026-07-23.md`. R5.8, a
decomposição do rating após os eventos, também foi concluída. O prior atual já
estava no ótimo de calibração e o candidato piorou a validação, portanto nenhum
peso foi alterado; detalhes em `docs/r5-rating-audit-2026-07-23.md`. R6 é a
próxima etapa.

Regras:

- um commit exclusivo de balanceamento;
- nenhuma condição por nome, ID, time ou época;
- alterar uma família de parâmetros por vez;
- usar as mesmas seeds e agenda antes/depois;
- preservar consumo de RNG sempre que possível;
- medir todos os 85 jogadores, roles, caudas e métricas macro;
- não corrigir AWPer degradando riflers, supports ou IGLs;
- não melhorar médias escondendo erro nas caudas.

Aceitação:

- melhora do problema-alvo com efeito geral explicável;
- correlação, MAE, inclinação, erro máximo, ranking e caudas aprovados;
- métricas de rounds, economia, lados, objetivos e clutches preservadas;
- comparação estatística documentada antes de atualizar qualquer golden.

### Etapa R6 — validação e publicação do balanceamento

**Concluída em 23 de julho de 2026.** A comparação acumulada preservou as
métricas globais e confirmou mudanças direcionais por função efetiva. A
validação integral passou em 19/19 suítes, 45.900 mapas e 938.511 rounds. O
fechamento e os limites remanescentes estão em
`docs/r6-closure-2026-07-23.md`.

Atualização posterior: o commit de dados `f731b3a`, de 24 de julho, alterou seis
jogadores por overrides do editor do sandbox e produziu uma nova execução de
referência, com 45.900 mapas e 937.856 rounds. Os 19 gates continuam verdes.

**Proveniência registrada em 28/07/2026** — `docs/dados-era-rating-1-0.md`. Cinco
dos seis jogadores são da EnVyUs de 2015, era **Rating 1.0**, que não publica
KAST, ADR nem impacto: cinco dos sete atributos do motor não são deriváveis
daquela métrica. Os valores foram estimados por julgamento do responsável, pela
mesma prática já registrada no bloco da Virtus.pro, e agora estão marcados como
juízo no próprio dado. O sexto jogador é da era Rating 2.0 e precisou de um único
ajuste — a distribuição do esforço corrobora o motivo. O export JSON original não
existe mais e não é recuperável; o diff exato está permanente no git.

Fica aberta a guarda estrutural: o campo `rating` é **gabarito**, não atributo, e
o editor do sandbox o trata como mais um campo editável. Separá-lo numa fonte
própria com `fonte` por jogador é pré-requisito honesto de qualquer nota IFCS.

1. executar os goldens antigos e explicar cada diferença;
2. executar a comparação pareada antes/depois;
3. revisar maiores beneficiados, prejudicados e inversões de ranking;
4. testar confrontos equilibrados e muito desequilibrados;
5. testar lados invertidos;
6. rodar `npm run validate` sem reduzir amostra ou limites;
7. atualizar golden somente quando a mudança for intencional e explicada;
8. atualizar documentação no mesmo ciclo;
9. manter commits de teste, balanceamento e documentação com responsabilidades
   distinguíveis;
10. push e deploy somente com autorização explícita.

## 7. Etapas posteriores de profissionalização

### P1 — laboratório como ferramenta de investigação

Depois de R1–R3, aprofundar explicações estatísticas, navegação por teclado,
leitores de tela e, se houver demanda, formatos adicionais de exportação, sem
ocultar jogadores. Busca, filtros nas duas funções, comparação, CSV de
desempenho, escala comum, legenda completa e ajuda recolhível das distribuições
já foram entregues em R2.

### P2 — modularização por paridade

- aceitar ou revisar ADRs 0002 e 0004;
- extrair primeiro APIs puras de avaliação;
- depois química, RNG, simulação e rating em etapas separadas;
- manter adapter legado enquanto sandbox, Node e worker migram;
- remover `new Function` e recortes de `<script>` somente após consumidores
  usarem a mesma API pública;
- nenhuma refatoração pode alterar resultados aprovados por seed.

### P3 — otimização medida

- criar benchmark de desempenho separado do realismo;
- medir antes de otimizar;
- evitar reconstrução repetida de times e agregações;
- avaliar worker para lotes grandes;
- manter a página responsiva com 85 jogadores;
- provar paridade de outputs e RNG.

### P4 — responsividade e acessibilidade

- tabela longa utilizável em desktop e celular;
- cabeçalhos, foco, teclado, contraste e leitores de tela;
- ausência de overflow horizontal;
- respeito a `prefers-reduced-motion`;
- screenshots e E2E responsivos.

### P5 — corpus profissional e nota IFCS

- completar no mínimo 800 mapas e 6 eventos conforme o alvo congelado;
- auditar proveniência, hashes e extração;
- preservar splits de calibração, validação e holdout;
- não usar holdout para tuning;
- calcular cobertura e intervalo de confiança;
- reproduzir a execução;
- só então publicar a primeira nota IFCS oficial.

O diagnóstico técnico de 96/100 continua rotulado como `not-ifcs`.

### P6 — Carreira de Jogador

Somente após uma API estável de avaliação, contrato de RNG e save versionado:

- fechar decisões abertas e escrever ADR 0005;
- definir schema e migrações;
- criar jogador a partir de atributos crus;
- recalcular derivados pelos mesmos motores;
- entregar primeiro criador + save;
- depois temporada curta, treino e histórico;
- manter progressão separada do balanceamento do combate.

## 8. Ordem prática aprovada

1. R1 — auditoria individual aprofundada;
2. R2 — variância individual no sandbox;
3. R3 — contrato e modo campanha;
4. R4 — auditoria específica de AWPer/sobrevivência;
5. R5/R6 — balancear apenas se houver evidência e validar integralmente;
6. P1 — usabilidade completa do laboratório;
7. P2 — modularização por paridade;
8. P3/P4 — otimização e acessibilidade;
9. P5 — corpus e nota IFCS oficial;
10. P6 — preparação e implementação incremental da carreira.

## 9. Próxima ação concreta ao retomar

R1 e R2 estão concluídas e R3 começou pela MD3 isolada. A próxima fatia
funcional é **distribuição entre muitas campanhas MD3**. Na trilha estrutural P2,
`rolePairReality`, `secondaryScore` e
`roleStyleReality` já foram extraídas por paridade; a próxima fronteira pura do
PRISMA deve ser caracterizada antes de qualquer nova extração. Não misturar R3 e
P2 na mesma mudança.

Primeiro passo operacional:

1. confirmar `sandbox-test`, `git status` e sincronização com o remoto;
2. rodar `npm ci` e `npm run check`;
3. ler `AGENTS.md`, `docs/project-context.md`, `docs/architecture.md`,
   `docs/testing.md`, `docs/glossary.md` e este documento;
4. escolher explicitamente entre a trilha funcional R3 e a trilha estrutural P2;
5. preservar a baseline e apresentar evidência antes de congelar novos asserts;
6. não tocar em `CFG_*`, receitas, pesos, thresholds atuais ou RNG incidentalmente.

## 10. Decisões ainda abertas

- eventual evolução da MD3 isolada para uma temporada curta;
- métricas individuais que aparecerão por padrão ou em detalhes;
- necessidade futura de exportação JSON além do CSV já entregue;
- thresholds de cauda e ranking, que dependem da baseline de R1;
- necessidade de novo balanceamento de sobrevivência, dependente da auditoria R4;
- todas as decisões de produto da Carreira listadas em
  `docs/project-context.md`.

## 10-bis. Backlog declarado pelo responsável (28/07/2026)

Itens citados como **"para DEPOIS"** — registrados aqui para não se perderem entre sessões.
O escopo de cada um **ainda não foi definido**; não presuma o que significam nem comece por
eles sem conversar com o responsável.

- **Reformulação de roles e playstyles.** Mexe no coração da classificação (`ROLE_PERFIL`,
  `NM_DEF`, `STYLE_CONTRA`, `roleStyleReality`) e, portanto, no snapshot dos 85 jogadores e em
  todas as assinaturas de `bancada/perfis.js`. É a mudança de maior alcance já cogitada:
  qualquer versão dela é balanceamento estrutural, com comparação pareada e commit próprio.
- **Estilo das cartas** (apresentação visual dos jogadores). Camada de interface; não deve
  tocar motor, avaliação nem RNG.
- ~~Utilidade como recurso do round.~~ **ENTREGUE em 28/07/2026** —
  `docs/utilitaria-2026-07-28.md`. Com ela, **o escopo original da simulação está fechado**.

Estado da simulação em 28/07/2026, para calibrar a urgência: **nenhum critério em relatório**.
As quatro etapas do ratchet de `perfis.js` estão ativas, e `npm run validate` fecha 24/24 —
12/12 macro, 6/6 forma, 15/15 assinatura individual e 4/4 dificuldade. Nada acima é conserto;
tudo é evolução deliberada.

## 10-ter. Ideias medidas e ENCERRADAS (28/07/2026)

Registradas para não voltarem como se fossem novas.

- **Memória de série** (o mapa 2 reagir ao que aconteceu no mapa 1). Medida antes de virar
  mecânica, com `bancada/serie.js`. O formato MD3 sozinho já dá 75% ao vencedor do mapa 1 — ele
  precisa de 1 dos 2 seguintes, o outro precisa dos 2. O jogo entrega **79,2%** em confrontos
  equilibrados e **81,9%** no geral, com gradiente correto por diferença de força (79% → 85%).
  Ou seja: **a persistência já existe**, e vem da forma de campanha, que é sorteada uma vez e
  vale a run inteira. Sem lacuna medida e sem fonte publicada para o número real, nenhuma faixa
  foi criada e nenhuma mecânica entrou.
- **Force contra um inimigo quebrado** (regra irmã da leitura de compra). Instrumentada: disparou
  **zero vez em 62 mil rounds**. É quase impossível numa economia de soma zero — deduz-se que o
  inimigo está quebrado porque ele perdeu o round anterior, mas se ele perdeu, eu ganhei, recebi
  o prêmio e não estou de eco. O caso real que ela queria capturar já é coberto pela escada de
  derrota. O achado está escrito em `decidirCompra`.

## 11. Regra de parada

Se uma etapa revelar que o problema presumido não existe, registrar a evidência
e não criar uma correção. O objetivo é fidelidade mensurável, não produzir uma
mudança a qualquer custo.
