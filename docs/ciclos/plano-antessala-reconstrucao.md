# Plano — reconstrução da antessala

> **Estado: EXECUTADO em 08/08/2026, com nota 8 do responsável.** As fatias 1
> (fundo), 2 (forma), 3 (raios) e 4 (composição) foram feitas; o que ficou aberto
> está na §1-septies de `docs/retomada-2026-08-05.md`, que é o ponto de retomada.
>
> **A previsão central deste plano estava errada, e vale mais que o resto dele:**
> ele mandava ADICIONAR material (§4, §5) para o vidro aparecer. A execução provou
> o contrário — o material só apareceu quando camadas foram REMOVIDAS. Ver a regra
> 63 do `CLAUDE.md`.
>
> O ciclo anterior está relatado em `antessala-redesenho-2026-08-08.md`. Este
> documento **não o repete**: ele parte de onde aquele parou e diz por que
> aquele não bastou.

## 1. O pedido, e o que a revisão externa acertou

O responsável levou a tela a uma revisão externa duas vezes. A primeira deu
**6,5** e chamou o resultado de *reskin*; a reconstrução da pilha do card
respondeu a ela. A segunda revisou **as quatro rodadas lado a lado** e manteve o
veredito: *"o card de confronto central é estruturalmente idêntico ao da tela
original. Só a cor de preenchimento mudou."*

**O veredito está certo, e é o núcleo deste plano.** O que mudou em 08/08 foi a
PILHA do card — campo, lâmina, conteúdo. A **forma** nunca mudou em rodada
nenhuma: retângulo, corte diagonal em 50%, dois quadrados de logo, dois números,
barra na base. É a forma que a revisão está vendo, e ela tem razão.

Os cinco itens da crítica, medidos na build publicada em 08/08/2026:

| item da crítica | medido | veredito |
|---|---|---|
| "nenhum `backdrop-filter` / vidro real" | lâmina `blur(22px) saturate(1.5)`; faixa e pílula `blur(12px)`; os dois botões `blur(14px) saturate(1.4)` | **existe** — mas ver §2 |
| "nenhuma camada ou elevação" | três camadas reais: `::before` campo → `::after` lâmina → conteúdo | **existe** |
| "nenhum especular" | gradiente especular na lâmina, aceso na quina e pegando luz na base | **existe** |
| "nenhum movimento / antecipação → revelação" | `pmLamina`, `pmRevela` (lâmina entra cega e limpa), `pmEntraEsq/Dir`, `pmBaseAbre`, `pmVeredito` | **existe** — mas ver §2 |
| **"nenhuma concentricidade"** | raios: card **24** · faixa **20** · pílula **20** · brasão **16** · botões **14** · fechar **10** · chip **0** · trilho **0** | **PROCEDE** |

Registrar isto não é defesa: é o que impede a quinta rodada de repetir a
quarta. Se o plano aceitasse "falta `backdrop-filter`", ele adicionaria vidro
que já existe e entregaria mais uma tela igual.

## 2. O diagnóstico raiz — duas causas, não cinco

### 2.1 O material existe e não aparece, porque não há o que refratar

`style.css:2188` já registra a medição que prova isso: fotografando a antessala
com e sem `backdrop-filter` na lâmina, o **maior delta de canal era 6/255**.
Desfoque sobre gradiente liso devolve o mesmo gradiente liso — o filtro rodava,
custava GPU e produzia diferença abaixo do limiar do olho.

**A malha diagonal foi a resposta paliativa a esse problema**, não um ornamento
escolhido por gosto: linhas a 72px contra um desfoque de 22px viram bandas
macias atrás do vidro e ficam nítidas fora dele, e é essa diferença entre dentro
e fora que o olho lê como espessura. Ela levou a refração de 6/255 a **33/255**.

