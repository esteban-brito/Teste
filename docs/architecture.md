# Arquitetura

## Estado atual

O draft9-0 é uma aplicação estática, sem backend e sem dependências de runtime.
`index.html` carrega `style.css` e `game.js` como módulo ES. `game.js` contém
somente aplicação, estado, renderização, eventos e fluxo do jogo; dados,
avaliação, química, simulação e narrativa entram por
`src/public/simulation-api.mjs`.

Jogo, sandbox, worker do calibrador e bancada Node consomem a mesma composição
pública. `bancada/lib/motor.js` é apenas uma ponte CommonJS que cria estado avaliado
e sessão de RNG novos por carga; não lê nem avalia texto de `game.js`.

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
`series-simulation.mjs` fecha séries sem repetir mapas. O entrypoint, o sandbox,
o worker e a bancada já usam módulos públicos; não existe mais bloco de domínio
duplicado em `game.js`. Essas fronteiras não autorizam balanceamento implícito.

`src/domain/narrative/game-memory.mjs` deriva marcos, recordes e textos da saída
do simulador sem DOM, relógio ou RNG. O adaptador
`src/infrastructure/persistence/progress-store.mjs` guarda o resultado versionado,
importa e exporta backup sem levar APIs do navegador para o domínio.

Os renderizadores puros vivem em `src/ui/game/`: cartas, selos de química,
identidade de times, Suíça/playoffs, placar/antessala e histórico/final de
campanha. Eles produzem strings sem acessar DOM ou estado global e usam o escape
central de `src/ui/shared/html.mjs`; `game.js` conserva apenas a aplicação dessas
views aos elementos e a coordenação do fluxo.

A carta de jogador possui uma única anatomia executável em
`src/ui/game/card-view.mjs` + `style.css`; `prototipo-cartas.html` é somente uma
bancada de QA para esse mesmo componente. O campo cru opcional `foto` carrega um
asset-id, projetado pela API pública sem interpretação esportiva. O recorte não é
configurável no runtime: assets em `fotos/` já chegam normalizados em 5:7 e seguem
o contrato de `docs/card-portraits.md`. Nick e bandeira compartilham o primeiro
eixo da frente; função principal e contexto ocupam linhas próprias. No verso,
quatro stats derivados usam a largura integral e o rodapé preserva a era. Esses
eixos são contrato do componente, não configuração individual. Isso mantém dado
factual, preparação de asset e layout em fronteiras distintas.

Desde 01/08/2026 a frente do **treinador não tem template próprio**: `coachFront`
chama `frenteHtml`, a mesma grade do jogador, trocando apenas os campos. É uma
fronteira, não uma economia de linhas — enquanto existiam dois templates, um
refino da frente do jogador precisava ser reimplementado no treinador para não
divergir, e foi assim que o nome do time parou no meio da carta com a guarda
verde. Treinador continua sendo outra categoria **visual**, nunca uma segunda
infraestrutura de carta.

Desde 04/08/2026 existe `src/domain/tactics/`, a camada de DECISÃO. Ela é o único
lugar do domínio autorizado a responder "que time é este, o que ele acredita e o
que ele quer fazer"; o combate continua sem opinião própria.

- `team-identity.mjs` deriva cinco eixos do elenco — ritmo, estrutura,
  utilitária, leitura e dependência — zero-centrados contra a liga;
- `opponent-model.mjs` guarda a crença sobre o adversário como frequência que
  decai, **por lado**, com a confiança saindo do tamanho efetivo da amostra e da
  nitidez da distribuição. Quem mistura de verdade não é lido, e quem muda de
  padrão é seguido em poucos rounds.

- `play-style.mjs` deriva o REPERTÓRIO do elenco: seis tipos de jogada com
  afinidade tirada dos atributos, a `assinatura` (o quanto o time tem jogada
  preferida) e a `vantagem` de cada jogada **autocentrada no próprio time**.
  Ele exporta a DISTRIBUIÇÃO, não o escore — um peso de sorteio não pode ser
  somado a `openEdgeA` por descuido, um escore pode;
- `round-plan.mjs` é o único módulo autorizado a sortear: escolher sob incerteza
  é a decisão em si.

