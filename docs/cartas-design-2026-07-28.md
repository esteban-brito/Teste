# Cartas de jogador — design aprovado (28/07/2026)

> **Estado: LIGADO AO JOGO em 29/07/2026 e refinado em 30/07/2026**, depois do
> P2, como o responsável havia decidido. O design executável vive em
> `src/ui/game/card-view.mjs`, com
> `src/ui/shared/flags.mjs` (bandeiras) e `src/ui/shared/role-emblems.mjs`
> (emblemas), e o CSS entrou em `style.css` — commits `c1ecdee` e `8a12250`. O que
> mudou de lá para cá está nas **seções 10 e 11**.
>
> `prototipo-cartas.html` deixou de ser protótipo e virou o **laboratório de
> cartas** — ver a seção 11. Ele importa o código real, então não pode mais
> divergir do jogo.

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

- **Um bloco de tokens em `.c` governa as DUAS faces**: um recuo lateral (`--pad`),
  um passo vertical (`--passo`) que gera a pilha inteira por `calc`, e quatro corpos
  de texto numa razão de ~1,5.
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
3. **Fotos — CONTINUA ABERTO.** A camada existe e está vazia (`.c-foto`): 0 de 85
   jogadores têm retrato e não há campo para guardá-lo. O estado "sem foto" é
   declarado, não remendo — a tinta da raridade sobe e a carta fica assumidamente
   gráfica. `src/data/catalog.mjs` registra isso em `DIVERGENCIAS` (`sem-foto`).
   Decisão de produto pendente; quando as fotos existirem, é mudança de dado, não
   redesenho.
4. ~~**Daltonismo**~~ **RESOLVIDO** (`8a12250`) pelo emblema de função: seis
   silhuetas no mesmo grid 24×24, forma independente de cor, que também diferencia na
   grade de 2 colunas do celular. `tools/check-game-view-modules.js` exige as seis
   silhuetas distintas.
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

Prova permanente: **`bancada/e2e-cartas.js`** (grupo `test:e2e`) chama o próprio
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

Fechamento: `npm run validate`, **25/25 suítes verdes** em 182,2 s; snapshot,
golden, RNG, tiers, dados crus e balanceamento intactos. CI e deploy do Pages:
workflow `30527422214`, verde.
