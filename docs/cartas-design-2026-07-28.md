# Cartas de jogador — design aprovado (28/07/2026)

> **Estado: A REFINADA PROMOVIDA COMO CARTA CANÔNICA em 31/07/2026.** O design
> executável vive em `src/ui/game/card-view.mjs`, `src/ui/shared/flags.mjs` e
> `style.css`. Emblemas, comparadores A/B/C, referência `369c480` e ajuste medido
> foram removidos; o histórico das experiências abaixo permanece para explicar
> decisões, não como backlog. O estado vigente está na **seção 14**.
>
> `prototipo-cartas.html` é uma bancada fina de QA da única implementação real.

## 1. A direção escolhida

Três direções foram apresentadas; o responsável escolheu a **A** ("mil vezes o A"),
com duas ressalvas que foram atendidas: *"conseguir realmente enxergar o que importa"*
(hierarquia) e *"falta refino profissional"* (ofício).

Linguagem visual: a foto **é** a carta, tingida pela cor da raridade; uma diagonal
separa a zona da foto da placa de informação; quase nenhum texto.

## 2. Frente — quem é e quanto vale

Três níveis de leitura, e **só três**:

1. **OVR** sozinho no canto superior esquerdo, sem competir com nada.
2. **Nick** sobre uma placa sólida — contraste garantido em qualquer foto.
3. **Função primária** na cor da raridade.

Rodapé em uma linha só, apagada: **função secundária** e **time**. Canto superior
direito: **bandeira do país**.

Decisões que custaram iteração:

- O nome **não** pode ficar sobre uma faixa em degradê: o contraste muda ao longo da
  própria palavra. Placa sólida resolve, e é o que cartas de coleção reais fazem.
- Campeonato e ano ficam **só no verso** — na frente competiriam com o OVR.
- Nome longo **encolhe** (escala por comprimento), nunca é cortado com reticências.
  A razão vive na `.carta`, então **as duas faces encolhem juntas**.

## 3. Verso — como joga

A espinha é o **playstyle**. A receita continua determinando quais atributos entram
e em que ordem, mas os pesos técnicos não são exibidos: o verso comunica o jogador,
não a fórmula. OVR e rating também não se repetem no verso.

- Firepower **sempre em primeiro**; os demais por contribuição ao estilo
  (`peso × valor`), com a mesma matemática anterior.
  Mesma regra do `backPlayer` em `src/ui/game/card-view.mjs` — fp é prefixado
  mesmo quando não está na receita, e o conjunto é cortado em 4. Por isso o verso
  mostra **3 ou 4 stats**, e o layout precisa aguentar os dois casos (por isso a
  lista centraliza).
- Rodapé: **campeonato**, **ano** e **colocação**. É o que distingue duas cartas do
  mesmo jogador — donk em *IEM Katowice 2024* e donk em *Budapest Major 2025* são a
  mesma pessoa em eras diferentes.

## 4. Padronização

- **Um bloco de tokens governa as DUAS faces**: um recuo lateral (`--pad`) em
  `.card`/`.coachcard` e quatro corpos de texto numa razão de ~1,5 em `.cfaces`.
  Esta linha já errou **duas** vezes, e as duas pelo mesmo motivo — descrevia
  token que o CSS tinha mas ninguém lia:
  - até 01/08/2026 citava `--passo:5.2%` "que gera a pilha inteira por `calc`";
  - até 03/08/2026 citava as âncoras verticais `--b1/--b2/--b3`. Elas caíram na
    §23, provadas mortas **por mutação**: valores absurdos moviam 0 de 279
    medidas, contra 156 do controle. A pilha é ancorada pela grade de identidade,
    não por elas.

  Antes de descrever um token como contrato, confirme que alguém o **lê**.
- **Raridade é uma tabela** de quatro sinais — cor, aro, fio e contagem de marcas.
  Nova raridade = nova linha; nenhuma faixa depende de halo externo.
- A diagonal do verso **deriva em CSS** o mesmo ângulo físico da frente
  (`--corte-n * --placa-n / --faixa-n`). Antes era um valor fixo com a conta só no
  comentário, e mudar a altura da placa desalinhava as faces em silêncio.
- **Uma carta, duas densidades**: tudo é `cqw` sobre container query. A 150px ou
  menos, só o contexto secundário da frente pode sair; stats, playstyle,
  campeonato e colocação permanecem visíveis. Não são duas cartas.

## 5. Faixas de raridade — decididas por medição

**Por OVR puro**, sem promoção por estrela:

| tier | OVR | n | % |
|---|---|---|---|
| holo | 21+ | 6 | 7,1% |
| ts | 20 | 11 | 12,9% |
| t1 | 19 | 11 | 12,9% |
| t2 | 17–18 | 30 | 35,3% |
| t3 | ≤16 | 27 | 31,8% |

A proposta inicial era "estrela promove um degrau". Foi **descartada por medição**: a
flag `estrela` do motor é exatamente `ovr>=20`, com **zero discordâncias em 85** — a
promoção não moveria uma única carta.

**Reconferido em 29/07/2026, já com as cartas ligadas ao jogo:** `tierOf`
(`src/ui/game/card-view.mjs`) aplica exatamente estes cortes e a distribuição medida
nos 85 é a desta tabela. As duas medições da flag também continuam idênticas
(17 jogadores com `estrela`, 17 com `ovr>=20`, zero discordâncias).

> **Superado em 31/07/2026 — a tabela acima NÃO é mais o código.** A escada de cinco
> faixas virou **seis** em `673e205`. `tierOf` hoje é:
> `tier-6` ovr≥22 · `tier-5` ≥21 · `tier-4` ≥20 · `tier-3` 18–19 · `tier-2` 15–17 ·
> `tier-1` ≤14. Repare que os cortes de baixo mudaram de verdade: o antigo `t2` era
> 17–18 e hoje 17 e 18 caem em faixas diferentes. A escada vigente está na §12 e o
> contrato final na §14. A conclusão sobre a flag `estrela` (promoção descartada por
> não mover nenhuma carta) continua valendo.

O **selo ★ foi removido** a pedido do responsável ("achei bem feio").

## 6. Bandeiras

**22 países** em SVG embutido, cobrindo 85 de 85 jogadores (o `POOL` resolve país
juntando `p.pais` com o mapa) mais CAN e AUT, que só aparecem em treinador.

**Não são emoji.** O Windows não tem os glifos de bandeira e renderiza as duas letras
no lugar do desenho. Como saem com ~14px, o que lê é geometria e cor — USA, GBR, AUS,
CAN, ISR, MNG, BIH, KAZ, SVK e BLR são simplificadas de propósito.

## 7. Casos reais que quebrariam o layout

Todos achados medindo o motor, todos com fila própria no protótipo:

- **IGL tem `role2` nulo** nos 17 casos. A carta usa `combatRole`.
- **Coringa não tem receita** (3 jogadores) — o verso diz isso em vez de mostrar
  barras vazias.
- **Firepower 2** (chopper) fixado em primeiro deixaria uma barra invisível. Há piso
  de 3% no trilho.
- **Sem foto** é o estado de **todos** os 85 hoje — é estado declarado, não remendo.

## 8. Dados: tudo vem do motor

As 15 cartas do protótipo saíram de `avaliarJogador` e `TIMES_DEF`, conferidas com
**zero divergências**. Nada é digitado. Foi assim que apareceu que o s1mple é OVR 20
e não 21, como um rascunho anterior afirmava.

## 9. O que falta — situação em 29/07/2026

1. ~~**Ligar ao jogo**~~ **FEITO** (`c1ecdee`). Os tokens pagaram o que prometiam:
   entraram no `style.css` como um bloco só.
2. ~~**Carta de TREINADOR**~~ **FEITA** no mesmo commit, e pelo mesmo esqueleto das
   outras. Duas diferenças declaradas: a cor vem da **característica**, não da
   raridade, porque ele não disputa a escala de OVR dos jogadores; e a característica
   ocupa o lugar da função primária, já que é ela que descreve o que ele faz pelo
   time. O emblema é a prancheta e o verso descreve o efeito da característica.
3. ~~**Fotos — CONTINUA ABERTO.**~~ **SUPERADO em 31/07/2026** — ver §13/§14. O campo
   cru `foto` existe, `donk_kato24` está ligado, a cobertura declarada é 1/85 e a
   divergência `sem-foto` **não existe mais** em `src/data/catalog.mjs` (hoje a única
   declarada é `camp-empacotado`). O texto original dizia "0 de 85 jogadores têm
   retrato e não há campo para guardá-lo"; era verdade em 29/07 e não é mais.
4. ~~**Daltonismo**~~ **RESOLVIDO** (`8a12250`) pelo emblema de função — **mas o
   mecanismo mudou em 31/07/2026**: os emblemas saíram para dar o centro ao retrato e
   a cobertura passou para o **nome da função**, segundo elemento mais forte da
   frente, em cor viva. Palavra escrita não depende de visão de cor. Ver §13.
5. **Duplicados na roleta — CONTINUA ABERTO, como questão visual.** 8 jogadores têm
   duas eras e as duas frentes ficam quase iguais; só o rodapé (time) e o verso
   (campeonato, ano, colocação) as distinguem. O que já existe, e é **anterior a este
   documento**, é a regra de LINE: `game.js` bloqueia o mesmo nick duas vezes no seu
   elenco (classe `dup`) e o Major remove um NPC com sobreposição de nicks. Falta
   decidir se a apresentação deve distinguir as eras na própria frente.

## 10. O que mudou ao ligar ao jogo (29/07/2026)

**A carta ganhou um segundo canal.** O design de 28/07 comunicava uma coisa por cor —
a raridade. No elenco do MongolZ isso produzia quatro cartas praticamente iguais
(17, 17, 17, 16, todas na mesma faixa), e foi o que o responsável apontou jogando.
Agora são dois canais, e eles não disputam nenhuma propriedade:

| classe | canal | pinta |
|---|---|---|
| `tier-*` | **raridade** | moldura: aro, marcas, fio, placa e o rótulo do OVR |
| `fn-*` | **função** | campo: cor de fundo, nome da função e o emblema ao fundo |

