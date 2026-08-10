# Plano de organização e padronização do código — preparado em 07/08/2026

> **Este documento é um MÉTODO, não um relatório.** Ele foi escrito no fim de uma
> sessão longa, a pedido do responsável — *"quero uma organização e padronização
> mesmo do código, comece pelo index"* —, e a execução ficou para a sessão
> seguinte por duas razões declaradas na hora:
>
> 1. **contexto esgotado.** Uma refatoração ampla começada sem margem termina pela
>    metade, que é o pior estado em que se pode deixar um repositório;
> 2. **método antes de aplicação**, que foi a instrução final do responsável:
>    *"é melhor você usar um método com muito estudo antes de aplicar qualquer
>    coisa"*.
>
> E ele tinha razão pelo motivo mais concreto possível: a primeira varredura que
> rodei para achar `id`s órfãos no `index.html` acusou `sideA` e `sideB` como
> ausentes. **Falso positivo** — os dois nascem em runtime, dentro de
> `ladoChipHtml`. É o terceiro falso positivo de varredura ingênua registrado
> neste repositório (regra 23 e a auditoria de classes de 06/08).

## 1. Por que este ciclo é perigoso, e o que já se sabe disso

O `CLAUDE.md` guarda três lições que se aplicam INTEIRAS aqui:

- **regra 22** — antes de mover arquivo, tire o caminho da contagem de `..`;
- **regra 23** — reescrita em massa erra por BORDA, não por lógica. Duas vezes num
  dia: um padrão casou como prefixo dentro de outro nome, e um script que tratava
  `./X` e `../docs/` passou batido nos cinco `../src/`;
- **a auditoria de classes de 06/08** — um varredor ingênuo acusou 18 classes
  órfãs no `style.css`; **17 eram falso positivo** por concatenação em runtime
  (`fn-${slugFuncao(…)}`, `coach-${caracSlug}`).

E há um dado novo, desta sessão: em 07/08 removi a regra `.pm-id` com um script, e
o seletor seguinte **grudou no anterior**, virando `.pm-lado--b .pm-name`. O nome
do time do lado A ficou sem estilo e só apareceu na captura. Nenhuma guarda pegou.

**Conclusão de método: nenhuma edição em massa neste ciclo sem prova por
execução.** Ler o arquivo não basta; o CSS erra por vizinhança e o HTML erra por
identidade gerada.

## 2. O que MEDIR antes de tocar em qualquer coisa

Nesta ordem, e cada item vira um número no relatório do ciclo:

1. **`index.html`** — quantos comentários descrevem estado que já mudou.
   Comentário que mente é pior que comentário ausente: ele é lido como verdade.

   **Medido em 08/08/2026, e as três afirmações que este item trazia estavam
   VENCIDAS.** Elas foram escritas no fim de 07/08 e os ciclos daquela noite e
   desta manhã já as tinham resolvido: as duas notas de "marca d'água" saíram
   junto com o VS, e o `<!-- Overlay: Fase Suíça -->` deixou de apontar para o
   portão quando o portão ganhou cabeçalho próprio. Sobrou **um** comentário
   mentindo, e era o mais caro de todos porque é o primeiro que se lê — o
   cabeçalho do arquivo mandava "manter os três arquivos na mesma pasta", e
   seguir isso quebra o jogo: `game.js` importa cerca de vinte arquivos de
   `src/` e o `<head>` carrega `fonts.css` e a fonte.

   A lição de método vale mais que o achado: **um plano é um instrumento de
   medida, e ele também envelhece.** Remeça antes de executar, mesmo que o plano
   tenha um dia de idade — aqui teriam sido três correções em algo já correto.
   A mesma afirmação sobre marca d'água continua viva, mas em `style.css`, na
   nota do `.pm-palco`. Ela é da fatia 2.
2. **`id`s e classes realmente órfãos** — com casador que entenda identidade
   montada em runtime. O detector correto NÃO é `grep "id=\"x\""`; é comparar o
   conjunto de `$("…")` do `game.js` com os ids do HTML **mais** os emitidos por
   `src/ui/**`, que são os que a varredura ingênua perde;