O responsável descartou a malha — *"genérica, tipo textura de tech, sem relação
nenhuma com CS2, e ainda compete com o card em vez de sustentar ele"* — e a
crítica é justa; ela ainda tem um agravante não citado: **é idêntica nos sete
mapas**, então ocupa o lugar visual da identidade do mapa sem carregar nenhuma.

> **DEPENDÊNCIA DURA.** A malha só pode sair no MESMO commit em que a imagem de
> mapa entra. Removê-la sozinha devolve a refração para 6/255 — pior do que
> hoje, com o vidro custando GPU para nada.

### 2.2 A forma do confronto nunca foi o objeto sob revisão

Em 07/08 os dois times deixaram de ser cards lado a lado e viraram metades de um
retângulo cortado por diagonal. Em 08/08 a diagonal deixou de ser `clip-path` e
virou parada dura de gradiente, e o card ganhou três camadas. **Nenhuma das duas
mudou o que se vê: um retângulo com dois lados, dois logos quadrados e dois
números.**

A razão está registrada na regra 62 do `CLAUDE.md` e vale repetir aqui porque é
a mesma armadilha: *instrumentação decide o que você conserta.* Área, tipografia
e contraste tinham régua, então melhoraram; forma não tinha, então virou
argumento — e argumento é onde a estrutura existente foi preservada por estar
"aprovada".

## 3. As réguas — construídas antes da mudança

Nenhuma fatia deste plano fecha por inspeção. Cada eixo tem número, e o número
existe antes da primeira linha de CSS.

| eixo | régua | valor hoje | meta |
|---|---|---:|---|
| refração | delta máximo de canal, com × sem `backdrop-filter` na lâmina | 33/255 (com malha) | **≥ 60/255**, sem malha |
| custo | fps com braço de controle sem nenhum filtro (regra 55) | 60,3 × 60,3 | igual dentro de 1 fps |
| peso | bytes somados dos assets de mapa | 0 | **≤ 100 kB** os sete |
| presença dos lados | luminância e croma médios de cada metade | lum `0,054 × 0,132` (**2,42×**) · croma `11,3 × 71,5` (**6,3×**) | razão ≤ 1,4 nos dois |
| junção barra × diagonal | distância entre o corte do campo e a divisão da barra | **19,5 px** no empate | 0 por construção |
| ocupação vertical | conteúdo ÷ viewport | 486,6/900 = **54%** | ≥ 72% no desktop |
| concentricidade | nº de raios distintos fora da escala de tokens | **4** (16, 14, 10, 0) | 0 |
| resolução do asset | delta de pixels entre asset de N px e de 1920 px, sob o desfoque final | — | menor N com delta < 1% |

As réguas de luminância/croma e de junção já existem no harness de medição usado
para levantar este plano. As demais reaproveitam o instrumental do ciclo
anterior.

## 4. Fatia 1 — o fundo em camadas, com arte real de mapa

**Decisão do responsável: screenshots do CS2.** A arquitetura abaixo é idêntica
para qualquer origem de asset, então trocar a fonte depois não custa
reconstrução.

### 4.1 As camadas, de trás para frente

```text
z0  imagem do mapa      cover · desfoque moderado · escala 1,06
z1  atmosfera           gradiente na cor do mapa (evolui `ceu`/`chao`/facho)
z2  scrim               vinheta escura só o bastante para o texto
z3  conteúdo            lâminas de vidro, que refratam z0+z1+z2
```

`--mapa-ceu`, `--mapa-chao` e `--mapa-cor` **continuam existindo** e continuam
governando z1: eles são dado, viajam em CSS, não pesam byte e são o fallback
quando não há arte. A imagem **acrescenta** estrutura; não substitui o sistema.

### 4.2 Os dois riscos técnicos, e como cada um é resolvido

**Risco 1 — desfoque pesado mata a imagem e o vidro junto.** A referência
Spotify/Apple Music funciona porque o usuário **já viu** a capa; aqui o mapa é
informação nova. Sob `blur(60px)` o campanário de Inferno vira uma mancha
laranja, e uma mancha laranja é o que um gradiente já entrega por 0 kB.