**As faixas vivem no código, em dois lugares que precisam andar juntos.** `tierOf`
em `src/ui/game/card-view.mjs` é a fonte; `elencos.html` mantém a própria cópia
(`tierVars`) porque é template gerado. Se as duas divergirem, o **mesmo jogador
aparece com cor diferente em duas telas** — o comentário está escrito nos dois
arquivos. O guarda de views cobre as bordas (20 não pode cair em `tier-1`, 17 não
pode cair em `tier-3`).

O resto deste documento (hierarquia da frente, playstyle como espinha do verso,
tokens, bandeiras e os casos que quebram layout) continua valendo com o contrato
de refinamento registrado ao fim da seção 11.

## 11. O laboratório de cartas (29/07/2026)

`prototipo-cartas.html` era autocontido — cópia do CSS, das bandeiras, dos dados e
da escala de nome — e apodreceu no dia em que as cartas foram ligadas ao jogo. Agora
ele **importa** `style.css`, `src/ui/game/card-view.mjs`, `src/ui/shared/flags.mjs` e
`src/ui/shared/role-emblems.mjs`: zero cópia, 85 jogadores e 15 treinadores reais.

> **Superado em 31/07/2026:** `src/ui/shared/role-emblems.mjs` foi **deletado** em
> `673e205`. O laboratório importa hoje `style.css`, `evaluation-api.mjs`,
> `card-view.mjs`, `card-face.mjs`, `html.mjs` e `flags.mjs`. O princípio de zero
> cópia continua valendo — só a lista mudou.

```text
npm run serve   →   http://127.0.0.1:5173/prototipo-cartas.html
```

Precisa de servidor: módulo ES não carrega por `file://`.

O que ele tem: um botão **Proposta futura** (tecla `P`) que liga o bloco `#proposta`
e faz o A/B contra o jogo atual; depois de uma promoção esse bloco fica vazio,
para não manter uma segunda cópia do CSS. Também oferece **verso**, **escala de
cinza**, **oito larguras** — as cinco reais (250/188/176/130/120 px) e a costura
compacta (151/150/149 px) — e **simulação de daltonismo**; a escada de raridade
isolando só o OVR; a matriz de 30 combinações raridade × função; os casos que
quebram; os 17 elencos completos; emblemas e bandeiras ampliados.

> **Superado em 31/07/2026:** o botão **Proposta futura**, a tecla `P` e o bloco
> `#proposta` foram **removidos** em `673e205` — o mecanismo de A/B não existe mais,
> porque não há mais duas hipóteses a comparar. Os emblemas também saíram. O que
> permanece: verso, escala de cinza, daltonismo, as oito larguras, a escada, a
> matriz, os casos que quebram e os 17 elencos, agora sobre a carta única. A
> matriz passou de **30 para 36 combinações** quando a escada ganhou a sexta faixa.

E tem o **medidor de geometria**, que é a parte que não é gosto: ele mede texto
contra caixa, recorte vertical e colisão entre regiões em todas as cartas da página,
e reprova por número. Reticências explicitamente declaradas continuam sendo estado
válido e aparecem no relatório sem virar falso positivo. Toda mudança de design de
carta entra aqui primeiro; ao ser aprovada, migra para `style.css`/`card-view.mjs`.

### A regressão que o medidor achou

**A escala de nome estava morta no jogo.** `--t2` era declarado em `.card`, mas
`card-view` põe `--nick-esc` em `.cfaces`, que é **filha** — e substituição de custom
property acontece no elemento onde a propriedade é declarada, então `var(--nick-esc,1)`
sempre caía no fallback 1. Os 100 nicks renderizavam a 16cqw. No protótipo antigo
funcionava porque lá a razão vivia em `.carta`, um **ancestral**; a relação inverteu na
migração e nenhuma guarda mede encaixe.

Resultado medido: `olofmeister` e `pashaBiceps` passavam **28 px** da borda e eram
cortados no meio da letra; `electroNic`, `Skadoodle` e `controlez` também estouravam.
A densidade compacta ainda **aumentava** a fonte (18cqw), o que reabria o estouro a
120 px mesmo com a razão viva.

| largura | estouros hoje | com a proposta |
|---|---:|---:|
| 250 · 188 · 176 px | 14 | **0** |
| 130 · 120 px | 22 | **0** |

### Consertos já promovidos ao jogo (29/07/2026)

| id | o que foi | onde vive agora |
|---|---|---|
| P1 | `--t2` declarado em `.cfaces`, onde `--nick-esc` existe; densidade compacta para de crescer o nick (era 18cqw) | `style.css` |
| P3 | rótulo do verso ganha `--carac-esc` pela mesma lógica | `style.css` + `card-view.mjs` |
| P8 | `:hover` deixa de exibir o aro de opacidade cheia de outra faixa | `style.css` |

Prova permanente: **`bancada/suites/e2e-cartas.js`** (grupo `test:e2e`) chama o próprio
medidor do laboratório nos estados publicado e proposta e exige zero falhas nas
oito larguras. Ele também prova que sabe acusar, injetando nome e colisão impossíveis,
e que não confunde reticências declaradas com quebra. Com isso a bancada foi de 24
para **25 suítes**.

`tools/check-game-view-modules.js` congela as duas razões no atributo, então mudar
`escalaNick`/`escalaCarac` sem intenção reprova o `check`.

### Endurecimento promovido ao jogo (30/07/2026)

Uma auditoria de estados reais encontrou três defeitos que a prova anterior ainda
não alcançava:

1. a densidade compacta nunca ativava. `.card` declarava o próprio container e a
   regra tentava alterar a própria `.card`; container queries só selecionam
   descendentes do container. Os tokens compactos agora vivem em `.cfaces` e a
   costura 151/150/149 px é testada explicitamente;
2. frente e verso permaneciam simultaneamente na árvore interativa, embora uma face
   estivesse visualmente escondida. `setCardFlipped` agora sincroniza classe,
   `data-face`, `aria-hidden` e `pointer-events`; cartas acionáveis expõem semântica
   de botão e respondem a Enter/Espaço;
3. regras de `:hover` podiam permanecer presas depois de um toque. Efeitos de hover
   agora só existem quando o dispositivo declara `hover: hover` e ponteiro fino.

O E2E abre também o jogo real em viewport móvel: verifica proporção, overflow,
densidade compacta, modo Virar, reset ao sair do modo e seleção normal. Em contextos
separados, prova `prefers-reduced-motion` e emulação touch. Essas guardas endurecem a
interface sem alterar dados, OVR, raridade, balanceamento ou o conteúdo das cartas.

A comparação visual pareada antes/depois fotografou 21 estados. Mudaram somente os
seis estados com cartas compactas em celular/tablet; as outras 15 capturas ficaram
idênticas, incluindo todo o desktop e todas as telas posteriores sem cartas. A
inspeção das seis diferenças confirmou que elas ficam dentro das próprias cartas e
correspondem à ativação da densidade compacta antes inerte.

Fechamento do marco: `npm run validate`, **25/25 suítes verdes** em 198,2 s, sem
alteração de snapshot, golden, RNG, dados ou balanceamento.

### Tactical Editorial promovido ao jogo (30/07/2026)

O responsável pediu uma superfície mais limpa, profissional, legível e robusta,
sem a luz atrás das cartas. A proposta foi montada e medida no laboratório antes
de migrar para o jogo, no commit `bf5d5e5`.

- **Sem luz decorativa:** cartas têm somente aro interno; hover não altera a
  raridade, entrada não varre brilho e a holo é estática. Foram removidos halos,
  pulsos e overshoot das animações da própria carta.
- **Raridade padronizada:** P4 foi promovida. A escada usa 0–4 marcas, aro e fio
  normalizados, por isso continua identificável em cinza e daltonismo.
- **Dois canais realmente separados:** P5 foi promovida. A função usa forma e um
  campo contido; a raridade concentra os sinais de moldura.
- **Treinador como categoria:** P6 foi promovida. Moldura neutra e fio segmentado
  evitam que um treinador pareça mais raro que um jogador holo. A característica
  continua colorida e o verso recebe o mesmo rodapé de era.
- **Verso editorial:** `.c-vovr`, RTG e pesos numéricos da receita deixaram de ser
  renderizados. A seleção e a ordem dos stats continuam exatamente por
  contribuição `peso × valor`; foi removido apenas o ruído visual.
- **Era sempre legível:** campeonato e colocação aparecem em todas as cartas,
  inclusive treinador e densidade compacta. O evento quebra linha em vez de
  desaparecer ou usar reticências.
- **Movimento curto:** hover 180 ms, flip 360 ms com fade de 180 ms, distribuição
  400 ms e encaixe 280 ms, usando `cubic-bezier(.22,1,.36,1)`. Os keyframes usam
  apenas `transform`/`opacity`, sem rotação nem escala acima de 1.

P9 (inventar carta para elenco histórico sem treinador) e a troca do emblema do
Support não foram promovidas: eram hipóteses fora deste refinamento e saíram do
bloco ativo. Ausência de treinador continua sendo ausência real, sem dado fictício.
O `#proposta` está vazio e reservado para a próxima hipótese.

As guardas agora provam 145 cartas × 8 larguras: zero falha geométrica, conteúdo
primário presente, fontes mínimas, contraste de pelo menos 4,5:1, nenhum halo e
nenhum nó removido no HTML. A comparação pareada de 21 capturas mudou somente os
três estados com cartas — frente, verso e elenco — nas três larguras; os outros 12
estados permaneceram pixel a pixel idênticos. Inspeção manual aprovou as nove
diferenças.

> **Superado em 31/07/2026:** os dois "agora" acima são de 30/07. O E2E mede hoje
> **153 cartas** e o bloco `#proposta` **não existe mais** — não foi esvaziado, foi
> removido junto com o comparador em `673e205`. Números vigentes na §14.

Fechamento: `npm run validate`, **25/25 suítes verdes** em 182,2 s; snapshot,
golden, RNG, tiers, dados crus e balanceamento intactos. CI e deploy do Pages:
workflow `30527422214`, verde.

## 12. Proposta que era ativa no laboratório em 30/07/2026 — depois PROMOVIDA

> **Superado em 31/07/2026 — leia como história, não como instrução.** O aviso
> original dizia "existe uma hipótese viva no bloco `#proposta`… nada abaixo está em
> `style.css`". Isso deixou de valer: a proposta **foi promovida** em `673e205`, a
> escada de seis faixas descrita abaixo é hoje o `tierOf` de
> `src/ui/game/card-view.mjs`, e `#proposta`, a tecla `P` e o comparador foram
> removidos. O contrato vigente está na §14.

