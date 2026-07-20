# IFCS — metodologia de fidelidade ao Counter-Strike

**Versão da metodologia:** 1.0-proposta

**Data:** 20 de julho de 2026

**Status:** especificação normativa para implementação; ainda não existe uma
nota IFCS oficial do jogo.

## 1. Objetivo

O **Índice de Fidelidade ao Counter-Strike (IFCS)** mede, de 0 a 100, quanto os
resultados observáveis do draft9-0 reproduzem o Counter-Strike profissional que
o produto declara representar.

O índice precisa responder, com dados e incerteza explícita:

> Se repetirmos muitas partidas no jogo sob contextos comparáveis, as regras,
> distribuições, relações condicionais, assinaturas de função e probabilidades
> de vitória se comportam como no Counter-Strike profissional real?

O IFCS não mede diversão, qualidade visual, facilidade, retenção ou preferência
pessoal. Também não prova realismo espacial ou mecânico que o jogo não simula.
Ele avalia somente alegações declaradas e saídas observáveis do produto.

## 2. Separação obrigatória entre verificação, validação e balanceamento

Três atividades diferentes não podem ser confundidas:

1. **Verificação:** confirma que o código executa a regra implementada, não gera
   valores impossíveis e preserva determinismo por seed.
2. **Validação:** compara o comportamento do modelo com dados reais que não
   foram usados para ajustá-lo.
3. **Balanceamento:** altera parâmetros para aproximar o modelo do alvo.

Golden tests, snapshot e regressão verificam estabilidade; eles não concedem
pontos de realismo. O IFCS é validação. Qualquer tuning motivado pelo IFCS deve
ser feito depois, em mudança e commit próprios, com comparação antes/depois.

## 3. Declaração do alvo antes de medir

Nenhuma nota é válida sem um **Target Specification Record** congelado. O
registro deve conter:

```json
{
  "methodologyVersion": "1.0",
  "targetId": "cs2-elite-lan-AAAA-MM",
  "gameRuleset": "Premier/Major vigente",
  "ratingModel": "HLTV 3.0 + revisão 2025-10-29",
  "population": "eventos LAN Valve-ranked, confrontos top-20",
  "dateStart": "AAAA-MM-DD",
  "dateEnd": "AAAA-MM-DD",
  "activeMapPool": [],
  "referenceManifestSha256": "...",
  "parser": { "name": "...", "version": "..." },
  "gameCommit": "...",
  "nodeVersion": "...",
  "seedManifestSha256": "..."
}
```

### 3.1 Dois alvos que não devem ser misturados

- **Dinâmica de partida:** CS2 profissional da época declarada, com regras,
  economia, mapas e definições estatísticas vigentes.
- **Representação histórica:** identidade relativa dos elencos históricos na
  própria era. Ratings de versões ou eras diferentes devem ser normalizados
  dentro da era; um valor bruto de 2016 não é diretamente comparável a 2026.

O jogo coloca elencos históricos num mesmo universo. Portanto, ele pode ser
avaliado pela dinâmica atual de partida e, separadamente, pela preservação da
assinatura histórica de cada elenco. A nota não deve fingir que confrontos
fantásticos entre eras possuem resultados reais observáveis.

### 3.2 Mudança de época

Alteração relevante de regras, economia, mapa, definição de rating ou formato
cria um novo `targetId`. Não se sobrescreve o corpus anterior. Comparações entre
notas de versões diferentes da metodologia ou do alvo devem ser identificadas
como não equivalentes.

## 4. Hierarquia de evidência

As referências devem seguir esta prioridade:

1. regras, configurações e demos de servidor publicadas por Valve/organizadores;
2. definições e estatísticas oficiais da HLTV;
3. corpus derivado das demos por pipeline versionado e auditado;
4. estudos primários e métodos estatísticos publicados;
5. julgamento especializado apenas quando não existir observação objetiva.

Faixa sem URL, janela temporal, filtro, tamanho de amostra e script de extração
não pode entrar no IFCS.

## 5. Corpus real de referência

### 5.1 População principal

A versão inicial deve usar uma janela homogênea de CS2 profissional:

- somente partidas LAN Valve-ranked;
- confrontos nos quais ambos os times estavam no top 20 na data do jogo;
- pelo menos 6 eventos independentes;
- pelo menos 800 mapas válidos e 80 mapas por mapa ativo;
- regras e economia pertencentes à mesma época declarada;
- exclusão documentada de forfeits, mapas incompletos, showmatches, demos
  corrompidas e configurações não padronizadas.

