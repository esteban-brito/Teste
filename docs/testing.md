# Estratégia de testes

## Princípio

Os testes protegem comportamento, não a organização interna. Uma extração de
módulo deve manter snapshots, seeds, métricas e contratos públicos. Alteração de
limite estatístico exige justificativa de balanceamento separada.

A futura nota consolidada de realismo segue o IFCS definido em
`docs/realism-methodology.md`. Até o corpus real auditado ser implementado, as
faixas atuais são guardas de regressão, não uma nota de 0–100.

## Grupos atuais

| Comando | Suítes | Finalidade |
|---|---|---|
| `npm run test:data` | `times.js` | integridade de jogadores, times e derivados |
| `npm run test:regression` | auditoria, snapshot, drop, golden, comparador R5, varredura e abertura | classificação, invariantes, resultados completos, pareamento e peso do sorteio de abertura |
| `npm run test:calibrator` | basic, heavy, worker | busca, intenção, custo e paralelismo |
| `npm run test:benchmark` | realismo, assists, KDA, rating, perfis, dificuldade | fidelidade estatística dos motores, coerência de carta e dificuldade da campanha |
| `npm run test:fidelity` | scorer e corpus IFCS | matemática, cobertura, caps, proveniência e auditoria |
| `npm run test:e2e` | cards, intent, simulation, game flow, acessibilidade | cartas, calibrador, aba Simular, jogo principal e a travessia por teclado/leitor de tela nos três viewports |
| `npm run test:r5` | comparador pareado R5 | hashes, cobertura, delta nulo e detecção sintética |
| `npm run test:r5:tails` | guardas de cauda R5.2 | ratings extremos, forma positiva e ausência de massa nos limites antigos |
| `npm run test:all` | as 26 suítes acima | validação completa na ordem histórica |
| `npm run bench` | alias de `test:all` | compatibilidade com CI e fluxo legado |

`npm run validate` executa sintaxe, lint e as 26 suítes.

## Como a bancada está organizada

Desde 03/08/2026 os 42 arquivos deixaram de morar numa pasta plana:

```text
bancada/
├── run.js          roda a suíte por grupo; SUITE_GROUPS é a lista canônica
├── lib/            o que as suítes importam: motor, common, sweep,
│                   calibrador-loader e o par fidelity-score/fidelity-corpus
├── suites/         as 26 de SUITE_GROUPS, e só elas
├── golden/         roster-snapshot.json e os dois goldens de comparação
└── ferramentas/    bancadas de trabalho e geradores que NÃO entram no run
```

`ferramentas/` não é a lixeira. `classificacao.js` e `serie.js` se declaram no
cabeçalho como bancadas fora do `run.js`, de propósito, e a auditoria de órfãos de
31/07/2026 registrou isso por escrito. **Não estarem em `SUITE_GROUPS` não é
esquecimento** — não os remova por isso.

Duas dependências atravessam as pastas, e são informação, não defeito:
`suites/dificuldade.js` importa `ferramentas/campanha-major.js`, e
`ferramentas/r5-experiment.js` importa `suites/auditoria.js`, que exporta
`buildDeepAudit` além de rodar como suíte.

**Caminho não se calcula com `__dirname` mais uma contagem de `..`.**
`lib/common.js` exporta `ROOT` — achado subindo a árvore até o `package.json` — e
`GOLDEN`. Era a contagem fixa que fazia 16 caminhos em 12 arquivos dependerem da
profundidade de quem os calculava; trocá-la ANTES de mover foi o que permitiu que
a organização não virasse mudança de comportamento. As únicas exceções legítimas
são os seis `require("../../src/…")`, que saem da bancada e são resolvidos pelo
Node, não por nós.

`npm run lint` roda com `--max-warnings 0`. Até 01/08/2026 ele saía com código 0
mesmo emitindo avisos, e o CI executa exatamente esse script — então **todo aviso
era invisível nos dois lados**. Isso já custou meia guarda: reinlinar um reset de
estado em `game.js` deixa o import órfão, e o `no-unused-vars` resultante não
reprovava nada. O repositório estava em zero avisos quando a trava entrou, então
ela não escondeu dívida nenhuma. Regra: aviso novo se conserta ou se declara na
`varsIgnorePattern` de `eslint.config.mjs` com motivo — não se tolera calado.

