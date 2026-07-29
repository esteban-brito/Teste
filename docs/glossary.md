# Glossário do domínio

## Motores

- **PRISMA:** classifica role primário, role secundário e papel de combate do IGL.
- **ZÊNITE:** classifica playstyle e calcula OVR.
- **SINAPSE:** calcula química, treinador e força efetiva do elenco.
- **MARÉ:** aplica forma diária e forma de campanha.
- **PÓLVORA:** simula combate, rounds, mapas e séries.
- **COFRE:** parte econômica da simulação: compra, equipamento e recompensas.
- **FALLEnANGELs:** calcula rating contextual pós-combate.
- **Calibrador:** procura alterações globais que satisfaçam uma intenção com
  mínimo dano colateral.

## Jogador

- **Atributos crus:** `fp`, `en`, `tr`, `op`, `cl`, `sn`, `ut`, rating,
  colocação e indicação de IGL.
- **Role primário:** função principal calculada pelo PRISMA.
- **Role secundário:** alternativa plausível, penalizada pela realidade do par.
- **Role secundário forte:** secundário com afinidade relativa suficiente para
  contar integralmente na composição.
- **Combat role:** role usado por um IGL para avaliação de combate.
- **Playstyle:** padrão universal calculado a partir de seis eixos.
- **OVR:** nota inteira de 5 a 22 produzida pelo ZÊNITE.
- **Reality cost:** custo de plausibilidade de um par role/role ou
  role/playstyle.

## Time

- **Força bruta:** soma dos OVRs dos cinco jogadores.
- **Química bruta:** resultado de composição e playstyles antes da resistência
  de talento e do comando.
- **Química efetiva:** química após resistência de talento e comando.
- **Força efetiva:** força bruta multiplicada por química e treinador.
- **Pilar:** capacidade esperada da composição, como comando, AWP, âncora ou
  iniciativa.
- **Saturação:** excesso de jogadores cobrindo a mesma role.

## Calibrador

- **Intenção:** resultado desejado para jogador, time ou métrica.
- **Margem:** distância até a fronteira que mudaria role, estilo ou OVR.
- **Mudança material:** troca de role/playstyle, OVR inteiro ou grande mudança
  de plausibilidade.
- **Margem interna/soft change:** redução de robustez sem mudança material.
- **marginDamage:** dano normalizado causado às margens de decisão.
- **Collateral:** alterações fora do alvo da intenção.
- **Pareto:** alternativas não dominadas em objetivo e custo.

## Torneio

- **Suíça:** times com campanha igual são pareados; três vitórias classificam e
  três derrotas eliminam.
- **MD1/MD3:** melhor de um ou melhor de três mapas.
- **Anti-rematch:** tentativa de evitar repetição de confrontos, com fallback
  quando não há pareamento perfeito.

## Testes e fidelidade

- **Expectativa de longo prazo:** agregação de muitos mapas para estimar o valor
  médio ao qual o confronto converge; não representa uma temporada real.
- **Modo campanha:** sequência competitiva curta separada da expectativa. O
  primeiro recorte é uma MD3 isolada com mapas únicos, orientação alternada e
  forma mantida durante a série; não é sinônimo de lote de 491 mapas.
- **Desvio-padrão:** dispersão dos resultados de mapa para mapa; não mede a
  precisão da média.
- **Percentil:** posição na distribuição observada; P5 e P95 delimitam a região
  que contém aproximadamente os 90% centrais da amostra.
- **Faixa 80% / P10–P90:** intervalo que retira os 10% resultados menores e os
  10% maiores; representa a região recorrente sem esconder mínimo e máximo.
- **Intervalo de confiança:** faixa de incerteza da estimativa de uma média ou
  proporção; não é a faixa esperada de resultados individuais.
- **Erro assinado:** `simulado - real`, preservando a direção do viés.
- **Erro absoluto:** tamanho do erro sem considerar direção.
- **Inversão de hierarquia:** quando a ordem simulada de dois jogadores troca em
  relação à referência; deve ser avaliada por frequência, tamanho e contexto.
- **E2E (end-to-end):** teste automatizado que usa o jogo pelo navegador como
  uma pessoa usaria, cobrindo o fluxo inteiro entre a tela inicial e o resultado.
- **IFCS:** Índice de Fidelidade ao Counter-Strike; protocolo de 0 a 100 que
  compara o simulador com um corpus real, com incerteza, cobertura e travas.
- **Alvo (`target`):** definição congelada do Counter-Strike que será imitado:
  versão, período, nível competitivo, mapas e regras.
- **Corpus:** conjunto de demos reais e dados derivados usado como referência.
- **Manifesto:** arquivo auditável que registra origem, hashes, exclusões,
  versões, splits e resultados verificados do corpus.
- **SHA-256:** impressão digital criptográfica usada para detectar qualquer
  alteração em uma demo, regra, extrator ou manifesto.
- **Cobertura:** parcela do peso total do IFCS sustentada por métricas válidas.
- **Wasserstein-1:** distância entre duas distribuições; no IFCS, mede quanto a
  distribuição simulada precisaria “se mover” para coincidir com a real.
- **Brier Skill Score:** comparação da qualidade de probabilidades previstas
  contra uma referência; premia calibração, não confiança excessiva.
- **Bootstrap / IC95%:** reamostragem usada para estimar a incerteza; o IC95%
  informa uma faixa plausível para a nota, não uma garantia absoluta.
- **Calibração, validação e auditoria:** três splits separados: ajustar, medir e
  conferir generalização. O holdout de auditoria não pode orientar tuning.
- **Holdout:** parte bloqueada do corpus, escondida da equipe de tuning até a
  avaliação final.
- **Nota provisória:** diagnóstico incompleto, que não pode ser divulgado como
  medida científica oficial.
- **Nota oficial:** resultado reproduzível que cumpriu corpus, auditoria,
  cobertura, precisão e proveniência exigidos pela metodologia.
