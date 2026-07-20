# ADR 0002: separar dados crus de valores derivados

- Status: proposto
- Data: 2026-07-19

## Contexto

Jogadores e times estão no mesmo arquivo das fórmulas que calculam role,
playstyle, OVR, química e força. A página de elencos mantém outra representação
gerada.

## Decisão proposta

Manter em `src/data` somente atributos, metadados e definições de times.
Role, playstyle, OVR, treinador, química e força são sempre derivados pela API
do domínio. Artefatos gerados devem ser verificáveis e não editados à mão.

## Consequências

- Inclusão de times fica validável sem navegar pelo motor.
- IDs passam a ser contratos persistentes.
- O gerador de elencos precisa consumir a mesma API pública.

