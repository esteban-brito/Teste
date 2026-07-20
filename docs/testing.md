# Estratégia de testes

## Princípio

Os testes protegem comportamento, não a organização interna. Uma extração de
módulo deve manter snapshots, seeds, métricas e contratos públicos. Alteração de
limite estatístico exige justificativa de balanceamento separada.

## Grupos atuais

| Comando | Suítes | Finalidade |
|---|---|---|
| `npm run test:data` | `times.js` | integridade de jogadores, times e derivados |
| `npm run test:regression` | auditoria, snapshot, drop | classificação e invariantes aprovados |
| `npm run test:calibrator` | basic, heavy, worker | busca, intenção, custo e paralelismo |
| `npm run test:benchmark` | realismo, assists, KDA, rating | fidelidade estatística dos motores |
| `npm run test:e2e` | intent | fluxo do calibrador no navegador |
| `npm run test:all` | as 12 suítes acima | validação completa na ordem histórica |
| `npm run bench` | alias de `test:all` | compatibilidade com CI e fluxo legado |

`npm run validate` executa sintaxe, lint e as 12 suítes.

## Estado de referência

- A aplicação possui 17 times e 85 cards de jogador.
- O snapshot deve conter exatamente uma entrada por ID cru de `ATRIBUTOS`.
- Os benchmarks usam amostragem; limites são os contratos, e uma execução
  específica é registrada em `docs/baseline.md`.
- A CI usa Node 20. Desenvolvedores em outra versão devem registrar divergências.

## Atualização de snapshot

1. Execute `npm run test:regression` e leia todas as diferenças.
2. Confirme que cada jogador alterado pertence ao objetivo aprovado.
3. Execute `npm run snapshot:update`.
4. Revise o diff JSON manualmente.
5. Execute novamente regressão e benchmark.
6. Não misture a atualização com movimentação de arquivos ou formatação.

## E2E e dívida conhecida

`bancada/e2e-intent.js` tenta localizar Playwright e atualmente retorna sucesso
com um aviso quando ele não está disponível. Isso preserva o fluxo legado, mas
não significa que o navegador foi testado. A etapa de CI profissionalizada deve
instalar Chromium e tornar o E2E obrigatório no job correspondente.

## Próximas camadas

- Unitários de fórmulas e limites após cada motor ser extraído.
- Golden tests de simulação com seed e sequência completa de eventos.
- Integração do torneio sem DOM.
- E2E do fluxo principal: draft, lineup, suíça e playoffs.
- Screenshots responsivos e com `prefers-reduced-motion`.
- Benchmark de desempenho separado dos asserts de realismo.

