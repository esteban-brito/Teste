# Plano mestre R5 — fidelidade tática e caudas individuais

Data: 23 de julho de 2026

Baseline executável: `8136df1`

Manifesto congelado: `docs/r5-experiment.json`

## Objetivo e ordem causal

R5 altera o balanceamento somente quando um desvio observável possui alvo,
comparação pareada e efeito colateral mensurável. A ordem obrigatória é:

```text
evidência real -> alvo -> eventos de round -> estatísticas derivadas -> rating
```

Não se corrige evento tático ruim por meio de um bônus no rating. Não se usa
nome, ID, time ou época para selecionar uma regra.

## Diagnóstico de partida

O baseline R4.2 demonstrou:

- AWPer não possui comportamento de save distintivo;
- IGL primário mistura funções de combate incompatíveis;
- mortes trocadas e crédito de KAST são praticamente uniformes entre roles;
- rounds eco existem e não sustentam a hipótese de ausência de economia;
- a escolha de vítima ainda depende parcialmente do poder de frag;
- `formaDoDia` e `fallenAngels` contêm limites explícitos de cauda.

O corpus IFCS possui 1/800 mapas e 1/6 eventos. As faixas históricas da bancada
continuam sendo guardas de regressão, não alvos suficientes para inventar novos
multiplicadores por role.

## Etapas

### R5.0 — contrato do experimento

**Concluída.** O manifesto congelado identifica o baseline `8136df1`, hashes,
agenda, seeds, métricas, pisos materiais e gates de evidência.

- congelar hash do motor, auditoria, telemetria, agenda, seeds e contexto;
- registrar métricas, quantis, diferenças materialmente relevantes e pisos de
  regressão antes do primeiro candidato;
- separar dinâmica de partida do CS2 atual da identidade relativa de elencos
  históricos.

### R5.1 — comparação pareada

**Concluída.** A captura de desenvolvimento possui 1.088 mapas e 10.880
player-maps; baseline contra baseline gera delta e IC95% exatamente zero, e as
mutações sintéticas provam detecção de regressão e deriva de contexto.

- capturar uma observação por jogador e mapa;
- preservar IDs, confronto, mapa, seed, orientação, lado e compras;
- calcular diferenças no mesmo player-map e IC95% bloqueado por mapa;
- reportar geral, função primária e função de combate efetiva;
- exigir delta zero em baseline contra baseline;
- provar com mutação sintética que regressão e deriva de contexto são detectadas.

A agenda de desenvolvimento possui 1.088 mapas e 10.880 player-maps. A execução
de release exige ao menos 50.000 mapas. Caudas da ordem de 1/10.000 ou 1/100.000
são avaliadas em suíte própria com ao menos um milhão de player-maps; o máximo
observado é descritivo e nunca vira teto.

A captura em memória é deliberadamente uma ferramenta de desenvolvimento. Antes
de R6, o mesmo contrato será executado em lotes/streaming para não manter centenas
de milhares de observações simultaneamente. O pool completo do produto continua
como regressão; o corpus oficial usa separadamente apenas os sete mapas da época
congelada, sem misturar Train no alvo real.

### R5.2 — caudas sem curadoria

**Concluída.** O clamp final do rating foi removido e a forma passou a usar
continuações suaves, positivas e sem limite superior, preservando os pontos de
RNG. Provas, deltas pareados, benchmark e mudanças intencionais do golden estão
em `docs/r5-tail-balance-2026-07-23.md`.

- remover o clamp final de rating `0,30–3,0`;
- substituir o teto de `formaDoDia` por uma distribuição positiva sem limite
  superior e com momentos finitos;
- reutilizar a amostra gaussiana atual, sem adicionar pontos de RNG;
- testar valores abaixo de 0,30 e acima de 3,0, ausência de massa nos limites,
  finitude e estabilidade dos quantis.

Limites matemáticos de probabilidade em `[0,1]` permanecem necessários e não são
tetos de desempenho.

### R5.3 — alvos empíricos

**Gate operacional ajustado pelo responsável.** O corpus IFCS completo não será
adquirido neste ciclo e permanece uma trilha futura opcional. R5 pode usar
evidência direcionada, regras já classificadas e comparações pareadas, sem
inventar faixas por role nem alegar uma nota IFCS oficial.