**Nada na camada pode ser escrito por time, nick ou era**, e só a decisão de
round consome aleatoriedade, com fluxo de RNG próprio derivado do seed da sessão.
`tools/check-tactics-layer.js` prova isso por dois lados, varrendo o código de
cada módulo em busca de nome e exigindo que trocar todos os nicks não mova nenhum
eixo.

**Desde 05/08/2026 a camada está LIGADA** (`CFG_TATICA.ATIVA:1`), e o checador
exige que continue — desligar também é balanceamento. `map-simulation.mjs` não
importa a camada: recebe `deps.tactics` por injeção e a consome atrás da chave.

A guarda cobra ainda que só `assinatura` e `vantagem` atravessem a fronteira para
o motor. `forma` fica dentro do módulo porque **carrega força** (r = 0,78 com
força efetiva): usá-la como bônus pagaria talento duas vezes. Detalhe e medição
em `docs/ciclos/tatica-tipo-de-jogada-2026-08-05.md`.

`random-source.mjs` encapsula o Mulberry32 em instâncias independentes, preservando
as sequências uniforme e gaussiana bit a bit. A composição pública possui uma
instância por sessão e a passa explicitamente aos motores.

A primeira composição pública vive em `src/public/evaluation-api.mjs`. Ela monta
`POOL` e `TEAMS` a partir dos dados crus e dos módulos PRISMA, ZÊNITE e SINAPSE,
preserva a referência compartilhada dos jogadores distribuídos e oferece uma
visão única das configurações calibráveis. Os três consumidores Node de avaliação
(`tools/verify-report.js`, harness de workers e loader do calibrador) já usam essa
API sem recortar `game.js`. `src/public/simulation-api.mjs` compõe sobre ela uma
sessão isolada de RNG e conecta preparação, combate, economia, mapa, série e rating
a uma única configuração mutável. Jogo, sandbox, worker real e bancada usam essa
composição. A ponte CommonJS da bancada preserva o contrato histórico de estado
novo por carga sem reintroduzir recorte de fonte.

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
- `src/application/audio.mjs`: contexto Web Audio e preferência de mute, expostos
  por um singleton e uma factory sem dependência do estado esportivo.
- `src/application/card-face.mjs`: transição DOM de frente/verso que mantém classe,
  estado e árvore de acessibilidade sincronizados; as views continuam puras.
- `src/infrastructure/persistence/progress-store.mjs`: estado histórico versionado,
  localStorage e backup JSON, com factory verificável fora do navegador.
- `src/application/draft/draft-state.mjs`,
  `src/application/major/major-state.mjs` e
  `src/application/match/match-state.mjs`: criação/reset dos estados mutáveis
  com identidade e quirks preservados fora do entrypoint.
- `src/ui/game/`: templates puros do draft, torneio, partida e histórico, sem
  mutação de DOM ou estado.

As instâncias `S`, `TG`, `MP` e `MATCH` continuam compostas e mutadas pelos
controladores atuais no entrypoint, mas suas fábricas e resets já cruzaram a
fronteira de aplicação. O destino é manter estados de draft, torneio e partida
separados e tornar explícitos os efeitos de DOM e timers; áudio e persistência
também já estão isolados. A forma e a identidade desses objetos estão congeladas
em `docs/p5-aplicacao-ui-2026-07-29.md` e em `tools/check-game-state.js`.

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

## Próxima evolução arquitetural

R1–R3 e a modularização do domínio estão concluídos; a MD3 do laboratório usa os
mesmos motores e continua protegida por `bancada/golden/campaign-golden.json`. A primeira
extração de estado da aplicação também foi concluída; a sequência restante segue
a ordem exata do handoff P5.

1. ~~extrair criação/reset de `S`, `TG`, `MP` e `MATCH`~~ — concluído com guarda
   de shape, identidade e quirks;
2. mover controlador de draft/roleta em commit separado;
3. mover controlador do Major;
4. mover série/reprodução, preservando timers, callbacks e consumo de RNG;
5. deixar `game.js` como composição e wiring fino;
6. somente depois iniciar a fatia vertical da Carreira sobre um schema próprio.

A biblioteca de retratos pode avançar em paralelo porque atravessa apenas a
fronteira asset-id → asset normalizado → componente canônico. O corpus IFCS também
é uma trilha paralela e offline. Nenhuma das duas justifica misturar estado,
simulação ou balanceamento no mesmo commit. O mapa geral de prioridade está em
`docs/retomada-2026-08-05.md`.