## A suíte que olha o jogo, não os elementos dele (04/08/2026)

`bancada/suites/e2e-acessibilidade.js` nasceu de uma pergunta que nenhuma outra
suíte fazia: **o jogo reclama de alguma coisa enquanto roda, e alguém que não usa
mouse consegue jogar?**

As outras suítes provam que o elemento existe e que o fluxo avança. O
`e2e-game-flow` chega perto — coleta `pageerror` e console `error` —, mas filtra
de propósito `Failed to load resource` e `net::`, então **um 404 real passava
batido**, e ele não olha acessibilidade nenhuma.

O que ela cobre, em desktop (1440), tablet (760) e celular (390), em oito estados
do fluxo real: console `error`/`warning`, exceção não capturada, requisição falha,
HTTP≥400, documento sem `h1`, controle sem nome acessível, `img` sem `alt`, campo
sem rótulo, `id` duplicado, `tabindex` positivo, focável dentro de
`aria-hidden`, rótulo cujo controle o Tab não alcança, diálogo modal sem nome ou
com o foco fora dele, fundo ainda focável sob `aria-modal`, `overflow-x` e alvo
de toque menor que 24×24 (só onde há dedo).

**Os três viewports não são exagero.** `overflow-x` só aparece no estreito e alvo
de toque só existe no dedo — uma guarda só vê a superfície em que roda, a mesma
lição que deixou 135 cartas tortas por meses.

**Doze provas sintéticas** quebram o produto de propósito dentro da página e
exigem que o auditor acuse cada defeito, mais uma que exige o retorno ao verde.
Sem elas, um auditor sempre verde passaria por cobertura.

## A suíte que mede COMPOSIÇÃO, e não material (09/08/2026)

`bancada/suites/e2e-composicao.js` nasceu de um refino conduzido ao vivo, em que
o responsável apontou três defeitos que a `e2e-antessala` atravessou verde.
A diferença entre as duas é o eixo: aquela pergunta se o material está certo —
foto, contraste, distinção de mapa, sistema de vidro —, esta pergunta se as
coisas estão no LUGAR.

Os três defeitos que ela existe para não deixar voltar:

- **letra cortada.** `line-height:1.02` com o `overflow:hidden` que o
  `text-overflow:ellipsis` exige: a caixa de linha fica menor que a fonte e
  deceba o "p" e o "y". Só aparece em nome COM descendente — dependia do time
  sorteado;
- **3,8px de desvio** entre o centro do brasão e o do texto, no celular, nos
  dois lados e em direções opostas;
- **número escorregando para o meio do card**, porque em grid quem alinha na
  horizontal é `justify-items` e a folha usava `align-items`.

**Nenhum deles quebra nada**, e é por isso que a régua tem de ser geométrica: o
nó existe, tem conteúdo e é `visible`, então toda prova funcional passa (regra
48). A medida de centro usa `Range`, não a caixa do bloco — centrar caixa não é
centrar tinta (regra 35).

**Dois falsos positivos são ignorados por decisão declarada**: `.pm-fundo`
transborda porque as pontas da diagonal são desenhadas fora da tela, e no
celular as metades empilham. Sem essas duas exceções a guarda acusaria 13
defeitos que são o desenho — e guarda que acusa desenho é guarda que alguém
desliga.

**A prova sintética usa `text-indent`, não `padding`**, e a diferença importa: o
auditor DESCONTA o padding de propósito, porque recuo declarado é desenho. A
primeira versão da prova injetava padding e o auditor não acusava — parecia
guarda cega, e era prova mal escrita.

## A suíte que pergunta o que na folha ainda tem consumidor (09/08/2026)

`bancada/suites/css-orfaos.js` é a **fatia 0** do plano de organização: antes de
mexer em `style.css`, saber o que ali ainda é usado. Ela não infere por texto —
carrega o jogo no Chromium, atravessa a campanha inteira e coleta o DOM REAL.