Pior: **se o fundo já está uniformemente borrado, o `blur(22px)` da lâmina não
tem o que distorcer** — é o defeito de 6/255 voltando por outra porta. Vidro só
lê como vidro quando deforma algo com estrutura na escala do próprio raio.

Prescrição: o desfoque do fundo fica **moderado**, e a estrutura que precisa
sobreviver é a de **escala grande** — massas de luz, horizonte, vinheta natural
da foto. O critério não é gosto: é a régua de refração da §3 medindo ≥ 60/255
depois que a malha sair.

**Risco 2 — `mix-blend-mode` custa um contexto de empilhamento.** `multiply` e
`overlay` foram pedidos explicitamente, mas foi exatamente um contexto de
empilhamento (o `clip-path` das metades) que prendeu o conteúdo abaixo do
material em 08/08 — a regra 60 nasceu disso. O mesmo clima sai de gradiente
`rgba` sem modo de mescla. **Começar sem mescla**; se a atmosfera não convencer,
introduzir mescla em camada isolada, com fps medido no mesmo passo.

### 4.3 Protocolo de asset — espelha `docs/card-portraits.md`

- um arquivo por mapa de `MAPAS_POOL`, hoje **7**;
- WebP, proporção **16:9**, `assets/mapas/<id>.webp`;
- **resolução escolhida por medição**, não por palpite. Como o asset vai levar
  desfoque, ele pode ser servido pequeno: a régua da §3 acha o menor N cujo
  resultado final não se distingue de 1920 px. A estimativa de partida é
  240–320 px de largura, **8–12 kB** cada;
- teto de **25 kB** por arquivo e **100 kB** somados;
- **fallback obrigatório**: mapa sem arte cai no ambiente de gradiente atual e a
  tela não quebra;
- `tools/check-map-art.js`, novo, espelhando `check-card-portraits.js`:
  cobertura (todo mapa do pool tem arte), formato, proporção, peso, referência e
  órfãos. Sem ele, um mapa novo entrando no pool cairia no fallback em silêncio —
  que é exatamente o defeito que `check-map-identity` já existe para impedir no
  eixo da cor.

### 4.4 Licenciamento — declarado, não escondido

São capturas do CS2, material da Valve, num repositório público publicado por
GitHub Pages. A decisão é do responsável e foi tomada com o ponto na mesa.
Registrar aqui serve para que uma sessão futura não trate isso como descuido — e
para que a troca por arte original permaneça barata: **trocar o asset não toca
uma linha de CSS**, por construção da §4.1.

## 5. Fatia 2 — a forma do confronto

Esta é a fatia que responde ao *"é reskin, não redesign"*. As três abaixo
resolvem, cada uma, mais de um defeito medido ao mesmo tempo.

### 5.1 O princípio: a força governa a geometria

Hoje há **duas réguas na mesma junção**: o campo corta em `--pm-corte:50%` fixo,
e a barra divide por proporção de força. Medido com 81×81 — o caso mais
favorável possível — elas discordam em **19,5 px**. Com força desigual a
distância cresce. O relato de 08/08 afirma que "o segmento de cada time nasce
exatamente sob o card dele, e é esse alinhamento que dispensa rótulo": não
nasce, e não dispensa.

**Prescrição: uma régua só.** A divisão do palco passa a *ser* a proporção de
força. Isso:

- zera o desalinho **por construção**, não por ajuste;
- **elimina a barra de força**, porque a divisão já é a barra — é a regra 53 no
  seu melhor: diante de um elemento pequeno, a pergunta é que elemento já
  existente pode dizer aquilo por forma;
- devolve **tensão** a uma composição hoje simétrica e morta;
- permite que os dois números de força encolham para confirmação, liberando a
  área que hoje eles gastam repetindo o que a forma passará a dizer.

