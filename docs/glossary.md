# Glossário do domínio

## Motores

- **PRISMA:** classifica role primário, role secundário e subarquétipo.
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
- **Subarquétipo:** leitura mais específica dentro da role.
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