3. **`style.css`** — 2.358 linhas em 08/08/2026; a contagem VIGENTE está na
   tabela travada por `tools/check-doc-measurements.js`, não aqui, porque um
   número solto na prosa envelhece sem ninguém reclamar (regra 43). Medir:
   regras duplicadas byte a byte,
   declarações que não chegam à tela (base sobrescrita sem query), e literais que
   deveriam ser token. O ciclo de 02–03/08 fez isso e achou 33 declarações mortas
   e uma regra responsiva que nunca valeu;
4. **`game.js`** — 1.618 linhas em 08/08/2026, contra 882 no piso do P5; a
   contagem vigente sai da mesma tabela travada. Medir o que é
   APLICAÇÃO e o que é VIEW: o arquivo voltou a crescer com funcionalidade, e
   parte do que entrou hoje é montagem de HTML que pertence a `src/ui/`;
5. **contagem de tokens de leitura** — quantas linhas uma sessão nova precisa ler
   para entender cada área. É a métrica que o responsável pediu de fato:
   *"pra fazer o claude economizar nos tokens na próxima vez"*.

## 3. A ordem de execução, e por que ela é esta

**Fatia 0 — as guardas primeiro.** Antes de mover uma linha, escrever o detector
de órfãos que entende runtime, e prová-lo por MUTAÇÃO: injetar uma classe
concatenada e confirmar que ele NÃO a acusa; injetar uma órfã real e confirmar
que acusa. Sem isso, todo o resto é opinião.

### Tentativa de 08/08/2026 — o que ela já ensinou, e por que foi descartada

Escrevi esse detector e o **removi sem publicar**, porque ele não passava no
próprio critério acima. Fica o que ele mediu, para a próxima tentativa não
repetir o caminho:

1. **Casar `id="literal"` nas fontes de marcação NÃO basta.** `sideA` e `sideB`
   são emitidos por `ladoChipHtml`, que recebe o id como ARGUMENTO — no template
   está `id="${id}"`. É o falso positivo já registrado em 07/08, e ele reaparece
   em qualquer detector que só olhe o ponto de emissão.
2. **Nem casar `$("literal")` no consumo.** Os overlays são consumidos pelo
   array `OVERLAYS` e por `OVERLAYS.map($)`; nenhum deles aparece como
   `$("suicaOverlay")` escrito à mão.
3. **E a correção óbvia — "toda string literal conta como identidade" — é frouxa
   demais para servir.** Ela zerou os dois falsos positivos acima e produziu
   **390 falsos**: `#Ataque`, `#Escape`, `#pointerdown`, `#UTF-8`, `#pt-BR`. Um
   detector que acusa 390 identidades vivas não é conservador, é ruído — e ruído
   é o que faz alguém desligar a guarda.

**O caminho que sobra, e que a próxima sessão deve tentar:** não inferir por
texto. Carregar a página no Chromium — a bancada já faz isso em seis suítes —,
percorrer os estados que o comparador visual já percorre, e coletar do DOM REAL
o conjunto de ids e classes que existiram em algum momento. Identidade gerada em
runtime deixa de ser um problema de casador porque ela É gerada. O que sobrar em
`style.css` sem nunca ter aparecido no DOM é candidato a órfão — e aí sim, provado
por mutação, com a dívida travada num número como já se faz com o vidro.

### Fatia 0 EXECUTADA — 09/08/2026, `bancada/suites/css-orfaos.js`

O caminho acima foi seguido e funcionou. A suíte instala um `MutationObserver`
por `addInitScript`, **antes da primeira navegação** — identidade que nasce e
morre no mesmo quadro (`.pop`, `.fechando`, `.dragging`) não existiria para uma
varredura feita depois —, atravessa a campanha inteira e compara o DOM real com
o que a folha declara.

**O veredito tem QUATRO baldes, e essa é a decisão de projeto que evita o ruído
da tentativa 3.** Um percurso não alcança tudo — `is-champ` e `is-elim` são
exclusivas, nenhuma campanha visita as duas —, então "não apareceu" não pode
significar "morto":

| balde | significa | conta como dívida? |
|---|---|---|
| VIVA | apareceu no DOM | não |
| NÃO VISITADA | não apareceu, mas é literal numa fonte | não — é lacuna do percurso |
| GERADA | casa um prefixo concatenado real (`fn-${…}`) | não — é o falso positivo de 06/08 |
| ÓRFÃ | nenhuma das três | **sim**, e é o único balde travado |