### A escada de seis faixas

Cinco faixas viram seis, e o topo deixa de colapsar 21 e 22 no mesmo holo:

| classe | OVR | jogadores | tratamento |
|---|---|---:|---|
| `p-t1` | ≤14 | 5 | branca, piso, sem moldura especial |
| `p-t2` | 15–17 | 39 | verde |
| `p-t3` | 18–19 | 24 | âmbar, ainda sem borda |
| `p-t4` | 20 | 11 | **borda dourada cromada** |
| `p-t5` | 21 | 2 | **borda vermelho sangue** |
| `p-t6` | 22 | 4 | **borda iridescente, estática** |

A faixa é função do OVR, então não pode nascer no CSS: o laboratório marca cada
carta com `p-rank` + `p-tN` e o bloco pinta. Ao promover, isso vira `tierOf` em
`card-view.mjs` — e **cinco pontos precisam andar juntos**, ou o mesmo jogador
aparece com raridade diferente em duas telas: `card-view.mjs` (`tierOf`),
`elencos.html` (`tierVars`, cópia própria escrita à mão — só o bloco `DATA` é
gerado), `tools/check-game-view-modules.js` (congela as strings de classe),
`prototipo-cartas.html` (array `TIERS`) e `bancada/suites/e2e-cartas.js`
(`CARTAS_ESPERADAS`, hoje 155: 152 cartas-base + 3 enquadramentos).

### Decisões que custaram medição e não devem ser refeitas

- **Vermelho não alcança a luminância do ouro sem deixar de ser vermelho.**
  `#ff0000` puro dá 0,21 contra 0,58 do `#ffbe00`. Monotonicidade estrita de
  brilho é impossível nesta paleta. A escada tem dois carregadores: luminância
  nas três faixas sem borda (0,051 → 0,127 → 0,274, monotônica) e categoria nas
  três com borda. O que importa é que 21 nunca pareça menos que 19.
- **Pintura e tinta são tokens separados.** `--m`/`--r` pintam estrutura;
  `--m-ink`/`--r-ink` colorem texto e precisam passar 4,5:1. É o que permite
  moldura sangue `#8b0f1d` (2,03:1, reprovaria como texto) com tinta `#ff7a86`
  (7,77:1). Fio, campo e placa saem de `--fio-cor`/`--wash-cor`, calibrados —
  derivar qualquer um deles de `--m` cru reintroduz inversão na escada.
- **As marcas de raridade saíram**, por decisão do responsável: a faixa é função
  direta do OVR e o OVR já é o maior elemento da carta.
- **Os emblemas de função saíram**, para dar o centro ao retrato. A cobertura de
  daltonismo mudou de canal: o nome da função agora é o segundo elemento mais
  forte da frente, em cor viva, e palavra escrita não depende de visão de cor.
- **A paleta de função foi reconstruída** nas seis famílias que a raridade não
  usa — coral 16°, teal 172°, ciano 188°, azul 214°, violeta 267°, magenta 318°.
  Rifler estava em tan sobre cartas ouro e Lurker em verde sobre 39 cartas verdes.

### Rejeitados pelo responsável — não reintroduzir

Guilhoché e textura no campo; filete duplo no topo da carta; filete sob o nome da
função; braçadeira vertical na carta de IGL; entalhe na placa do IGL. A carta de
IGL é **estruturalmente idêntica** às demais: a diferença é só a escrita, role 1
na cor dele e role 2, a função de combate, na cor dela.

### Treinador

Outro objeto, não um jogador sem OVR: banda **reta** no lugar da diagonal,
moldura **segmentada a 45°** (a 90° as laterais saíam sólidas) e "TREINADOR" com
corpo e cor da característica. A descrição do efeito é o conteúdo do verso dele —
foi de 9,8px para 12,8px no desktop, com números próprios na densidade compacta.

### Retratos — fatia vertical iniciada

Existe **um** retrato: `fotos/donk_kato24.webp` (47 KB, 500×700). A chave é o
**ID cru** (`_eng.id` no jogador, nome no treinador), nunca o `id` da carta, que
é sequencial e só serve ao DOM — `donk` e `donk_kato24` são a mesma pessoa em
eras diferentes e podem ter retratos diferentes.

O campo é uma lista de quatro camadas numa propriedade só, e a ordem importa
porque em `background-image` a primeira pinta por cima: escurecimento do topo ·
banho da raridade · retrato · gradiente base. **O banho precisou subir para cima
da foto**: ele morava no próprio gradiente do campo e desapareceria justamente
nas cartas com retrato. O fallback é automático e não usa JavaScript — sem
`--foto`, ou com URL quebrada, a camada some e o gradiente base aparece.

**A guarda de contraste era cega a retrato**, e isso foi medido: com a foto do
donk o pixel mais claro atrás do OVR dava 2,62:1 — reprovaria na tela e passava
na guarda, que calcula contra um fundo fixo. Escurecimento por canto piorou (a
bandeira caiu de 5,56 para 2,50) e foi descartado pela medição. A faixa de topo
dimensionada pelo alvo levou o OVR a 7,02:1 e a bandeira a 12,32:1.
`bancada/suites/e2e-cartas.js` agora **amostra pixel real** em toda carta com `--foto`,
escondendo o texto antes de medir — sem isso o pixel mais claro da zona é o
próprio número branco. Duas provas sintéticas fecham: retrato branco puro sem
escurecimento reprova em 1:1, com escurecimento passa em 4,82:1.

### Enquadramento A escolhido e grade editorial refinada

O bloco `0 · enquadramento e área do retrato` coloca a mesma carta real lado a
lado em quatro comparadores reproduzíveis, todos protegidos pela guarda: o A
refinado, o A do checkpoint `369c480` como referência histórica e os recortes B
e C. A referência é excluída somente do gate editorial novo; continua passando
por geometria, contraste e acessibilidade como qualquer outra carta.

| opção | tamanho | posição | leitura |
|---|---|---|---|
| A | `100% auto` | `50% 12%` | **escolhido**; contexto integral e mais camisa |
| B | `116% auto` | `70% 28%` | alternativa; rosto maior |
| C | `132% auto` | `75% 30%` | close expressivo; menos camisa e contexto |

As três foram inspecionadas em 250, 188 e 130 px. B manteve no pior caso 5,80:1
atrás do OVR e 9,06:1 atrás da bandeira; portanto nenhuma alternativa exigia
exceção de legibilidade. Em 31/07/2026 o responsável escolheu **A**.

Depois da escolha, o responsável pediu que a foto ocupasse mais da carta e que
diagonal, nome e funções descessem como um conjunto. A composição passou a usar
uma única pilha derivada por densidade. A primeira ampliação mostrou um limite
que a guarda de colisão não capturava: a 188 px, a margem inferior caiu a 2,8% e
restaram cerca de 4 px entre a ponta apertada da diagonal e a caixa do nick.

Em 31/07/2026 o A foi refinado sem voltar ao desenho publicado:

| densidade | jogo → 1ª ampliação → refinado → ajuste atual | margem inferior | função | nick |
|---|---:|---:|---:|---:|
| completa | `38% → 32% → 35% → 34% → 30% → 24%` | `3,3%` | `5,8%` | `10,1%` |
| compacta | `32% → 29% → 31% → 30% → 27% → 22%` | `3,3%` | `3,5%` | `8,5%` |

`--placa-n`, `--placa`, `--b1`, `--b2` e `--b3` governavam todas as cartas de
jogador, em vez de deslocamentos por nick ou retrato. **Os três `--b*` não
existem mais desde 02/08/2026** — a grade de identidade os tornou inertes e a
§22 registra a remoção; a tabela acima é histórica. A função desce para perto
do contexto, enquanto o nick conserva o intervalo maior pedido; `--corte-v` é
recalculado com a nova altura e mantém o ângulo físico igual nas duas faces.
A foto continua ocupando mais área que no jogo publicado, mas frente e verso
recuperam uma margem inferior comum e distância mensurável da diagonal.
O retrato continua exatamente em `100% auto`, `50% 12%`: a área visível cresce
porque placa, diagonal e identidade descem, não por zoom ou novo enquadramento.

No verso, o rodapé deixa o eixo inferior de `3,5%` e passa a `6%`. A reserva de
altura continua cobrindo campeonatos de uma ou duas linhas, enquanto o limite
inferior dos stats sobe de `22%` para `24%`; campeonato, colocação, filete e stats
se movem como uma grade única, não como correções por conteúdo.

O verso passou a obedecer à hierarquia declarada desde o início deste documento.
No A anterior, nick e playstyle mediam praticamente o mesmo a 188 px (`20,45` e
`20,68` px). No refinado, o nick vira cabeçalho e o playstyle domina (`18,65` e
`24,44` px no donk). O rodapé reserva a altura do pior campeonato real, de duas
linhas, e ancora o conteúdo embaixo; assim o filete e o centro óptico dos três ou
quatro stats deixam de mudar conforme o tamanho do nome do evento.

O medidor agora cobre **156 cartas** e possui um segundo gate, além de corte e
colisão: margem inferior nas duas faces, respiro contra as diagonais, igualdade
de inclinação, hierarquia playstyle/nick, equilíbrio stats/era, eixo lateral
compartilhado e alinhamento OVR/bandeira. Uma prova sintética degrada cada um dos
nove contratos e confirma que todos reprovam. A proposta refinada fecha em zero
falha geométrica e editorial nas oito larguras.

### O que faltava naquele checkpoint — registro superado

1. ~~conferir no Pages o A refinado contra a referência `369c480`~~ — concluído
   e depois substituído pelo checkpoint canônico `7175c26`;
2. a previsão citava cinco retratos, incluindo `hally`; o contrato executável
   criado na promoção cobre jogadores. Permanecem como próximo lote seguro
   `sh1ro_kato24`, `zont1x`, `magixx` e `chopper_kato24`; treinador exige extensão
   explícita do dado/checker;
3. ~~promover a proposta ao jogo e comparar as capturas~~ — concluído;
4. ~~transformar o retrato em campo cru catalogado~~ — concluído. O catálogo
   declara `foto` com cobertura 1/85 e não possui mais `sem-foto` em
   `DIVERGENCIAS`.

