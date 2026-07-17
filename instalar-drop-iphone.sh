#!/usr/bin/env bash
set -Eeuo pipefail

REPO_BRANCH="sandbox-test"
ZIP="$(find . -maxdepth 1 -type f -name 'Teste-sandbox-test-drop-reform*.zip' -print -quit)"

if [[ -z "${ZIP:-}" ]]; then
  echo "ERRO: não encontrei o ZIP da reforma na raiz do Codespace."
  exit 1
fi

CURRENT="$(git branch --show-current)"
if [[ "$CURRENT" != "$REPO_BRANCH" ]]; then
  echo "Trocando de $CURRENT para $REPO_BRANCH..."
  git switch "$REPO_BRANCH"
fi

echo "Atualizando a branch de trabalho..."
git fetch origin "$REPO_BRANCH"
git reset --hard "origin/$REPO_BRANCH"

BACKUP="backup-antes-reforma-drop-$(date +%Y%m%d-%H%M%S)"
echo "Criando backup remoto: $BACKUP"
git branch "$BACKUP"
git push origin "$BACKUP"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Extraindo a reforma..."
unzip -oq "$ZIP" -d "$TMP"
ROOT="$(find "$TMP" -mindepth 1 -maxdepth 1 -type d -print -quit)"
if [[ -z "${ROOT:-}" || ! -f "$ROOT/game.js" || ! -f "$ROOT/sandbox.html" ]]; then
  echo "ERRO: estrutura inesperada dentro do ZIP."
  exit 1
fi

cp -a "$ROOT"/. .
rm -f "$ZIP"

echo "Instalando dependências..."
npm ci

echo "Rodando validações adequadas para o Codespace do iPhone..."
npm run check
npm run lint
npm run test:drop
node bancada/calibrador.js

# O bench completo é pesado e será executado pelo GitHub Actions.
# O workflow só publica no Pages se check, lint e bench passarem na CI.

echo "Preparando commit..."
git add -A
if git diff --cached --quiet; then
  echo "Nenhuma mudança para commitar."
  exit 0
fi

git commit -m "reformula drop, Rifler generalista e Facilitador"
git push origin "$REPO_BRANCH"

echo
echo "SUCESSO: push enviado para sandbox-test."
echo "Agora aguarde o GitHub Actions; o Pages só atualiza se a bancada completa ficar verde."
