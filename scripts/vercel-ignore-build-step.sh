#!/usr/bin/env bash

set -u

previous_sha="${VERCEL_GIT_PREVIOUS_SHA:-}"

# Vercel may provide a previous SHA that is not present in a shallow clone.
# In uncertainty, BUILD rather than failing or incorrectly skipping.
if [[ -z "$previous_sha" ]] || ! git cat-file -e "${previous_sha}^{commit}" 2>/dev/null; then
  echo "Previous Git SHA unavailable in clone; proceeding with build."
  exit 1
fi

# Skip only when every change is confined to the separately deployed
# Studio Admin subtree.
if git diff --quiet "$previous_sha" HEAD -- . ':(exclude)apps/studio-admin/**'; then
  echo "No Studio frontend changes detected; skipping build."
  exit 0
fi

echo "Studio frontend changes detected; proceeding with build."
exit 1