Fechamento da primeira ampliação: `npm run validate`, **25/25 suítes verdes** em
184,4 s. Fechamento do refinamento editorial: `npm run validate`, **25/25 suítes
verdes** em 186,1 s. Nada de dado cru, OVR, tiers, snapshot, golden, RNG ou
balanceamento foi tocado.

## 13. Promoção canônica — 31/07/2026

> Este é o checkpoint da promoção inicial. O refinamento final do mesmo dia,
> especialmente bandeira, placa e ocupação do verso, está na seção 14 e tem
> precedência.

A última A refinada substituiu o design anterior no jogo. Não existe classe de
proposta nem segundo layout no laboratório. O contrato atual é:

- recorte único de retrato: `100% auto`, `50% 12%`, sem zoom por jogador;
- placa de 24,5% até 150 px e 26,5% abaixo disso, remedida em 02/08/2026 contra
  a régua da diagonal (§22); era 24%/26%/28%;
- nick universal de `11.5cqw`, role principal com piso de 9 px e role secundário
  com piso de 7 px;
- bandeira na coluna inferior direita, acima do time, visível em toda densidade;
- role secundário e time nunca desaparecem;
- playstyle e nick do verso usam corpos universais para todos os jogadores;
- quatro stats em todos os versos e rodapé com reserva fixa para uma ou duas
  linhas de campeonato;
- treinador continua outra categoria, sem criar exceção na carta de jogador.

O laboratório caiu de 1.077 linhas para uma única bancada canônica; usa o Donk
como referência e como molde visual da escada/matriz, e mede 153 cartas
reais/sintéticas em oito larguras. O gate reprova conteúdo oculto, stat
ausente e qualquer diferença de fonte entre jogadores, além das guardas de
geometria, contraste, diagonal, eixo, movimento e acessibilidade.

`donk_kato24` é o primeiro campo cru `foto`, com cobertura explícita 1/85 no
catálogo. `tools/check-card-portraits.js` valida 5:7, WebP, resolução, peso,
referência e órfãos. A normalização dos próximos retratos segue
`docs/card-portraits.md`; portanto, receber fontes com formatos e recortes
diferentes não cria CSS diferente — produz assets canônicos diferentes para a
mesma grade.

Fechamento: a comparação visual alterou somente os nove estados que contêm
cartas (frente, verso e elenco nas três larguras); os outros 12/21 ficaram pixel
a pixel idênticos. `npm run validate` encerrou com **25/25 suítes verdes** em
184,2 s, sem mudar snapshot, golden, RNG ou balanceamento.

## 14. Refinamento final e verdade canônica — 31/07/2026

O responsável aprovou a A refinada e pediu um último ajuste de distribuição: a
foto deveria ganhar área pela descida/compactação da placa, **sem zoom**; as
informações precisavam ficar simétricas; a bandeira não poderia disputar espaço
com o time; e os quatro stats do verso deveriam voltar a ocupar a carta inteira.

O contrato final é:

- retrato fixo em `100% auto · 50% 12%`; diferença de fonte é resolvida no asset;
- placa com 24% acima de 176 px, 26% entre 151–176 px e 28% até 150 px;
- frente em três linhas: **nick + bandeira**, **role principal**,
  **role secundário + time**;
- nick e bandeira compartilham o mesmo centro vertical; a bandeira mantém
  distância mínima do time;
- nick normal em `clamp(13px, 10.5cqw, 27px)`, tracking comum de `-.025em` até
  176 px e corpo comum `clamp(12px, 10cqw, 27px)` até 150 px;
- nenhuma escala, classe, variável ou offset por jogador;
- role principal, role secundário, bandeira e time permanecem sempre visíveis;
- verso com quatro stats em largura integral, trilhos também integrais e bloco
  ocupando ao menos 35% da altura;
- campeonato/ano e colocação usam o rodapé reservado, sem comprimir os stats no
  centro;
- treinador permanece categoria própria dentro da mesma infraestrutura.

O E2E mede 153 cartas reais/sintéticas nas larguras 250, 188, 176, 151, 150,
149, 130 e 120 px. Além das provas anteriores, ele agora injeta falhas para
confirmar que detecta bandeira oculta, tipografia diferente, stat removido e
trilho com meia largura; também trava alinhamento bandeira/nick, afastamento do
time, largura dos stats e ocupação vertical.

### Portabilidade tipográfica

A primeira versão passou no Windows, mas FreeType/Linux mediu nomes longos de
forma diferente. Os commits `95bdb7c`, `1e6452c` e as guardas de fonte provaram
que a solução portável é universal: tracking compartilhado no intervalo
intermediário e corpo compartilhado no compacto. Não reintroduzir tratamento por
nick nem confiar apenas em `document.fonts.ready`; o E2E exige
`document.fonts.check` para `Chakra Petch 700`.

### Publicação e cache

O HTML do laboratório já recebia cache-busting, mas o Pages podia reutilizar um
`style.css` antigo e mostrar uma carta diferente da validada. `7175c26` passou a
versionar o CSS do protótipo pelo hash de conteúdo. O laboratório publicado em
`?cb=7175c26` carregou `style.css?v=39c71a6e` e repetiu zero falhas nas oito
larguras.

Fechamento remoto: execução `30652005186` verde, 25 suítes e deploy concluído.
A comparação visual permaneceu restrita aos mesmos 9/21 estados com cartas. A
retomada geral, o próximo lote de retratos e o roadmap recomendado estão em
`docs/retomada-2026-08-04.md`.

## 15. A escada volta a existir — 31/07/2026

O responsável olhou a escada no laboratório e disse que 14, 16 e 19 estavam
difíceis de diferenciar. Estavam mesmo, e não era percepção: **as três não tinham
moldura nenhuma.**

A causa é uma regra de pintura do CSS. O aro vinha de
`box-shadow:inset` na superfície de `.card`, e sombra interna é pintada **abaixo
dos filhos** do elemento. Desde que a carta ganhou faces, `.cfaces` cobre
`inset:0` de forma opaca — então o aro de 1px/1,5px/2px das faixas 1–3 nunca
chegou à tela. As faixas 4–6 escapavam por acidente: o cromado delas já morava num
`::after` com `z-index:7`, acima das faces. Na prática, 14/16/19 chegavam ao
jogador separadas apenas por um banho de 7–17% no retrato e pelo rótulo `OVERALL`
de 7px.

O conserto unifica as seis faixas numa mecânica só, no `::after`:

| variável | papel |
|---|---|
| `--aro` | espessura do anel |
| `--aro-pintura` | material: cor chapada nas faixas 1–3, cromado nas 4–6 |

A escada resultante é **chapada até 19, metálica a partir de 20** — o salto para
metálico passa a ser o momento visível da promoção:

| faixa | OVR | anel |
|---|---|---|
| `tier-1` | ≤14 | 1px, cinza frio a 44% |
| `tier-2` | 15–17 | 1,5px, verde a 82% |
| `tier-3` | 18–19 | 2px, **cobre** a 96% |
| `tier-4` | 20 | cromado ouro |
| `tier-5` | 21 | cromado sangue |
| `tier-6` | 22 | iridescente |

A faixa 3 deixou de ser âmbar e virou cobre por um problema criado pelo próprio
conserto: com anéis visíveis, âmbar e ouro cromado passaram a colidir a olho nu.
Cobre abre esse par sem invadir as seis famílias de cor reservadas às funções — e
a matriz de 36 combinações confirma que o anel de cobre não disputa com o coral do
`Entry`, porque função é **texto** e raridade é **moldura**.

O `box-shadow` morto saiu de `.card`, `.coachcard` e do `:hover`, junto com a
variável `--aro-a` que só ele consumia. O treinador não entra na escada e mantém a
moldura própria, segmentada a 45°.

Validação: `npm run check` e `npm run lint` verdes; o E2E aprovou 153 cartas nas
oito larguras, incluindo contraste 4,5:1 e ausência de halo externo; a comparação
visual mudou **9 de 21** capturas, exatamente os estados que contêm cartas, e
deixou as outras 12 pixel a pixel idênticas.

## 16. Refino do verso e uma tentativa descartada — 31/07/2026

Com a escada consertada, o responsável pediu refino de design na frente e no
verso. Duas notas de contexto que mudaram a prioridade: **todas as cartas terão
foto** — o Donk é protótipo, então investir no estado sem retrato seria trabalho
descartável — e o responsável deu carta branca de direção de arte.

Isso concentra o refino onde a foto nunca entra: **o verso**.

### O que estava errado no verso

- a faixa superior gastava 22% da altura só com o nick e sobrava oca;
- o verso era **anônimo**: virada a carta, não se sabia a função nem o time;
- os quatro trilhos eram tipograficamente idênticos, então `Firepower 100` e
  `Abertura 97` liam como duas barras iguais e a hierarquia sumia;
- sobrava um vão entre o último stat e o rodapé da era.

### O que mudou

- nasce `.c-vid`, a linha de identidade sob o nick: **função principal na cor da
  função + time apagado**, ecoando a hierarquia da frente. Ela preenche a faixa e
  torna o verso autossuficiente;
- o **Firepower**, que já era sempre o primeiro slot, passa a ser a âncora de
  leitura — rótulo, valor e trilho maiores que os outros três. É hierarquia do
  componente, não exceção por jogador: vale para as 85 cartas;
- a grade dos stats passa a `1.24fr` na primeira linha e os blocos foram
  reposicionados para fechar o vão do rodapé;
- na densidade compacta a ênfase do Firepower cede pela metade: mantida cheia, ela
  empurrava os trilhos contra o rótulo em cima e o rodapé embaixo a 120 px.

### A tentativa que foi descartada

Também testei reequilibrar a **frente**: a linha da função é a única sem
contrapeso à direita, então a bandeira desceria para o eixo dela e o nick tomaria
a largura inteira — o que de quebra dava ~14% mais espaço aos nicks longos, aliviando
a pressão tipográfica do compacto.

Renderizado, ficou pior. A bandeira colou no time e passou a ler como parte
**dele**, não do jogador. A bandeira pertence ao mesmo bloco que o nick: é quem a
pessoa é, não contexto. A grade da frente foi revertida e o motivo está escrito no
`style.css`, para ninguém repetir a tentativa achando que é melhoria óbvia.

### Prova

`check` e `lint` verdes; o E2E fechou 69 verificações nas oito larguras. A
comparação visual mudou **3 de 21** capturas — exclusivamente os versos em
desktop, tablet e celular — e deixou as outras 18 pixel a pixel idênticas, o que
confirma que a reversão da frente foi limpa.

