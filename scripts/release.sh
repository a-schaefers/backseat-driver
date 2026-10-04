#!/bin/bash
# Cut a release: bump the version in plugin/.claude-plugin/plugin.json, check
# everything, commit, and tag it the way Claude Code expects
# (`backseat-driver--v0.3.0`, made by `claude plugin tag`).
#
#   scripts/release.sh patch|minor|major    bump and release
#   scripts/release.sh 0.3.0                release an exact version
#   scripts/release.sh ... --push           also push the commit and the tag
#
# A running tutor notices the new tag within six hours and offers
# /bsd update. Installed copies are pinned to the version in plugin.json, so
# nothing reaches them until a release changes it.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
manifest=plugin/.claude-plugin/plugin.json
bump="${1:-}"
push="${2:-}"

if [ -z "$bump" ]; then
  echo "usage: scripts/release.sh patch|minor|major|X.Y.Z [--push]" >&2
  exit 2
fi
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "The working tree has uncommitted changes. Commit or stash them first." >&2
  exit 1
fi
if [ "$(git rev-parse --abbrev-ref HEAD)" != "main" ]; then
  echo "Releases are cut from main." >&2
  exit 1
fi
git fetch --quiet origin
if [ "$(git rev-list --count HEAD..origin/main)" != "0" ]; then
  echo "origin/main has commits this branch does not. Pull first." >&2
  exit 1
fi

current="$(node -p "require('./$manifest').version")"
next="$(node -e '
  const [major, minor, patch] = process.argv[1].split(".").map(Number)
  const bump = process.argv[2]
  if (/^\d+\.\d+\.\d+$/.test(bump)) console.log(bump)
  else if (bump === "major") console.log(`${major + 1}.0.0`)
  else if (bump === "minor") console.log(`${major}.${minor + 1}.0`)
  else if (bump === "patch") console.log(`${major}.${minor}.${patch + 1}`)
  else process.exit(2)
' "$current" "$bump")" || { echo "Not a bump: $bump" >&2; exit 2; }

echo "Releasing $current -> $next"
node -e '
  const fs = require("fs")
  const path = process.argv[1]
  const text = fs.readFileSync(path, "utf8")
  fs.writeFileSync(path, text.replace(/"version": "[^"]*"/, `"version": "${process.argv[2]}"`))
' "$manifest" "$next"

npm run --silent check
git add "$manifest"
git commit --quiet -m "Release $next"
claude plugin tag plugin -m "Backseat Driver %s"

if [ "$push" = "--push" ]; then
  git push --quiet origin main
  git push --quiet origin "backseat-driver--v$next"
  echo "Pushed main and backseat-driver--v$next."
else
  echo "Tagged backseat-driver--v$next. Push with: git push origin main backseat-driver--v$next"
fi