Se a janela não atingir os mínimos, ela deve ser ampliada sem atravessar uma
mudança material de regras. Toda exclusão recebe código de motivo; nenhuma é
feita porque o resultado “parece estranho”.

### 5.2 Unidade de independência

Mapas e rounds do mesmo evento não são observações totalmente independentes.
Por isso, divisões e bootstrap usam **evento como bloco primário** e partida
como bloco secundário. Não se deve tratar centenas de rounds correlacionados
como centenas de amostras independentes.

### 5.3 Extração e auditoria

Cada demo recebe hash SHA-256. O parser, suas opções e o script de transformação
são versionados. Uma amostra aleatória de 2% dos mapas, nunca inferior a 30,
deve ser conferida contra o placar oficial:

- time, mapa, lado inicial e placar final: 100% exatos;
- total de rounds e vencedor de cada round: 100% exatos;
- K/D/A dos jogadores: 100% exatos após regra documentada para assists;
- divergências de dano, trade ou flash: explicadas antes de usar a métrica.

Falha nessa auditoria invalida o corpus; não reduz a nota do jogo.

### 5.4 Divisão antioverfitting

Os eventos, e não mapas individuais, são divididos de forma estratificada:

- **60% calibração:** pode orientar tuning futuro;
- **20% validação:** compara alternativas durante desenvolvimento;
- **20% auditoria bloqueada:** calcula a nota pública e não orienta tuning.

O conjunto bloqueado é identificado por manifesto e só é aberto pelo comando de
release. Depois que uma equipe ajusta o modelo olhando esse conjunto, ele deixa
de ser bloqueado e precisa ser substituído na próxima versão do corpus.

## 6. Protocolo de simulação

### 6.1 Desenho pareado

O simulador deve receber contextos comparáveis ao corpus: mapa, lado, classe de
força, formato e época. Quando não for possível reproduzir um contexto, a
lacuna é registrada; não se inventa uma equivalência silenciosa.

### 6.2 Seeds e tamanho

- manifesto fixo com no mínimo 30 blocos independentes de seeds;
- mínimo inicial de 50.000 mapas simulados no benchmark completo;
- interrupção somente quando a meia largura do IC95% da nota total for ≤ 1,0
  ponto, respeitado o mínimo;
- teto operacional versionado; atingir o teto sem precisão suficiente produz
  nota provisória, não aprovação automática;
- ordem e quantidade de chamadas ao RNG do produto permanecem intocadas.

### 6.3 Eventos raros

Uma métrica condicional só é pontuada quando ambos os corpora atingem:

| Métrica | Mínimo por corpus |
|---|---:|
| clutch 1v1 | 400 oportunidades |
| clutch 1v2 | 250 oportunidades |
| clutch 1v3 | 120 oportunidades |
| anti-eco / force-buy | 400 rounds por condição |
| pós-plant / retake | 500 plants |
| assinatura de cada role | 10.000 player-rounds |

Se o corpus real for insuficiente, a nota não é publicável. Se o jogo não
expuser uma métrica que pertence ao escopo declarado, ela recebe zero; não é
removida do denominador.

## 7. Dimensões e pesos

Os pesos somam 100 e ficam congelados durante toda a versão 1.x.

| Dimensão | Peso | Conteúdo obrigatório |
|---|---:|---|
| Regras e formato competitivo | 10 | placar regulamentar, troca de lado, OT, Suíça, MD1/MD3, anti-rematch, bracket, veto e lado inicial |
| Ecologia de mapas e rounds | 15 | rounds/mapa, placares, margens, CT por mapa, OT, close games, comebacks e heterogeneidade dos mapas |
| Economia, objetivo e estados | 20 | distribuição de compras, transições, pistol, anti-eco, force, plant, pós-plant, retake, save, relógio e clutches |
| Produção individual e combate | 20 | KPR, DPR, ADR, KAST, assists, trades, aberturas, sobrevivência, multi-kill e estrutura conjunta das estatísticas |
| Roles, jogadores e identidade | 15 | assinatura vetorial por role, ordenação entre roles, rating por jogador/era e concentração de produção no time |
| Força competitiva e resultados | 10 | calibração de favoritos, upset, blowout, monotonicidade de força e conversão MD1→MD3 |
| Generalização e robustez | 10 | holdout por evento/tempo/mapa, pior estrato, estabilidade entre seeds e análise de incerteza |

### 7.1 Métricas globais e condicionais

