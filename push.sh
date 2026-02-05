#!/bin/sh
# Push al repo remoto vía SSH
set -e
cd "$(dirname "$0")"

REMOTE="git@github.com:qbklabs/dodada-desing-tokens.git"

if ! git remote get-url origin 2>/dev/null; then
  git remote add origin "$REMOTE"
else
  git remote set-url origin "$REMOTE"
fi

git branch -M main
git push -u origin main
