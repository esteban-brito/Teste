# R5.6b — save por valor abstrato dos sobreviventes

Data: 23 de julho de 2026

Baseline: `9a1dce9`

## Hipótese e mecanismo

O ramo de save já considerava compra do time, desvantagem numérica e objetivo,
mas não distinguia quais jogadores permaneciam vivos. O candidato acrescenta
um valor abstrato de preservação: a média simples e normalizada de `sn`, `cl`,
`ut` e `fp`.

Não existe tabela de bônus por função. A identidade emerge dos atributos: no
elenco aprovado, a média é `0,497`; AWPer fica em `0,717`, Lurker em `0,564`,
Rifler em `0,476`, Support em `0,405` e Entry em `0,373`, considerando a função
efetiva dos IGLs.

A média dos sobreviventes é subtraída da média global e desloca em `0,20` a
probabilidade do ramo existente. Portanto, uma composição de valor médio tem
delta zero. O candidato reutiliza o mesmo sorteio: não cria ponto de RNG, bônus
direto de sobrevivência, clamp ou condição por jogador/time.

## Comparação pareada

Nas mesmas 1.088 partidas e 10.880 player-maps da R5.6a:

| Métrica global | Antes | Depois | Delta | IC95% do delta |
|---|---:|---:|---:|---:|
| Rating | 1,14228 | 1,14213 | -0,00015 | -0,00059 a +0,00029 |
| KPR/DPR | 0,69570 | 0,69544 | -0,00026 | -0,00113 a +0,00061 |
| KAST | 73,1427% | 73,1586% | +0,0159 p.p. | -0,0253 a +0,0570 p.p. |
| ADR | 78,9799 | 78,9422 | -0,0377 | -0,1358 a +0,0605 |
| Sobrevivência | 30,4296% | 30,4558% | +0,0261 p.p. | -0,0606 a +0,1129 p.p. |
| Save explícito | 1,0487% | 1,0526% | +0,0039 p.p. | -0,0154 a +0,0232 p.p. |

O efeito por função primária confirma que a mudança não é inflação global:

| Função | Save antes | Save depois | Delta |
|---|---:|---:|---:|
| AWPer | 1,141% | 1,260% | +0,119 p.p. |
| Rifler | 0,751% | 0,750% | -0,001 p.p. |
| Entry | 0,753% | 0,721% | -0,033 p.p. |
| Lurker | 1,193% | 1,190% | -0,003 p.p. |
| Support | 1,208% | 1,154% | -0,054 p.p. |
| IGL | 1,313% | 1,291% | -0,022 p.p. |

AWPer ganhou `0,119` p.p., aproximadamente 10,4% em termos relativos, nos dois
lados: CT `0,774%→0,876%` e TR `1,515%→1,659%`. Seus deltas de DPR
(`-0,0005`), KPR (`-0,0007`) e KAST (`+0,0018` p.p.) foram imateriais.

## Benchmark, goldens e limite semântico

Em 45.900 mapas e 937.807 rounds, todas as guardas passaram. Correlação do
rating ficou em `0,958`, MAE `0,047`, inclinação `1,013` e maior erro `0,172`.
Macro, economia, clutches, produção por função e favoritos permaneceram verdes.

Os três goldens Node permaneceram idênticos ao commit de exposição; nenhum
fixture foi atualizado nesta família.

`Save` continua significando apenas que o jogador sobreviveu num ramo coletivo
explícito. A simulação não conhece arma comprada, arma carregada ou equipamento
preservado por jogador. Portanto, este resultado demonstra identidade de decisão
e não autoriza afirmar que uma AWP específica foi salva. Não é nota IFCS oficial.

`npm run validate` aprovou check, lint e as 19 suítes em 189,9 s. O E2E da aba
Simular confirmou que o golden de campanha permaneceu idêntico.