Uma média global correta pode esconder um modelo errado. Cada grande métrica
deve ser examinada, quando aplicável, por:

- mapa;
- lado CT/T;
- estado econômico;
- placar e vantagem numérica;
- role;
- quartil de força;
- fase do evento;
- época/patch.

O score usa média ponderada e também o pior estrato relevante. Assim, acertar a
média misturando mapas excessivamente CT com mapas excessivamente TR não produz
nota máxima.

## 8. Distâncias estatísticas

Cada métrica `i` possui uma margem de equivalência prática `delta_i`, declarada
antes da execução e justificada no manifesto.

### 8.1 Escalares e proporções

```text
d_i = abs(sim_i - real_i) / delta_i
```

Pisos iniciais de relevância, usados com `max(piso, 0,25 × desvio entre eventos)`:

| Tipo | Piso inicial de `delta` |
|---|---:|
| proporção de rounds/eventos | 2 pontos percentuais |
| KPR, DPR ou APR | 0,02 por round |
| KAST | 2 pontos percentuais |
| ADR | 2 pontos de dano |
| rating médio/MAE | 0,03 |
| correlação após Fisher-z | 0,03 |

Esses pisos não são novas metas de balanceamento. Eles definem a menor diferença
considerada material e só podem mudar numa nova versão da metodologia.

### 8.2 Distribuições

Médias não bastam. Rounds/mapa, scoreline, KPR, ADR, KAST, rating e concentração
de kills devem comparar as distribuições empíricas completas por distância
Wasserstein-1:

```text
d_i = W1(F_sim, F_real) / max(0,10 × IQR_real, piso_i)
```

Wasserstein mantém a unidade original e revela deslocamento de massa mesmo
quando duas amostras têm médias semelhantes. ECDFs, quantis 5/25/50/75/95 e
histogramas continuam obrigatórios no relatório para tornar o número auditável.

### 8.3 Vetores e dependências

Assinaturas de roles usam RMSE ponderado após padronizar cada componente pela
IQR real. A dependência entre `K`, `D`, `A`, `ADR`, `KAST` e rating é comparada
por diferença entre matrizes de correlação e por quantis condicionais. Isso
impede um modelo de acertar cada média isolada e combinar estatísticas de forma
irreal.

### 8.4 Probabilidade de vitória

Probabilidades são avaliadas com **Brier Score**, curva de confiabilidade e
sharpness. O componente normalizado é:

```text
BSS = 1 - BS_modelo / BS_climatologia
score_brier = 100 × clamp(BSS, 0, 1)
```

O Brier é uma regra própria: recompensar confiança artificial não melhora a
esperança do score. A calibração é mostrada por decis de probabilidade, com IC95%
e tamanho de cada decil. AUC ou taxa bruta de acerto podem ser diagnósticos, mas
não substituem calibração.

### 8.5 Regras determinísticas

Cada item recebe:

- 100: conformidade objetiva com o alvo;
- 50: abstração documentada que preserva o efeito competitivo medido;
- 0: regra ausente, contraditória ou impossível de comprovar.

Pontuação parcial exige justificativa revisável; não pode ser atribuída apenas
porque o resultado “parece plausível”.

## 9. Conversão para 0–100

### 9.1 Aderência de uma métrica

Para distâncias normalizadas:

```text
accuracy_i = 100 × 0,8 ^ (d_i²)
```

Interpretação da curva:

| Distância | Aderência |
|---:|---:|
| 0 × delta | 100,0 |
| 0,5 × delta | 94,6 |
| 1 × delta | 80,0 |
| 2 × delta | 41,0 |
| 3 × delta | 13,4 |

A curva é contínua: não existe salto artificial entre “dentro” e “fora” de uma
faixa.

### 9.2 Penalidade por incerteza

O bootstrap em blocos estima a meia largura `h_i` do IC95% da diferença:

```text
reliability_i = min(1, delta_i / max(h_i, epsilon))
metricScore_i = accuracy_i × reliability_i
```

Quando `h_i <= delta_i`, a precisão é suficiente. Uma estimativa aparentemente
perfeita com amostra pequena não recebe nota máxima.

### 9.3 Agregação

```text
dimensionScore_k = soma(weight_i × metricScore_i) / soma(weight_i)
IFCS_point = soma(dimensionWeight_k × dimensionScore_k) / 100
```

Métrica que o simulador deveria expor, mas não expõe, recebe zero. Pesos não são
redistribuídos. Além da média, o relatório mostra cada dimensão e o pior estrato.

### 9.4 Incerteza da nota

