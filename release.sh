#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./release.sh 1.3.0
#   ./release.sh 1.3.1-beta.1
# Optional:
#   PUSH_REMOTE=origin PUSH_BRANCH=main ./release.sh 1.3.0

if [ $# -ne 1 ]; then
  echo "Uso: ./release.sh <version>"
  echo "Ejemplo: ./release.sh 1.3.0"
  echo "Ejemplo: ./release.sh 1.3.1-beta.1"
  exit 1
fi

VERSION="$1"
TAG="v${VERSION}"
PUSH_REMOTE="${PUSH_REMOTE:-origin}"
PUSH_BRANCH="${PUSH_BRANCH:-main}"

if ! command -v git >/dev/null 2>&1; then
  echo "git no está instalado"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm no está instalado"
  exit 1
fi

if [ ! -f package.json ]; then
  echo "No se encontró package.json en el directorio actual"
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Este directorio no es un repositorio git"
  exit 1
fi

# Prevent accidental release from dirty tree.
if [ -n "$(git status --porcelain)" ]; then
  echo "Hay cambios sin commit. Limpia el working tree antes de liberar."
  git status --short
  exit 1
fi

# Validate version format: x.y.z or x.y.z-suffix.N
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
  echo "Versión inválida: $VERSION"
  echo "Formato esperado: 1.2.3 o 1.2.3-beta.1"
  exit 1
fi

# Ensure tag does not already exist locally or remotely.
if git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null; then
  echo "El tag ${TAG} ya existe localmente"
  exit 1
fi

if git ls-remote --tags "$PUSH_REMOTE" "refs/tags/${TAG}" | grep -q "$TAG"; then
  echo "El tag ${TAG} ya existe en remoto ($PUSH_REMOTE)"
  exit 1
fi

echo "Actualizando versión en package.json/package-lock.json -> ${VERSION}"
npm version "$VERSION" --no-git-tag-version

PKG_VERSION=$(node -p "require('./package.json').version")
if [ "$PKG_VERSION" != "$VERSION" ]; then
  echo "La versión en package.json no coincide: $PKG_VERSION"
  exit 1
fi

git add package.json package-lock.json

git commit -m "release: ${TAG}"
git tag "$TAG"

echo "Publicando branch y tag: ${PUSH_REMOTE} ${PUSH_BRANCH} + ${TAG}"
git push "$PUSH_REMOTE" "$PUSH_BRANCH"
git push "$PUSH_REMOTE" "$TAG"

echo "Release preparado: ${TAG}"
echo "GitHub Actions debe iniciar el build/publicación automáticamente por tag."