**Resultado da primeira execução: 339 classes e 8 ids declarados, 0 órfãos.** A
folha está limpa nesse eixo — o que também explica por que as três tentativas
anteriores pareciam plausíveis: elas acusavam falsos, porque verdadeiros não
havia.

**O achado real veio da direção INVERSA**, que o plano não previa: classe que o
jogo MONTA e a folha nunca estiliza. São duas — `sb-a`, já registrada na tabela
da fatia 1, e `neutro`. Essa direção **não é travada em lista**: classe sem regra
é legítima como gancho de JS, e travá-la obrigaria a declarar dezenas de ganchos
vivos como dívida.

**O que a execução ensinou, e que muda a fatia 2:**

- **o percurso NÃO é determinístico, e a causa é do produto.** `game.js:28`
  define `rnd` sobre `Math.random` cru, e o comentário da linha 1060 declara a
  escolha. `srand` governa a simulação, não a roleta do draft. Medido em quatro
  execuções: 298 a 310 classes vistas. Isso não contamina o veredito — tudo que
  oscila é literal em `src/ui`, logo cai em "não visitada" —, mas significa que
  **o número de cobertura não serve para comparar entre dias**;
- **o parser precisou ser de verdade, não regex.** Comentário não é seletor
  (regra 71: `.pm-mapa` saiu em 09/08 e segue citado em prosa) e declaração não
  é seletor (`content:".d"`). A pilha distingue `@media`, que contém regras, de
  `@keyframes`, cujo prelúdio é `0%`/`from`;
- **o casador de literal precisou de borda dos DOIS lados.** Sem elas `.pm-ef`
  casa dentro de `pm-efeito` e uma órfã real passa por viva — é a regra 23.

**Cinco provas sintéticas**, e três delas provam que o auditor CALA: a órfã real
tem de ser acusada; a concatenada, a literal e a que só existe em comentário,
não. A quarta checa que o detector ainda enxerga o prefixo `fn-` — sem o alvo, a
prova não prova nada.

**Fatia 1 — `index.html`** — o pedido explícito do responsável, e o arquivo mais
seguro: sem lógica nenhuma. **ENTREGUE em 08/08/2026**; o relato está na §
"Fatia 1 executada", abaixo.
- corrigir os comentários que mentem;
- padronizar os cabeçalhos de seção num formato único;
- agrupar os overlays em ordem de fluxo (portão → suíça → playoffs → partida →
  final → hall) com um separador consistente;
- **não** mexer em `id`, `class`, `role`, `aria-*` nem na ordem do DOM: a ordem
  dos overlays no DOM decide quem pinta por cima de quem — está no `CLAUDE.md`
  como defeito já pago.

O tamanho declarado aqui era "350 linhas"; o arquivo tinha **316**. Número solto
em prosa não tem dono (regra 43), e este envelheceu em um dia. Hoje `index.html`
está na tabela travada por `tools/check-doc-measurements.js`, junto dos outros
quatro arquivos grandes — errar o número dele passou a reprovar o `check`.

### Fatia 1 executada — 08/08/2026

**O que mudou:** só comentário. Nenhum `id`, `class`, `role`, `aria-*`, atributo,
texto ou ordem de nó foi tocado. O arquivo também passou de CRLF para LF, que é o
que `.gitattributes` e `.editorconfig` já declaravam e o Git já fazia sozinho no
commit — a árvore só estava mentindo sobre isso.

**Como isso foi PROVADO, e por que ler o diff não bastaria.** Comentário de HTML
não cria nó de texto, então apagá-los dos dois lados deixa exatamente o que o
navegador vê. Removidos os comentários e colapsados os vãos de espaço em um
espaço só — que é a regra de colapso do CSS, e preserva a distinção entre "havia
espaço" e "não havia" —, as duas versões são **byte a byte idênticas**. Ids e
classes conferidos separadamente, em conjunto e em ordem. Esse teste é o que
pega o erro que a leitura não pega: uma quebra de linha inserida entre dois
elementos INLINE vira um espaço na tela.