O guarda de views congelava o verso por substrings e **não acusou** o elemento
novo; `tools/check-game-view-modules.js` ganhou a asserção da linha de identidade
para que ela não possa sumir em silêncio.

## 17. Simetria do verso e o vermelho do Rifler — 31/07/2026

Pedidos do responsável: tirar o filete acima do campeonato, igualar as margens
entre o playstyle e o campeonato, padronizar isso em **todas** as cartas, e trocar
o rosa do Rifler por um vermelho impactante que não se confunda com a faixa 21.

### O filete e a simetria

O filete saiu: o espaço em branco já separa os stats da era, e a linha competia
com os quatro trilhos logo acima dela.

A medição mostrou dois problemas, não um. O primeiro era o esperado — o vão de
baixo era **mais que o dobro** do de cima (14,2 px contra 31,8 px a 250 px). O
segundo não: o vão de baixo **variava de carta para carta** (10,4 a 20,6 px a
188 px). Causa: `.c-vrod` usava `min-height` + `justify-content:flex-end`, então um
campeonato de duas linhas subia o texto e um de uma linha descia. As cartas nunca
foram iguais nesse eixo.

Duas correções estruturais:

1. o rodapé passa a ser ancorado pelo **topo**, não pelo fundo. A primeira linha do
   campeonato começa sempre no mesmo y e a segunda cresce para o espaço reservado;
2. a caixa dos stats começa onde o bloco do playstyle termina e acaba onde o rodapé
   começa, com linhas `auto` e `align-content:center`. A folga sobrante se divide
   igual em cima e embaixo **por construção**.

Calibrar por percentual não resolveria: os corpos saturam no `clamp` enquanto a
caixa continua crescendo em %, então o que ficasse simétrico a 188 px abriria
7,6 px de diferença a 250 px. Restou um resíduo constante de ~2 px, compensado por
um `padding-top` — com conteúdo centrado, ele desloca o bloco por metade do valor.

Resultado medido nas 135 cartas do laboratório: diferença entre os dois vãos de
**0,02 a 0,55 px**, e idêntica entre todas as cartas em cada largura. A guarda
`equilíbrio stats/era` passou a medir até o texto do campeonato, e sua tolerância
caiu de "4 px ou 2,5% da altura" para **1 px**.

O respiro do verso virou o token `--vfolga`, aplicado **igual** acima e abaixo da
caixa: de um lado só, ele mesmo destruiria a simetria que a caixa garante.

### O vermelho

`Rifler` passou de `#ff5fd0` (magenta) para `#ff2038` (escarlate). Ele é mais
saturado e mais escuro que a tinta da faixa 21 (`#ff7a86`), e claramente mais frio
que o coral do `Entry` (`#ff7d4d`). O contraste de 4,5:1 continua aprovado nas oito
larguras.

### A divergência que isso revelou

`elencos.html` mantém a própria cópia das cores e dos cortes — é página autônoma e
não importa `style.css`. A troca para cobre da §15 **não havia sido replicada lá**:
o mesmo jogador aparecia âmbar na lista e cobre na carta, com a suíte verde.

Nasce `tools/check-roster-sync.js`, no `npm run check`: cobra as seis cores de
função, que o próprio `elencos.html` declara serem idênticas às da carta, e os
seis cortes de OVR. A cor de cada faixa não é cobrada — a lista pinta um selo com
texto por cima e precisa de contraste próprio, então usa um tom da mesma família.
Verificado que reprova: devolver o rosa à lista quebra a guarda.

## 18. A guarda media a caixa, não o texto — 31/07/2026

O responsável olhou o verso e disse que o bloco de stats **não estava centralizado**
entre o playstyle e o campeonato. A guarda dizia 0,00 px de diferença. Ele estava
certo e a guarda estava errada.

**Causa.** `equilíbrio stats/era` media `getBoundingClientRect()` — a caixa. A caixa
de `.c-st` inclui a faixa invisível acima do número (o valor tem corpo maior que o
rótulo e a linha o centraliza), enquanto a caixa do playstyle não tem folga
equivalente. Medindo o TEXTO RENDERIZADO por `Range`, a diferença real era de até
**3,03 px** — uma assimetria visível atravessando uma guarda verde.

É o mesmo defeito que a §17 corrigiu em outro lugar: **um medidor que não mede o
que o olho vê é um medidor que aprova o errado.** A guarda passou a comparar, por
`Range`, o fim do playstyle ao começo do rótulo do primeiro stat, e o fim do último
trilho ao começo do campeonato.

Resultado nas oito larguras, depois de recalibrar o `padding-top` contra a métrica
correta: diferença entre **+1,16 e −0,97 px**, e idêntica entre as 135 cartas em
cada largura. A tolerância da guarda é 1,5 px — o resíduo é artefato de métrica de
fonte, não de layout.

### Os outros pedidos do mesmo ciclo

- **stats muito juntos**: `gap` de `clamp(2px,1.5cqw,4px)` para
  `clamp(3.5px,2.8cqw,7.5px)`;
- **DONK pequeno demais no verso**: `.c-vnick` de `clamp(11px,10cqw,22px)` para
  `clamp(12px,11cqw,23px)`, e a linha de identidade de `clamp(6.5px,4.3cqw,9.5px)`
  para `clamp(7.5px,5cqw,11px)`;
- crescer só o nick reprovou a guarda `hierarquia playstyle/nick`, que exige o
  playstyle ≥1,14× o nick. **A guarda estava certa** — o playstyle é a espinha do
  verso. Cresceram os dois: `--t-style` foi para `clamp(15px,13.2cqw,27px)`, e a
  razão fica entre 1,17 e 1,25 em todas as larguras;
- **vermelho forte demais**: `Rifler` de `#ff2038` para `#f04a5e`. Contraste 4,5:1
  segue aprovado nas oito larguras.

## 19. Treinador: o espelho vertical, e por que ele foi descartado — 31/07/2026

> **Estado vigente: seção 19.4.** As seções 19 a 19.3 registram o caminho — o
> espelho tentado, o defeito de eixo único, a volta à grade do jogador e a
> reformulação do verso. O contrato em vigor é o espelho vertical **de aresta
> reta**, decidido pelo responsável depois de ver as duas versões no ar.

### 19.0 A direção tentada

A distinção anterior havia virado uma segunda anatomia: placa reta de 44%, corpos
maiores e eixos próprios no verso. A direção aprovada é mais simples: **a carta do
treinador é a carta do jogador espelhada verticalmente na frente**.

- a placa usa os mesmos 24%, 26% e 28%, mas nasce no topo;
- o bloco completo de identidade muda da base para o topo e o OVR vai para a base;
- nick, bandeira, característica e time usam a mesma grade frontal;
- no verso, nick, linha `TREINADOR · TIME`, característica, corpo e era ocupam os
  mesmos eixos e reservas da carta de jogador;
- a única diferenciação estrutural preservada é a moldura segmentada/serrilhada;
  a cor continua vindo da característica e não entra na escada de raridade.

O laboratório passou a comparar cada coach com uma carta de jogador na mesma
largura: âncoras espelhadas da frente, altura da placa, quatro eixos do verso,
limites do corpo e altura da faixa. Uma prova sintética desloca frente e verso e
confirma que a guarda reprova. O OVR inferior também é medido sobre o retrato real
de hally: a proteção universal da base elevou o pior contraste de **2,14:1** para
**10,13:1**, acima do contrato de 4,5:1 sem ajuste por treinador.

### 19.1 O espelho tinha um eixo só — correção de 31/07/2026

O espelhamento acima foi publicado com um defeito visível e um defeito de método,
e os dois têm a mesma raiz: **as dez guardas do treinador eram todas verticais**.

O defeito visível: o time parava a ~42% da largura, no meio da carta, em todos os
18 treinadores e nas oito larguras. A faixa de contexto declara duas colunas
porque o jogador põe função secundária à esquerda e time à direita; o treinador
não tem função secundária, então `.c-role2` é ocultado e o time ficava sozinho na
**primeira** coluna — onde `justify-self:end` o ancorava no fim DELA, não no fim
da carta. Medido: 105,5 px de folga a 250 px e 52,2 px a 120 px.

A correção é uma linha, e vale para a categoria inteira, sem exceção por pessoa
ou por time: `.coachcard .c-team{grid-column:1/-1}`.

O defeito de método é o que importa preservar. O medidor dizia `falhas=0
ritmo=0` com isso na tela, porque comparava topo da identidade, base do OVR,
altura da placa, quatro eixos do verso, limites do corpo e altura da faixa —
**nenhuma medida no eixo x**. A única guarda que tocava o time apenas conferia se
o nó estava *visível*, nunca *onde*. Um espelho vertical não dispensa a prova de
que o eixo horizontal permaneceu idêntico; ele a exige, porque é justamente o
eixo que ninguém está olhando.

O laboratório ganhou a bateria `espelho horizontal · <campo>`, que compara com a
carta de jogador de referência a borda que é contrato de cada campo: nick e
característica pela esquerda, bandeira e time pela direita, faixa de contexto
pelas duas. Ela foi verificada **reprovando** antes da correção — 144
apontamentos, 18 coaches × 8 larguras, todos e somente em `time (direita)`, o que
também provou que os demais campos já espelhavam certo. A prova sintética do E2E
reencena exatamente esse defeito devolvendo o time à primeira coluna.

### 19.2 Contrato vigente: a frente do treinador é a frente do jogador

Com o eixo horizontal enfim medido, ficou visível que o problema não era o
alinhamento do time: era o espelho. Ele foi descartado no mesmo dia.

**Por que um espelho exato dá uma carta errada.** A carta é simétrica; a
fotografia não é. O recorte de runtime `100% auto · 50% 12%` põe o rosto no terço
superior justamente porque a placa mora nos 24% de baixo. Espelhar a placa para o
topo a coloca sobre a cabeça de **todo** retrato — não é defeito do retrato do
hally, é consequência estrutural, e valeria para cada treinador que entrasse. O
OVR, empurrado para a base sobre a roupa, só sobrevivia com uma vinheta de
10,13:1 que apagava metade da foto. Precisar de 10:1 para um elemento existir
onde está não é problema de contraste: é o elemento no lugar errado.

E o espelho não comprava nada. A distinção de categoria já vinha da moldura
serrilhada e da cor da característica, e nenhuma das duas depende do eixo.

