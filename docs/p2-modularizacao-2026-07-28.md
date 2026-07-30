# P2 — modularização por paridade: estado e retomada (28/07/2026)

> **Leia este arquivo antes de alterar os módulos extraídos.** Ele é o relatório
> final do ciclo P2 e registra o que saiu, como a paridade foi provada, os contratos
> descobertos e as armadilhas que já custaram tempo.
>
> **Recorte temporal:** as pendências da seção 9 descrevem o fechamento do P2.
> O estado operacional posterior está em `docs/project-context.md`, no handoff do
> P5 e na seção 12 do documento de cartas; não trate aquela lista histórica como
> fila atual.

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
| 6 | API pública de simulação, worker e sandbox | **concluída** |
| 7 | entrypoint do jogo + adapter Node, fim da duplicação | **concluída** |

Durante a migração, `npm run check` cresceu de **19 para 38 checadores** de
paridade. Depois da remoção da segunda implementação, os diferenciais transitórios
foram aposentados e o comando ficou com **10 guardas permanentes**; comparar o
módulo consigo mesmo não seria teste. As 24 suítes continuam no `validate`.

`game.js` caiu de 3.054 para 1.206 linhas e agora contém somente aplicação e UI.
`roster-snapshot.json`, `simulation-golden.json` e `campaign-golden.json` seguem
**intocados** — modularização não mudou resultado.

Validação final: `npm run validate` verde em **24/24 suítes** (168,3 s), com
amostras e limites integrais, sem atualizar snapshot ou golden.

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
src/domain/simulation/round-combat.mjs        relógio, duelos, objetivo, save e stats do round
src/domain/simulation/simulation-telemetry.mjs identidade observável sem efeito esportivo
src/domain/simulation/simulation-config.mjs   configuração única de simulação, mapa e rating
src/domain/simulation/economy.mjs             COFRE: decisão, carrego, drop e pagamento
src/domain/simulation/map-simulation.mjs      PÓLVORA: mapa completo round a round
src/domain/simulation/series-simulation.mjs   PÓLVORA: série sem repetição de mapas
src/domain/narrative/game-memory.mjs          marcos, recordes e narrativa sem RNG
src/public/evaluation-api.mjs                 composição pública de dados + avaliação
src/public/simulation-api.mjs                 composição por sessão de todos os motores
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

Esse mecanismo foi aplicado durante a migração a forma individual e coletiva,
economia, preparação, combate, mapa e série. A última execução diferencial verde
cobriu 37 mapas, 4 séries, 128 rounds sequenciais, 17 times × 8 mapas e a próxima
amostra do RNG em cada fronteira.

Depois que todos os consumidores migraram, esses checadores foram removidos junto
com a referência antiga: sem duas implementações eles seriam tautológicos. A
proteção permanente ficou em `tools/check-random-source-contract.js` (vetores
Mulberry32 congelados), `tools/check-public-simulation-api.js` (determinismo e
sessões isoladas), goldens completos, regressões, benchmarks e E2E.

## 6. Encerramento e próximo passo

O ciclo P2 está concluído. `tools/check-game-entrypoint.js` impede o retorno do
marcador e do domínio embutido; `tools/check-sandbox-engine.js` impede que sandbox
ou worker voltem a recortar `game.js`; `bancada/motor.js` compõe a API pública com
estado e RNG novos por carga.

O próximo trabalho estrutural não é outra extração do simulador. É uma decisão de
produto/arquitetura separada: decompor os 1.206 trechos restantes de aplicação,
estado, áudio e DOM em módulos menores, sempre sem misturar balanceamento.

## 7. Armadilhas que já custaram tempo

- **Arrays entre realms (histórico).** O motor legado rodava em `vm`, então seus
  arrays e objetos tinham outro `prototype`. Isso exigiu normalização JSON durante
  a prova; a causa desapareceu com a retirada do loader.
- **Lista manual de exports (histórico).** O adapter antigo omitia contratos em
  silêncio. A ponte atual consome diretamente a API pública e não mantém lista.
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

## 9. Fora do P2 no fechamento do ciclo

- **Cartas.** No fechamento, o design aprovado vivia em
  **`docs/cartas-design-2026-07-28.md`** e `prototipo-cartas.html`, aguardando o
  fim do P2. Essa condição já foi cumprida: o Tactical Editorial foi publicado;
  uma proposta posterior permanece ativa apenas no laboratório (§12).

### A ordem de longo prazo

**P2 → cartas ligadas ao jogo → Carreira.** Essa era a ordem de dependência: API
estável de avaliação, contrato de RNG e save versionado antes da Carreira. P2 e
o primeiro design publicado de cartas já foram entregues; a Carreira continua
posterior e ainda exige estado/save próprios e decisões de produto.
- **Fotos no dado cru ainda não existem.** O laboratório possui um único ativo
  independente (`fotos/donk_kato24.webp`), mas jogadores e treinadores não têm
  campo de retrato em `src/data`.
- **Faixa de dificuldade em revisão.** O invicto do elenco draftado está em 3,8%,
  abaixo do piso de 4%. O gate está rebaixado a relatório com o motivo escrito em
  `bancada/dificuldade.js`. É conversa pendente com o responsável, com o número
  medido na mão.