São feitas pelo menos 1.000 reamostragens em blocos de eventos reais e blocos de
seeds simuladas. A saída oficial é sempre:

```text
IFCS = ponto [IC95% inferior, IC95% superior] · cobertura X%
```

A nota de release é o ponto arredondado; decisões de aprovação usam o limite
inferior do IC95%.

## 10. Cobertura, travas e limites da nota

### 10.1 Resultado inválido

Não se publica nota quando houver:

- hash de corpus, spec ou seeds divergente;
- NaN, infinito, probabilidade fora de `[0,1]` ou placar impossível;
- falha de reprodutibilidade com a mesma seed;
- auditoria do parser reprovada;
- corpus real abaixo dos mínimos obrigatórios;
- menos de 70% do peso com referência válida.

### 10.2 Caps contra conclusão excessiva

- cobertura entre 70% e 89,9%: nota provisória limitada a 79;
- ausência de conjunto de auditoria bloqueado: limitada a 79;
- qualquer dimensão central (mapas/rounds, economia ou combate) abaixo de 50:
  nota total limitada a 69;
- contradição material de regra competitiva declarada: limitada a 59.

Esses caps impedem que várias médias fáceis compensem uma parte essencial do CS
que esteja ausente ou incorreta.

### 10.3 Faixas de comunicação

| IFCS | Interpretação permitida |
|---:|---|
| 90–100 | fidelidade excepcional dentro do escopo declarado |
| 80–89 | alta fidelidade |
| 70–79 | comportamento global credível, com lacunas relevantes |
| 60–69 | fidelidade parcial |
| 40–59 | baixa fidelidade |
| 0–39 | comportamento distante do alvo |

Esses rótulos são comunicação. O diagnóstico por dimensão e o IC95% são mais
importantes que a categoria.

## 11. Guardas contra manipulação da nota

1. pesos, métricas, margens e exclusões são congelados antes da simulação;
2. tuning nunca usa o conjunto de auditoria bloqueado;
3. mudança de spec exige nova versão e relatório de impacto;
4. remover uma métrica ruim reduz cobertura ou atribui zero; não aumenta nota;
5. aumentar amostra reduz incerteza, mas não corrige discrepância sistemática;
6. resultado médio nunca esconde o pior mapa/role/estado econômico;
7. toda nota guarda commit, ambiente, corpus, parser, seeds e duração;
8. baseline anterior permanece disponível; não se atualiza snapshot para
   esconder regressão;
9. score oficial deve ser reproduzível por uma única linha de comando na CI;
10. o sandbox apenas lê o relatório produzido pelo scorer puro; não mantém uma
    segunda fórmula de nota.

## 12. Relatório obrigatório

O artefato JSON e sua versão humana devem conter:

- IFCS pontual, IC95%, cobertura e cap aplicado;
- sete notas de dimensão com pesos;
- cada métrica: real, sim, delta, distância, IC, amostra e score;
- quantis e ECDFs das distribuições principais;
- calibração de vitória por decil;
- resultados por mapa, role, economia, força e evento;
- pior estrato e maiores cinco desvios;
- lista de métricas ausentes ou insuficientes;
- hashes e versões do manifesto;
- tempo, número de mapas/rounds e blocos de seed;
- comparação com o último baseline usando a mesma metodologia.

Exemplo de cabeçalho:

```text
IFCS 78 [75, 81] · cobertura 96% · metodologia 1.0 · alvo cs2-elite-lan-2026-07
Regras 72 | Mapas 81 | Economia 74 | Combate 84 | Identidade 80 | Resultados 76 | Robustez 77
```

## 13. Relação com a bancada atual

Os benchmarks existentes continuam valiosos como guardas de regressão. Porém:

- `passed/eligible` do sandbox não é uma nota de 0–100;
- as faixas atuais não têm manifesto completo de proveniência;
- o mesmo resultado é dado a valores no centro e na borda;
- distribuições e dependências ainda são pouco testadas;
- métricas sem amostra são omitidas, enquanto o IFCS distingue falta de corpus
  de falta de capacidade do simulador;
- os valores reais e bandas estão duplicados entre Node e sandbox.

O IFCS deve nascer como módulo puro e fonte única. Node produz o relatório; o
sandbox somente o apresenta. A implementação não autoriza alterar motores,
pesos, thresholds, dados ou RNG.

## 14. Implementação incremental recomendada

### M0 — metodologia

- este documento;
- revisão dos pesos, escopo e caps pelo responsável;
- nenhuma nota oficial ainda.