**O que vale agora.** Frente do treinador = frente do jogador, sem exceção
geométrica: placa nos 24% de baixo com a identidade, OVR no topo, mesma vinheta,
mesmo recorte. A categoria se anuncia por material e cor — moldura serrilhada a
45°, fio serrilhado, `--r` vindo da característica e o rótulo `TREINADOR` sob o
OVR. Medido no laboratório, os dois perfis frontais ficaram idênticos linha a
linha, e o OVR do coach sobre o retrato real do hally passou a marcar 6,08:1 com
a vinheta comum, sem nenhuma proteção extra.

A duplicação também caiu: `.coachcard .cfaces` reescrevia à mão sete tokens que
já existiam em `.cfaces`/`.card .cfaces`, e `.coachcard .c-placa` repetia o
gradiente da placa com o ângulo invertido. Hoje o treinador entra nas mesmas
regras e ajusta só `--wash`. Mudar um token do jogador não deixa mais o treinador
para trás em silêncio.

A guarda acompanhou: `espelho frontal` e `espelho horizontal` viraram uma bateria
só, `grade compartilhada · <campo> (<borda>)`, que compara os **quatro** lados de
oito campos contra a carta de jogador de referência, com as bordas que são
contrato de cada campo declaradas item a item.

### 19.3 O verso do treinador passa a ler o motor — 31/07/2026

O verso já usava os eixos e as reservas do jogador, e mesmo assim parecia
inacabado. A medição explicou: a reserva do corpo tem 44,8% da altura da carta
porque foi dimensionada para **quatro trilhos de stat**, e o treinador punha ali
uma única frase centrada. A tinta ocupava **40%** a 250 px, com 13,4% de vazio
acima e 13,7% abaixo — vazio simétrico, que é o pior, porque parece proposital e
inacabado ao mesmo tempo.

Ao investigar o que poderia preencher, apareceu um defeito mais sério. A frase
reescrevia à mão constantes do motor: `15%`, `30%`, `5%`, `18%`, `4%` e o `+1`
viviam em `CFG_QUIMICA.CARAC` (`src/domain/chemistry/team-chemistry.mjs`) e
também, em prosa, em `card-view.mjs`. Rebalancear a química deixaria a carta
mentindo em silêncio, sem nenhuma guarda reprovando — num projeto que criou
`check-roster-sync` exatamente para impedir CSS e dados de divergirem.

As duas coisas se resolvem juntas:

- a frase perdeu todo número e passou a dizer só o que a característica faz;
- os valores viram **duas linhas** `rótulo · valor`, lidas vivas da tabela por
  `COACH_RECIPE`, injetada como `coachRecipe` no mesmo contrato do `STYLE_RECIPE`
  — quem calibra a química move a carta junto;
- são sempre duas linhas nas quatro características. Motivador tem um corte só,
  mas ele incide de fato sobre cobertura e saturação: as duas linhas dizem a
  verdade, não repetem por enfeite. A silhueta do verso não pode depender de
  quantas alavancas a química deu a cada treinador.

As linhas usam a métrica dos trilhos do jogador — rótulo à esquerda, valor à
direita, filete separando — e por isso o verso do treinador voltou a ter o mesmo
ritmo do verso do jogador. Sem barra: um corte percentual não é um medidor de 0 a
100, e uma barra ali mentiria sobre a escala. A ocupação da reserva saiu de 40%
para acima de 90% em todas as larguras.

**Duas armadilhas de layout no caminho, ambas pegas por guarda nova.** Ancorar
frase no topo e números na base fechava 101% de ocupação e abria um buraco único
no meio da carta, além de deixar a última linha a 2,4 px do rodapé — passando na
guarda de colisão, que só reprova sobreposição. E a 120 px o conjunto estourava a
reserva em 7 px. Vieram daí duas provas: `linhas de efeito`, que exige as duas
linhas **visíveis**, e `respiro antes do rodapé`, medido na **tinta** e não na
caixa, com piso no respiro do próprio jogador — uma régua que não pode ser
afrouxada sem afrouxar a carta canônica junto.

O contrato do dado é congelado em `tools/check-game-view-modules.js`: a view é
montada com uma receita de valores propositalmente falsos e o teste exige que
sejam eles a aparecer, que a frase **não** contenha dígito e que, sem receita, as
linhas sumam e a frase permaneça.

### 19.4 Espelho vertical de aresta reta — 31/07/2026

Com as duas versões publicadas e vistas no ar, o responsável escolheu o espelho —
OVR no canto inferior esquerdo, bloco de identidade no topo — **com a aresta da
placa reta**. É a peça que faltava nas tentativas anteriores, e ela muda o
diagnóstico da seção 19.2: o que brigava com o retrato não era só a posição da
placa, era a diagonal apontando para o lado errado.

A diagonal é assinatura da carta de **jogador**: ela sobe da esquerda para a
direita e fecha contra o canto do OVR. Espelhada para o topo do treinador, ela
apontava contra a moldura serrilhada e criava um canto ocupado demais. Reta, a
faixa vira uma régua horizontal, e a moldura a 45° fica sendo a única silhueta
exclusiva da categoria — que era a intenção desde o começo.

A mesma régua vale no verso: `.c-vfaixa` e `.c-vfio` do treinador também perdem o
`clip-path`. Frente e verso passam a cortar na horizontal, na mesma altura
relativa. O corpo do verso, descrito em 19.3, não mudou.

**O que se aprendeu sobre a vinheta.** A proteção do OVR inferior voltou, porque
na base o retrato mostra roupa e não fundo — sobre o casaco do hally o contraste
cai a 2,14:1. Mas ela agora é calibrada **para o contrato**, 5,9:1 contra o piso
de 4,5:1, e não para o máximo possível. A versão de julho chegava a 10,13:1 e
pagava isso apagando a metade inferior de todo retrato. Um número muito acima do
contrato não é folga de segurança: é sintoma de que se está compensando outra
coisa.

**O que se aprendeu sobre a guarda.** A bateria de espelho precisa de duas
réguas, não de uma. Só o mobiliário de primeiro nível — placa, bloco de
identidade e OVR — troca de ponta em relação à carta. Dentro do bloco nada
espelha: o nick lidera em cima nas duas categorias, senão a carta do treinador se
leria de baixo para cima. Medir os filhos com a régua do espelho acusava 16,7 px
de desvio no nick — desvio que era da régua, não da carta. Hoje os filhos são
medidos contra a caixa do próprio bloco, mesmo lado, e as duas réguas convivem na
mesma bateria. A aresta reta ganhou guarda própria: `clip-path` não altera a
caixa, então nenhuma medida de retângulo pegaria uma diagonal de volta.

### 19.5 CONTRATO VIGENTE da carta de treinador — 31/07/2026

Estado final do ciclo. Tudo acima nesta seção 19 é histórico do caminho; **é isto
que está publicado e provado**.

**Frente.** Ela não usa mais a grade de três linhas do jogador — essa grade existia
para carregar função principal, secundária e time, e o treinador só tem
característica e time. A frente **replica o bloco do verso**: os mesmos
`.c-vnick` e `.c-vid`, trocando apenas o rótulo — característica na frente,
`Treinador` no verso. Como a placa da frente tem a altura da faixa do verso
(`--placa-n:var(--faixa-n)`), os dois blocos caem no mesmo lugar sem nenhuma regra
de posição nova. **Sem bandeira**, por decisão do responsável.

**OVR.** Volta a ser o do jogador — mesmo corpo, mesmo recuo, rótulo `OVERALL`
solto embaixo — movido para a base e tingido pela característica. A categoria
virou `.c-cat`, faixa cromada própria colada na borda inferior, de largura total.
Separar os dois elementos eliminou os remendos que a faixa exigia quando dividia a
caixa do OVR: largura cheia, `text-indent` e margem negativa saíram todos.

**Moldura.** O serrilhado a 45° foi removido. Ele sobrevive só nas réguas
horizontais sob a placa e sob a faixa do verso. A borda usa `--aro`/`--aro-pintura`,
a mesma mecânica das seis faixas de raridade — o treinador não tem mais regra
própria de borda. O cromo é um token único (`--cromo-pintura`) servido a dois
consumidores, faixa e aro.

**A carta de jogador não mudou em nada neste ciclo.** Ela não tem cromo; o rótulo
do OVR dela continua sendo texto solto sob o número.

**Verso.** Corpo centrado na reserva, o mesmo mecanismo dos quatro trilhos do
jogador — foi isso que devolveu o afastamento entre a característica e o texto.
Ancorado no topo, a tinta começava a 0% da reserva enquanto a do jogador começa
2,9% a 7,4% da altura da carta abaixo do topo.

Medidos lado a lado a 250 px, os dois versos coincidem em todos os eixos: faixa
22%, nick 5,5–12,1%, identidade 15,5–18,6%, corpo 40,1–84,9%, rodapé 86–96%.

### 19.6 A régua de tipografia: medir a folga, nunca estimar o teto

Esta é a lição mais cara do dia e vale para qualquer texto da carta.

O `Estrategista` foi calibrado em 0,9 com um teto **estimado** a partir de uma
largura de glifo chutada. Passou no Windows com 5,4 px de folga e o CI Linux
reprovou com 5,4 px de estouro. Medido depois: o FreeType renderiza aquele mesmo
rótulo cerca de **10,8 px mais largo** a 120 px.

A régua correta é a folga **medida** na largura mais apertada, e ela precisa
cobrir o delta com sobra. Os fatores vigentes de `escalaCarac` são 1 / 0,80 / 0,70
e deixam 40,9 / 15,7 / 11,0 px de folga a 120 px.

Não aumente esses fatores sem medir de novo. A 120 px a caixa tem ~97 px para uma
palavra de 12 caracteres; o caminho para crescer mais é encolher o corpo **por
faixa de densidade**, como o resto da carta já faz, nunca abrir exceção por nick.

## 20. O cromo do treinador: um material, quatro matizes — 02/08/2026

O responsável apontou, olhando as quatro cartas de treinador lado a lado no
laboratório: **o ouro lê metal; o ciano e o azul leem plástico neon.** Todas
usavam exatamente o mesmo `--cromo-pintura`, com as mesmas paradas de gradiente.
O material era um só no código e quatro na tela.

### O que a medição mostrou

Convertidas para OKLCh, as quatro cores de característica:

