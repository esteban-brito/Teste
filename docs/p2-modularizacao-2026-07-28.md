# P2 — modularização por paridade: estado e retomada (28/07/2026)

> **Leia este arquivo antes de continuar o P2.** Ele é o ponto de retomada do ciclo
> de modularização e registra o que já saiu, o que falta, os contratos descobertos
> e as armadilhas que já custaram tempo.

## 1. Por que este ciclo existe

O responsável observou que o projeto "estava uma bagunça" porque um agente demorou
a achar dados que existiam. O diagnóstico estava **parcialmente errado**, e a parte
errada importa: o agente afirmou três vezes que dados existentes não existiam —
`time`, `campeonato+ano` e `país completo` — e os três estavam em `TIMES_DEF` e no
mapa de países.

O padrão do erro foi sempre o mesmo: procurar **num arquivo** o que era pergunta
sobre **o projeto**, chutar o nome do campo (`campeonato`, quando é `camp`) e tratar
"não achei" como "não existe". Pior: `docs/architecture.md` §Dados e identidade
documenta literalmente a regra que o agente quebrou a cabeça para deduzir.

O repositório, na verdade, está acima da média. Mas existe dívida real: `game.js`
com 3036 linhas usando um comentário (`// === UI START ===`) como fronteira de API,
nove consumidores fatiando esse texto com `new Function`/`vm`, e a lista de exports
do motor duplicada em três arquivos.

O destino já estava decidido nas ADRs **0002**, **0004** e **0005** e sequenciado em
`docs/next-steps.md` §7 como **P2**. Este ciclo executa isso.

## 2. Estado em 28/07/2026

| fase | escopo | estado |
|---|---|---|
| 0 | catálogo executável de dados | **concluída** |
| 1 | normalizar país (`camp` adiado) | **concluída** |
| 2 | PRISMA · ZÊNITE (avaliação) | **concluída** — 5 módulos |
| 3 | SINAPSE (química) | **concluída** — 1 módulo |
| 4 | simulação, economia, rating | **concluída** — 6 de 6 fatias |
| 5 | API pública de avaliação + 3 consumidores Node | **concluída** |
| 6 | API pública de simulação, worker e sandbox | **em andamento** — RNG e preparação extraídos |
| 7 | entrypoint do jogo + adapter Node, fim da duplicação | pendente |

`npm run check` saiu de **19 para 35 checadores**. `npm run validate` fecha 24/24.
O motor executável de `game.js`, `roster-snapshot.json`, `simulation-golden.json` e
`campaign-golden.json` seguem **intocados** — extração não muda resultado.

### Módulos extraídos neste ciclo

```text
src/data/catalog.mjs                          índice de todo dado do projeto
src/domain/evaluation/role-affinity.mjs       roleAfinidade, afinidades, tabelas
src/domain/evaluation/role-classification.mjs classificar, roleSecundarioSeguro
src/domain/evaluation/style-score.mjs         styleScoreTable, styleMatch, receitas
src/domain/evaluation/player-evaluation.mjs   nmOVR, ovrUnificado, avaliarJogador
src/domain/evaluation/role-distribution.mjs   distribuirRoles (passe de time)
src/domain/chemistry/team-chemistry.mjs       química, forcaTime, treinador
src/domain/simulation/player-form.mjs         MARÉ: formaDoDia, forma de campanha
src/domain/simulation/team-form.mjs           MARÉ: forcaDoDia e consistência do time
src/domain/simulation/duel-weights.mjs        skillDuelo, fragPeso
src/domain/simulation/random-source.mjs       Mulberry32 isolado por sessão
src/domain/simulation/team-preparation.mjs    mapa, lado e vetores de entrada do combate
src/domain/simulation/economy.mjs             COFRE: decisão, carrego, drop e pagamento
src/domain/simulation/map-simulation.mjs      PÓLVORA: mapa completo round a round
src/domain/simulation/series-simulation.mjs   PÓLVORA: série sem repetição de mapas
src/public/evaluation-api.mjs                 composição pública de dados + avaliação
```

## 3. Contratos descobertos — leia antes de tocar no bloco

Coisas que **não são estilo** e que uma "limpeza" quebraria em silêncio:

1. **`aplicarAvaliacaoContextual` MUTA a entrada** e devolve o mesmo objeto.
   `estrela` deriva do OVR, que só existe naquele ponto; calculá-la antes devolvia
   sempre `false` e apagava toda a penalidade de ego da química. O checador **prova
   a mutação**, não a proíbe.
2. **`distribuirRoles` também muta**, em contexto de time. Por isso comparar a
   classificação individual contra `POOL.role1` acusa divergência onde há só
   contexto — foi o que fez um checador reprovar 6 jogadores sem motivo.
3. **A ordem de `ROLES_COMBATE` e de `PLAYSTYLE_IDS` desempata score igual**,
   porque `sort` é estável. É contrato (`architecture.md` §Pontos de atenção).
4. **Baiter e Coringa não passam pela competição normal de estilos.** Baiter não é
   receita, é diagnóstico de baixo impacto; IGL nunca é Baiter.
5. **Não existe bônus aditivo na química.** Um time perfeito chega a 100% por não
   ter penalidade. Toda característica de treinador é mitigadora.
6. **Comando é estrutural**: firepower alto recupera química ruim até um teto, mas
   não compra um caller.

## 4. A decisão de design que governa o resto

**Tabelas e geradores entram por PARÂMETRO, não como constantes espelhadas.**