**Ritual visual.** Piso de ruído medido primeiro, com duas capturas do mesmo
código: `desktop-07-mapa` acusou 0,190% dos pixels com deslocamento de 1/255 —
esse estado varia sozinho, e é exatamente o tipo de diff que faria alguém
reescrever trabalho correto (regra 40).

**O formato que ficou.** Dois níveis, e só dois: `═══ NOME ═══` abre uma REGIÃO,
`── Nome ──` abre um BLOCO dentro dela. Seis regiões: DOCUMENTO, PWA, OPEN GRAPH,
FOLHAS E FONTE, PÁGINA DO DRAFT, OVERLAYS. Antes havia três formatos concorrendo
e **três dos seis overlays não tinham cabeçalho nenhum**.

**O mapa, e por que ele precisou de guarda.** O cabeçalho lista as seis regiões
para que uma sessão nova pule direto em vez de ler o arquivo. Só que uma lista de
regiões é precisamente o tipo de afirmação sobre o próprio repositório que
envelhece sem ninguém reclamar — a regra 43 nasceu disso. `tools/check-html-comments.js`
cobra que o mapa e os marcadores tenham os mesmos nomes na mesma ordem.

**A guarda ficou verde no defeito, e foi preciso descobrir isso por mutação.** A
primeira versão só provava PAREAMENTO. Apagar o fechamento do marcador `PWA` no
arquivo real **passou limpo**: o comentário correu até o fechamento seguinte,
engoliu as quatro `<meta>` do bloco pelo caminho, e o arquivo voltou a ficar
perfeitamente pareado — com um comentário a menos e quatro elementos fora do
documento. É o mesmo buraco que o irmão de CSS já documentava em prosa e que eu
reproduzi mesmo assim. O sinal correto não é a sintaxe, é o DANO: uma linha que é
uma tag inteira, ou um `id=`, dentro de um comentário. Prosa não escreve nenhum
dos dois — as notas do cabeçalho citam `<noscript>` e `<head>` no meio de frases,
com texto depois, e não disparam.

**Custo declarado:** o arquivo cresceu de 315 para 392 linhas, todas de
comentário (19 comentários / 62 linhas → 32 / 131). É contra o objetivo declarado
do ciclo — "economizar tokens" — se a métrica for ler o arquivo inteiro, e a
favor dele se a métrica for **encontrar uma região**, que é o que uma sessão de
trabalho realmente faz. O critério que usei para cortar: este arquivo só
documenta o que ELE governa — ordem no DOM, identidade e semântica de
acessibilidade. Geometria é de `style.css`, comportamento é de `game.js`,
contrato de projeto é do `CLAUDE.md`. A primeira redação repetia a regra 21
(`.picks`/`.squad`), o gesto de arrasto e o ritmo da roleta; tudo isso saiu,
porque duplicar contrato cria a segunda verdade que este ciclo existe para
eliminar.

**Achados que a fatia 1 NÃO corrigiu, de propósito** — são da fatia 2 ou 3, e
todos foram verificados por varredura do repositório inteiro, não por leitura:

| achado | onde | por que ficou |
|---|---|---|
| `livemapFoot`, `finalGlow`, `finalTrophy` | `index.html` | três `id` sem um único consumidor: o estilo vem das classes irmãs. Remover mexe em atributo, e a fatia 1 se proibiu disso |
| `.pm-topo` | `index.html` + `style.css` | a classe não tem NENHUMA regra na folha. Tirar o contêiner muda o cálculo de flex do `.prematch` — é mudança de pixel |
| `.sb-a` | `game.js` + `style.css` | emitida em `reproduzirMapa`, sem regra na folha; só `.sb-b` tem. Assimetria deliberada ou morta — decidir é da fatia 3 |
| "marca d'água" do `.pm-palco` | `style.css` | a nota ainda diz que o nome do mapa "vive atrás de tudo"; ele virou faixa e depois desceu para `#pmMapa` em 07/08 |
| comentário órfão do cabeçalho da antessala | `style.css` | bloco de prosa seguido de quatro linhas em branco e nenhuma regra: o seletor que ele descrevia virou `.pm-chip` |

**Fatia 2 — `style.css`.** Só depois do detector. Ordem: remover morto provado
por mutação → tokenizar literais repetidos → agrupar por região com índice no
topo. Nunca as três no mesmo commit.

