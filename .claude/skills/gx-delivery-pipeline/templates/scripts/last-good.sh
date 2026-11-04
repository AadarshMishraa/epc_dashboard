#!/usr/bin/env bash
# Print the newest commit SHA that passed acceptance in <env> (tag good/<env>/<utc-ts>)
# and is not marked bad (tag bad/<sha>). Optionally skip one SHA (the build being replaced).
# Prints nothing and exits 0 when there is no candidate. Needs full history and tags.
#   usage: last-good.sh <env> [exclude-sha]
set -euo pipefail

ENV_NAME="${1:?usage: last-good.sh <env> [exclude-sha]}"
EXCLUDE="${2:-}"

while read -r tag; do
  [ -n "$tag" ] || continue
  sha="$(git rev-list -n1 "$tag")"
  [ "$sha" = "$EXCLUDE" ] && continue
  git rev-parse -q --verify "refs/tags/bad/$sha" >/dev/null && continue
  echo "$sha"
  break
done < <(git tag -l "good/${ENV_NAME}/*" --sort=-creatordate)