**Por que executar em vez de casar strings.** Três tentativas anteriores morreram
casando identidade no código-fonte, e estão registradas no plano: `id="${id}"`
esconde `sideA`/`sideB`; `OVERLAYS.map($)` esconde os seis overlays; e afrouxar o
casador para salvar esses dois produziu **390 falsos** (`#Ataque`, `#UTF-8`).
Identidade gerada deixa de ser problema de casador quando ela é de fato gerada:
`fn-${slugFuncao(…)}` chega ao DOM resolvida.

**Dois detalhes de implementação que são a diferença entre funcionar e não:**

- o `MutationObserver` entra por `addInitScript`, **antes da primeira
  navegação**. `.pop`, `.fechando` e `.dragging` nascem e morrem no mesmo quadro,
  e uma varredura feita depois não os veria;
- o parser de CSS é uma pilha, não um regex. Comentário não é seletor — `.pm-mapa`
  saiu em 09/08 e continua citado em prosa (regra 71) — e `@media` contém regras
  enquanto `@keyframes` contém quadros, cujo prelúdio é `0%`/`from`.

**Quatro baldes, e só um é dívida.** VIVA (apareceu no DOM), NÃO VISITADA (não
apareceu, mas é literal numa fonte), GERADA (casa um prefixo concatenado real) e
ÓRFÃ. Sem o balde "não visitada", `is-champ` e `is-elim` — exclusivas entre si —
acusariam uma órfã a cada campanha.

**O percurso é um laço tolerante**, e não a travessia roteirizada da
`e2e-game-flow`: aquela precisa que o jogador VENÇA, e aqui vencer não importa,
importa VISITAR. Cada clique tem teto de 2,5 s e desiste em silêncio, porque
entre o `isVisible()` e o `click()` a tela avança sozinha — sem isso o Playwright
espera 30 s por um botão que já fechou, estourando longe da causa (regra 41).

**A cobertura oscila e as órfãs não.** A roleta do draft usa `Math.random` cru
por decisão de produto, então `srand` não fecha a variação: 298 a 310 classes
vistas em quatro execuções. O que oscila é diagnóstico; o que não oscila é
contrato. Rode a guarda duas vezes antes de travar qualquer número dela.

Uma dessas provas ensina algo sobre o próprio produto: injetar "foco fora do
modal" nos overlays reais **não funciona**, porque o `focusout` de `game.js`
devolve o foco antes de o auditor olhar. A prova usa um diálogo sintético, fora
da lista que aquele listener vigia. Guarda que se defende do teste sintético é
guarda funcionando — mas a prova precisa saber disso, senão parece quebrada.

`npm run check` inclui ainda `check-audio-module.js`, que usa um Web Audio falso
para provar inicialização, volume mestre, desbloqueio iOS, síntese, mute e
isolamento de instâncias sem depender de hardware ou de um navegador real.