Os módulos extraídos antes deste ciclo (`style-identity`, `exposure-profile`) copiam
os números do CFG para dentro do módulo. Isso é errado para tudo que o calibrador
muta: `ROLE_PERFIL`, `ROLE_CONTRA`, `IGL_ROLE_AFIN`, `ROLE_RULES`, `NM_DEF` e
`STYLE_CONTRA` são exatamente o que `calibrador-loader.js` expõe para ser mutado.
Uma cópia congelada divergiria da tabela calibrada **em silêncio**.

Os checadores destes módulos **calibram as tabelas de propósito** e verificam que
módulo e motor continuam idênticos, restaurando no `finally`.

O mesmo vale para o RNG, e ali é ainda mais crítico — ver §5.

## 5. Como se prova consumo de azar (mecanismo da Fase 4)

A partir da Fase 4 o contrato não é só o valor: é **quantas vezes** e **em que
ordem** o RNG é chamado. Uma chamada a mais desloca todos os 45.900 mapas seguintes.

O RNG é `mulberry32` com estado global: `srand(s)` fixa a semente, cada `rndF()`
avança o estado. O mecanismo:

```text
srand(SEMENTE); roda o LEGADO;  guarda rndF()   ← estado após o legado
srand(SEMENTE); roda o MÓDULO;  guarda rndF()   ← estado após o módulo
os dois valores têm de ser IGUAIS
```

Se batem, os dois consumiram exatamente a mesma quantidade de azar. **Isso só
funciona porque o módulo recebe o gerador por parâmetro** — os dois caminhos
compartilham o mesmo `gaussF`, então não há dois estados para sincronizar.

Está aplicado e verde em `tools/check-player-form-parity.js`.
`tools/check-team-form-parity.js` aplica a mesma prova à amostra uniforme de
`forcaDoDia` e também exige exatamente uma chamada ao gerador por avaliação.
`tools/check-economy-parity.js` cobre os caminhos determinísticos e o force
ocasional de `decidirCompra`, compara a próxima amostra do RNG e ainda prova a
mutação das carteiras por `pagarCompra`.
`tools/check-map-simulation-parity.js` compara o resultado completo de mapas
normais, OT repetido, telemetria, modo leve e mapa sorteado, além da próxima
amostra do RNG e de uma chamada a `combateRound` por round.
`tools/check-series-simulation-parity.js` compara séries MD1, MD3 e MD5 completas,
identidade do vencedor, mapas únicos, próxima amostra do RNG e ordem das chamadas.
`tools/check-team-preparation-parity.js` cobre os 17 times nos 8 mapas e entradas
incompletas, compara inclusive os caches `_mapBase`/`_lado` e exige o mesmo estado
do RNG depois das cinco formas individuais.

## 6. Próximo passo concreto

Continuar a **Fase 6** pela fronteira de combate (`combateRound`), último motor que
ainda impede a composição da API pública de simulação. RNG e preparação já têm
paridade exata; depois do combate, compor a API e migrar worker e sandbox.

Correção de classificação: `tools/check-engine-exports.js` e
`tools/check-sandbox-engine.js` não são consumidores a migrar; são guardas do
caminho legado e só podem ser retiradas quando sandbox/worker deixarem de recortar
`game.js`. `bancada/motor.js` é o adapter de compatibilidade das suítes clássicas e
fica para a Fase 7, depois de preparação e combate terem composição pública.

## 7. Armadilhas que já custaram tempo

- **Arrays entre realms.** O motor legado roda em `vm`, então seus arrays e objetos
  têm outro `prototype` e `assert.deepStrictEqual` reprova mesmo com conteúdo
  idêntico. Todo checador precisa normalizar com
  `plain=v=>JSON.parse(JSON.stringify(v))` antes de comparar.
- **`bancada/motor.js` tem uma lista de EXPORTS.** Um nome que não estiver lá volta
  `undefined` no checador e o erro aparece como `"undefined" is not valid JSON`.
- **PowerShell come aspas** em `node -e` com strings aninhadas. Para script com
  aspas, escreva um arquivo no scratchpad e rode `node arquivo.js`.
- **Não comparar contra `POOL`** para checar classificação individual: o `POOL` já
  passou por `distribuirRoles`.

## 8. Escopo reduzido conscientemente

A divisão de `camp` em `evento`+`ano` **não foi feita**, e o motivo está registrado
em `src/data/catalog.mjs`: a justificativa original ("todo consumidor quebra com
regex") era **falsa**. Nenhum dos 9 consumidores separa os dois hoje — todos exibem
a string inteira. Dividir custaria 17 registros × 3 fontes + 9 pontos de UI que a
Fase 7 reescreve, por zero consumidor atual. Fazer quando houver um consumidor real,
com a UI já modularizada.

## 9. Fora do P2, mas pendente

- **Cartas.** Design aprovado e documentado em **`docs/cartas-design-2026-07-28.md`**;
  o artefato é `prototipo-cartas.html`. **Não ligar ao jogo antes do P2 terminar** —
  decisão do responsável, para não fazer o trabalho duas vezes.

### A ordem de longo prazo

**P2 → cartas ligadas ao jogo → P6 (Modo Carreira).** A ordem não é arbitrária: o P6
está bloqueado em `docs/next-steps.md` por *"somente após uma API estável de avaliação,
contrato de RNG e save versionado"* — o P2 é literalmente o pré-requisito do Carreira,
e as cartas vêm antes dele por serem a camada que o jogador toca.
- **Fotos de jogador não existem** e não há campo para elas. É a única lacuna de
  dados real que a varredura confirmou.
- **Faixa de dificuldade em revisão.** O invicto do elenco draftado está em 3,8%,
  abaixo do piso de 4%. O gate está rebaixado a relatório com o motivo escrito em
  `bancada/dificuldade.js`. É conversa pendente com o responsável, com o número
  medido na mão.