### M1 — corpus e proveniência

- manifesto de partidas/demos com hashes;
- extrator versionado;
- auditoria de placares e eventos;
- splits por evento congelados.

### M2 — scorer puro

- funções de distância, bootstrap e agregação;
- fixtures sintéticas com notas conhecidas;
- teste de monotonicidade: aproximar o sim do real nunca piora a métrica;
- saída JSON determinística para seeds e corpus fixos.

Estado: implementado em `bancada/fidelity-score.js`, com contrato sintético em
`bancada/fidelity-score.test.js`. Isso valida a fórmula, mas não conclui M1 nem
autoriza uma nota oficial sem corpus real auditado.

### M3 — benchmark integrado

- comando `npm run test:fidelity` separado do benchmark de desempenho;
- execução rápida para diagnóstico e completa para release;
- primeira nota baseline sem qualquer tuning no mesmo commit.

Estado: o comando e a CLI somente leitura `npm run score:fidelity` existem; a
primeira baseline permanece pendente do corpus M1.

### M4 — apresentação

- sandbox lê o JSON do scorer;
- mostra nota, IC, cobertura, dimensões e desvios;
- remove contagem paralela somente depois de provar paridade dos indicadores.

### M5 — balanceamento posterior

- hipótese explícita por desvio;
- alteração isolada;
- IFCS de calibração, validação e auditoria antes/depois;
- rejeição de ganho global que degrade dimensão crítica ou holdout.

## 15. Fontes metodológicas e do domínio

Fontes consultadas em 20 de julho de 2026; a implementação deve fixar versões
ou hashes no manifesto:

- [Valve — Major Supplemental Rulebook](https://github.com/ValveSoftware/counter-strike_rules_and_regs/blob/main/major-supplemental-rulebook.md): formato do Major, Suíça, MD1/MD3, anti-rematch, bracket, veto, mapas e requisitos de demos.
- [HLTV — base estatística de CS2](https://www.hltv.org/stats/?csVersion=CS2): filtros por período, LAN, ranking, mapa e tipo de confronto.
- [HLTV — Introducing Rating 3.0](https://www.hltv.org/news/42485/introducing-rating-30): seis componentes, ajuste econômico e Round Swing.
- [HLTV — Rating 3.0 adjustments](https://www.hltv.org/news/43047/rating-30-adjustments-go-live): revisão de pesos e interpretação vigente desde outubro de 2025.
- [HLTV — Introducing Rating 2.0](https://www.hltv.org/news/20695/introducing-rating-20): definição histórica de ADR, KAST e componentes usada para elencos de eras anteriores.
- [Awpy](https://awpy.readthedocs.io/en/stable/): parser de demos CS2 com eventos, dano, posições e reconstrução de rounds.
- [NIST — Bootstrap Plot](https://www.itl.nist.gov/div898/handbook/eda/section3/bootplot.htm): estimação de incerteza e intervalos via reamostragem.
- [NIST — Goodness of Fit](https://www.itl.nist.gov/div898/handbook/apr/section2/apr232.htm): testes de aderência e controle de erro estatístico.
- [Chambers & Chandra — Random Effect Block Bootstrap](https://doi.org/10.1080/10618600.2012.681216): reamostragem para dados hierárquicos e dependentes em clusters.
- [del Barrio, Giné & Matrán — empirical Wasserstein distance](https://doi.org/10.1214/aop/1022677394): propriedades da distância Wasserstein entre distribuição empírica e real.
- [Brier (1950) — Verification of Forecasts Expressed in Terms of Probability](https://journals.ametsoc.org/doi/10.1175/1520-0493%281950%29078%3C0001%3AVOFEIT%3E2.0.CO%3B2): score próprio para previsões probabilísticas.
- [Gneiting & Raftery (2007) — Strictly Proper Scoring Rules](https://doi.org/10.1198/016214506000001437): fundamento para avaliar probabilidade sem premiar confiança falsa.
- [Decroos et al. — Valuing Player Actions in Counter-Strike](https://arxiv.org/abs/2011.01324): avaliação contextual de ações por mudança na chance de vencer o round.

## 16. Critério para a primeira nota oficial

A primeira nota IFCS só pode ser publicada quando M1–M3 estiverem concluídos,
com corpus auditado, cobertura ≥ 90%, holdout bloqueado, precisão de até 1 ponto
e execução reproduzida localmente e na CI. Até lá, os números atuais continuam
sendo diagnósticos e contratos de regressão, não uma alegação científica de
“X% realista”.