### Fatia 2a EXECUTADA — 09/08/2026: o mapa, e por que NÃO agrupei

**O terceiro passo foi feito primeiro, e o "agrupar" saiu dele.** A ordem acima
supunha que reagrupar por região fosse arrumação; medindo, é mudança de
comportamento. Fica registrado para não ser tentado de novo sem prova.

**O que a medição mostrou.** Classificando as 682 regras de nível 0 por tema e
contando blocos contíguos: `torneio` em 11 blocos, `aovivo` em 11, `final` em 8,
`carta` em 7. Parece bagunça e em boa parte **não é** — a CAMADA DE REFINAMENTO
do fim toca todos os temas de novo, por desenho, e o cabeçalho sempre declarou
isso. Em CSS, mover uma regra muda quem ganha por ordem; juntar `.ls-*` ao resto
da partida exigiria provar par a par que nenhuma especificidade depende da
posição atual — `.r-top`/`.r-mid`/`.r-low` nascem na tela final e reaparecem
como `.ls-rate.r-top` 60 linhas depois.

**O que foi feito, então: só marcação.** Treze regiões, num formato único de dois
níveis (`═══ REGIÃO ═══` e `── Bloco ──`), e um mapa no cabeçalho. Antes havia
**seis formatos concorrendo** (`═══`, `══`, `╔══╗`, `──`, `════` e o do
cabeçalho), pior que os três que a fatia 1 achou no HTML.

**O mapa antigo mentia**, e de duas formas: prometia seções "responsivo" e
"movimento reduzido" que não existem — as media queries vivem espalhadas, junto
do que ajustam —, e o marcador `OVERLAYS DE TORNEIO · suíça e playoffs` estava
**237 linhas adiantado**, nomeando uma coisa que só começa na região seguinte.

**A prova de zero pixel NÃO foi a comparação visual, e isso é a lição de método.**
O ritual do `CLAUDE.md` tem piso de ruído intermitente (regra 40 e o corolário de
09/08), e para uma mudança que só toca comentário ele responde devagar e com
incerteza. A prova certa é o **CSSOM**: carregar as duas versões no Chromium e
comparar as regras que o navegador entendeu, uma a uma e em ordem — porque em
CSS ordem é cascata. Resultado: **845 regras, idênticas em todas as posições.**
É mais forte que pixel, roda em segundos e não tem ruído.

**A guarda foi provada por mutação nos quatro modos de falha**: renomear a região
no arquivo, trocar duas de ordem no mapa, remover um marcador e acrescentar uma
região sem citá-la. Os quatro reprovam; e o arquivo volta ao verde depois.

**O que continua aberto na fatia 2:** remover morto (o detector de órfãos já diz
que não há classe sem consumidor — o morto aqui é DECLARAÇÃO que não chega à
tela, outra varredura) e tokenizar literais repetidos.

**Fatia 3 — `game.js`.** Extrair para `src/ui/` o que é montagem de HTML. É a
fatia com mais risco de comportamento e deve vir por último, com golden e
snapshot conferidos.

## 4. Como provar que a organização NÃO mudou o produto

O critério é o mesmo que o ciclo de organização de 03/08 usou e cumpriu:

- `npm run validate` verde em cada fatia — hoje 24 checadores e 26 suítes;
- **comparação visual 21/21 idênticas**. Organização que muda pixel não é
  organização; ou virou refino visual, e aí precisa ser pedida;
- golden, snapshot e consumo de RNG intactos;
- uma responsabilidade por commit, como manda o `AGENTS.md`.

## 5. O que NÃO fazer neste ciclo

- **não** juntar organização com refino visual. A tentação vai existir, porque a
  antessala virou padrão e as outras telas ainda não o seguem — mas migrar tela
  para o sistema de vidro é trabalho de PRODUTO, com fps medido por tela, e
  contaminaria qualquer commit de faxina;
- **não** encostar em `sandbox.html` (4.205 linhas). Ele é a maior dívida isolada
  do repositório e merece ciclo próprio com paridade provada — está registrado
  como escopo recusado desde 03/08;
- **não** unificar CJS → ESM. São 63 arquivos de mudança lógica.