Duas guardas obrigatórias: **piso e teto** na proporção (nenhum lado pode sumir
nem dominar a ponto de o brasão não caber), e **amplificação** — 81×81 daria
50/50 e a tela ficaria idêntica à de hoje no empate, então a função que traduz
força em largura precisa exagerar a diferença dentro dos limites.

Isto **não explica o motor**: força e favoritismo são RESULTADO, que a §11-bis de
`docs/project-context.md` autoriza explicitamente. Tática, leitura e repertório
continuam fora.

### 5.2 A profundidade diz quem é você

Medido: o lado do jogador é **2,42× mais escuro** e **6,3× menos colorido** que o
do adversário. A causa é estrutural e permanente — o time do jogador é preto por
construção, então **nunca** recebe cor de clube. O resultado é que o olho vai
para o adversário em toda partida do jogo.

Isto é a regra 58 num eixo novo. Lá, a barra perdia informação quando dois
clubes tinham luminância parecida, e a saída foi trocar o canal: **aceso ×
apagado** em vez de matiz. Aqui a saída é a mesma família — trocar o canal de
identidade de **cor** para **proximidade**:

- o painel do jogador vem **à frente**: mais nítido, elevação maior, aro sutil;
- o adversário **recua**: mais desfocado, menos saturado, recebendo sombra.

Proximidade independe de qual par de clubes foi sorteado, que é exatamente o
critério da regra 46. E "você na frente, eles atrás" é o vocabulário natural do
confronto — entrega hierarquia de profundidade, que é o item da crítica que
procede junto com a concentricidade.

Note que **tamanho e profundidade ficam ortogonais**: se você é mais fraco, seu
painel é menor (§5.1) e ainda assim é o que está na frente. As duas informações
não competem.

### 5.3 O vão prova que são dois planos

Um retângulo dividido é um plano com duas cores. **Dois painéis com um vão
entre eles**, por onde a foto do mapa aparece sem lâmina na frente, é a prova
visual de que existe algo atrás — e é o que faz o vidro ler como vidro em vez de
ler como preenchimento.

Ressalva registrada: "dois cards lado a lado" foi o que a reformulação de 07/08
SAIU, para criar a sensação de confronto. Voltar a dois objetos só se sustenta
porque o confronto passa a vir de **assimetria e profundidade** (§5.1 e §5.2),
não de adjacência — se a execução perder isso, a fatia regrediu e a régua de
presença da §3 vai acusar.

### 5.4 Os dois lados precisam do mesmo conteúdo

Lado A tem duas linhas (nome, força); lado B tem três (nome, **campeonato**,
força). A caixa foi igualada em 07/08 (regra 50), o conteúdo não. O time do
jogador não tem campeonato e não vai ter — a linha some dos dois, ou vira um
slot que existe nos dois com peso igual.

## 6. Fatia 3 — a escala de raios

Quatro raios estão fora do sistema que esta tela criou: brasão **16**, botões
**14** (`--r-acao`), fechar **10**, chip e trilho **0**. Os tokens declaram três
(`--r-lamina:24`, `--r-peca:10`, `--r-pilula:20`) e um derivado
(`--r-crest = --r-lamina − --e-2`).

Concentricidade real é **raio interno = raio externo − distância**, e é assim que
`--r-crest` já nasce. A fatia estende a mesma regra aos demais: nenhum raio da
antessala pode ser um número escolhido; todo raio ou é token de escala ou é
derivado do pai. **Guarda:** estender `tools/check-glass-system.js`, que já
conhece as superfícies de referência, ou um checador irmão — sem prova, a escala
diverge de novo na próxima fatia, exatamente como divergiu nesta.

## 7. Fatia 4 — composição e vazio

