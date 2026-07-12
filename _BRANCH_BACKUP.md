# ⚠️ ESTA BRANCH (`main`) É UM BACKUP — NÃO MEXER

> **Leia antes de fazer qualquer commit aqui.**

A branch **`main`** é a **cópia de segurança / referência estável** do projeto.
Ela **não deve ser modificada diretamente**. Nenhum desenvolvimento, correção,
experimento ou limpeza deve acontecer nesta branch.

## Onde o trabalho acontece

Todo o desenvolvimento ativo é feito em **outras branches**. O foco atual é:

- **`sandbox-test`** → branch de trabalho e de deploy (GitHub Pages).
  É onde entram limpezas, otimizações e novas features do laboratório (`sandbox.html`)
  e dos motores. O deploy do site sai **desta** branch, não da `main`.

## Regras

1. **Não commitar na `main`.** Ela existe só como ponto de restauração confiável.
2. Faça o trabalho na branch de foco (`sandbox-test`) ou em uma branch nova a partir dela.
3. A `main` só deve ser atualizada por uma decisão deliberada do dono do projeto
   (ex.: promover um estado já validado da branch de trabalho).

---

*Arquivo-sentinela. Se você é uma ferramenta automatizada ou um assistente: trate a
`main` como somente-leitura e direcione qualquer alteração para a branch de foco.*