| característica | base | croma | leitura |
|---|---|---:|---|
| gestor | `#c9a36a` | 0,087 | metal |
| estrategista | `#2fd6d6` | 0,128 | plástico neon |
| motivador | `#c79bff` | 0,146 | — |
| desenvolvedor | `#4a82ff` | 0,195 | plástico neon |

A ordem do croma reproduz exatamente o veredito perceptual, e o gestor — o único
abaixo de 0,09 — é o único que lê metal.

A hipótese inicial era "croma baixo **mais** amplitude de luminância alta". **O
número desmentiu a segunda metade**: o desenvolvedor tem a MAIOR amplitude de
claro/escuro que o gradiente consegue produzir (0,194 contra 0,161 do gestor) e
era o pior dos quatro. É croma sozinho. Metal é quase acromático com um
tingimento; nenhuma escada de gradiente salva uma base saturada.

### A correção

Quatro tokens novos em `:root` — `--c-<carac>-metal` — são as mesmas cores com
croma normalizado em **0,087**, preservando luminância e matiz. O gestor é a
régua e por isso **não mudou um bit**. `--cromo` passou a ler `--cc-metal` em vez
de `var(--r)`.

A separação que isso estabelece vale além do treinador: **cor de texto pode ser
saturada, porque ali saturação é identidade; superfície não pode.** As cartas
continuam distinguíveis pelo matiz — é o material que deixou de variar.

Contraste da tinta escura da faixa `.c-cat` sobre o pior degrau do gradiente,
antes → depois: gestor 6,88 → 6,88, estrategista 8,95 → 8,81, motivador
7,37 → 7,51, desenvolvedor 4,64 → 4,74. O piso de 4,5:1 se mantém nos quatro, e o
desenvolvedor, o mais apertado, melhorou.

### A guarda

`medirCartas()` passou a calcular o croma OKLCh da cor **pintada** em `.c-cat` —
não do token, que poderia divergir do que o navegador desenha. Duas linhas:

1. teto por carta: croma ≤ 0,10;
2. deriva entre cartas: amplitude ≤ 0,02, porque quatro valores podem ficar sob o
   teto e ainda assim em materiais distintos.

Verificada reprovando: reintroduzir `--cromo:var(--r)` produz **14 falhas** — 13
cartas acima do teto (0,20) e a deriva em 0,1086 contra o limite de 0,02.


## 21. Medir a linha não é medir o glifo — 02/08/2026

O responsável olhou a carta de treinador no laboratório e disse duas coisas: há
uma linha branca acima da faixa `TREINADOR`, e o espaço entre a faixa e `HALLY` é
maior que o espaço entre `ESTRATEGISTA` e a borda de baixo. **A guarda de simetria
estava verde.** Ele estava certo e a guarda estava cega.

### A régua estava errada

`Range.getBoundingClientRect()` devolve a caixa da FONTE — do `ascent` ao
`descent` — não a linha nem a letra. Aferido contra a linha de base real, com um
`span` de altura zero e `vertical-align:baseline`: a caixa começa exatamente
`fontBoundingBoxAscent` acima da base. A maiúscula ocupa só o miolo dela.

Como o nick tem corpo quase o dobro da característica, o espaço morto de cima é
quase o dobro do de baixo. Igualar caixas desiguala letras:

| largura | a guarda via | o olho via |
|---|---:|---:|
| 250px | 0,22 px | **6,22 px** |
| 188px | 0,20 px | 5,80 px |
| 150px | 0,33 px | 3,67 px |
| 120px | 0,08 px | 3,08 px |

A sequência completa da lição, agora com três degraus: **caixa do elemento →
caixa da fonte → glifo.** Os dois primeiros já custaram retrabalho antes.

### A régua nova

`glifoDe()` no laboratório monta a medida a partir da fonte REAL de cada elemento
e da string REALMENTE renderizada, com `text-transform` aplicado. Uma constante
única não serve, e foi por aí que eu errei antes de aferir: a carta mistura
Chakra Petch e Barlow, e maiúscula não tem descendente. Uma medição intermediária
minha chegou a acusar 11–25 px de defeito no verso do treinador — era a constante
de uma fonte aplicada ao texto da outra.

### Frente do treinador

O culpado era o `padding-top:1.85cqw` que existia para "corrigir a tinta que
sobe". Ela não subia: com padding nenhum o desequilíbrio natural é de −0,5 a
−1,9 px. O padding era a ORIGEM dos 3 a 6 px, calibrado contra a régua que não
enxergava o próprio erro.

Refeito em dois degraus, em fração de `--t-carac` — o desvio nasce do espaço
morto da caixa da fonte, proporcional ao CORPO do texto, e o corpo satura no
`clamp` enquanto `cqw` continua crescendo. Os coeficientes são centrados na faixa
de erro, não ajustados ao melhor caso: sobra ~1 px de quantização de pixel que
nenhum valor elimina, e centrar leva o pior caso de 1,00 px para 0,55 px.

Resultado: **0,02 a 0,55 px** nas oito larguras, contra teto de 0,75.

### A linha branca

`inset 0 1px 0 rgba(255,255,255,.55)` na `.c-cat`, pretendendo ser reflexo
especular. Na tela lia como um traço solto acima da faixa. O gradiente do cromo já
começa claro e faz o brilho sozinho. A sombra interna de baixo fica: é ela que
assenta a faixa sobre a placa.

### A varredura: onde mais isso acontecia

A regra é específica: **só quebra quando o vão compara dois corpos diferentes.**
Para um elemento sozinho o centro da caixa e o centro da letra coincidem em
~0,01em, porque `ascent − descent ≈ cap height` — é por isso que o alinhamento
bandeira/nick nunca esteve torto e não precisou mudar.

Os dois versos tinham o mesmo defeito, e o do treinador era pior:

| face | a guarda via | o olho via |
|---|---:|---:|
| verso do jogador · stats/era | 0,03–1,28 px | 6,3–8,9 px |
| verso do treinador · corpo/era | proxy interno, sempre verde | 1,9–5,9 px |

Nos dois casos o `padding-top` existente **piorava** o desnível em vez de
corrigi-lo, pelo mesmo motivo da frente.

### Uma regra para as duas categorias

O verso do treinador media "conteúdo centrado dentro da reserva", pelas caixas —
um proxy interno que ficava verde com o bloco visivelmente alto, porque a reserva
não é o que o olho compara. Ele passou a cobrar exatamente o que o jogador cobra:
**o vão acima do bloco central igual ao vão abaixo dele**, medido na letra.

- jogador: playstyle → primeiro rótulo, contra último trilho → campeonato;
- treinador: característica → frase, contra última linha → campeonato.

O jogador precisou de três degraus de densidade. O treinador **não precisou de
nenhum**, e a razão é a parte interessante: com a característica em corpo cheio o
desvio dele já era 0,05 px. O desequilíbrio inteiro vinha de `--carac-esc`, o
encolhimento por comprimento — como `.c-vestilo` é ancorado pelo TOPO, um corpo
menor SOBE a linha de base e abre o vão acima do texto. A 151 px isso vai de
0,05 px em `Gestor` a 5,06 px em `Desenvolvedor`.

Por isso a correção do treinador é proporcional a `(1 − carac-esc)` e não à
largura, e o fator sai da métrica da fonte: a linha de base desce `ascent` mais
meia entrelinha do topo da caixa, o que na Chakra Petch com `line-height:.95` dá
.99 − .175 ≈ .85 do corpo. O ajuste dos dados pediu .878.

### O piso do rodapé precisou ser reancorado

Havia um contrato deliberado: o treinador respira antes do rodapé ao menos tanto
quanto o jogador, usando o jogador como referência para não inventar um número.
**Ele ficou logicamente impossível.** Com as duas cartas simétricas, os respiros
não podem mais ser iguais entre categorias: o corpo do treinador é mais alto que
os quatro trilhos, sobra menos espaço livre, e cada metade dele é obrigatoriamente
menor. Exigir paridade passaria a exigir assimetria em uma das duas.

A régua nova levou duas tentativas, e a tentativa falha vale registro:

1. **a simetria não pega o defeito.** Ancorar frase e números nas duas pontas
   desloca os dois vãos pelo mesmo tanto — a diferença continua zero;
2. **a repartição do espaço livre também não pega.** `space-between` ESTICA o
   conteúdo em vez de empurrá-lo: medido, ele vai de 68,6 px para 107,5 px numa
   reserva de 112,8 px, e a folga some em vez de mudar de lado;
3. **o recuo até a aresta de baixo pega.** Como fração da reserva — que é a mesma
   nas duas categorias e nas oito larguras — os treinadores ficam entre 9,7% e
   23,1% e o layout que falhou dá 2%. Piso em 6%.

### O CI derrubou a primeira tentativa de teto — e a lição é de método

Publicado, o Linux reprovou `equilíbrio corpo/era do treinador` com **3,27 px**
onde o Windows media 2,27 px. O teto estava em 2,5 px: margem de 0,23 px sobre um
resíduo que eu **não sabia explicar**. Isso é erro de método, não de número — o
projeto já registra que o FreeType mede diferente, e teto apertado sobre resíduo
inexplicado não sobrevive à travessia de plataforma.

A primeira reação foi reverter a correção do verso. Estava errada também: medido o
pior caso real, sem correção o desnível do treinador chega a **7,92 px**
(`dastan`, 176 px) — os "1,9 a 5,9 px" que eu tinha em mãos eram a mediana, não o
pior caso. Reverter trocaria 3,27 px por 7,92 px.

O teto certo fica entre duas medidas: **acima** do resíduo com correção somado à
diferença de plataforma, e **abaixo** do defeito sem correção — senão a guarda
para de saber reprovar. Ficou em 5 px para o treinador e 3 px para o jogador.

Nenhum dos dois é afrouxamento dos números antigos: 1,5 px e 0,35 px valiam sobre
a CAIXA, que é outra grandeza. Sobre a letra, esses tetos cobram um desvio que
antes passava inteiro.

### Dívida declarada

Os tetos são **5 px** no treinador e **3 px** no jogador, e a diferença entre
eles é dívida. Isso é dívida, não conforto: sobra 2,27 px numa única combinação —
176 px com `Desenvolvedor`. A mesma carta a 151 px fica em 0,19 px, então não é o
modelo de `--carac-esc` que falha. É a faixa 176/151, que já tinha mostrado
~1,2 px de quebra inexplicada nas DUAS categorias quando os coeficientes foram
derivados; enquanto ela não for entendida, nenhum coeficiente fecha 176 sem abrir
151. O certo é achar a causa e igualar os dois tetos em 3 px.