- **46% da tela é vazio.** Conteúdo ocupa 486,6 px de 900 no desktop; 206,7 px
  acima e 206,7 abaixo. No tablet é pior. O relato de 08/08 defendeu isso como
  "centrar é a decisão correta para um diálogo modal" — correto para um diálogo,
  errado para **a tela de abertura de uma partida**, que é o momento de maior
  tensão do jogo. Com a foto do mapa no fundo, o vazio deixa de ser vazio e passa
  a ser **cenário**: a composição pode respirar sobre a imagem em vez de flutuar
  sobre preto;
- **o chip do mapa está órfão.** `INFERNO` mede 97,9×29,3 sozinho numa segunda
  linha sob uma faixa de 423 px. O relato afirma que os mapas "subiram para a
  moldura, junto do contexto" — visualmente não estão junto, estão pendurados
  abaixo. Com a foto no fundo, a pergunta muda: **se a arte identifica o mapa, o
  chip ainda precisa existir?** Só a medição responde — e a resposta não pode
  matar o canal textual (regra 53: a informação não pode existir só em imagem);
- **os dois botões têm larguras diferentes** — 240 × 173 px no desktop — porque
  são dimensionados pelo texto. Duas ações do mesmo nível, dois tamanhos. É a
  regra 56: mesmo objeto, diferença só de ênfase.

## 8. Fatia 5 — movimento

O arco antecipação → revelação **existe** (`pmRevela`: a lâmina entra cega, com
`--vidro-alto-cego`, e limpa). A revisão não o viu por dois motivos plausíveis, e
os dois importam: ela avaliou capturas estáticas, e **a revelação hoje não revela
nada** — com um fundo quase liso atrás, a lâmina cega e a lâmina limpa mostram
quase a mesma coisa.

É a regra 61 se cobrando: *estrutura e movimento são a mesma decisão quando a
revelação é material.* Com a foto do mapa atrás, a mesma animação, sem mudar uma
linha, passa a esconder e descobrir **um lugar**. A fatia de movimento é, em boa
parte, consequência da fatia 1 — e o que sobra dela é calibrar tempo e ordem
sobre um conteúdo que finalmente vale ser revelado.

## 9. O que este plano NÃO faz

- **não toca em dado, OVR, RNG, balanceamento ou ordem de consumo de RNG.** A
  proporção de força da §5.1 LÊ `ef`, que já está na tela;
- **não reintroduz** placa grande de mapa, sigla de duas letras, selos `VOCÊ`,
  rótulos "Vão jogar em" nem legendas `FORÇA` — são recusas registradas;
- **não exibe mecanismo.** Nada de tática, leitura ou repertório;
- **não migra `.np-card`** (palco da narração) neste ciclo: é outra tela e tem
  fps próprio a medir;
- **não leva o padrão à tela do mapa.** A partida é uma tela em MOVIMENTO, e foi
  nela que `backdrop-filter` derrubou o fps para 31 em 29/07. Com uma imagem de
  fundo somada ao filtro, medir lá antes é obrigatório — e é ciclo próprio.

## 10. Ordem, dependências e provas

```text
0. visual-antes  (captura DUAS vezes o mesmo código — piso de ruído, regra 40)
1. fatia 1  fundo em camadas + asset + guarda      ← a malha sai AQUI, não antes
2. fatia 3  escala de raios                        ← barata, independente
3. fatia 2  forma do confronto                     ← a maior; depende de 1 na medição
4. fatia 4  composição e vazio
5. fatia 5  movimento sobre o novo fundo
6. matriz de AGENTS.md + npm run validate
```

Cada fatia fecha com: a régua da §3 medida antes e depois, comparação visual
imagem a imagem (estados fora do escopo pixel a pixel idênticos, descontado o
piso de ruído), e `npm run check` verde.

**A fatia 1 é a que destrava todo o resto** — a forma, o movimento e o vazio
todos dependem de haver conteúdo real atrás do vidro. Ela também é a única que
depende de um insumo externo (os assets), então enquanto eles não chegam a
arquitetura pode ser construída e medida com um substituto, e o asset final entra
sem tocar CSS.