`check-doc-measurements.js` prova o que `check-doc-links.js` não alcança:
**afirmação obsoleta**. O primeiro garante que uma referência aponta para arquivo
existente; o segundo garante que o número dito sobre ele ainda é verdade. Uma
tabela precedida de `<!-- medicao-verificada -->` vira asserção executável — mexer
no arquivo sem atualizar o número reprova o `check`. Foi criado depois que a §5 do
handoff do P5 passou dias dizendo "medição vigente" com três dos quatro números
errados. Prosa continua sem prova: número histórico ("caiu de 3.054 para 1.206 em
`4945d47`") fica na prosa porque descreve um commit; número sobre o **hoje** vai
para a tabela ou não é confiável.

`check-progress-store.js` cobre schema, fallback sem storage, save, importação,
download do backup e isolamento de instâncias com adaptadores falsos de navegador.

`check-game-view-modules.js` congela escaping, cartas, tiers, selos, identidade
dos times, Suíça, playoffs, placar, antessala, campanha final e Hall sem DOM.

`bancada/suites/e2e-cartas.js` é a guarda geométrica, visual e interativa da única carta
canônica. Mede 153 cartas reais e sintéticas em oito larguras e reprova estouro,
recorte, colisão, conteúdo frontal oculto, quantidade diferente de quatro stats
e qualquer variação tipográfica entre jogadores. Também prova as três densidades
de placa (24%/26%/28%), bandeira centrada com o nick e afastada do time, stats e
trilhos com largura integral, ocupação vertical mínima de 35% no verso, tamanhos
mínimos, contraste de pelo menos 4,5:1, ausência de halo, diagonais equivalentes,
eixos compartilhados, teclado, reduced motion, touch e o componente dentro do
jogo real.
O Donk é tanto a referência isolada quanto o molde visual usado pela escada de
raridade e pela matriz de funções; os casos reais continuam cobrindo os 85
jogadores sem alterar essa implementação.

Antes da geometria, o E2E carrega explicitamente `Chakra Petch 700` e exige uma
face disponível em `document.fonts`. `document.fonts.ready` sozinho não basta:
ele também resolve quando a fonte falha, caso em que a métrica do fallback pode
criar um falso estouro somente no Linux. O laboratório e o jogo fazem preload do
subset latino usado pelos nicks; uma falha futura informa a fonte antes de
atribuir o problema ao layout.

Mesmo com a face correta carregada, FreeType/Linux mediu `olofmeister` 1,25 px
mais largo que DirectWrite/Windows no limite de 120 px. A densidade compacta usa
tracking universal de `-0.025em` até 176 px e corpo universal
`clamp(12px, 10cqw, 27px)` até 150 px — nunca ajuste individual — para absorver
essa diferença depois que a bandeira passou a compartilhar o eixo do nick. A
grade ampla, a partir de 188 px, mantém `clamp(13px, 10.5cqw, 27px)`.

O retrato de referência é fotografado com o OVR escondido para amostrar o pixel
real mais claro da zona superior. Casos sintéticos provam que o medidor acusa
texto impossível, colisão, reticência deliberada, conteúdo oculto, stat ausente e
exceção de fonte, bandeira ausente e trilho encurtado; depois a medição precisa
voltar a zero. Não existe mais estado "publicado versus proposta" nem comparador
de enquadramento no laboratório.

Desde 05/08/2026 o E2E de cartas cobre também o **monograma do campo sem
retrato** (`.c-mono`), que até então não tinha guarda nenhuma — e por isso
acumulou três defeitos ao mesmo tempo: tinta +2,83 px à direita, 0,93 px acima e
tamanho aparente variando 1,88× entre `TI` e `SW`. As provas remedem
`cap-height` e o par mais largo do alfabeto **na fonte real**, então uma troca de
fonte reprova em vez de deslocar o desenho; provam que o avanço é uniforme, que o
texto está no eixo e que o `viewBox` É a caixa-alta. A sintética tira a
normalização e confirma que a medição volta a enxergar 1,75×.

Armadilha registrada: **`getBBox()` de `<text>` devolve a caixa EM no Chromium**,
não a tinta — altura fixa de 1,3em e topo em −41,49 para todos. A primeira versão
da guarda vertical media essa constante e reprovava sem defeito nenhum. Ela serve
para largura, que é o que `textLength` governa, e não serve para altura.

`bancada/suites/e2e-game-flow.js` mede, desde a mesma data, as **duas margens da
Fase Suíça** e a rolagem, em desktop e celular. O layout antigo deixava 880 px
vazios à direita na rodada 0 (61% da largura) enquanto o conteúdo estourava a
altura, e rolava na horizontal no celular com "ELIMINADOS" cortado. Nada disso
aparece numa captura: margem assimétrica e rolagem só existem como número.

`tools/check-card-portraits.js`, parte de `npm run check`, valida os assets ligados
ao campo cru `foto`: ID seguro, arquivo WebP existente, proporção exata 5:7,
resolução mínima, limite de peso e ausência de órfãos. O protocolo completo de
entrada e normalização está em `docs/card-portraits.md`.

`tools/check-doc-links.js`, também em `npm run check`, prova que todo caminho de
arquivo citado na documentação existe de verdade. Ele nasceu de um caso real: em
31/07/2026 a documentação ainda mandava ler `src/ui/shared/role-emblems.mjs`,
deletado dias antes, e nada percebeu porque nada verificava. Cobre os 52 markdown
versionados, em crase e em link markdown, e ignora deliberadamente caminhos dentro
de código — ali o próprio import já falha.

Duas saídas são declaradas, não descobertas. `EXCECOES` guarda placeholders de
sintaxe (`caminho/do/time.txt`); `REFERENCIAS_DECLARADAS` guarda arquivos citados
de propósito sem existir — um deletado que o histórico precisa nomear e uma guarda
futura que um handoff propõe. Cada entrada exige motivo escrito, e o checador
**reprova quando a exceção vira arquivo real**, para que a permissão não sobreviva
à necessidade. O autoteste injeta corpus sintético com referência morta e exige que
o medidor acuse: sem isso ele poderia ficar verde para sempre sem ninguém notar.

`tools/check-design-tokens.js`, em `npm run check` desde 02/08/2026, prova o
sistema de cor. Ele nasceu de uma medição: a folha tinha 225 hexadecimais e 178
`rgba()` literais contra ~40 tokens, e não era ruído — eram cores **concorrentes
para o mesmo papel**. `--accent` (#ff6b2a) convivia com 26 usos crus de
`rgba(255,90,31,…)` (#ff5a1f), e `.slot.avail` chegava a ter a borda num laranja
e o `+` do filho no outro. O lado CT da tira de rounds era pintado por
`var(--c-desenvolvedor)` — o token da característica de treinador, igual por
coincidência numérica: rebalancear a cor do Desenvolvedor repintava o placar.

Ele cobra três coisas:

1. **pares hex ↔ triplo RGB.** Cada cor tokenizada existe nas duas formas porque
   `color-mix(in srgb,C p%,transparent)` **não** é bit-idêntico a `rgba(C,p)` no
   Chromium — medido com o comparador, ele desloca a página inteira em 1/255 e
   faz 21 de 21 capturas diferirem, inclusive telas sem nenhuma cor tocada.
   `rgba(var(--x-rgb),a)` é exato; o preço é a duplicação, e ela é verificada em
   vez de proibida;
2. **literais regredidos.** Cor já tokenizada não pode voltar como literal. A
   regra é *um token pode guardar qualquer literal; uma propriedade normal não* —
   assim sistemas com paleta própria e valor coincidente, como a escada de
   raridade da carta, continuam livres para divergir;
3. **paleta compartilhada com `elencos.html`**, que é autônomo e mantém a própria
   cópia. `check-roster-sync.js` já cobria funções e faixas; faltavam as cores de
   chrome que o arquivo declara estarem "sincronizadas com style.css".

As três foram verificadas reprovando, por mutação.

Os servidores efêmeros dos E2E devem usar faixas aceitas pelo Chromium. O fluxo
principal usa 7000–7299; a faixa antiga 5900–6199 incluía a porta 6000, que o
navegador bloqueia com `ERR_UNSAFE_PORT` antes de qualquer teste de produto.

## Comparador visual (não é suíte, é instrumento)

`tools/visual-regression.js` fotografa o jogo em 3 larguras × 7 estados (inicial,
cartas, versos, elenco completo, suíça, antessala e mapa ao vivo) e compara duas
execuções pixel a pixel. Ele existe porque o E2E prova que os elementos existem e
que o fluxo funciona, mas nenhuma suíte percebia se algo tinha ficado feio.

**Nomeie a pasta começando por `visual-`.** O `.gitignore` ignora `/visual-*/`, e
só isso; um nome ad-hoc vira lixo untracked em todo `git status` — foi o que já
aconteceu com as pastas `coach-*` e voltou a acontecer em 02/08/2026 com
`tok-*`/`casc-*`. A prova é entre duas execuções da mesma sessão e a pasta é
descartável: apague-a ao fechar a fatia.

```bash
npm run visual:capturar -- visual-antes
# aplique a mudança
npm run visual:capturar -- visual-depois
npm run visual:comparar -- visual-antes visual-depois
```

`comparar` sai com código 1 se houver diferença e informa a caixa envolvente e a
primeira cor divergente, o suficiente para localizar a região.

Determinismo depende de três travas descritas no cabeçalho do arquivo: `Math.random`
substituído antes dos scripts da página (a roleta não usa o RNG semeado), `srand`
fixado pela ponte `?e2e=1` antes da fase suíça, e todas as animações congeladas no
mesmo quadro — com atraso `-10s`, para que as animações de entrada fiquem no quadro
FINAL e não no primeiro. Antes de confiar num resultado, rode duas capturas sem
mudar nada: a diferença tem de ser zero.

**Não há imagens de referência versionadas.** Guardar PNGs no Git faria de toda
mudança de design deliberada um commit de binários; a prova é sempre entre duas
execuções da mesma sessão, e as pastas de saída são ignoradas pelo Git.

Em 29/07/2026 este instrumento pegou três mudanças visuais silenciosas durante a
fusão das camadas de cascata do `style.css` — nenhuma delas visível na leitura do
código, todas prontas para ir ao ar.

## Suítes de forma e seus ratchets

`perfis.js`, `dificuldade.js` e a seção FORMA de `realismo.js` medem **distribuição**,
não média: assinatura por função e playstyle, sobreposição entre bandas de OVR,
variância intra-jogador, peso do contexto, kills por round, método do round e
probabilidade de campanha invicta.

Cada critério vira gate quando a etapa que o resolve é entregue (ratchet
`ETAPA_ATIVA`). Estado executável atual: as quatro etapas de `perfis.js` —
`rating`, `relogio`, `abertura` e `distribuicao` — estão ativas. Na seção FORMA
de `realismo.js`, relógio reprova por padrão; os critérios de economia continuam
opt-in com `ECONOMIA_STRICT=1`. `dificuldade.js` voltou a relatório em 28/07/2026
depois de a recuperação da guarda `Favorito gap 16+` levar o invicto do elenco
draftado a 3,8%; seus alvos só reprovam com `DIFICULDADE_STRICT=1`. O histórico
dos alvos está em [`baseline-simulacao-2026-07-26.md`](ciclos/baseline-simulacao-2026-07-26.md),
[`dificuldade-invicto-2026-07-27.md`](ciclos/dificuldade-invicto-2026-07-27.md) e no
cabeçalho executável de `bancada/suites/dificuldade.js`.

Toda calibração de constante passa por `bancada/lib/sweep.js`: braços pareados pela mesma
seed e agenda, valor restaurado mesmo após falha, e braço de controle obrigatório
provando que nenhum estado atravessa braços. Proporções raras (a campanha invicta vive
perto de 5%) são relatadas com intervalo de Wilson — sem intervalo, mover o número é
indistinguível de sorte.

O `npm run check` também compara o módulo estatístico compartilhado com as
fórmulas legadas em 5.464 amostras determinísticas, incluindo vazios, extremos,
quantis, imutabilidade da entrada e intervalo de confiança.

Durante P2, checadores diferenciais compararam `combatProfile` (261 casos),
`fallenAngels` (2.048 eventos), `exposureProfile` (175 casos),
`preservationValue`, `tradeContextProfile` e `assistContextProfile` (174 casos
cada), além de todas as fronteiras de avaliação e simulação. Eles foram
aposentados quando a segunda implementação saiu de `game.js`: depois disso,
comparar módulo e adapter seria comparar o módulo consigo mesmo.

A proteção permanente ficou distribuída entre:

- `tools/check-public-evaluation-api.js` e `check-public-simulation-api.js`, que
  exercitam composição, identidade, determinismo e sessões isoladas;
- `tools/check-random-source-contract.js`, com vetores Mulberry32 congelados;
- snapshot do elenco e goldens completos de mapa/campanha;
- regressões funcionais, auditoria de componentes, benchmarks estatísticos e E2E.

Os contratos semânticos continuam: IGL usa a função de combate classificada;
não-IGL preserva a primária; preservação não significa inventário; prontidão de
trade e utilidade disponível não concedem trade, assistência ou KAST sozinhas.

`npm run audit:r5:rating` reconstrói as onze parcelas do FALLEnANGELs a partir
da telemetria e exige igualdade com o rating final de cada player-map. A
execução padrão usa 61.200 mapas-alvo, separa 60/20/20 jogadores por hash
determinístico e não reporta o candidato no holdout de auditoria.

## Estado de referência

- A aplicação possui 17 times e 85 cards de jogador.
- O snapshot deve conter exatamente uma entrada por ID cru de `ATRIBUTOS`.
- Os benchmarks usam amostragem; limites são os contratos, e uma execução
  específica é registrada em `docs/baseline.md`.
- A CI usa Node 20. Desenvolvedores em outra versão devem registrar divergências.

O `docs/baseline.md` é um retrato histórico: sua contagem de 13 suítes corresponde
à captura de 19 de julho de 2026, não à bancada atual. A validação final de P2,
em 28 de julho de 2026, aprovou 24/24 suítes em 168,3 s. Isso confirma regressão;
não é uma nota IFCS oficial.

O checkpoint visual de 31 de julho de 2026 usa a bancada atual de 25 suítes:
`npm run validate` aprovou 25/25 em 184,2 s; a execução remota `30652005186`
também ficou verde e publicou `7175c26`. A comparação visual mudou 9/21 estados,
todos contendo cartas, e deixou os outros 12 pixel a pixel idênticos.

## Validação do extrator IFCS

O extrator de demos é uma ferramenta Python offline, separada do runtime e da
validação Node:

```text
python -m venv .venv-fidelity
.venv-fidelity/Scripts/python -m pip install -r tools/requirements-fidelity.lock
.venv-fidelity/Scripts/python tools/extract-fidelity-demo.py --check-environment
.venv-fidelity/Scripts/python tools/extract-fidelity-demo.py --self-test
```

O ambiente com Awpy 2.0.2 e o autoteste sintético foram aprovados localmente. O
extrator também processou duas vezes a mesma demo CS2 real em destinos novos e
reproduziu mapa, placar, rounds e dez jogadores. A entrada e os resultados
esperados estão selados em `fidelity-corpus/parser-proof.json`. Essa demo FACEIT
acadêmica prova o pipeline, mas não substitui a coleta nem a auditoria do corpus
profissional exigido para a nota.

O piloto profissional FURIA 8–13 Falcons também foi executado duas vezes. O
placar, os 21 rounds, os dez jogadores e os hashes das 21 tabelas derivadas
coincidiram entre as execuções.

O diagnóstico legado pode produzir uma nota técnica preliminar de aderência às
faixas, mas ela deve sempre ser rotulada como `not-ifcs`. A captura atual está
em `docs/dados/fidelity-technical-baseline.json`: 4.000 mapas, 131/136 avaliações
aprovadas e resultado arredondado 96/100.

## Atualização de snapshot

1. Execute `npm run test:regression` e leia todas as diferenças.
2. Confirme que cada jogador alterado pertence ao objetivo aprovado.
3. Execute `npm run snapshot:update`.
4. Revise o diff JSON manualmente.
5. Execute novamente regressão e benchmark.
6. Não misture a atualização com movimentação de arquivos ou formatação.

## Golden do simulador

`npm run test:golden` reconstrói três cenários em motores novos e compara mapa,
placar, todos os rounds, economia, plant, clutch, destaques e estatísticas dos
dez jogadores com `bancada/golden/simulation-golden.json`. A cobertura inclui uma
série melhor de três, prorrogação repetida e paridade entre os modos completo e
leve. Os jogadores são identificados pelo ID cru, não apenas pelo nick.

A suíte também liga a telemetria opcional de rounds em um motor novo, reconcilia
K/D/A/KAST/ADR com o resultado final e exige igualdade profunda, inclusive no
estado posterior do RNG, após remover somente o campo diagnóstico.

O golden é um teste de caracterização: ele prova que uma refatoração preservou
o comportamento observável e o consumo do Mulberry32. Ele não afirma que o
balanceamento congelado é ideal. Uma mudança deliberada de balanceamento deve
ser comparada estatisticamente em commit separado antes de executar
`npm run golden:update`; nunca se atualiza o fixture apenas para esconder uma
regressão.

## Caudas individuais R5

`npm run test:r5:tails` prova, com eventos sintéticos válidos, que o rating pode
atravessar os limites antigos de `0,30` e `3,0`. A mesma suíte amostra 250.000
formas determinísticas e exige valores positivos e finitos, passagem pelos
limites antigos e ausência de massa exatamente em `0,30` ou `2,20`. O teste não
substitui a suíte rara de release: frequências da ordem de 1/10.000 ou 1/100.000
exigem ao menos um milhão de player-maps no gate R6.

## E2E obrigatório

Playwright é uma dependência de desenvolvimento e Chromium é instalado
explicitamente na CI. Ausência da biblioteca, do browser ou falha de lançamento
encerra a suíte com erro. Um E2E pulado não é considerado cobertura.

`e2e-intent.js` protege o editor de atributos e o caminho paralelo do calibrador.
No editor, o navegador valida rascunhos por jogador, aplicação explícita,
restauração individual, descarte, reset global, relatório, exportação JSON e a
ordem visual nome completo → número → slider limitado. `e2e-simulation.js`
protege mapa, lote A × B e amostra round-robin da liga. O contrato inclui
KAST/ADR/Rating, lados, plant e pós-plant, anti-eco, conversão pós-pistol,
clutches, força do favorito, métricas por função, diagnóstico de suficiência,
cobertura dos 17 times, probabilidades bilaterais, seed automática por execução,
rolagem, responsividade, valores inválidos e erros de página. O determinismo do
motor por seed continua sendo um contrato separado, descrito no ADR 0003.

O painel individual também possui contrato explícito: mostra os dez jogadores
de um confronto mesmo com lote abaixo do mínimo estatístico e mostra os 85 IDs
na amostra completa da liga. A quantidade de mapas permanece visível para que
uma linha com pouca amostra não pareça tão confiável quanto uma média longa. O
E2E valida as duas funções de cada jogador, totais de kills, deaths e assists,
K/D e as médias por round KPR, DPR, A/R, KAST e ADR. Valida ainda média,
mediana, desvio-padrão, P5, P95, extremos, P10–P90, IC95%, busca, filtros nas
duas funções, ordenação numérica, comparação de dois jogadores e reset entre
amostras. O download CSV é lido pelo teste para verificar BOM, nome rastreável,
schema de desempenho, respeito aos filtros, escaping e neutralização de
fórmulas.

O contrato visual exige um gráfico acessível por jogador, painéis em largura
integral, tabela desktop sem rolagem horizontal, cabeçalho e três colunas de
identidade fixos, coluna explícita de comparação, legenda completa, escala comum,
ajuda recolhida e ausência de badges repetidos quando toda a amostra é suficiente.
Os filtros se reorganizam em três colunas na largura intermediária e os jogadores
viram cards no celular, sempre sem overflow da página. Os gráficos preservam os
valores numéricos e seus rótulos para leitores de tela.

O mesmo E2E protege a campanha curta: controles próprios, término no segundo
mapa vencido, dois ou três mapas sem repetição, orientação alternada, dez
jogadores, uma amostra por mapa e ausência de apresentação como fidelidade. A
seed `424242` deve reproduzir integralmente `bancada/golden/campaign-golden.json`.

`e2e-game-flow.js` percorre o jogo principal pela interface real: sorteia e
monta os seis slots, valida força e química, disputa Suíça e playoffs, confere
placares e ratings, chega à tela final e reinicia a campanha. O teste escolhe
uma seed vencedora reproduzível para cobrir todas as fases sem alterar o RNG ou
o balanceamento executável do produto.

## Próximas camadas

- retratos por lotes: validar arquivo/dado, rodar o E2E de cartas e inspecionar
  frente/verso nas oito larguras antes de publicar cada lote;
- P5 estado: `tools/check-game-state.js` já protege shape, instâncias
  independentes, identidade dos resets e campos deliberadamente ausentes;
- P5 controladores: E2E completo do jogo e golden/RNG pertinente a cada extração;
- Carreira: testes de schema/migração do save, recálculo de derivados e um E2E da
  primeira temporada curta desde o criador até o encerramento;
- desempenho: benchmark separado dos asserts de realismo, antes de otimizar;
- IFCS: adquirir, auditar e selar o corpus real; só então produzir a primeira
  nota oficial, sem tuning no mesmo commit.
