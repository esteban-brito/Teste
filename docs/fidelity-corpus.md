# Corpus de referência IFCS

## Estado

O repositório possui o contrato e o verificador do corpus, mas **não contém um
corpus real pronto**. Nenhuma nota IFCS oficial pode ser publicada enquanto as
demos não forem adquiridas, extraídas, verificadas e auditadas conforme este
documento e `docs/realism-methodology.md`.

Dados reais e alterações de balanceamento nunca pertencem ao mesmo commit.

## Fontes e limites de confiança

A Valve define os Ranked Tournaments e exige que organizadores de Major gravem
e entreguem demos de servidor. Essas regras não formam, por si, um catálogo
público completo para download:

- [Valve — Tournament Operation Requirements](https://github.com/ValveSoftware/counter-strike_rules_and_regs/blob/main/tournament-operation-requirements.md)
- [Valve — Major Supplemental Rulebook](https://github.com/ValveSoftware/counter-strike_rules_and_regs/blob/main/major-supplemental-rulebook.md)
- [Valve — Regional Standings](https://github.com/ValveSoftware/counter-strike_regional_standings)

O manifesto distingue quatro evidências que não são intercambiáveis:

1. regra e elegibilidade: revisão Git e hash do conteúdo publicado pela Valve;
2. índice da partida: página verificável do organizador ou provedor estatístico;
3. demo adquirida: arquivo local, tamanho e SHA-256 próprios;
4. verdade auditada: placar oficial comparado ao resultado do parser.

Um link acessível não prova que o conteúdo permaneceu igual. O SHA-256 do
arquivo adquirido é a identidade da demo usada no IFCS. URLs que desaparecem
não invalidam um artefato preservado e verificável, mas impedem reconstrução por
terceiros e precisam aparecer como limitação no relatório.

O parser de referência inicial é o
[Awpy 2.0.2](https://awpy.readthedocs.io/en/latest/examples/parse_demo.html),
que usa `demoparser2`, reconstrói rounds e expõe eventos como morte, dano,
plant/defuse e término de round. A versão, o backend, o extrator e suas opções
ficam congelados no manifesto.

O ambiente exige Python `>=3.11,<3.14`. `requirements-fidelity.in` fixa a
dependência direta e registra o hash da wheel publicada;
`requirements-fidelity.lock` congela o ambiente transitivo observado. Antes da
primeira extração oficial, o lock deve ser reinstalado do zero e acompanhado
dos hashes de distribuição de todas as dependências.

## O que o contrato verifica

`bancada/fidelity-corpus.js` separa:

- `valid`: estrutura e proveniência internamente coerentes;
- `officialReady`: todos os mínimos científicos e operacionais satisfeitos.

Entre as guardas estão:

- alvo CS2, somente LAN Valve-ranked e ambos os times no top 20 VRS;
- janela temporal e pool de sete mapas congelados;
- ao menos 6 eventos, 800 mapas e 80 mapas por mapa ativo;
- split por evento, com partida como bloco secundário;
- placares MR12 possíveis e igualdade entre placar oficial e extraído;
- dez jogadores e total de rounds coerente;
- SHA-256, tamanho, origem e caminho seguro de cada `.dem` extraída;
- versão do parser idêntica em todos os mapas;
- mínimos de clutches, anti-eco, force-buy, pós-plant e 10.000 player-rounds
  separadamente para cada uma das seis roles;
- auditoria aleatória reproduzível de 2%, nunca inferior a 30 mapas;
- exatidão de identidade, mapa, lado, placar, rounds, vencedores e K/D/A;
- divergências de dano, trade ou flash obrigatoriamente explicadas;
- holdout privado bloqueado e identificado por hash.

Erros estruturais tornam `valid=false`. Falta de volume, auditoria ou lock deixa
o manifesto válido para acompanhamento, mas `officialReady=false`.

## Layout local

Os arquivos grandes e o holdout privado não entram no Git:

```text
fidelity-corpus/
├── manifest.json          versionável depois de revisado
├── raw/                   demos adquiridas; ignorado pelo Git
├── processed/             tabelas derivadas; ignorado pelo Git
└── private-audit/         material bloqueado; ignorado pelo Git
```

O caminho `demo.localPath` é relativo à pasta do manifesto, usa `/` e não pode
conter travessia de diretório.

## Fluxo operacional

### 1. Congelar o alvo

Antes de baixar dados, registrar:

- `target.id`, janela, pool ativo e política top-20;
- commits exatos das regras Valve e VRS;
- SHA-256 do conteúdo dessas revisões;
- versão do parser e hashes do extrator e das opções.

O template contém marcadores deliberadamente inválidos:

```text
npm run corpus:fidelity -- --template
```

### 2. Catalogar sem excluir silenciosamente

Cada partida recebe evento, data, formato, dois ranks VRS com data/fonte e URL
oficial. Cada mapa é `valid` ou `excluded`. Exclusões aceitas têm código fechado
como `forfeit`, `incomplete`, `showmatch`, `corrupt-demo` ou
`nonstandard-config`, além de justificativa textual.

Não se exclui uma partida por produzir estatística inesperada.

### 3. Adquirir e preservar

Baixar somente de fontes cujo acesso seja autorizado. Não automatizar login,
cookie, CAPTCHA ou contorno de limitação. Arquivos `.zip` ou `.bz2` de origem
devem ser extraídos; a identidade usada pelo parser é sempre a `.dem`. Para cada
demo registrar URL de origem, data, bytes, caminho local e SHA-256 calculado
depois da extração.

O repositório não deve receber arquivos `.dem`, credenciais ou cookies.

### 4. Extrair e conferir

O extrator deve gerar os mesmos times, mapa, placar, rounds e dez jogadores
declarados no manifesto. Uma mudança de Awpy, backend, script ou opções exige
novo hash e uma nova extração completa; não se mistura saída de parsers.

Preparação e fingerprints:

```text
python -m venv .venv-fidelity
.venv-fidelity/Scripts/python -m pip install -r requirements-fidelity.lock
.venv-fidelity/Scripts/python tools/extract-fidelity-demo.py --check-environment
.venv-fidelity/Scripts/python tools/extract-fidelity-demo.py --self-test
.venv-fidelity/Scripts/python tools/extract-fidelity-demo.py --fingerprint
.venv-fidelity/Scripts/python tools/extract-fidelity-demo.py --options-template
```

Extração de um mapa, sempre para uma pasta que ainda não existe:

```text
.venv-fidelity/Scripts/python tools/extract-fidelity-demo.py \
  --manifest fidelity-corpus/manifest.json \
  --map-id evento-partida-mapa \
  --output processed/evento-partida-mapa
```

O extrator verifica os hashes antes de abrir a demo, recusa sobrescrita e gera
`rounds.parquet`, `player-round-totals.parquet`, um Parquet por evento e
`summary.json`. Na primeira passagem, o bloco `parsed` pode estar ausente; o
resumo produzido deve ser revisado e incorporado ao manifesto. Nas passagens
seguintes, qualquer divergência entre `parsed` e a nova extração aborta o mapa.

### 5. Selar e verificar

O selo usa JSON canônico com chaves ordenadas e exclui apenas o próprio campo
`declaredSha256`:

```text
npm run corpus:fidelity -- --seal fidelity-corpus/manifest.json
npm run corpus:fidelity -- fidelity-corpus/manifest.json --verify-files
```

`--seal` escreve o documento selado apenas na saída padrão. A revisão humana
deve conferir o diff antes de substituir o manifesto versionado.

Sem `--verify-files`, o comando pode diagnosticar o manifesto, mas nunca retorna
`officialReady=true`.

### 6. Auditoria e holdout

A lista auditada é reproduzida a partir dos IDs dos mapas, `selectionSeed` e do
algoritmo versionado no contrato. Trocar manualmente um mapa sorteado invalida o
manifesto, mesmo que a quantidade permaneça igual.

O holdout não deve ficar em uma pasta sincronizada com a equipe de tuning. O
manifesto público guarda somente `lockId`, política e hash do manifesto privado.
Quando o holdout for aberto para release, `openedAt` é registrado; ele não pode
voltar artificialmente ao estado bloqueado e deve ser substituído no próximo
ciclo de tuning.

## Próxima implementação

Ainda faltam três peças antes de M1 terminar:

1. escolher e congelar a janela real e seus sete mapas com fontes versionadas;
2. validar o extrator já implementado contra uma primeira demo real e fechar o
   schema das tabelas derivadas;
3. adquirir o volume completo e executar a auditoria humana sorteada.

O contrato atual prepara essas etapas sem inventar dados e sem tocar nos motores
do jogo.
