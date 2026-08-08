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

1. **`index.html`** — quantos comentários descrevem estado que já mudou. Já há
   dois confirmados nesta sessão:
   - o bloco do palco diz *"o nome do mapa vive ATRÁS de tudo, em marca d'água"*;
     ele virou faixa no topo do palco no mesmo dia;
   - a lista dos mapas da série repete a mesma afirmação;
   - e o comentário `<!-- Overlay: Fase Suíça (estilo Major) -->` ficou apontando
     para o **portão do nome**, que foi inserido depois dele.
   Comentário que mente é pior que comentário ausente: ele é lido como verdade.
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

**Fatia 1 — `index.html`** (o pedido explícito do responsável, e o arquivo mais
seguro: 350 linhas em 08/08/2026, sem lógica).
- corrigir os comentários que mentem;
- padronizar os cabeçalhos de seção num formato único;
- agrupar os overlays em ordem de fluxo (portão → suíça → playoffs → partida →
  final → hall) com um separador consistente;
- **não** mexer em `id`, `class`, `role`, `aria-*` nem na ordem do DOM: a ordem
  dos overlays no DOM decide quem pinta por cima de quem — está no `CLAUDE.md`
  como defeito já pago.

**Fatia 2 — `style.css`.** Só depois do detector. Ordem: remover morto provado
por mutação → tokenizar literais repetidos → agrupar por região com índice no
topo. Nunca as três no mesmo commit.

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
