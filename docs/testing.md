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
| `npm run test:regression` | auditoria, snapshot, drop | classificação e invariantes aprovados |
| `npm run test:calibrator` | basic, heavy, worker | busca, intenção, custo e paralelismo |
| `npm run test:benchmark` | realismo, assists, KDA, rating | fidelidade estatística dos motores |
| `npm run test:fidelity` | scorer e corpus IFCS | matemática, cobertura, caps, proveniência e auditoria |
| `npm run test:e2e` | intent, simulation, game flow | calibrador, aba Simular e jogo principal no navegador |
| `npm run test:all` | as 16 suítes acima | validação completa na ordem histórica |
| `npm run bench` | alias de `test:all` | compatibilidade com CI e fluxo legado |

`npm run validate` executa sintaxe, lint e as 16 suítes.

## Estado de referência

- A aplicação possui 17 times e 85 cards de jogador.
- O snapshot deve conter exatamente uma entrada por ID cru de `ATRIBUTOS`.
- Os benchmarks usam amostragem; limites são os contratos, e uma execução
  específica é registrada em `docs/baseline.md`.
- A CI usa Node 20. Desenvolvedores em outra versão devem registrar divergências.

O `docs/baseline.md` é um retrato histórico: sua contagem de 13 suítes corresponde
à captura de 19 de julho de 2026, não à bancada atual. A última validação completa
registrada, em 20 de julho de 2026, aprovou 16/16 suítes em 183,4 s, incluindo
45.900 mapas e 940.452 rounds. Isso confirma regressão; não é
uma nota IFCS oficial.

## Validação do extrator IFCS

O extrator de demos é uma ferramenta Python offline, separada do runtime e da
validação Node:

```text
python -m venv .venv-fidelity
.venv-fidelity/Scripts/python -m pip install -r requirements-fidelity.lock
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
em `docs/fidelity-technical-baseline.json`: 4.000 mapas, 131/136 avaliações
aprovadas e resultado arredondado 96/100.

## Atualização de snapshot

1. Execute `npm run test:regression` e leia todas as diferenças.
2. Confirme que cada jogador alterado pertence ao objetivo aprovado.
3. Execute `npm run snapshot:update`.
4. Revise o diff JSON manualmente.
5. Execute novamente regressão e benchmark.
6. Não misture a atualização com movimentação de arquivos ou formatação.

## E2E obrigatório

Playwright é uma dependência de desenvolvimento e Chromium é instalado
explicitamente na CI. Ausência da biblioteca, do browser ou falha de lançamento
encerra a suíte com erro. Um E2E pulado não é considerado cobertura.

`e2e-intent.js` protege o caminho paralelo do calibrador. `e2e-simulation.js`
protege mapa, lote A × B e amostra round-robin da liga. O contrato inclui
KAST/ADR/Rating, lados, plant e pós-plant, anti-eco, conversão pós-pistol,
clutches, força do favorito, métricas por função, diagnóstico de suficiência,
cobertura dos 17 times, probabilidades bilaterais, seed automática por execução,
rolagem, responsividade, valores inválidos e erros de página. O determinismo do
motor por seed continua sendo um contrato separado, descrito no ADR 0003.

`e2e-game-flow.js` percorre o jogo principal pela interface real: sorteia e
monta os seis slots, valida força e química, disputa Suíça e playoffs, confere
placares e ratings, chega à tela final e reinicia a campanha. O teste escolhe
uma seed vencedora reproduzível para cobrir todas as fases sem alterar o RNG ou
o balanceamento executável do produto.

## Próximas camadas

- Unitários de fórmulas e limites após cada motor ser extraído.
- Golden tests de simulação com seed e sequência completa de eventos.
- Integração do torneio sem DOM.
- Screenshots responsivos e com `prefers-reduced-motion`.
- Benchmark de desempenho separado dos asserts de realismo.
- Adquirir, auditar e selar o corpus real; então produzir a primeira baseline
  IFCS sem tuning no mesmo commit.
