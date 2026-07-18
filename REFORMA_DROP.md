# Reforma estrutural: drop, Rifler generalista e Facilitador

Esta versão não contém exceção por nome de jogador. O drop é usado apenas como caso de validação de conceitos globais.

## Resultado esperado

- drop: `Rifler / Entry · Facilitador · OVR 14`
- nenhuma outra mudança material no elenco em relação ao modelo anterior
- trade continua relevante para a qualidade do Facilitador
- perfis com trade e utility maiores recebem OVR superior

## Mudanças do motor

### Rifler generalista

Perfis equilibrados em firepower, entrada e utility recebem um bônus contínuo de Rifler quando não há uma especialidade dominante em abertura, clutch ou AWP. O bônus é configurável por `CFG_AVALIACAO` e não é um gate rígido.

### Facilitador: identidade separada da qualidade

A identidade continua usando a receita global `w`, complementada por um bônus contextual de equilíbrio entre fogo, entrada e utility. Trade aumenta a confiança, mas não funciona como requisito mínimo rígido.

A qualidade/OVR do Facilitador usa `ovrW`:

- UT: 50%
- TR: 35%
- EN: 10%
- FP: 5%

Assim, um jogador pode ser corretamente identificado como Facilitador sem ser um Facilitador forte. O trade baixo do drop limita o OVR a 14.

### IA do sandbox

A busca ganhou alavancas semânticas para:

- reconhecimento de Rifler generalista;
- reconhecimento de Facilitador glue;
- ajuste de `ovrW` sem alterar a identidade;
- combinação de `ratingWeight` com a receita de qualidade antes de recorrer a parâmetros globais de OVR;
- ignorar dimensões já satisfeitas na composição multiobjetivo.

### Colaterais

A interface e o custo agora separam:

- mudanças materiais: role, playstyle, OVR inteiro ou piora rara de realidade;
- margens internas: risco latente sem mudança visível.

No caso Boombl4 Support → Entry, a interface mostra corretamente:

- 1 jogador muda junto: steel;
- 10 margens internas afetadas.

Ela não apresenta mais essas margens como “11 jogadores mudam junto”.

## Testes adicionados

- `bancada/drop-reform.js`
- caso padrão do drop no calibrador;
- IA recuperando a reforma a partir do modelo legado, com zero colateral material;
- regressão visual Boombl4/steel/margens;
- OVR 15 do drop usando ajuste local do Facilitador, sem `OVR_BASE` global;
- perfis sintéticos de Facilitador forte e Entry especialista.

## Validação

Executado nesta entrega:

- `npm run check`: verde;
- `npm run lint`: verde;
- testes do calibrador: verdes;
- casos pesados do calibrador: verdes quando executados isoladamente;
- workers reais: verdes;
- realismo `N=100`: todas as faixas verdes;
- rating `N=100`: correlação `r=0.802`, MAE `0.091`;
- E2E Playwright existente: preservado; é pulado quando Playwright/Chromium não está instalado.

Para a validação padrão do repositório:

```bash
npm ci
npm run check
npm run lint
npm run bench
```

### Hardening adicional do arquétipo

O limite de tempo do modo de arquétipo agora interrompe os três loops aninhados de validação. Antes, um `break` simples saía apenas do loop interno e podia continuar percorrendo combinações depois do orçamento, causando execução imprevisivelmente longa em bench ou na interface.