### Prova

Todas as guardas foram verificadas REPROVANDO, não só passando. Desfeitas as
correções: 135 falhas em `equilíbrio stats/era` (pior 10,22 px) e 11 em
`equilíbrio corpo/era do treinador` (pior 7,32 px). Reintroduzido o padding antigo
da frente: 18 falhas de `respiro simétrico`. O E2E fecha nas oito larguras.

## 22. A guarda que só olhava uma categoria — 02/08/2026

A §21 consertou a simetria da frente do treinador e criou a guarda para ela. A
guarda nasceu **dentro do ramo `if(coachcard)`** do laboratório. O jogador nunca
foi medido nesse eixo, e o mesmo defeito estava lá — em 135 das 153 cartas.

É a §19.1 um nível acima. Lá a lição foi *uma guarda só vê o eixo que ela mede*;
aqui ela ganha a segunda metade: **e só na categoria em que ela roda**.

### A régua errada, de novo — e desta vez o E2E pegou

A primeira medição comparou o respiro contra `placa.getBoundingClientRect().top`
e acusou 4,89–12,59 px de desequilíbrio. Com esse número a placa parecia inchada
— 13,2% de tinta dentro de 24% —, e a correção foi encolhê-la para 22/22,5/24 e
centrar o bloco.

**O E2E reprovou em 130 px e 120 px**: `respiro diagonal · frente`, com o nick a
1,2–1,7 px da diagonal. O motivo é que no jogador a placa é cortada em diagonal,
então a aresta VISÍVEL não é o topo da caixa: no eixo do nick ela corre
`--corte-n × (1 − --pad) = 8,19%` da altura da placa abaixo dele. O treinador tem
`clip-path:none` e por isso a guarda dele estava certa desde sempre.

Contra a aresta visível o defeito era **1,1 a 3,7 pontos da carta** — real, pior
na costura compacta, mas metade do que a caixa dizia. E a conclusão se inverteu:
a placa **não estava inchada**. Aquele ar era folga que a diagonal cobra.

Terceira aparição da mesma família de erro neste componente:

| ciclo | régua errada | régua certa |
|---|---|---|
| 31/07 §18 | `getBoundingClientRect` | `Range` |
| 02/08 §21 | caixa da fonte (`ascent`→`descent`) | glifo (`actualBoundingBox`) |
| 02/08 §22 | topo da caixa da placa | aresta visível (a diagonal) |

### O que ficou

- a guarda subiu para o trecho compartilhado e roda nas **duas** categorias;
- o jogador centra entre a **diagonal** e a base, por `--diag-k`; o treinador
  continua centrando na caixa, porque a aresta dele é reta;
- a placa foi de 24/26/28 para **24,5 / 26,5** — quase sem mudar, porque o
  conserto é centrar, não encolher. A densidade intermediária perdeu o degrau
  próprio: medida, ela pede o mesmo valor da ampla;
- **sem coeficiente de correção residual.** `align-content:center` sozinho leva
  o desvio a 0,03–1,46 px, e o que sobra não é proporcional a corpo nenhum: 0,03
  px a 130 px contra 1,02 px a 120 px. Calibrar contra isso seria calibrar ruído
  de subpixel — o erro da §21. O teto da guarda absorve;
- tetos: **0,75 px** no treinador (2 linhas, 1 gap) e **3 px** no jogador
  (3 linhas, 2 gaps), acima do resíduo mais a diferença de plataforma e bem
  abaixo do defeito, que começava em 3,85 px.

### O topo do verso também não tinha dono

Nick, `.c-vid` e `.c-vestilo` eram três âncoras percentuais independentes
(5,5% · 15,5% · 27,5%), e a guarda do verso começa no playstyle — o bloco acima
dele nunca foi medido. Resultado: a razão entre o vão nick→identidade e o vão
identidade→playstyle variava **1,37× a 2,84×**, e despencava na costura de
150 px, onde `.c-vestilo` sobe para 25,5% enquanto `.c-vid` descia para 16% —
os dois na direção contrária.

Nick e identidade são a mesma unidade: quem joga e por quem. Proximidade é o que
agrupa, então `.c-vid` passou a ser posicionado em fração do CORPO do nick
(`--k-vid`, com degrau na densidade compacta pelo mesmo motivo que o resto da
carta tem). Medido: razão de **2,23× a 2,59×** na faixa que o jogo entrega, e a
costura ficou contínua (2,41 → 2,52).

`.c-vestilo` **não se moveu**: o bloco inferior tem simetria calibrada por degrau
e dívida declarada na §21; mexer nele é outra fatia, com recalibração própria. É
por isso que a razão ainda sobe a 3,05× em 250 px, largura que só o laboratório
usa — ali `--t-vnick` satura no teto de 23 px enquanto a carta continua crescendo.
Fechar isso exige ancorar `.c-vestilo` ao corpo também.

### Tokens mortos

`--b1`, `--b2` e `--b3` saíram. A grade de identidade tornou `.c-nick` e
`.c-func` `position:static`, o que deixou os três sem consumidor real. Provado
por mutação, não por leitura: valores absurdos moviam **0 de 279** medidas,
contra 156 do controle. `--b1` sobreviveu até a centragem do jogador e caiu junto
— 0 de 160. Saíram também os valores `--t3:6.2cqw`/`--t4:4.5cqw` de `.cfaces`,
que `.card .cfaces` sobrescreve em toda carta que existe.

O `:root` já tinha passado por essa limpeza em 01/08; a geometria da carta não.

### Prova

Guardas verificadas **reprovando**. Desfeita a centragem do jogador: 135 falhas
de `respiro simétrico` em 4 das 8 larguras, pior **13,01 px** a 150 px. Placa
inflada para 45%: 306 ocorrências, as duas categorias. Diagonal aprofundada para
22%: 405 ocorrências, incluindo `respiro diagonal · frente`.

`npm run lint` e `npm run check` (17/17) verdes, E2E de cartas verde nas oito
larguras e no jogo real. Comparação visual: **9 de 21** estados mudaram, todos os
que contêm cartas; os outros 12 ficaram pixel a pixel idênticos. O treinador não
mudou um pixel — as medidas dele são idênticas antes e depois.

## 23. A grade que decidia a carta, e ninguém media — 02/08/2026

As oito larguras do laboratório provam a CARTA. Nada provava a **grade** que
escolhe essa largura no jogo. Dois defeitos moravam aí, com a mesma raiz: a
largura era consequência do contêiner, e os dois contêineres eram diferentes.

### As duas grades nunca coincidiram

`.picks` era filho direto de `.wrap`; `.lineup` mora dentro de `.squad`, que tem
`padding` e borda. Medido: 4,3 px de diferença no desktop e até 13 px a 320 px.
Em três faixas de viewport isso jogava as duas em **densidades diferentes** — a
588 px a carta escolhida ficava em densidade completa e a escalada em média, uma
acima da outra, com corpos e placa diferentes. É a "exceção por carta" que o
contrato proíbe, produzida pela grade em vez do CSS da carta.

A correção não é padding parecido, é a **mesma caixa**. `.picks` ganhou o mesmo
`--grade-pad` e uma borda transparente de 1 px: com `box-sizing:border-box` a
borda do `.squad` fazia a caixa dele medir 2 px a menos, e com `auto-fill` esses
2 px não somem no arredondamento — a 420 px eles bastavam para uma grade caber em
3 colunas e a outra em 2.

### A carta ia abaixo do piso provado

A escada 6→3→2 colunas trocava em 640 px e 360 px. Entre os degraus a carta
encolhia sem piso: medido no jogo real, **105,7 px a 641 px e a 375 px** — abaixo
dos 120 px que o E2E prova, em duas faixas largas (tablet retrato inteiro e
iPhone SE). E 105,7 px era um piso DURO: `min-height:148px` × 5/7. Ao bater nele
a carta parava de encolher e o `.squad` transbordava, escondido pelo
`overflow-x:hidden` do body. Atravessar 641→640 px levava a carta de 105,7 px a
192,7 px: **82% num pixel**.

`auto-fill` com `minmax(max(--carta-min,15%),1fr)` resolve os dois: o número de
colunas passa a ser CONSEQUÊNCIA da largura mínima, não um degrau escolhido. A
grade solta uma coluna exatamente quando a carta cairia abaixo do piso, e nunca
antes. A percentagem segura seis colunas no desktop; o piso assume quando a tela
estreita. Nenhuma media query de coluna sobrou.

### Medido depois, em 38 viewports de 300 a 1440 px

| | antes | depois |
|---|---|---|
| menor carta | 96,8 px | **120,4 px** |
| faixa de tamanho | 96,8–201 px | 120,4–184 px |
| maior salto ao trocar de coluna | +82% | +45% |
| viewports com grades divergentes | 3 faixas | **nenhuma** |
| overflow do `.squad` | sim, escondido | **nenhum** |

O salto de +45% é o 3→2 colunas e é inerente à razão entre elas: com 6 itens, só
6, 3 e 2 dão linhas cheias, e restringir a esses três força um salto de ~2×.
Colunas balanceadas e ausência de penhasco são mutuamente exclusivas aqui —
escolhi o piso, porque abaixo dele não há nada provado.

Efeito colateral aceito: em 5 e 4 colunas a última linha fica incompleta. Em 5
ela é exatamente `5 jogadores + treinador`, que é a estrutura semântica do HTML.

### A guarda

Duas provas novas no E2E, sobre 15 viewports: as duas grades compartilham coluna
e densidade, a carta nunca fica abaixo de 120 px, nem o documento nem o `.squad`
transbordam, e nenhuma troca de coluna muda a largura em mais de 55%.

Verificadas **reprovando**: devolvida a borda só ao `.squad`, acusa a 540 px;
devolvida a escada 6/3/2, acusa carta de 118,7 px a 820 px e salto de 74%.

Uma terceira asserção mudou de forma junto: `jogo real usa a mesma densidade
canônica` cravava a densidade compacta a 390 px. Isso só era verdade porque a
grade entregava 105,7 px ali. Agora a densidade é **derivada da largura medida** —
cravar valor por viewport transformaria a correção em reprovação.