- usar a população congelada em `docs/fidelity-target.json` para dinâmica CS2;
- rotular roles por protocolo anterior ao resultado, sem escolher jogadores que
  favoreçam a hipótese;
- avaliar identidade histórica por hierarquia e normalização de época;
- não comparar ratings brutos de eras diferentes como escalas equivalentes;
- manter calibração, validação e holdout separados por evento.

A remoção de tetos é requisito explícito do produto e pode preceder o corpus
completo. Tuning tático numérico por role não pode usar faixas inventadas.

### R5.4 — fronteiras puras

**Concluída.** `combatProfile` e os componentes somáveis de `fallenAngels`
foram extraídos com golden idêntico e delta zero em 1.088 mapas pareados. A role
ativa de IGL permanece inalterada. Evidência em
`docs/r5-structural-extraction-2026-07-23.md`.

Em commit estrutural e com golden idêntico:

- extrair `combatProfile` com o comportamento corrente;
- decompor `fallenAngels` em componentes somáveis;
- manter CFG, dados, ordem das operações e RNG exatamente iguais.

### R5.5 — função de combate efetiva

**Concluída.** IGL preserva liderança, química e sistema, mas usa AWPer, Entry,
Rifler ou Support já classificado nas decisões de combate. Nenhum multiplicador
novo foi criado. Evidência em `docs/r5-effective-role-balance-2026-07-23.md`.

- IGL permanece liderança para sistema e química;
- decisões de combate de IGL usam seu papel secundário/efetivo;
- demais jogadores preservam sua função de combate;
- nenhuma classificação do roster é modificada no commit de balanceamento.

### R5.6 — exposição e save

**Exposição concluída; save pendente.** A vítima agora é escolhida por
volume residual de contato e um perfil contínuo derivado de função efetiva,
atributos `en`, `op`, `sn`, `cl`, `ut`, agressividade, lado e fase do round.
Entry assume mais primeiro contato; AWPer e Lurker não recebem bônus direto de
sobrevivência. Evidência em `docs/r5-exposure-balance-2026-07-23.md`.

Save será um candidato separado. Sem inventário individual, pode considerar
somente compra do time, vantagem numérica, objetivo e valor abstrato dos
sobreviventes. O relatório não afirmará que uma arma específica foi preservada.

### R5.7 — trade, assistência e KAST

- condicionar a oportunidade de trade ao contexto e à prontidão coletiva;
- usar `tr` para selecionar o refragger;
- usar utilidade e contexto para assistência;
- avaliar Entry por APR, sem transformar A/K no alvo principal;
- manter KAST como união factual de kill, assist, survival e trade;
- nunca aplicar crédito direto de KAST por role.

### R5.8 — rating após os eventos

- medir cada componente de `fallenAngels` separadamente;
- reportar quanto da fidelidade vem do prior histórico e quanto vem dos eventos;
- ajustar pesos apenas na parcela de calibração do corpus;
- revisar no conjunto de validação sem usar o holdout de release;
- tratar erro de atributo de jogador como correção de dados separada.

## Critérios de parada

Um candidato é rejeitado se:

- criar valor não finito ou quebrar igualdade global entre kills e deaths;
- perder ID, mapa, lado, compra ou reconciliação da telemetria;
- relaxar threshold ou atualizar golden para esconder diferença;
- degradar um estrato não alvo além do piso material congelado;
- cair abaixo das guardas atuais de rating;
- melhorar média enquanto piora caudas ou pior estrato;
- depender de condição nominal ou alterar dados junto com o motor.

Continuar dentro da faixa histórica não basta: também é exigida não inferioridade
contra o baseline observado, que hoje é mais forte que vários pisos da suíte.

## Commits e validação

Cada família usa commit próprio: infraestrutura, caudas, refatoração pura,
função efetiva, exposição, save, trade/assist e rating. Candidatos rejeitados não
permanecem acumulados.

R6 executa a comparação completa, lados invertidos, forças extremas, suíte rara,
`npm run validate` e E2E. Goldens só mudam depois de explicar cada diferença
intencional; publicação permanece separada da decisão científica.
